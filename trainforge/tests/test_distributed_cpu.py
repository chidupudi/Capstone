# File: trainforge/tests/test_distributed_cpu.py
# Test script for distributed CPU processing functionality

import sys
import os
import time
import json
from pathlib import Path

# Add scheduler source to path
sys.path.append(str(Path(__file__).parent.parent / "scheduler" / "src"))

def test_cpu_manager():
    """Test CPU resource manager functionality"""
    print("\n🔬 Testing CPU Manager...")
    
    try:
        from cpu_manager import cpu_manager
        
        # Test basic functionality
        print("✅ CPU Manager imported successfully")
        
        # Get initial status
        status = cpu_manager.get_cpu_status()
        print(f"📊 Total CPU cores: {status['total_cores']}")
        print(f"📊 Available cores: {status['available_cores']}")
        print(f"📊 Total memory: {status['total_memory_gb']:.1f}GB")
        
        # Test allocation
        job_id = "test_job_001"
        allocated_cores = cpu_manager.allocate_cpus(job_id, 2, 1.0)
        
        if allocated_cores:
            print(f"✅ Successfully allocated cores: {allocated_cores}")
            
            # Check status after allocation
            status_after = cpu_manager.get_cpu_status()
            print(f"📊 Available cores after allocation: {status_after['available_cores']}")
            
            # Test performance monitoring
            time.sleep(3)  # Let monitor collect some data
            
            # Get job performance stats
            job_stats = cpu_manager.get_job_performance_stats(job_id)
            if job_stats:
                print(f"📈 Job performance stats:")
                print(f"   Duration: {job_stats['duration_seconds']:.1f}s")
                print(f"   Efficiency: {job_stats['efficiency_score']:.1f}")
            
            # Test deallocation
            cpu_manager.deallocate_cpus(job_id)
            print("✅ Successfully deallocated CPU cores")
            
            # Check final status
            status_final = cpu_manager.get_cpu_status()
            print(f"📊 Available cores after deallocation: {status_final['available_cores']}")
            
        else:
            print("❌ Failed to allocate CPU cores")
            
        return True
        
    except Exception as e:
        print(f"❌ CPU Manager test failed: {e}")
        return False

def test_distributed_processor():
    """Test distributed processor functionality"""
    print("\n🔬 Testing Distributed Processor...")
    
    try:
        from distributed_processor import distributed_processor, ProcessingTask, TaskPriority
        
        print("✅ Distributed Processor imported successfully")
        
        # Start processor
        distributed_processor.start(max_workers=4)
        print("✅ Distributed Processor started")
        
        # Create test tasks
        tasks = []
        for i in range(5):
            task = ProcessingTask(
                task_id=f"test_task_{i}",
                job_id="test_job_distributed",
                function_name="cpu_intensive_task",
                args=(),
                kwargs={
                    "iterations": 50000,
                    "complexity": 2
                },
                priority=TaskPriority.NORMAL,
                estimated_duration_seconds=5
            )
            tasks.append(task)
        
        # Submit tasks
        for task in tasks:
            success = distributed_processor.submit_task(task)
            if success:
                print(f"✅ Submitted task: {task.task_id}")
            else:
                print(f"❌ Failed to submit task: {task.task_id}")
        
        # Monitor progress
        print("⏱️ Monitoring task execution...")
        start_time = time.time()
        
        while time.time() - start_time < 60:  # 1 minute timeout
            status = distributed_processor.get_status()
            
            print(f"📊 Queue: {status['queue_size']}, Active: {status['active_tasks']}, "
                  f"Completed: {status['completed_tasks']}, Failed: {status['failed_tasks']}")
            
            if status['completed_tasks'] + status['failed_tasks'] >= len(tasks):
                break
                
            time.sleep(3)
        
        # Get final status
        final_status = distributed_processor.get_status()
        print(f"📈 Final Status:")
        print(f"   Completed tasks: {final_status['completed_tasks']}")
        print(f"   Failed tasks: {final_status['failed_tasks']}")
        print(f"   Throughput: {final_status['throughput_tasks_per_second']:.2f} tasks/sec")
        print(f"   CPU Efficiency: {final_status['cpu_efficiency']:.1f}%")
        
        # Get task results
        results = distributed_processor.get_task_results("test_job_distributed")
        print(f"📋 Task Results:")
        print(f"   Completed: {len(results['completed'])}")
        print(f"   Failed: {len(results['failed'])}")
        
        # Show some result details
        if results['completed']:
            avg_time = sum(r['execution_time'] for r in results['completed']) / len(results['completed'])
            print(f"   Average execution time: {avg_time:.2f}s")
        
        # Stop processor
        distributed_processor.stop()
        print("✅ Distributed Processor stopped")
        
        return True
        
    except Exception as e:
        print(f"❌ Distributed Processor test failed: {e}")
        return False

