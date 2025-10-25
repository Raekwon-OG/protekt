#!/usr/bin/env python3
"""
Restart script for Protekt Agent
"""

import os
import sys
import signal
import time
import subprocess

def find_agent_processes():
    """Find running agent processes"""
    try:
        result = subprocess.run(['tasklist', '/FI', 'IMAGENAME eq python.exe', '/FO', 'CSV'], 
                              capture_output=True, text=True)
        lines = result.stdout.split('\n')
        agent_processes = []
        
        for line in lines:
            if 'main.py' in line or 'protekt' in line.lower():
                parts = line.split(',')
                if len(parts) > 1:
                    pid = parts[1].strip('"')
                    agent_processes.append(pid)
        
        return agent_processes
    except Exception as e:
        print(f"Error finding processes: {e}")
        return []

def stop_agent():
    """Stop running agent processes"""
    processes = find_agent_processes()
    
    if not processes:
        print("No running agent processes found")
        return True
    
    print(f"Found {len(processes)} agent processes, stopping...")
    
    for pid in processes:
        try:
            os.kill(int(pid), signal.SIGTERM)
            print(f"Stopped process {pid}")
        except Exception as e:
            print(f"Error stopping process {pid}: {e}")
    
    # Wait a moment for processes to stop
    time.sleep(2)
    
    # Check if any are still running
    remaining = find_agent_processes()
    if remaining:
        print(f"Force killing remaining processes: {remaining}")
        for pid in remaining:
            try:
                os.kill(int(pid), signal.SIGKILL)
            except Exception:
                pass
    
    return True

def start_agent():
    """Start the agent"""
    print("Starting Protekt Agent...")
    try:
        subprocess.Popen([sys.executable, 'main.py'])
        print("Agent started successfully")
        return True
    except Exception as e:
        print(f"Error starting agent: {e}")
        return False

def main():
    """Main restart function"""
    print("Protekt Agent Restart Script")
    print("=" * 30)
    
    # Stop existing agent
    if stop_agent():
        print("Agent stopped successfully")
    else:
        print("Failed to stop agent")
        return
    
    # Wait a moment
    time.sleep(1)
    
    # Start agent
    if start_agent():
        print("Agent restarted successfully")
        print("\nThe agent is now running with the following improvements:")
        print("- Reduced false positive process detection")
        print("- Excluded System Idle Process from high CPU alerts")
        print("- Disabled file system monitoring (temporarily)")
        print("- Reduced anomaly detection sensitivity")
    else:
        print("Failed to start agent")

if __name__ == "__main__":
    main()
