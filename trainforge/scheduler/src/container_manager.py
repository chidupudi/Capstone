# File: trainforge/scheduler/src/container_manager.py
# Docker container management for GPU training jobs

import docker
import os
import tempfile
import zipfile
import json
import time
from typing import Dict, List, Optional, Any
from pathlib import Path
import subprocess

class ContainerManager:
    """Manages Docker containers for training jobs"""
    
    def __init__(self):
        try:
            self.docker_client = docker.from_env()
            print("🐳 Docker client initialized")
        except Exception as e:
            print(f"❌ Failed to initialize Docker client: {e}")
            self.docker_client = None
    
    def start_single_gpu_training(self, job_id: str, gpu_id: int, config: Dict[str, Any]) -> Optional[str]:
        """Start a single GPU training container"""
        try:
            if not self.docker_client:
                print("❌ Docker client not available")
                return None
            
            # Prepare container configuration
            container_config = self._prepare_container_config(job_id, [gpu_id], config)
            
            # Create and start container
            container = self.docker_client.containers.run(
                image=container_config["image"],
                command=container_config["command"],
                environment=container_config["environment"],
                volumes=container_config["volumes"],
                device_requests=container_config["device_requests"],
                name=f"trainforge-{job_id}",
                detach=True,
                remove=False,  # Keep container for log retrieval
                working_dir="/workspace"
            )
            
            print(f"🐳 Started single GPU container {container.id[:12]} for job {job_id}")
            print(f"   GPU: {gpu_id}")
            
            return container.id
            
        except Exception as e:
            print(f"❌ Failed to start single GPU container for job {job_id}: {e}")
            return None
    
    def _prepare_container_config(self, job_id: str, gpu_ids: List[int], config: Dict[str, Any]) -> Dict[str, Any]:
        """Prepare container configuration"""
        
        # Base image selection
        base_image = config.get("environment", {}).get("base_image", "pytorch/pytorch:latest")
        
        # Prepare workspace
        workspace_path = self._prepare_workspace(job_id, config)
        
        # Environment variables
        environment = {
            "CUDA_VISIBLE_DEVICES": ",".join(map(str, gpu_ids)),
            "NVIDIA_VISIBLE_DEVICES": ",".join(map(str, gpu_ids)),
            "TRAINFORGE_JOB_ID": job_id,
            "WORLD_SIZE": str(len(gpu_ids)),
            "NCCL_DEBUG": "INFO",
            "PYTHONUNBUFFERED": "1"
        }
        
        # Add custom environment variables from config
        env_vars = config.get("environment", {}).get("variables", {})
        environment.update(env_vars)
        
        # Volume mounts
        volumes = {
            workspace_path: {"bind": "/workspace", "mode": "rw"},
            "/tmp": {"bind": "/tmp", "mode": "rw"}
        }
        
        # GPU device requests
        device_requests = [
            docker.types.DeviceRequest(
                device_ids=[str(gpu_id) for gpu_id in gpu_ids],
                capabilities=[["gpu"]]
            )
        ]
        
        # Command to run
        training_script = config.get("training", {}).get("script", "train.py")
        command = [
            "python", 
            training_script,
            "--job-id", job_id
        ]
        
        # Add custom arguments from config
        args = config.get("training", {}).get("args", [])
        command.extend(args)
        
        return {
            "image": base_image,
            "command": command,
            "environment": environment,
            "volumes": volumes,
            "device_requests": device_requests
        }
    
    def _prepare_workspace(self, job_id: str, config: Dict[str, Any]) -> str:
        """Prepare workspace directory for the job"""
        try:
            # Create job workspace
            workspace_base = Path("/tmp/trainforge/workspaces")
            workspace_path = workspace_base / job_id
            workspace_path.mkdir(parents=True, exist_ok=True)
            
            # Extract project files (assuming they were stored during job submission)
            project_files_path = Path(f"../api/storage/projects/projects/{job_id}/project.zip")
            
            if project_files_path.exists():
                with zipfile.ZipFile(project_files_path, 'r') as zip_ref:
                    zip_ref.extractall(workspace_path)
                print(f"📦 Extracted project files to {workspace_path}")
            else:
                print(f"⚠️ Project files not found at {project_files_path}")
                # Create a basic workspace with config
                with open(workspace_path / "trainforge_config.json", "w") as f:
                    json.dump(config, f, indent=2)
            
            # Create requirements installation script
            self._create_setup_script(workspace_path, config)
            
            return str(workspace_path)
            
        except Exception as e:
            print(f"❌ Failed to prepare workspace for job {job_id}: {e}")
            # Return a temporary directory as fallback
            return tempfile.mkdtemp(prefix=f"trainforge-{job_id}-")
    
    def _create_setup_script(self, workspace_path: Path, config: Dict[str, Any]):
        """Create setup script for installing dependencies"""
        setup_script = workspace_path / "setup.sh"
        
        requirements_file = config.get("training", {}).get("requirements", "requirements.txt")
        
        script_content = f"""#!/bin/bash
set -e

echo "🔧 Setting up training environment..."

# Install requirements if file exists
if [ -f "{requirements_file}" ]; then
    echo "📦 Installing requirements from {requirements_file}"
    pip install -r {requirements_file}
else
    echo "⚠️ No requirements file found, skipping dependency installation"
fi

# Install common ML packages if not present
python -c "import torch" 2>/dev/null || pip install torch torchvision torchaudio
python -c "import numpy" 2>/dev/null || pip install numpy
python -c "import pandas" 2>/dev/null || pip install pandas

echo "✅ Environment setup complete"
"""
        
        with open(setup_script, "w") as f:
            f.write(script_content)
        
        # Make script executable
        setup_script.chmod(0o755)
    
    def are_containers_completed(self, container_ids: List[str]) -> bool:
        """Check if all containers are completed"""
        try:
            if not self.docker_client or not container_ids:
                return True
            
            for container_id in container_ids:
                try:
                    container = self.docker_client.containers.get(container_id)
                    if container.status in ["running", "restarting"]:
                        return False
                except docker.errors.NotFound:
                    # Container not found, consider it completed
                    continue
                except Exception as e:
                    print(f"⚠️ Error checking container {container_id}: {e}")
            
            return True
            
        except Exception as e:
            print(f"❌ Error checking container completion: {e}")
            return True  # Assume completed on error
    
    def get_container_exit_codes(self, container_ids: List[str]) -> List[Optional[int]]:
        """Get exit codes from containers"""
        exit_codes = []
        
        try:
            if not self.docker_client:
                return [None] * len(container_ids)
            
            for container_id in container_ids:
                try:
                    container = self.docker_client.containers.get(container_id)
                    
                    # Wait for container to finish if it's still running
                    if container.status == "running":
                        container.wait(timeout=5)
                    
                    # Get exit code
                    container.reload()
                    exit_code = container.attrs.get("State", {}).get("ExitCode")
                    exit_codes.append(exit_code)
                    
                except docker.errors.NotFound:
                    exit_codes.append(None)
                except Exception as e:
                    print(f"⚠️ Error getting exit code for container {container_id}: {e}")
                    exit_codes.append(None)
            
            return exit_codes
            
        except Exception as e:
            print(f"❌ Error getting container exit codes: {e}")
            return [None] * len(container_ids)
    
    def get_container_logs(self, container_id: str, tail: int = 100) -> str:
        """Get logs from a container"""
        try:
            if not self.docker_client:
                return "Docker client not available"
            
            container = self.docker_client.containers.get(container_id)
            logs = container.logs(tail=tail, timestamps=True).decode('utf-8')
            return logs
            
        except docker.errors.NotFound:
            return f"Container {container_id} not found"
        except Exception as e:
            return f"Error getting logs: {e}"
    
    def stop_containers(self, container_ids: List[str]):
        """Stop running containers"""
        try:
            if not self.docker_client:
                return
            
            for container_id in container_ids:
                try:
                    container = self.docker_client.containers.get(container_id)
                    if container.status == "running":
                        container.stop(timeout=30)
                        print(f"🛑 Stopped container {container_id[:12]}")
                except docker.errors.NotFound:
                    continue
                except Exception as e:
                    print(f"⚠️ Error stopping container {container_id}: {e}")
                    
        except Exception as e:
            print(f"❌ Error stopping containers: {e}")
    
    def cleanup_containers(self, container_ids: List[str]):
        """Clean up containers and their resources"""
        try:
            if not self.docker_client:
                return
            
            for container_id in container_ids:
                try:
                    container = self.docker_client.containers.get(container_id)
                    
                    # Stop if running
                    if container.status == "running":
                        container.stop(timeout=30)
                    
                    # Remove container
                    container.remove(force=True)
                    print(f"🧹 Cleaned up container {container_id[:12]}")
                    
                except docker.errors.NotFound:
                    continue
                except Exception as e:
                    print(f"⚠️ Error cleaning up container {container_id}: {e}")
                    
        except Exception as e:
            print(f"❌ Error cleaning up containers: {e}")
    
    def get_container_resource_usage(self, container_id: str) -> Dict[str, Any]:
        """Get resource usage statistics for a container"""
        try:
            if not self.docker_client:
                return {}
            
            container = self.docker_client.containers.get(container_id)
            stats = container.stats(stream=False)
            
            # Parse CPU usage
            cpu_stats = stats["cpu_stats"]
            precpu_stats = stats["precpu_stats"]
            
            cpu_delta = cpu_stats["cpu_usage"]["total_usage"] - precpu_stats["cpu_usage"]["total_usage"]
            system_delta = cpu_stats["system_cpu_usage"] - precpu_stats["system_cpu_usage"]
            
            cpu_percent = 0
            if system_delta > 0 and cpu_delta > 0:
                cpu_percent = (cpu_delta / system_delta) * len(cpu_stats["cpu_usage"]["percpu_usage"]) * 100
            
            # Parse memory usage
            memory_stats = stats["memory_stats"]
            memory_usage = memory_stats.get("usage", 0)
            memory_limit = memory_stats.get("limit", 0)
            memory_percent = (memory_usage / memory_limit * 100) if memory_limit > 0 else 0
            
            return {
                "cpu_percent": cpu_percent,
                "memory_usage_mb": memory_usage / (1024 * 1024),
                "memory_limit_mb": memory_limit / (1024 * 1024),
                "memory_percent": memory_percent,
                "timestamp": time.time()
            }
            
        except Exception as e:
            print(f"⚠️ Error getting container stats for {container_id}: {e}")
            return {}
    
    def list_trainforge_containers(self) -> List[Dict[str, Any]]:
        """List all TrainForge containers"""
        try:
            if not self.docker_client:
                return []
            
            containers = self.docker_client.containers.list(
                all=True,
                filters={"name": "trainforge-"}
            )
            
            container_info = []
            for container in containers:
                info = {
                    "id": container.id,
                    "name": container.name,
                    "status": container.status,
                    "created": container.attrs["Created"],
                    "image": container.image.tags[0] if container.image.tags else "unknown"
                }
                
                # Extract job ID from container name
                if container.name.startswith("trainforge-"):
                    info["job_id"] = container.name.replace("trainforge-", "")
                
                container_info.append(info)
            
            return container_info
            
        except Exception as e:
            print(f"❌ Error listing containers: {e}")
            return []