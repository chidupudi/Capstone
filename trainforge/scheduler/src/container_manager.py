# File: trainforge/scheduler/src/container_manager.py
# Container orchestration and management for TrainForge

import docker
import subprocess
import time
import threading
from typing import List, Dict, Optional, Any
from dataclasses import dataclass
from pathlib import Path
import json
import os

@dataclass
class ContainerInfo:
    """Information about a running container"""
    container_id: str
    job_id: str
    status: str
    created_at: float
    gpu_ids: List[int]
    image: str
    command: str

class ContainerManager:
    """Manages Docker containers and training processes"""

    def __init__(self):
        try:
            self.docker_client = docker.from_env()
            self.docker_available = True
            print("✅ Container Manager: Docker client initialized")
        except Exception as e:
            print(f"⚠️ Container Manager: Docker not available, using subprocess fallback: {e}")
            self.docker_client = None
            self.docker_available = False

        self.containers: Dict[str, ContainerInfo] = {}
        self.processes: Dict[str, subprocess.Popen] = {}
        self.monitoring = True
        self.monitor_thread = None
        self.start_monitoring()

    def start_monitoring(self):
        """Start container monitoring thread"""
        if self.monitor_thread is None or not self.monitor_thread.is_alive():
            self.monitor_thread = threading.Thread(target=self._monitor_containers, daemon=True)
            self.monitor_thread.start()
            print("📊 Container monitoring started")

    def stop_monitoring(self):
        """Stop container monitoring"""
        self.monitoring = False
        if self.monitor_thread and self.monitor_thread.is_alive():
            self.monitor_thread.join(timeout=5)

    def start_single_gpu_training(self, job_id: str, gpu_id: int, config: dict) -> Optional[str]:
        """Start single GPU training container"""
        print(f"🚀 Starting single GPU training container for job {job_id} on GPU {gpu_id}")

        if self.docker_available:
            return self._start_docker_training(job_id, [gpu_id], config)
        else:
            return self._start_subprocess_training(job_id, [gpu_id], config)

    def _start_subprocess_training(self, job_id: str, gpu_ids: List[int], config: dict) -> Optional[str]:
        """Start subprocess-based training"""
        try:
            # Get project files
            project_path = self._get_project_path(job_id)
            if not project_path:
                print(f"❌ Project files not found for job {job_id}")
                return None

            # Prepare environment
            env = os.environ.copy()
            env.update({
                'TRAINFORGE_JOB_ID': job_id,
                'PYTHONUNBUFFERED': '1',
                'CUDA_VISIBLE_DEVICES': ','.join(map(str, gpu_ids)) if gpu_ids else '',
            })

            # Prepare command
            training_script = config.get('training', {}).get('script', 'train.py')
            command = ['python', training_script]

            print(f"🔧 Starting subprocess: {' '.join(command)}")

            # Start process
            process = subprocess.Popen(
                command,
                cwd=project_path,
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                universal_newlines=True
            )

            process_id = f"process_{process.pid}"
            self.processes[process_id] = process

            # Start log monitoring
            log_thread = threading.Thread(
                target=self._monitor_process_logs,
                args=(job_id, process),
                daemon=True
            )
            log_thread.start()

            print(f"✅ Subprocess {process.pid} started for job {job_id}")
            return process_id

        except Exception as e:
            print(f"❌ Failed to start subprocess: {e}")
            return None

    def _get_project_path(self, job_id: str) -> Optional[Path]:
        """Get project files path for a job"""
        # Standard paths to check
        project_paths = [
            Path(__file__).parent.parent.parent / "api" / "storage" / "projects" / "projects" / job_id,
            Path(__file__).parent.parent.parent / "api" / "storage" / "projects" / job_id,
            Path.cwd() / "storage" / "projects" / job_id,
            Path("/tmp") / "trainforge" / job_id
        ]

        for project_path in project_paths:
            if project_path.exists():
                print(f"📁 Found project files at: {project_path}")
                return project_path

        print(f"❌ Project files not found for job {job_id}")
        for path in project_paths:
            print(f"   Checked: {path}")

        return None

    def _monitor_process_logs(self, job_id: str, process: subprocess.Popen):
        """Monitor subprocess logs"""
        try:
            while process.poll() is None:
                line = process.stdout.readline()
                if line:
                    print(f"[{job_id}] {line.rstrip()}")
                else:
                    time.sleep(0.1)
        except Exception as e:
            print(f"⚠️ Log monitoring error for {job_id}: {e}")

    def _monitor_containers(self):
        """Monitor container status in background"""
        while self.monitoring:
            try:
                self._update_container_status()
                time.sleep(10)  # Check every 10 seconds
            except Exception as e:
                print(f"⚠️ Container monitoring error: {e}")
                time.sleep(30)

    def _update_container_status(self):
        """Update status of processes"""
        for process_id, process in list(self.processes.items()):
            try:
                if process.poll() is not None:
                    print(f"🏁 Process {process_id} completed with exit code {process.returncode}")
            except Exception as e:
                print(f"⚠️ Error checking process {process_id}: {e}")

    def stop_containers(self, container_ids: List[str]):
        """Stop specified containers"""
        for container_id in container_ids:
            try:
                if container_id.startswith('process_'):
                    # Handle subprocess
                    if container_id in self.processes:
                        process = self.processes[container_id]
                        process.terminate()
                        try:
                            process.wait(timeout=10)
                        except subprocess.TimeoutExpired:
                            process.kill()
                        print(f"🛑 Stopped process {container_id}")
            except Exception as e:
                print(f"❌ Error stopping container {container_id}: {e}")

    def cleanup_containers(self, container_ids: List[str]):
        """Clean up specified containers"""
        for container_id in container_ids:
            try:
                if container_id.startswith('process_'):
                    if container_id in self.processes:
                        del self.processes[container_id]
                        print(f"🧹 Cleaned up process {container_id}")
            except Exception as e:
                print(f"⚠️ Error cleaning up container {container_id}: {e}")

    def are_containers_completed(self, container_ids: List[str]) -> bool:
        """Check if all containers are completed"""
        for container_id in container_ids:
            try:
                if container_id.startswith('process_'):
                    if container_id in self.processes:
                        process = self.processes[container_id]
                        if process.poll() is None:
                            return False  # Still running
            except Exception as e:
                print(f"⚠️ Error checking container {container_id}: {e}")
        return True  # All completed

    def get_container_exit_codes(self, container_ids: List[str]) -> List[Optional[int]]:
        """Get exit codes for containers"""
        exit_codes = []
        for container_id in container_ids:
            try:
                if container_id.startswith('process_'):
                    if container_id in self.processes:
                        process = self.processes[container_id]
                        exit_codes.append(process.poll())
                    else:
                        exit_codes.append(0)
                else:
                    exit_codes.append(0)
            except Exception as e:
                print(f"⚠️ Error getting exit code for {container_id}: {e}")
                exit_codes.append(None)
        return exit_codes