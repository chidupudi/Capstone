#!/bin/bash
# Environment setup script for TrainForge
# Sets up environment variables and activates the virtual environment

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Set TrainForge environment variables
export HF_HOME="$SCRIPT_DIR/cache/huggingface"
export TRANSFORMERS_CACHE="$SCRIPT_DIR/cache/transformers"
export PYTORCH_CACHE_DIR="$SCRIPT_DIR/cache/pytorch"

# Create cache directories if they don't exist
mkdir -p "$SCRIPT_DIR/cache"
mkdir -p "$HF_HOME"
mkdir -p "$TRANSFORMERS_CACHE"
mkdir -p "$PYTORCH_CACHE_DIR"

# Activate virtual environment
source "$SCRIPT_DIR/venv/bin/activate"

echo "TrainForge environment activated successfully!"
echo "HF_HOME=$HF_HOME"
echo "TRANSFORMERS_CACHE=$TRANSFORMERS_CACHE"
echo "PYTORCH_CACHE_DIR=$PYTORCH_CACHE_DIR"