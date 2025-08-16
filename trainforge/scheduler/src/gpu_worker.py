# File: trainforge/worker/src/gpu_worker.py
# Enhanced worker with GPU orchestration and parallel training support

import time
import json
import requests
import threading
import asyncio
from typing import Dict, List, Optional, Any
from datetime import datetime
import psutil
import signal
import os
import sys

# Add scheduler modules to path
sys.path.append(os.path.join(os.path.dirname(__file__), '../../scheduler/src'))

from gpu_manager import gpu_manager
from job_scheduler import job_scheduler, JobRequest, JobPriority

class GPUWorker:
    """Enhanced worker with GPU orchestration capabilities"""
    
    def __init__(self, api_url="http://localhost:3000", worker_id=None):
        self.api_url = api_url.rstrip('/')
        self.worker_id = worker_id or f"worker-{int(time.time())}"
        self.running = True
        self.current_jobs = {}  # job_id -> job_info
        
        # Worker capabilities
        self.max_concurrent_jobs = 3  # Max parallel jobs
        self.gpu_memory_buffer = 1024  # MB to reserve per GPU
        
        # Monitoring
        self.stats = {
            "jobs_completed": 0,
            "jobs_failed": 0,
            "total_gpu_hours": 0,
            "uptime_start": time.time()
        }
        
        # Setup signal handlers
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
        
        print(f"🤖 Enhanced GPU Worker initialized - ID: {self.worker_id}")
        print(f"📡 API URL: {self.api_url}")
        print(f"🔧 Max concurrent jobs: {self.max_concurrent_jobs}")
    
    def start(self):
        """Start the enhanced worker"""
        print("🚀 Starting Enhanced GPU Worker...")
        
        # Check API connectivity
        if not self._check_api_health():
            print("❌ Cannot connect to TrainForge API. Exiting.")
            return
        
        # Initialize GPU manager
        if not self._initialize_gpu_resources():
            print("❌ Failed to initialize GPU resources. Exiting.")
            return
        
        # Register worker with API
        self._register_worker()
        
        print("✅ Worker initialized successfully")
        print("👀 Starting job polling...")
        
        # Start monitoring threads
        monitor_thread = threading.Thread(target=self._monitor_resources, daemon=True)
        monitor_thread.start()
        
        # Main worker loop
        self._worker_loop()
    
    def _check_api_health(self):
        """Check if API server is accessible"""
        try:
            response = requests.get(f"{self.api_url}/health", timeout=5)
            return response.status_code == 200
        except requests.exceptions.RequestException:
            return False
    
    def _initialize_gpu_resources(self):
        """Initialize GPU resource management"""
        try:
            # GPU manager should already be initialized
            gpu_status = gpu_manager.get_gpu_status()
            
            print(f"🔍 GPU Resources Detected:")
            print(f"   Total GPUs: {gpu_status['total_gpus']}")
            print(f"   Available GPUs: {gpu_status['available_gpus']}")
            print(f"   Total GPU Memory: {gpu_status['total_memory_mb']:.1f} MB")
            
            for gpu_id, gpu_info in gpu_status['gpus'].items():
                print(f"   GPU {gpu_id}: {gpu_info['name']} ({gpu_info['memory_total']} MB)")
            
            return gpu_status['total_gpus'] > 0
            
        except Exception as e:
            print(f"❌ GPU initialization failed: {e}")
            return False
    
    def _register_worker(self):
        """Register worker with the API"""
        try:
            gpu_status = gpu_manager.get_gpu_status()
            system_info = self._get_system_info()
            
            worker_info = {
                "worker_id": self.worker_id,
                "status": "active",
                "capabilities": {
                    "max_concurrent_jobs": self.max_concurrent_jobs,
                    "gpu_count": gpu_status['total_gpus'],
                    "gpu_memory_total": gpu_status['total_memory_mb'],
                    "cpu_count": system_info['cpu_count'],
                    "memory_total": system_info['memory_total'],
                    "supports_distributed": True,
                    "frameworks": ["pytorch", "tensorflow", "horovod"]
                },
                "resources": gpu_status,
                "system_info": system_info
            }
            
            # Note: This would require an API endpoint for worker registration
            # For now, we'll just log the registration
            print(f"📝 Worker registered: {self.worker_id}")
            print(f"   Capabilities: {worker_info['capabilities']}")
            
        except Exception as e:
            print(f"⚠️ Worker registration failed: {e}")
    
    def _get_system_info(self):
        """Get system information"""
        return {
            "cpu_count": psutil.cpu_count(),
            "memory_total": psutil.virtual_memory().total // (1024 * 1024),  # MB
            "disk_free": psutil.disk_usage('/').free // (1024 * 1024 * 1024),  # GB
            "platform": sys.platform,
            "python_version": sys.version
        }
    
    def _worker_loop(self):
        """Main worker loop"""
        while self.running:
            try:
                # Clean up completed jobs
                self._cleanup_completed_jobs()
                
                # Check for new jobs if we have capacity
                if self._has_capacity():
                    job = self._get_next_job()
                    if job:
                        self._process_job(job)
                
                # Update worker status
                self._update_worker_status()
                
                time.sleep(5)  # Check every 5 seconds
                
            except KeyboardInterrupt:
                print("\n👋 Worker stopped by user")
                break
            except Exception as e:
                print(f"❌ Worker loop error: {e}")
                time.sleep(10)
        
        self._shutdown()
    
    def _has_capacity(self):
        """Check if worker has capacity for more jobs"""
        active_jobs = len([j for j in self.current_jobs.values() if j['status'] == 'running'])
        return active_jobs < self.max_concurrent_jobs
    
    def _get_next_job(self):
        """Get next job from API with intelligent resource matching"""
        try:
            response = requests.get(f"{self.api_url}/api/jobs?limit=10")
            if response.status_code == 200:
                data = response.json()
                jobs = data.get('jobs', [])
                
                # Find suitable pending jobs
                for job in jobs:
                    if job['status'] == 'pending' and self._can_handle_job(job):
                        return job
            
            return None
            
        except requests.exceptions.RequestException as e:
            print(f"⚠️ Failed to fetch jobs: {e}")
            return None
    
    def _can_handle_job(self, job):
        """Check if worker can handle this job based on resources"""
        try:
            resources = job.get('resources', {})
            gpu_required = resources.get('gpu', 1)
            memory_per_gpu = resources.get('memory_per_gpu', 4096)
            
            # Check if we have enough available GPUs
            available_gpus = gpu_manager.get_available_gpus(memory_per_gpu)
            
            if len(available_gpus) >= gpu_required:
                print(f"✅ Can handle job {job['job_id']} - Need {gpu_required} GPU(s), have {len(available_gpus)} available")
                return True
            else:
                print(f"⚠️ Cannot handle job {job['job_id']} - Need {gpu_required} GPU(s), only {len(available_gpus)} available")
                return False
                
        except Exception as e:
            print(f"❌ Error checking job capacity: {e}")
            return False
    
    def _process_job(self, job):
        """Process a job using the scheduler"""
        job_id = job['job_id']
        
        try:
            print(f"\n📥 Processing job: {job_id}")
            print(f"📁 Project: {job['project_name']}")
            print(f"🔧 Resources: {job.get('resources', {})}")
            
            # Create job request for scheduler
            job_request = JobRequest(
                job_id=job_id,
                project_name=job['project_name'],
                training_script=job.get('training_script', 'train.py'),
                config=job.get('config', {}),
                resource_requirements=job.get('resources', {}),
                priority=JobPriority.NORMAL
            )
            
            # Update job status to running
            self._update_job_status(job_id, "running", started_at=datetime.now().isoformat())
            
            # Submit to scheduler
            success = job_scheduler.submit_job(job_request)
            
            if success:
                # Track job
                self.current_jobs[job_id] = {
                    'status': 'running',
                    'started_at': time.time(),
                    'project_name': job['project_name'],
                    'resources': job.get('resources', {}),
                    'request': job_request
                }
                
                print(f"✅ Job {job_id} submitted to scheduler")
            else:
                print(f"❌ Failed to submit job {job_id} to scheduler")
                self._update_job_status(job_id, "failed", 
                                      error_message="Failed to schedule job",
                                      completed_at=datetime.now().isoformat())
                
        except Exception as e:
            print(f"❌ Error processing job {job_id}: {e}")
            self._update_job_status(job_id, "failed", 
                                  error_message=str(e),
                                  completed_at=datetime.now().isoformat())
    
    def _cleanup_completed_jobs(self):
        """Clean up completed jobs and update statistics"""
        completed_jobs = []
        
        for job_id, job_info in self.current_jobs.items():
            try:
                # Check job status in scheduler
                scheduler_status = job_scheduler.get_job_status(job_id)
                
                if scheduler_status:
                    if scheduler_status['status'] in ['completed', 'failed']:
                        # Update API with final status
                        if scheduler_status['status'] == 'completed':
                            self._handle_job_completion(job_id, job_info, scheduler_status)
                        else:
                            self._handle_job_failure(job_id, job_info, scheduler_status)
                        
                        completed_jobs.append(job_id)
                
            except Exception as e:
                print(f"❌ Error checking job {job_id}: {e}")
        
        # Remove completed jobs from tracking
        for job_id in completed_jobs:
            if job_id in self.current_jobs:
                del self.current_jobs[job_id]
    
    def _handle_job_completion(self, job_id, job_info, scheduler_status):
        """Handle successful job completion"""
        duration = time.time() - job_info['started_at']
        gpu_count = job_info['resources'].get('gpu', 1)
        gpu_hours = gpu_count * (duration / 3600)
        
        # Update statistics
        self.stats['jobs_completed'] += 1
        self.stats['total_gpu_hours'] += gpu_hours
        
        # Update job in API
        self._update_job_status(
            job_id, 
            "completed",
            progress=100,
            completed_at=datetime.now().isoformat()
        )
        
        self._add_job_log(job_id, f"Job completed successfully in {duration:.1f} seconds")
        self._add_job_log(job_id, f"GPU hours used: {gpu_hours:.2f}")
        
        print(f"🎉 Job {job_id} completed successfully")
        print(f"   Duration: {duration:.1f} seconds")
        print(f"   GPU hours: {gpu_hours:.2f}")
    
    def _handle_job_failure(self, job_id, job_info, scheduler_status):
        """Handle job failure"""
        # Update statistics
        self.stats['jobs_failed'] += 1
        
        # Update job in API
        self._update_job_status(
            job_id,
            "failed",
            error_message="Job failed during execution",
            completed_at=datetime.now().isoformat()
        )
        
        self._add_job_log(job_id, "Job failed during execution")
        
        print(f"❌ Job {job_id} failed")
    
    def _update_job_status(self, job_id, status, **kwargs):
        """Update job status in API"""
        try:
            data = {"status": status, **kwargs}
            response = requests.put(f"{self.api_url}/api/jobs/{job_id}", json=data)
            if response.status_code == 200:
                print(f"📝 Job {job_id} status updated: {status}")
            else:
                print(f"⚠️ Failed to update job status: {response.text}")
        except Exception as e:
            print(f"⚠️ Failed to update job status: {e}")
    
    def _add_job_log(self, job_id, message):
        """Add log entry to job"""
        try:
            data = {"message": message}
            response = requests.post(f"{self.api_url}/api/jobs/{job_id}/logs", json=data)
            if response.status_code != 200:
                print(f"⚠️ Failed to add log: {response.text}")
        except Exception as e:
            print(f"⚠️ Failed to add log: {e}")
    
    def _monitor_resources(self):
        """Monitor system resources and GPU status"""
        while self.running:
            try:
                # Get current resource usage
                cpu_percent = psutil.cpu_percent(interval=1)
                memory = psutil.virtual_memory()
                gpu_status = gpu_manager.get_gpu_status()
                
                # Log resource usage periodically
                if int(time.time()) % 60 == 0:  # Every minute
                    print(f"📊 Resource Status:")
                    print(f"   CPU: {cpu_percent:.1f}%")
                    print(f"   Memory: {memory.percent:.1f}% ({memory.used // (1024**3):.1f}GB / {memory.total // (1024**3):.1f}GB)")
                    print(f"   GPUs: {gpu_status['allocated_gpus']}/{gpu_status['total_gpus']} allocated")
                    print(f"   Active Jobs: {len(self.current_jobs)}")
                
                # Check for resource alerts
                if cpu_percent > 90:
                    print("⚠️ High CPU usage detected")
                if memory.percent > 90:
                    print("⚠️ High memory usage detected")
                
                time.sleep(30)  # Monitor every 30 seconds
                
            except Exception as e:
                print(f"❌ Resource monitoring error: {e}")
                time.sleep(60)
    
    def _update_worker_status(self):
        """Update worker status with API"""
        try:
            uptime = time.time() - self.stats['uptime_start']
            gpu_status = gpu_manager.get_gpu_status()
            
            worker_status = {
                "worker_id": self.worker_id,
                "status": "active",
                "current_jobs": len(self.current_jobs),
                "stats": {
                    **self.stats,
                    "uptime_seconds": uptime
                },
                "resources": gpu_status,
                "last_heartbeat": datetime.now().isoformat()
            }
            
            # Log status periodically
            if int(time.time()) % 300 == 0:  # Every 5 minutes
                print(f"💓 Worker heartbeat - Jobs: {len(self.current_jobs)}, Uptime: {uptime/3600:.1f}h")
            
        except Exception as e:
            print(f"⚠️ Failed to update worker status: {e}")
    
    def _signal_handler(self, signum, frame):
        """Handle shutdown signals gracefully"""
        print(f"\n⚠️ Received signal {signum}, shutting down gracefully...")
        self.running = False
        
        # Cancel all running jobs
        for job_id in list(self.current_jobs.keys()):
            try:
                job_scheduler.cancel_job(job_id)
                self._update_job_status(job_id, "cancelled", 
                                      completed_at=datetime.now().isoformat())
                print(f"🚫 Cancelled job: {job_id}")
            except Exception as e:
                print(f"⚠️ Error cancelling job {job_id}: {e}")
    
    def _shutdown(self):
        """Clean shutdown procedure"""
        print("🛑 Shutting down worker...")
        
        # Stop schedulers
        job_scheduler.stop_scheduler()
        gpu_manager.stop_monitoring()
        
        # Print final statistics
        uptime = time.time() - self.stats['uptime_start']
        print(f"\n📊 Final Statistics:")
        print(f"   Uptime: {uptime/3600:.1f} hours")
        print(f"   Jobs completed: {self.stats['jobs_completed']}")
        print(f"   Jobs failed: {self.stats['jobs_failed']}")
        print(f"   Total GPU hours: {self.stats['total_gpu_hours']:.2f}")
        
        print("👋 Worker shutdown complete")

def main():
    """Main entry point for enhanced GPU worker"""
    import argparse
    
    parser = argparse.ArgumentParser(description="TrainForge Enhanced GPU Worker")
    parser.add_argument("--api-url", default="http://localhost:3000", 
                       help="TrainForge API URL")
    parser.add_argument("--worker-id", default=None,
                       help="Worker ID (auto-generated if not provided)")
    parser.add_argument("--max-jobs", type=int, default=3,
                       help="Maximum concurrent jobs")
    
    args = parser.parse_args()
    
    print("🤖 TrainForge Enhanced GPU Worker")
    print("=" * 50)
    
    # Create and start worker
    worker = GPUWorker(api_url=args.api_url, worker_id=args.worker_id)
    worker.max_concurrent_jobs = args.max_jobs
    
    try:
        worker.start()
    except KeyboardInterrupt:
        print("\n👋 Worker stopped by user")
    except Exception as e:
        print(f"❌ Worker crashed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()