# File: trainforge/scheduler/src/distributed_trainer.py
# Distributed training orchestration for multi-GPU setups

import docker
import subprocess
import os
import json
import time
import threading
from typing import List, Dict, Optional, Any
from pathlib import Path
import tempfile
import shutil

class DistributedTrainer:
    """Orchestrates distributed training across multiple GPUs/nodes"""

    def __init__(self):
        try:
            self.docker_client = docker.from_env()
            self.docker_available = True
            print("✅ Docker client initialized")
        except Exception as e:
            print(f"⚠️ Docker not available, falling back to subprocess: {e}")
            self.docker_client = None
            self.docker_available = False

        self.active_containers = {}
        self.training_processes = {}

    def start_distributed_training(self, job_id: str, gpu_ids: List[int], config: dict) -> List[str]:
        """Start distributed training across multiple GPUs"""
        print(f"🚀 Starting distributed training for job {job_id}")
        print(f"   GPUs: {gpu_ids}")
        print(f"   Config: {config.get('project', {}).get('name', 'Unknown')}")

        if len(gpu_ids) == 1:
            return self._start_single_gpu_training(job_id, gpu_ids[0], config)
        else:
            return self._start_multi_gpu_training(job_id, gpu_ids, config)

    def _start_single_gpu_training(self, job_id: str, gpu_id: int, config: dict) -> List[str]:
        """Start single GPU training"""
        if self.docker_available:
            container_id = self._start_docker_container(job_id, [gpu_id], config)
            return [container_id] if container_id else []
        else:
            process_id = self._start_subprocess_training(job_id, [gpu_id], config)
            return [f"process_{process_id}"] if process_id else []

    def _start_multi_gpu_training(self, job_id: str, gpu_ids: List[int], config: dict) -> List[str]:
        """Start multi-GPU distributed training"""
        print(f"🔥 Setting up multi-GPU training on {len(gpu_ids)} GPUs")

        if self.docker_available:
            # For now, create separate containers per GPU (can be enhanced to true distributed)
            container_ids = []
            for i, gpu_id in enumerate(gpu_ids):
                container_id = self._start_docker_container(
                    f"{job_id}_gpu_{i}",
                    [gpu_id],
                    config,
                    is_distributed=True,
                    rank=i,
                    world_size=len(gpu_ids)
                )
                if container_id:
                    container_ids.append(container_id)
            return container_ids
        else:
            # Subprocess-based multi-GPU
            process_ids = []
            for i, gpu_id in enumerate(gpu_ids):
                process_id = self._start_subprocess_training(
                    f"{job_id}_gpu_{i}",
                    [gpu_id],
                    config,
                    is_distributed=True,
                    rank=i,
                    world_size=len(gpu_ids)
                )
                if process_id:
                    process_ids.append(f"process_{process_id}")
            return process_ids

    def _start_docker_container(self, job_id: str, gpu_ids: List[int], config: dict,
                              is_distributed: bool = False, rank: int = 0, world_size: int = 1) -> Optional[str]:
        """Start a Docker container for training"""
        try:
            # Get project files path
            project_path = self._get_project_path(job_id)
            if not project_path:
                print(f"❌ Project files not found for job {job_id}")
                return None

            # Prepare environment variables
            env_vars = {
                'CUDA_VISIBLE_DEVICES': ','.join(map(str, gpu_ids)),
                'TRAINFORGE_JOB_ID': job_id,
                'PYTHONUNBUFFERED': '1'
            }

            if is_distributed:
                env_vars.update({
                    'RANK': str(rank),
                    'WORLD_SIZE': str(world_size),
                    'MASTER_ADDR': 'localhost',
                    'MASTER_PORT': '29500'
                })

            # Determine base image
            base_image = config.get('environment', {}).get('base_image', 'pytorch/pytorch:latest')

            # Prepare volume mounts
            volumes = {
                str(project_path): {'bind': '/workspace', 'mode': 'rw'}
            }

            # Prepare command
            training_script = config.get('training', {}).get('script', 'train.py')
            command = f"cd /workspace && python {training_script}"

            print(f"🐳 Starting Docker container with image: {base_image}")

            # Start container
            container = self.docker_client.containers.run(
                image=base_image,
                command=f"sh -c '{command}'",
                environment=env_vars,
                volumes=volumes,
                detach=True,
                remove=False,  # Keep container for log collection
                name=f"trainforge_{job_id}_{int(time.time())}",
                device_requests=[
                    docker.types.DeviceRequest(device_ids=[str(gpu_id) for gpu_id in gpu_ids], capabilities=[['gpu']])
                ] if gpu_ids else None
            )

            container_id = container.id
            self.active_containers[job_id] = container

            print(f"✅ Container {container_id[:12]} started for job {job_id}")
            return container_id

        except docker.errors.ImageNotFound:
            print(f"❌ Docker image not found: {base_image}")
            return None
        except docker.errors.APIError as e:
            print(f"❌ Docker API error: {e}")
            return None
        except Exception as e:
            print(f"❌ Failed to start Docker container: {e}")
            return None

    def _start_subprocess_training(self, job_id: str, gpu_ids: List[int], config: dict,
                                 is_distributed: bool = False, rank: int = 0, world_size: int = 1) -> Optional[int]:
        """Start training using subprocess (fallback when Docker is not available)"""
        try:
            # Get project files path
            project_path = self._get_project_path(job_id)
            if not project_path:
                print(f"❌ Project files not found for job {job_id}")
                return None

            # Prepare environment
            env = os.environ.copy()
            env.update({
                'CUDA_VISIBLE_DEVICES': ','.join(map(str, gpu_ids)),
                'TRAINFORGE_JOB_ID': job_id,
                'PYTHONUNBUFFERED': '1'
            })

            if is_distributed:
                env.update({
                    'RANK': str(rank),
                    'WORLD_SIZE': str(world_size),
                    'MASTER_ADDR': 'localhost',
                    'MASTER_PORT': '29500'
                })

            # Prepare command
            training_script = config.get('training', {}).get('script', 'train.py')
            command = ['python', training_script]

            print(f"🔧 Starting subprocess training: {' '.join(command)}")

            # Start process
            process = subprocess.Popen(
                command,
                cwd=project_path,
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True
            )

            self.training_processes[job_id] = process

            # Start log monitoring thread
            log_thread = threading.Thread(
                target=self._monitor_process_logs,
                args=(job_id, process),
                daemon=True
            )
            log_thread.start()

            print(f"✅ Process {process.pid} started for job {job_id}")
            return process.pid

        except Exception as e:
            print(f"❌ Failed to start subprocess training: {e}")
            return None

    def _monitor_process_logs(self, job_id: str, process: subprocess.Popen):
        """Monitor and log subprocess output"""
        try:
            for line in iter(process.stdout.readline, ''):
                if line:
                    print(f"[{job_id}] {line.strip()}")
        except Exception as e:
            print(f"⚠️ Log monitoring error for {job_id}: {e}")

    def _get_project_path(self, job_id: str) -> Optional[Path]:
        """Get the project files path for a job"""
        # This should integrate with the FileStorage system
        project_base = Path(__file__).parent.parent.parent / "api" / "storage" / "projects"
        project_path = project_base / "projects" / job_id

        if project_path.exists():
            return project_path

        # Fallback: check if files are in a different location
        alt_paths = [
            project_base / job_id,
            Path.cwd() / "storage" / "projects" / job_id,
            Path("/tmp") / "trainforge" / job_id
        ]

        for alt_path in alt_paths:
            if alt_path.exists():
                return alt_path

        print(f"⚠️ Project files not found for {job_id}")
        print(f"   Searched: {project_path}")
        for alt_path in alt_paths:
            print(f"   Searched: {alt_path}")

        return None

    def stop_training(self, job_id: str) -> bool:
        """Stop training for a specific job"""
        try:
            # Stop Docker container if exists
            if job_id in self.active_containers:
                container = self.active_containers[job_id]
                container.stop(timeout=10)
                container.remove()
                del self.active_containers[job_id]
                print(f"🛑 Stopped Docker container for job {job_id}")
                return True

            # Stop subprocess if exists
            if job_id in self.training_processes:
                process = self.training_processes[job_id]
                process.terminate()
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill()
                del self.training_processes[job_id]
                print(f"🛑 Stopped subprocess for job {job_id}")
                return True

            print(f"⚠️ No active training found for job {job_id}")
            return False

        except Exception as e:
            print(f"❌ Failed to stop training for {job_id}: {e}")
            return False

    def get_training_status(self, job_id: str) -> Dict[str, Any]:
        """Get status of training for a specific job"""
        status = {
            'job_id': job_id,
            'status': 'unknown',
            'container_id': None,
            'process_id': None,
            'logs': []
        }

        # Check Docker container
        if job_id in self.active_containers:
            container = self.active_containers[job_id]
            try:
                container.reload()
                status['status'] = container.status
                status['container_id'] = container.id

                # Get recent logs
                logs = container.logs(tail=10).decode('utf-8').split('\n')
                status['logs'] = [line for line in logs if line.strip()]

            except Exception as e:
                print(f"⚠️ Error checking container status: {e}")
                status['status'] = 'error'

        # Check subprocess
        elif job_id in self.training_processes:
            process = self.training_processes[job_id]
            if process.poll() is None:
                status['status'] = 'running'
            else:
                status['status'] = 'exited'
            status['process_id'] = process.pid

        return status

    def cleanup_completed_jobs(self):
        """Clean up resources for completed jobs"""
        # Clean up containers
        to_remove = []
        for job_id, container in self.active_containers.items():
            try:
                container.reload()
                if container.status in ['exited', 'dead']:
                    container.remove()
                    to_remove.append(job_id)
                    print(f"🧹 Cleaned up container for completed job {job_id}")
            except Exception as e:
                print(f"⚠️ Error cleaning up container for {job_id}: {e}")
                to_remove.append(job_id)

        for job_id in to_remove:
            del self.active_containers[job_id]

        # Clean up processes
        to_remove = []
        for job_id, process in self.training_processes.items():
            if process.poll() is not None:
                to_remove.append(job_id)
                print(f"🧹 Cleaned up process for completed job {job_id}")

        for job_id in to_remove:
            del self.training_processes[job_id]

# Global instance
distributed_trainer = DistributedTrainer()