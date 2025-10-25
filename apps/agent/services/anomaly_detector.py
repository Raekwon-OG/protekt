"""
Anomaly detection service using machine learning
"""

import numpy as np
import pandas as pd
import logging
import threading
import time
from typing import List, Dict, Any, Optional, Tuple
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from datetime import datetime, timedelta
import joblib
from pathlib import Path

class AnomalyDetector:
    """Local anomaly detection using IsolationForest and heuristics"""
    
    def __init__(self, config, db, logger):
        self.config = config
        self.db = db
        self.logger = logger
        self.running = False
        self.thread = None
        
        # ML model components
        self.isolation_forest = None
        self.scaler = StandardScaler()
        self.model_trained = False
        self.model_path = Path(config.get('agent', 'data_dir', './data')) / 'anomaly_model.pkl'
        
        # Training data
        self.training_data = []
        self.min_training_samples = 100
        self.max_training_samples = 10000
        
        # Anomaly detection parameters
        self.contamination = 0.05  # Expected proportion of anomalies (reduced from 0.1)
        self.anomaly_threshold = -0.3  # Threshold for anomaly detection (less sensitive)
        
        # Feature weights for different types of anomalies
        self.feature_weights = {
            'cpu_usage': 0.2,
            'memory_usage': 0.2,
            'disk_usage': 0.15,
            'network_io': 0.15,
            'process_count': 0.1,
            'file_operations': 0.1,
            'login_attempts': 0.05,
            'error_rate': 0.05
        }
        
        # Historical data for trend analysis
        self.historical_data = []
        self.max_history = 1000
    
    def start(self):
        """Start anomaly detection service"""
        if self.running:
            return
        
        self.running = True
        self.thread = threading.Thread(target=self._detection_loop, daemon=True)
        self.thread.start()
        self.logger.info("Anomaly detection started")
    
    def stop(self):
        """Stop anomaly detection service"""
        self.running = False
        if self.thread:
            self.thread.join(timeout=5)
        self.logger.info("Anomaly detection stopped")
    
    def _detection_loop(self):
        """Main anomaly detection loop"""
        while self.running:
            try:
                # Load or train model if needed
                if not self.model_trained:
                    self._load_or_train_model()
                
                # Collect current system state
                current_features = self._collect_features()
                
                if current_features is not None:
                    # Detect anomalies
                    self._detect_anomalies(current_features)
                    
                    # Add to historical data
                    self._add_to_history(current_features)
                
                # Retrain model periodically (every hour)
                if len(self.training_data) > self.min_training_samples:
                    self._retrain_model_if_needed()
                
                time.sleep(60)  # Check every minute
                
            except Exception as e:
                self.logger.error(f"Error in anomaly detection: {e}")
                time.sleep(60)
    
    def _load_or_train_model(self):
        """Load existing model or train new one"""
        try:
            if self.model_path.exists():
                # Load existing model
                model_data = joblib.load(self.model_path)
                self.isolation_forest = model_data['model']
                self.scaler = model_data['scaler']
                self.model_trained = True
                self.logger.info("Loaded existing anomaly detection model")
            else:
                # Train new model
                self._train_model()
        except Exception as e:
            self.logger.error(f"Error loading model: {e}")
            self._train_model()
    
    def _train_model(self):
        """Train anomaly detection model"""
        try:
            self.logger.info("Training anomaly detection model...")
            
            # Collect training data
            self._collect_training_data()
            
            if len(self.training_data) < self.min_training_samples:
                self.logger.warning(f"Insufficient training data: {len(self.training_data)} samples")
                return
            
            # Prepare training data
            df = pd.DataFrame(self.training_data)
            features = self._extract_features(df)
            
            if features is None or len(features) == 0:
                self.logger.warning("No valid features for training")
                return
            
            # Scale features
            features_scaled = self.scaler.fit_transform(features)
            
            # Train Isolation Forest
            self.isolation_forest = IsolationForest(
                contamination=self.contamination,
                random_state=42,
                n_estimators=100
            )
            self.isolation_forest.fit(features_scaled)
            
            # Save model
            model_data = {
                'model': self.isolation_forest,
                'scaler': self.scaler,
                'feature_columns': list(features.columns),
                'trained_at': datetime.utcnow().isoformat()
            }
            joblib.dump(model_data, self.model_path)
            
            self.model_trained = True
            self.logger.info("Anomaly detection model trained successfully")
            
        except Exception as e:
            self.logger.error(f"Error training model: {e}")
    
    def _collect_training_data(self):
        """Collect training data from historical telemetry"""
        try:
            # First, try to load training data from file (if available)
            training_file = Path(self.config.get('agent', 'data_dir', './data')) / 'training_data.json'
            if training_file.exists():
                try:
                    with open(training_file, 'r') as f:
                        file_data = json.load(f)
                    self.training_data = file_data
                    self.logger.info(f"Loaded {len(file_data)} training samples from file")
                    
                    # If we have enough data from file, use it
                    if len(self.training_data) >= self.min_training_samples:
                        return
                except Exception as e:
                    self.logger.warning(f"Could not load training data file: {e}")
            
            # Get historical telemetry data from database
            cursor = self.db.connection.cursor()
            cursor.execute('''
                SELECT * FROM telemetry_cache 
                ORDER BY timestamp DESC 
                LIMIT ?
            ''', (self.max_training_samples,))
            
            rows = cursor.fetchall()
            db_data = [dict(row) for row in rows]
            
            # Combine file data and database data
            if 'file_data' in locals():
                self.training_data = file_data + db_data
            else:
                self.training_data = db_data
            
            # If not enough data, generate synthetic normal data
            if len(self.training_data) < self.min_training_samples:
                self._generate_synthetic_data()
                
        except Exception as e:
            self.logger.error(f"Error collecting training data: {e}")
            self._generate_synthetic_data()
    
    def _generate_synthetic_data(self):
        """Generate synthetic normal data for training"""
        self.logger.info("Generating synthetic training data...")
        
        # Generate normal system behavior patterns
        np.random.seed(42)
        n_samples = self.min_training_samples
        
        synthetic_data = []
        for i in range(n_samples):
            data = {
                'cpu_percent': np.random.normal(30, 15),  # Normal CPU usage
                'memory_percent': np.random.normal(50, 20),  # Normal memory usage
                'disk_percent': np.random.normal(60, 25),  # Normal disk usage
                'processes_count': np.random.normal(150, 30),  # Normal process count
                'uptime_seconds': np.random.uniform(3600, 86400),  # 1 hour to 1 day
                'timestamp': datetime.utcnow().isoformat()
            }
            synthetic_data.append(data)
        
        self.training_data = synthetic_data
        self.logger.info(f"Generated {len(synthetic_data)} synthetic training samples")
    
    def _extract_features(self, df: pd.DataFrame) -> Optional[pd.DataFrame]:
        """Extract features for anomaly detection"""
        try:
            features = pd.DataFrame()
            
            # Basic system metrics
            features['cpu_percent'] = df['cpu_percent'].fillna(0)
            features['memory_percent'] = df['memory_percent'].fillna(0)
            features['disk_percent'] = df['disk_percent'].fillna(0)
            features['processes_count'] = df['processes_count'].fillna(0)
            
            # Calculate additional features
            features['cpu_memory_ratio'] = features['cpu_percent'] / (features['memory_percent'] + 1)
            features['resource_usage'] = (features['cpu_percent'] + features['memory_percent'] + features['disk_percent']) / 3
            
            # Time-based features
            if 'timestamp' in df.columns:
                df['timestamp'] = pd.to_datetime(df['timestamp'])
                features['hour_of_day'] = df['timestamp'].dt.hour
                features['day_of_week'] = df['timestamp'].dt.dayofweek
            else:
                features['hour_of_day'] = 12  # Default to noon
                features['day_of_week'] = 1   # Default to Monday
            
            # Statistical features
            if len(features) > 10:
                features['cpu_rolling_mean'] = features['cpu_percent'].rolling(window=5, min_periods=1).mean()
                features['memory_rolling_std'] = features['memory_percent'].rolling(window=5, min_periods=1).std()
            else:
                features['cpu_rolling_mean'] = features['cpu_percent']
                features['memory_rolling_std'] = 0
            
            # Fill any remaining NaN values
            features = features.fillna(0)
            
            return features
            
        except Exception as e:
            self.logger.error(f"Error extracting features: {e}")
            return None
    
    def _collect_features(self) -> Optional[Dict[str, Any]]:
        """Collect current system features"""
        try:
            # Get latest telemetry data
            cursor = self.db.connection.cursor()
            cursor.execute('''
                SELECT * FROM telemetry_cache 
                ORDER BY timestamp DESC 
                LIMIT 1
            ''')
            
            row = cursor.fetchone()
            if not row:
                return None
            
            data = dict(row)
            
            # Get recent file operations count
            cursor.execute('''
                SELECT COUNT(*) as file_ops FROM security_events 
                WHERE event_type = 'file_change' 
                AND timestamp > datetime('now', '-1 hour')
            ''')
            file_ops_row = cursor.fetchone()
            data['file_operations'] = file_ops_row['file_ops'] if file_ops_row else 0
            
            # Get recent error count
            cursor.execute('''
                SELECT COUNT(*) as errors FROM security_events 
                WHERE severity = 'high' 
                AND timestamp > datetime('now', '-1 hour')
            ''')
            error_row = cursor.fetchone()
            data['error_rate'] = error_row['errors'] if error_row else 0
            
            # Get network I/O (simplified)
            data['network_io'] = 0  # Placeholder - would need more complex network monitoring
            
            return data
            
        except Exception as e:
            self.logger.error(f"Error collecting features: {e}")
            return None
    
    def _detect_anomalies(self, current_data: Dict[str, Any]):
        """Detect anomalies in current system state"""
        try:
            if not self.model_trained or self.isolation_forest is None:
                return
            
            # Convert to DataFrame for feature extraction
            df = pd.DataFrame([current_data])
            features = self._extract_features(df)
            
            if features is None or len(features) == 0:
                return
            
            # Scale features
            features_scaled = self.scaler.transform(features)
            
            # Predict anomaly score
            anomaly_score = self.isolation_forest.decision_function(features_scaled)[0]
            is_anomaly = self.isolation_forest.predict(features_scaled)[0] == -1
            
            # Log anomaly if detected
            if is_anomaly or anomaly_score < self.anomaly_threshold:
                self._handle_anomaly(current_data, anomaly_score, bool(is_anomaly))
            
            # Also check heuristic-based anomalies
            self._check_heuristic_anomalies(current_data)
            
        except Exception as e:
            self.logger.error(f"Error detecting anomalies: {e}")
    
    def _handle_anomaly(self, data: Dict[str, Any], score: float, is_anomaly: bool):
        """Handle detected anomaly"""
        severity = 'high' if is_anomaly else 'medium'
        
        self.logger.warning(f"Anomaly detected: score={score:.3f}, is_anomaly={is_anomaly}")
        
        # Log security event
        self.db.log_security_event(
            event_type='anomaly_detected',
            severity=severity,
            description=f"System anomaly detected (score: {score:.3f})",
            details={
                'anomaly_score': float(score),
                'is_anomaly': bool(is_anomaly),
                'cpu_percent': float(data.get('cpu_percent', 0)),
                'memory_percent': float(data.get('memory_percent', 0)),
                'disk_percent': float(data.get('disk_percent', 0)),
                'processes_count': int(data.get('processes_count', 0))
            }
        )
        
        # Log audit event
        self.db.log_audit(
            action='anomaly_detected',
            resource='system',
            details={
                'score': score,
                'is_anomaly': is_anomaly,
                'data': data
            }
        )
    
    def _check_heuristic_anomalies(self, data: Dict[str, Any]):
        """Check for heuristic-based anomalies"""
        anomalies = []
        
        # Check for sudden resource spikes
        if len(self.historical_data) > 5:
            recent_avg_cpu = np.mean([d.get('cpu_percent', 0) for d in self.historical_data[-5:]])
            current_cpu = data.get('cpu_percent', 0)
            
            if current_cpu > recent_avg_cpu * 2 and current_cpu > 50:
                anomalies.append({
                    'type': 'cpu_spike',
                    'severity': 'medium',
                    'message': f'CPU usage spike: {current_cpu:.1f}% (avg: {recent_avg_cpu:.1f}%)',
                    'current': current_cpu,
                    'average': recent_avg_cpu
                })
        
        # Check for memory leak pattern
        if len(self.historical_data) > 10:
            memory_values = [d.get('memory_percent', 0) for d in self.historical_data[-10:]]
            if len(memory_values) > 5:
                # Check if memory is consistently increasing
                trend = np.polyfit(range(len(memory_values)), memory_values, 1)[0]
                if trend > 2 and memory_values[-1] > 70:  # 2% increase per sample, >70% usage
                    anomalies.append({
                        'type': 'memory_leak',
                        'severity': 'high',
                        'message': f'Potential memory leak detected: {memory_values[-1]:.1f}% usage with increasing trend',
                        'trend': trend,
                        'current_usage': memory_values[-1]
                    })
        
        # Log detected heuristic anomalies
        for anomaly in anomalies:
            self.db.log_security_event(
                event_type='heuristic_anomaly',
                severity=anomaly['severity'],
                description=anomaly['message'],
                details=anomaly
            )
    
    def _add_to_history(self, data: Dict[str, Any]):
        """Add current data to historical data"""
        self.historical_data.append(data)
        
        # Keep only recent history
        if len(self.historical_data) > self.max_history:
            self.historical_data = self.historical_data[-self.max_history:]
    
    def _retrain_model_if_needed(self):
        """Retrain model if enough new data is available"""
        try:
            # Check if we have enough new data since last training
            if len(self.training_data) > self.min_training_samples * 1.5:
                self.logger.info("Retraining anomaly detection model with new data...")
                self._train_model()
        except Exception as e:
            self.logger.error(f"Error retraining model: {e}")
    
    def get_anomaly_summary(self, hours: int = 24) -> Dict[str, Any]:
        """Get summary of recent anomalies"""
        try:
            cursor = self.db.connection.cursor()
            cursor.execute('''
                SELECT event_type, severity, COUNT(*) as count
                FROM security_events 
                WHERE event_type IN ('anomaly_detected', 'heuristic_anomaly')
                AND timestamp > datetime('now', '-{} hours')
                GROUP BY event_type, severity
            '''.format(hours))
            
            rows = cursor.fetchall()
            summary = {
                'total_anomalies': sum(row['count'] for row in rows),
                'by_type': {},
                'by_severity': {}
            }
            
            for row in rows:
                event_type = row['event_type']
                severity = row['severity']
                count = row['count']
                
                summary['by_type'][event_type] = summary['by_type'].get(event_type, 0) + count
                summary['by_severity'][severity] = summary['by_severity'].get(severity, 0) + count
            
            return summary
            
        except Exception as e:
            self.logger.error(f"Error getting anomaly summary: {e}")
            return {'total_anomalies': 0, 'by_type': {}, 'by_severity': {}}
