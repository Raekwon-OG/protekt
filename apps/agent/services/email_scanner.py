"""
Email scanning service for phishing and malware detection
"""

import requests
import re
import logging
from typing import Dict, Any, List, Optional
from email import message_from_string
from email.utils import parseaddr
import json


class EmailScanner:
    """Scans emails for phishing and malware content"""
    
    def __init__(self, config, db, logger):
        self.config = config
        self.db = db
        self.logger = logger
        self.base_url = config.get('saas', 'base_url')
        self.api_key = config.get('saas', 'api_key')
        self.device_id = config.get_device_id()
    
    def scan_email(self, email_content: str, email_source: str = 'local') -> Dict[str, Any]:
        """
        Scan an email for malicious content
        
        Args:
            email_content: Raw email content (string or file path)
            email_source: Source of email ('local', 'sendgrid', etc.)
        
        Returns:
            Dictionary with scan results
        """
        try:
            # Parse email
            if isinstance(email_content, str) and '\n' in email_content:
                # Assume it's raw email content
                email_msg = message_from_string(email_content)
            else:
                # Assume it's a file path
                with open(email_content, 'r', encoding='utf-8', errors='ignore') as f:
                    email_msg = message_from_string(f.read())
            
            # Extract email components
            from_addr = email_msg.get('From', '')
            subject = email_msg.get('Subject', '')
            text_content = self._extract_text_content(email_msg)
            
            # Extract URLs from email
            urls = self._extract_urls(text_content)
            
            # Extract attachments
            attachments = []
            for part in email_msg.walk():
                if part.get_content_disposition() == 'attachment':
                    filename = part.get_filename()
                    if filename:
                        attachments.append({
                            'name': filename,
                            'size': len(part.get_payload(decode=True) or b'')
                        })
            
            # Send to backend for scanning
            return self._send_to_backend({
                'from': from_addr,
                'subject': subject,
                'text': text_content,
                'urls': urls,
                'attachments': attachments
            })
            
        except Exception as e:
            self.logger.error(f"Error scanning email: {e}")
            return {
                'error': str(e),
                'verdict': 'error',
                'phishing_detected': False
            }
    
    def _extract_text_content(self, email_msg) -> str:
        """Extract text content from email message"""
        text_parts = []
        
        if email_msg.is_multipart():
            for part in email_msg.walk():
                content_type = part.get_content_type()
                if content_type == 'text/plain':
                    payload = part.get_payload(decode=True)
                    if payload:
                        try:
                            text_parts.append(payload.decode('utf-8', errors='ignore'))
                        except:
                            pass
                elif content_type == 'text/html':
                    # Extract text from HTML (simple version)
                    payload = part.get_payload(decode=True)
                    if payload:
                        try:
                            html = payload.decode('utf-8', errors='ignore')
                            # Simple HTML tag removal
                            text = re.sub(r'<[^>]+>', '', html)
                            text_parts.append(text)
                        except:
                            pass
        else:
            payload = email_msg.get_payload(decode=True)
            if payload:
                try:
                    text_parts.append(payload.decode('utf-8', errors='ignore'))
                except:
                    pass
        
        return '\n'.join(text_parts)
    
    def _extract_urls(self, text: str) -> List[str]:
        """Extract URLs from text content"""
        # URL regex pattern
        url_pattern = re.compile(
            r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+'
        )
        urls = url_pattern.findall(text)
        
        # Also check for URLs without protocol
        domain_pattern = re.compile(
            r'(?:www\.)?[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+'
        )
        domains = domain_pattern.findall(text)
        
        # Filter out common false positives
        filtered_urls = []
        for url in urls:
            if not any(skip in url.lower() for skip in ['localhost', '127.0.0.1', 'example.com']):
                filtered_urls.append(url)
        
        return filtered_urls
    
    def _send_to_backend(self, email_data: Dict[str, Any]) -> Dict[str, Any]:
        """Send email data to backend for scanning"""
        if not self.base_url:
            self.logger.warning("No backend URL configured, skipping email scan")
            return {
                'verdict': 'pending',
                'phishing_detected': False,
                'reason': 'Backend not configured'
            }
        
        try:
            headers = {
                'Content-Type': 'application/json'
            }
            
            if self.api_key:
                headers['Authorization'] = f'Bearer {self.api_key}'
            
            # Use the backend's ingest-email endpoint
            response = requests.post(
                f"{self.base_url}/api/security/ingest-email",
                json=email_data,
                headers=headers,
                timeout=self.config.getint('saas', 'timeout', 30)
            )
            
            if response.status_code == 200:
                result = response.json()
                self.logger.info(f"Email scan completed: {result.get('phishingDetected', 0)} threats detected")
                
                # Log to database
                self._log_scan_result(email_data, result)
                
                return {
                    'verdict': 'phishing' if result.get('phishingDetected', 0) > 0 else 'clean',
                    'phishing_detected': result.get('phishingDetected', 0) > 0,
                    'threats_found': result.get('phishingDetected', 0),
                    'scanned_items': result.get('scanned', 0),
                    'details': result.get('details', [])
                }
            else:
                self.logger.error(f"Email scan failed: {response.status_code} - {response.text}")
                return {
                    'verdict': 'error',
                    'phishing_detected': False,
                    'error': f"HTTP {response.status_code}"
                }
                
        except Exception as e:
            self.logger.error(f"Error sending email to backend: {e}")
            # Queue for offline sync
            self._queue_for_offline(email_data)
            return {
                'verdict': 'pending',
                'phishing_detected': False,
                'reason': 'Queued for offline sync'
            }
    
    def _log_scan_result(self, email_data: Dict[str, Any], scan_result: Dict[str, Any]):
        """Log email scan result to database"""
        try:
            cursor = self.db.connection.cursor()
            cursor.execute('''
                INSERT INTO email_scan_logs 
                (from_addr, subject, urls, verdict, phishing_detected, details, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                email_data.get('from', ''),
                email_data.get('subject', ''),
                json.dumps(email_data.get('urls', [])),
                'phishing' if scan_result.get('phishingDetected', 0) > 0 else 'clean',
                scan_result.get('phishingDetected', 0) > 0,
                json.dumps(scan_result.get('details', [])),
                self._get_timestamp()
            ))
            self.db.connection.commit()
        except Exception as e:
            self.logger.error(f"Error logging email scan: {e}")
    
    def _queue_for_offline(self, email_data: Dict[str, Any]):
        """Queue email data for offline sync"""
        try:
            self.db.add_to_queue('email_scan', email_data, priority=2)
            self.logger.debug("Email scan queued for offline sync")
        except Exception as e:
            self.logger.error(f"Error queueing email scan: {e}")
    
    def _get_timestamp(self) -> str:
        """Get current timestamp in ISO format"""
        from datetime import datetime
        return datetime.utcnow().isoformat()
    
    def scan_email_file(self, file_path: str) -> Dict[str, Any]:
        """Scan email from file path"""
        return self.scan_email(file_path, email_source='file')