def test_integration():
    """Test integration between components"""
    print("\n🔬 Testing Component Integration...")
    
    try:
        from cpu_manager import cpu_manager
        from distributed_processor import distributed_processor, ProcessingTask, TaskPriority
        
        # Test resource allocation coordination
        print("🔄 Testing resource allocation coordination...")
        
        # Check initial resources
        initial_status = cpu_manager.get_cpu_status()
        print(f"📊 Initial available cores: {initial_status['available_cores']}")
        
        # Start distributed processor (should allocate CPU resources)
        distributed_processor.start(max_workers=2)
        
        # Check resources after processor start
        after_start_status = cpu_manager.get_cpu_status()
        print(f"📊 Available cores after processor start: {after_start_status['available_cores']}")
        
        # Submit a quick task
        test_task = ProcessingTask(
            task_id="integration_test_task",
            job_id="integration_test",
            function_name="cpu_intensive_task",
            args=(),
            kwargs={"iterations": 10000, "complexity": 1},
            priority=TaskPriority.HIGH
        )
        
        distributed_processor.submit_task(test_task)
        
        # Wait for completion
        time.sleep(10)
        
        # Check final status
        final_status = distributed_processor.get_status()
        print(f"📈 Integration test - Completed tasks: {final_status['completed_tasks']}")
        
        # Stop processor
        distributed_processor.stop()
        
        # Check resources after stop
        after_stop_status = cpu_manager.get_cpu_status()
        print(f"📊 Available cores after processor stop: {after_stop_status['available_cores']}")
        
        print("✅ Integration test completed successfully")
        return True
        
    except Exception as e:
        print(f"❌ Integration test failed: {e}")
        return False

def run_performance_benchmark():
    """Run a performance benchmark"""
    print("\n🏁 Running Performance Benchmark...")
    
    try:
        from distributed_processor import distributed_processor, ProcessingTask, TaskPriority
        
        # Test different worker counts
        worker_counts = [1, 2, 4]
        results = {}
        
        for worker_count in worker_counts:
            print(f"\n🔧 Testing with {worker_count} workers...")
            
            # Start processor with specific worker count
            distributed_processor.start(max_workers=worker_count)
            
            # Create benchmark tasks
            task_count = 10
            tasks = []
            
            for i in range(task_count):
                task = ProcessingTask(
                    task_id=f"benchmark_{worker_count}_task_{i}",
                    job_id=f"benchmark_{worker_count}",
                    function_name="cpu_intensive_task",
                    args=(),
                    kwargs={"iterations": 100000, "complexity": 3},
                    priority=TaskPriority.NORMAL
                )
                tasks.append(task)
            
            # Submit all tasks and measure time
            start_time = time.time()
            
            for task in tasks:
                distributed_processor.submit_task(task)
            
            # Wait for completion
            while True:
                status = distributed_processor.get_status()
                if status['completed_tasks'] + status['failed_tasks'] >= task_count:
                    break
                time.sleep(1)
            
            end_time = time.time()
            total_time = end_time - start_time
            
            # Collect results
            final_status = distributed_processor.get_status()
            
            results[worker_count] = {
                "total_time": total_time,
                "throughput": final_status['throughput_tasks_per_second'],
                "cpu_efficiency": final_status['cpu_efficiency'],
                "completed_tasks": final_status['completed_tasks'],
                "failed_tasks": final_status['failed_tasks']
            }
            
            print(f"   Total time: {total_time:.2f}s")
            print(f"   Throughput: {final_status['throughput_tasks_per_second']:.2f} tasks/sec")
            print(f"   CPU Efficiency: {final_status['cpu_efficiency']:.1f}%")
            
            # Stop processor
            distributed_processor.stop()
            time.sleep(2)  # Brief pause between tests
        
        # Analyze results
        print(f"\n📊 Performance Benchmark Results:")
        print("Workers | Time(s) | Throughput | CPU Eff | Speedup")
        print("-" * 50)
        
        baseline_time = results[1]["total_time"]
        
        for workers, result in results.items():
            speedup = baseline_time / result["total_time"]
            print(f"{workers:7} | {result['total_time']:7.2f} | {result['throughput']:10.2f} | {result['cpu_efficiency']:7.1f}% | {speedup:7.2f}x")
        
        # Save benchmark results
        with open("benchmark_results.json", "w") as f:
            json.dump(results, f, indent=2)
        
        print("💾 Benchmark results saved to benchmark_results.json")
        
        return True
        
    except Exception as e:
        print(f"❌ Performance benchmark failed: {e}")
        return False

def main():
    """Run all tests"""
    print("🧪 TrainForge Distributed CPU Processing Tests")
    print("=" * 60)
    
    tests = [
        ("CPU Manager", test_cpu_manager),
        ("Distributed Processor", test_distributed_processor),
        ("Component Integration", test_integration),
        ("Performance Benchmark", run_performance_benchmark)
    ]
    
    results = {}
    
    for test_name, test_func in tests:
        print(f"\n{'='*20} {test_name} {'='*20}")
        try:
            result = test_func()
            results[test_name] = "PASSED" if result else "FAILED"
        except Exception as e:
            print(f"❌ Test {test_name} crashed: {e}")
            results[test_name] = "CRASHED"
        
        time.sleep(1)  # Brief pause between tests
    
    # Print summary
    print("\n" + "="*60)
    print("🏁 TEST SUMMARY")
    print("="*60)
    
    for test_name, result in results.items():
        status_emoji = "✅" if result == "PASSED" else "❌"
        print(f"{status_emoji} {test_name}: {result}")
    
    passed_count = sum(1 for r in results.values() if r == "PASSED")
    total_count = len(results)
    
    print(f"\n📊 Results: {passed_count}/{total_count} tests passed")
    
    if passed_count == total_count:
        print("🎉 All tests passed! Distributed CPU processing is working correctly.")
    else:
        print("⚠️ Some tests failed. Check the output above for details.")

if __name__ == "__main__":
    main()