"""
TrainForge External GPU Worker — Kaggle Notebooks

USAGE (copy-paste into Kaggle):
  1. Run: !pip install requests
  2. Set environment variable (or just edit API_URL below):
       import os; os.environ['TRAINFORGE_API_URL'] = 'https://YOUR-TUNNEL.trycloudflare.com'
  3. Run this script.

Or use the Dashboard → ⚡ Connect GPU wizard which generates
a pre-filled code cell for you automatically.
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
import shutil

class KaggleGPUWorker:
    def __init__(self, api_url, worker_id=None):
        self.api_url = api_url.rstrip('/')
        self.worker_id = worker_id or f"kaggle-{int(time.time())}"
        self.running = False
        self.current_job = None

        # Setup headers for ngrok compatibility
        self.headers = {
            'ngrok-skip-browser-warning': 'true',
            'User-Agent': 'TrainForge-Worker/1.0'
        }

        # Setup work directory (Kaggle uses /kaggle/working as the main directory)
        self.work_dir = Path("/kaggle/working/trainforge_work")
        self.work_dir.mkdir(exist_ok=True)

        print(f"🚀 TrainForge Kaggle Worker: {self.worker_id}")
        print(f"📡 API URL: {self.api_url}")
        print(f"📁 Work directory: {self.work_dir}")

    def make_request(self, method, endpoint, max_retries=3, **kwargs):
        """Make HTTP request with proper headers and retry logic"""
        url = f"{self.api_url}{endpoint}"

        # Merge headers (unless files are being uploaded)
        if 'files' not in kwargs:
            request_headers = kwargs.get('headers', {})
            request_headers.update(self.headers)
            kwargs['headers'] = request_headers
        else:
            # For file uploads, only use provided headers
            if 'headers' not in kwargs:
                kwargs['headers'] = {}
            # Add ngrok skip header
            kwargs['headers']['ngrok-skip-browser-warning'] = 'true'

        # Add timeout
        kwargs.setdefault('timeout', 30)

        for attempt in range(max_retries):
            try:
                if method.upper() == 'GET':
                    response = requests.get(url, **kwargs)
                elif method.upper() == 'POST':
                    response = requests.post(url, **kwargs)
                elif method.upper() == 'PUT':
                    response = requests.put(url, **kwargs)
                else:
                    raise ValueError(f"Unsupported HTTP method: {method}")

                return response

            except requests.exceptions.Timeout:
                print(f"⏰ Timeout on attempt {attempt + 1}/{max_retries} for {endpoint}")
            except requests.exceptions.ConnectionError:
                print(f"🔌 Connection error on attempt {attempt + 1}/{max_retries} for {endpoint}")
            except requests.exceptions.RequestException as e:
                print(f"⚠️ Request error on attempt {attempt + 1}/{max_retries}: {e}")
            except Exception as e:
                print(f"❌ Unexpected error on attempt {attempt + 1}/{max_retries}: {e}")

            if attempt < max_retries - 1:
                wait_time = (attempt + 1) * 2  # Exponential backoff
                print(f"   ⏳ Waiting {wait_time} seconds before retry...")
                time.sleep(wait_time)

        print(f"❌ All {max_retries} attempts failed for {endpoint}")
        return None

    def test_connection(self):
        """Test connection to TrainForge API with comprehensive checks"""
        print("🔍 Testing API connection...")

        # Test 1: Basic connectivity
        print("   Step 1: Testing basic connectivity...")
        response = self.make_request('GET', '/health', max_retries=2)
        if not response:
            print("   ❌ Cannot reach API")
            return False

        if response.status_code != 200:
            print(f"   ❌ API returned status code: {response.status_code}")
            return False

        print("   ✅ Basic connectivity OK")

        # Test 2: Check API endpoints
        print("   Step 2: Testing job endpoints...")
        response = self.make_request('GET', '/api/jobs/pending', max_retries=2)
        if not response:
            print("   ❌ Cannot access job endpoints")
            return False

        if response.status_code != 200:
            print(f"   ❌ Jobs endpoint returned: {response.status_code}")
            return False

        print("   ✅ Job endpoints OK")

        print("✅ Connection successful!")
        return True

    def detect_gpu(self):
        """Detect available GPU on Kaggle"""
        print("\n💻 Detecting GPU...")
        try:
            import torch
            if torch.cuda.is_available():
                gpu_name = torch.cuda.get_device_name(0)
                gpu_memory = torch.cuda.get_device_properties(0).total_memory / (1024**3)
                print(f"✅ GPU Available: {gpu_name}")
                print(f"   GPU Memory: {gpu_memory:.2f} GB")
                print(f"   CUDA Version: {torch.version.cuda}")
                return {
                    'available': True,
                    'name': gpu_name,
                    'memory_gb': gpu_memory,
                    'cuda_version': torch.version.cuda
                }
            else:
                print("⚠️ No GPU detected - running on CPU")
                return {'available': False}
        except ImportError:
            print("⚠️ PyTorch not installed - cannot detect GPU")
            return {'available': False}

    def register_worker(self):
        """Register this worker with the TrainForge API"""
        print("\n📝 Registering worker...")

        gpu_info = self.detect_gpu()

        worker_data = {
            'worker_id': self.worker_id,
            'platform': 'kaggle',
            'gpu_available': gpu_info.get('available', False),
            'gpu_name': gpu_info.get('name', 'None'),
            'gpu_memory_gb': gpu_info.get('memory_gb', 0),
            'status': 'idle',
            'last_heartbeat': time.time()
        }

        response = self.make_request('POST', '/api/workers/register',
                                     json=worker_data, max_retries=3)

        if response and response.status_code in [200, 201]:
            print(f"✅ Worker registered: {self.worker_id}")
            return True
        else:
            print(f"⚠️ Worker registration failed (continuing anyway)")
            return False

    def send_heartbeat(self):
        """Send periodic heartbeat to API"""
        while self.running:
            try:
                response = self.make_request('POST', f'/api/workers/{self.worker_id}/heartbeat',
                                            json={'timestamp': time.time()},
                                            max_retries=1)

                if response and response.status_code == 200:
                    current_time = time.strftime('%H:%M:%S')
                    status = "processing job" if self.current_job else "idle"
                    print(f"💓 Worker heartbeat - {current_time} - {status}")

            except Exception as e:
                print(f"⚠️ Heartbeat failed: {e}")

            time.sleep(30)  # Heartbeat every 30 seconds

    def poll_for_jobs(self):
        """Poll API for pending jobs"""
        print("\n🔍 Polling for jobs...")

        response = self.make_request('GET', '/api/jobs/pending', max_retries=2)

        if not response or response.status_code != 200:
            return None

        try:
            jobs = response.json()
            if isinstance(jobs, list) and len(jobs) > 0:
                return jobs[0]  # Return first pending job
            return None
        except json.JSONDecodeError:
            print("⚠️ Invalid JSON response from API")
            return None

    def claim_job(self, job_id):
        """Claim a job for processing"""
        print(f"\n🎯 Claiming job: {job_id}")

        response = self.make_request('POST', f'/api/jobs/{job_id}/claim',
                                    json={'worker_id': self.worker_id},
                                    max_retries=3)

        if response and response.status_code == 200:
            print(f"✅ Job claimed successfully")
            return True
        else:
            print(f"❌ Failed to claim job")
            return False

    def download_project(self, job_id):
        """Download project files from API"""
        print(f"\n📥 Downloading project files for job {job_id}...")

        # Create job directory
        job_dir = self.work_dir / job_id
        job_dir.mkdir(exist_ok=True)

        # Download project zip
        response = self.make_request('GET', f'/api/jobs/{job_id}/files',
                                    stream=True, max_retries=3, timeout=120)

        if not response or response.status_code != 200:
            print(f"❌ Failed to download project files")
            return None

        # Save zip file
        zip_path = job_dir / 'project.zip'
        with open(zip_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)

        print(f"✅ Downloaded project.zip ({zip_path.stat().st_size / 1024:.1f} KB)")

        # Extract zip
        print(f"📦 Extracting project files...")
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(job_dir)

        # Remove zip after extraction
        zip_path.unlink()

        print(f"✅ Project files extracted to {job_dir}")
        return job_dir

    def install_dependencies(self, job_dir):
        """Install Python dependencies from requirements.txt"""
        requirements_file = job_dir / 'requirements.txt'

        if not requirements_file.exists():
            print("ℹ️ No requirements.txt found - skipping dependency installation")
            return True

        print("\n📦 Installing dependencies...")
        try:
            subprocess.run(
                [sys.executable, '-m', 'pip', 'install', '-q', '-r', str(requirements_file)],
                check=True,
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout
            )
            print("✅ Dependencies installed successfully")
            return True
        except subprocess.TimeoutExpired:
            print("❌ Dependency installation timed out")
            return False
        except subprocess.CalledProcessError as e:
            print(f"❌ Failed to install dependencies: {e.stderr}")
            return False

    def run_training(self, job_id, job_dir):
        """Execute the training script"""
        print("\n" + "="*70)
        print("🚀 Starting Training Job")
        print("="*70)

        # Find training script
        script_candidates = ['train.py', 'main.py', 'run.py']
        training_script = None

        for candidate in script_candidates:
            script_path = job_dir / candidate
            if script_path.exists():
                training_script = script_path
                break

        if not training_script:
            print("❌ No training script found (train.py, main.py, or run.py)")
            return False

        print(f"📜 Running: {training_script.name}")
        print("="*70)

        try:
            # Run training script
            process = subprocess.Popen(
                [sys.executable, str(training_script)],
                cwd=str(job_dir),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1
            )

            # Stream output in real-time
            for line in process.stdout:
                print(line, end='')
                sys.stdout.flush()

                # Optionally send logs to API (with error handling)
                try:
                    self.make_request('POST', f'/api/jobs/{job_id}/logs',
                                    json={'message': line.strip(), 'timestamp': time.time()},
                                    max_retries=1, timeout=5)
                except:
                    pass  # Don't let logging errors stop training

            # Wait for completion
            return_code = process.wait()

            print("="*70)
            if return_code == 0:
                print("✅ Training completed successfully!")
                return True
            else:
                print(f"❌ Training failed with exit code: {return_code}")
                return False

        except Exception as e:
            print(f"❌ Training execution failed: {e}")
            return False

    def upload_results(self, job_id, job_dir):
        """Upload training results back to API"""
        try:
            print(f"\n📤 Uploading results...")

            # Look for output files (models, logs, etc.)
            output_patterns = [
                '*.pth', '*.pt', '*.h5', '*.pkl', '*.json',
                'best_*.pth', 'final_*.pth', 'training_*.json'
            ]

            output_files = []
            for pattern in output_patterns:
                files = list(job_dir.glob(pattern))
                output_files.extend(files)

            # Remove duplicates
            output_files = list(set(output_files))

            if not output_files:
                print(f"⚠️ No output files found to upload")
                return

            print(f"✅ Found {len(output_files)} output files:")
            for f in output_files:
                print(f"   - {f.name} ({f.stat().st_size / 1024:.1f} KB)")

            # Create results zip
            results_zip = job_dir / 'results.zip'
            with zipfile.ZipFile(results_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
                for file_path in output_files:
                    zipf.write(file_path, file_path.name)

            print(f"📦 Created results.zip ({results_zip.stat().st_size / (1024*1024):.2f} MB)")

            # Upload to API
            print(f"📤 Uploading results to API...")
            with open(results_zip, 'rb') as f:
                files = {'results_zip': ('results.zip', f, 'application/zip')}

                # Use headers without Content-Type for multipart upload
                headers = {k: v for k, v in self.headers.items() if k != 'Content-Type'}

                response = self.make_request(
                    'POST',
                    f'/api/jobs/{job_id}/results',
                    files=files,
                    headers=headers,
                    max_retries=3,
                    timeout=120
                )

            if response and response.status_code == 200:
                print(f"✅ Results uploaded successfully!")
                print(f"   Upload size: {results_zip.stat().st_size / (1024*1024):.2f} MB")
            else:
                status = response.status_code if response else 'unknown'
                print(f"⚠️ Failed to upload results (status: {status})")

        except Exception as e:
            print(f"⚠️ Failed to upload results: {e}")

    def update_job_status(self, job_id, status, message=None):
        """Update job status on API"""
        data = {'status': status}
        if message:
            data['message'] = message

        response = self.make_request('PUT', f'/api/jobs/{job_id}/status',
                                    json=data, max_retries=3)

        if response and response.status_code == 200:
            print(f"📊 Job status updated to: {status}")
        else:
            print(f"⚠️ Failed to update job status")

    def cleanup_job(self, job_dir):
        """Clean up job directory after completion"""
        try:
            if job_dir.exists():
                shutil.rmtree(job_dir)
                print(f"🧹 Cleaned up job directory")
        except Exception as e:
            print(f"⚠️ Failed to cleanup: {e}")

    def process_job(self, job):
        """Process a single job end-to-end"""
        job_id = job.get('job_id')
        if not job_id:
            print("❌ Invalid job - no job_id")
            return

        self.current_job = job_id

        try:
            print(f"\n{'='*70}")
            print(f"🎯 Processing Job: {job_id}")
            print(f"{'='*70}")

            # Claim the job
            if not self.claim_job(job_id):
                return

            # Download project files
            job_dir = self.download_project(job_id)
            if not job_dir:
                self.update_job_status(job_id, 'failed', 'Failed to download project files')
                return

            # Install dependencies
            if not self.install_dependencies(job_dir):
                self.update_job_status(job_id, 'failed', 'Failed to install dependencies')
                self.cleanup_job(job_dir)
                return

            # Run training
            success = self.run_training(job_id, job_dir)

            if success:
                # Upload results
                self.upload_results(job_id, job_dir)

                # Mark as completed
                self.update_job_status(job_id, 'completed', 'Training completed successfully')
            else:
                # Mark as failed
                self.update_job_status(job_id, 'failed', 'Training execution failed')

            # Cleanup
            self.cleanup_job(job_dir)

            print(f"{'='*70}")
            print(f"✅ Job {job_id} processing complete")
            print(f"{'='*70}\n")

        except Exception as e:
            print(f"❌ Job processing failed: {e}")
            self.update_job_status(job_id, 'failed', f'Unexpected error: {str(e)}')

        finally:
            self.current_job = None

    def start(self):
        """Start the worker - main loop"""
        print("\n" + "="*70)
        print("🚀 TrainForge Kaggle Worker Starting")
        print("="*70)

        # Test connection first
        if not self.test_connection():
            print("❌ Cannot connect to API - please check your ngrok URL")
            return

        # Register worker
        self.register_worker()

        # Start heartbeat thread
        self.running = True
        heartbeat_thread = threading.Thread(target=self.send_heartbeat, daemon=True)
        heartbeat_thread.start()

        print("\n✅ Worker is now polling for jobs...")
        print("   Press Ctrl+C to stop\n")

        # Main polling loop
        try:
            while self.running:
                # Check for pending jobs
                job = self.poll_for_jobs()

                if job:
                    # Process the job
                    self.process_job(job)
                else:
                    # No jobs - wait before next poll
                    time.sleep(10)

        except KeyboardInterrupt:
            print("\n\n🛑 Worker stopped by user")
            self.running = False
        except Exception as e:
            print(f"\n❌ Worker error: {e}")
            self.running = False


def main():
    """Main entry point for Kaggle worker"""
    print("=" * 70)
    print("🚀 TrainForge Kaggle GPU Worker")
    print("=" * 70)

    # ── 1. Read URL from environment variable (set by dashboard wizard)
    api_url = os.environ.get('TRAINFORGE_API_URL', '').strip()

    # ── 2. Fall back to prompt if not set
    if not api_url:
        print()
        print("💡 Tip: Set TRAINFORGE_API_URL env var to skip this prompt.")
        print("   The dashboard's ⚡ Connect GPU wizard does this automatically.")
        print()
        api_url = input("📡 Enter your Cloudflare / ngrok tunnel URL: ").strip()

    if not api_url:
        print("❌ API URL is required.")
        return

    if not api_url.startswith('http'):
        api_url = 'https://' + api_url

    print(f"\n✅ Connecting to: {api_url}\n")

    worker = KaggleGPUWorker(api_url)
    worker.start()


if __name__ == '__main__':
    main()
