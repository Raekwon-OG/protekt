#!/usr/bin/env python3
"""
Protekt Agent - Lightweight offline-first Python agent for SME device monitoring
"""

import sys
import os
import logging
import signal
import threading
import time
from pathlib import Path

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.config import Config
from core.logger import setup_logging
from core.database import Database
from services.registration import DeviceRegistration
from services.telemetry import TelemetryCollector
from services.file_watcher import FileWatcher
from services.anomaly_detector import AnomalyDetector
from services.backup_manager import BackupManager
from services.command_processor import CommandProcessor
from services.alert_manager import AlertManager
from services.offline_queue import OfflineQueue

class ProtektAgent:
    """Main agent class that orchestrates all monitoring and security services"""
    
    def __init__(self):
        self.config = Config()
        self.logger = setup_logging(self.config)
        self.db = Database(self.config)
        self.running = False
        self.threads = []
        
        # Initialize services
        self.registration = DeviceRegistration(self.config, self.db, self.logger)
        self.telemetry = TelemetryCollector(self.config, self.db, self.logger)
        self.file_watcher = FileWatcher(self.config, self.db, self.logger)
        self.anomaly_detector = AnomalyDetector(self.config, self.db, self.logger)
        self.backup_manager = BackupManager(self.config, self.db, self.logger)
        self.command_processor = CommandProcessor(self.config, self.db, self.logger)
        self.alert_manager = AlertManager(self.config, self.db, self.logger)
        self.offline_queue = OfflineQueue(self.config, self.db, self.logger)
        
        # Setup signal handlers for graceful shutdown
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
    
    def _signal_handler(self, signum, frame):
        """Handle shutdown signals gracefully"""
        self.logger.info(f"Received signal {signum}, shutting down gracefully...")
        self.stop()
    
    def start(self):
        """Start the agent and all its services"""
        try:
            self.logger.info("Starting Protekt Agent...")
            self.running = True
            
            # Initialize database
            self.db.initialize()
            
            # Register device (online or offline)
            if not self.registration.is_registered():
                self.registration.register()
            
            # Start core services
            self._start_service("TelemetryCollector", self.telemetry.start)
            self._start_service("FileWatcher", self.file_watcher.start)
            self._start_service("AnomalyDetector", self.anomaly_detector.start)
            self._start_service("BackupManager", self.backup_manager.start)
            self._start_service("CommandProcessor", self.command_processor.start)
            self._start_service("AlertManager", self.alert_manager.start)
            self._start_service("OfflineQueue", self.offline_queue.start)
            
            self.logger.info("Protekt Agent started successfully")
            
            # Keep main thread alive
            while self.running:
                time.sleep(1)
                
        except Exception as e:
            self.logger.error(f"Failed to start agent: {e}")
            self.stop()
            raise
    
    def _start_service(self, name, service_func):
        """Start a service in a separate thread"""
        def service_wrapper():
            try:
                self.logger.info(f"Starting {name}...")
                service_func()
            except Exception as e:
                self.logger.error(f"Error in {name}: {e}")
        
        thread = threading.Thread(target=service_wrapper, name=name, daemon=True)
        thread.start()
        self.threads.append(thread)
    
    def stop(self):
        """Stop the agent and all its services"""
        self.logger.info("Stopping Protekt Agent...")
        self.running = False
        
        # Stop all services
        services = [
            self.telemetry,
            self.file_watcher,
            self.anomaly_detector,
            self.backup_manager,
            self.command_processor,
            self.alert_manager,
            self.offline_queue
        ]
        
        for service in services:
            try:
                if hasattr(service, 'stop'):
                    service.stop()
            except Exception as e:
                self.logger.error(f"Error stopping service {service.__class__.__name__}: {e}")
        
        # Wait for threads to finish
        for thread in self.threads:
            if thread.is_alive():
                thread.join(timeout=5)
        
        self.logger.info("Protekt Agent stopped")

def main():
    """Main entry point"""
    agent = ProtektAgent()
    try:
        agent.start()
    except KeyboardInterrupt:
        agent.stop()
    except Exception as e:
        logging.error(f"Fatal error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
