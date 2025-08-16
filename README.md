# TrainForge - Distributed AI Training Platform

TrainForge is a distributed AI training platform that provides GPU orchestration, job scheduling, and web-based monitoring for machine learning workloads.

## 🏗️ Architecture

The platform consists of several components:
- **API Server** - Backend REST API and WebSocket server
- **Dashboard** - React-based web interface
- **CLI** - Command-line interface for job submission
- **Scheduler** - GPU resource management and job scheduling
- **Worker** - Distributed training workers

## 🚀 Quick Setup

### One-Command Startup (Recommended)

**For Windows:**
```batch
# Setup environment and install dependencies
python setup-environment.py

# Start all services
start-trainforge.bat
```

**For Linux/macOS:**
```bash
# Setup environment and install dependencies
python3 setup-environment.py

# Start all services
./start-trainforge.sh
```

### Manual Setup

#### Prerequisites
- Node.js 16+ and npm
- Python 3.8+
- MongoDB Community Edition

#### Option 1: Automated Setup
Run the environment setup script:
```bash
python setup-environment.py
```

#### Option 2: Manual Step-by-Step

1. **Install dependencies:**
```bash
# API Server
cd trainforge/api && npm install

# Dashboard
cd ../dashboard && npm install

# CLI Tool
cd ../cli && pip install -e .

# Scheduler (optional)
cd ../scheduler && pip install -r src/requirements.txt

# Worker (optional)  
cd ../worker && pip install -r requirements.txt
```

2. **Start MongoDB:**
```bash
# Windows
net start MongoDB

# Linux
sudo systemctl start mongod

# macOS
brew services start mongodb/brew/mongodb-community
```

3. **Choose startup mode:**
- **Minimal:** API + Dashboard + CLI
- **Full:** All services including Scheduler + Worker

## 📋 Component Setup Details

### API Server Setup
1. **Install dependencies**: `npm install` in `trainforge/api/`
2. **Database setup**: Ensure MongoDB is running
3. **Environment configuration**: Create `.env` file with database URI
4. **Start server**: `npm run dev` for development or `npm start` for production

### Dashboard Setup
1. **Install dependencies**: `npm install` in `trainforge/dashboard/`
2. **Configure API endpoint**: Update proxy in `package.json` if needed
3. **Start development server**: `npm start`
4. **Build for production**: `npm run build`

### CLI Setup
1. **Install CLI package**: `pip install -e .` in `trainforge/cli/`
2. **Initialize project**: `trainforge init` in your ML project directory
3. **Configure endpoint**: Update API endpoint in `trainforge.yaml`

### Scheduler Setup
1. **Install Python dependencies**: `pip install -r src/requirements.txt`
2. **Configure GPU resources**: Update GPU detection in `gpu_manager.py`
3. **Start scheduler**: `python src/job_scheduler.py`

### Worker Setup
1. **Install dependencies**: `pip install -r requirements.txt`
2. **Configure worker**: Update connection settings
3. **Start worker**: `python worker.py`

## ⚡ Quick Start Commands

After installation, use these simple commands:

```bash
# Setup everything (run once)
python setup-environment.py

# Start TrainForge platform
start-trainforge.bat        # Windows
./start-trainforge.sh       # Linux/macOS

# Submit a training job
cd your-ml-project
trainforge init
trainforge push

# Monitor jobs
# Open http://localhost:3001 in browser
```

## 🔧 Configuration Files

The platform uses these configuration files:

- **`trainforge-config.yaml`** - Platform service definitions
- **`trainforge/api/.env`** - API server environment variables
- **`trainforge.yaml`** - Project-specific training configuration

### Platform Configuration (trainforge-config.yaml)
```yaml
# Service startup profiles
profiles:
  minimal:    # API + Dashboard + CLI
  full:       # All services including GPU scheduling
  production: # Production deployment settings
```

### API Configuration (trainforge/api/.env)
```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/trainforge
NODE_ENV=development
FRONTEND_URL=http://localhost:3001
```

### Project Configuration (trainforge.yaml)
```yaml
project:
  name: "your-project"
  version: "1.0.0"

api:
  endpoint: "http://localhost:3000"

training:
  framework: "pytorch"
  python_version: "3.8"
  requirements_file: "requirements.txt"
```

## 📚 Usage Examples

### Submit a Training Job
```bash
# Using CLI
trainforge push

# Check job status
trainforge status
```

### Monitor Jobs
- Open dashboard at `http://localhost:3001`
- View real-time job progress and logs
- Monitor GPU utilization

## 🧪 Testing

### API Tests
```bash
cd trainforge/api
npm test
```

### Dashboard Tests
```bash
cd trainforge/dashboard
npm test
```

### Example Projects
Check the `examples/` directory for sample training projects:
- `mnist-basic/` - Basic MNIST training example
- `resnet-cifar10/` - ResNet on CIFAR-10

## 🐛 Troubleshooting

### Common Issues

1. **API server won't start**
   - Check MongoDB is running
   - Verify port 3000 is available
   - Check `.env` configuration

2. **Dashboard can't connect to API**
   - Verify API server is running on port 3000
   - Check proxy configuration in `package.json`

3. **CLI commands fail**
   - Ensure CLI is installed: `pip install -e .`
   - Check `trainforge.yaml` configuration
   - Verify API endpoint is accessible

4. **GPU not detected**
   - Check NVIDIA drivers are installed
   - Verify CUDA installation
   - Update GPU detection in scheduler

## 📁 Project Structure

```
trainforge/
├── api/                 # Backend API server
├── dashboard/           # React web interface
├── cli/                 # Command-line tool
├── scheduler/           # GPU scheduling service
├── worker/              # Training worker nodes
├── examples/            # Example projects
├── docs/                # Documentation
├── infrastructure/      # Deployment configs
└── tests/               # Test projects
```

## 🤝 Development

### Development Workflow
1. Start MongoDB
2. Start API server: `cd trainforge/api && npm run dev`
3. Start dashboard: `cd trainforge/dashboard && npm start`
4. Install CLI: `cd trainforge/cli && pip install -e .`
5. Test with example projects in `examples/`

### Adding New Features
1. Update API routes in `trainforge/api/src/routes/`
2. Add dashboard components in `trainforge/dashboard/src/`
3. Extend CLI commands in `trainforge/cli/trainforge/commands/`

## 📄 License

MIT License - see LICENSE file for details.