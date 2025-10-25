"""
File and process watcher for ransomware detection
"""

import os
import time
import threading
import logging
from pathlib import Path
from typing import List, Dict, Any, Set
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import psutil

class RansomwareDetector(FileSystemEventHandler):
    """File system event handler for ransomware detection"""
    
    def __init__(self, config, db, logger):
        self.config = config
        self.db = db
        self.logger = logger
        self.suspicious_extensions = set(config.get('security', 'suspicious_extensions', '.exe,.bat,.cmd,.scr,.pif,.com,.vbs,.js').split(','))
        self.max_file_size = config.getint('security', 'max_file_size', 104857600)  # 100MB
        self.watch_paths = self._parse_watch_paths()
        self.exclude_paths = self._parse_exclude_paths()
        
        # Ransomware detection state
        self.recent_events = []  # Track recent file events
        self.mass_operations = {}  # Track mass file operations
        self.suspicious_processes = set()
        self.encryption_patterns = ['.encrypted', '.locked', '.crypto', '.crypt']
        
        # Thresholds for detection
        self.mass_write_threshold = 50  # Files per minute
        self.mass_rename_threshold = 30  # Renames per minute
        self.suspicious_extension_threshold = 10  # Suspicious files per minute
    
    def _parse_watch_paths(self) -> List[Path]:
        """Parse watch paths from configuration"""
        paths_str = self.config.get('monitoring', 'file_watch_paths', 'C:\\Users,C:\\Program Files,C:\\Windows\\System32')
        return [Path(p.strip()) for p in paths_str.split(',') if Path(p.strip()).exists()]
    
    def _parse_exclude_paths(self) -> List[Path]:
        """Parse exclude paths from configuration"""
        paths_str = self.config.get('monitoring', 'exclude_paths', 'C:\\Windows\\Temp,C:\\Users\\*\\AppData\\Local\\Temp')
        exclude_paths = []
        for p in paths_str.split(','):
            p = p.strip()
            if '*' in p:
                # Handle wildcard paths
                base_path = Path(p.split('*')[0])
                if base_path.exists():
                    exclude_paths.extend([child for child in base_path.iterdir() if child.is_dir()])
            else:
                path = Path(p)
                if path.exists():
                    exclude_paths.append(path)
        return exclude_paths
    
    def _should_ignore_path(self, path: Path) -> bool:
        """Check if path should be ignored"""
        for exclude_path in self.exclude_paths:
            try:
                if path.is_relative_to(exclude_path):
                    return True
            except (ValueError, OSError):
                continue
        return False
    
    def on_modified(self, event):
        """Handle file modification events"""
        if event.is_directory:
            return
        
        self._process_file_event('modified', event.src_path)
    
    def on_created(self, event):
        """Handle file creation events"""
        if event.is_directory:
            return
        
        self._process_file_event('created', event.src_path)
    
    def on_moved(self, event):
        """Handle file move/rename events"""
        if event.is_directory:
            return
        
        self._process_file_event('moved', event.src_path, event.dest_path)
    
    def on_deleted(self, event):
        """Handle file deletion events"""
        if event.is_directory:
            return
        
        self._process_file_event('deleted', event.src_path)
    
    def _process_file_event(self, event_type: str, src_path: str, dest_path: str = None):
        """Process file system event for ransomware detection"""
        try:
            path = Path(src_path)
            
            # Skip if path should be ignored
            if self._should_ignore_path(path):
                return
            
            # Skip if file is too large
            if path.exists() and path.stat().st_size > self.max_file_size:
                return
            
            current_time = time.time()
            event_data = {
                'type': event_type,
                'src_path': str(src_path),
                'dest_path': str(dest_path) if dest_path else None,
                'timestamp': current_time,
                'extension': path.suffix.lower(),
                'is_suspicious_extension': path.suffix.lower() in self.suspicious_extensions,
                'is_encryption_pattern': any(pattern in path.name.lower() for pattern in self.encryption_patterns)
            }
            
            # Add to recent events
            self.recent_events.append(event_data)
            
            # Clean old events (older than 5 minutes)
            self.recent_events = [e for e in self.recent_events if current_time - e['timestamp'] < 300]
            
            # Check for ransomware patterns
            self._check_ransomware_patterns()
            
        except Exception as e:
            self.logger.error(f"Error processing file event: {e}")
    
    def _check_ransomware_patterns(self):
        """Check for ransomware-like behavior patterns"""
        current_time = time.time()
        recent_time = current_time - 60  # Last minute
        
        # Filter recent events
        recent_events = [e for e in self.recent_events if e['timestamp'] > recent_time]
        
        if not recent_events:
            return
        
        # Count different types of operations
        created_count = len([e for e in recent_events if e['type'] == 'created'])
        modified_count = len([e for e in recent_events if e['type'] == 'modified'])
        moved_count = len([e for e in recent_events if e['type'] == 'moved'])
        deleted_count = len([e for e in recent_events if e['type'] == 'deleted'])
        
        # Check for mass file operations
        total_operations = created_count + modified_count + moved_count + deleted_count
        
        if total_operations > self.mass_write_threshold:
            self._trigger_alert('mass_file_operations', {
                'severity': 'high',
                'message': f'Mass file operations detected: {total_operations} operations in 1 minute',
                'created': created_count,
                'modified': modified_count,
                'moved': moved_count,
                'deleted': deleted_count,
                'threshold': self.mass_write_threshold
            })
        
        # Check for mass renames (potential encryption)
        if moved_count > self.mass_rename_threshold:
            self._trigger_alert('mass_renames', {
                'severity': 'high',
                'message': f'Mass file renames detected: {moved_count} renames in 1 minute',
                'count': moved_count,
                'threshold': self.mass_rename_threshold
            })
        
        # Check for suspicious file extensions
        suspicious_count = len([e for e in recent_events if e['is_suspicious_extension']])
        if suspicious_count > self.suspicious_extension_threshold:
            self._trigger_alert('suspicious_extensions', {
                'severity': 'medium',
                'message': f'Many suspicious file extensions detected: {suspicious_count} files in 1 minute',
                'count': suspicious_count,
                'threshold': self.suspicious_extension_threshold
            })
        
        # Check for encryption patterns
        encryption_count = len([e for e in recent_events if e['is_encryption_pattern']])
        if encryption_count > 5:  # Even a few encryption patterns are suspicious
            self._trigger_alert('encryption_patterns', {
                'severity': 'critical',
                'message': f'Encryption patterns detected: {encryption_count} files with encryption-like names',
                'count': encryption_count,
                'files': [e['src_path'] for e in recent_events if e['is_encryption_pattern']]
            })
        
        # Check for rapid file modifications (potential encryption)
        modified_files = [e for e in recent_events if e['type'] == 'modified']
        if len(modified_files) > 20:  # Many modifications in short time
            self._trigger_alert('rapid_modifications', {
                'severity': 'high',
                'message': f'Rapid file modifications detected: {len(modified_files)} files modified in 1 minute',
                'count': len(modified_files),
                'files': [e['src_path'] for e in modified_files[:10]]  # First 10 files
            })
    
    def _trigger_alert(self, alert_type: str, details: Dict[str, Any]):
        """Trigger a security alert"""
        self.logger.warning(f"Ransomware detection alert: {alert_type}")
        
        # Log security event
        self.db.log_security_event(
            event_type='ransomware_detection',
            severity=details['severity'],
            description=details['message'],
            details=details
        )
        
        # Log audit event
        self.db.log_audit(
            action='ransomware_alert_triggered',
            resource=alert_type,
            details=details
        )

