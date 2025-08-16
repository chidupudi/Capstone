# File: trainforge/scheduler/src/job_scheduler.py
# Advanced job scheduler with GPU orchestration and parallel training

import asyncio
import threading
import time
import json
import queue
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from enum import Enum
from datetime import datetime, timedelta
import docker
import subprocess
import os

from .gpu_manager import gpu_manager, GPUStatus
from .container_manager import ContainerManager
from .distributed_trainer import DistributedTrainer

class JobPriority(Enum):
    LOW = 1
    NORMAL = 2
    HIGH = 3
    URGENT = 4

class SchedulingStrategy(Enum):
    FIFO = "fifo"  # First In, First Out
    FAIR_SHARE = "fair_share"  # Fair resource sharing
    PRIORITY = "priority"  # Priority-based
    GPU_AWARE = "gpu_aware"  # GPU-optimized scheduling

@dataclass
class JobRequest:
    """Job request with resource requirements"""
    job_id: str
    project_name: str
    training_script: str
    config: Dict[str, Any]
    resource_requirements: Dict[str, Any]
    priority: JobPriority = JobPriority.NORMAL
    submitted_at: float = None
    estimated_duration: int = 3600  # seconds
    max_retries: int = 3
    retry_count: int = 0
    
    def __post_init__(self):
        if self.submitted_at is None:
            self.submitted_at = time.time()

@dataclass
class ScheduledJob:
    """Scheduled job with allocated resources"""
    request: JobRequest
    allocated_gpus: List[int]
    worker_nodes: List[str]
    container_ids: List[str] = None
    started_at: float = None
    estimated_completion: float = None
    
    def __post_init__(self):
        if self.started_at is None:
            self.started_at = time.time()
        if self.estimated_completion is None:
            self.estimated_completion = self.started_at + self.request.estimated_duration

