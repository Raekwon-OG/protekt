"""
URL scanning service for phishing and malware detection
"""

import requests
import re
import logging
from typing import Dict, Any, List, Optional
import json


class URLScanner:
    """Scans URLs for phishing and malware"""
    
    def __init__(self, config, db, logger):
        self.config = config
        self.db = db
        self.logger = logger
        self.base_url = config.get('saas', 'base_url')
        self.api_key = config.get('saas', 'api_key')
        self.device_id = config.get_device_id()
    
    def scan_url(self, url: str) -> Dict[str, Any]:
        """
        Scan a URL for malicious content
        
        Args:
            url: URL to scan
        
        Returns:
            Dictionary with scan results
        """
        try:
            # Normalize URL
            normalized_url = self._normalize_url(url)
            
            if not normalized_url:
                return {
                    'url': url,
                    'verdict': 'invalid',
                    'reason': 'Invalid URL format',
                    'threat_detected': False
                }
            
            # Send to backend for scanning
            return self._send_to_backend(normalized_url)
            
        except Exception as e:
            self.logger.error(f"Error scanning URL: {e}")
            return {
                'url': url,
                'verdict': 'error',
                'threat_detected': False,
                'error': str(e)
            }
    
    def scan_urls(self, urls: List[str]) -> List[Dict[str, Any]]:
        """Scan multiple URLs"""
        results = []
        for url in urls:
            results.append(self.scan_url(url))
        return results
    
    def _normalize_url(self, url: str) -> Optional[str]:
        """Normalize URL format"""
        url = url.strip()
        
        # Remove common prefixes/suffixes
        url = re.sub(r'^mailto:', '', url, flags=re.IGNORECASE)
        url = re.sub(r'^<|>$', '', url)  # Remove angle brackets
        
        # Add protocol if missing
        if not re.match(r'^https?://', url, re.IGNORECASE):
            url = f'http://{url}'
        
        # Validate URL format
        try:
            # Basic validation
            if not re.match(r'^https?://[^\s/$.?#].[^\s]*$', url, re.IGNORECASE):
                return None
            return url
        except:
            return None
    
    def _send_to_backend(self, url: str) -> Dict[str, Any]:
        """Send URL to backend for scanning"""
        if not self.base_url:
            self.logger.warning("No backend URL configured, skipping URL scan")
            return {
                'url': url,
                'verdict': 'pending',
                'threat_detected': False,
                'reason': 'Backend not configured'
            }
        
        try:
            headers = {
                'Content-Type': 'application/json'
            }
            
            if self.api_key:
                headers['Authorization'] = f'Bearer {self.api_key}'
            
            # Use the backend's scan-url endpoint
            response = requests.post(
                f"{self.base_url}/api/security/scan-url",
                json={'url': url},
                headers=headers,
                timeout=self.config.getint('saas', 'timeout', 30)
            )
            
            if response.status_code == 200:
                result = response.json()
                self.logger.info(f"URL scan completed: {result.get('verdict', 'unknown')}")
                
                # Log to database
                self._log_scan_result(url, result)
                
                return {
                    'url': url,
                    'verdict': result.get('verdict', 'pending'),
                    'threat_detected': result.get('verdict') == 'phishing',
                    'reason': result.get('reason', ''),
                    'details': result
                }
            else:
                self.logger.error(f"URL scan failed: {response.status_code} - {response.text}")
                return {
                    'url': url,
                    'verdict': 'error',
                    'threat_detected': False,
                    'error': f"HTTP {response.status_code}"
                }
                
        except Exception as e:
            self.logger.error(f"Error sending URL to backend: {e}")
            # Queue for offline sync
            self._queue_for_offline(url)
            return {
                'url': url,
                'verdict': 'pending',
                'threat_detected': False,
                'reason': 'Queued for offline sync'
            }
    
    def _log_scan_result(self, url: str, scan_result: Dict[str, Any]):
        """Log URL scan result to database"""
        try:
            cursor = self.db.connection.cursor()
            cursor.execute('''
                INSERT INTO url_scan_logs 
                (url, verdict, threat_detected, reason, details, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                url,
                scan_result.get('verdict', 'pending'),
                scan_result.get('verdict') == 'phishing',
                scan_result.get('reason', ''),
                json.dumps(scan_result),
                self._get_timestamp()
            ))
            self.db.connection.commit()
        except Exception as e:
            self.logger.error(f"Error logging URL scan: {e}")
    
    def _queue_for_offline(self, url: str):
        """Queue URL for offline sync"""
        try:
            self.db.add_to_queue('url_scan', {'url': url}, priority=2)
            self.logger.debug("URL scan queued for offline sync")
        except Exception as e:
            self.logger.error(f"Error queueing URL scan: {e}")
    
    def _get_timestamp(self) -> str:
        """Get current timestamp in ISO format"""
        from datetime import datetime
        return datetime.utcnow().isoformat()
    
    def extract_urls_from_text(self, text: str) -> List[str]:
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
        
        # Combine and deduplicate
        all_urls = list(set(urls + [f'http://{d}' for d in domains if d not in urls]))
        
        # Filter out common false positives
        filtered_urls = []
        for url in all_urls:
            if not any(skip in url.lower() for skip in ['localhost', '127.0.0.1', 'example.com']):
                filtered_urls.append(url)
        
        return filtered_urls

