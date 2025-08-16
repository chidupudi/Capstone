@echo off
REM TrainForge Platform Startup Script for Windows
REM This script starts all TrainForge services in the correct order

echo ================================
echo 🚀 TrainForge Platform Startup
echo ================================

set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

echo.
echo 📋 Checking prerequisites...

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js not found. Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

REM Check if Python is installed
where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Python not found. Please install Python from https://python.org
    pause
    exit /b 1
)

REM Check if MongoDB is running
echo 🔍 Checking MongoDB connection...
mongosh --eval "db.runCommand({ping:1})" --quiet >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ MongoDB not running. Please start MongoDB service first.
    echo    You can start it with: net start MongoDB
    pause
    exit /b 1
)

echo ✅ Prerequisites check passed!
echo.

REM Ask user which profile to start
echo Select startup profile:
echo 1. Minimal (API + Dashboard + CLI)
echo 2. Full (All services including Scheduler + Worker)
echo 3. Setup dependencies only
choice /c 123 /m "Enter your choice"

if %ERRORLEVEL%==1 goto :minimal
if %ERRORLEVEL%==2 goto :full
if %ERRORLEVEL%==3 goto :setup

:setup
echo.
echo 📦 Installing dependencies...
echo.

echo Installing API dependencies...
cd trainforge\api
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Failed to install API dependencies
    pause
    exit /b 1
)

echo Installing Dashboard dependencies...
cd ..\dashboard
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Failed to install Dashboard dependencies
    pause
    exit /b 1
)

echo Installing CLI...
cd ..\cli
pip install -e .
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Failed to install CLI
    pause
    exit /b 1
)

echo Installing Scheduler dependencies...
cd ..\scheduler
pip install -r src\requirements.txt
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Failed to install Scheduler dependencies
    pause
    exit /b 1
)

echo Installing Worker dependencies...
cd ..\worker
pip install -r requirements.txt
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Failed to install Worker dependencies
    pause
    exit /b 1
)

cd ..\..
echo ✅ All dependencies installed successfully!
echo Run this script again to start services.
pause
exit /b 0

:minimal
echo.
echo 🚀 Starting TrainForge Minimal Setup...
echo.

echo Creating .env file for API...
cd trainforge\api
if not exist .env (
    echo PORT=3000> .env
    echo MONGODB_URI=mongodb://localhost:27017/trainforge>> .env
    echo NODE_ENV=development>> .env
    echo FRONTEND_URL=http://localhost:3001>> .env
)

echo Starting API server...
start "TrainForge API" cmd /k "npm run dev"

timeout /t 5 /nobreak >nul

echo Starting Dashboard...
cd ..\dashboard
start "TrainForge Dashboard" cmd /k "npm start"

echo.
echo ✅ Minimal setup started!
echo 📊 API: http://localhost:3000
echo 🌐 Dashboard: http://localhost:3001
echo.
echo Press any key to exit...
pause >nul
exit /b 0

:full
echo.
echo 🚀 Starting TrainForge Full Setup...
echo.

echo Creating .env file for API...
cd trainforge\api
if not exist .env (
    echo PORT=3000> .env
    echo MONGODB_URI=mongodb://localhost:27017/trainforge>> .env
    echo NODE_ENV=development>> .env
    echo FRONTEND_URL=http://localhost:3001>> .env
)

echo Starting API server...
start "TrainForge API" cmd /k "npm run dev"

timeout /t 5 /nobreak >nul

echo Starting Dashboard...
cd ..\dashboard
start "TrainForge Dashboard" cmd /k "npm start"

timeout /t 3 /nobreak >nul

echo Starting Scheduler...
cd ..\scheduler
start "TrainForge Scheduler" cmd /k "python src\job_scheduler.py"

timeout /t 2 /nobreak >nul

echo Starting Worker...
cd ..\worker
start "TrainForge Worker" cmd /k "python worker.py"

echo.
echo ✅ Full setup started!
echo 📊 API: http://localhost:3000
echo 🌐 Dashboard: http://localhost:3001
echo ⚙️ Scheduler and Worker running in background
echo.
echo Press any key to exit...
pause >nul
exit /b 0