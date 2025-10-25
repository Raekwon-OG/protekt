"""
Device registration service for online and offline modes
"""

import requests
import json
import logging
from typing import Optional, Dict, Any
from pathlib import Path

class DeviceRegistration:
    """Handles device registration with SaaS backend"""
    
    def __init__(self, config, db, logger):
        self.config = config
        self.db = db
        self.logger = logger
        self.base_url = config.get('saas', 'base_url')
        self.api_key = config.get('saas', 'api_key')
        self.device_token = config.get('saas', 'device_token')
        self.org_id = config.get('saas', 'org_id')
        self.device_id = config.get_device_id()
    
    def is_registered(self) -> bool:
        """Check if device is already registered"""
        cursor = self.db.connection.cursor()
        cursor.execute('''
            SELECT * FROM device_registration 
            WHERE device_id = ? AND status = 'active'
        ''', (self.device_id,))
        return cursor.fetchone() is not None
    
    def register(self) -> bool:
        """Register device with SaaS backend (online) or offline mode"""
        if self.api_key and self.base_url:
            return self._register_online()
        else:
            return self._register_offline()
    
    def _register_online(self) -> bool:
        """Register device online with SaaS backend"""
        try:
            self.logger.info("Attempting online device registration...")
            
            # Prepare registration payload
            payload = {
                'device_id': self.device_id,
                'device_name': self.config.get('agent', 'name', 'ProtektAgent'),
                'device_type': 'windows',  # Could be detected dynamically
                'org_id': self.org_id,
                'api_key': self.api_key
            }
            
            # Make registration request
            response = requests.post(
                f"{self.base_url}/api/devices/register",
                json=payload,
                headers={'Content-Type': 'application/json'},
                timeout=self.config.getint('saas', 'timeout', 30)
            )
            
            if response.status_code == 200:
                data = response.json()
                self._save_registration_data(data)
                self.logger.info("Device registered successfully online")
                return True
            else:
                self.logger.error(f"Registration failed: {response.status_code} - {response.text}")
                return self._register_offline()
                
        except Exception as e:
            self.logger.error(f"Online registration failed: {e}")
            return self._register_offline()
    
    def _register_offline(self) -> bool:
        """Register device in offline mode"""
        try:
            self.logger.info("Registering device in offline mode...")
            
            # Check if offline registration file exists
            offline_file = Path(self.config.get('agent', 'data_dir', './data')) / 'offline_registration.json'
            
            if offline_file.exists():
                with open(offline_file, 'r') as f:
                    data = json.load(f)
                self._save_registration_data(data)
                self.logger.info("Device registered from offline file")
                return True
            else:
                # Create offline registration data
                data = {
                    'device_id': self.device_id,
                    'org_id': self.org_id or 'offline',
                    'api_key': self.api_key or '',
                    'status': 'offline',
                    'registered_at': None
                }
                self._save_registration_data(data)
                self.logger.info("Device registered in offline mode")
                return True
                
        except Exception as e:
            self.logger.error(f"Offline registration failed: {e}")
            return False
    
    def _save_registration_data(self, data: Dict[str, Any]):
        """Save registration data to database"""
        cursor = self.db.connection.cursor()
        cursor.execute('''
            INSERT OR REPLACE INTO device_registration 
            (device_id, org_id, api_key, registered_at, status)
            VALUES (?, ?, ?, ?, ?)
        ''', (
            data.get('device_id', self.device_id),
            data.get('org_id', self.org_id),
            data.get('api_key', self.api_key),
            data.get('registered_at'),
            data.get('status', 'active')
        ))
        self.db.connection.commit()
        
        # Update config with received values
        if 'org_id' in data:
            self.config.set('saas', 'org_id', data['org_id'])
        if 'api_key' in data:
            self.config.set('saas', 'api_key', data['api_key'])
    
    def get_registration_info(self) -> Optional[Dict[str, Any]]:
        """Get current registration information"""
        cursor = self.db.connection.cursor()
        cursor.execute('''
            SELECT * FROM device_registration 
            WHERE device_id = ?
        ''', (self.device_id,))
        row = cursor.fetchone()
        return dict(row) if row else None
    
    def update_heartbeat(self):
        """Update last heartbeat timestamp"""
        cursor = self.db.connection.cursor()
        cursor.execute('''
            UPDATE device_registration 
            SET last_heartbeat = CURRENT_TIMESTAMP
            WHERE device_id = ?
        ''', (self.device_id,))
        self.db.connection.commit()
