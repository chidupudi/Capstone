# TrainForge Worker Nodes

## 🏃 **Worker Node System**

Worker nodes are the execution engines of TrainForge. They connect to the scheduler and execute training jobs.

## 🚀 **Quick Start**

### Option 1: Simple Start
```bash
cd trainforge/workers
python start_worker.py
```

### Option 2: Direct Start
```bash
cd trainforge/workers
python worker_node.py
```

### Option 3: Advanced Configuration
```bash
cd trainforge/workers
python worker_node.py --scheduler http://localhost:3000 --max-jobs 4 --worker-id my-worker-1
```

## 📋 **Command Options**

```bash
python worker_node.py [OPTIONS]

Options:
  --scheduler URL      Scheduler URL (default: http://localhost:3000)
  --worker-id ID       Worker identifier (auto-generated if not provided)
  --max-jobs N         Maximum concurrent jobs (default: 4)
  --status             Show worker status and exit
  --help               Show help message
```

## 🔧 **Worker Node Features**

### **Resource Management**
- **GPU Detection**: Automatic GPU discovery and allocation
- **CPU Management**: Multi-core CPU allocation and monitoring
- **Memory Tracking**: Real-time memory usage monitoring
- **Load Balancing**: Distributes jobs across available resources

### **Job Execution**
- **Container Support**: Docker-based training with GPU passthrough
- **Process Fallback**: Subprocess execution when Docker unavailable
- **Multi-GPU Training**: Distributed training across multiple GPUs
- **Resource Isolation**: Jobs run in isolated environments

### **Communication**
- **Scheduler Registration**: Automatic registration with scheduler
- **Heartbeat System**: Regular status updates to scheduler
- **Job Polling**: Actively polls for new jobs
- **Status Reporting**: Real-time job status updates

### **Fault Tolerance**
- **Graceful Shutdown**: Proper cleanup on exit
- **Job Recovery**: Handles job failures and retries
- **Resource Cleanup**: Automatic resource deallocation
- **Error Reporting**: Detailed error logging and reporting

## 🖥️ **Multiple Worker Nodes**

You can run multiple worker nodes for increased capacity:

### **Same Machine**
```bash
# Terminal 1: Worker 1
python worker_node.py --worker-id worker-1 --max-jobs 2

# Terminal 2: Worker 2
python worker_node.py --worker-id worker-2 --max-jobs 2
```

### **Different Machines**
```bash
# Machine 1
python worker_node.py --scheduler http://SCHEDULER_IP:3000 --worker-id machine-1

# Machine 2
python worker_node.py --scheduler http://SCHEDULER_IP:3000 --worker-id machine-2
```

## 📊 **Monitoring Worker Nodes**

### **Check Worker Status**
```bash
python worker_node.py --status
```

### **View Dashboard**
- Open http://localhost:3001
- Navigate to "Workers" section
- View real-time worker metrics

### **CLI Monitoring**
```bash
# Check all workers
curl http://localhost:3000/api/workers

# Check specific worker
curl http://localhost:3000/api/workers/worker-1
```

## 🔄 **Worker Lifecycle**

1. **Startup**
   - Initialize resource managers (GPU, CPU)
   - Register with scheduler
   - Start heartbeat and job polling

2. **Running**
   - Poll for new jobs
   - Execute assigned jobs
   - Monitor job progress
   - Report status to scheduler

3. **Job Execution**
   - Allocate required resources
   - Start training container/process
   - Monitor execution
   - Report completion status
   - Clean up resources

4. **Shutdown**
   - Stop active jobs gracefully
   - Clean up resources
   - Unregister from scheduler

## 🛠️ **Configuration**

Worker nodes automatically configure themselves based on:

- **Available GPUs**: Detected via nvidia-ml-py or nvidia-smi
- **CPU Cores**: Detected via psutil
- **Memory**: System memory detection
- **Docker**: Automatic Docker availability check

## 🐳 **Docker Support**

Workers support both Docker and subprocess execution:

### **Docker Mode** (Preferred)
- Full container isolation
- GPU passthrough support
- Custom base images
- Dependency management

### **Subprocess Mode** (Fallback)
- Direct process execution
- Faster startup
- Shared environment
- Good for development

## 🔍 **Troubleshooting**

### **Worker Won't Start**
```bash
# Check dependencies
pip install docker psutil pynvml requests

# Check scheduler connection
curl http://localhost:3000/health
```

### **No GPUs Detected**
```bash
# Check NVIDIA drivers
nvidia-smi

# Install NVIDIA ML Python
pip install pynvml
```

### **Jobs Not Starting**
- Check available resources in dashboard
- Verify project files are uploaded correctly
- Check worker logs for errors

### **Docker Issues**
```bash
# Check Docker status
docker ps

# Test GPU support
docker run --gpus all nvidia/cuda:11.0-base nvidia-smi
```

## 📈 **Performance Tuning**

### **Optimize Job Capacity**
```bash
# High-memory jobs
python worker_node.py --max-jobs 2

# Light jobs
python worker_node.py --max-jobs 8
```

### **Resource Allocation**
- Monitor GPU memory usage
- Adjust CPU allocation based on workload
- Use appropriate Docker base images

### **Network Optimization**
- Run workers close to scheduler
- Use fast storage for project files
- Minimize network latency

---

## 🎯 **Example: Production Setup**

### **3-Node Cluster**
```bash
# Node 1: 2x RTX 3090
python worker_node.py --worker-id gpu-node-1 --max-jobs 2

# Node 2: 4x RTX 4090
python worker_node.py --worker-id gpu-node-2 --max-jobs 4

# Node 3: CPU-only
python worker_node.py --worker-id cpu-node-1 --max-jobs 8
```

This gives you a distributed cluster with 6 GPU workers and 8 CPU workers!