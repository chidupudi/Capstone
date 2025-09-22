#!/usr/bin/env python3
# File: trainforge/workers/start_worker.py
# Simple script to start a worker node

import subprocess
import sys
import os
from pathlib import Path

def main():
    """Start worker node with simple interface"""

    print("🏃 TrainForge Worker Node Starter")
    print("=" * 50)

    # Get script directory
    script_dir = Path(__file__).parent
    worker_script = script_dir / "worker_node.py"

    if not worker_script.exists():
        print(f"❌ Worker script not found: {worker_script}")
        return

    # Default settings
    scheduler_url = "http://localhost:3000"
    max_jobs = 4

    print(f"📡 Scheduler URL: {scheduler_url}")
    print(f"⚡ Max concurrent jobs: {max_jobs}")
    print()

    # Interactive configuration
    response = input("Use default settings? (y/n) [y]: ").strip().lower()

    if response == 'n':
        scheduler_url = input(f"Scheduler URL [{scheduler_url}]: ").strip() or scheduler_url
        max_jobs_input = input(f"Max jobs [{max_jobs}]: ").strip()
        if max_jobs_input:
            try:
                max_jobs = int(max_jobs_input)
            except ValueError:
                print("⚠️ Invalid number, using default")

    # Build command
    cmd = [
        sys.executable,
        str(worker_script),
        "--scheduler", scheduler_url,
        "--max-jobs", str(max_jobs)
    ]

    print(f"🚀 Starting worker node...")
    print(f"Command: {' '.join(cmd)}")
    print()

    try:
        # Start worker
        subprocess.run(cmd)
    except KeyboardInterrupt:
        print("\n🛑 Worker node stopped by user")
    except Exception as e:
        print(f"❌ Error starting worker: {e}")

if __name__ == "__main__":
    main()