# File: trainforge/examples/distributed-ml-pipeline/demo.py
# Simple demonstration of distributed processing vs sequential processing

import time
import multiprocessing
import numpy as np
from concurrent.futures import ProcessPoolExecutor
import psutil
import os

def cpu_intensive_task(task_info):
    """Simulate CPU-intensive machine learning computation"""
    task_id, data_size, complexity = task_info
    
    start_time = time.time()
    process_id = os.getpid()
    
    # Simulate data processing
    np.random.seed(task_id)
    data = np.random.random((data_size, complexity))
    
    # Simulate feature extraction (matrix operations)
    features = np.dot(data.T, data)  # Computationally expensive
    
    # Simulate model training (iterative optimization)
    weights = np.random.random(complexity)
    for iteration in range(50):
        gradient = np.dot(features, weights)
        weights -= 0.01 * gradient / np.linalg.norm(gradient)
    
    # Simulate model evaluation
    predictions = np.dot(data, weights)
    accuracy = np.mean(predictions > 0.5)
    
    execution_time = time.time() - start_time
    
    return {
        "task_id": task_id,
        "process_id": process_id,
        "execution_time": execution_time,
        "accuracy": accuracy,
        "data_processed": data_size * complexity
    }

def run_sequential_processing():
    """Run tasks sequentially (old way)"""
    print("\n🐌 SEQUENTIAL PROCESSING (Old Way)")
    print("-" * 50)
    
    tasks = [(i, 500, 100) for i in range(8)]  # 8 tasks
    
    start_time = time.time()
    initial_cpu = psutil.cpu_percent(interval=0.1)
    
    results = []
    for task in tasks:
        result = cpu_intensive_task(task)
        results.append(result)
        progress = len(results) / len(tasks) * 100
        print(f"Task {result['task_id']} completed in {result['execution_time']:.2f}s (Progress: {progress:.0f}%)")
    
    total_time = time.time() - start_time
    final_cpu = psutil.cpu_percent(interval=0.1)
    
    print(f"\n📊 Sequential Results:")
    print(f"   Total time: {total_time:.2f}s")
    print(f"   Average task time: {np.mean([r['execution_time'] for r in results]):.2f}s")
    print(f"   CPU usage: {initial_cpu:.1f}% → {final_cpu:.1f}%")
    print(f"   Tasks completed: {len(results)}")
    print(f"   Process IDs used: {set(r['process_id'] for r in results)}")
    
    return total_time, results

def run_distributed_processing():
    """Run tasks with distributed processing (new way)"""
    print("\n🚀 DISTRIBUTED PROCESSING (Enhanced Way)")
    print("-" * 50)
    
    tasks = [(i, 500, 100) for i in range(8)]  # Same 8 tasks
    max_workers = min(multiprocessing.cpu_count(), 4)
    
    start_time = time.time()
    initial_cpu = psutil.cpu_percent(interval=0.1)
    
    results = []
    with ProcessPoolExecutor(max_workers=max_workers) as executor:
        # Submit all tasks
        future_to_task = {executor.submit(cpu_intensive_task, task): task for task in tasks}
        
        # Collect results as they complete
        for future in future_to_task:
            result = future.result()
            results.append(result)
            progress = len(results) / len(tasks) * 100
            print(f"Task {result['task_id']} completed in {result['execution_time']:.2f}s (Progress: {progress:.0f}%) [PID: {result['process_id']}]")
    
    total_time = time.time() - start_time
    final_cpu = psutil.cpu_percent(interval=0.1)
    
    print(f"\n📊 Distributed Results:")
    print(f"   Total time: {total_time:.2f}s")
    print(f"   Average task time: {np.mean([r['execution_time'] for r in results]):.2f}s")
    print(f"   CPU usage: {initial_cpu:.1f}% → {final_cpu:.1f}%")
    print(f"   Tasks completed: {len(results)}")
    print(f"   Process IDs used: {set(r['process_id'] for r in results)}")
    print(f"   Workers used: {max_workers}")
    
    return total_time, results

