# File: trainforge/scheduler/src/cpu_manager.py
# CPU resource discovery, allocation, and management for distributed processing

import psutil
import threading
import time
import multiprocessing
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, asdict
from enum import Enum
import subprocess
import platform
import json
from datetime import datetime, timedelta

class CPUStatus(Enum):
    AVAILABLE = "available"
    ALLOCATED = "allocated"
    BUSY = "busy"
    OVERLOADED = "overloaded"

@dataclass
class CPUCoreInfo:
    """Individual CPU core information"""
    core_id: int
    usage_percent: float
    frequency_mhz: float
    temperature: Optional[float] = None
    allocated_to: Optional[str] = None
    status: CPUStatus = CPUStatus.AVAILABLE

@dataclass
class CPUNodeInfo:
    """CPU node/socket information"""
    node_id: int
    cores: List[CPUCoreInfo]
    total_cores: int
    available_cores: int
    memory_gb: float
    memory_used_gb: float
    memory_available_gb: float
    cache_l3_kb: int
    architecture: str
    status: CPUStatus = CPUStatus.AVAILABLE

@dataclass
class CPUAllocation:
    """CPU allocation record for a job"""
    job_id: str
    allocated_cores: List[int]
    allocated_memory_gb: float
    node_ids: List[int]
    allocated_at: float
    worker_node: str
    process_affinity: bool = True
    priority: int = 0

@dataclass
class CPUMetrics:
    """CPU performance metrics"""
    timestamp: float
    cpu_usage_percent: float
    memory_usage_percent: float
    load_average: Tuple[float, float, float]
    context_switches: int
    interrupts: int
    processes_running: int
    processes_total: int
    io_wait_percent: float
    steal_time_percent: float

