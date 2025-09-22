# TrainForge - Distributed AI Training Platform

🚀 **Simple distributed AI training with just 3 commands: `trainforge init`, `trainforge push`, done!**

TrainForge is a complete distributed AI training platform that handles GPU allocation, container orchestration, and training execution automatically.

## ⚡ Quick Start (3 Steps)

### 1. Start TrainForge Platform
```bash
# Start all services
./start-trainforge.bat
```

This starts:
- 🌐 **API Server** (localhost:3000) - Job management
- 📊 **Dashboard** (localhost:3001) - Real-time monitoring
- 🧠 **Scheduler** - GPU/CPU allocation & job orchestration
- 🏃 **Workers** - Training execution

### 2. Install CLI & Create Project
```bash
# Install CLI
cd trainforge/cli
pip install -e .

# Create your AI project
mkdir my-ai-project && cd my-ai-project
trainforge init --name "my-model-training"
```

### 3. Submit Training Job
```bash
# Edit your train.py and trainforge.yaml, then:
trainforge push
```

**That's it!** TrainForge handles everything else automatically.

## 📁 Project Structure

Your project needs just 2 files:

### `trainforge.yaml` (Auto-generated)
```yaml
project:
  name: my-model-training
  description: AI training project created with TrainForge

training:
  script: train.py
  requirements: requirements.txt

resources:
  gpu: 1
  cpu: 2
  memory: 4Gi

environment:
  python_version: '3.9'
  base_image: pytorch/pytorch:latest
```

### `train.py` (Your training code)
```python
import torch
import os

def main():
    # Get TrainForge job info
    job_id = os.environ.get('TRAINFORGE_JOB_ID', 'local')
    gpu_id = os.environ.get('CUDA_VISIBLE_DEVICES', '0')

    print(f"🚀 Starting training job {job_id} on GPU {gpu_id}")

    # Your training code here
    model = torch.nn.Linear(10, 1)
    if torch.cuda.is_available():
        model = model.cuda()
        print(f"✅ Using GPU: {torch.cuda.get_device_name()}")

    # Training loop
    for epoch in range(10):
        # Your training logic
        print(f"Epoch {epoch+1}/10 completed")

    print("✅ Training completed!")

if __name__ == "__main__":
    main()
```

## 🔧 Advanced Usage

### Multi-GPU Training
```yaml
resources:
  gpu: 4  # Request 4 GPUs
  memory: 16Gi
```

### Custom Environment
```yaml
environment:
  base_image: nvidia/pytorch:23.08-py3
  env:
    NCCL_DEBUG: INFO
    CUDA_LAUNCH_BLOCKING: 1
```

### Dependencies
```yaml
training:
  requirements: requirements.txt  # Your pip dependencies
```

## 📊 Monitoring

- **Dashboard**: http://localhost:3001 - Real-time job monitoring
- **CLI Status**: `trainforge status` - Check job progress
- **Detailed Logs**: `trainforge status <job_id>` - View specific job

## 🌐 External GPU Support

TrainForge can connect to external GPUs:

- **Google Colab** - Add TrainForge endpoint
- **Kaggle Kernels** - Connect via API
- **GCP/AWS** - Remote GPU clusters
- **Local GPUs** - Automatic detection

*External GPU setup instructions coming soon*

## 🔍 How It Works

1. **CLI** packages your code and submits to API
2. **API** stores files and creates job in database
3. **Scheduler** allocates GPUs and starts workers
4. **Workers** run your training in containers/processes
5. **Dashboard** shows real-time progress

## 📋 Commands

```bash
trainforge init [--name PROJECT_NAME]     # Initialize project
trainforge push [--config trainforge.yaml] # Submit job
trainforge status [JOB_ID]                # Check status
trainforge --help                         # Show help
```

## 🛠️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CLI Tool      │───▶│   API Server    │───▶│   Scheduler     │
│ (Job Submit)    │    │ (Job Storage)   │    │ (GPU Manager)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                       ┌─────────────────┐    ┌─────────────────┐
                       │   Dashboard     │    │   Workers       │
                       │ (Monitoring)    │    │ (Training)      │
                       └─────────────────┘    └─────────────────┘
```

## 🎯 Key Features

✅ **Zero Configuration** - Works out of the box
✅ **Auto GPU Detection** - Finds available GPUs automatically
✅ **Multi-GPU Support** - Distributed training across GPUs
✅ **Container Orchestration** - Docker + fallback to subprocess
✅ **Real-time Monitoring** - Live dashboard and CLI status
✅ **Resource Management** - CPU/GPU allocation and monitoring
✅ **Job Scheduling** - Priority-based queue management
✅ **External GPU Ready** - Connect to cloud GPUs

## 🔧 Prerequisites

- Python 3.8+
- Node.js 16+
- MongoDB (auto-configured)
- Docker (optional, fallback available)

## 🚨 Troubleshooting

**API not responding?**
```bash
cd trainforge/api && npm start
```

**Dashboard not loading?**
```bash
cd trainforge/dashboard && npm start
```

**Job stuck pending?**
- Check GPU availability in dashboard
- Verify your trainforge.yaml resource requirements

**Training fails?**
- Check logs: `trainforge status <job_id>`
- Verify your train.py script runs locally

## 🤝 Contributing

This is a capstone project showcasing distributed AI training architecture. The system demonstrates:

- Microservices architecture
- Resource management
- Real-time monitoring
- Job orchestration
- CLI tooling

---

**🎉 Ready to train? Run `trainforge init` and get started!**