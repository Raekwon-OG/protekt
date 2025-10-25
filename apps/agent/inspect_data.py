#!/usr/bin/env python3
"""
Protekt Agent Data Inspector
View and analyze all agent data
"""

import sqlite3
import json
import pandas as pd
from pathlib import Path
from datetime import datetime, timedelta
import joblib

class DataInspector:
    """Inspect and analyze agent data"""
    
    def __init__(self):
        self.db_path = Path("data/agent.db")
        self.model_path = Path("data/anomaly_model.pkl")
        self.logs_dir = Path("data/logs")
    
    def inspect_database(self):
        """Inspect SQLite database contents"""
        if not self.db_path.exists():
            print("❌ Database file not found")
            return
        
        print("📊 DATABASE INSPECTION")
        print("=" * 50)
        
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Get table information
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        
        print(f"📋 Tables found: {len(tables)}")
        for table in tables:
            table_name = table['name']
            cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
            count = cursor.fetchone()[0]
            print(f"  • {table_name}: {count} records")
        
        print("\n📈 RECENT DATA SAMPLES:")
        
        # Device registration
        cursor.execute("SELECT * FROM device_registration ORDER BY registered_at DESC LIMIT 1")
        reg = cursor.fetchone()
        if reg:
            print(f"🔐 Device Registration:")
            print(f"  • Device ID: {reg['device_id']}")
            print(f"  • Org ID: {reg['org_id']}")
            print(f"  • Status: {reg['status']}")
            print(f"  • Registered: {reg['registered_at']}")
        
        # Recent telemetry
        cursor.execute("SELECT * FROM telemetry_cache ORDER BY timestamp DESC LIMIT 5")
        telemetry = cursor.fetchall()
        if telemetry:
            print(f"\n📊 Recent Telemetry ({len(telemetry)} samples):")
            for t in telemetry:
                print(f"  • {t['timestamp']}: CPU={t['cpu_percent']:.1f}%, RAM={t['memory_percent']:.1f}%, Disk={t['disk_percent']:.1f}%")
        
        # Security events
        cursor.execute("SELECT * FROM security_events ORDER BY timestamp DESC LIMIT 5")
        events = cursor.fetchall()
        if events:
            print(f"\n🚨 Recent Security Events ({len(events)} events):")
            for e in events:
                print(f"  • {e['timestamp']}: {e['event_type']} ({e['severity']}) - {e['description']}")
        
        # Command history
        cursor.execute("SELECT * FROM command_history ORDER BY created_at DESC LIMIT 5")
        commands = cursor.fetchall()
        if commands:
            print(f"\n⚡ Recent Commands ({len(commands)} commands):")
            for c in commands:
                print(f"  • {c['created_at']}: {c['command_type']} ({c['status']})")
        
        # Offline queue
        cursor.execute("SELECT queue_type, COUNT(*) as count FROM offline_queue GROUP BY queue_type")
        queue = cursor.fetchall()
        if queue:
            print(f"\n📦 Offline Queue:")
            for q in queue:
                print(f"  • {q['queue_type']}: {q['count']} items")
        
        conn.close()
    
    def inspect_model(self):
        """Inspect ML model"""
        print("\n🧠 ML MODEL INSPECTION")
        print("=" * 50)
        
        if not self.model_path.exists():
            print("❌ Model file not found")
            return
        
        try:
            model_data = joblib.load(self.model_path)
            print("✅ Model loaded successfully")
            print(f"📅 Trained at: {model_data.get('trained_at', 'Unknown')}")
            print(f"🔧 Feature columns: {len(model_data.get('feature_columns', []))}")
            print(f"📊 Features: {model_data.get('feature_columns', [])}")
            
            # Model info
            model = model_data['model']
            print(f"🌲 Estimators: {model.n_estimators}")
            print(f"📈 Contamination: {model.contamination}")
            
        except Exception as e:
            print(f"❌ Error loading model: {e}")
    
    def inspect_logs(self):
        """Inspect log files"""
        print("\n📝 LOG INSPECTION")
        print("=" * 50)
        
        if not self.logs_dir.exists():
            print("❌ Logs directory not found")
            return
        
        log_files = list(self.logs_dir.glob("*.log"))
        print(f"📋 Log files found: {len(log_files)}")
        
        for log_file in log_files:
            print(f"\n📄 {log_file.name}:")
            try:
                with open(log_file, 'r') as f:
                    lines = f.readlines()
                
                print(f"  • Total lines: {len(lines)}")
                
                # Show recent entries
                recent_lines = lines[-5:] if len(lines) > 5 else lines
                print("  • Recent entries:")
                for line in recent_lines:
                    print(f"    {line.strip()}")
                    
            except Exception as e:
                print(f"  ❌ Error reading {log_file.name}: {e}")
    
    def generate_report(self):
        """Generate comprehensive data report"""
        print("\n📊 COMPREHENSIVE DATA REPORT")
        print("=" * 60)
        
        # Database summary
        self.inspect_database()
        
        # Model summary
        self.inspect_model()
        
        # Logs summary
        self.inspect_logs()
        
        print("\n✅ Data inspection complete!")

def main():
    """Main function"""
    inspector = DataInspector()
    inspector.generate_report()

if __name__ == "__main__":
    main()

