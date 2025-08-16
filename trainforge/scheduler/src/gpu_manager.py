# File: trainforge/scheduler/src/gpu_manager.py
# GPU resource discovery, allocation, and management

import subprocess
import json
import time
import threading
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import psutil
import GPUtil

class GPUStatus(Enum):
    AVAILABLE = "available"
    ALLOCATED = "allocated"
    BUSY = "busy"
    ERROR = "error"

@dataclass
class GPUInfo:
    """GPU information and status"""
    gpu_id: int
    name: str
    memory_total: int  # MB
    memory_used: int   # MB
    memory_free: int   # MB
    utilization: int   # Percentage
    temperature: int   # Celsius
    power_draw: int    # Watts
    status: GPUStatus
    allocated_to: Optional[str] = None  # Job ID
    process_count: int = 0

@dataclass
class GPUAllocation:
    """GPU allocation record"""
    job_id: str
    gpu_ids: List[int]
    memory_required: int
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
        """Discover available GPUs on the system"""
        try:
            # Use nvidia-ml-py for detailed GPU info
            gpus = GPUtil.getGPUs()
            
            for gpu in gpus:
                gpu_info = GPUInfo(
                    gpu_id=gpu.id,
                    name=gpu.name,
                    memory_total=int(gpu.memoryTotal),
                    memory_used=int(gpu.memoryUsed),
                    memory_free=int(gpu.memoryFree),
                    utilization=int(gpu.load * 100),
                    temperature=int(gpu.temperature),
                    power_draw=0,  # GPUtil doesn't provide power info
                    status=GPUStatus.AVAILABLE,
                    process_count=0
                )
                
                self.gpus[gpu.id] = gpu_info
                print(f"🔍 Discovered GPU {gpu.id}: {gpu.name} ({gpu.memoryTotal}MB)")
                
        except Exception as e:
            print(f"⚠️ GPU discovery failed: {e}")
            print("💡 Falling back to mock GPU setup for demo")
            self._create_mock_gpus()
    
    def _create_mock_gpus(self):
        """Create mock GPUs for demonstration when real GPUs aren't available"""
        mock_gpus = [
            {"id": 0, "name": "NVIDIA RTX 4090", "memory": 24576},
            {"id": 1, "name": "NVIDIA RTX 4080", "memory": 16384},
            {"id": 2, "name": "NVIDIA RTX 3090", "memory": 24576},
            {"id": 3, "name": "NVIDIA RTX 3080", "memory": 10240},
        ]
        
        for gpu_data in mock_gpus:
            gpu_info = GPUInfo(
                gpu_id=gpu_data["id"],
                name=gpu_data["name"],
                memory_total=gpu_data["memory"],
                memory_used=1024,  # Mock 1GB used
                memory_free=gpu_data["memory"] - 1024,
                utilization=5,  # Mock 5% utilization
                temperature=45,  # Mock temperature
                power_draw=150,  # Mock power draw
                status=GPUStatus.AVAILABLE,
                process_count=0
            )
            
            self.gpus[gpu_data["id"]] = gpu_info
            print(f"🔍 Mock GPU {gpu_data['id']}: {gpu_data['name']} ({gpu_data['memory']}MB)")
    
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
        """Update GPU status from system"""
        try:
            # Try to get real GPU info
            gpus = GPUtil.getGPUs()
            
            for gpu in gpus:
                if gpu.id in self.gpus:
                    gpu_info = self.gpus[gpu.id]
                    gpu_info.memory_used = int(gpu.memoryUsed)
                    gpu_info.memory_free = int(gpu.memoryFree)
                    gpu_info.utilization = int(gpu.load * 100)
                    gpu_info.temperature = int(gpu.temperature)
                    
                    # Update status based on utilization
                    if gpu_info.allocated_to:
                        gpu_info.status = GPUStatus.ALLOCATED
                    elif gpu_info.utilization > 90:
                        gpu_info.status = GPUStatus.BUSY
                    else:
                        gpu_info.status = GPUStatus.AVAILABLE
                        
        except Exception as e:
            # Fall back to mock updates
            import random
            for gpu_id, gpu_info in self.gpus.items():
                if gpu_info.status == GPUStatus.ALLOCATED:
                    # Simulate training workload
                    gpu_info.utilization = random.randint(80, 98)
                    gpu_info.temperature = random.randint(65, 85)
                    gpu_info.memory_used = int(gpu_info.memory_total * 0.8)
                else:
                    # Simulate idle state
                    gpu_info.utilization = random.randint(0, 15)
                    gpu_info.temperature = random.randint(40, 55)
                    gpu_info.memory_used = random.randint(1000, 2000)
                
                gpu_info.memory_free = gpu_info.memory_total - gpu_info.memory_used
    
    def get_available_gpus(self, memory_required: int = 0) -> List[GPUInfo]:
        """Get list of available GPUs with optional memory requirement"""
        with self.lock:
            available = []
            for gpu in self.gpus.values():
                if (gpu.status == GPUStatus.AVAILABLE and 
                    gpu.memory_free >= memory_required):
                    available.append(gpu)
            return available
    
    def allocate_gpus(self, job_id: str, num_gpus: int, memory_per_gpu: int = 4096, 
                     worker_node: str = "localhost") -> Optional[List[int]]:
        """Allocate GPUs for a job"""
        with self.lock:
            available_gpus = self.get_available_gpus(memory_per_gpu)
            
            if len(available_gpus) < num_gpus:
                print(f"❌ Not enough GPUs available. Need {num_gpus}, have {len(available_gpus)}")
                return None
            
            # Select best GPUs (highest memory first)
            selected_gpus = sorted(available_gpus, 
                                 key=lambda g: g.memory_free, 
                                 reverse=True)[:num_gpus]
            
            # Mark GPUs as allocated
            gpu_ids = []
            for gpu in selected_gpus:
                gpu.status = GPUStatus.ALLOCATED
                gpu.allocated_to = job_id
                gpu_ids.append(gpu.gpu_id)
            
            # Record allocation
            allocation = GPUAllocation(
                job_id=job_id,
                gpu_ids=gpu_ids,
                memory_required=memory_per_gpu,
                allocated_at=time.time(),
                worker_node=worker_node
            )
            
            self.allocations[job_id] = allocation
            
            print(f"✅ Allocated GPUs {gpu_ids} to job {job_id}")
            return gpu_ids
    
    def deallocate_gpus(self, job_id: str):
        """Deallocate GPUs from a job"""
        with self.lock:
            if job_id not in self.allocations:
                print(f"⚠️ No GPU allocation found for job {job_id}")
                return
            
            allocation = self.allocations[job_id]
            
            # Mark GPUs as available
            for gpu_id in allocation.gpu_ids:
                if gpu_id in self.gpus:
                    gpu = self.gpus[gpu_id]
                    gpu.status = GPUStatus.AVAILABLE
                    gpu.allocated_to = None
            
            # Remove allocation record
            del self.allocations[job_id]
            
            print(f"🔄 Deallocated GPUs {allocation.gpu_ids} from job {job_id}")
    
    def get_gpu_status(self) -> Dict[str, any]:
        """Get overall GPU cluster status"""
        with self.lock:
            total_gpus = len(self.gpus)
            available_gpus = len([g for g in self.gpus.values() 
                                if g.status == GPUStatus.AVAILABLE])
            allocated_gpus = len([g for g in self.gpus.values() 
                                if g.status == GPUStatus.ALLOCATED])
            
            total_memory = sum(g.memory_total for g in self.gpus.values())
            used_memory = sum(g.memory_used for g in self.gpus.values())
            
            return {
                "total_gpus": total_gpus,
                "available_gpus": available_gpus,
                "allocated_gpus": allocated_gpus,
                "busy_gpus": total_gpus - available_gpus - allocated_gpus,
                "total_memory_mb": total_memory,
                "used_memory_mb": used_memory,
                "memory_utilization": (used_memory / total_memory * 100) if total_memory > 0 else 0,
                "gpus": {gpu_id: {
                    "name": gpu.name,
                    "status": gpu.status.value,
                    "utilization": gpu.utilization,
                    "memory_used": gpu.memory_used,
                    "memory_total": gpu.memory_total,
                    "temperature": gpu.temperature,
                    "allocated_to": gpu.allocated_to
                } for gpu_id, gpu in self.gpus.items()}
            }
    
    def get_job_gpus(self, job_id: str) -> Optional[List[int]]:
        """Get GPU IDs allocated to a specific job"""
        with self.lock:
            if job_id in self.allocations:
                return self.allocations[job_id].gpu_ids
            return None
    
    def can_schedule_job(self, num_gpus: int, memory_per_gpu: int = 4096) -> bool:
        """Check if a job can be scheduled with current resources"""
        available_gpus = self.get_available_gpus(memory_per_gpu)
        return len(available_gpus) >= num_gpus

# Global GPU manager instance
gpu_manager = GPUResourceManager()