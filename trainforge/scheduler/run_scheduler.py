#!/usr/bin/env python3
"""
Simple scheduler runner that avoids Unicode issues in Windows console
"""
import os
import sys
import subprocess
from pathlib import Path

def main():
    # Set up environment to handle Unicode properly
    if os.name == 'nt':  # Windows
        # Set console encoding to UTF-8
        os.environ['PYTHONIOENCODING'] = 'utf-8'
        # Try to set console to UTF-8 mode
        try:
            subprocess.run(['chcp', '65001'], shell=True, capture_output=True)
        except:
            pass

    # Add src directory to path
    src_dir = Path(__file__).parent / 'src'
    sys.path.insert(0, str(src_dir))

    # Import and run the job scheduler
    try:
        from job_scheduler import job_scheduler
        print("TrainForge Job Scheduler starting...")
        job_scheduler.start()
    except KeyboardInterrupt:
        print("\nScheduler stopped by user")
    except Exception as e:
        print(f"Scheduler error: {e}")
        return 1

    return 0

if __name__ == "__main__":
    sys.exit(main())