# File: trainforge/worker/src/worker.py
# Main worker process that executes training jobs

import time
import json
import requests
import subprocess
import sys
import os
import zipfile
import tempfile
import shutil
from pathlib import Path
from datetime import datetime
import signal
import threading

class TrainForgeWorker:
    """Main worker class that processes training jobs"""
    
    def __init__(self, api_url="http://localhost:3000"):
        self.api_url = api_url.rstrip('/')
        self.running = True
        self.current_job = None
        self.work_dir = Path("./work")
        self.work_dir.mkdir(exist_ok=True)
        
        # Setup signal handlers for graceful shutdown
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
        
        print("🤖 TrainForge Worker initialized")
        print(f"📡 API URL: {self.api_url}")
        print(f"📁 Work directory: {self.work_dir.absolute()}")
    
    def _signal_handler(self, signum, frame):
        """Handle shutdown signals gracefully"""
        print(f"\n⚠️ Received signal {signum}, shutting down gracefully...")
        self.running = False
        
        if self.current_job:
            print(f"📋 Cancelling current job: {self.current_job}")
            self._update_job_status(self.current_job, "cancelled", 
                                  error_message="Worker shutdown during execution")
    
    def start(self):
        """Start the worker main loop"""
        print("🚀 Starting TrainForge Worker...")
        
        # Check API connectivity
        if not self._check_api_health():
            print("❌ Cannot connect to TrainForge API. Exiting.")
            return
        
        print("✅ Connected to TrainForge API")
        print("👀 Polling for jobs...")
        
        while self.running:
            try:
                # Poll for pending jobs
                job = self._get_next_job()
                
                if job:
                    print(f"\n📥 Found job: {job['job_id']}")
                    self._process_job(job)
                else:
                    # No jobs available, wait before polling again
                    time.sleep(5)
                    
            except KeyboardInterrupt:
                print("\n👋 Worker stopped by user")
                break
            except Exception as e:
                print(f"❌ Worker error: {e}")
                time.sleep(10)  # Wait before retrying
        
        print("👋 Worker shutdown complete")
    
    def _check_api_health(self):
        """Check if API server is running"""
        try:
            response = requests.get(f"{self.api_url}/health", timeout=5)
            return response.status_code == 200
        except requests.exceptions.RequestException:
            return False
    
    def _get_next_job(self):
        """Get the next pending job from the API"""
        try:
            response = requests.get(f"{self.api_url}/api/jobs?limit=1")
            if response.status_code == 200:
                data = response.json()
                jobs = data.get('jobs', [])
                
                # Find first pending job
                for job in jobs:
                    if job['status'] == 'pending':
                        return job
                        
            return None
            
        except requests.exceptions.RequestException as e:
            print(f"⚠️ Failed to fetch jobs: {e}")
            return None
    
    def _process_job(self, job):
        """Process a single training job"""
        job_id = job['job_id']
        self.current_job = job_id
        
        try:
            print(f"🔄 Processing job: {job_id}")
            print(f"📁 Project: {job['project_name']}")
            print(f"🐍 Script: {job['training_script']}")
            
            # Update job status to running
            self._update_job_status(job_id, "running", started_at=datetime.now().isoformat())
            self._add_job_log(job_id, "Job started by worker")
            
            # Create job workspace
            job_dir = self.work_dir / job_id
            job_dir.mkdir(exist_ok=True)
            
            # Download and extract project files
            print("📦 Downloading project files...")
            self._download_project_files(job_id, job_dir)
            
            # Execute training script
            print("🏋️ Starting training...")
            success = self._execute_training(job, job_dir)
            
            if success:
                print("✅ Training completed successfully")
                self._update_job_status(job_id, "completed", 
                                      progress=100, 
                                      completed_at=datetime.now().isoformat())
                self._add_job_log(job_id, "Training completed successfully")
            else:
                print("❌ Training failed")
                self._update_job_status(job_id, "failed", 
                                      completed_at=datetime.now().isoformat())
            
            # Cleanup
            self._cleanup_job_files(job_dir)
            
        except Exception as e:
            print(f"❌ Job processing failed: {e}")
            self._update_job_status(job_id, "failed", 
                                  error_message=str(e),
                                  completed_at=datetime.now().isoformat())
            self._add_job_log(job_id, f"Job failed: {str(e)}")
        
        finally:
            self.current_job = None
    
    def _download_project_files(self, job_id, job_dir):
        """Download and extract project files for the job"""
        # For now, we'll use the local storage path
        # In a real system, this would download from cloud storage
        storage_path = Path("../api/storage/projects") / f"projects/{job_id}/project.zip"
        
        if storage_path.exists():
            print(f"📁 Extracting project files from: {storage_path}")
            with zipfile.ZipFile(storage_path, 'r') as zip_ref:
                zip_ref.extractall(job_dir)
        else:
            raise Exception(f"Project files not found: {storage_path}")
    
    def _execute_training(self, job, job_dir):
        """Execute the training script"""
        script_name = job['training_script']
        script_path = job_dir / script_name
        
        if not script_path.exists():
            raise Exception(f"Training script not found: {script_name}")
        
        # Change to job directory
        original_cwd = os.getcwd()
        os.chdir(job_dir)
        
        try:
            # Execute the training script with UTF-8 encoding
            cmd = [sys.executable, script_name]
            
            self._add_job_log(job['job_id'], f"Executing: {' '.join(cmd)}")
            
            # Set environment variables for proper encoding
            env = os.environ.copy()
            env['PYTHONIOENCODING'] = 'utf-8'
            
            # Start the process
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                universal_newlines=True,
                bufsize=1,
                env=env,
                encoding='utf-8',
                errors='replace'  # Replace problematic characters
            )
            
            # Stream output in real-time
            while True:
                output = process.stdout.readline()
                if output == '' and process.poll() is not None:
                    break
                if output:
                    clean_output = output.strip()
                    print(f"[TRAINING] {clean_output}")
                    self._add_job_log(job['job_id'], clean_output)
            
            # Get the exit code
            return_code = process.poll()
            
            if return_code == 0:
                return True
            else:
                self._add_job_log(job['job_id'], f"Process exited with code: {return_code}")
                return False
                
        finally:
            os.chdir(original_cwd)
    
    def _update_job_status(self, job_id, status, **kwargs):
        """Update job status in the database"""
        try:
            data = {"status": status, **kwargs}
            response = requests.put(f"{self.api_url}/api/jobs/{job_id}", json=data)
            if response.status_code == 200:
                print(f"📝 Job status updated: {status}")
            else:
                print(f"⚠️ Failed to update job status: {response.text}")
        except Exception as e:
            print(f"⚠️ Failed to update job status: {e}")
    
    def _add_job_log(self, job_id, message):
        """Add a log entry to the job"""
        try:
            # Skip empty messages
            if not message or not message.strip():
                return
                
            data = {"message": message.strip()}
            response = requests.post(f"{self.api_url}/api/jobs/{job_id}/logs", json=data)
            if response.status_code != 200:
                print(f"⚠️ Failed to add log: {response.text}")
        except Exception as e:
            print(f"⚠️ Failed to add log: {e}")
    
    def _cleanup_job_files(self, job_dir):
        """Clean up job files after completion"""
        try:
            if job_dir.exists():
                shutil.rmtree(job_dir)
                print(f"🧹 Cleaned up job directory: {job_dir}")
        except Exception as e:
            print(f"⚠️ Failed to cleanup job files: {e}")

def main():
    """Main entry point"""
    print("🤖 TrainForge Worker")
    print("=" * 50)
    
    # Get API URL from environment or use default
    api_url = os.getenv('TRAINFORGE_API_URL', 'http://localhost:3000')
    
    # Create and start worker
    worker = TrainForgeWorker(api_url)
    worker.start()

if __name__ == "__main__":
    main()