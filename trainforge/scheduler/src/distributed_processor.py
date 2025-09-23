# File: trainforge/scheduler/src/distributed_processor.py
# Distributed processing coordinator for CPU-based workloads with comprehensive statistics

import multiprocessing
import threading
import time
import queue
import subprocess
import os
import signal
import psutil
from typing import Dict, List, Optional, Any, Callable, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor, as_completed
import pickle
import json
from pathlib import Path
import tempfile
import shutil

try:
    from .cpu_manager import cpu_manager, CPUAllocation
except ImportError:
    from cpu_manager import cpu_manager, CPUAllocation

class ProcessingMode(Enum):
    MULTIPROCESSING = "multiprocessing"
    THREADING = "threading"
    HYBRID = "hybrid"
    DISTRIBUTED = "distributed"

class TaskPriority(Enum):
    LOW = 1
    NORMAL = 2
    HIGH = 3
    CRITICAL = 4

@dataclass
class ProcessingTask:
    """A unit of work to be processed"""
    task_id: str
    job_id: str
    function_name: str
    args: tuple
    kwargs: dict
    priority: TaskPriority = TaskPriority.NORMAL
    cpu_intensive: bool = True
    memory_requirement_mb: int = 512
    estimated_duration_seconds: int = 60
    dependencies: List[str] = None
    retry_count: int = 0
    max_retries: int = 3

@dataclass
class ProcessingResult:
    """Result of a processed task"""
    task_id: str
    job_id: str
    success: bool
    result: Any = None
    error: str = None
    execution_time: float = 0.0
    cpu_time: float = 0.0
    memory_peak_mb: float = 0.0
    cpu_cores_used: List[int] = None
    worker_id: str = None
    started_at: float = None
    completed_at: float = None

@dataclass
class WorkerStats:
    """Statistics for a worker process/thread"""
    worker_id: str
    worker_type: str
    pid: int
    cpu_cores: List[int]
    tasks_completed: int = 0
    tasks_failed: int = 0
    total_cpu_time: float = 0.0
    total_execution_time: float = 0.0
    memory_peak_mb: float = 0.0
    started_at: float = None
    last_task_at: float = None
    efficiency_score: float = 0.0

