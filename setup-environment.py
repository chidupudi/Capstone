#!/usr/bin/env python3
"""
TrainForge Environment Setup Script
This script helps setup the complete TrainForge environment with dependency checks
"""

import os
import sys
import subprocess
import json
import platform
from pathlib import Path

class TrainForgeSetup:
    def __init__(self):
        self.script_dir = Path(__file__).parent
        self.platform = platform.system().lower()
        self.errors = []
        self.warnings = []
        
    def print_header(self):
        print("=" * 50)
        print("🔧 TrainForge Environment Setup")
        print("=" * 50)
        print(f"Platform: {platform.system()} {platform.release()}")
        print(f"Python: {sys.version.split()[0]}")
        print("")
        
    def check_command(self, command, name, install_hint=""):
        """Check if a command exists in PATH"""
        try:
            result = subprocess.run([command, "--version"], 
                                  capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                version = result.stdout.split('\n')[0]
                print(f"✅ {name}: {version}")
                return True
        except (subprocess.TimeoutExpired, FileNotFoundError, subprocess.SubprocessError):
            pass
            
        print(f"❌ {name}: Not found")
        if install_hint:
            print(f"   Install: {install_hint}")
        self.errors.append(f"{name} not found")
        return False
        
    def check_python_package(self, package, install_command=""):
        """Check if a Python package is installed"""
        try:
            __import__(package)
            print(f"✅ Python package '{package}': Installed")
            return True
        except ImportError:
            print(f"❌ Python package '{package}': Not found")
            if install_command:
                print(f"   Install: {install_command}")
            self.warnings.append(f"Python package '{package}' not found")
            return False
            
    def check_node_package(self, directory, package_name):
        """Check if Node.js dependencies are installed"""
        node_modules = directory / "node_modules"
        package_json = directory / "package.json"
        
        if not package_json.exists():
            print(f"❌ {package_name}: package.json not found")
            return False
            
        if not node_modules.exists():
            print(f"❌ {package_name}: Dependencies not installed")
            print(f"   Run: cd {directory} && npm install")
            self.warnings.append(f"{package_name} dependencies not installed")
            return False
            
        print(f"✅ {package_name}: Dependencies installed")
        return True
        
    def check_mongodb_connection(self):
        """Check if MongoDB is running and accessible"""
        try:
            result = subprocess.run(
                ["mongosh", "--eval", "db.runCommand({ping:1})", "--quiet"],
                capture_output=True, text=True, timeout=10
            )
            if result.returncode == 0:
                print("✅ MongoDB: Running and accessible")
                return True
        except (subprocess.TimeoutExpired, FileNotFoundError, subprocess.SubprocessError):
            pass
            
        print("❌ MongoDB: Not running or not accessible")
        print("   Start MongoDB service first")
        if self.platform == "windows":
            print("   Command: net start MongoDB")
        elif self.platform == "linux":
            print("   Command: sudo systemctl start mongod")
        elif self.platform == "darwin":
            print("   Command: brew services start mongodb/brew/mongodb-community")
            
        self.errors.append("MongoDB not accessible")
        return False
        
    def create_env_files(self):
        """Create necessary .env files"""
        print("\n📝 Creating environment files...")
        
        # API .env file
        api_env_path = self.script_dir / "trainforge" / "api" / ".env"
        if not api_env_path.exists():
            api_env_content = """PORT=3000
MONGODB_URI=mongodb://localhost:27017/trainforge
NODE_ENV=development
FRONTEND_URL=http://localhost:3001
LOG_LEVEL=info
"""
            api_env_path.write_text(api_env_content)
            print(f"✅ Created: {api_env_path}")
        else:
            print(f"⚠️ Already exists: {api_env_path}")
            
    def install_dependencies(self):
        """Install all dependencies"""
        print("\n📦 Installing dependencies...")
        
        # Install API dependencies
        api_dir = self.script_dir / "trainforge" / "api"
        if api_dir.exists():
            print("Installing API dependencies...")
            result = subprocess.run(["npm", "install"], cwd=api_dir, capture_output=True, text=True)
            if result.returncode == 0:
                print("✅ API dependencies installed")
            else:
                print(f"❌ Failed to install API dependencies: {result.stderr}")
                self.errors.append("API dependency installation failed")
                
        # Install Dashboard dependencies
        dashboard_dir = self.script_dir / "trainforge" / "dashboard"
        if dashboard_dir.exists():
            print("Installing Dashboard dependencies...")
            result = subprocess.run(["npm", "install"], cwd=dashboard_dir, capture_output=True, text=True)
            if result.returncode == 0:
                print("✅ Dashboard dependencies installed")
            else:
                print(f"❌ Failed to install Dashboard dependencies: {result.stderr}")
                self.errors.append("Dashboard dependency installation failed")
                
        # Install CLI
        cli_dir = self.script_dir / "trainforge" / "cli"
        if cli_dir.exists():
            print("Installing CLI...")
            result = subprocess.run([sys.executable, "-m", "pip", "install", "-e", "."], 
                                  cwd=cli_dir, capture_output=True, text=True)
            if result.returncode == 0:
                print("✅ CLI installed")
            else:
                print(f"❌ Failed to install CLI: {result.stderr}")
                self.errors.append("CLI installation failed")
                
        # Install Scheduler dependencies
        scheduler_dir = self.script_dir / "trainforge" / "scheduler"
        if scheduler_dir.exists():
            requirements_file = scheduler_dir / "src" / "requirements.txt"
            if requirements_file.exists():
                print("Installing Scheduler dependencies...")
                result = subprocess.run([sys.executable, "-m", "pip", "install", "-r", str(requirements_file)], 
                                      capture_output=True, text=True)
                if result.returncode == 0:
                    print("✅ Scheduler dependencies installed")
                else:
                    print(f"❌ Failed to install Scheduler dependencies: {result.stderr}")
                    self.warnings.append("Scheduler dependency installation failed")
                    
        # Install Worker dependencies
        worker_dir = self.script_dir / "trainforge" / "worker"
        if worker_dir.exists():
            requirements_file = worker_dir / "requirements.txt"
            if requirements_file.exists():
                print("Installing Worker dependencies...")
                result = subprocess.run([sys.executable, "-m", "pip", "install", "-r", str(requirements_file)], 
                                      capture_output=True, text=True)
                if result.returncode == 0:
                    print("✅ Worker dependencies installed")
                else:
                    print(f"❌ Failed to install Worker dependencies: {result.stderr}")
                    self.warnings.append("Worker dependency installation failed")
                    
    def run_setup(self):
        """Run the complete setup process"""
        self.print_header()
        
        print("🔍 Checking system requirements...")
        
        # Check basic requirements
        self.check_command("node", "Node.js", "https://nodejs.org")
        self.check_command("npm", "npm", "Comes with Node.js")
        
        python_cmd = "python3" if self.platform != "windows" else "python"
        self.check_command(python_cmd, "Python", "https://python.org")
        self.check_command("pip", "pip", "Comes with Python")
        
        # Check MongoDB
        has_mongosh = self.check_command("mongosh", "MongoDB Shell", "https://mongodb.com")
        if has_mongosh:
            self.check_mongodb_connection()
            
        print("\n🔍 Checking project dependencies...")
        
        # Check Node.js projects
        self.check_node_package(self.script_dir / "trainforge" / "api", "API")
        self.check_node_package(self.script_dir / "trainforge" / "dashboard", "Dashboard")
        
        # Check Python packages (optional)
        self.check_python_package("requests", "pip install requests")
        self.check_python_package("flask", "pip install flask")
        
        # Create environment files
        self.create_env_files()
        
        # Ask user if they want to install dependencies
        if self.warnings:
            print(f"\n⚠️ Found {len(self.warnings)} warnings:")
            for warning in self.warnings:
                print(f"  - {warning}")
                
        if self.errors:
            print(f"\n❌ Found {len(self.errors)} critical errors:")
            for error in self.errors:
                print(f"  - {error}")
            print("\nPlease fix these errors before proceeding.")
        else:
            print("\n✅ All critical requirements met!")
            
            install = input("\n🤔 Install missing dependencies? (y/N): ").lower().strip()
            if install in ['y', 'yes']:
                self.install_dependencies()
                
        print("\n" + "=" * 50)
        print("🎉 Setup complete!")
        print("\nNext steps:")
        print("1. Start MongoDB if not running")
        if self.platform == "windows":
            print("2. Run: start-trainforge.bat")
        else:
            print("2. Run: ./start-trainforge.sh")
        print("3. Open http://localhost:3001 in your browser")
        print("=" * 50)

def main():
    setup = TrainForgeSetup()
    setup.run_setup()

if __name__ == "__main__":
    main()