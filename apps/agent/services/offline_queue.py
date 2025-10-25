"""
Offline queue and sync system for handling data when offline
"""

import json
import logging
import threading
import time
import requests
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta

class OfflineQueue:
    """Manages offline queue and synchronization with SaaS backend"""
    
    def __init__(self, config, db, logger):
        self.config = config
        self.db = db
        self.logger = logger
        self.running = False
        self.thread = None
        
        # Sync configuration
        self.base_url = config.get('saas', 'base_url')
        self.api_key = config.get('saas', 'api_key')
        self.device_id = config.get_device_id()
        self.sync_interval = 300  # 5 minutes
        self.max_retries = config.getint('saas', 'max_retries', 3)
        self.batch_size = 50
        
        # Sync status
        self.last_sync = None
        self.sync_in_progress = False
        self.failed_syncs = 0
        self.max_failed_syncs = 5
    
    def start(self):
        """Start offline queue sync service"""
        if self.running:
            return
        
        self.running = True
        self.thread = threading.Thread(target=self._sync_loop, daemon=True)
        self.thread.start()
        self.logger.info("Offline queue sync started")
    
    def stop(self):
        """Stop offline queue sync service"""
        self.running = False
        if self.thread:
            self.thread.join(timeout=5)
        self.logger.info("Offline queue sync stopped")
    
    def _sync_loop(self):
        """Main sync loop for processing offline queue"""
        while self.running:
            try:
                if self._is_online():
                    self._sync_offline_data()
                    self.failed_syncs = 0
                else:
                    self.logger.debug("Offline - queuing data locally")
                
                time.sleep(self.sync_interval)
                
            except Exception as e:
                self.logger.error(f"Error in sync loop: {e}")
                self.failed_syncs += 1
                
                # If too many failed syncs, increase interval
                if self.failed_syncs > self.max_failed_syncs:
                    time.sleep(300)  # Wait 5 minutes before retrying
                else:
                    time.sleep(60)  # Wait 1 minute before retrying
    
    def _is_online(self) -> bool:
        """Check if device is online and can reach SaaS backend"""
        if not self.base_url or not self.api_key:
            return False
        
        try:
            # Try to ping the backend
            response = requests.get(
                f"{self.base_url}/api/health",
                timeout=10
            )
            return response.status_code == 200
        except Exception:
            return False
    
    def _sync_offline_data(self):
        """Sync all pending offline data to SaaS backend"""
        if self.sync_in_progress:
            return
        
        self.sync_in_progress = True
        
        try:
            self.logger.info("Starting offline data sync...")
            
            # Sync different types of data
            self._sync_telemetry_data()
            self._sync_security_events()
            self._sync_command_results()
            self._sync_backup_uploads()
            
            self.last_sync = datetime.utcnow()
            self.logger.info("Offline data sync completed successfully")
            
        except Exception as e:
            self.logger.error(f"Error syncing offline data: {e}")
        finally:
            self.sync_in_progress = False
    
    def _sync_telemetry_data(self):
        """Sync telemetry data from offline queue"""
        try:
            # Get pending telemetry data
            queue_items = self.db.get_queue_items('telemetry', 'pending', self.batch_size)
            
            if not queue_items:
                return
            
            # Group telemetry data by timestamp
            telemetry_batch = []
            for item in queue_items:
                try:
                    payload = json.loads(item['payload'])
                    telemetry_batch.append(payload)
                except json.JSONDecodeError as e:
                    self.logger.error(f"Invalid telemetry data in queue: {e}")
                    self.db.update_queue_item(item['id'], 'failed')
                    continue
            
            if not telemetry_batch:
                return
            
            # Send batch to SaaS backend
            success = self._send_telemetry_batch(telemetry_batch)
            
            if success:
                # Mark items as completed
                for item in queue_items:
                    self.db.update_queue_item(item['id'], 'completed')
                self.logger.info(f"Synced {len(telemetry_batch)} telemetry records")
            else:
                # Mark items as failed (will retry later)
                for item in queue_items:
                    self.db.update_queue_item(item['id'], 'failed')
                
        except Exception as e:
            self.logger.error(f"Error syncing telemetry data: {e}")
    
    def _sync_security_events(self):
        """Sync security events from offline queue"""
        try:
            # Get pending security events
            queue_items = self.db.get_queue_items('security_event', 'pending', self.batch_size)
            
            if not queue_items:
                return
            
            # Group security events
            events_batch = []
            for item in queue_items:
                try:
                    payload = json.loads(item['payload'])
                    events_batch.append(payload)
                except json.JSONDecodeError as e:
                    self.logger.error(f"Invalid security event data in queue: {e}")
                    self.db.update_queue_item(item['id'], 'failed')
                    continue
            
            if not events_batch:
                return
            
            # Send batch to SaaS backend
            success = self._send_security_events_batch(events_batch)
            
            if success:
                # Mark items as completed
                for item in queue_items:
                    self.db.update_queue_item(item['id'], 'completed')
                self.logger.info(f"Synced {len(events_batch)} security events")
            else:
                # Mark items as failed (will retry later)
                for item in queue_items:
                    self.db.update_queue_item(item['id'], 'failed')
                
        except Exception as e:
            self.logger.error(f"Error syncing security events: {e}")
    
    def _sync_command_results(self):
        """Sync command results from offline queue"""
        try:
            # Get pending command results
            queue_items = self.db.get_queue_items('command_result', 'pending', self.batch_size)
            
            if not queue_items:
                return
            
            # Send each command result individually
            for item in queue_items:
                try:
                    payload = json.loads(item['payload'])
                    command_id = payload['command_id']
                    result = payload['result']
                    
                    success = self._send_command_result(command_id, result)
                    
                    if success:
                        self.db.update_queue_item(item['id'], 'completed')
                    else:
                        self.db.update_queue_item(item['id'], 'failed')
                        
                except json.JSONDecodeError as e:
                    self.logger.error(f"Invalid command result data in queue: {e}")
                    self.db.update_queue_item(item['id'], 'failed')
                
        except Exception as e:
            self.logger.error(f"Error syncing command results: {e}")
    
    def _sync_backup_uploads(self):
        """Sync backup uploads from offline queue"""
        try:
            # Get pending backup uploads
            queue_items = self.db.get_queue_items('backup_upload', 'pending', self.batch_size)
            
            if not queue_items:
                return
            
            # Process each backup upload
            for item in queue_items:
                try:
                    payload = json.loads(item['payload'])
                    backup_id = payload['backup_id']
                    upload_url = payload['upload_url']
                    
                    success = self._upload_backup(backup_id, upload_url)
                    
                    if success:
                        self.db.update_queue_item(item['id'], 'completed')
                    else:
                        self.db.update_queue_item(item['id'], 'failed')
                        
                except json.JSONDecodeError as e:
                    self.logger.error(f"Invalid backup upload data in queue: {e}")
                    self.db.update_queue_item(item['id'], 'failed')
                
        except Exception as e:
            self.logger.error(f"Error syncing backup uploads: {e}")
    
    def _send_telemetry_batch(self, telemetry_data: List[Dict[str, Any]]) -> bool:
        """Send batch of telemetry data to SaaS backend"""
        try:
            headers = {
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json'
            }
            
            payload = {
                'device_id': self.device_id,
                'telemetry_batch': telemetry_data,
                'batch_size': len(telemetry_data)
            }
            
            response = requests.post(
                f"{self.base_url}/api/devices/telemetry-batch",
                json=payload,
                headers=headers,
                timeout=30
            )
            
            return response.status_code == 200
            
        except Exception as e:
            self.logger.error(f"Error sending telemetry batch: {e}")
            return False
    
    def _send_security_events_batch(self, events_data: List[Dict[str, Any]]) -> bool:
        """Send batch of security events to SaaS backend"""
        try:
            headers = {
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json'
            }
            
            payload = {
                'device_id': self.device_id,
                'events_batch': events_data,
                'batch_size': len(events_data)
            }
            
            response = requests.post(
                f"{self.base_url}/api/devices/security-events-batch",
                json=payload,
                headers=headers,
                timeout=30
            )
            
            return response.status_code == 200
            
        except Exception as e:
            self.logger.error(f"Error sending security events batch: {e}")
            return False
    
    def _send_command_result(self, command_id: str, result: Dict[str, Any]) -> bool:
        """Send command result to SaaS backend"""
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
                timeout=30
            )
            
            return response.status_code == 200
            
        except Exception as e:
            self.logger.error(f"Error sending command result: {e}")
            return False
    
    def _upload_backup(self, backup_id: str, upload_url: str) -> bool:
        """Upload backup file to cloud storage"""
        try:
            # Get backup record
            cursor = self.db.connection.cursor()
            cursor.execute('''
                SELECT backup_path FROM backup_records WHERE backup_id = ?
            ''', (backup_id,))
            
            row = cursor.fetchone()
            if not row:
                return False
            
            backup_path = row['backup_path']
            
            # Upload file
            with open(backup_path, 'rb') as f:
                response = requests.put(upload_url, data=f, timeout=300)
            
            if response.status_code in [200, 201]:
                # Mark as uploaded in database
                cursor.execute('''
                    UPDATE backup_records 
                    SET uploaded = 1, upload_url = ?
                    WHERE backup_id = ?
                ''', (upload_url, backup_id))
                self.db.connection.commit()
                return True
            else:
                return False
                
        except Exception as e:
            self.logger.error(f"Error uploading backup: {e}")
            return False
    
    def queue_telemetry(self, telemetry_data: Dict[str, Any]):
        """Queue telemetry data for offline sync"""
        self.db.add_to_queue('telemetry', telemetry_data, priority=1)
    
    def queue_security_event(self, event_data: Dict[str, Any]):
        """Queue security event for offline sync"""
        self.db.add_to_queue('security_event', event_data, priority=2)
    
    def queue_command_result(self, command_id: str, result: Dict[str, Any]):
        """Queue command result for offline sync"""
        self.db.add_to_queue('command_result', {
            'command_id': command_id,
            'result': result
        }, priority=3)
    
    def queue_backup_upload(self, backup_id: str, upload_url: str):
        """Queue backup upload for offline sync"""
        self.db.add_to_queue('backup_upload', {
            'backup_id': backup_id,
            'upload_url': upload_url
        }, priority=4)
    
    def get_queue_status(self) -> Dict[str, Any]:
        """Get offline queue status"""
        try:
            cursor = self.db.connection.cursor()
            
            # Get counts by status
            cursor.execute('''
                SELECT status, COUNT(*) as count 
                FROM offline_queue 
                GROUP BY status
            ''')
            
            status_counts = {}
            for row in cursor.fetchall():
                status_counts[row['status']] = row['count']
            
            # Get counts by type
            cursor.execute('''
                SELECT queue_type, COUNT(*) as count 
                FROM offline_queue 
                WHERE status = 'pending'
                GROUP BY queue_type
            ''')
            
            type_counts = {}
            for row in cursor.fetchall():
                type_counts[row['queue_type']] = row['count']
            
            return {
                'total_items': sum(status_counts.values()),
                'status_counts': status_counts,
                'pending_by_type': type_counts,
                'last_sync': self.last_sync.isoformat() if self.last_sync else None,
                'sync_in_progress': self.sync_in_progress,
                'failed_syncs': self.failed_syncs
            }
            
        except Exception as e:
            self.logger.error(f"Error getting queue status: {e}")
            return {
                'total_items': 0,
                'status_counts': {},
                'pending_by_type': {},
                'last_sync': None,
                'sync_in_progress': False,
                'failed_syncs': 0
            }
    
    def cleanup_old_items(self, days: int = 7):
        """Clean up old completed/failed queue items"""
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            
            cursor = self.db.connection.cursor()
            cursor.execute('''
                DELETE FROM offline_queue 
                WHERE status IN ('completed', 'failed') 
                AND created_at < ?
            ''', (cutoff_date.isoformat(),))
            
            deleted_count = cursor.rowcount
            self.db.connection.commit()
            
            if deleted_count > 0:
                self.logger.info(f"Cleaned up {deleted_count} old queue items")
                
        except Exception as e:
            self.logger.error(f"Error cleaning up old queue items: {e}")
    
    def retry_failed_items(self):
        """Retry failed queue items"""
        try:
            cursor = self.db.connection.cursor()
            cursor.execute('''
                UPDATE offline_queue 
                SET status = 'pending', retry_count = 0
                WHERE status = 'failed' 
                AND retry_count < max_retries
            ''')
            
            retried_count = cursor.rowcount
            self.db.connection.commit()
            
            if retried_count > 0:
                self.logger.info(f"Retried {retried_count} failed queue items")
                
        except Exception as e:
            self.logger.error(f"Error retrying failed items: {e}")