class CPUResourceManager:
    """Manages CPU resources across the cluster with detailed monitoring"""
    
    def __init__(self):
        self.nodes: Dict[int, CPUNodeInfo] = {}
        self.allocations: Dict[str, CPUAllocation] = {}
        self.metrics_history: List[CPUMetrics] = []
        self.lock = threading.Lock()
        self.monitoring = True
        self.monitor_thread = None
        
        # Performance tracking
        self.allocation_history = []
        self.performance_baseline = None
        
        # Initialize CPU discovery
        self._discover_cpu_topology()
        
        # Start monitoring thread
        self.start_monitoring()
    
    def _discover_cpu_topology(self):
        """Discover CPU topology and capabilities"""
        try:
            # Get basic CPU info
            cpu_count = psutil.cpu_count(logical=True)
            physical_cores = psutil.cpu_count(logical=False)
            
            print(f"🔍 Discovering CPU topology...")
            print(f"   Logical CPUs: {cpu_count}")
            print(f"   Physical cores: {physical_cores}")
            print(f"   Architecture: {platform.machine()}")
            print(f"   Processor: {platform.processor()}")
            
            # Get CPU frequencies
            try:
                cpu_freq = psutil.cpu_freq()
                if cpu_freq:
                    print(f"   Base frequency: {cpu_freq.current:.0f} MHz")
                    print(f"   Max frequency: {cpu_freq.max:.0f} MHz")
            except:
                cpu_freq = None
            
            # Get memory info
            memory = psutil.virtual_memory()
            memory_gb = memory.total / (1024**3)
            
            # Create CPU nodes (simulate NUMA topology for demo)
            nodes_count = max(1, physical_cores // 4)  # Assume 4 cores per node
            cores_per_node = cpu_count // nodes_count
            
            for node_id in range(nodes_count):
                cores = []
                start_core = node_id * cores_per_node
                end_core = min(start_core + cores_per_node, cpu_count)
                
                for core_id in range(start_core, end_core):
                    core_freq = cpu_freq.current if cpu_freq else 2400.0
                    core_info = CPUCoreInfo(
                        core_id=core_id,
                        usage_percent=0.0,
                        frequency_mhz=core_freq,
                        status=CPUStatus.AVAILABLE
                    )
                    cores.append(core_info)
                
                node_info = CPUNodeInfo(
                    node_id=node_id,
                    cores=cores,
                    total_cores=len(cores),
                    available_cores=len(cores),
                    memory_gb=memory_gb / nodes_count,
                    memory_used_gb=0.0,
                    memory_available_gb=memory_gb / nodes_count,
                    cache_l3_kb=8192,  # Mock L3 cache size
                    architecture=platform.machine(),
                    status=CPUStatus.AVAILABLE
                )
                
                self.nodes[node_id] = node_info
                print(f"   Node {node_id}: {len(cores)} cores, {memory_gb/nodes_count:.1f}GB RAM")
            
            # Establish performance baseline
            self._establish_baseline()
            
        except Exception as e:
            print(f"❌ CPU discovery failed: {e}")
            self._create_mock_cpu_topology()
    
    def _create_mock_cpu_topology(self):
        """Create mock CPU topology for demonstration"""
        print("💡 Creating mock CPU topology for demo")
        
        # Create 2 mock nodes with different configurations
        mock_nodes = [
            {"cores": 8, "memory": 16.0, "cache": 16384},
            {"cores": 6, "memory": 12.0, "cache": 12288}
        ]
        
        for node_id, node_config in enumerate(mock_nodes):
            cores = []
            for core_id in range(node_config["cores"]):
                core_info = CPUCoreInfo(
                    core_id=core_id + (node_id * 8),
                    usage_percent=5.0,  # Mock idle usage
                    frequency_mhz=2800.0,
                    status=CPUStatus.AVAILABLE
                )
                cores.append(core_info)
            
            node_info = CPUNodeInfo(
                node_id=node_id,
                cores=cores,
                total_cores=node_config["cores"],
                available_cores=node_config["cores"],
                memory_gb=node_config["memory"],
                memory_used_gb=1.0,  # Mock system usage
                memory_available_gb=node_config["memory"] - 1.0,
                cache_l3_kb=node_config["cache"],
                architecture="x86_64",
                status=CPUStatus.AVAILABLE
            )
            
            self.nodes[node_id] = node_info
            print(f"   Mock Node {node_id}: {node_config['cores']} cores, {node_config['memory']}GB RAM")
    
    def _establish_baseline(self):
        """Establish performance baseline for comparison"""
        try:
            # Collect baseline metrics
            baseline_samples = []
            for _ in range(5):  # Collect 5 samples over 10 seconds
                metrics = self._collect_system_metrics()
                baseline_samples.append(metrics)
                time.sleep(2)
            
            # Calculate baseline averages
            if baseline_samples:
                self.performance_baseline = {
                    "cpu_usage": sum(m.cpu_usage_percent for m in baseline_samples) / len(baseline_samples),
                    "memory_usage": sum(m.memory_usage_percent for m in baseline_samples) / len(baseline_samples),
                    "load_average": tuple(sum(m.load_average[i] for m in baseline_samples) / len(baseline_samples) for i in range(3)),
                    "context_switches": sum(m.context_switches for m in baseline_samples) / len(baseline_samples),
                    "timestamp": time.time()
                }
                
                print(f"📊 Performance baseline established:")
                print(f"   CPU usage: {self.performance_baseline['cpu_usage']:.1f}%")
                print(f"   Memory usage: {self.performance_baseline['memory_usage']:.1f}%")
                print(f"   Load average: {self.performance_baseline['load_average']}")
                
        except Exception as e:
            print(f"⚠️ Failed to establish baseline: {e}")
    
    def start_monitoring(self):
        """Start CPU monitoring thread"""
        if self.monitor_thread is None or not self.monitor_thread.is_alive():
            self.monitor_thread = threading.Thread(target=self._monitor_cpus, daemon=True)
            self.monitor_thread.start()
            print("📊 CPU monitoring started")
    
    def stop_monitoring(self):
        """Stop CPU monitoring"""
        self.monitoring = False
        if self.monitor_thread and self.monitor_thread.is_alive():
            self.monitor_thread.join()
        print("🛑 CPU monitoring stopped")
    
    def _monitor_cpus(self):
        """Monitor CPU status and update information"""
        while self.monitoring:
            try:
                with self.lock:
                    self._update_cpu_status()
                    self._collect_and_store_metrics()
                time.sleep(2)  # Update every 2 seconds for responsive monitoring
            except Exception as e:
                print(f"⚠️ CPU monitoring error: {e}")
                time.sleep(5)
    
    def _update_cpu_status(self):
        """Update CPU status from system"""
        try:
            # Get per-CPU usage
            cpu_percentages = psutil.cpu_percent(percpu=True, interval=None)
            
            # Get memory info
            memory = psutil.virtual_memory()
            memory_used_gb = memory.used / (1024**3)
            
            # Update each node
            for node_id, node in self.nodes.items():
                node_memory_usage = memory_used_gb / len(self.nodes)
                node.memory_used_gb = node_memory_usage
                node.memory_available_gb = node.memory_gb - node_memory_usage
                
                # Update core usage
                available_cores = 0
                for core in node.cores:
                    if core.core_id < len(cpu_percentages):
                        core.usage_percent = cpu_percentages[core.core_id]
                    else:
                        # Mock data for cores beyond system cores
                        import random
                        if core.allocated_to:
                            core.usage_percent = random.uniform(70, 95)
                        else:
                            core.usage_percent = random.uniform(2, 15)
                    
                    # Update core status
                    if core.allocated_to:
                        core.status = CPUStatus.ALLOCATED
                    elif core.usage_percent > 90:
                        core.status = CPUStatus.OVERLOADED
                    elif core.usage_percent > 70:
                        core.status = CPUStatus.BUSY
                    else:
                        core.status = CPUStatus.AVAILABLE
                        available_cores += 1
                
                # Update node status
                node.available_cores = available_cores
                if available_cores == 0:
                    node.status = CPUStatus.OVERLOADED
                elif available_cores < node.total_cores * 0.3:
                    node.status = CPUStatus.BUSY
                else:
                    node.status = CPUStatus.AVAILABLE
                    
        except Exception as e:
            print(f"❌ Failed to update CPU status: {e}")
    
    def _collect_system_metrics(self) -> CPUMetrics:
        """Collect comprehensive system metrics"""
        try:
            # CPU metrics
            cpu_usage = psutil.cpu_percent(interval=0.1)
            
            # Memory metrics
            memory = psutil.virtual_memory()
            memory_usage = memory.percent
            
            # Load average
            load_avg = psutil.getloadavg() if hasattr(psutil, 'getloadavg') else (0, 0, 0)
            
            # CPU times for advanced metrics
            cpu_times = psutil.cpu_times()
            
            # Process metrics
            processes = list(psutil.process_iter(['pid', 'status']))
            running_processes = len([p for p in processes if p.info['status'] == 'running'])
            
            # System stats
            try:
                boot_time = psutil.boot_time()
                current_time = time.time()
                uptime = current_time - boot_time
            except:
                uptime = 0
            
            return CPUMetrics(
                timestamp=time.time(),
                cpu_usage_percent=cpu_usage,
                memory_usage_percent=memory_usage,
                load_average=load_avg,
                context_switches=getattr(cpu_times, 'ctx_switches', 0),
                interrupts=getattr(cpu_times, 'interrupts', 0),
                processes_running=running_processes,
                processes_total=len(processes),
                io_wait_percent=getattr(cpu_times, 'iowait', 0),
                steal_time_percent=getattr(cpu_times, 'steal', 0)
            )
            
        except Exception as e:
            print(f"⚠️ Error collecting metrics: {e}")
            return CPUMetrics(
                timestamp=time.time(),
                cpu_usage_percent=0,
                memory_usage_percent=0,
                load_average=(0, 0, 0),
                context_switches=0,
                interrupts=0,
                processes_running=0,
                processes_total=0,
                io_wait_percent=0,
                steal_time_percent=0
            )
    
    def _collect_and_store_metrics(self):
        """Collect and store metrics in history"""
        metrics = self._collect_system_metrics()
        self.metrics_history.append(metrics)
        
        # Keep only last 1000 metrics (about 30 minutes at 2s intervals)
        if len(self.metrics_history) > 1000:
            self.metrics_history = self.metrics_history[-1000:]
    
    def allocate_cpus(self, job_id: str, num_cores: int, memory_gb: float = 1.0, 
                     priority: int = 0, prefer_same_node: bool = True) -> Optional[List[int]]:
        """Allocate CPU cores for a job"""
        with self.lock:
            if num_cores <= 0:
                print(f"❌ Invalid core count: {num_cores}")
                return None
            
            # Find best allocation strategy
            allocation_plan = self._find_optimal_allocation(num_cores, memory_gb, prefer_same_node)
            
            if not allocation_plan:
                print(f"❌ Cannot allocate {num_cores} cores with {memory_gb}GB memory")
                return None
            
            # Execute allocation
            allocated_cores = []
            allocated_nodes = []
            
            for node_id, core_count in allocation_plan.items():
                node = self.nodes[node_id]
                allocated_in_node = 0
                
                for core in node.cores:
                    if (core.status == CPUStatus.AVAILABLE and 
                        allocated_in_node < core_count):
                        core.status = CPUStatus.ALLOCATED
                        core.allocated_to = job_id
                        allocated_cores.append(core.core_id)
                        allocated_in_node += 1
                
                if allocated_in_node > 0:
                    allocated_nodes.append(node_id)
                    node.available_cores -= allocated_in_node
                    node.memory_available_gb -= memory_gb / len(allocation_plan)
            
            # Record allocation
            allocation = CPUAllocation(
                job_id=job_id,
                allocated_cores=allocated_cores,
                allocated_memory_gb=memory_gb,
                node_ids=allocated_nodes,
                allocated_at=time.time(),
                worker_node="localhost",
                priority=priority
            )
            
            self.allocations[job_id] = allocation
            self.allocation_history.append({
                "job_id": job_id,
                "cores": len(allocated_cores),
                "memory_gb": memory_gb,
                "timestamp": time.time(),
                "nodes": allocated_nodes
            })
            
            print(f"✅ Allocated {len(allocated_cores)} CPU cores to job {job_id}")
            print(f"   Cores: {allocated_cores}")
            print(f"   Nodes: {allocated_nodes}")
            print(f"   Memory: {memory_gb}GB")
            
            return allocated_cores
    
    def _find_optimal_allocation(self, num_cores: int, memory_gb: float, 
                               prefer_same_node: bool) -> Optional[Dict[int, int]]:
        """Find optimal CPU allocation across nodes"""
        
        # Strategy 1: Single node allocation (preferred for performance)
        if prefer_same_node:
            for node_id, node in self.nodes.items():
                if (node.available_cores >= num_cores and 
                    node.memory_available_gb >= memory_gb):
                    return {node_id: num_cores}
        
        # Strategy 2: Multi-node allocation
        allocation_plan = {}
        remaining_cores = num_cores
        remaining_memory = memory_gb
        
        # Sort nodes by available resources
        sorted_nodes = sorted(
            self.nodes.items(),
            key=lambda x: (x[1].available_cores, x[1].memory_available_gb),
            reverse=True
        )
        
        for node_id, node in sorted_nodes:
            if remaining_cores <= 0:
                break
                
            # Calculate allocation for this node
            cores_from_node = min(remaining_cores, node.available_cores)
            memory_from_node = min(remaining_memory, node.memory_available_gb)
            
            if cores_from_node > 0 and memory_from_node > 0:
                allocation_plan[node_id] = cores_from_node
                remaining_cores -= cores_from_node
                remaining_memory -= memory_from_node
        
        if remaining_cores > 0:
            return None  # Cannot satisfy request
        
        return allocation_plan
    
    def deallocate_cpus(self, job_id: str):
        """Deallocate CPU cores from a job"""
        with self.lock:
            if job_id not in self.allocations:
                print(f"⚠️ No CPU allocation found for job {job_id}")
                return
            
            allocation = self.allocations[job_id]
            
            # Free cores
            for node_id, node in self.nodes.items():
                freed_cores = 0
                for core in node.cores:
                    if core.allocated_to == job_id:
                        core.status = CPUStatus.AVAILABLE
                        core.allocated_to = None
                        freed_cores += 1
                
                if freed_cores > 0:
                    node.available_cores += freed_cores
                    node.memory_available_gb += allocation.allocated_memory_gb / len(allocation.node_ids)
            
            # Remove allocation record
            del self.allocations[job_id]
            
            print(f"🔄 Deallocated {len(allocation.allocated_cores)} CPU cores from job {job_id}")
    
    def get_cpu_status(self) -> Dict[str, Any]:
        """Get overall CPU cluster status"""
        with self.lock:
            total_cores = sum(node.total_cores for node in self.nodes.values())
            available_cores = sum(node.available_cores for node in self.nodes.values())
            allocated_cores = total_cores - available_cores
            
            total_memory = sum(node.memory_gb for node in self.nodes.values())
            available_memory = sum(node.memory_available_gb for node in self.nodes.values())
            
            # Calculate performance impact
            current_metrics = self.metrics_history[-1] if self.metrics_history else None
            performance_impact = self._calculate_performance_impact()
            
            return {
                "total_cores": total_cores,
                "available_cores": available_cores,
                "allocated_cores": allocated_cores,
                "utilization_percent": (allocated_cores / total_cores * 100) if total_cores > 0 else 0,
                "total_memory_gb": total_memory,
                "available_memory_gb": available_memory,
                "memory_utilization_percent": ((total_memory - available_memory) / total_memory * 100) if total_memory > 0 else 0,
                "active_jobs": len(self.allocations),
                "performance_impact": performance_impact,
                "current_metrics": asdict(current_metrics) if current_metrics else None,
                "nodes": {
                    node_id: {
                        "total_cores": node.total_cores,
                        "available_cores": node.available_cores,
                        "memory_gb": node.memory_gb,
                        "memory_available_gb": node.memory_available_gb,
                        "status": node.status.value,
                        "architecture": node.architecture,
                        "cores": [
                            {
                                "core_id": core.core_id,
                                "usage_percent": core.usage_percent,
                                "status": core.status.value,
                                "allocated_to": core.allocated_to
                            } for core in node.cores
                        ]
                    } for node_id, node in self.nodes.items()
                }
            }
    
    def _calculate_performance_impact(self) -> Dict[str, Any]:
        """Calculate performance impact of current allocations"""
        if not self.performance_baseline or not self.metrics_history:
            return {"status": "insufficient_data"}
        
        # Get recent metrics (last 10 samples)
        recent_metrics = self.metrics_history[-10:]
        if not recent_metrics:
            return {"status": "no_recent_data"}
        
        # Calculate averages
        avg_cpu = sum(m.cpu_usage_percent for m in recent_metrics) / len(recent_metrics)
        avg_memory = sum(m.memory_usage_percent for m in recent_metrics) / len(recent_metrics)
        avg_load = tuple(sum(m.load_average[i] for m in recent_metrics) / len(recent_metrics) for i in range(3))
        
        # Compare to baseline
        cpu_impact = avg_cpu - self.performance_baseline["cpu_usage"]
        memory_impact = avg_memory - self.performance_baseline["memory_usage"]
        load_impact = avg_load[0] - self.performance_baseline["load_average"][0]
        
        return {
            "status": "calculated",
            "cpu_impact_percent": cpu_impact,
            "memory_impact_percent": memory_impact,
            "load_impact": load_impact,
            "baseline_cpu": self.performance_baseline["cpu_usage"],
            "current_cpu": avg_cpu,
            "baseline_memory": self.performance_baseline["memory_usage"],
            "current_memory": avg_memory,
            "efficiency_score": self._calculate_efficiency_score(cpu_impact, memory_impact, load_impact)
        }
    
    def _calculate_efficiency_score(self, cpu_impact: float, memory_impact: float, load_impact: float) -> float:
        """Calculate system efficiency score (0-100)"""
        # Higher impact = lower efficiency
        cpu_penalty = max(0, cpu_impact) * 2
        memory_penalty = max(0, memory_impact) * 1.5
        load_penalty = max(0, load_impact) * 10
        
        total_penalty = cpu_penalty + memory_penalty + load_penalty
        efficiency = max(0, 100 - total_penalty)
        
        return min(100, efficiency)
    
    def get_job_performance_stats(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get performance statistics for a specific job"""
        with self.lock:
            if job_id not in self.allocations:
                return None
            
            allocation = self.allocations[job_id]
            duration = time.time() - allocation.allocated_at
            
            # Calculate resource utilization
            allocated_cores = allocation.allocated_cores
            core_utilization = []
            
            for node in self.nodes.values():
                for core in node.cores:
                    if core.core_id in allocated_cores:
                        core_utilization.append(core.usage_percent)
            
            avg_utilization = sum(core_utilization) / len(core_utilization) if core_utilization else 0
            
            return {
                "job_id": job_id,
                "duration_seconds": duration,
                "allocated_cores": len(allocated_cores),
                "allocated_memory_gb": allocation.allocated_memory_gb,
                "avg_core_utilization": avg_utilization,
                "core_utilization_details": core_utilization,
                "nodes_used": allocation.node_ids,
                "efficiency_score": self._calculate_job_efficiency(allocation, avg_utilization)
            }
    
    def _calculate_job_efficiency(self, allocation: CPUAllocation, avg_utilization: float) -> float:
        """Calculate efficiency score for a specific job"""
        # Efficiency based on utilization and resource allocation balance
        utilization_score = min(100, avg_utilization * 1.1)  # Bonus for high utilization
        
        # Penalty for using too many nodes (overhead)
        node_penalty = (len(allocation.node_ids) - 1) * 5
        
        efficiency = max(0, utilization_score - node_penalty)
        return min(100, efficiency)
    
    def get_metrics_history(self, duration_minutes: int = 30) -> List[CPUMetrics]:
        """Get metrics history for specified duration"""
        cutoff_time = time.time() - (duration_minutes * 60)
        return [m for m in self.metrics_history if m.timestamp >= cutoff_time]
    
    def can_schedule_job(self, num_cores: int, memory_gb: float = 1.0) -> bool:
        """Check if a job can be scheduled with current resources"""
        with self.lock:
            total_available_cores = sum(node.available_cores for node in self.nodes.values())
            total_available_memory = sum(node.memory_available_gb for node in self.nodes.values())
            
            return (total_available_cores >= num_cores and 
                    total_available_memory >= memory_gb)

# Global CPU manager instance
cpu_manager = CPUResourceManager()