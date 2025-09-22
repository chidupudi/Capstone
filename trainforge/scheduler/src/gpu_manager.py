# File: trainforge/scheduler/src/gpu_manager.py
# GPU resource discovery, allocation, and management

import subprocess
import threading
import time
import json
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, asdict
from enum import Enum
from datetime import datetime, timedelta

class GPUStatus(Enum):
    AVAILABLE = "available"
    ALLOCATED = "allocated"
    BUSY = "busy"
    ERROR = "error"

@dataclass
class GPUInfo:
    """Information about a GPU device"""
    gpu_id: int
    name: str
    memory_total_mb: int
    memory_used_mb: int
    memory_free_mb: int
    utilization_percent: float
    temperature_celsius: int
    power_usage_watts: int
    status: GPUStatus = GPUStatus.AVAILABLE
    allocated_to: Optional[str] = None
    allocated_memory_mb: int = 0

@dataclass
class GPUAllocation:
    """GPU allocation record for a job"""
    job_id: str
    gpu_ids: List[int]
    allocated_memory_mb: int
    allocated_at: float
    worker_node: str

class GPUResourceManager:
    """Manages GPU resources across the cluster"""

    def __init__(self):
        self.gpus: Dict[int, GPUInfo] = {}
        self.allocations: Dict[str, GPUAllocation] = {}
        self.lock = threading.Lock()
        self.monitoring = True
        self.monitor_thread = None

        # Initialize GPU discovery
        self._discover_gpus()

        # Start monitoring thread
        self.start_monitoring()

    def _discover_gpus(self):
        """Discover available GPUs using nvidia-ml-py or nvidia-smi"""
        try:
            # Try nvidia-ml-py first (more reliable)
            self._discover_gpus_with_nvml()
        except (ImportError, Exception) as e:
            print(f"⚠️ NVML not available ({e}), falling back to nvidia-smi")
            try:
                self._discover_gpus_with_smi()
            except Exception as e:
                print(f"⚠️ nvidia-smi not available ({e}), creating mock GPUs for demo")
                self._create_mock_gpus()

    def _discover_gpus_with_nvml(self):
        """Discover GPUs using nvidia-ml-py"""
        try:
            import pynvml
            pynvml.nvmlInit()

            device_count = pynvml.nvmlDeviceGetCount()
            print(f"🔍 Found {device_count} GPU(s) via NVML")

            for i in range(device_count):
                handle = pynvml.nvmlDeviceGetHandleByIndex(i)

                # Get device info
                name = pynvml.nvmlDeviceGetName(handle).decode('utf-8')
                mem_info = pynvml.nvmlDeviceGetMemoryInfo(handle)

                try:
                    utilization = pynvml.nvmlDeviceGetUtilizationRates(handle)
                    gpu_util = utilization.gpu
                except:
                    gpu_util = 0

                try:
                    temperature = pynvml.nvmlDeviceGetTemperature(handle, pynvml.NVML_TEMPERATURE_GPU)
                except:
                    temperature = 0

                try:
                    power = pynvml.nvmlDeviceGetPowerUsage(handle) // 1000  # Convert mW to W
                except:
                    power = 0

                gpu_info = GPUInfo(
                    gpu_id=i,
                    name=name,
                    memory_total_mb=mem_info.total // (1024 * 1024),
                    memory_used_mb=mem_info.used // (1024 * 1024),
                    memory_free_mb=mem_info.free // (1024 * 1024),
                    utilization_percent=gpu_util,
                    temperature_celsius=temperature,
                    power_usage_watts=power,
                    status=GPUStatus.AVAILABLE
                )

                self.gpus[i] = gpu_info
                print(f"   GPU {i}: {name} ({gpu_info.memory_total_mb}MB)")

        except ImportError:
            raise ImportError("pynvml not available")

    def _discover_gpus_with_smi(self):
        """Discover GPUs using nvidia-smi"""
        try:
            # Run nvidia-smi with JSON output
            result = subprocess.run([
                'nvidia-smi', '--query-gpu=index,name,memory.total,memory.used,memory.free,utilization.gpu,temperature.gpu,power.draw',
                '--format=csv,noheader,nounits'
            ], capture_output=True, text=True, timeout=10)

            if result.returncode != 0:
                raise Exception(f"nvidia-smi failed: {result.stderr}")

            lines = result.stdout.strip().split('\n')
            print(f"🔍 Found {len(lines)} GPU(s) via nvidia-smi")

            for line in lines:
                if not line.strip():
                    continue

                parts = [p.strip() for p in line.split(',')]
                if len(parts) < 8:
                    continue

                gpu_id = int(parts[0])
                name = parts[1]
                memory_total = int(parts[2])
                memory_used = int(parts[3])
                memory_free = int(parts[4])
                utilization = float(parts[5]) if parts[5] != '[N/A]' else 0
                temperature = int(float(parts[6])) if parts[6] != '[N/A]' else 0
                power = int(float(parts[7])) if parts[7] != '[N/A]' else 0

                gpu_info = GPUInfo(
                    gpu_id=gpu_id,
                    name=name,
                    memory_total_mb=memory_total,
                    memory_used_mb=memory_used,
                    memory_free_mb=memory_free,
                    utilization_percent=utilization,
                    temperature_celsius=temperature,
                    power_usage_watts=power,
                    status=GPUStatus.AVAILABLE
                )

                self.gpus[gpu_id] = gpu_info
                print(f"   GPU {gpu_id}: {name} ({memory_total}MB)")

        except (subprocess.TimeoutExpired, FileNotFoundError, subprocess.SubprocessError) as e:
            raise Exception(f"nvidia-smi execution failed: {e}")

    def _create_mock_gpus(self):
        """Create mock GPUs for demo purposes"""
        print("💡 Creating mock GPUs for demo")

        mock_gpus = [
            {"name": "NVIDIA GeForce RTX 3080", "memory": 10240},
            {"name": "NVIDIA GeForce RTX 3090", "memory": 24576}
        ]

        for i, gpu_config in enumerate(mock_gpus):
            gpu_info = GPUInfo(
                gpu_id=i,
                name=gpu_config["name"],
                memory_total_mb=gpu_config["memory"],
                memory_used_mb=512,  # Mock 512MB used
                memory_free_mb=gpu_config["memory"] - 512,
                utilization_percent=15.0,  # Mock 15% utilization
                temperature_celsius=65,
                power_usage_watts=150,
                status=GPUStatus.AVAILABLE
            )

            self.gpus[i] = gpu_info
            print(f"   Mock GPU {i}: {gpu_config['name']} ({gpu_config['memory']}MB)")

    def start_monitoring(self):
        """Start GPU monitoring thread"""
        if self.monitor_thread is None or not self.monitor_thread.is_alive():
            self.monitor_thread = threading.Thread(target=self._monitor_gpus, daemon=True)
            self.monitor_thread.start()
            print("📊 GPU monitoring started")

    def stop_monitoring(self):
        """Stop GPU monitoring"""
        self.monitoring = False
        if self.monitor_thread and self.monitor_thread.is_alive():
            self.monitor_thread.join()
        print("🛑 GPU monitoring stopped")

    def _monitor_gpus(self):
        """Monitor GPU status and update information"""
        while self.monitoring:
            try:
                with self.lock:
                    self._update_gpu_status()
                time.sleep(5)  # Update every 5 seconds
            except Exception as e:
                print(f"⚠️ GPU monitoring error: {e}")
                time.sleep(10)

    def _update_gpu_status(self):
        """Update GPU status from nvidia-ml-py or nvidia-smi"""
        try:
            # Try to update with real data
            self._update_real_gpu_status()
        except Exception as e:
            # Fall back to mock updates
            self._update_mock_gpu_status()

    def _update_real_gpu_status(self):
        """Update GPU status with real data"""
        try:
            import pynvml

            for gpu_id, gpu_info in self.gpus.items():
                handle = pynvml.nvmlDeviceGetHandleByIndex(gpu_id)

                # Update memory info
                mem_info = pynvml.nvmlDeviceGetMemoryInfo(handle)
                gpu_info.memory_used_mb = mem_info.used // (1024 * 1024)
                gpu_info.memory_free_mb = mem_info.free // (1024 * 1024)

                # Update utilization
                try:
                    utilization = pynvml.nvmlDeviceGetUtilizationRates(handle)
                    gpu_info.utilization_percent = utilization.gpu
                except:
                    pass

                # Update temperature
                try:
                    gpu_info.temperature_celsius = pynvml.nvmlDeviceGetTemperature(handle, pynvml.NVML_TEMPERATURE_GPU)
                except:
                    pass

                # Update power
                try:
                    gpu_info.power_usage_watts = pynvml.nvmlDeviceGetPowerUsage(handle) // 1000
                except:
                    pass

                # Update status based on utilization and allocation
                if gpu_info.allocated_to:
                    gpu_info.status = GPUStatus.ALLOCATED
                elif gpu_info.utilization_percent > 90:
                    gpu_info.status = GPUStatus.BUSY
                else:
                    gpu_info.status = GPUStatus.AVAILABLE

        except ImportError:
            raise Exception("NVML not available")

    def _update_mock_gpu_status(self):
        """Update mock GPU status for demo"""
        import random

        for gpu_info in self.gpus.values():
            if gpu_info.allocated_to:
                # Simulate usage for allocated GPUs
                gpu_info.utilization_percent = random.uniform(70, 95)
                gpu_info.memory_used_mb = gpu_info.allocated_memory_mb + random.randint(100, 500)
                gpu_info.temperature_celsius = random.randint(75, 85)
                gpu_info.power_usage_watts = random.randint(200, 300)
                gpu_info.status = GPUStatus.ALLOCATED
            else:
                # Simulate idle state
                gpu_info.utilization_percent = random.uniform(5, 20)
                gpu_info.memory_used_mb = random.randint(200, 800)
                gpu_info.temperature_celsius = random.randint(40, 55)
                gpu_info.power_usage_watts = random.randint(50, 100)
                gpu_info.status = GPUStatus.AVAILABLE

            gpu_info.memory_free_mb = gpu_info.memory_total_mb - gpu_info.memory_used_mb

    def allocate_gpus(self, job_id: str, num_gpus: int, memory_per_gpu_mb: int = 4096) -> List[int]:
        """Allocate GPUs for a job"""
        with self.lock:
            if num_gpus <= 0:
                print(f"❌ Invalid GPU count: {num_gpus}")
                return []

            # Find available GPUs with sufficient memory
            available_gpus = []
            for gpu_id, gpu_info in self.gpus.items():
                if (gpu_info.status == GPUStatus.AVAILABLE and
                    gpu_info.memory_free_mb >= memory_per_gpu_mb):
                    available_gpus.append(gpu_id)

            if len(available_gpus) < num_gpus:
                print(f"❌ Not enough GPUs available. Requested: {num_gpus}, Available: {len(available_gpus)}")
                return []

            # Allocate the first N available GPUs
            allocated_gpus = available_gpus[:num_gpus]

            for gpu_id in allocated_gpus:
                gpu_info = self.gpus[gpu_id]
                gpu_info.status = GPUStatus.ALLOCATED
                gpu_info.allocated_to = job_id
                gpu_info.allocated_memory_mb = memory_per_gpu_mb

            # Record allocation
            allocation = GPUAllocation(
                job_id=job_id,
                gpu_ids=allocated_gpus,
                allocated_memory_mb=memory_per_gpu_mb * num_gpus,
                allocated_at=time.time(),
                worker_node="localhost"  # For now, single node
            )

            self.allocations[job_id] = allocation

            print(f"✅ Allocated {num_gpus} GPU(s) to job {job_id}: {allocated_gpus}")
            return allocated_gpus

    def deallocate_gpus(self, job_id: str):
        """Deallocate GPUs from a job"""
        with self.lock:
            if job_id not in self.allocations:
                print(f"⚠️ No GPU allocation found for job {job_id}")
                return

            allocation = self.allocations[job_id]

            for gpu_id in allocation.gpu_ids:
                if gpu_id in self.gpus:
                    gpu_info = self.gpus[gpu_id]
                    gpu_info.status = GPUStatus.AVAILABLE
                    gpu_info.allocated_to = None
                    gpu_info.allocated_memory_mb = 0

            del self.allocations[job_id]
            print(f"🔄 Deallocated GPUs from job {job_id}: {allocation.gpu_ids}")

    def can_schedule_job(self, num_gpus: int, memory_per_gpu_mb: int = 4096) -> bool:
        """Check if a job can be scheduled with current GPU resources"""
        with self.lock:
            available_count = 0
            for gpu_info in self.gpus.values():
                if (gpu_info.status == GPUStatus.AVAILABLE and
                    gpu_info.memory_free_mb >= memory_per_gpu_mb):
                    available_count += 1

            return available_count >= num_gpus

    def get_gpu_status(self) -> Dict[str, Any]:
        """Get overall GPU cluster status"""
        with self.lock:
            total_gpus = len(self.gpus)
            available_gpus = sum(1 for gpu in self.gpus.values() if gpu.status == GPUStatus.AVAILABLE)
            allocated_gpus = sum(1 for gpu in self.gpus.values() if gpu.status == GPUStatus.ALLOCATED)

            total_memory = sum(gpu.memory_total_mb for gpu in self.gpus.values())
            used_memory = sum(gpu.memory_used_mb for gpu in self.gpus.values())

            return {
                "total_gpus": total_gpus,
                "available_gpus": available_gpus,
                "allocated_gpus": allocated_gpus,
                "busy_gpus": sum(1 for gpu in self.gpus.values() if gpu.status == GPUStatus.BUSY),
                "total_memory_mb": total_memory,
                "used_memory_mb": used_memory,
                "memory_utilization_percent": (used_memory / total_memory * 100) if total_memory > 0 else 0,
                "active_jobs": len(self.allocations),
                "gpus": {
                    gpu_id: asdict(gpu_info) for gpu_id, gpu_info in self.gpus.items()
                }
            }

# Global GPU manager instance
gpu_manager = GPUResourceManager()