class ProcessWatcher:
    """Monitor processes for suspicious behavior"""
    
    def __init__(self, config, db, logger):
        self.config = config
        self.db = db
        self.logger = logger
        self.running = False
        self.thread = None
        self.check_interval = 30  # Check every 30 seconds
        self.suspicious_processes = set()
        self.known_processes = set()
    
    def start(self):
        """Start process monitoring"""
        if self.running:
            return
        
        self.running = True
        self.thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self.thread.start()
        self.logger.info("Process monitoring started")
    
    def stop(self):
        """Stop process monitoring"""
        self.running = False
        if self.thread:
            self.thread.join(timeout=5)
        self.logger.info("Process monitoring stopped")
    
    def _monitor_loop(self):
        """Main process monitoring loop"""
        while self.running:
            try:
                self._check_processes()
                time.sleep(self.check_interval)
            except Exception as e:
                self.logger.error(f"Error in process monitoring: {e}")
                time.sleep(60)
    
    def _check_processes(self):
        """Check running processes for suspicious behavior"""
        try:
            current_processes = set()
            
            for proc in psutil.process_iter(['pid', 'name', 'exe', 'cmdline', 'cpu_percent', 'memory_percent']):
                try:
                    proc_info = proc.info
                    current_processes.add(proc_info['name'].lower())
                    
                    # Check for suspicious process names
                    if self._is_suspicious_process(proc_info):
                        self._handle_suspicious_process(proc_info)
                    
                    # Check for high resource usage
                    if proc_info['cpu_percent'] > 80 or proc_info['memory_percent'] > 80:
                        self._handle_high_resource_process(proc_info)
                        
                except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                    continue
            
            # Check for new processes
            new_processes = current_processes - self.known_processes
            if new_processes:
                self.logger.debug(f"New processes detected: {new_processes}")
                self.known_processes = current_processes
            
        except Exception as e:
            self.logger.error(f"Error checking processes: {e}")
    
    def _is_suspicious_process(self, proc_info: Dict[str, Any]) -> bool:
        """Check if process is suspicious"""
        name = proc_info['name'].lower().strip()
        cmdline = ' '.join(proc_info['cmdline']) if proc_info['cmdline'] else ''
        
        # Skip empty or invalid process names
        if not name or name == '':
            return False
        
        # Skip known safe processes
        safe_processes = [
            'system idle process', 'system', 'csrss', 'winlogon', 'wininit',
            'services', 'lsass', 'svchost', 'explorer', 'dwm', 'conhost',
            'slack', 'slack.exe', 'msedge', 'msedgewebview2', 'msedgewebview2.exe', 
            'chrome', 'firefox', 'notepad', 'calc', 'lockapp', 'lockapp.exe', 
            'searchapp', 'shellexperiencehost', 'runtimebroker', 'dllhost', 'wmiprvse', 
            'taskhostw', 'audiodg', 'spoolsv', 'winlogon.exe', 'csrss.exe',
            'services.exe', 'lsass.exe', 'svchost.exe', 'explorer.exe',
            'dwm.exe', 'conhost.exe', 'searchapp.exe', 'shellexperiencehost.exe',
            'runtimebroker.exe', 'dllhost.exe', 'wmiprvse.exe', 'taskhostw.exe',
            'audiodg.exe', 'spoolsv.exe'
        ]
        
        if name in safe_processes:
            return False
        
        # Skip System Idle Process (it's normal to have high CPU usage)
        if 'system idle process' in name or 'idle' in name:
            return False
        
        # Suspicious process names
        suspicious_names = [
            'crypt', 'encrypt', 'lock', 'ransom', 'malware', 'virus',
            'backdoor', 'trojan', 'worm', 'keylogger', 'rootkit'
        ]
        
        # Check process name
        for suspicious in suspicious_names:
            if suspicious in name:
                return True
        
        # Check command line
        for suspicious in suspicious_names:
            if suspicious in cmdline.lower():
                return True
        
        # Check for processes with no executable path (potential malware)
        # But be more lenient - only flag if name is also suspicious
        if not proc_info['exe'] and name and len(name) > 3:
            # Only flag if the name looks suspicious
            for suspicious in suspicious_names:
                if suspicious in name:
                    return True
        
        return False
    
    def _handle_suspicious_process(self, proc_info: Dict[str, Any]):
        """Handle suspicious process detection"""
        self.logger.warning(f"Suspicious process detected: {proc_info['name']} (PID: {proc_info['pid']})")
        
        self.db.log_security_event(
            event_type='suspicious_process',
            severity='high',
            description=f"Suspicious process detected: {proc_info['name']}",
            process_name=proc_info['name'],
            details={
                'pid': proc_info['pid'],
                'exe': proc_info['exe'],
                'cmdline': proc_info['cmdline']
            }
        )
    
    def _handle_high_resource_process(self, proc_info: Dict[str, Any]):
        """Handle high resource usage process"""
        # Skip System Idle Process - it's normal for it to show high CPU usage
        if 'system idle process' in proc_info['name'].lower() or 'idle' in proc_info['name'].lower():
            return
            
        if proc_info['cpu_percent'] > 80:
            self.logger.warning(f"High CPU process: {proc_info['name']} ({proc_info['cpu_percent']:.1f}%)")
            
            self.db.log_security_event(
                event_type='high_resource_usage',
                severity='medium',
                description=f"High CPU usage: {proc_info['name']} ({proc_info['cpu_percent']:.1f}%)",
                process_name=proc_info['name'],
                details={
                    'pid': proc_info['pid'],
                    'cpu_percent': proc_info['cpu_percent'],
                    'memory_percent': proc_info['memory_percent']
                }
            )

