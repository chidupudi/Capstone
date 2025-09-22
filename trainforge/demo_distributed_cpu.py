# File: trainforge/demo_distributed_cpu.py
# Quick demonstration of enhanced distributed CPU processing

import os
import sys
import time
from pathlib import Path

def run_demo():
    """Run the distributed CPU processing demo"""
    print("🚀 TrainForge Distributed CPU Processing Demo")
    print("=" * 60)
    
    # Check if we're in the right directory
    current_dir = Path.cwd()
    if not (current_dir / "trainforge").exists():
        print("❌ Please run this script from the capstone directory")
        print(f"Current directory: {current_dir}")
        return
    
    print(f"📁 Running from: {current_dir}")
    
    # Option 1: Run the enhanced training example
    print("\n🎯 Option 1: Enhanced Training Example")
    print("This demonstrates distributed CPU processing with comprehensive statistics")
    
    example_path = current_dir / "trainforge" / "examples" / "distributed-cpu-demo" / "train.py"
    
    if example_path.exists():
        print(f"📄 Found training example at: {example_path}")
        
        response = input("\n❓ Run the enhanced training demo? (y/n): ").lower().strip()
        if response == 'y':
            print("\n🚀 Starting enhanced training demo...")
            print("⏱️ This will take 2-3 minutes to complete with comprehensive statistics")
            
            os.chdir(example_path.parent)
            os.system(f"python {example_path.name}")
            os.chdir(current_dir)
            
            # Check for generated statistics
            stats_file = example_path.parent / "training_statistics.json"
            if stats_file.exists():
                print(f"\n📊 Statistics generated at: {stats_file}")
                print("💡 You can examine the detailed performance metrics in this file")
    else:
        print(f"❌ Training example not found at: {example_path}")
    
    # Option 2: Run the test suite
    print("\n🎯 Option 2: Test Suite")
    print("This runs comprehensive tests of the distributed processing system")
    
    test_path = current_dir / "trainforge" / "tests" / "test_distributed_cpu.py"
    
    if test_path.exists():
        print(f"📄 Found test suite at: {test_path}")
        
        response = input("\n❓ Run the test suite? (y/n): ").lower().strip()
        if response == 'y':
            print("\n🧪 Starting test suite...")
            print("⏱️ This will take 3-5 minutes to run all tests including benchmarks")
            
            os.chdir(test_path.parent)
            os.system(f"python {test_path.name}")
            os.chdir(current_dir)
            
            # Check for generated benchmark results
            benchmark_file = test_path.parent / "benchmark_results.json"
            if benchmark_file.exists():
                print(f"\n📊 Benchmark results generated at: {benchmark_file}")
    else:
        print(f"❌ Test suite not found at: {test_path}")
    
    # Option 3: Show system capabilities
    print("\n🎯 Option 3: System Information")
    print("Show current system capabilities and TrainForge enhancements")
    
    response = input("\n❓ Show system information? (y/n): ").lower().strip()
    if response == 'y':
        show_system_info()
    
    print("\n" + "=" * 60)
    print("✅ Demo completed!")
    print("\n📚 What was enhanced:")
    print("  🔧 CPU Resource Manager - Intelligent CPU core allocation and monitoring")
    print("  ⚡ Distributed Processor - Multi-processing with task scheduling")
    print("  📊 Performance Statistics - Comprehensive metrics and efficiency tracking")
    print("  🎯 Resource Coordination - Integration between CPU and GPU managers")
    print("  📈 Real-time Monitoring - System performance impact analysis")
    
    print("\n🌟 Key improvements over the dummy code:")
    print("  • Real CPU core allocation with NUMA awareness")
    print("  • Task-based distributed processing")
    print("  • Performance baseline establishment and comparison")
    print("  • Resource efficiency scoring")
    print("  • Comprehensive statistics collection")
    print("  • Multi-worker coordination and load balancing")

def show_system_info():
    """Show system information and capabilities"""
    import multiprocessing
    import psutil
    import platform
    
    print("\n💻 System Information:")
    print(f"  Platform: {platform.system()} {platform.release()}")
    print(f"  Architecture: {platform.machine()}")
    print(f"  Processor: {platform.processor()}")
    print(f"  CPU Cores: {multiprocessing.cpu_count()} logical, {psutil.cpu_count(logical=False)} physical")
    
    memory = psutil.virtual_memory()
    print(f"  Memory: {memory.total / (1024**3):.1f}GB total, {memory.available / (1024**3):.1f}GB available")
    
    try:
        cpu_freq = psutil.cpu_freq()
        if cpu_freq:
            print(f"  CPU Frequency: {cpu_freq.current:.0f}MHz (max: {cpu_freq.max:.0f}MHz)")
    except:
        pass
    
    print(f"  Load Average: {psutil.getloadavg() if hasattr(psutil, 'getloadavg') else 'N/A'}")
    
    print("\n🔧 TrainForge Enhancements:")
    print("  ✅ CPU Resource Manager - Advanced CPU allocation and monitoring")
    print("  ✅ Distributed Processor - Multi-processing task execution")
    print("  ✅ Performance Statistics - Real-time metrics collection")
    print("  ✅ Resource Coordination - Unified resource management")
    print("  ✅ Efficiency Scoring - Performance impact analysis")
    
    # Try to show advanced info if modules are available
    try:
        sys.path.append(str(Path.cwd() / "trainforge" / "scheduler" / "src"))
        
        from cpu_manager import cpu_manager
        cpu_status = cpu_manager.get_cpu_status()
        
        print("\n📊 Current CPU Manager Status:")
        print(f"  Total Cores: {cpu_status['total_cores']}")
        print(f"  Available Cores: {cpu_status['available_cores']}")
        print(f"  Memory: {cpu_status['total_memory_gb']:.1f}GB total")
        print(f"  Active Jobs: {cpu_status['active_jobs']}")
        
        if cpu_status.get('performance_impact'):
            impact = cpu_status['performance_impact']
            if impact.get('status') == 'calculated':
                print(f"  Efficiency Score: {impact.get('efficiency_score', 0):.1f}/100")
        
    except Exception as e:
        print(f"\n⚠️ Could not load advanced CPU manager info: {e}")
        print("💡 Run from the trainforge directory for full functionality")

if __name__ == "__main__":
    run_demo()