class DistributedProcessor:
    """Distributed processing coordinator with comprehensive monitoring"""
    
    def __init__(self, mode: ProcessingMode = ProcessingMode.HYBRID):
        self.mode = mode
        self.task_queue = queue.PriorityQueue()
        self.result_queue = queue.Queue()
        self.workers: Dict[str, WorkerStats] = {}
        self.active_tasks: Dict[str, ProcessingTask] = {}
        self.completed_tasks: Dict[str, ProcessingResult] = {}
        self.failed_tasks: Dict[str, ProcessingResult] = {}
        
        # Processing pools
        self.process_pool: Optional[ProcessPoolExecutor] = None
        self.thread_pool: Optional[ThreadPoolExecutor] = None
        
        # Control flags
        self.running = False
        self.shutdown_requested = False
        
        # Statistics and monitoring
        self.stats = {
            "tasks_submitted": 0,
            "tasks_completed": 0,
            "tasks_failed": 0,
            "total_processing_time": 0.0,
            "total_cpu_time": 0.0,
            "start_time": time.time(),
            "peak_workers": 0,
            "efficiency_scores": []
        }
        
        # Coordinator thread
        self.coordinator_thread = None
        self.monitor_thread = None
        
        # Performance tracking
        self.performance_samples = []
        self.load_balancing_enabled = True
        
        print(f"🏭 Distributed Processor initialized in {mode.value} mode")
    
    def start(self, max_workers: int = None):
        """Start the distributed processing system"""
        if self.running:
            print("⚠️ Processor already running")
            return
        
        if max_workers is None:
            max_workers = multiprocessing.cpu_count()
        
        print(f"🚀 Starting distributed processor with {max_workers} max workers")
        
        # Initialize processing pools based on mode
        if self.mode in [ProcessingMode.MULTIPROCESSING, ProcessingMode.HYBRID, ProcessingMode.DISTRIBUTED]:
            # Reserve CPU cores for multiprocessing
            cpu_cores = cpu_manager.allocate_cpus(
                job_id="processor_system",
                num_cores=max_workers,
                memory_gb=max_workers * 0.5,  # 512MB per worker
                priority=1
            )
            
            if cpu_cores:
                self.process_pool = ProcessPoolExecutor(
                    max_workers=max_workers,
                    initializer=self._worker_initializer,
                    initargs=(cpu_cores,)
                )
                print(f"✅ Process pool created with {max_workers} workers on cores {cpu_cores}")
            else:
                print("❌ Failed to allocate CPU cores for process pool")
                return
        
        if self.mode in [ProcessingMode.THREADING, ProcessingMode.HYBRID]:
            thread_workers = max(2, max_workers // 2) if self.mode == ProcessingMode.HYBRID else max_workers
            self.thread_pool = ThreadPoolExecutor(max_workers=thread_workers)
            print(f"✅ Thread pool created with {thread_workers} workers")
        
        self.running = True
        self.shutdown_requested = False
        
        # Start coordinator and monitor threads
        self.coordinator_thread = threading.Thread(target=self._coordinator_loop, daemon=True)
        self.monitor_thread = threading.Thread(target=self._monitor_loop, daemon=True)
        
        self.coordinator_thread.start()
        self.monitor_thread.start()
        
        print("✅ Distributed processor started successfully")
    
    def stop(self):
        """Stop the distributed processing system"""
        if not self.running:
            return
        
        print("🛑 Stopping distributed processor...")
        self.shutdown_requested = True
        self.running = False
        
        # Wait for current tasks to complete (with timeout)
        if self.process_pool:
            self.process_pool.shutdown(wait=True)
            print("✅ Process pool shutdown complete")
        
        if self.thread_pool:
            self.thread_pool.shutdown(wait=True)
            print("✅ Thread pool shutdown complete")
        
        # Deallocate CPU resources
        cpu_manager.deallocate_cpus("processor_system")
        
        print("✅ Distributed processor stopped")
    
    def submit_task(self, task: ProcessingTask) -> bool:
        """Submit a task for processing"""
        if not self.running:
            print("❌ Processor not running")
            return False
        
        try:
            # Calculate priority score (lower = higher priority)
            priority_score = (
                task.priority.value * 1000 +  # Base priority
                task.estimated_duration_seconds +  # Shorter tasks first
                time.time()  # FIFO for same priority
            )
            
            self.task_queue.put((priority_score, task))
            self.stats["tasks_submitted"] += 1
            
            print(f"📥 Task {task.task_id} submitted (job: {task.job_id}, priority: {task.priority.name})")
            return True
            
        except Exception as e:
            print(f"❌ Failed to submit task {task.task_id}: {e}")
            return False
    
    def _coordinator_loop(self):
        """Main coordinator loop for task distribution"""
        print("🎯 Coordinator loop started")
        
        while self.running and not self.shutdown_requested:
            try:
                # Get next task
                try:
                    priority_score, task = self.task_queue.get(timeout=1.0)
                except queue.Empty:
                    continue
                
                # Check dependencies
                if not self._check_dependencies(task):
                    # Put task back in queue with delay
                    self.task_queue.put((priority_score + 1, task))
                    time.sleep(0.1)
                    continue
                
                # Determine optimal processing mode for this task
                processing_mode = self._determine_processing_mode(task)
                
                # Submit task to appropriate pool
                if processing_mode == "process" and self.process_pool:
                    future = self.process_pool.submit(
                        self._execute_task_in_process,
                        task
                    )
                elif processing_mode == "thread" and self.thread_pool:
                    future = self.thread_pool.submit(
                        self._execute_task_in_thread,
                        task
                    )
                else:
                    print(f"⚠️ No suitable executor for task {task.task_id}")
                    continue
                
                # Track active task
                self.active_tasks[task.task_id] = task
                
                # Register completion callback
                future.add_done_callback(
                    lambda f, t=task: self._handle_task_completion(f, t)
                )
                
            except Exception as e:
                print(f"❌ Coordinator error: {e}")
                time.sleep(1)
        
        print("🎯 Coordinator loop stopped")
    
    def _check_dependencies(self, task: ProcessingTask) -> bool:
        """Check if task dependencies are satisfied"""
        if not task.dependencies:
            return True
        
        for dep_task_id in task.dependencies:
            if dep_task_id not in self.completed_tasks:
                return False
        
        return True
    
    def _determine_processing_mode(self, task: ProcessingTask) -> str:
        """Determine optimal processing mode for a task"""
        if self.mode == ProcessingMode.MULTIPROCESSING:
            return "process"
        elif self.mode == ProcessingMode.THREADING:
            return "thread"
        elif self.mode == ProcessingMode.HYBRID:
            # CPU-intensive tasks -> processes, I/O tasks -> threads
            return "process" if task.cpu_intensive else "thread"
        elif self.mode == ProcessingMode.DISTRIBUTED:
            # For now, use processes (future: could distribute across nodes)
            return "process"
        
        return "process"
    
    @staticmethod
    def _worker_initializer(cpu_cores: List[int]):
        """Initialize worker process with CPU affinity"""
        try:
            worker_id = f"worker_{os.getpid()}"
            
            # Set CPU affinity
            if cpu_cores:
                process = psutil.Process()
                # Assign cores round-robin style
                worker_core = cpu_cores[os.getpid() % len(cpu_cores)]
                process.cpu_affinity([worker_core])
                print(f"🔧 Worker {worker_id} initialized with CPU core {worker_core}")
            
        except Exception as e:
            print(f"⚠️ Worker initialization failed: {e}")
    
    def _execute_task_in_process(self, task: ProcessingTask) -> ProcessingResult:
        """Execute task in a separate process"""
        start_time = time.time()
        process = psutil.Process()
        
        try:
            # Get initial resource usage
            cpu_times_start = process.cpu_times()
            memory_start = process.memory_info().rss / (1024 * 1024)  # MB
            
            # Import and execute the function
            result = self._import_and_execute_function(task)
            
            # Calculate resource usage
            cpu_times_end = process.cpu_times()
            memory_end = process.memory_info().rss / (1024 * 1024)  # MB
            
            cpu_time = (cpu_times_end.user + cpu_times_end.system) - (cpu_times_start.user + cpu_times_start.system)
            execution_time = time.time() - start_time
            memory_peak = max(memory_start, memory_end)
            
            return ProcessingResult(
                task_id=task.task_id,
                job_id=task.job_id,
                success=True,
                result=result,
                execution_time=execution_time,
                cpu_time=cpu_time,
                memory_peak_mb=memory_peak,
                cpu_cores_used=process.cpu_affinity(),
                worker_id=f"process_{os.getpid()}",
                started_at=start_time,
                completed_at=time.time()
            )
            
        except Exception as e:
            execution_time = time.time() - start_time
            
            return ProcessingResult(
                task_id=task.task_id,
                job_id=task.job_id,
                success=False,
                error=str(e),
                execution_time=execution_time,
                worker_id=f"process_{os.getpid()}",
                started_at=start_time,
                completed_at=time.time()
            )
    
    def _execute_task_in_thread(self, task: ProcessingTask) -> ProcessingResult:
        """Execute task in a thread"""
        start_time = time.time()
        
        try:
            # Execute the function
            result = self._import_and_execute_function(task)
            
            execution_time = time.time() - start_time
            
            return ProcessingResult(
                task_id=task.task_id,
                job_id=task.job_id,
                success=True,
                result=result,
                execution_time=execution_time,
                worker_id=f"thread_{threading.get_ident()}",
                started_at=start_time,
                completed_at=time.time()
            )
            
        except Exception as e:
            execution_time = time.time() - start_time
            
            return ProcessingResult(
                task_id=task.task_id,
                job_id=task.job_id,
                success=False,
                error=str(e),
                execution_time=execution_time,
                worker_id=f"thread_{threading.get_ident()}",
                started_at=start_time,
                completed_at=time.time()
            )
    
    def _import_and_execute_function(self, task: ProcessingTask) -> Any:
        """Import and execute the specified function"""
        # For demo purposes, we'll simulate different types of workloads
        if task.function_name == "cpu_intensive_task":
            return self._simulate_cpu_intensive_task(task.args, task.kwargs)
        elif task.function_name == "memory_intensive_task":
            return self._simulate_memory_intensive_task(task.args, task.kwargs)
        elif task.function_name == "io_intensive_task":
            return self._simulate_io_intensive_task(task.args, task.kwargs)
        elif task.function_name == "ml_training_task":
            return self._simulate_ml_training_task(task.args, task.kwargs)
        else:
            raise ValueError(f"Unknown function: {task.function_name}")
    
    def _simulate_cpu_intensive_task(self, args: tuple, kwargs: dict) -> dict:
        """Simulate CPU-intensive computation"""
        iterations = kwargs.get("iterations", 1000000)
        complexity = kwargs.get("complexity", 1)
        
        start_time = time.time()
        
        # Simulate heavy computation
        result = 0
        for i in range(iterations):
            for j in range(complexity):
                result += (i * j) ** 0.5
        
        processing_time = time.time() - start_time
        
        return {
            "result": result,
            "iterations": iterations,
            "complexity": complexity,
            "processing_time": processing_time,
            "operations_per_second": (iterations * complexity) / processing_time if processing_time > 0 else 0
        }
    
    def _simulate_memory_intensive_task(self, args: tuple, kwargs: dict) -> dict:
        """Simulate memory-intensive computation"""
        data_size_mb = kwargs.get("data_size_mb", 100)
        operations = kwargs.get("operations", 1000)
        
        start_time = time.time()
        
        # Create large data structure
        data_size_bytes = int(data_size_mb * 1024 * 1024)
        large_array = bytearray(data_size_bytes)
        
        # Perform operations on the data
        for i in range(operations):
            # Simple operations to simulate memory access patterns
            index = (i * 1024) % len(large_array)
            large_array[index] = (large_array[index] + 1) % 256
        
        processing_time = time.time() - start_time
        
        # Clean up
        del large_array
        
        return {
            "data_size_mb": data_size_mb,
            "operations": operations,
            "processing_time": processing_time,
            "memory_throughput_mb_per_sec": data_size_mb / processing_time if processing_time > 0 else 0
        }
    
    def _simulate_io_intensive_task(self, args: tuple, kwargs: dict) -> dict:
        """Simulate I/O intensive computation"""
        file_count = kwargs.get("file_count", 10)
        file_size_kb = kwargs.get("file_size_kb", 1024)
        
        start_time = time.time()
        
        # Create temporary directory
        temp_dir = Path(tempfile.mkdtemp(prefix="trainforge_io_"))
        
        try:
            # Write files
            for i in range(file_count):
                file_path = temp_dir / f"test_file_{i}.dat"
                data = b"x" * (file_size_kb * 1024)
                file_path.write_bytes(data)
            
            # Read files back
            total_bytes = 0
            for i in range(file_count):
                file_path = temp_dir / f"test_file_{i}.dat"
                data = file_path.read_bytes()
                total_bytes += len(data)
            
            processing_time = time.time() - start_time
            
            return {
                "file_count": file_count,
                "file_size_kb": file_size_kb,
                "total_bytes": total_bytes,
                "processing_time": processing_time,
                "io_throughput_mb_per_sec": (total_bytes / (1024 * 1024)) / processing_time if processing_time > 0 else 0
            }
        
        finally:
            # Clean up
            shutil.rmtree(temp_dir, ignore_errors=True)
    
    def _simulate_ml_training_task(self, args: tuple, kwargs: dict) -> dict:
        """Simulate ML training computation"""
        epochs = kwargs.get("epochs", 5)
        batch_size = kwargs.get("batch_size", 32)
        model_complexity = kwargs.get("model_complexity", 1000)
        
        start_time = time.time()
        
        # Simulate training loop
        total_operations = 0
        for epoch in range(epochs):
            epoch_start = time.time()
            
            # Simulate batches
            for batch in range(100):  # Simulate 100 batches per epoch
                # Simulate forward pass
                for _ in range(model_complexity):
                    result = sum(i ** 2 for i in range(batch_size))
                    total_operations += batch_size
                
                # Simulate backward pass
                for _ in range(model_complexity // 2):
                    result = sum(i ** 0.5 for i in range(batch_size))
                    total_operations += batch_size
            
            epoch_time = time.time() - epoch_start
            
            # Simulate some randomness in training time
            time.sleep(0.1)  # Simulate other overhead
        
        processing_time = time.time() - start_time
        
        return {
            "epochs": epochs,
            "batch_size": batch_size,
            "model_complexity": model_complexity,
            "total_operations": total_operations,
            "processing_time": processing_time,
            "operations_per_second": total_operations / processing_time if processing_time > 0 else 0,
            "simulated_accuracy": min(0.95, 0.5 + (epochs * 0.08))  # Mock accuracy improvement
        }
    
    def _handle_task_completion(self, future, task: ProcessingTask):
        """Handle task completion"""
        try:
            result = future.result()
            
            # Remove from active tasks
            if task.task_id in self.active_tasks:
                del self.active_tasks[task.task_id]
            
            # Store result
            if result.success:
                self.completed_tasks[task.task_id] = result
                self.stats["tasks_completed"] += 1
                self.stats["total_processing_time"] += result.execution_time
                if result.cpu_time:
                    self.stats["total_cpu_time"] += result.cpu_time
                
                print(f"✅ Task {task.task_id} completed in {result.execution_time:.2f}s")
            else:
                self.failed_tasks[task.task_id] = result
                self.stats["tasks_failed"] += 1
                
                # Retry logic
                if task.retry_count < task.max_retries:
                    task.retry_count += 1
                    print(f"🔄 Retrying task {task.task_id} (attempt {task.retry_count + 1})")
                    self.submit_task(task)
                else:
                    print(f"❌ Task {task.task_id} failed permanently: {result.error}")
        
        except Exception as e:
            print(f"❌ Error handling task completion: {e}")
    
    def _monitor_loop(self):
        """Monitor system performance and worker statistics"""
        print("📊 Monitor loop started")
        
        while self.running and not self.shutdown_requested:
            try:
                # Collect performance sample
                sample = self._collect_performance_sample()
                self.performance_samples.append(sample)
                
                # Keep only last 100 samples
                if len(self.performance_samples) > 100:
                    self.performance_samples = self.performance_samples[-100:]
                
                # Update efficiency scores
                self._update_efficiency_scores()
                
                time.sleep(5)  # Monitor every 5 seconds
                
            except Exception as e:
                print(f"⚠️ Monitor error: {e}")
                time.sleep(10)
        
        print("📊 Monitor loop stopped")
    
    def _collect_performance_sample(self) -> dict:
        """Collect current performance sample"""
        cpu_status = cpu_manager.get_cpu_status()
        
        return {
            "timestamp": time.time(),
            "active_tasks": len(self.active_tasks),
            "cpu_utilization": cpu_status.get("current_metrics", {}).get("cpu_usage_percent", 0),
            "memory_utilization": cpu_status.get("current_metrics", {}).get("memory_usage_percent", 0),
            "allocated_cores": cpu_status.get("allocated_cores", 0),
            "available_cores": cpu_status.get("available_cores", 0),
            "tasks_completed": self.stats["tasks_completed"],
            "tasks_failed": self.stats["tasks_failed"]
        }
    
    def _update_efficiency_scores(self):
        """Update efficiency scores based on recent performance"""
        if len(self.performance_samples) < 2:
            return
        
        recent_samples = self.performance_samples[-10:]  # Last 10 samples
        
        # Calculate average utilization
        avg_cpu = sum(s["cpu_utilization"] for s in recent_samples) / len(recent_samples)
        avg_memory = sum(s["memory_utilization"] for s in recent_samples) / len(recent_samples)
        
        # Calculate throughput
        if len(recent_samples) >= 2:
            time_diff = recent_samples[-1]["timestamp"] - recent_samples[0]["timestamp"]
            task_diff = recent_samples[-1]["tasks_completed"] - recent_samples[0]["tasks_completed"]
            throughput = task_diff / time_diff if time_diff > 0 else 0
        else:
            throughput = 0
        
        # Calculate efficiency score
        utilization_score = (avg_cpu + avg_memory) / 2
        throughput_score = min(100, throughput * 10)  # Scale throughput
        
        efficiency = (utilization_score * 0.6 + throughput_score * 0.4)
        self.stats["efficiency_scores"].append(efficiency)
        
        # Keep only last 20 efficiency scores
        if len(self.stats["efficiency_scores"]) > 20:
            self.stats["efficiency_scores"] = self.stats["efficiency_scores"][-20:]
    
    def get_status(self) -> Dict[str, Any]:
        """Get comprehensive processor status"""
        uptime = time.time() - self.stats["start_time"]
        
        # Calculate averages
        avg_efficiency = (sum(self.stats["efficiency_scores"]) / len(self.stats["efficiency_scores"])) if self.stats["efficiency_scores"] else 0
        
        throughput = self.stats["tasks_completed"] / uptime if uptime > 0 else 0
        
        return {
            "running": self.running,
            "mode": self.mode.value,
            "uptime_seconds": uptime,
            "queue_size": self.task_queue.qsize(),
            "active_tasks": len(self.active_tasks),
            "completed_tasks": len(self.completed_tasks),
            "failed_tasks": len(self.failed_tasks),
            "throughput_tasks_per_second": throughput,
            "average_efficiency_score": avg_efficiency,
            "total_processing_time": self.stats["total_processing_time"],
            "total_cpu_time": self.stats["total_cpu_time"],
            "cpu_efficiency": (self.stats["total_cpu_time"] / self.stats["total_processing_time"] * 100) if self.stats["total_processing_time"] > 0 else 0,
            "resource_allocation": cpu_manager.get_cpu_status(),
            "recent_performance": self.performance_samples[-10:] if len(self.performance_samples) >= 10 else self.performance_samples
        }
    
    def get_task_results(self, job_id: str = None) -> Dict[str, List[ProcessingResult]]:
        """Get task results, optionally filtered by job ID"""
        completed = list(self.completed_tasks.values())
        failed = list(self.failed_tasks.values())
        
        if job_id:
            completed = [r for r in completed if r.job_id == job_id]
            failed = [r for r in failed if r.job_id == job_id]
        
        return {
            "completed": [asdict(r) for r in completed],
            "failed": [asdict(r) for r in failed]
        }

# Global distributed processor instance
distributed_processor = DistributedProcessor()