"""
TrainForge External GPU Worker for Google Colab
This script connects a Colab GPU to your local TrainForge instance
"""

import os
import sys
import time
import requests
import json
import subprocess
import tempfile
import zipfile
from pathlib import Path
import threading
import signal

class ColabGPUWorker:
    def __init__(self, api_url, worker_id=None):
        self.api_url = api_url.rstrip('/')
        self.worker_id = worker_id or f"colab-{int(time.time())}"
        self.running = False
        self.current_job = None

        # Setup work directory
        self.work_dir = Path("/content/trainforge_work")
        self.work_dir.mkdir(exist_ok=True)

        print(f"🚀 TrainForge Colab Worker: {self.worker_id}")
        print(f"📡 API URL: {self.api_url}")
        print(f"📁 Work directory: {self.work_dir}")

    def check_gpu(self):
        """Check if GPU is available"""
        try:
            import torch
            if torch.cuda.is_available():
                gpu_name = torch.cuda.get_device_name(0)
                gpu_memory = torch.cuda.get_device_properties(0).total_memory // 1024**3
                print(f"✅ GPU Available: {gpu_name} ({gpu_memory}GB)")
                return True
            else:
                print("❌ No GPU available")
                return False
        except ImportError:
            print("❌ PyTorch not available")
            return False

    def register_worker(self):
        """Register this worker with TrainForge API"""
        try:
            # Get system info
            import torch
            gpu_info = {
                "name": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "No GPU",
                "memory_gb": torch.cuda.get_device_properties(0).total_memory // 1024**3 if torch.cuda.is_available() else 0,
                "compute_capability": torch.cuda.get_device_capability(0) if torch.cuda.is_available() else None
            }

            worker_data = {
                "worker_id": self.worker_id,
                "status": "available",
                "worker_type": "external_colab",
                "capabilities": {
                    "gpu_count": 1 if torch.cuda.is_available() else 0,
                    "gpu_info": gpu_info,
                    "max_memory_gb": gpu_info["memory_gb"]
                },
                "location": "google_colab"
            }

            response = requests.post(f"{self.api_url}/api/workers/register", json=worker_data)
            if response.status_code == 200:
                print(f"✅ Worker registered successfully")
                return True
            else:
                print(f"❌ Failed to register worker: {response.text}")
                return False

        except Exception as e:
            print(f"❌ Registration error: {e}")
            return False

    def poll_for_jobs(self):
        """Poll TrainForge API for available jobs"""
        try:
            response = requests.get(f"{self.api_url}/api/jobs/pending")
            if response.status_code == 200:
                jobs = response.json()
                return [job for job in jobs if self.can_handle_job(job)]
            return []
        except Exception as e:
            print(f"⚠️ Failed to fetch jobs: {e}")
            return []

    def can_handle_job(self, job):
        """Check if this worker can handle the job"""
        try:
            resources = job.get('resources', {})
            gpu_required = resources.get('gpu', 0)
            memory_required = resources.get('memory_gb', 0)

            # Check if we have GPU and enough memory
            import torch
            if gpu_required > 0 and not torch.cuda.is_available():
                return False

            if torch.cuda.is_available():
                available_memory = torch.cuda.get_device_properties(0).total_memory // 1024**3
                if memory_required > available_memory:
                    return False

            return gpu_required <= 1  # Colab typically has 1 GPU

        except Exception as e:
            print(f"❌ Error checking job capacity: {e}")
            return False

    def download_job_files(self, job_id):
        """Download job files from TrainForge API"""
        try:
            response = requests.get(f"{self.api_url}/api/jobs/{job_id}/files")
            if response.status_code == 200:
                # Save zip file
                zip_path = self.work_dir / f"{job_id}.zip"
                with open(zip_path, 'wb') as f:
                    f.write(response.content)

                # Extract files
                job_dir = self.work_dir / job_id
                job_dir.mkdir(exist_ok=True)

                with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                    zip_ref.extractall(job_dir)

                zip_path.unlink()  # Remove zip file
                print(f"✅ Downloaded job files to {job_dir}")
                return job_dir
            else:
                print(f"❌ Failed to download job files: {response.text}")
                return None

        except Exception as e:
            print(f"❌ Error downloading job files: {e}")
            return None

    def run_training_job(self, job):
        """Execute the training job"""
        job_id = job['job_id']
        print(f"🚀 Starting job {job_id}")

        try:
            # Update job status
            self.update_job_status(job_id, "running")

            # Download job files
            job_dir = self.download_job_files(job_id)
            if not job_dir:
                self.update_job_status(job_id, "failed", "Failed to download job files")
                return

            # Install requirements if they exist
            requirements_file = job_dir / "requirements.txt"
            if requirements_file.exists():
                print("📦 Installing requirements...")
                subprocess.run([sys.executable, "-m", "pip", "install", "-r", str(requirements_file)],
                             cwd=job_dir, check=True)

            # Run training script
            training_script = job_dir / job.get('script', 'train.py')
            if not training_script.exists():
                self.update_job_status(job_id, "failed", f"Training script not found: {training_script}")
                return

            print(f"🏃 Executing: python {training_script}")

            # Set environment variables
            env = os.environ.copy()
            env['TRAINFORGE_JOB_ID'] = job_id
            env['CUDA_VISIBLE_DEVICES'] = '0'  # Use first GPU

            # Run the training script
            process = subprocess.Popen(
                [sys.executable, str(training_script)],
                cwd=job_dir,
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                universal_newlines=True
            )

            # Stream output in real-time
            for line in process.stdout:
                print(line.rstrip())
                self.send_job_log(job_id, line.rstrip())

            # Wait for completion
            exit_code = process.wait()

            if exit_code == 0:
                print(f"✅ Job {job_id} completed successfully")
                self.update_job_status(job_id, "completed")
            else:
                print(f"❌ Job {job_id} failed with exit code {exit_code}")
                self.update_job_status(job_id, "failed", f"Exit code: {exit_code}")

        except Exception as e:
            print(f"❌ Error running job {job_id}: {e}")
            self.update_job_status(job_id, "failed", str(e))

    def update_job_status(self, job_id, status, message=None):
        """Update job status in TrainForge API"""
        try:
            data = {"status": status}
            if message:
                data["message"] = message

            response = requests.put(f"{self.api_url}/api/jobs/{job_id}/status", json=data)
            if response.status_code != 200:
                print(f"⚠️ Failed to update job status: {response.text}")
        except Exception as e:
            print(f"⚠️ Failed to update job status: {e}")

    def send_job_log(self, job_id, message):
        """Send log message to TrainForge API"""
        try:
            data = {
                "job_id": job_id,
                "message": message,
                "timestamp": time.time()
            }
            requests.post(f"{self.api_url}/api/jobs/{job_id}/logs", json=data)
        except:
            pass  # Ignore log upload failures

    def start(self):
        """Start the worker loop"""
        if not self.check_gpu():
            print("❌ GPU check failed")
            return

        if not self.register_worker():
            print("❌ Worker registration failed")
            return

        self.running = True
        print("👀 Polling for jobs...")

        try:
            while self.running:
                jobs = self.poll_for_jobs()

                for job in jobs:
                    if not self.running:
                        break

                    job_id = job['job_id']
                    print(f"🎯 Found job: {job_id}")

                    # Claim the job
                    response = requests.post(f"{self.api_url}/api/jobs/{job_id}/claim",
                                           json={"worker_id": self.worker_id})

                    if response.status_code == 200:
                        self.current_job = job_id
                        self.run_training_job(job)
                        self.current_job = None

                    break  # Process one job at a time

                if self.running:
                    time.sleep(5)  # Wait 5 seconds before polling again

        except KeyboardInterrupt:
            print("\n⚠️ Worker stopped by user")
        finally:
            self.stop()

    def stop(self):
        """Stop the worker"""
        self.running = False

        # Cancel current job if any
        if self.current_job:
            try:
                self.update_job_status(self.current_job, "cancelled", "Worker stopped")
            except:
                pass

        print("✅ Worker stopped")

def main():
    # Configuration
    API_URL = input("Enter your TrainForge API URL (e.g., https://your-ngrok-url.com): ").strip()

    if not API_URL:
        print("❌ API URL is required")
        return

    # Create and start worker
    worker = ColabGPUWorker(API_URL)

    # Handle shutdown gracefully
    def signal_handler(signum, frame):
        print(f"\n⚠️ Received signal {signum}, shutting down...")
        worker.stop()

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    # Start worker
    worker.start()

if __name__ == "__main__":
    main()