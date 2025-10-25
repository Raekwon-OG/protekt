"""
Alert management system for human-readable notifications
"""

import json
import logging
import threading
import time
import smtplib
import requests
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from pathlib import Path

class AlertManager:
    """Manages alert generation and delivery"""
    
    def __init__(self, config, db, logger):
        self.config = config
        self.db = db
        self.logger = logger
        self.running = False
        self.thread = None
        
        # Alert configuration
        self.alerts_enabled = config.getboolean('alerts', 'enabled', True)
        self.alert_cooldown = config.getint('alerts', 'alert_cooldown', 300)  # 5 minutes
        self.whatsapp_webhook = config.get('alerts', 'whatsapp_webhook', '')
        
        # Email configuration
        self.smtp_server = config.get('alerts', 'email_smtp_server', '')
        self.smtp_port = config.getint('alerts', 'email_smtp_port', 587)
        self.email_username = config.get('alerts', 'email_username', '')
        self.email_password = config.get('alerts', 'email_password', '')
        
        # Alert templates
        self.alert_templates = self._load_alert_templates()
        
        # Alert cooldown tracking
        self.last_alerts = {}
        
        # Alert severity levels
        self.severity_levels = {
            'low': 1,
            'medium': 2,
            'high': 3,
            'critical': 4
        }
    
    def _load_alert_templates(self) -> Dict[str, str]:
        """Load alert message templates"""
        return {
            'ransomware_detection': {
                'title': '🚨 RANSOMWARE DETECTED',
                'template': '''Ransomware activity detected on device {device_name}!

Severity: {severity}
Time: {timestamp}
Description: {description}

Details:
{details}

Immediate action required! Please check the device and take appropriate security measures.

Device ID: {device_id}
IP Address: {ip_address}'''
            },
            'anomaly_detected': {
                'title': '⚠️ System Anomaly Detected',
                'template': '''Unusual system behavior detected on device {device_name}.

Severity: {severity}
Time: {timestamp}
Description: {description}

System Status:
- CPU Usage: {cpu_percent}%
- Memory Usage: {memory_percent}%
- Disk Usage: {disk_percent}%

Device ID: {device_id}
IP Address: {ip_address}'''
            },
            'threshold_violation': {
                'title': '📊 Resource Threshold Exceeded',
                'template': '''System resource threshold exceeded on device {device_name}.

Severity: {severity}
Time: {timestamp}
Resource: {resource_type}
Current Value: {current_value}%
Threshold: {threshold}%

Device ID: {device_id}
IP Address: {ip_address}'''
            },
            'backup_completed': {
                'title': '✅ Backup Completed',
                'template': '''Backup completed successfully on device {device_name}.

Backup ID: {backup_id}
Size: {backup_size}
Duration: {duration}
Files: {file_count}

Device ID: {device_id}'''
            },
            'backup_failed': {
                'title': '❌ Backup Failed',
                'template': '''Backup failed on device {device_name}.

Backup ID: {backup_id}
Error: {error_message}
Time: {timestamp}

Device ID: {device_id}'''
            },
            'command_executed': {
                'title': '🔧 Command Executed',
                'template': '''Command executed on device {device_name}.

Command: {command_type}
Status: {status}
Result: {result}

Device ID: {device_id}
Time: {timestamp}'''
            },
            'device_offline': {
                'title': '📴 Device Offline',
                'template': '''Device {device_name} has gone offline.

Last Seen: {last_seen}
Duration Offline: {offline_duration}

Device ID: {device_id}
IP Address: {ip_address}'''
            },
            'device_online': {
                'title': '🟢 Device Online',
                'template': '''Device {device_name} is back online.

Reconnected: {timestamp}
Uptime: {uptime}

Device ID: {device_id}
IP Address: {ip_address}'''
            }
        }
    
    def start(self):
        """Start alert manager service"""
        if not self.alerts_enabled:
            self.logger.info("Alert manager disabled in configuration")
            return
        
        if self.running:
            return
        
        self.running = True
        self.thread = threading.Thread(target=self._alert_loop, daemon=True)
        self.thread.start()
        self.logger.info("Alert manager started")
    
    def stop(self):
        """Stop alert manager service"""
        self.running = False
        if self.thread:
            self.thread.join(timeout=5)
        self.logger.info("Alert manager stopped")
    
    def _alert_loop(self):
        """Main alert processing loop"""
        while self.running:
            try:
                # Process pending alerts
                self._process_pending_alerts()
                
                # Check for offline devices
                self._check_device_status()
                
                time.sleep(60)  # Check every minute
                
            except Exception as e:
                self.logger.error(f"Error in alert loop: {e}")
                time.sleep(60)
    
    def _process_pending_alerts(self):
        """Process pending alerts from database"""
        try:
            # Get recent security events that need alerts
            cursor = self.db.connection.cursor()
            cursor.execute('''
                SELECT * FROM security_events 
                WHERE timestamp > datetime('now', '-1 hour')
                AND resolved = 0
                ORDER BY timestamp DESC
            ''')
            
            events = cursor.fetchall()
            
            for event in events:
                self._process_security_event(dict(event))
            
            # Get recent command executions
            cursor.execute('''
                SELECT * FROM command_history 
                WHERE created_at > datetime('now', '-1 hour')
                ORDER BY created_at DESC
            ''')
            
            commands = cursor.fetchall()
            
            for command in commands:
                self._process_command_event(dict(command))
                
        except Exception as e:
            self.logger.error(f"Error processing pending alerts: {e}")
    
    def _process_security_event(self, event: Dict[str, Any]):
        """Process security event for alert generation"""
        event_type = event['event_type']
        severity = event['severity']
        
        # Check if we should send an alert for this event
        if not self._should_send_alert(event_type, severity):
            return
        
        # Generate alert message
        alert_data = self._generate_alert_data(event)
        alert_message = self._format_alert_message(event_type, alert_data)
        
        # Send alert
        self._send_alert(event_type, alert_message, severity)
        
        # Mark as resolved to avoid duplicate alerts
        self._mark_event_resolved(event['id'])
    
    def _process_command_event(self, command: Dict[str, Any]):
        """Process command execution for alert generation"""
        command_type = command['command_type']
        status = command['status']
        
        # Only alert for certain command types
        if command_type not in ['backup', 'restore', 'scan', 'isolate']:
            return
        
        # Generate alert message
        alert_data = self._generate_command_alert_data(command)
        alert_message = self._format_alert_message('command_executed', alert_data)
        
        # Send alert
        self._send_alert('command_executed', alert_message, 'medium')
    
    def _should_send_alert(self, event_type: str, severity: str) -> bool:
        """Check if alert should be sent based on cooldown and severity"""
        alert_key = f"{event_type}_{severity}"
        current_time = time.time()
        
        # Check cooldown
        if alert_key in self.last_alerts:
            if current_time - self.last_alerts[alert_key] < self.alert_cooldown:
                return False
        
        # Update last alert time
        self.last_alerts[alert_key] = current_time
        
        return True
    
    def _generate_alert_data(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """Generate alert data from security event"""
        # Get device information
        device_id = self.config.get_device_id()
        device_name = self.config.get('agent', 'name', 'ProtektAgent')
        
        # Get current system info
        try:
            import psutil
            cpu_percent = psutil.cpu_percent()
            memory_percent = psutil.virtual_memory().percent
            disk_percent = psutil.disk_usage('/').percent if hasattr(psutil, 'disk_usage') else 0
        except:
            cpu_percent = 0
            memory_percent = 0
            disk_percent = 0
        
        # Get IP address
        try:
            import socket
            ip_address = socket.gethostbyname(socket.gethostname())
        except:
            ip_address = 'Unknown'
        
        # Parse event details
        details = {}
        if event.get('details'):
            try:
                details = json.loads(event['details'])
            except:
                details = {}
        
        return {
            'device_id': device_id,
            'device_name': device_name,
            'timestamp': event['timestamp'],
            'severity': event['severity'],
            'description': event['description'],
            'details': details,
            'cpu_percent': cpu_percent,
            'memory_percent': memory_percent,
            'disk_percent': disk_percent,
            'ip_address': ip_address,
            'file_path': event.get('file_path', ''),
            'process_name': event.get('process_name', '')
        }
    
    def _generate_command_alert_data(self, command: Dict[str, Any]) -> Dict[str, Any]:
        """Generate alert data from command execution"""
        device_id = self.config.get_device_id()
        device_name = self.config.get('agent', 'name', 'ProtektAgent')
        
        # Parse command parameters and result
        parameters = {}
        result = {}
        
        if command.get('parameters'):
            try:
                parameters = json.loads(command['parameters'])
            except:
                parameters = {}
        
        if command.get('result'):
            try:
                result = json.loads(command['result'])
            except:
                result = {}
        
        return {
            'device_id': device_id,
            'device_name': device_name,
            'timestamp': command['created_at'],
            'command_type': command['command_type'],
            'status': command['status'],
            'result': result,
            'parameters': parameters
        }
    
    def _format_alert_message(self, alert_type: str, data: Dict[str, Any]) -> str:
        """Format alert message using template"""
        if alert_type not in self.alert_templates:
            # Default template
            return f"Alert: {alert_type}\nDevice: {data.get('device_name', 'Unknown')}\nTime: {data.get('timestamp', 'Unknown')}\nDescription: {data.get('description', 'No description')}"
        
        template_data = self.alert_templates[alert_type]
        template = template_data['template']
        
        # Format template with data
        try:
            formatted_message = template.format(**data)
            return f"{template_data['title']}\n\n{formatted_message}"
        except KeyError as e:
            self.logger.error(f"Missing template variable: {e}")
            return f"Alert: {alert_type}\nDevice: {data.get('device_name', 'Unknown')}\nTime: {data.get('timestamp', 'Unknown')}"
    
    def _send_alert(self, alert_type: str, message: str, severity: str):
        """Send alert through configured channels"""
        try:
            # Send to WhatsApp if configured
            if self.whatsapp_webhook:
                self._send_whatsapp_alert(message)
            
            # Send email if configured
            if self.smtp_server and self.email_username:
                self._send_email_alert(alert_type, message, severity)
            
            # Log alert
            self.logger.info(f"Alert sent: {alert_type} ({severity})")
            
            # Record alert in database
            self._record_alert(alert_type, message, severity)
            
        except Exception as e:
            self.logger.error(f"Error sending alert: {e}")
    
    def _send_whatsapp_alert(self, message: str):
        """Send alert via WhatsApp webhook"""
        try:
            payload = {
                'text': message,
                'timestamp': datetime.utcnow().isoformat()
            }
            
            response = requests.post(
                self.whatsapp_webhook,
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                self.logger.debug("WhatsApp alert sent successfully")
            else:
                self.logger.warning(f"WhatsApp alert failed: {response.status_code}")
                
        except Exception as e:
            self.logger.error(f"Error sending WhatsApp alert: {e}")
    
    def _send_email_alert(self, alert_type: str, message: str, severity: str):
        """Send alert via email"""
        try:
            # Create message
            msg = MIMEMultipart()
            msg['From'] = self.email_username
            msg['To'] = self.email_username  # Send to self for now
            msg['Subject'] = f"Protekt Alert: {alert_type} ({severity})"
            
            # Add body
            msg.attach(MIMEText(message, 'plain'))
            
            # Send email
            server = smtplib.SMTP(self.smtp_server, self.smtp_port)
            server.starttls()
            server.login(self.email_username, self.email_password)
            server.send_message(msg)
            server.quit()
            
            self.logger.debug("Email alert sent successfully")
            
        except Exception as e:
            self.logger.error(f"Error sending email alert: {e}")
    
    def _record_alert(self, alert_type: str, message: str, severity: str):
        """Record alert in database"""
        try:
            cursor = self.db.connection.cursor()
            cursor.execute('''
                INSERT INTO audit_log (action, resource, details, timestamp)
                VALUES (?, ?, ?, ?)
            ''', (
                'alert_sent',
                alert_type,
                json.dumps({
                    'message': message,
                    'severity': severity,
                    'timestamp': datetime.utcnow().isoformat()
                }),
                datetime.utcnow().isoformat()
            ))
            self.db.connection.commit()
            
        except Exception as e:
            self.logger.error(f"Error recording alert: {e}")
    
    def _mark_event_resolved(self, event_id: int):
        """Mark security event as resolved"""
        try:
            cursor = self.db.connection.cursor()
            cursor.execute('''
                UPDATE security_events 
                SET resolved = 1 
                WHERE id = ?
            ''', (event_id,))
            self.db.connection.commit()
            
        except Exception as e:
            self.logger.error(f"Error marking event as resolved: {e}")
    
    def _check_device_status(self):
        """Check device online/offline status"""
        # This would typically check if the device is responding
        # For now, we'll implement a simple heartbeat check
        pass
    
    def send_manual_alert(self, alert_type: str, message: str, severity: str = 'medium'):
        """Send a manual alert"""
        if not self.alerts_enabled:
            return
        
        formatted_message = self._format_alert_message(alert_type, {
            'device_name': self.config.get('agent', 'name', 'ProtektAgent'),
            'timestamp': datetime.utcnow().isoformat(),
            'description': message
        })
        
        self._send_alert(alert_type, formatted_message, severity)
    
    def get_alert_history(self, hours: int = 24) -> List[Dict[str, Any]]:
        """Get alert history from database"""
        try:
            cursor = self.db.connection.cursor()
            cursor.execute('''
                SELECT * FROM audit_log 
                WHERE action = 'alert_sent' 
                AND timestamp > datetime('now', '-{} hours')
                ORDER BY timestamp DESC
            '''.format(hours))
            
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
            
        except Exception as e:
            self.logger.error(f"Error getting alert history: {e}")
            return []
    
    def test_alert_system(self):
        """Test alert system by sending a test alert"""
        self.send_manual_alert(
            'test_alert',
            'This is a test alert to verify the alert system is working correctly.',
            'low'
        )
        self.logger.info("Test alert sent")
