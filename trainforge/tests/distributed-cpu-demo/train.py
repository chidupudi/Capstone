# File: trainforge/examples/distributed-cpu-demo/train.py
# Enhanced distributed CPU training demonstration with comprehensive statistics

import sys
import os
import time
import json
import threading
from datetime import datetime
from pathlib import Path

# Add the scheduler src to path for imports
sys.path.append(str(Path(__file__).parent.parent.parent / "scheduler" / "src"))

try:
    from cpu_manager import cpu_manager
    from distributed_processor import distributed_processor, ProcessingTask, TaskPriority
except ImportError as e:
    print(f"⚠️ Could not import distributed processing modules: {e}")
    print("💡 Running in fallback mode with simulated statistics")
    cpu_manager = None
    distributed_processor = None

import multiprocessing
import numpy as np
import psutil
import matplotlib.pyplot as plt
from concurrent.futures import ProcessPoolExecutor, as_completed

class DistributedCPUTrainer:
    """Enhanced trainer demonstrating distributed CPU processing with statistics"""
    
    def __init__(self, job_id: str = "distributed_cpu_demo"):
        self.job_id = job_id
        self.start_time = time.time()
        self.statistics = {
            "job_id": job_id,
            "start_time": self.start_time,
            "total_tasks": 0,
            "completed_tasks": 0,
            "failed_tasks": 0,
            "cpu_utilization_samples": [],
            "memory_utilization_samples": [],
            "throughput_samples": [],
            "efficiency_scores": [],
            "resource_allocation": {},
            "performance_impact": {},
            "worker_stats": {}
        }
        
        # Training configuration
        self.config = {
            "epochs": 10,
            "batch_size": 64,
            "model_complexity": 2000,
            "data_partitions": multiprocessing.cpu_count(),
            "validation_split": 0.2,
            "early_stopping_patience": 3
        }
        
        # Performance monitoring
        self.monitor_thread = None
        self.monitoring_active = False
        
        print(f"🚀 Distributed CPU Trainer initialized for job {job_id}")
        print(f"📊 Configuration: {self.config}")
    
    def start_training(self):
        """Start distributed training with comprehensive monitoring"""
        print("\n" + "="*80)
        print("🏋️ Starting Distributed CPU Training")
        print("="*80)
        
        # Start resource monitoring
        self._start_monitoring()
        
        try:
            if distributed_processor and cpu_manager:
                # Use advanced distributed processing
                self._run_advanced_training()
            else:
                # Fallback to basic multiprocessing demo
                self._run_fallback_training()
        
        finally:
            # Stop monitoring and generate report
            self._stop_monitoring()
            self._generate_final_report()
    
    def _start_monitoring(self):
        """Start system monitoring thread"""
        self.monitoring_active = True
        self.monitor_thread = threading.Thread(target=self._monitor_system, daemon=True)
        self.monitor_thread.start()
        print("📊 System monitoring started")
    
    def _stop_monitoring(self):
        """Stop system monitoring"""
        self.monitoring_active = False
        if self.monitor_thread and self.monitor_thread.is_alive():
            self.monitor_thread.join(timeout=2)
        print("📊 System monitoring stopped")
    
    def _monitor_system(self):
        """Monitor system resources during training"""
        while self.monitoring_active:
            try:
                # Collect CPU and memory statistics
                cpu_percent = psutil.cpu_percent(interval=1)
                memory = psutil.virtual_memory()
                
                timestamp = time.time() - self.start_time
                
                self.statistics["cpu_utilization_samples"].append({
                    "timestamp": timestamp,
                    "cpu_percent": cpu_percent,
                    "cpu_count": psutil.cpu_count(),
                    "load_average": psutil.getloadavg() if hasattr(psutil, 'getloadavg') else (0, 0, 0)
                })
                
                self.statistics["memory_utilization_samples"].append({
                    "timestamp": timestamp,
                    "memory_percent": memory.percent,
                    "memory_used_gb": memory.used / (1024**3),
                    "memory_total_gb": memory.total / (1024**3)
                })
                
                # Calculate throughput
                if self.statistics["completed_tasks"] > 0:
                    throughput = self.statistics["completed_tasks"] / timestamp
                    self.statistics["throughput_samples"].append({
                        "timestamp": timestamp,
                        "tasks_per_second": throughput
                    })
                
                # Get advanced statistics if available
                if cpu_manager:
                    cpu_status = cpu_manager.get_cpu_status()
                    self.statistics["resource_allocation"] = cpu_status
                    
                    if "performance_impact" in cpu_status:
                        self.statistics["performance_impact"] = cpu_status["performance_impact"]
                
                if distributed_processor:
                    processor_status = distributed_processor.get_status()
                    self.statistics["efficiency_scores"].append({
                        "timestamp": timestamp,
                        "efficiency": processor_status.get("average_efficiency_score", 0)
                    })
                
            except Exception as e:
                print(f"⚠️ Monitoring error: {e}")
            
            time.sleep(2)  # Monitor every 2 seconds
    
    def _run_advanced_training(self):
        """Run training using advanced distributed processing"""
        print("🔧 Using advanced distributed processing system")
        
        # Start distributed processor
        max_workers = min(multiprocessing.cpu_count(), 8)
        distributed_processor.start(max_workers=max_workers)
        
        try:
            # Generate training tasks
            tasks = self._generate_training_tasks()
            self.statistics["total_tasks"] = len(tasks)
            
            print(f"📋 Generated {len(tasks)} training tasks")
            print(f"👥 Using {max_workers} worker processes")
            
            # Submit all tasks
            for task in tasks:
                distributed_processor.submit_task(task)
            
            # Wait for completion and track progress
            self._track_task_progress()
            
            # Collect final results
            results = distributed_processor.get_task_results(self.job_id)
            self._process_training_results(results)
            
        finally:
            distributed_processor.stop()
    
    def _run_fallback_training(self):
        """Run training using basic multiprocessing for demonstration"""
        print("🔧 Using fallback multiprocessing demonstration")
        
        # Simulate distributed training workload
        tasks = self._generate_fallback_tasks()
        self.statistics["total_tasks"] = len(tasks)
        
        print(f"📋 Generated {len(tasks)} simulation tasks")
        
        # Execute tasks with multiprocessing
        max_workers = min(multiprocessing.cpu_count(), 8)
        
        with ProcessPoolExecutor(max_workers=max_workers) as executor:
            print(f"👥 Using {max_workers} worker processes")
            
            # Submit all tasks
            future_to_task = {
                executor.submit(self._execute_simulation_task, task): task 
                for task in tasks
            }
            
            # Process results as they complete
            for future in as_completed(future_to_task):
                task = future_to_task[future]
                try:
                    result = future.result()
                    self.statistics["completed_tasks"] += 1
                    
                    # Print progress
                    progress = (self.statistics["completed_tasks"] / self.statistics["total_tasks"]) * 100
                    print(f"📈 Progress: {progress:.1f}% ({self.statistics['completed_tasks']}/{self.statistics['total_tasks']})")
                    
                except Exception as e:
                    self.statistics["failed_tasks"] += 1
                    print(f"❌ Task failed: {e}")
        
        print("✅ Fallback training completed")
    
    def _generate_training_tasks(self) -> list:
        """Generate distributed training tasks"""
        tasks = []
        
        for epoch in range(self.config["epochs"]):
            # Data processing tasks
            for partition in range(self.config["data_partitions"]):
                task = ProcessingTask(
                    task_id=f"data_process_e{epoch}_p{partition}",
                    job_id=self.job_id,
                    function_name="cpu_intensive_task",
                    args=(),
                    kwargs={
                        "iterations": 100000,
                        "complexity": 5,
                        "epoch": epoch,
                        "partition": partition
                    },
                    priority=TaskPriority.NORMAL,
                    cpu_intensive=True,
                    estimated_duration_seconds=10
                )
                tasks.append(task)
            
            # Model training tasks (more intensive)
            for batch in range(0, 100, 10):  # Process in chunks of 10 batches
                task = ProcessingTask(
                    task_id=f"train_e{epoch}_b{batch}",
                    job_id=self.job_id,
                    function_name="ml_training_task",
                    args=(),
                    kwargs={
                        "epochs": 1,
                        "batch_size": self.config["batch_size"],
                        "model_complexity": self.config["model_complexity"],
                        "batch_start": batch
                    },
                    priority=TaskPriority.HIGH,
                    cpu_intensive=True,
                    estimated_duration_seconds=15
                )
                tasks.append(task)
            
            # Validation task
            task = ProcessingTask(
                task_id=f"validate_e{epoch}",
                job_id=self.job_id,
                function_name="cpu_intensive_task",
                args=(),
                kwargs={
                    "iterations": 50000,
                    "complexity": 3,
                    "task_type": "validation"
                },
                priority=TaskPriority.HIGH,
                cpu_intensive=True,
                estimated_duration_seconds=8
            )
            tasks.append(task)
        
        return tasks
    
    def _generate_fallback_tasks(self) -> list:
        """Generate tasks for fallback demonstration"""
        tasks = []
        
        for epoch in range(self.config["epochs"]):
            for partition in range(self.config["data_partitions"]):
                task = {
                    "task_id": f"epoch_{epoch}_partition_{partition}",
                    "epoch": epoch,
                    "partition": partition,
                    "complexity": 1000000 + (epoch * 100000),
                    "task_type": "training"
                }
                tasks.append(task)
        
        # Add some validation tasks
        for epoch in range(0, self.config["epochs"], 2):
            task = {
                "task_id": f"validation_{epoch}",
                "epoch": epoch,
                "partition": -1,
                "complexity": 500000,
                "task_type": "validation"
            }
            tasks.append(task)
        
        return tasks
    
    def _execute_simulation_task(self, task: dict) -> dict:
        """Execute a simulation task (fallback mode)"""
        start_time = time.time()
        process = psutil.Process()
        
        # Get initial CPU affinity and stats
        try:
            cpu_affinity = process.cpu_affinity()
            cpu_times_start = process.cpu_times()
        except:
            cpu_affinity = []
            cpu_times_start = None
        
        # Simulate computational work
        complexity = task["complexity"]
        result = 0
        
        # CPU-intensive computation
        for i in range(complexity):
            result += (i ** 0.5) * (i % 7)
            
            # Add some variation based on task type
            if task["task_type"] == "validation":
                result += sum(j ** 2 for j in range(min(100, i % 1000)))
        
        # Simulate memory allocation
        if task["task_type"] == "training":
            # Simulate model weights
            weights = np.random.random((1000, 1000))
            result += np.sum(weights)
            del weights
        
        execution_time = time.time() - start_time
        
        # Get final CPU stats
        try:
            cpu_times_end = process.cpu_times()
            cpu_time = ((cpu_times_end.user + cpu_times_end.system) - 
                       (cpu_times_start.user + cpu_times_start.system)) if cpu_times_start else 0
        except:
            cpu_time = 0
        
        return {
            "task_id": task["task_id"],
            "result": result,
            "execution_time": execution_time,
            "cpu_time": cpu_time,
            "cpu_affinity": cpu_affinity,
            "process_id": os.getpid()
        }
    
    def _track_task_progress(self):
        """Track progress of distributed tasks"""
        print("⏱️ Tracking task progress...")
        
        last_completed = 0
        while True:
            time.sleep(3)
            
            status = distributed_processor.get_status()
            current_completed = status["completed_tasks"]
            
            if current_completed > last_completed:
                progress = (current_completed / self.statistics["total_tasks"]) * 100
                print(f"📈 Progress: {progress:.1f}% ({current_completed}/{self.statistics['total_tasks']})")
                print(f"   Queue: {status['queue_size']}, Active: {status['active_tasks']}")
                print(f"   Throughput: {status['throughput_tasks_per_second']:.2f} tasks/sec")
                print(f"   CPU Efficiency: {status['cpu_efficiency']:.1f}%")
                
                last_completed = current_completed
            
            # Check if all tasks are done
            if (status["completed_tasks"] + status["failed_tasks"]) >= self.statistics["total_tasks"]:
                break
            
            # Timeout protection
            if time.time() - self.start_time > 300:  # 5 minutes max
                print("⏰ Training timeout reached")
                break
        
        self.statistics["completed_tasks"] = status["completed_tasks"]
        self.statistics["failed_tasks"] = status["failed_tasks"]
    
    def _process_training_results(self, results: dict):
        """Process and analyze training results"""
        print("📊 Processing training results...")
        
        completed_results = results["completed"]
        failed_results = results["failed"]
        
        if completed_results:
            # Analyze performance
            total_execution_time = sum(r["execution_time"] for r in completed_results)
            total_cpu_time = sum(r.get("cpu_time", 0) for r in completed_results)
            
            avg_execution_time = total_execution_time / len(completed_results)
            cpu_efficiency = (total_cpu_time / total_execution_time * 100) if total_execution_time > 0 else 0
            
            print(f"   ✅ Completed tasks: {len(completed_results)}")
            print(f"   ❌ Failed tasks: {len(failed_results)}")
            print(f"   ⏱️ Average execution time: {avg_execution_time:.2f}s")
            print(f"   🔧 CPU efficiency: {cpu_efficiency:.1f}%")
            
            # Store worker statistics
            worker_stats = {}
            for result in completed_results:
                worker_id = result.get("worker_id", "unknown")
                if worker_id not in worker_stats:
                    worker_stats[worker_id] = {
                        "tasks_completed": 0,
                        "total_execution_time": 0,
                        "total_cpu_time": 0,
                        "cpu_cores": result.get("cpu_cores_used", [])
                    }
                
                worker_stats[worker_id]["tasks_completed"] += 1
                worker_stats[worker_id]["total_execution_time"] += result["execution_time"]
                worker_stats[worker_id]["total_cpu_time"] += result.get("cpu_time", 0)
            
            self.statistics["worker_stats"] = worker_stats
    
    def _generate_final_report(self):
        """Generate comprehensive training report"""
        total_time = time.time() - self.start_time
        
        print("\n" + "="*80)
        print("📋 DISTRIBUTED CPU TRAINING REPORT")
        print("="*80)
        
        # Basic statistics
        print(f"🕐 Total Training Time: {total_time:.2f} seconds")
        print(f"📊 Total Tasks: {self.statistics['total_tasks']}")
        print(f"✅ Completed Tasks: {self.statistics['completed_tasks']}")
        print(f"❌ Failed Tasks: {self.statistics['failed_tasks']}")
        
        if self.statistics["total_tasks"] > 0:
            success_rate = (self.statistics["completed_tasks"] / self.statistics["total_tasks"]) * 100
            print(f"🎯 Success Rate: {success_rate:.1f}%")
        
        # Throughput analysis
        if self.statistics["completed_tasks"] > 0:
            throughput = self.statistics["completed_tasks"] / total_time
            print(f"⚡ Average Throughput: {throughput:.2f} tasks/second")
        
        # Resource utilization
        cpu_samples = self.statistics["cpu_utilization_samples"]
        memory_samples = self.statistics["memory_utilization_samples"]
        
        if cpu_samples:
            avg_cpu = sum(s["cpu_percent"] for s in cpu_samples) / len(cpu_samples)
            max_cpu = max(s["cpu_percent"] for s in cpu_samples)
            print(f"💻 CPU Utilization - Avg: {avg_cpu:.1f}%, Peak: {max_cpu:.1f}%")
        
        if memory_samples:
            avg_memory = sum(s["memory_percent"] for s in memory_samples) / len(memory_samples)
            max_memory = max(s["memory_percent"] for s in memory_samples)
            peak_memory_gb = max(s["memory_used_gb"] for s in memory_samples)
            print(f"🧠 Memory Utilization - Avg: {avg_memory:.1f}%, Peak: {max_memory:.1f}% ({peak_memory_gb:.1f}GB)")
        
        # Advanced statistics (if available)
        if self.statistics["performance_impact"]:
            impact = self.statistics["performance_impact"]
            if impact.get("status") == "calculated":
                print(f"📈 Performance Impact:")
                print(f"   CPU Impact: {impact.get('cpu_impact_percent', 0):+.1f}%")
                print(f"   Memory Impact: {impact.get('memory_impact_percent', 0):+.1f}%")
                print(f"   Efficiency Score: {impact.get('efficiency_score', 0):.1f}/100")
        
        # Worker statistics
        if self.statistics["worker_stats"]:
            print(f"👥 Worker Statistics:")
            for worker_id, stats in self.statistics["worker_stats"].items():
                if stats["tasks_completed"] > 0:
                    avg_time = stats["total_execution_time"] / stats["tasks_completed"]
                    efficiency = (stats["total_cpu_time"] / stats["total_execution_time"] * 100) if stats["total_execution_time"] > 0 else 0
                    print(f"   {worker_id}: {stats['tasks_completed']} tasks, {avg_time:.2f}s avg, {efficiency:.1f}% CPU efficiency")
        
        # Resource allocation details
        if self.statistics["resource_allocation"]:
            allocation = self.statistics["resource_allocation"]
            print(f"🔧 Resource Allocation:")
            print(f"   Total CPU Cores: {allocation.get('total_cores', 'N/A')}")
            print(f"   Allocated Cores: {allocation.get('allocated_cores', 'N/A')}")
            print(f"   Utilization: {allocation.get('utilization_percent', 0):.1f}%")
        
        # Save detailed statistics
        self._save_statistics()
        
        print("="*80)
        print("✅ Training completed successfully!")
        print("📄 Detailed statistics saved to training_statistics.json")
        print("="*80)
    
    def _save_statistics(self):
        """Save detailed statistics to file"""
        try:
            # Add summary information
            self.statistics["summary"] = {
                "total_time_seconds": time.time() - self.start_time,
                "success_rate_percent": (self.statistics["completed_tasks"] / self.statistics["total_tasks"] * 100) if self.statistics["total_tasks"] > 0 else 0,
                "average_cpu_utilization": sum(s["cpu_percent"] for s in self.statistics["cpu_utilization_samples"]) / len(self.statistics["cpu_utilization_samples"]) if self.statistics["cpu_utilization_samples"] else 0,
                "average_memory_utilization": sum(s["memory_percent"] for s in self.statistics["memory_utilization_samples"]) / len(self.statistics["memory_utilization_samples"]) if self.statistics["memory_utilization_samples"] else 0,
                "configuration": self.config,
                "system_info": {
                    "cpu_count": multiprocessing.cpu_count(),
                    "total_memory_gb": psutil.virtual_memory().total / (1024**3),
                    "platform": sys.platform
                }
            }
            
            # Save to JSON file
            with open("training_statistics.json", "w") as f:
                json.dump(self.statistics, f, indent=2, default=str)
            
            print("💾 Statistics saved to training_statistics.json")
            
        except Exception as e:
            print(f"⚠️ Failed to save statistics: {e}")

def main():
    """Main training function"""
    print("🚀 Starting Enhanced Distributed CPU Training Demo")
    print(f"💻 System: {multiprocessing.cpu_count()} CPUs, {psutil.virtual_memory().total / (1024**3):.1f}GB RAM")
    print(f"🐍 Python: {sys.version}")
    
    # Create and start trainer
    trainer = DistributedCPUTrainer("distributed_cpu_demo_" + datetime.now().strftime("%Y%m%d_%H%M%S"))
    trainer.start_training()

if __name__ == "__main__":
    main()