class JobScheduler:
    """Advanced job scheduler with GPU orchestration"""
    
    def __init__(self, strategy: SchedulingStrategy = SchedulingStrategy.GPU_AWARE):
        self.strategy = strategy
        self.job_queue = queue.PriorityQueue()
        self.running_jobs: Dict[str, ScheduledJob] = {}
        self.completed_jobs: Dict[str, ScheduledJob] = {}
        self.failed_jobs: Dict[str, ScheduledJob] = {}
        
        # Components
        self.container_manager = ContainerManager()
        self.distributed_trainer = DistributedTrainer()
        
        # Scheduling state
        self.scheduling = True
        self.scheduler_thread = None
        self.lock = threading.Lock()
        
        # Metrics
        self.total_jobs_scheduled = 0
        self.total_gpu_hours = 0
        self.average_queue_time = 0
        
        # Start scheduler
        self.start_scheduler()
    
    def start_scheduler(self):
        """Start the job scheduler"""
        if self.scheduler_thread is None or not self.scheduler_thread.is_alive():
            self.scheduler_thread = threading.Thread(target=self._scheduler_loop, daemon=True)
            self.scheduler_thread.start()
            print("🚀 Job scheduler started")
    
    def stop_scheduler(self):
        """Stop the job scheduler"""
        self.scheduling = False
        if self.scheduler_thread and self.scheduler_thread.is_alive():
            self.scheduler_thread.join()
        print("🛑 Job scheduler stopped")
    
    def submit_job(self, job_request: JobRequest) -> bool:
        """Submit a job to the scheduler"""
        try:
            # Validate job request
            if not self._validate_job_request(job_request):
                return False
            
            # Calculate priority score for queue ordering
            priority_score = self._calculate_priority_score(job_request)
            
            # Add to queue (lower score = higher priority)
            self.job_queue.put((priority_score, time.time(), job_request))
            
            print(f"📥 Job {job_request.job_id} submitted to scheduler")
            print(f"   Resources: {job_request.resource_requirements}")
            print(f"   Priority: {job_request.priority.name}")
            
            return True
            
        except Exception as e:
            print(f"❌ Failed to submit job {job_request.job_id}: {e}")
            return False
    
    def _validate_job_request(self, job_request: JobRequest) -> bool:
        """Validate job request parameters"""
        required_resources = job_request.resource_requirements
        
        # Check GPU requirements
        gpu_count = required_resources.get('gpu', 1)
        memory_per_gpu = required_resources.get('memory_per_gpu', 4096)
        
        if gpu_count < 1 or gpu_count > len(gpu_manager.gpus):
            print(f"❌ Invalid GPU count: {gpu_count}")
            return False
        
        if memory_per_gpu < 1024:  # Minimum 1GB
            print(f"❌ Invalid memory requirement: {memory_per_gpu}MB")
            return False
        
        return True
    
    def _calculate_priority_score(self, job_request: JobRequest) -> float:
        """Calculate priority score for job scheduling"""
        base_score = {
            JobPriority.URGENT: 0,
            JobPriority.HIGH: 100,
            JobPriority.NORMAL: 200,
            JobPriority.LOW: 300
        }[job_request.priority]
        
        # Add wait time factor (older jobs get higher priority)
        wait_time = time.time() - job_request.submitted_at
        wait_penalty = wait_time / 3600  # Reduce score by 1 per hour waited
        
        # Add resource factor (smaller jobs get slight priority)
        gpu_count = job_request.resource_requirements.get('gpu', 1)
        resource_penalty = gpu_count * 10
        
        return base_score - wait_penalty + resource_penalty
    
    def _scheduler_loop(self):
        """Main scheduler loop"""
        print("🔄 Scheduler loop started")
        
        while self.scheduling:
            try:
                # Process completed jobs
                self._check_completed_jobs()
                
                # Clean up failed containers
                self._cleanup_failed_jobs()
                
                # Schedule new jobs
                self._schedule_pending_jobs()
                
                # Update metrics
                self._update_metrics()
                
                time.sleep(5)  # Check every 5 seconds
                
            except Exception as e:
                print(f"❌ Scheduler error: {e}")
                time.sleep(10)
    
    def _schedule_pending_jobs(self):
        """Schedule pending jobs based on available resources"""
        scheduled_count = 0
        
        # Process jobs from queue
        while not self.job_queue.empty() and scheduled_count < 5:  # Limit burst scheduling
            try:
                _, _, job_request = self.job_queue.get_nowait()
                
                if self._can_schedule_job(job_request):
                    success = self._schedule_job(job_request)
                    if success:
                        scheduled_count += 1
                    else:
                        # Put job back in queue with retry
                        job_request.retry_count += 1
                        if job_request.retry_count < job_request.max_retries:
                            self.job_queue.put((
                                self._calculate_priority_score(job_request),
                                time.time(),
                                job_request
                            ))
                        else:
                            print(f"❌ Job {job_request.job_id} failed after {job_request.max_retries} retries")
                            self._mark_job_failed(job_request, "Max retries exceeded")
                else:
                    # Put job back in queue
                    self.job_queue.put((
                        self._calculate_priority_score(job_request),
                        time.time(),
                        job_request
                    ))
                    break  # No point checking more jobs if this one can't be scheduled
                    
            except queue.Empty:
                break
            except Exception as e:
                print(f"❌ Error scheduling job: {e}")
    
    def _can_schedule_job(self, job_request: JobRequest) -> bool:
        """Check if job can be scheduled with current resources"""
        gpu_count = job_request.resource_requirements.get('gpu', 1)
        memory_per_gpu = job_request.resource_requirements.get('memory_per_gpu', 4096)
        
        return gpu_manager.can_schedule_job(gpu_count, memory_per_gpu)
    
    def _schedule_job(self, job_request: JobRequest) -> bool:
        """Schedule a job for execution"""
        try:
            print(f"🎯 Scheduling job {job_request.job_id}")
            
            # Allocate GPUs
            gpu_count = job_request.resource_requirements.get('gpu', 1)
            memory_per_gpu = job_request.resource_requirements.get('memory_per_gpu', 4096)
            
            allocated_gpus = gpu_manager.allocate_gpus(
                job_request.job_id, 
                gpu_count, 
                memory_per_gpu
            )
            
            if not allocated_gpus:
                print(f"❌ Failed to allocate GPUs for job {job_request.job_id}")
                return False
            
            # Create scheduled job
            scheduled_job = ScheduledJob(
                request=job_request,
                allocated_gpus=allocated_gpus,
                worker_nodes=["localhost"],  # For now, single node
                container_ids=[]
            )
            
            # Start training containers
            success = self._start_training_containers(scheduled_job)
            
            if success:
                with self.lock:
                    self.running_jobs[job_request.job_id] = scheduled_job
                    self.total_jobs_scheduled += 1
                
                print(f"✅ Job {job_request.job_id} scheduled successfully")
                print(f"   GPUs: {allocated_gpus}")
                print(f"   Estimated completion: {datetime.fromtimestamp(scheduled_job.estimated_completion)}")
                
                return True
            else:
                # Clean up on failure
                gpu_manager.deallocate_gpus(job_request.job_id)
                return False
                
        except Exception as e:
            print(f"❌ Failed to schedule job {job_request.job_id}: {e}")
            return False
    
    def _start_training_containers(self, scheduled_job: ScheduledJob) -> bool:
        """Start training containers for the job"""
        try:
            job_request = scheduled_job.request
            
            if len(scheduled_job.allocated_gpus) == 1:
                # Single GPU training
                container_id = self.container_manager.start_single_gpu_training(
                    job_id=job_request.job_id,
                    gpu_id=scheduled_job.allocated_gpus[0],
                    config=job_request.config
                )
                
                if container_id:
                    scheduled_job.container_ids = [container_id]
                    return True
                    
            else:
                # Multi-GPU distributed training
                container_ids = self.distributed_trainer.start_distributed_training(
                    job_id=job_request.job_id,
                    gpu_ids=scheduled_job.allocated_gpus,
                    config=job_request.config
                )
                
                if container_ids:
                    scheduled_job.container_ids = container_ids
                    return True
            
            return False
            
        except Exception as e:
            print(f"❌ Failed to start containers for job {scheduled_job.request.job_id}: {e}")
            return False
    
    def _check_completed_jobs(self):
        """Check for completed jobs and clean up resources"""
        completed_job_ids = []
        
        with self.lock:
            for job_id, scheduled_job in self.running_jobs.items():
                try:
                    # Check if containers are still running
                    all_completed = self.container_manager.are_containers_completed(
                        scheduled_job.container_ids
                    )
                    
                    if all_completed:
                        print(f"✅ Job {job_id} completed")
                        
                        # Get exit codes and logs
                        exit_codes = self.container_manager.get_container_exit_codes(
                            scheduled_job.container_ids
                        )
                        
                        # Determine if job succeeded
                        success = all(code == 0 for code in exit_codes if code is not None)
                        
                        if success:
                            self._mark_job_completed(scheduled_job)
                        else:
                            self._mark_job_failed(scheduled_job, f"Container exit codes: {exit_codes}")
                        
                        completed_job_ids.append(job_id)
                        
                except Exception as e:
                    print(f"❌ Error checking job {job_id}: {e}")
        
        # Remove completed jobs from running list
        for job_id in completed_job_ids:
            if job_id in self.running_jobs:
                del self.running_jobs[job_id]
    
    def _mark_job_completed(self, scheduled_job: ScheduledJob):
        """Mark job as completed and clean up resources"""
        job_id = scheduled_job.request.job_id
        
        # Deallocate GPUs
        gpu_manager.deallocate_gpus(job_id)
        
        # Clean up containers
        self.container_manager.cleanup_containers(scheduled_job.container_ids)
        
        # Update metrics
        duration = time.time() - scheduled_job.started_at
        gpu_hours = len(scheduled_job.allocated_gpus) * (duration / 3600)
        self.total_gpu_hours += gpu_hours
        
        # Store in completed jobs
        self.completed_jobs[job_id] = scheduled_job
        
        print(f"🎉 Job {job_id} completed successfully")
        print(f"   Duration: {duration:.1f} seconds")
        print(f"   GPU hours: {gpu_hours:.2f}")
    
    def _mark_job_failed(self, scheduled_job_or_request, error_message: str):
        """Mark job as failed and clean up resources"""
        if isinstance(scheduled_job_or_request, JobRequest):
            job_id = scheduled_job_or_request.job_id
            # Create a minimal scheduled job for failed job tracking
            scheduled_job = ScheduledJob(
                request=scheduled_job_or_request,
                allocated_gpus=[],
                worker_nodes=[]
            )
        else:
            scheduled_job = scheduled_job_or_request
            job_id = scheduled_job.request.job_id
            
            # Deallocate GPUs if allocated
            if scheduled_job.allocated_gpus:
                gpu_manager.deallocate_gpus(job_id)
            
            # Clean up containers if started
            if scheduled_job.container_ids:
                self.container_manager.cleanup_containers(scheduled_job.container_ids)
        
        # Store in failed jobs
        self.failed_jobs[job_id] = scheduled_job
        
        print(f"❌ Job {job_id} failed: {error_message}")
    
    def _cleanup_failed_jobs(self):
        """Clean up resources from failed jobs"""
        # This would implement cleanup of stuck containers, etc.
        pass
    
    def _update_metrics(self):
        """Update scheduler metrics"""
        current_time = time.time()
        
        # Calculate average queue time
        if self.total_jobs_scheduled > 0:
            total_queue_time = 0
            job_count = 0
            
            for scheduled_job in list(self.running_jobs.values()) + list(self.completed_jobs.values()):
                queue_time = scheduled_job.started_at - scheduled_job.request.submitted_at
                total_queue_time += queue_time
                job_count += 1
            
            if job_count > 0:
                self.average_queue_time = total_queue_time / job_count
    
    def get_scheduler_status(self) -> Dict[str, Any]:
        """Get scheduler status and metrics"""
        with self.lock:
            gpu_status = gpu_manager.get_gpu_status()
            
            return {
                "strategy": self.strategy.value,
                "queue_size": self.job_queue.qsize(),
                "running_jobs": len(self.running_jobs),
                "completed_jobs": len(self.completed_jobs),
                "failed_jobs": len(self.failed_jobs),
                "total_jobs_scheduled": self.total_jobs_scheduled,
                "total_gpu_hours": self.total_gpu_hours,
                "average_queue_time": self.average_queue_time,
                "gpu_status": gpu_status,
                "running_job_details": {
                    job_id: {
                        "project_name": job.request.project_name,
                        "allocated_gpus": job.allocated_gpus,
                        "started_at": job.started_at,
                        "estimated_completion": job.estimated_completion,
                        "container_ids": job.container_ids
                    } for job_id, job in self.running_jobs.items()
                }
            }
    
    def cancel_job(self, job_id: str) -> bool:
        """Cancel a running job"""
        try:
            with self.lock:
                if job_id in self.running_jobs:
                    scheduled_job = self.running_jobs[job_id]
                    
                    # Stop containers
                    if scheduled_job.container_ids:
                        self.container_manager.stop_containers(scheduled_job.container_ids)
                    
                    # Deallocate GPUs
                    gpu_manager.deallocate_gpus(job_id)
                    
                    # Remove from running jobs
                    del self.running_jobs[job_id]
                    
                    # Mark as cancelled
                    self.failed_jobs[job_id] = scheduled_job
                    
                    print(f"🚫 Job {job_id} cancelled")
                    return True
                else:
                    print(f"⚠️ Job {job_id} not found in running jobs")
                    return False
                    
        except Exception as e:
            print(f"❌ Failed to cancel job {job_id}: {e}")
            return False
    
    def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get status of a specific job"""
        with self.lock:
            # Check running jobs
            if job_id in self.running_jobs:
                job = self.running_jobs[job_id]
                return {
                    "status": "running",
                    "allocated_gpus": job.allocated_gpus,
                    "started_at": job.started_at,
                    "estimated_completion": job.estimated_completion,
                    "container_ids": job.container_ids,
                    "worker_nodes": job.worker_nodes
                }
            
            # Check completed jobs
            if job_id in self.completed_jobs:
                job = self.completed_jobs[job_id]
                duration = time.time() - job.started_at
                return {
                    "status": "completed",
                    "duration": duration,
                    "allocated_gpus": job.allocated_gpus,
                    "gpu_hours": len(job.allocated_gpus) * (duration / 3600)
                }
            
            # Check failed jobs
            if job_id in self.failed_jobs:
                return {"status": "failed"}
            
            return None

# Global scheduler instance
job_scheduler = JobScheduler()