def run_performance_comparison():
    """Compare sequential vs distributed processing"""
    print("="*80)
    print("🧪 MACHINE LEARNING PROCESSING COMPARISON")
    print("="*80)
    
    print(f"💻 System Information:")
    print(f"   CPU cores: {multiprocessing.cpu_count()}")
    print(f"   Memory: {psutil.virtual_memory().total / (1024**3):.1f}GB")
    print(f"   Platform: {os.name}")
    
    # Run sequential processing
    sequential_time, sequential_results = run_sequential_processing()
    
    # Brief pause
    time.sleep(2)
    
    # Run distributed processing  
    distributed_time, distributed_results = run_distributed_processing()
    
    # Calculate improvements
    speedup = sequential_time / distributed_time
    efficiency = speedup / min(multiprocessing.cpu_count(), 4)
    
    print("\n" + "="*80)
    print("📈 PERFORMANCE COMPARISON RESULTS")
    print("="*80)
    
    print(f"Sequential Processing Time:  {sequential_time:.2f}s")
    print(f"Distributed Processing Time: {distributed_time:.2f}s")
    print(f"Speedup: {speedup:.2f}x faster")
    print(f"Efficiency: {efficiency:.1%}")
    
    # Accuracy comparison
    seq_accuracy = np.mean([r['accuracy'] for r in sequential_results])
    dist_accuracy = np.mean([r['accuracy'] for r in distributed_results])
    
    print(f"\nAccuracy Comparison:")
    print(f"Sequential: {seq_accuracy:.3f}")
    print(f"Distributed: {dist_accuracy:.3f}")
    print(f"Difference: {abs(seq_accuracy - dist_accuracy):.3f}")
    
    print(f"\n🎯 Key Improvements:")
    print(f"   ✅ {speedup:.1f}x faster execution")
    print(f"   ✅ Better CPU utilization")
    print(f"   ✅ Parallel processing across {len(set(r['process_id'] for r in distributed_results))} processes")
    print(f"   ✅ Same accuracy maintained")
    
    if speedup > 1.5:
        print(f"   🌟 Excellent speedup achieved!")
    elif speedup > 1.2:
        print(f"   ✅ Good speedup achieved!")
    else:
        print(f"   ⚠️ Limited speedup - may need more CPU-intensive tasks")

def run_resource_monitoring_demo():
    """Demonstrate real-time resource monitoring"""
    print("\n" + "="*80)
    print("📊 REAL-TIME RESOURCE MONITORING DEMO")
    print("="*80)
    
    def monitor_resources(duration=10):
        """Monitor system resources"""
        print(f"Monitoring system resources for {duration} seconds...")
        print("Time   | CPU%  | Memory% | Load Avg")
        print("-" * 40)
        
        start_time = time.time()
        while time.time() - start_time < duration:
            cpu_percent = psutil.cpu_percent(interval=1)
            memory_percent = psutil.virtual_memory().percent
            
            try:
                load_avg = psutil.getloadavg()[0] if hasattr(psutil, 'getloadavg') else 0
            except:
                load_avg = 0
            
            elapsed = time.time() - start_time
            print(f"{elapsed:5.1f}s | {cpu_percent:5.1f} | {memory_percent:7.1f} | {load_avg:8.2f}")
    
    # Start resource monitoring in background
    import threading
    
    print("Starting background resource monitoring...")
    monitor_thread = threading.Thread(target=monitor_resources, args=(15,))
    monitor_thread.daemon = True
    monitor_thread.start()
    
    # Run a CPU-intensive task while monitoring
    print("\nRunning CPU-intensive distributed task...")
    
    tasks = [(i, 300, 80) for i in range(6)]
    with ProcessPoolExecutor(max_workers=3) as executor:
        results = list(executor.map(cpu_intensive_task, tasks))
    
    print(f"\nCompleted {len(results)} tasks with distributed processing")
    print("Resource monitoring will continue for a few more seconds...")
    
    # Wait for monitoring to complete
    monitor_thread.join()

def main():
    """Main demonstration"""
    print("🤖 Enhanced TrainForge Distributed Processing Demo")
    print("This demo shows real distributed CPU processing for ML tasks")
    
    # Run the main comparison
    run_performance_comparison()
    
    # Run resource monitoring demo
    run_resource_monitoring_demo()
    
    print("\n" + "="*80)
    print("✅ Demo completed! Key takeaways:")
    print("   🚀 Distributed processing provides significant speedup")
    print("   📊 Real-time monitoring shows actual resource usage")
    print("   🔧 Multiple processes utilized efficiently")
    print("   🎯 Same computational accuracy maintained")
    print("="*80)

if __name__ == "__main__":
    main()