"""
Backup and restore management with encryption
"""

import os
import zipfile
import tarfile
import json
import logging
import threading
import time
import hashlib
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64

class BackupManager:
    """Manages backup creation, encryption, and restore operations"""
    
    def __init__(self, config, db, logger):
        self.config = config
        self.db = db
        self.logger = logger
        self.running = False
        self.thread = None
        
        # Backup configuration
        self.backup_enabled = config.getboolean('backup', 'enabled', True)
        self.backup_dir = Path(config.get('backup', 'backup_dir', './backups'))
        self.encryption_key = config.get_encryption_key()
        self.compression_level = config.getint('backup', 'compression_level', 6)
        self.max_backup_size = config.getint('backup', 'max_backup_size', 1073741824)  # 1GB
        self.retention_days = config.getint('backup', 'retention_days', 30)
        
        # Encryption setup
        self.cipher_suite = self._setup_encryption()
        
        # Ensure backup directory exists
        self.backup_dir.mkdir(parents=True, exist_ok=True)
    
    def _setup_encryption(self) -> Fernet:
        """Setup encryption using the configured key"""
        try:
            # Convert hex key to bytes
            key_bytes = bytes.fromhex(self.encryption_key)
            
            # Use PBKDF2 to derive a proper Fernet key
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=32,
                salt=b'protekt_salt',  # In production, use a random salt
                iterations=100000,
            )
            key = base64.urlsafe_b64encode(kdf.derive(key_bytes))
            
            return Fernet(key)
        except Exception as e:
            self.logger.error(f"Error setting up encryption: {e}")
            # Fallback to a simple key derivation
            key = base64.urlsafe_b64encode(self.encryption_key.encode()[:32].ljust(32, b'0'))
            return Fernet(key)
    
    def start(self):
        """Start backup manager service"""
        if not self.backup_enabled:
            self.logger.info("Backup manager disabled in configuration")
            return
        
        if self.running:
            return
        
        self.running = True
        self.thread = threading.Thread(target=self._cleanup_loop, daemon=True)
        self.thread.start()
        self.logger.info("Backup manager started")
    
    def stop(self):
        """Stop backup manager service"""
        self.running = False
        if self.thread:
            self.thread.join(timeout=5)
        self.logger.info("Backup manager stopped")
    
    def _cleanup_loop(self):
        """Periodic cleanup of old backups"""
        while self.running:
            try:
                self._cleanup_old_backups()
                time.sleep(3600)  # Run cleanup every hour
            except Exception as e:
                self.logger.error(f"Error in backup cleanup: {e}")
                time.sleep(3600)
    
    def create_backup(self, source_paths: List[str], backup_type: str = 'manual', 
                     description: str = '') -> Optional[str]:
        """Create a new backup"""
        try:
            self.logger.info(f"Creating backup of {len(source_paths)} paths")
            
            # Generate backup ID and filename
            backup_id = self._generate_backup_id()
            timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
            backup_filename = f"backup_{backup_id}_{timestamp}.tar.gz.enc"
            backup_path = self.backup_dir / backup_filename
            
            # Validate source paths
            valid_paths = self._validate_source_paths(source_paths)
            if not valid_paths:
                self.logger.error("No valid source paths for backup")
                return None
            
            # Create temporary backup archive
            temp_backup_path = backup_path.with_suffix('.tmp')
            
            # Create compressed archive
            with tarfile.open(temp_backup_path, 'w:gz', compresslevel=self.compression_level) as tar:
                for source_path in valid_paths:
                    self._add_to_archive(tar, source_path)
            
            # Check backup size
            backup_size = temp_backup_path.stat().st_size
            if backup_size > self.max_backup_size:
                self.logger.error(f"Backup too large: {backup_size} bytes (max: {self.max_backup_size})")
                temp_backup_path.unlink()
                return None
            
            # Encrypt backup
            self._encrypt_backup(temp_backup_path, backup_path)
            temp_backup_path.unlink()
            
            # Calculate checksum
            checksum = self._calculate_checksum(backup_path)
            
            # Record backup in database
            self._record_backup(backup_id, backup_type, source_paths, str(backup_path), 
                              backup_size, description, checksum)
            
            self.logger.info(f"Backup created successfully: {backup_id}")
            return backup_id
            
        except Exception as e:
            self.logger.error(f"Error creating backup: {e}")
            return None
    
    def restore_backup(self, backup_id: str, restore_path: str = None) -> bool:
        """Restore a backup"""
        try:
            self.logger.info(f"Restoring backup: {backup_id}")
            
            # Get backup record
            backup_record = self._get_backup_record(backup_id)
            if not backup_record:
                self.logger.error(f"Backup not found: {backup_id}")
                return False
            
            backup_path = Path(backup_record['backup_path'])
            if not backup_path.exists():
                self.logger.error(f"Backup file not found: {backup_path}")
                return False
            
            # Verify checksum
            if not self._verify_checksum(backup_path, backup_record.get('checksum')):
                self.logger.error("Backup checksum verification failed")
                return False
            
            # Decrypt backup
            temp_backup_path = backup_path.with_suffix('.tmp')
            self._decrypt_backup(backup_path, temp_backup_path)
            
            # Extract backup
            restore_dir = Path(restore_path) if restore_path else Path('./restore')
            restore_dir.mkdir(parents=True, exist_ok=True)
            
            with tarfile.open(temp_backup_path, 'r:gz') as tar:
                tar.extractall(restore_dir)
            
            # Cleanup
            temp_backup_path.unlink()
            
            # Log restore operation
            self.db.log_audit(
                action='backup_restored',
                resource=backup_id,
                details={
                    'backup_path': str(backup_path),
                    'restore_path': str(restore_dir),
                    'backup_type': backup_record['backup_type']
                }
            )
            
            self.logger.info(f"Backup restored successfully to: {restore_dir}")
            return True
            
        except Exception as e:
            self.logger.error(f"Error restoring backup: {e}")
            return False
    
    def _validate_source_paths(self, source_paths: List[str]) -> List[str]:
        """Validate and filter source paths"""
        valid_paths = []
        
        for path_str in source_paths:
            path = Path(path_str)
            if path.exists():
                valid_paths.append(str(path.absolute()))
            else:
                self.logger.warning(f"Source path does not exist: {path_str}")
        
        return valid_paths
    
    def _add_to_archive(self, tar: tarfile.TarFile, source_path: str):
        """Add files to archive recursively"""
        path = Path(source_path)
        
        if path.is_file():
            tar.add(path, arcname=path.name)
        elif path.is_dir():
            for root, dirs, files in os.walk(path):
                # Skip certain directories
                dirs[:] = [d for d in dirs if not d.startswith('.') and d != '__pycache__']
                
                for file in files:
                    file_path = Path(root) / file
                    try:
                        # Skip certain file types
                        if file_path.suffix.lower() in ['.tmp', '.log', '.cache']:
                            continue
                        
                        arcname = file_path.relative_to(path.parent)
                        tar.add(file_path, arcname=str(arcname))
                    except (OSError, PermissionError) as e:
                        self.logger.warning(f"Could not add file to archive: {file_path} - {e}")
    
    def _encrypt_backup(self, source_path: Path, dest_path: Path):
        """Encrypt backup file"""
        with open(source_path, 'rb') as f:
            data = f.read()
        
        encrypted_data = self.cipher_suite.encrypt(data)
        
        with open(dest_path, 'wb') as f:
            f.write(encrypted_data)
    
    def _decrypt_backup(self, source_path: Path, dest_path: Path):
        """Decrypt backup file"""
        with open(source_path, 'rb') as f:
            encrypted_data = f.read()
        
        decrypted_data = self.cipher_suite.decrypt(encrypted_data)
        
        with open(dest_path, 'wb') as f:
            f.write(decrypted_data)
    
    def _calculate_checksum(self, file_path: Path) -> str:
        """Calculate SHA256 checksum of file"""
        sha256_hash = hashlib.sha256()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(4096), b""):
                sha256_hash.update(chunk)
        return sha256_hash.hexdigest()
    
    def _verify_checksum(self, file_path: Path, expected_checksum: str) -> bool:
        """Verify file checksum"""
        if not expected_checksum:
            return True  # Skip verification if no checksum available
        
        actual_checksum = self._calculate_checksum(file_path)
        return actual_checksum == expected_checksum
    
    def _generate_backup_id(self) -> str:
        """Generate unique backup ID"""
        return f"backup_{int(time.time())}_{os.urandom(4).hex()}"
    
    def _record_backup(self, backup_id: str, backup_type: str, source_paths: List[str], 
                      backup_path: str, size_bytes: int, description: str, checksum: str):
        """Record backup in database"""
        cursor = self.db.connection.cursor()
        cursor.execute('''
            INSERT INTO backup_records 
            (backup_id, backup_type, source_paths, backup_path, size_bytes, 
             encrypted, created_at, checksum, description)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            backup_id, backup_type, json.dumps(source_paths), backup_path, 
            size_bytes, True, datetime.utcnow().isoformat(), checksum, description
        ))
        self.db.connection.commit()
    
    def _get_backup_record(self, backup_id: str) -> Optional[Dict[str, Any]]:
        """Get backup record from database"""
        cursor = self.db.connection.cursor()
        cursor.execute('''
            SELECT * FROM backup_records WHERE backup_id = ?
        ''', (backup_id,))
        row = cursor.fetchone()
        return dict(row) if row else None
    
    def _cleanup_old_backups(self):
        """Clean up old backups based on retention policy"""
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=self.retention_days)
            
            cursor = self.db.connection.cursor()
            cursor.execute('''
                SELECT backup_id, backup_path FROM backup_records 
                WHERE created_at < ? AND uploaded = 1
            ''', (cutoff_date.isoformat(),))
            
            old_backups = cursor.fetchall()
            
            for backup in old_backups:
                backup_path = Path(backup['backup_path'])
                if backup_path.exists():
                    backup_path.unlink()
                    self.logger.info(f"Deleted old backup: {backup['backup_id']}")
                
                # Remove from database
                cursor.execute('DELETE FROM backup_records WHERE backup_id = ?', (backup['backup_id'],))
            
            self.db.connection.commit()
            
            if old_backups:
                self.logger.info(f"Cleaned up {len(old_backups)} old backups")
                
        except Exception as e:
            self.logger.error(f"Error cleaning up old backups: {e}")
    
    def list_backups(self, limit: int = 50) -> List[Dict[str, Any]]:
        """List available backups"""
        cursor = self.db.connection.cursor()
        cursor.execute('''
            SELECT * FROM backup_records 
            ORDER BY created_at DESC 
            LIMIT ?
        ''', (limit,))
        
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
    
    def get_backup_info(self, backup_id: str) -> Optional[Dict[str, Any]]:
        """Get detailed backup information"""
        return self._get_backup_record(backup_id)
    
    def delete_backup(self, backup_id: str) -> bool:
        """Delete a backup"""
        try:
            backup_record = self._get_backup_record(backup_id)
            if not backup_record:
                return False
            
            # Delete backup file
            backup_path = Path(backup_record['backup_path'])
            if backup_path.exists():
                backup_path.unlink()
            
            # Remove from database
            cursor = self.db.connection.cursor()
            cursor.execute('DELETE FROM backup_records WHERE backup_id = ?', (backup_id,))
            self.db.connection.commit()
            
            self.logger.info(f"Deleted backup: {backup_id}")
            return True
            
        except Exception as e:
            self.logger.error(f"Error deleting backup: {e}")
            return False
    
    def upload_backup(self, backup_id: str, upload_url: str) -> bool:
        """Upload backup to cloud storage"""
        try:
            backup_record = self._get_backup_record(backup_id)
            if not backup_record:
                return False
            
            backup_path = Path(backup_record['backup_path'])
            if not backup_path.exists():
                return False
            
            # Upload using requests (would need boto3 for S3)
            import requests
            
            with open(backup_path, 'rb') as f:
                response = requests.put(upload_url, data=f)
            
            if response.status_code in [200, 201]:
                # Mark as uploaded in database
                cursor = self.db.connection.cursor()
                cursor.execute('''
                    UPDATE backup_records 
                    SET uploaded = 1, upload_url = ?
                    WHERE backup_id = ?
                ''', (upload_url, backup_id))
                self.db.connection.commit()
                
                self.logger.info(f"Backup uploaded successfully: {backup_id}")
                return True
            else:
                self.logger.error(f"Upload failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.logger.error(f"Error uploading backup: {e}")
            return False
