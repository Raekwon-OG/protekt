"""
SQLite database management for offline-first operation
"""

import sqlite3
import json
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime

class Database:
    """SQLite database manager for offline queue and local data storage"""
    
    def __init__(self, config):
        self.config = config
        self.logger = logging.getLogger('protekt_agent.database')
        self.db_path = Path(config.get('agent', 'data_dir', './data')) / 'agent.db'
        self.connection = None
    
    def initialize(self):
        """Initialize database and create tables"""
        try:
            self.connection = sqlite3.connect(str(self.db_path), check_same_thread=False)
            self.connection.row_factory = sqlite3.Row
            self._create_tables()
            self.logger.info("Database initialized successfully")
        except Exception as e:
            self.logger.error(f"Failed to initialize database: {e}")
            raise
    
    def _create_tables(self):
        """Create required database tables"""
        cursor = self.connection.cursor()
        
        # Device registration table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS device_registration (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id TEXT UNIQUE NOT NULL,
                org_id TEXT,
                api_key TEXT,
                registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_heartbeat TIMESTAMP,
                status TEXT DEFAULT 'active'
            )
        ''')
        
        # Offline queue for commands and data
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS offline_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                queue_type TEXT NOT NULL,  -- 'command', 'telemetry', 'alert', 'backup'
                payload TEXT NOT NULL,     -- JSON data
                priority INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                retry_count INTEGER DEFAULT 0,
                max_retries INTEGER DEFAULT 3,
                status TEXT DEFAULT 'pending'  -- 'pending', 'processing', 'completed', 'failed'
            )
        ''')
        
        # Telemetry data cache
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS telemetry_cache (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                cpu_percent REAL,
                memory_percent REAL,
                disk_percent REAL,
                network_io TEXT,  -- JSON
                processes_count INTEGER,
                uptime_seconds INTEGER,
                ip_address TEXT
            )
        ''')
        
        # Security events
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS security_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type TEXT NOT NULL,  -- 'file_change', 'process_anomaly', 'suspicious_activity'
                severity TEXT NOT NULL,    -- 'low', 'medium', 'high', 'critical'
                description TEXT NOT NULL,
                file_path TEXT,
                process_name TEXT,
                details TEXT,  -- JSON
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                resolved BOOLEAN DEFAULT FALSE
            )
        ''')
        
        # Backup records
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS backup_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                backup_id TEXT UNIQUE NOT NULL,
                backup_type TEXT NOT NULL,  -- 'manual', 'scheduled', 'command'
                source_paths TEXT NOT NULL,  -- JSON array
                backup_path TEXT NOT NULL,
                size_bytes INTEGER,
                encrypted BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                uploaded BOOLEAN DEFAULT FALSE,
                upload_url TEXT
            )
        ''')
        
        # Command history
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS command_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                command_id TEXT UNIQUE NOT NULL,
                command_type TEXT NOT NULL,
                parameters TEXT,  -- JSON
                status TEXT NOT NULL,  -- 'received', 'executing', 'completed', 'failed'
                result TEXT,  -- JSON
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP
            )
        ''')
        
        # Audit log
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action TEXT NOT NULL,
                resource TEXT,
                details TEXT,  -- JSON
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                user_context TEXT
            )
        ''')
        
        self.connection.commit()
        self.logger.info("Database tables created successfully")
    
    def add_to_queue(self, queue_type: str, payload: Dict[str, Any], priority: int = 0) -> int:
        """Add item to offline queue"""
        cursor = self.connection.cursor()
        cursor.execute('''
            INSERT INTO offline_queue (queue_type, payload, priority)
            VALUES (?, ?, ?)
        ''', (queue_type, json.dumps(payload), priority))
        self.connection.commit()
        return cursor.lastrowid
    
    def get_queue_items(self, queue_type: Optional[str] = None, status: str = 'pending', limit: int = 100) -> List[Dict[str, Any]]:
        """Get items from offline queue"""
        cursor = self.connection.cursor()
        
        if queue_type:
            cursor.execute('''
                SELECT * FROM offline_queue 
                WHERE queue_type = ? AND status = ?
                ORDER BY priority DESC, created_at ASC
                LIMIT ?
            ''', (queue_type, status, limit))
        else:
            cursor.execute('''
                SELECT * FROM offline_queue 
                WHERE status = ?
                ORDER BY priority DESC, created_at ASC
                LIMIT ?
            ''', (status, limit))
        
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
    
    def update_queue_item(self, item_id: int, status: str, result: Optional[Dict[str, Any]] = None):
        """Update queue item status"""
        cursor = self.connection.cursor()
        cursor.execute('''
            UPDATE offline_queue 
            SET status = ?, retry_count = retry_count + 1
            WHERE id = ?
        ''', (status, item_id))
        
        if result:
            # Update payload with result
            cursor.execute('SELECT payload FROM offline_queue WHERE id = ?', (item_id,))
            row = cursor.fetchone()
            if row:
                payload = json.loads(row['payload'])
                payload['result'] = result
                cursor.execute('''
                    UPDATE offline_queue 
                    SET payload = ?
                    WHERE id = ?
                ''', (json.dumps(payload), item_id))
        
        self.connection.commit()
    
    def log_security_event(self, event_type: str, severity: str, description: str, 
                          file_path: Optional[str] = None, process_name: Optional[str] = None,
                          details: Optional[Dict[str, Any]] = None):
        """Log security event"""
        cursor = self.connection.cursor()
        cursor.execute('''
            INSERT INTO security_events 
            (event_type, severity, description, file_path, process_name, details)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (event_type, severity, description, file_path, process_name, 
              json.dumps(details) if details else None))
        self.connection.commit()
    
    def log_audit(self, action: str, resource: Optional[str] = None, 
                  details: Optional[Dict[str, Any]] = None, user_context: Optional[str] = None):
        """Log audit event"""
        cursor = self.connection.cursor()
        cursor.execute('''
            INSERT INTO audit_log (action, resource, details, user_context)
            VALUES (?, ?, ?, ?)
        ''', (action, resource, json.dumps(details) if details else None, user_context))
        self.connection.commit()
    
    def close(self):
        """Close database connection"""
        if self.connection:
            self.connection.close()
            self.connection = None
