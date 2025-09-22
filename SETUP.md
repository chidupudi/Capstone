# TrainForge Manual Setup Guide

## 🔧 **Component-by-Component Setup**

### 1. **API Server** (Backend)
```bash
# Navigate to API directory
cd trainforge/api

# Install dependencies
npm install

# Start MongoDB (if not running)
# Windows: mongod --dbpath C:\data\db
# Linux/Mac: mongod --dbpath /data/db

# Start API server
npm start
# OR for development with auto-reload:
npm run dev

# Verify API is running
curl http://localhost:3000/health
```

**API Endpoints:**
- `GET /health` - Health check
- `POST /api/jobs` - Submit job
- `GET /api/jobs` - List jobs
- `GET /api/jobs/:id` - Get job status

---

### 2. **Dashboard** (Frontend)
```bash
# Navigate to Dashboard directory
cd trainforge/dashboard

# Install dependencies
npm install

# Start React development server
npm start

# Production build (optional)
npm run build
npm install -g serve
serve -s build -l 3001
```

**Dashboard Access:**
- Development: http://localhost:3001
- Features: Real-time job monitoring, GPU stats, worker status

---

### 3. **CLI Tool** (Client)
```bash
# Navigate to CLI directory
cd trainforge/cli

# Install CLI package in development mode
pip install -e .

# Verify installation
trainforge --version
trainforge --help

# Create requirements.txt if missing
echo "click>=8.0.0
requests>=2.28.0
pyyaml>=6.0
colorama>=0.4.4
tabulate>=0.9.0" > requirements.txt

pip install -r requirements.txt
```

**CLI Commands:**
```bash
trainforge init [--name PROJECT_NAME]     # Initialize project
trainforge push [--config trainforge.yaml] # Submit job
trainforge status [JOB_ID]                # Check status
trainforge --help                         # Show all commands
```

---

### 4. **Scheduler** (Job Orchestrator)
```bash
# Navigate to Scheduler directory
cd trainforge/scheduler

# Install Python dependencies
pip install docker psutil pynvml

# Start scheduler manually
python -c "
import sys
sys.path.append('src')
from job_scheduler import JobScheduler
scheduler = JobScheduler()
print('🚀 Scheduler started')
scheduler.start()
try:
    import time
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    print('🛑 Scheduler stopped')
    scheduler.stop()
"
```

**Scheduler Features:**
- GPU/CPU resource management
- Job queue with priorities
- Container orchestration
- Distributed training coordination

---

### 5. **Worker Nodes** (Training Execution)
```bash
# Start worker node manually
cd trainforge/scheduler

# Option 1: Python worker
python -c "
import sys
sys.path.append('src')
from distributed_processor import distributed_processor
print('🏃 Starting worker node...')
distributed_processor.start(max_workers=4)
print('✅ Worker node ready')
try:
    import time
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    print('🛑 Worker stopped')
    distributed_processor.stop()
"

# Option 2: Container-based worker
python -c "
import sys
sys.path.append('src')
from container_manager import ContainerManager
worker = ContainerManager()
print('🐳 Container worker ready')
input('Press Enter to stop...')
"
```

---

### 6. **Database** (MongoDB)
```bash
# Install MongoDB
# Windows: Download from https://www.mongodb.com/try/download/community
# Ubuntu: sudo apt install mongodb
# Mac: brew install mongodb-community

# Start MongoDB
# Windows: mongod --dbpath C:\data\db
# Linux/Mac: mongod --dbpath /data/db

# Verify MongoDB
mongosh
> show dbs
> use trainforge
> show collections
```

---

## 🚀 **Complete Manual Startup**

### Terminal 1: Database
```bash
mongod --dbpath ./data/db
```

### Terminal 2: API Server
```bash
cd trainforge/api
npm install
npm start
```

### Terminal 3: Dashboard
```bash
cd trainforge/dashboard
npm install
npm start
```

### Terminal 4: Scheduler
```bash
cd trainforge/scheduler
python -m src.job_scheduler
```

### Terminal 5: Worker Node
```bash
cd trainforge/scheduler
python -m src.distributed_processor
```

### Terminal 6: CLI Usage
```bash
cd my-project
trainforge init
trainforge push
trainforge status
```

---

## 🔍 **Verification Steps**

1. **Check API**: `curl http://localhost:3000/health`
2. **Check Dashboard**: Open http://localhost:3001
3. **Check CLI**: `trainforge --version`
4. **Check Database**: `mongosh` → `show dbs`
5. **Submit Test Job**: `trainforge push`

---

## 🛠️ **Development Mode**

For development, use these commands:

```bash
# API with auto-reload
cd trainforge/api && npm run dev

# Dashboard with hot reload
cd trainforge/dashboard && npm start

# CLI development installation
cd trainforge/cli && pip install -e .
```

---

## 🐳 **Docker Alternative**

If you prefer Docker:

```bash
# Build images
docker build -t trainforge-api ./trainforge/api
docker build -t trainforge-dashboard ./trainforge/dashboard

# Run with docker-compose (create docker-compose.yml)
docker-compose up -d
```