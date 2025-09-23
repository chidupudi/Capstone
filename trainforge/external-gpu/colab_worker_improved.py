"""
TrainForge External GPU Worker for Google Colab - Improved Version
This script connects a Colab GPU to your local TrainForge instance with better error handling
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

        # Setup headers for ngrok compatibility
        self.headers = {
            'ngrok-skip-browser-warning': 'true',
            'User-Agent': 'TrainForge-Worker/1.0',
            'Content-Type': 'application/json'
        }

        # Setup work directory
        self.work_dir = Path("/content/trainforge_work")
        self.work_dir.mkdir(exist_ok=True)

        print(f"🚀 TrainForge Colab Worker: {self.worker_id}")
        print(f"📡 API URL: {self.api_url}")
        print(f"📁 Work directory: {self.work_dir}")

    def make_request(self, method, endpoint, max_retries=3, **kwargs):
        """Make HTTP request with proper headers and retry logic"""
        url = f"{self.api_url}{endpoint}"

        # Merge headers
        request_headers = kwargs.get('headers', {})
        request_headers.update(self.headers)
        kwargs['headers'] = request_headers

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
        response = self.make_request('GET', '', max_retries=2)
        if not response:
            print("   ❌ Cannot reach ngrok tunnel")
            return False

        if response.status_code != 200:
            print(f"   ⚠️ ngrok tunnel responding but with status {response.status_code}")
            print(f"   Response: {response.text[:200]}")

        # Test 2: Health endpoint
        print("   Step 2: Testing health endpoint...")
        response = self.make_request('GET', '/health')
        if response and response.status_code == 200:
            try:
                data = response.json()
                print(f"   ✅ API Status: {data.get('status', 'unknown')}")
                print(f"   🔗 Database: {data.get('database', 'unknown')}")
                print("   ✅ API connection successful!")
                return True
            except json.JSONDecodeError:
                print("   ⚠️ Health endpoint returned non-JSON response")
                print(f"   Response: {response.text[:200]}")
        else:
            status = response.status_code if response else "No response"
            print(f"   ❌ Health endpoint failed: HTTP {status}")

        return False

    def test_connection_with_manual_check(self):
        """Test connection and provide manual verification steps"""
        print("🔍 Comprehensive connection test...")

        # Automatic test
        if self.test_connection():
            return True

        print("\n🚨 Automatic connection failed. Let's troubleshoot:")
        print(f"1. 🌐 Open this URL in your browser: {self.api_url}/health")
        print("2. 📋 You should see JSON like: {'status': 'healthy', ...}")
        print("3. ⚠️ If you see an ngrok warning, click 'Visit Site'")

        user_input = input("\n❓ Did the URL work in your browser? (y/n): ").strip().lower()

        if user_input == 'y':
            print("✅ Manual test successful. There might be a headers issue.")
            print("🔄 Trying alternative connection method...")

            # Try with different headers
            alt_headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }

            try:
                response = requests.get(f"{self.api_url}/health", headers=alt_headers, timeout=15)
                if response.status_code == 200:
                    print("✅ Alternative headers worked!")
                    self.headers = alt_headers
                    return True
            except Exception as e:
                print(f"❌ Alternative method also failed: {e}")

        print("\n📋 Troubleshooting checklist:")
        print("1. ✅ Is ngrok still running? Check your terminal")
        print("2. ✅ Visit http://127.0.0.1:4040 to see ngrok status")
        print("3. ✅ Test locally: curl http://localhost:3000/health")
        print("4. ✅ Try restarting ngrok: ngrok http 3000")
        print("5. ✅ Get ngrok authtoken from https://ngrok.com/")

        return False

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
            print("📝 Registering worker with TrainForge...")

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

            response = self.make_request('POST', '/api/workers/register', json=worker_data)
            if response and response.status_code == 200:
                print(f"✅ Worker registered successfully")
                return True
            else:
                status = response.status_code if response else "No response"
                print(f"❌ Failed to register worker: HTTP {status}")
                if response:
                    print(f"Response: {response.text}")
                return False

        except Exception as e:
            print(f"❌ Registration error: {e}")
            return False

    def poll_for_jobs(self):
        """Poll TrainForge API for available jobs"""
        try:
            response = self.make_request('GET', '/api/jobs/pending', max_retries=1)
            if response and response.status_code == 200:
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

    def start(self):
        """Start the worker loop"""
        # Comprehensive connection test
        if not self.test_connection_with_manual_check():
            print("❌ Cannot establish connection to TrainForge API")
            return

        if not self.check_gpu():
            print("❌ GPU check failed")
            return

        if not self.register_worker():
            print("❌ Worker registration failed")
            return

        self.running = True
        print("👀 Polling for jobs...")
        print("⚠️ Keep this cell running to maintain the worker connection")

        try:
            poll_count = 0
            while self.running:
                poll_count += 1
                if poll_count % 12 == 0:  # Every minute (5s * 12 = 60s)
                    print(f"💓 Worker heartbeat - {time.strftime('%H:%M:%S')}")

                jobs = self.poll_for_jobs()

                if jobs:
                    job = jobs[0]  # Take first available job
                    job_id = job['job_id']
                    print(f"🎯 Found job: {job_id}")

                    # For now, just claim and mark as completed (demo mode)
                    response = self.make_request('POST', f'/api/jobs/{job_id}/claim',
                                               json={"worker_id": self.worker_id})

                    if response and response.status_code == 200:
                        print(f"✅ Claimed job {job_id}")
                        self.current_job = job_id

                        # Simulate job execution
                        print("🏃 Simulating job execution...")
                        self.update_job_status(job_id, "running")

                        time.sleep(10)  # Simulate work

                        print(f"✅ Job {job_id} completed (demo mode)")
                        self.update_job_status(job_id, "completed")
                        self.current_job = None

                if self.running:
                    time.sleep(5)  # Wait 5 seconds before polling again

        except KeyboardInterrupt:
            print("\n⚠️ Worker stopped by user")
        finally:
            self.stop()

    def update_job_status(self, job_id, status, message=None):
        """Update job status in TrainForge API"""
        try:
            data = {"status": status}
            if message:
                data["message"] = message

            response = self.make_request('PUT', f'/api/jobs/{job_id}/status', json=data, max_retries=1)
            if response and response.status_code != 200:
                print(f"⚠️ Failed to update job status: {response.text}")
        except Exception as e:
            print(f"⚠️ Failed to update job status: {e}")

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
    print("🚀 TrainForge External GPU Worker")
    print("=" * 50)

    # Configuration
    API_URL = input("Enter your TrainForge API URL (from ngrok): ").strip()

    if not API_URL:
        print("❌ API URL is required")
        return

    print(f"\n📡 Connecting to: {API_URL}")

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