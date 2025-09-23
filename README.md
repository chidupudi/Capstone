# TrainForge - Distributed AI Training Platform

🚀 **Simple distributed AI training with just 3 commands: `trainforge init`, `trainforge push`, done!**

TrainForge is a complete distributed AI training platform that handles GPU allocation, container orchestration, and training execution automatically.

## ⚡ Quick Start

### 🚀 **Option 1: Automated (Recommended)**

**Windows:**
```cmd
# 1. Start all services
start-trainforge.bat

# 2. Setup environment & create project
cd trainforge\cli
call set_env.bat
mkdir my-ai-project && cd my-ai-project
trainforge init --name "my-model-training"

# 3. Submit job
trainforge push
```

**Linux/macOS:**
```bash
# 1. Start all services
./start-trainforge.sh

# 2. Setup environment & create project
cd trainforge/cli
source set_env.sh
mkdir my-ai-project && cd my-ai-project
trainforge init --name "my-model-training"

# 3. Submit job
trainforge push
```

### 🔧 **Option 2: Manual Component Control**

**Windows:**
```cmd
# Terminal 1: Database
mongod --dbpath ./data/db

# Terminal 2: API Server
cd trainforge\api && npm start

# Terminal 3: Dashboard
cd trainforge\dashboard && npm start

# Terminal 4: Setup Python Environment
cd trainforge\cli
call set_env.bat

# Terminal 5: Scheduler (in same environment)
cd ..\scheduler && python src\job_scheduler.py

# Terminal 6: Worker Node (in same environment)
cd ..\worker && python worker.py

# Terminal 7: Submit Jobs
cd my-project && trainforge push
```

**Linux/macOS:**
```bash
# Terminal 1: Database
mongod --dbpath ./data/db

# Terminal 2: API Server
cd trainforge/api && npm start

# Terminal 3: Dashboard
cd trainforge/dashboard && npm start

# Terminal 4: Setup Python Environment
cd trainforge/cli
source set_env.sh

# Terminal 5: Scheduler (in same environment)
cd ../scheduler && python src/job_scheduler.py

# Terminal 6: Worker Node (in same environment)
cd ../worker && python worker.py

# Terminal 7: Submit Jobs
cd my-project && trainforge push
```

**📖 [Full Setup Guide](./SETUP.md)** | **🏃 [Worker Nodes Guide](./trainforge/workers/README.md)**

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
✅ **Worker Nodes** - Scalable distributed execution
✅ **External GPU Ready** - Connect to cloud GPUs

## 🧪 **Complete ML Example**

**[Distributed Image Classification](./examples/distributed-image-classification/)** - ResNet-50 on CIFAR-100

Perfect showcase of TrainForge's power:
- **Multi-GPU Training**: Automatic distributed training setup
- **Resource Optimization**: 90%+ GPU utilization
- **Easy Scaling**: Single YAML change: `gpu: 1` → `gpu: 8`
- **Real-time Monitoring**: Live training metrics and progress
- **Fault Tolerance**: Automatic checkpointing and recovery

## 🔧 Prerequisites

- Python 3.8+ (with pip)
- Node.js 16+ (with npm)
- MongoDB (auto-configured)
- Docker (optional, fallback available)

## 🛠️ Environment Setup

TrainForge uses a **unified virtual environment** located in `trainforge/cli/venv/` for all Python components (CLI, Scheduler, Worker, Examples).

### First Time Setup

**Windows:**
```cmd
# 1. Install dependencies
start-trainforge.bat
# Choose option 3 (Setup dependencies only)

# 2. Activate environment for manual use
cd trainforge\cli
call set_env.bat
```

**Linux/macOS:**
```bash
# 1. Install dependencies
./start-trainforge.sh
# Choose option 3 (Setup dependencies only)

# 2. Activate environment for manual use
cd trainforge/cli
source set_env.sh
```

### Environment Features

- ✅ **Unified Dependencies**: All Python packages in one place
- ✅ **ML Libraries**: PyTorch, Transformers, TensorBoard pre-installed
- ✅ **Environment Variables**: HF_HOME, TRANSFORMERS_CACHE auto-configured
- ✅ **Cache Management**: Shared model cache directories
- ✅ **Cross-Platform**: Works on Windows, Linux, and macOS

## 🚨 Troubleshooting

**Environment not working?**
```cmd
# Windows: Reset environment
cd trainforge\cli
call set_env.bat

# Linux/macOS: Reset environment
cd trainforge/cli
source set_env.sh
```

**Transformers not loading?**
```cmd
# Check if transformers is installed
python -c "import transformers; print('✅ Working')"

# If not, reinstall
cd trainforge\cli
call venv\Scripts\activate.bat  # Windows
pip install -r requirements.txt
```

**API not responding?**
```bash
cd trainforge/api && npm start
```

**Dashboard not loading?**
```bash
cd trainforge/dashboard && npm start
```

**Python components failing?**
- Make sure you're using the unified venv: `cd trainforge/cli && call set_env.bat`
- Check environment variables: `echo %HF_HOME%` (Windows) or `echo $HF_HOME` (Linux)

**Job stuck pending?**
- Check GPU availability in dashboard
- Verify your trainforge.yaml resource requirements

**Training fails?**
- Check logs: `trainforge status <job_id>`
- Verify your train.py script runs locally with the unified environment

## 🤝 Contributing

This is a capstone project showcasing distributed AI training architecture. The system demonstrates:

- Microservices architecture
- Resource management
- Real-time monitoring
- Job orchestration
- CLI tooling

---

**🎉 Ready to train? Run `trainforge init` and get started!**