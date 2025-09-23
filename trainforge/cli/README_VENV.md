# TrainForge Unified Virtual Environment

This directory contains the unified virtual environment for the entire TrainForge application.

## Setup

All Python dependencies for TrainForge (CLI, Scheduler, Worker, and Examples) are now consolidated in this single virtual environment.

### Requirements

All dependencies are listed in `requirements.txt` including:
- CLI dependencies (click, requests, pyyaml, colorama, tabulate)
- Worker dependencies (psutil, zipfile38, pathlib)
- ML/AI dependencies (torch, torchvision, torchaudio, transformers, numpy)
- Monitoring dependencies (tensorboard, matplotlib, seaborn)
- Utilities (tqdm, nvidia-ml-py3)

### Environment Variables

The environment setup scripts automatically configure:
- `HF_HOME`: Hugging Face cache directory
- `TRANSFORMERS_CACHE`: Transformers library cache
- `PYTORCH_CACHE_DIR`: PyTorch cache directory

## Usage

### Windows
```cmd
cd trainforge\cli
call set_env.bat
```

### Linux/macOS
```bash
cd trainforge/cli
source set_env.sh
```

### Manual Activation
If you need to manually activate the environment:

**Windows:**
```cmd
trainforge\cli\venv\Scripts\activate.bat
```

**Linux/macOS:**
```bash
source trainforge/cli/venv/bin/activate
```

## Cache Directories

The environment scripts create cache directories under `trainforge/cli/cache/`:
- `huggingface/`: Hugging Face models and datasets
- `transformers/`: Transformers library cache
- `pytorch/`: PyTorch cache

This prevents downloading models multiple times and keeps them organized.

## Integration

The main startup scripts (`start-trainforge.bat` and `start-trainforge.sh`) have been updated to:
1. Use this single virtual environment for all Python components
2. Set up environment variables automatically
3. Install all dependencies from this consolidated requirements.txt

## Benefits

1. **Single source of truth**: All Python dependencies in one place
2. **Consistent environment**: All components use the same package versions
3. **Efficient caching**: Shared cache directories for ML models
4. **Simplified maintenance**: One requirements.txt to manage
5. **Environment variables**: Automatic setup for transformers and PyTorch