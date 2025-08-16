#!/bin/bash
# TrainForge Platform Startup Script for Linux/macOS
# This script starts all TrainForge services in the correct order

set -e

echo "================================"
echo "🚀 TrainForge Platform Startup"
echo "================================"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "📋 Checking prerequisites..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js from https://nodejs.org"
    exit 1
fi

# Check if Python is installed
if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
    echo "❌ Python not found. Please install Python from https://python.org"
    exit 1
fi

# Use python3 if available, otherwise python
PYTHON_CMD="python3"
if ! command -v python3 &> /dev/null; then
    PYTHON_CMD="python"
fi

# Check if MongoDB is running
echo "🔍 Checking MongoDB connection..."
if ! mongosh --eval "db.runCommand({ping:1})" --quiet &> /dev/null; then
    echo "❌ MongoDB not running. Please start MongoDB service first."
    echo "   You can start it with: sudo systemctl start mongod (Linux)"
    echo "   Or: brew services start mongodb/brew/mongodb-community (macOS)"
    exit 1
fi

echo "✅ Prerequisites check passed!"
echo ""

# Function to cleanup background processes
cleanup() {
    echo ""
    echo "🛑 Stopping TrainForge services..."
    jobs -p | xargs -r kill 2>/dev/null || true
    exit 0
}

trap cleanup SIGINT SIGTERM

# Ask user which profile to start
echo "Select startup profile:"
echo "1. Minimal (API + Dashboard + CLI)"
echo "2. Full (All services including Scheduler + Worker)"
echo "3. Setup dependencies only"
read -p "Enter your choice (1-3): " choice

case $choice in
    3)
        echo ""
        echo "📦 Installing dependencies..."
        echo ""

        echo "Installing API dependencies..."
        cd trainforge/api
        npm install
        if [ $? -ne 0 ]; then
            echo "❌ Failed to install API dependencies"
            exit 1
        fi

        echo "Installing Dashboard dependencies..."
        cd ../dashboard
        npm install
        if [ $? -ne 0 ]; then
            echo "❌ Failed to install Dashboard dependencies"
            exit 1
        fi

        echo "Installing CLI..."
        cd ../cli
        pip install -e .
        if [ $? -ne 0 ]; then
            echo "❌ Failed to install CLI"
            exit 1
        fi

        echo "Installing Scheduler dependencies..."
        cd ../scheduler
        pip install -r src/requirements.txt
        if [ $? -ne 0 ]; then
            echo "❌ Failed to install Scheduler dependencies"
            exit 1
        fi

        echo "Installing Worker dependencies..."
        cd ../worker
        pip install -r requirements.txt
        if [ $? -ne 0 ]; then
            echo "❌ Failed to install Worker dependencies"
            exit 1
        fi

        cd ../..
        echo "✅ All dependencies installed successfully!"
        echo "Run this script again to start services."
        exit 0
        ;;

    1)
        echo ""
        echo "🚀 Starting TrainForge Minimal Setup..."
        echo ""

        # Create .env file for API
        cd trainforge/api
        if [ ! -f .env ]; then
            cat > .env << EOF
PORT=3000
MONGODB_URI=mongodb://localhost:27017/trainforge
NODE_ENV=development
FRONTEND_URL=http://localhost:3001
EOF
        fi

        echo "Starting API server..."
        npm run dev &
        API_PID=$!

        sleep 5

        echo "Starting Dashboard..."
        cd ../dashboard
        npm start &
        DASHBOARD_PID=$!

        echo ""
        echo "✅ Minimal setup started!"
        echo "📊 API: http://localhost:3000"
        echo "🌐 Dashboard: http://localhost:3001"
        echo ""
        echo "Press Ctrl+C to stop all services..."
        
        wait
        ;;

    2)
        echo ""
        echo "🚀 Starting TrainForge Full Setup..."
        echo ""

        # Create .env file for API
        cd trainforge/api
        if [ ! -f .env ]; then
            cat > .env << EOF
PORT=3000
MONGODB_URI=mongodb://localhost:27017/trainforge
NODE_ENV=development
FRONTEND_URL=http://localhost:3001
EOF
        fi

        echo "Starting API server..."
        npm run dev &
        API_PID=$!

        sleep 5

        echo "Starting Dashboard..."
        cd ../dashboard
        npm start &
        DASHBOARD_PID=$!

        sleep 3

        echo "Starting Scheduler..."
        cd ../scheduler
        $PYTHON_CMD src/job_scheduler.py &
        SCHEDULER_PID=$!

        sleep 2

        echo "Starting Worker..."
        cd ../worker
        $PYTHON_CMD worker.py &
        WORKER_PID=$!

        echo ""
        echo "✅ Full setup started!"
        echo "📊 API: http://localhost:3000"
        echo "🌐 Dashboard: http://localhost:3001"
        echo "⚙️ Scheduler and Worker running"
        echo ""
        echo "Press Ctrl+C to stop all services..."
        
        wait
        ;;

    *)
        echo "Invalid choice. Please run the script again."
        exit 1
        ;;
esac