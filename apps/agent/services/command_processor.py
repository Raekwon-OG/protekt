"""
Command processing service for executing commands from SaaS backend
"""

import json
import logging
import threading
import time
import subprocess
import requests
from typing import Dict, Any, Optional, List
from datetime import datetime
import uuid

class CommandProcessor:
    """Processes commands received from SaaS backend"""
    
    def __init__(self, config, db, logger):
        self.config = config
        self.db = db
        self.logger = logger
        self.running = False
        self.thread = None
        
        # Command polling configuration
        self.base_url = config.get('saas', 'base_url')
        self.api_key = config.get('saas', 'api_key')
        self.device_id = config.get_device_id()
        self.poll_interval = config.getint('saas', 'command_poll_interval', 60)
        self.max_retries = config.getint('saas', 'max_retries', 3)
        
        # Command handlers
        self.command_handlers = {
            'backup': self._handle_backup_command,
            'restore': self._handle_restore_command,
            'scan': self._handle_scan_command,
            'isolate': self._handle_isolate_command,
            'update_config': self._handle_update_config_command,
            'shutdown': self._handle_shutdown_command,
            'restart': self._handle_restart_command,
            'get_status': self._handle_get_status_command,
            'get_logs': self._handle_get_logs_command
        }
    
    def start(self):
        """Start command processing service"""
        if self.running:
            return
        
        self.running = True
        self.thread = threading.Thread(target=self._command_loop, daemon=True)
        self.thread.start()
        self.logger.info("Command processor started")
    
    def stop(self):
        """Stop command processing service"""
        self.running = False
        if self.thread:
            self.thread.join(timeout=5)
        self.logger.info("Command processor stopped")
    
    def _command_loop(self):
        """Main command processing loop"""
        while self.running:
            try:
                # Poll for new commands
                commands = self._poll_commands()
                
                # Process each command
                for command in commands:
                    self._process_command(command)
                
                # Process offline queue
                self._process_offline_queue()
                
                time.sleep(self.poll_interval)
                
            except Exception as e:
                self.logger.error(f"Error in command processing: {e}")
                time.sleep(60)
    
    def _poll_commands(self) -> List[Dict[str, Any]]:
        """Poll SaaS backend for new commands"""
        if not self.base_url or not self.api_key:
            return []
        
        try:
            headers = {
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json'
            }
            
            response = requests.get(
                f"{self.base_url}/api/devices/{self.device_id}/commands",
                headers=headers,
                timeout=self.config.getint('saas', 'timeout', 30)
            )
            
            if response.status_code == 200:
                data = response.json()
                return data.get('commands', [])
            else:
                self.logger.warning(f"Failed to poll commands: {response.status_code}")
                return []
                
        except Exception as e:
            self.logger.error(f"Error polling commands: {e}")
            return []
    
    def _process_command(self, command: Dict[str, Any]):
        """Process a single command"""
        command_id = command.get('id')
        command_type = command.get('type')
        parameters = command.get('parameters', {})
        
        if not command_id or not command_type:
            self.logger.error("Invalid command format")
            return
        
        self.logger.info(f"Processing command: {command_type} (ID: {command_id})")
        
        # Record command in database
        self._record_command(command_id, command_type, parameters, 'received')
        
        try:
            # Execute command
            result = self._execute_command(command_type, parameters)
            
            # Update command status
            self._update_command_status(command_id, 'completed', result)
            
            # Send result back to SaaS
            self._send_command_result(command_id, result)
            
        except Exception as e:
            self.logger.error(f"Error executing command {command_id}: {e}")
            error_result = {'error': str(e), 'success': False}
            self._update_command_status(command_id, 'failed', error_result)
            self._send_command_result(command_id, error_result)
    
    def _execute_command(self, command_type: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a command based on its type"""
        if command_type not in self.command_handlers:
            raise ValueError(f"Unknown command type: {command_type}")
        
        handler = self.command_handlers[command_type]
        return handler(parameters)
    
    def _handle_backup_command(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Handle backup command"""
        source_paths = parameters.get('source_paths', [])
        backup_type = parameters.get('backup_type', 'command')
        description = parameters.get('description', 'Command-triggered backup')
        
        if not source_paths:
            raise ValueError("No source paths specified for backup")
        
        # Import here to avoid circular imports
        from services.backup_manager import BackupManager
        backup_manager = BackupManager(self.config, self.db, self.logger)
        
        backup_id = backup_manager.create_backup(source_paths, backup_type, description)
        
        if backup_id:
            return {
                'success': True,
                'backup_id': backup_id,
                'message': f'Backup created successfully: {backup_id}'
            }
        else:
            raise Exception("Failed to create backup")
    
    def _handle_restore_command(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Handle restore command"""
        backup_id = parameters.get('backup_id')
        restore_path = parameters.get('restore_path')
        
        if not backup_id:
            raise ValueError("No backup ID specified for restore")
        
        # Import here to avoid circular imports
        from services.backup_manager import BackupManager
        backup_manager = BackupManager(self.config, self.db, self.logger)
        
        success = backup_manager.restore_backup(backup_id, restore_path)
        
        if success:
            return {
                'success': True,
                'message': f'Backup restored successfully: {backup_id}'
            }
        else:
            raise Exception("Failed to restore backup")
    
    def _handle_scan_command(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Handle scan command"""
        scan_type = parameters.get('scan_type', 'full')
        target_paths = parameters.get('target_paths', [])
        
        if scan_type == 'full':
            # Perform full system scan
            results = self._perform_full_scan()
        elif scan_type == 'targeted':
            # Scan specific paths
            results = self._perform_targeted_scan(target_paths)
        else:
            raise ValueError(f"Unknown scan type: {scan_type}")
        
        return {
            'success': True,
            'scan_type': scan_type,
            'results': results,
            'message': f'Scan completed: {scan_type}'
        }
    
    def _handle_isolate_command(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Handle isolate command (quarantine suspicious files)"""
        file_paths = parameters.get('file_paths', [])
        quarantine_dir = Path(self.config.get('security', 'quarantine_dir', './quarantine'))
        quarantine_dir.mkdir(parents=True, exist_ok=True)
        
        isolated_files = []
        
        for file_path in file_paths:
            try:
                source_path = Path(file_path)
                if source_path.exists():
                    # Move to quarantine
                    quarantine_path = quarantine_dir / source_path.name
                    source_path.rename(quarantine_path)
                    isolated_files.append(str(quarantine_path))
                    
                    # Log security event
                    self.db.log_security_event(
                        event_type='file_isolated',
                        severity='high',
                        description=f'File isolated: {file_path}',
                        file_path=file_path,
                        details={'quarantine_path': str(quarantine_path)}
                    )
            except Exception as e:
                self.logger.error(f"Failed to isolate file {file_path}: {e}")
        
        return {
            'success': True,
            'isolated_files': isolated_files,
            'message': f'Isolated {len(isolated_files)} files'
        }
    
    def _handle_update_config_command(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Handle configuration update command"""
        config_updates = parameters.get('config', {})
        
        updated_sections = []
        
        for section, settings in config_updates.items():
            for key, value in settings.items():
                self.config.set(section, key, str(value))
                updated_sections.append(f"{section}.{key}")
        
        return {
            'success': True,
            'updated_settings': updated_sections,
            'message': f'Updated {len(updated_sections)} configuration settings'
        }
    
    def _handle_shutdown_command(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Handle shutdown command"""
        delay = parameters.get('delay', 10)  # Default 10 second delay
        
        def shutdown_delayed():
            time.sleep(delay)
            import os
            os.system('shutdown /s /t 0')  # Windows shutdown
        
        threading.Thread(target=shutdown_delayed, daemon=True).start()
        
        return {
            'success': True,
            'message': f'System will shutdown in {delay} seconds'
        }
    
    def _handle_restart_command(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Handle restart command"""
        delay = parameters.get('delay', 10)  # Default 10 second delay
        
        def restart_delayed():
            time.sleep(delay)
            import os
            os.system('shutdown /r /t 0')  # Windows restart
        
        threading.Thread(target=restart_delayed, daemon=True).start()
        
        return {
            'success': True,
            'message': f'System will restart in {delay} seconds'
        }
    
    def _handle_get_status_command(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Handle get status command"""
        # Get system status
        import psutil
        
        status = {
            'cpu_percent': psutil.cpu_percent(),
            'memory_percent': psutil.virtual_memory().percent,
            'disk_usage': {},
            'uptime': time.time() - psutil.boot_time(),
            'processes': len(psutil.pids()),
            'agent_status': 'running'
        }
        
        # Get disk usage
        for partition in psutil.disk_partitions():
            try:
                usage = psutil.disk_usage(partition.mountpoint)
                status['disk_usage'][partition.mountpoint] = {
                    'total': usage.total,
                    'used': usage.used,
                    'free': usage.free,
                    'percent': (usage.used / usage.total) * 100
                }
            except PermissionError:
                continue
        
        return {
            'success': True,
            'status': status,
            'message': 'Status retrieved successfully'
        }
    
    def _handle_get_logs_command(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Handle get logs command"""
        log_type = parameters.get('log_type', 'agent')
        lines = parameters.get('lines', 100)
        
        log_file = Path(self.config.get('agent', 'data_dir', './data')) / 'logs' / f'{log_type}.log'
        
        if not log_file.exists():
            return {
                'success': False,
                'message': f'Log file not found: {log_file}'
            }
        
        try:
            with open(log_file, 'r') as f:
                log_lines = f.readlines()[-lines:]
            
            return {
                'success': True,
                'logs': log_lines,
                'message': f'Retrieved {len(log_lines)} log lines'
            }
        except Exception as e:
            return {
                'success': False,
                'message': f'Error reading logs: {e}'
            }
    
    def _perform_full_scan(self) -> Dict[str, Any]:
        """Perform full system scan"""
        # This would integrate with the file watcher and anomaly detector
        # For now, return a basic scan result
        
        scan_results = {
            'files_scanned': 0,
            'threats_found': 0,
            'suspicious_files': [],
            'scan_duration': 0
        }
        
        # Get recent security events
        cursor = self.db.connection.cursor()
        cursor.execute('''
            SELECT * FROM security_events 
            WHERE timestamp > datetime('now', '-1 hour')
            ORDER BY timestamp DESC
        ''')
        
        recent_events = cursor.fetchall()
        scan_results['threats_found'] = len(recent_events)
        scan_results['suspicious_files'] = [
            dict(event) for event in recent_events 
            if event['file_path']
        ]
        
        return scan_results
    
    def _perform_targeted_scan(self, target_paths: List[str]) -> Dict[str, Any]:
        """Perform targeted scan of specific paths"""
        scan_results = {
            'paths_scanned': target_paths,
            'files_scanned': 0,
            'threats_found': 0,
            'suspicious_files': []
        }
        
        for path in target_paths:
            path_obj = Path(path)
            if path_obj.exists():
                if path_obj.is_file():
                    scan_results['files_scanned'] += 1
                elif path_obj.is_dir():
                    scan_results['files_scanned'] += len(list(path_obj.rglob('*')))
        
        return scan_results
    
    def _record_command(self, command_id: str, command_type: str, parameters: Dict[str, Any], status: str):
        """Record command in database"""
        cursor = self.db.connection.cursor()
        cursor.execute('''
            INSERT OR REPLACE INTO command_history 
            (command_id, command_type, parameters, status, created_at)
            VALUES (?, ?, ?, ?, ?)
        ''', (command_id, command_type, json.dumps(parameters), status, datetime.utcnow().isoformat()))
        self.db.connection.commit()
    
    def _update_command_status(self, command_id: str, status: str, result: Dict[str, Any]):
        """Update command status in database"""
        cursor = self.db.connection.cursor()
        cursor.execute('''
            UPDATE command_history 
            SET status = ?, result = ?, completed_at = ?
            WHERE command_id = ?
        ''', (status, json.dumps(result), datetime.utcnow().isoformat(), command_id))
        self.db.connection.commit()
    
    def _send_command_result(self, command_id: str, result: Dict[str, Any]):
        """Send command result back to SaaS backend"""
        if not self.base_url or not self.api_key:
            # Queue for offline sync
            self.db.add_to_queue('command_result', {
                'command_id': command_id,
                'result': result
            })
            return
        
        try:
            headers = {
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json'
            }
            
            payload = {
                'command_id': command_id,
                'result': result,
                'completed_at': datetime.utcnow().isoformat()
            }
            
            response = requests.post(
                f"{self.base_url}/api/devices/{self.device_id}/command-result",
                json=payload,
                headers=headers,
                timeout=self.config.getint('saas', 'timeout', 30)
            )
            
            if response.status_code == 200:
                self.logger.debug(f"Command result sent successfully: {command_id}")
            else:
                self.logger.warning(f"Failed to send command result: {response.status_code}")
                # Queue for offline sync
                self.db.add_to_queue('command_result', {
                    'command_id': command_id,
                    'result': result
                })
                
        except Exception as e:
            self.logger.error(f"Error sending command result: {e}")
            # Queue for offline sync
            self.db.add_to_queue('command_result', {
                'command_id': command_id,
                'result': result
            })
    
    def _process_offline_queue(self):
        """Process commands from offline queue"""
        try:
            # Get pending command results from queue
            queue_items = self.db.get_queue_items('command_result', 'pending', 10)
            
            for item in queue_items:
                try:
                    payload = json.loads(item['payload'])
                    command_id = payload['command_id']
                    result = payload['result']
                    
                    # Try to send result
                    self._send_command_result(command_id, result)
                    
                    # Mark as completed
                    self.db.update_queue_item(item['id'], 'completed')
                    
                except Exception as e:
                    self.logger.error(f"Error processing offline command result: {e}")
                    self.db.update_queue_item(item['id'], 'failed')
                    
        except Exception as e:
            self.logger.error(f"Error processing offline queue: {e}")
    
    def get_command_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get command execution history"""
        cursor = self.db.connection.cursor()
        cursor.execute('''
            SELECT * FROM command_history 
            ORDER BY created_at DESC 
            LIMIT ?
        ''', (limit,))
        
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
