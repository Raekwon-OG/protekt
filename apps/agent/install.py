#!/usr/bin/env python3
"""
Installation script for Protekt Agent
"""

import os
import sys
import subprocess
import shutil
from pathlib import Path

def install_agent():
    """Install Protekt Agent"""
    print("Installing Protekt Agent...")
    
    # Check Python version
    if sys.version_info < (3, 8):
        print("Error: Python 3.8 or higher is required")
        sys.exit(1)
    
    # Install dependencies
    print("Installing dependencies...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("Dependencies installed successfully")
    except subprocess.CalledProcessError as e:
        print(f"Error installing dependencies: {e}")
        sys.exit(1)
    
    # Create data directories
    data_dir = Path("data")
    backup_dir = Path("backups")
    quarantine_dir = Path("quarantine")
    
    for directory in [data_dir, backup_dir, quarantine_dir]:
        directory.mkdir(exist_ok=True)
        print(f"Created directory: {directory}")
    
    # Create Windows service (if on Windows)
    if sys.platform == "win32":
        create_windows_service()
    
    print("Protekt Agent installed successfully!")
    print("\nNext steps:")
    print("1. Configure config.ini with your SaaS backend details")
    print("2. Run: python main.py")

def create_windows_service():
    """Create Windows service for the agent"""
    try:
        # Install pywin32 if not already installed
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pywin32"])
        
        # Create service script
        service_script = """
import win32serviceutil
import win32service
import win32event
import servicemanager
import sys
import os

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import ProtektAgent

class ProtektAgentService(win32serviceutil.ServiceFramework):
    _svc_name_ = "ProtektAgent"
    _svc_display_name_ = "Protekt Agent"
    _svc_description_ = "Protekt Agent - SME Device Monitoring Service"
    
    def __init__(self, args):
        win32serviceutil.ServiceFramework.__init__(self, args)
        self.hWaitStop = win32event.CreateEvent(None, 0, 0, None)
        self.agent = None
    
    def SvcStop(self):
        self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
        win32event.SetEvent(self.hWaitStop)
        if self.agent:
            self.agent.stop()
    
    def SvcDoRun(self):
        servicemanager.LogMsg(servicemanager.EVENTLOG_INFORMATION_TYPE,
                            servicemanager.PYS_SERVICE_STARTED,
                            (self._svc_name_, ''))
        self.main()
    
    def main(self):
        try:
            self.agent = ProtektAgent()
            self.agent.start()
        except Exception as e:
            servicemanager.LogErrorMsg(f"Protekt Agent error: {e}")

if __name__ == '__main__':
    win32serviceutil.HandleCommandLine(ProtektAgentService)
"""
        
        with open("protekt_service.py", "w") as f:
            f.write(service_script)
        
        print("Windows service script created: protekt_service.py")
        print("To install service: python protekt_service.py install")
        print("To start service: python protekt_service.py start")
        
    except Exception as e:
        print(f"Warning: Could not create Windows service: {e}")

if __name__ == "__main__":
    install_agent()
