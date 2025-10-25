"""
Telemetry collection service for system monitoring
"""

import psutil
import socket
import platform
import time
import logging
import threading
from typing import Dict, Any, Optional
from datetime import datetime, timedelta

class TelemetryCollector:
    """Collects system telemetry data and sends to SaaS backend"""
    
    def __init__(self, config, db, logger):
        self.config = config
        self.db = db
        self.logger = logger
        self.running = False
        self.thread = None
        self.heartbeat_interval = config.getint('saas', 'heartbeat_interval', 300)
        self.base_url = config.get('saas', 'base_url')
        self.api_key = config.get('saas', 'api_key')
        
        # Thresholds for alerts
        self.cpu_threshold = config.getfloat('monitoring', 'cpu_threshold', 80.0)
        self.memory_threshold = config.getfloat('monitoring', 'memory_threshold', 85.0)
        self.disk_threshold = config.getfloat('monitoring', 'disk_threshold', 90.0)
    
    def start(self):
        """Start telemetry collection"""
        if self.running:
            return
        
        self.running = True
        self.thread = threading.Thread(target=self._collect_loop, daemon=True)
        self.thread.start()
        self.logger.info("Telemetry collection started")
    
    def stop(self):
        """Stop telemetry collection"""
        self.running = False
        if self.thread:
            self.thread.join(timeout=5)
        self.logger.info("Telemetry collection stopped")
    
    def _collect_loop(self):
        """Main telemetry collection loop"""
        while self.running:
            try:
                # Collect telemetry data
                telemetry_data = self._collect_system_data()
                
                # Store in local cache
                self._cache_telemetry(telemetry_data)
                
                # Check for threshold violations
                self._check_thresholds(telemetry_data)
                
                # Send to SaaS backend (or queue for offline)
                self._send_telemetry(telemetry_data)
                
                # Wait for next collection
                time.sleep(self.heartbeat_interval)
                
            except Exception as e:
                self.logger.error(f"Error in telemetry collection: {e}")
                time.sleep(60)  # Wait before retrying
    
    def _collect_system_data(self) -> Dict[str, Any]:
        """Collect comprehensive system telemetry data"""
        try:
            # Basic system info
            boot_time = psutil.boot_time()
            uptime = time.time() - boot_time
            
            # CPU usage
            cpu_percent = psutil.cpu_percent(interval=1)
            cpu_count = psutil.cpu_count()
            cpu_freq = psutil.cpu_freq()
            
            # Memory usage
            memory = psutil.virtual_memory()
            swap = psutil.swap_memory()
            
            # Disk usage
            disk_usage = {}
            for partition in psutil.disk_partitions():
                try:
                    partition_usage = psutil.disk_usage(partition.mountpoint)
                    disk_usage[partition.mountpoint] = {
                        'total': partition_usage.total,
                        'used': partition_usage.used,
                        'free': partition_usage.free,
                        'percent': (partition_usage.used / partition_usage.total) * 100
                    }
                except PermissionError:
                    continue
            
            # Network I/O
            network_io = psutil.net_io_counters()
            
            # Process count
            process_count = len(psutil.pids())
            
            # Get IP address
            ip_address = self._get_ip_address()
            
            # System information
            system_info = {
                'platform': platform.system(),
                'platform_version': platform.version(),
                'architecture': platform.architecture()[0],
                'hostname': platform.node(),
                'python_version': platform.python_version()
            }
            
            return {
                'timestamp': datetime.utcnow().isoformat(),
                'device_id': self.config.get_device_id(),
                'uptime_seconds': int(uptime),
                'cpu': {
                    'percent': cpu_percent,
                    'count': cpu_count,
                    'frequency': cpu_freq.current if cpu_freq else None
                },
                'memory': {
                    'total': memory.total,
                    'available': memory.available,
                    'used': memory.used,
                    'percent': memory.percent,
                    'swap_total': swap.total,
                    'swap_used': swap.used,
                    'swap_percent': swap.percent
                },
                'disk': disk_usage,
                'network': {
                    'bytes_sent': network_io.bytes_sent,
                    'bytes_recv': network_io.bytes_recv,
                    'packets_sent': network_io.packets_sent,
                    'packets_recv': network_io.packets_recv
                },
                'processes': {
                    'count': process_count
                },
                'network_info': {
                    'ip_address': ip_address
                },
                'system': system_info
            }
            
        except Exception as e:
            self.logger.error(f"Error collecting system data: {e}")
            return {
                'timestamp': datetime.utcnow().isoformat(),
                'device_id': self.config.get_device_id(),
                'error': str(e)
            }
    
    def _get_ip_address(self) -> Optional[str]:
        """Get primary IP address"""
        try:
            # Connect to a remote address to determine local IP
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
                s.connect(("8.8.8.8", 80))
                return s.getsockname()[0]
        except Exception:
            try:
                # Fallback to localhost
                return socket.gethostbyname(socket.gethostname())
            except Exception:
                return None
    
    def _cache_telemetry(self, data: Dict[str, Any]):
        """Cache telemetry data in local database"""
        try:
            cursor = self.db.connection.cursor()
            cursor.execute('''
                INSERT INTO telemetry_cache 
                (cpu_percent, memory_percent, disk_percent, network_io, 
                 processes_count, uptime_seconds, ip_address)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                data.get('cpu', {}).get('percent', 0),
                data.get('memory', {}).get('percent', 0),
                self._get_max_disk_usage(data.get('disk', {})),
                str(data.get('network', {})),
                data.get('processes', {}).get('count', 0),
                data.get('uptime_seconds', 0),
                data.get('network_info', {}).get('ip_address', '')
            ))
            self.db.connection.commit()
        except Exception as e:
            self.logger.error(f"Error caching telemetry: {e}")
    
    def _get_max_disk_usage(self, disk_data: Dict[str, Any]) -> float:
        """Get maximum disk usage percentage"""
        max_usage = 0.0
        for partition_data in disk_data.values():
            if isinstance(partition_data, dict) and 'percent' in partition_data:
                max_usage = max(max_usage, partition_data['percent'])
        return max_usage
    
    def _check_thresholds(self, data: Dict[str, Any]):
        """Check if any metrics exceed configured thresholds"""
        alerts = []
        
        # CPU threshold check
        cpu_percent = data.get('cpu', {}).get('percent', 0)
        if cpu_percent > self.cpu_threshold:
            alerts.append({
                'type': 'high_cpu',
                'severity': 'medium',
                'message': f"High CPU usage: {cpu_percent:.1f}% (threshold: {self.cpu_threshold}%)",
                'resource_type': 'CPU',
                'current_value': cpu_percent,
                'threshold': self.cpu_threshold
            })
        
        # Memory threshold check
        memory_percent = data.get('memory', {}).get('percent', 0)
        if memory_percent > self.memory_threshold:
            alerts.append({
                'type': 'high_memory',
                'severity': 'medium',
                'message': f"High memory usage: {memory_percent:.1f}% (threshold: {self.memory_threshold}%)",
                'resource_type': 'Memory',
                'current_value': memory_percent,
                'threshold': self.memory_threshold
            })
        
        # Disk threshold check
        max_disk_usage = self._get_max_disk_usage(data.get('disk', {}))
        if max_disk_usage > self.disk_threshold:
            alerts.append({
                'type': 'high_disk',
                'severity': 'high',
                'message': f"High disk usage: {max_disk_usage:.1f}% (threshold: {self.disk_threshold}%)",
                'resource_type': 'Disk',
                'current_value': max_disk_usage,
                'threshold': self.disk_threshold
            })
        
        # Log alerts
        for alert in alerts:
            self.db.log_security_event(
                event_type='threshold_violation',
                severity=alert['severity'],
                description=alert['message'],
                details=alert
            )
    
    def _send_telemetry(self, data: Dict[str, Any]):
        """Send telemetry data to SaaS backend or queue for offline"""
        if self.base_url and self.api_key:
            try:
                # Try to send online
                self._send_online(data)
            except Exception as e:
                self.logger.warning(f"Failed to send telemetry online: {e}")
                # Queue for offline sync
                self._queue_for_offline(data)
        else:
            # Queue for offline sync
            self._queue_for_offline(data)
    
    def _send_online(self, data: Dict[str, Any]):
        """Send telemetry data online to SaaS backend"""
        import requests
        
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.api_key}'
        }
        
        response = requests.post(
            f"{self.base_url}/api/devices/heartbeat",
            json=data,
            headers=headers,
            timeout=self.config.getint('saas', 'timeout', 30)
        )
        
        if response.status_code == 200:
            self.logger.debug("Telemetry sent successfully")
            # Update last heartbeat
            from services.registration import DeviceRegistration
            registration = DeviceRegistration(self.config, self.db, self.logger)
            registration.update_heartbeat()
        else:
            raise Exception(f"HTTP {response.status_code}: {response.text}")
    
    def _queue_for_offline(self, data: Dict[str, Any]):
        """Queue telemetry data for offline sync"""
        self.db.add_to_queue('telemetry', data, priority=1)
        self.logger.debug("Telemetry queued for offline sync")
    
    def get_recent_telemetry(self, hours: int = 24) -> list:
        """Get recent telemetry data from cache"""
        cursor = self.db.connection.cursor()
        cursor.execute('''
            SELECT * FROM telemetry_cache 
            WHERE timestamp > datetime('now', '-{} hours')
            ORDER BY timestamp DESC
        '''.format(hours))
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
