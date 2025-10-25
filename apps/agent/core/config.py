"""
Configuration management for Protekt Agent
"""

import configparser
import os
import secrets
from pathlib import Path
from typing import Optional

class Config:
    """Configuration manager for the agent"""
    
    def __init__(self, config_file: str = "config.ini"):
        self.config_file = config_file
        self.config = configparser.ConfigParser()
        self._load_config()
        self._ensure_data_directories()
    
    def _load_config(self):
        """Load configuration from file"""
        if os.path.exists(self.config_file):
            self.config.read(self.config_file)
        else:
            self._create_default_config()
    
    def _create_default_config(self):
        """Create default configuration file"""
        # This will be populated from the config.ini we created earlier
        pass
    
    def _ensure_data_directories(self):
        """Ensure required data directories exist"""
        data_dir = Path(self.get('agent', 'data_dir', './data'))
        backup_dir = Path(self.get('agent', 'backup_dir', './backups'))
        quarantine_dir = Path(self.get('security', 'quarantine_dir', './quarantine'))
        
        for directory in [data_dir, backup_dir, quarantine_dir]:
            directory.mkdir(parents=True, exist_ok=True)
    
    def get(self, section: str, key: str, default: Optional[str] = None) -> str:
        """Get configuration value"""
        return self.config.get(section, key, fallback=default)
    
    def getint(self, section: str, key: str, default: int = 0) -> int:
        """Get configuration value as integer"""
        return self.config.getint(section, key, fallback=default)
    
    def getfloat(self, section: str, key: str, default: float = 0.0) -> float:
        """Get configuration value as float"""
        return self.config.getfloat(section, key, fallback=default)
    
    def getboolean(self, section: str, key: str, default: bool = False) -> bool:
        """Get configuration value as boolean"""
        return self.config.getboolean(section, key, fallback=default)
    
    def set(self, section: str, key: str, value: str):
        """Set configuration value"""
        if not self.config.has_section(section):
            self.config.add_section(section)
        self.config.set(section, key, value)
        self._save_config()
    
    def _save_config(self):
        """Save configuration to file"""
        with open(self.config_file, 'w') as f:
            self.config.write(f)
    
    def get_encryption_key(self) -> str:
        """Get or generate encryption key for backups"""
        key = self.get('backup', 'encryption_key')
        if not key:
            key = secrets.token_hex(32)
            self.set('backup', 'encryption_key', key)
        return key
    
    def get_device_id(self) -> str:
        """Get or generate device ID"""
        device_id = self.get('agent', 'device_id')
        if not device_id:
            device_id = secrets.token_hex(16)
            self.set('agent', 'device_id', device_id)
        return device_id
