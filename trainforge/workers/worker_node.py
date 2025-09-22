#!/usr/bin/env python3
# File: trainforge/workers/worker_node.py
# Standalone worker node for distributed training

import sys
import os
import time
import threading
import requests
import json
import signal
import socket
from pathlib import Path
from typing import Dict, Any, Optional
import subprocess
import psutil

# Add scheduler src to path
sys.path.append(str(Path(__file__).parent.parent / "scheduler" / "src"))

from gpu_manager import GPUResourceManager
from cpu_manager import CPUResourceManager
from container_manager import ContainerManager

class WorkerNode:
    """Standalone worker node that connects to TrainForge scheduler"""

    def __init__(self,
                 scheduler_url: str = "http://localhost:3000",
                 worker_id: Optional[str] = None,
                 max_jobs: int = 4):

        self.scheduler_url = scheduler_url.rstrip('/')
        self.worker_id = worker_id or self._generate_worker_id()
        self.max_jobs = max_jobs

        # Resource managers
        self.gpu_manager = GPUResourceManager()
        self.cpu_manager = CPUResourceManager()
        self.container_manager = ContainerManager()

        # Worker state
        self.running = False
        self.active_jobs = {}
        self.heartbeat_thread = None
        self.job_polling_thread = None

        # System info
        self.system_info = self._get_system_info()

        print(f"🏃 Worker Node {self.worker_id} initialized")
        print(f"   Scheduler: {self.scheduler_url}")
        print(f"   Max Jobs: {max_jobs}")
        print(f"   GPUs: {len(self.gpu_manager.gpus)}")
        print(f"   CPUs: {self.cpu_manager.get_cpu_status()['total_cores']}")

    def _generate_worker_id(self) -> str:
        """Generate unique worker ID"""
        hostname = socket.gethostname()
        pid = os.getpid()
        return f"worker_{hostname}_{pid}"

    def _get_system_info(self) -> Dict[str, Any]:
        """Get system information for registration"""
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')

        return {
            "worker_id": self.worker_id,
            "hostname": socket.gethostname(),
            "platform": sys.platform,
            "python_version": sys.version,
            "cpu_count": psutil.cpu_count(),
            "memory_total_gb": memory.total / (1024**3),
            "disk_total_gb": disk.total / (1024**3),
            "gpu_count": len(self.gpu_manager.gpus),
            "gpus": [
                {
                    "gpu_id": gpu_id,
                    "name": gpu.name,
                    "memory_mb": gpu.memory_total_mb
                } for gpu_id, gpu in self.gpu_manager.gpus.items()
            ]
        }

    def start(self):
        """Start the worker node"""
        if self.running:
            print("⚠️ Worker already running")
            return

        print(f"🚀 Starting worker node {self.worker_id}")

        # Register with scheduler
        if not self._register_with_scheduler():
            print("❌ Failed to register with scheduler")
            return

        self.running = True

        # Start background threads
        self.heartbeat_thread = threading.Thread(target=self._heartbeat_loop, daemon=True)
        self.job_polling_thread = threading.Thread(target=self._job_polling_loop, daemon=True)

        self.heartbeat_thread.start()
        self.job_polling_thread.start()

        print(f"✅ Worker node {self.worker_id} started successfully")

        # Setup signal handlers
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)

    def stop(self):
        """Stop the worker node"""
        if not self.running:
            return

        print(f"🛑 Stopping worker node {self.worker_id}")
        self.running = False

        # Stop active jobs
        for job_id in list(self.active_jobs.keys()):
            self._stop_job(job_id)

        # Unregister from scheduler
        self._unregister_from_scheduler()

        print(f"✅ Worker node {self.worker_id} stopped")

    def _signal_handler(self, signum, frame):
        """Handle shutdown signals"""
        print(f"\n🔔 Received signal {signum}, shutting down...")
        self.stop()
        sys.exit(0)

    def _register_with_scheduler(self) -> bool:
        """Register this worker with the scheduler"""
        try:
            response = requests.post(
                f"{self.scheduler_url}/api/workers/register",
                json={
                    "worker_info": self.system_info,
                    "capabilities": {
                        "max_concurrent_jobs": self.max_jobs,
                        "supports_gpu": len(self.gpu_manager.gpus) > 0,
                        "supports_docker": self.container_manager.docker_available
                    }
                },
                timeout=10
            )

            if response.status_code == 200:
                print(f"✅ Registered with scheduler")
                return True
            else:
                print(f"❌ Registration failed: {response.text}")
                return False

        except requests.exceptions.RequestException as e:
            print(f"❌ Failed to connect to scheduler: {e}")
            return False

    def _unregister_from_scheduler(self):
        """Unregister this worker from the scheduler"""
        try:
            requests.post(
                f"{self.scheduler_url}/api/workers/unregister",
                json={"worker_id": self.worker_id},
                timeout=5
            )
        except:
            pass  # Best effort

    def _heartbeat_loop(self):
        """Send periodic heartbeat to scheduler"""
        while self.running:
            try:
                self._send_heartbeat()
                time.sleep(30)  # Heartbeat every 30 seconds
            except Exception as e:
                print(f"⚠️ Heartbeat error: {e}")
                time.sleep(60)

    def _send_heartbeat(self):
        """Send heartbeat with current status"""
        status = {
            "worker_id": self.worker_id,
            "timestamp": time.time(),
            "active_jobs": len(self.active_jobs),
            "max_jobs": self.max_jobs,
            "cpu_status": self.cpu_manager.get_cpu_status(),
            "gpu_status": self.gpu_manager.get_gpu_status(),
            "memory_usage": psutil.virtual_memory().percent,
            "load_average": psutil.getloadavg() if hasattr(psutil, 'getloadavg') else [0, 0, 0]
        }

        try:
            requests.post(
                f"{self.scheduler_url}/api/workers/heartbeat",
                json=status,
                timeout=10
            )
        except requests.exceptions.RequestException as e:
            print(f"⚠️ Heartbeat failed: {e}")

    def _job_polling_loop(self):
        """Poll for new jobs from scheduler"""
        while self.running:
            try:
                if len(self.active_jobs) < self.max_jobs:
                    self._poll_for_jobs()
                time.sleep(5)  # Poll every 5 seconds
            except Exception as e:
                print(f"⚠️ Job polling error: {e}")
                time.sleep(10)

    def _poll_for_jobs(self):
        """Poll scheduler for available jobs"""
        try:
            response = requests.get(
                f"{self.scheduler_url}/api/workers/jobs",
                params={"worker_id": self.worker_id},
                timeout=10
            )

            if response.status_code == 200:
                jobs = response.json().get('jobs', [])
                for job in jobs:
                    if len(self.active_jobs) < self.max_jobs:
                        self._start_job(job)
                    else:
                        break

        except requests.exceptions.RequestException as e:
            print(f"⚠️ Job polling failed: {e}")

    def _start_job(self, job: Dict[str, Any]):
        """Start executing a job"""
        job_id = job['job_id']

        if job_id in self.active_jobs:
            return

        print(f"🚀 Starting job {job_id}")

        try:
            # Allocate resources
            gpu_count = job.get('resources', {}).get('gpu', 1)
            cpu_count = job.get('resources', {}).get('cpu', 2)

            allocated_gpus = []
            if gpu_count > 0:
                allocated_gpus = self.gpu_manager.allocate_gpus(job_id, gpu_count)
                if not allocated_gpus:
                    print(f"❌ Cannot allocate {gpu_count} GPUs for job {job_id}")
                    return

            allocated_cpus = self.cpu_manager.allocate_cpus(job_id, cpu_count)
            if not allocated_cpus:
                print(f"❌ Cannot allocate {cpu_count} CPUs for job {job_id}")
                if allocated_gpus:
                    self.gpu_manager.deallocate_gpus(job_id)
                return

            # Start training container/process
            if len(allocated_gpus) > 1:
                container_ids = self.container_manager.start_multi_gpu_training(
                    job_id, allocated_gpus, job
                )
            else:
                container_id = self.container_manager.start_single_gpu_training(
                    job_id, allocated_gpus[0] if allocated_gpus else -1, job
                )
                container_ids = [container_id] if container_id else []

            if not container_ids:
                print(f"❌ Failed to start containers for job {job_id}")
                self.gpu_manager.deallocate_gpus(job_id)
                self.cpu_manager.deallocate_cpus(job_id)
                return

            # Track job
            self.active_jobs[job_id] = {
                "job": job,
                "allocated_gpus": allocated_gpus,
                "allocated_cpus": allocated_cpus,
                "container_ids": container_ids,
                "started_at": time.time()
            }

            # Notify scheduler job started
            self._notify_job_status(job_id, "running")

            # Start job monitoring thread
            monitor_thread = threading.Thread(
                target=self._monitor_job,
                args=(job_id,),
                daemon=True
            )
            monitor_thread.start()

            print(f"✅ Job {job_id} started successfully")

        except Exception as e:
            print(f"❌ Failed to start job {job_id}: {e}")
            self._cleanup_job(job_id)

    def _monitor_job(self, job_id: str):
        """Monitor a running job"""
        while job_id in self.active_jobs and self.running:
            try:
                job_info = self.active_jobs[job_id]
                container_ids = job_info["container_ids"]

                # Check if containers are still running
                if self.container_manager.are_containers_completed(container_ids):
                    print(f"🏁 Job {job_id} completed")

                    # Get exit codes
                    exit_codes = self.container_manager.get_container_exit_codes(container_ids)
                    success = all(code == 0 for code in exit_codes if code is not None)

                    # Notify scheduler
                    status = "completed" if success else "failed"
                    self._notify_job_status(job_id, status, {
                        "exit_codes": exit_codes,
                        "duration": time.time() - job_info["started_at"]
                    })

                    # Cleanup
                    self._cleanup_job(job_id)
                    break

                time.sleep(10)  # Check every 10 seconds

            except Exception as e:
                print(f"⚠️ Job monitoring error for {job_id}: {e}")
                time.sleep(30)

    def _stop_job(self, job_id: str):
        """Stop a running job"""
        if job_id not in self.active_jobs:
            return

        print(f"🛑 Stopping job {job_id}")

        job_info = self.active_jobs[job_id]

        # Stop containers
        self.container_manager.stop_containers(job_info["container_ids"])

        # Notify scheduler
        self._notify_job_status(job_id, "cancelled")

        # Cleanup resources
        self._cleanup_job(job_id)

    def _cleanup_job(self, job_id: str):
        """Clean up job resources"""
        if job_id not in self.active_jobs:
            return

        job_info = self.active_jobs[job_id]

        # Clean up containers
        self.container_manager.cleanup_containers(job_info["container_ids"])

        # Deallocate resources
        if job_info["allocated_gpus"]:
            self.gpu_manager.deallocate_gpus(job_id)

        self.cpu_manager.deallocate_cpus(job_id)

        # Remove from active jobs
        del self.active_jobs[job_id]

        print(f"🧹 Cleaned up job {job_id}")

    def _notify_job_status(self, job_id: str, status: str, details: Dict[str, Any] = None):
        """Notify scheduler of job status change"""
        try:
            data = {
                "worker_id": self.worker_id,
                "job_id": job_id,
                "status": status,
                "timestamp": time.time()
            }

            if details:
                data.update(details)

            requests.post(
                f"{self.scheduler_url}/api/workers/job-status",
                json=data,
                timeout=10
            )

        except requests.exceptions.RequestException as e:
            print(f"⚠️ Failed to notify job status: {e}")

    def get_status(self) -> Dict[str, Any]:
        """Get current worker status"""
        return {
            "worker_id": self.worker_id,
            "running": self.running,
            "active_jobs": len(self.active_jobs),
            "max_jobs": self.max_jobs,
            "system_info": self.system_info,
            "gpu_status": self.gpu_manager.get_gpu_status(),
            "cpu_status": self.cpu_manager.get_cpu_status(),
            "memory_usage": psutil.virtual_memory().percent
        }


def main():
    """Main entry point for worker node"""
    import argparse

    parser = argparse.ArgumentParser(description="TrainForge Worker Node")
    parser.add_argument("--scheduler", default="http://localhost:3000", help="Scheduler URL")
    parser.add_argument("--worker-id", help="Worker ID (auto-generated if not provided)")
    parser.add_argument("--max-jobs", type=int, default=4, help="Maximum concurrent jobs")
    parser.add_argument("--status", action="store_true", help="Show status and exit")

    args = parser.parse_args()

    # Create worker node
    worker = WorkerNode(
        scheduler_url=args.scheduler,
        worker_id=args.worker_id,
        max_jobs=args.max_jobs
    )

    if args.status:
        # Show status and exit
        status = worker.get_status()
        print(json.dumps(status, indent=2))
        return

    try:
        # Start worker
        worker.start()

        if worker.running:
            print(f"🎯 Worker node running. Press Ctrl+C to stop.")

            # Keep running until interrupted
            while worker.running:
                time.sleep(1)
        else:
            print("❌ Failed to start worker node")

    except KeyboardInterrupt:
        print("\n🔔 Shutdown requested...")
    finally:
        worker.stop()


if __name__ == "__main__":
    main()