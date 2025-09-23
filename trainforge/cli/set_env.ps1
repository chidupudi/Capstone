# TrainForge Environment Setup Script for PowerShell
# Sets up environment variables and activates the virtual environment

# Get the directory where this script is located
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Set TrainForge environment variables
$env:HF_HOME = "$ScriptDir\cache\huggingface"
$env:TRANSFORMERS_CACHE = "$ScriptDir\cache\transformers"
$env:PYTORCH_CACHE_DIR = "$ScriptDir\cache\pytorch"

# Create cache directories if they don't exist
New-Item -ItemType Directory -Force -Path "$ScriptDir\cache" | Out-Null
New-Item -ItemType Directory -Force -Path $env:HF_HOME | Out-Null
New-Item -ItemType Directory -Force -Path $env:TRANSFORMERS_CACHE | Out-Null
New-Item -ItemType Directory -Force -Path $env:PYTORCH_CACHE_DIR | Out-Null

# Activate virtual environment
& "$ScriptDir\venv\Scripts\Activate.ps1"

Write-Host "TrainForge environment activated successfully!" -ForegroundColor Green
Write-Host "HF_HOME=$env:HF_HOME" -ForegroundColor Cyan
Write-Host "TRANSFORMERS_CACHE=$env:TRANSFORMERS_CACHE" -ForegroundColor Cyan
Write-Host "PYTORCH_CACHE_DIR=$env:PYTORCH_CACHE_DIR" -ForegroundColor Cyan