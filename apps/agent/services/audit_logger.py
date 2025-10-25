"""
Comprehensive audit logging and rollback system
"""

import json
import logging
import hashlib
import shutil
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import sqlite3

class AuditLogger:
    """Comprehensive audit logging and rollback system"""
    
    def __init__(self, config, db, logger):
        self.config = config
        self.db = db
        self.logger = logger
        
        # Audit configuration
        self.audit_enabled = True
        self.retention_days = 90
        self.rollback_enabled = True
        self.rollback_dir = Path(config.get('agent', 'data_dir', './data')) / 'rollbacks'
        self.rollback_dir.mkdir(parents=True, exist_ok=True)
        
        # Audit categories
        self.audit_categories = {
            'system': ['startup', 'shutdown', 'restart', 'config_change'],
            'security': ['login', 'logout', 'file_access', 'process_creation', 'network_access'],
            'backup': ['backup_create', 'backup_restore', 'backup_delete', 'backup_upload'],
            'command': ['command_received', 'command_executed', 'command_failed'],
            'alert': ['alert_sent', 'alert_acknowledged'],
            'file': ['file_create', 'file_modify', 'file_delete', 'file_move'],
            'process': ['process_start', 'process_stop', 'process_suspend'],
            'network': ['connection_open', 'connection_close', 'data_sent', 'data_received']
        }
    
    def log_action(self, action: str, resource: str = None, details: Dict[str, Any] = None, 
                   user_context: str = None, category: str = 'system'):
        """Log an audit action"""
        try:
            # Validate category
            if category not in self.audit_categories:
                category = 'system'
            
            # Create audit record
            audit_record = {
                'action': action,
                'resource': resource,
                'details': details or {},
                'user_context': user_context,
                'category': category,
                'timestamp': datetime.utcnow().isoformat(),
                'device_id': self.config.get_device_id(),
                'session_id': self._get_session_id()
            }
            
            # Store in database
            self._store_audit_record(audit_record)
            
            # Create rollback point if needed
            if self.rollback_enabled and self._should_create_rollback(action, category):
                self._create_rollback_point(action, resource, details)
            
            self.logger.debug(f"Audit logged: {action} on {resource}")
            
        except Exception as e:
            self.logger.error(f"Error logging audit action: {e}")
    
    def _store_audit_record(self, record: Dict[str, Any]):
        """Store audit record in database"""
        cursor = self.db.connection.cursor()
        cursor.execute('''
            INSERT INTO audit_log 
            (action, resource, details, user_context, timestamp, category)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            record['action'],
            record['resource'],
            json.dumps(record['details']),
            record['user_context'],
            record['timestamp'],
            record['category']
        ))
        self.db.connection.commit()
    
    def _get_session_id(self) -> str:
        """Get current session ID"""
        # In a real implementation, this would track user sessions
        return f"session_{int(datetime.utcnow().timestamp())}"
    
    def _should_create_rollback(self, action: str, category: str) -> bool:
        """Determine if a rollback point should be created"""
        # Create rollback points for critical actions
        critical_actions = [
            'config_change', 'backup_restore', 'command_executed',
            'file_delete', 'process_stop'
        ]
        
        return action in critical_actions
    
    def _create_rollback_point(self, action: str, resource: str, details: Dict[str, Any]):
        """Create a rollback point for the current state"""
        try:
            rollback_id = f"rollback_{int(datetime.utcnow().timestamp())}"
            rollback_path = self.rollback_dir / f"{rollback_id}.json"
            
            # Create rollback data
            rollback_data = {
                'rollback_id': rollback_id,
                'action': action,
                'resource': resource,
                'details': details,
                'timestamp': datetime.utcnow().isoformat(),
                'device_state': self._capture_device_state(),
                'file_snapshots': self._capture_file_snapshots(resource),
                'process_snapshots': self._capture_process_snapshots()
            }
            
            # Save rollback point
            with open(rollback_path, 'w') as f:
                json.dump(rollback_data, f, indent=2)
            
            # Log rollback creation
            self.logger.info(f"Rollback point created: {rollback_id}")
            
        except Exception as e:
            self.logger.error(f"Error creating rollback point: {e}")
    
    def _capture_device_state(self) -> Dict[str, Any]:
        """Capture current device state"""
        try:
            import psutil
            
            state = {
                'timestamp': datetime.utcnow().isoformat(),
                'cpu_percent': psutil.cpu_percent(),
                'memory_percent': psutil.virtual_memory().percent,
                'disk_usage': {},
                'network_connections': [],
                'running_processes': []
            }
            
            # Disk usage
            for partition in psutil.disk_partitions():
                try:
                    usage = psutil.disk_usage(partition.mountpoint)
                    state['disk_usage'][partition.mountpoint] = {
                        'total': usage.total,
                        'used': usage.used,
                        'free': usage.free
                    }
                except PermissionError:
                    continue
            
            # Network connections
            for conn in psutil.net_connections(kind='inet'):
                state['network_connections'].append({
                    'family': conn.family.name,
                    'type': conn.type.name,
                    'laddr': conn.laddr,
                    'raddr': conn.raddr,
                    'status': conn.status
                })
            
            # Running processes
            for proc in psutil.process_iter(['pid', 'name', 'exe', 'cmdline']):
                try:
                    state['running_processes'].append(proc.info)
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
            
            return state
            
        except Exception as e:
            self.logger.error(f"Error capturing device state: {e}")
            return {}
    
    def _capture_file_snapshots(self, resource: str) -> Dict[str, Any]:
        """Capture file snapshots for rollback"""
        snapshots = {}
        
        if resource and Path(resource).exists():
            try:
                file_path = Path(resource)
                if file_path.is_file():
                    # Create backup of file
                    backup_path = self.rollback_dir / f"file_backup_{file_path.name}_{int(datetime.utcnow().timestamp())}"
                    shutil.copy2(file_path, backup_path)
                    
                    snapshots[str(file_path)] = {
                        'backup_path': str(backup_path),
                        'size': file_path.stat().st_size,
                        'modified': file_path.stat().st_mtime,
                        'checksum': self._calculate_file_checksum(file_path)
                    }
            except Exception as e:
                self.logger.error(f"Error capturing file snapshot: {e}")
        
        return snapshots
    
    def _capture_process_snapshots(self) -> Dict[str, Any]:
        """Capture process snapshots for rollback"""
        snapshots = {}
        
        try:
            import psutil
            
            for proc in psutil.process_iter(['pid', 'name', 'exe', 'cmdline', 'create_time']):
                try:
                    proc_info = proc.info
                    snapshots[str(proc_info['pid'])] = {
                        'name': proc_info['name'],
                        'exe': proc_info['exe'],
                        'cmdline': proc_info['cmdline'],
                        'create_time': proc_info['create_time']
                    }
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
                    
        except Exception as e:
            self.logger.error(f"Error capturing process snapshots: {e}")
        
        return snapshots
    
    def _calculate_file_checksum(self, file_path: Path) -> str:
        """Calculate file checksum for integrity verification"""
        try:
            hash_md5 = hashlib.md5()
            with open(file_path, "rb") as f:
                for chunk in iter(lambda: f.read(4096), b""):
                    hash_md5.update(chunk)
            return hash_md5.hexdigest()
        except Exception:
            return ""
    
    def get_audit_log(self, category: str = None, hours: int = 24, limit: int = 100) -> List[Dict[str, Any]]:
        """Get audit log entries"""
        try:
            cursor = self.db.connection.cursor()
            
            if category:
                cursor.execute('''
                    SELECT * FROM audit_log 
                    WHERE category = ? AND timestamp > datetime('now', '-{} hours')
                    ORDER BY timestamp DESC 
                    LIMIT ?
                '''.format(hours), (category, limit))
            else:
                cursor.execute('''
                    SELECT * FROM audit_log 
                    WHERE timestamp > datetime('now', '-{} hours')
                    ORDER BY timestamp DESC 
                    LIMIT ?
                '''.format(hours), (limit,))
            
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
            
        except Exception as e:
            self.logger.error(f"Error getting audit log: {e}")
            return []
    
    def get_rollback_points(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get available rollback points"""
        try:
            rollback_points = []
            
            for rollback_file in self.rollback_dir.glob("rollback_*.json"):
                try:
                    with open(rollback_file, 'r') as f:
                        data = json.load(f)
                        rollback_points.append(data)
                except Exception as e:
                    self.logger.error(f"Error reading rollback file {rollback_file}: {e}")
            
            # Sort by timestamp
            rollback_points.sort(key=lambda x: x['timestamp'], reverse=True)
            
            return rollback_points[:limit]
            
        except Exception as e:
            self.logger.error(f"Error getting rollback points: {e}")
            return []
    
    def execute_rollback(self, rollback_id: str) -> bool:
        """Execute a rollback to a previous state"""
        try:
            rollback_file = self.rollback_dir / f"{rollback_id}.json"
            
            if not rollback_file.exists():
                self.logger.error(f"Rollback file not found: {rollback_id}")
                return False
            
            # Load rollback data
            with open(rollback_file, 'r') as f:
                rollback_data = json.load(f)
            
            self.logger.info(f"Executing rollback: {rollback_id}")
            
            # Restore file snapshots
            for file_path, snapshot in rollback_data.get('file_snapshots', {}).items():
                self._restore_file_snapshot(file_path, snapshot)
            
            # Log rollback execution
            self.log_action(
                'rollback_executed',
                resource=rollback_id,
                details={'rollback_data': rollback_data},
                category='system'
            )
            
            self.logger.info(f"Rollback executed successfully: {rollback_id}")
            return True
            
        except Exception as e:
            self.logger.error(f"Error executing rollback: {e}")
            return False
    
    def _restore_file_snapshot(self, file_path: str, snapshot: Dict[str, Any]):
        """Restore file from snapshot"""
        try:
            backup_path = Path(snapshot['backup_path'])
            target_path = Path(file_path)
            
            if backup_path.exists():
                # Create backup of current file
                current_backup = target_path.with_suffix(f".backup_{int(datetime.utcnow().timestamp())}")
                if target_path.exists():
                    shutil.copy2(target_path, current_backup)
                
                # Restore from snapshot
                shutil.copy2(backup_path, target_path)
                
                self.logger.info(f"File restored: {file_path}")
            else:
                self.logger.warning(f"Backup file not found: {backup_path}")
                
        except Exception as e:
            self.logger.error(f"Error restoring file snapshot: {e}")
    
    def cleanup_old_audit_logs(self, days: int = None):
        """Clean up old audit logs"""
        if days is None:
            days = self.retention_days
        
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            
            cursor = self.db.connection.cursor()
            cursor.execute('''
                DELETE FROM audit_log 
                WHERE timestamp < ?
            ''', (cutoff_date.isoformat(),))
            
            deleted_count = cursor.rowcount
            self.db.connection.commit()
            
            if deleted_count > 0:
                self.logger.info(f"Cleaned up {deleted_count} old audit log entries")
                
        except Exception as e:
            self.logger.error(f"Error cleaning up audit logs: {e}")
    
    def cleanup_old_rollbacks(self, days: int = 30):
        """Clean up old rollback points"""
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            deleted_count = 0
            
            for rollback_file in self.rollback_dir.glob("rollback_*.json"):
                try:
                    with open(rollback_file, 'r') as f:
                        data = json.load(f)
                    
                    if datetime.fromisoformat(data['timestamp']) < cutoff_date:
                        rollback_file.unlink()
                        deleted_count += 1
                        
                except Exception as e:
                    self.logger.error(f"Error processing rollback file {rollback_file}: {e}")
            
            if deleted_count > 0:
                self.logger.info(f"Cleaned up {deleted_count} old rollback points")
                
        except Exception as e:
            self.logger.error(f"Error cleaning up rollbacks: {e}")
    
    def get_audit_summary(self, hours: int = 24) -> Dict[str, Any]:
        """Get audit log summary"""
        try:
            cursor = self.db.connection.cursor()
            
            # Get counts by category
            cursor.execute('''
                SELECT category, COUNT(*) as count 
                FROM audit_log 
                WHERE timestamp > datetime('now', '-{} hours')
                GROUP BY category
            '''.format(hours))
            
            category_counts = {}
            for row in cursor.fetchall():
                category_counts[row['category']] = row['count']
            
            # Get counts by action
            cursor.execute('''
                SELECT action, COUNT(*) as count 
                FROM audit_log 
                WHERE timestamp > datetime('now', '-{} hours')
                GROUP BY action
                ORDER BY count DESC
                LIMIT 10
            '''.format(hours))
            
            action_counts = {}
            for row in cursor.fetchall():
                action_counts[row['action']] = row['count']
            
            return {
                'total_entries': sum(category_counts.values()),
                'category_counts': category_counts,
                'top_actions': action_counts,
                'hours': hours
            }
            
        except Exception as e:
            self.logger.error(f"Error getting audit summary: {e}")
            return {
                'total_entries': 0,
                'category_counts': {},
                'top_actions': {},
                'hours': hours
            }
