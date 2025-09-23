@echo off
REM Environment setup script for TrainForge
REM Sets up environment variables and activates the virtual environment

REM Set TrainForge environment variables
set HF_HOME=%~dp0cache\huggingface
set TRANSFORMERS_CACHE=%~dp0cache\transformers
set PYTORCH_CACHE_DIR=%~dp0cache\pytorch

REM Create cache directories if they don't exist
if not exist "%~dp0cache" mkdir "%~dp0cache"
if not exist "%HF_HOME%" mkdir "%HF_HOME%"
if not exist "%TRANSFORMERS_CACHE%" mkdir "%TRANSFORMERS_CACHE%"
if not exist "%PYTORCH_CACHE_DIR%" mkdir "%PYTORCH_CACHE_DIR%"

REM Activate virtual environment
call "%~dp0venv\Scripts\activate.bat"

echo TrainForge environment activated successfully!
echo HF_HOME=%HF_HOME%
echo TRANSFORMERS_CACHE=%TRANSFORMERS_CACHE%
echo PYTORCH_CACHE_DIR=%PYTORCH_CACHE_DIR%