class FileWatcher:
    """Main file watcher service"""
    
    def __init__(self, config, db, logger):
        self.config = config
        self.db = db
        self.logger = logger
        self.observer = None
        self.detector = None
        self.process_watcher = None
        self.running = False
    
    def start(self):
        """Start file and process watching"""
        if self.running:
            return
        
        try:
            # Initialize ransomware detector
            self.detector = RansomwareDetector(self.config, self.db, self.logger)
            
            # Initialize process watcher
            self.process_watcher = ProcessWatcher(self.config, self.db, self.logger)
            
            # Start process monitoring
            self.process_watcher.start()
            
            # Start file system monitoring (disabled for now due to threading issues)
            self.observer = None
            self.running = True
            self.logger.info("File watcher started with process monitoring only (file system monitoring disabled)")
            
            # TODO: Fix file system monitoring threading issue
            # self.observer = Observer()
            # for watch_path in self.detector.watch_paths:
            #     try:
            #         self.observer.schedule(self.detector, str(watch_path), recursive=True)
            #     except Exception as e:
            #         self.logger.warning(f"Could not watch path {watch_path}: {e}")
            # 
            # try:
            #     self.observer.start()
            #     self.logger.info(f"File watcher started monitoring {len(self.detector.watch_paths)} paths")
            # except Exception as e:
            #     self.logger.error(f"Failed to start file system observer: {e}")
            #     self.logger.info("File watcher started without file system monitoring")
                
        except Exception as e:
            self.logger.error(f"Failed to start file watcher: {e}")
            self.stop()
            raise
    
    def stop(self):
        """Stop file and process watching"""
        self.running = False
        
        if self.process_watcher:
            self.process_watcher.stop()
        
        if self.observer and self.observer.is_alive():
            self.observer.stop()
            self.observer.join(timeout=5)
        
        self.logger.info("File watcher stopped")
