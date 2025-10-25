#!/usr/bin/env python3
"""
Protekt Agent - Simple Deployment Script
For non-technical users
"""

import os
import sys
import subprocess
import shutil
from pathlib import Path

def deploy_agent():
    """Simple deployment for non-technical users"""
    print("🛡️ Protekt Agent - Simple Deployment")
    print("=" * 50)
    
    # Check if Python is installed
    try:
        python_version = sys.version_info
        if python_version < (3, 8):
            print("❌ Python 3.8 or higher is required")
            print("Please install Python from: https://python.org")
            return False
        print(f"✅ Python {python_version.major}.{python_version.minor} detected")
    except Exception:
        print("❌ Python not found")
        return False
    
    # Install dependencies
    print("\n📦 Installing dependencies...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("✅ Dependencies installed")
    except Exception as e:
        print(f"❌ Failed to install dependencies: {e}")
        return False
    
    # Create directories
    print("\n📁 Creating directories...")
    directories = ["data", "backups", "quarantine", "data/logs"]
    for directory in directories:
        Path(directory).mkdir(parents=True, exist_ok=True)
        print(f"✅ Created: {directory}")
    
    # Create desktop shortcut (Windows)
    if sys.platform == "win32":
        create_desktop_shortcut()
    
    # Create startup script
    create_startup_script()
    
    print("\n🎉 Deployment Complete!")
    print("\n📋 Next Steps:")
    print("1. Configure config.ini with your organization's settings")
    print("2. Run: python main.py")
    print("3. Or double-click: start_agent.bat")
    
    return True

def create_desktop_shortcut():
    """Create desktop shortcut for Windows"""
    try:
        desktop = Path.home() / "Desktop"
        shortcut_path = desktop / "Protekt Agent.lnk"
        
        # Create batch file
        batch_content = '''@echo off
cd /d "%~dp0"
python main.py
pause
'''
        
        batch_file = Path("start_agent.bat")
        with open(batch_file, 'w') as f:
            f.write(batch_content)
        
        print("✅ Created start_agent.bat")
        
    except Exception as e:
        print(f"⚠️ Could not create shortcut: {e}")

def create_startup_script():
    """Create startup script"""
    startup_content = '''@echo off
REM Protekt Agent Startup Script
echo Starting Protekt Agent...

cd /d "%~dp0"

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python is not installed or not in PATH
    echo Please install Python 3.8 or higher
    pause
    exit /b 1
)

REM Start the agent
python main.py

REM If the agent exits, show message
if errorlevel 1 (
    echo.
    echo Protekt Agent stopped unexpectedly
    echo Check the logs in data/logs/ for more information
    pause
) else (
    echo.
    echo Protekt Agent stopped normally
)
'''
    
    with open("start_agent.bat", "w") as f:
        f.write(startup_content)
    
    print("✅ Created start_agent.bat")

def main():
    """Main deployment function"""
    success = deploy_agent()
    
    if success:
        print("\n✅ Protekt Agent deployed successfully!")
        print("\n🔧 Configuration:")
        print("Edit config.ini to set:")
        print("  • SaaS backend URL")
        print("  • Alert settings (WhatsApp, email)")
        print("  • Monitoring thresholds")
        
        print("\n🚀 Running the Agent:")
        print("  • Double-click: start_agent.bat")
        print("  • Or run: python main.py")
        
        print("\n📊 Monitoring:")
        print("  • View logs: data/logs/")
        print("  • Check data: python inspect_data.py")
        print("  • Run tests: python test_agent.py")
    else:
        print("\n❌ Deployment failed!")
        print("Please check the errors above and try again.")

if __name__ == "__main__":
    main()
