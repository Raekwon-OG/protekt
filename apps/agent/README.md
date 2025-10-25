# Protekt Agent

A lightweight, offline-first Python agent for SME device monitoring, security detection, and backup management.

## Features

- **Device Registration**: Online and offline registration with SaaS backend
- **Telemetry Collection**: CPU, RAM, disk, network, and process monitoring
- **Ransomware Detection**: File and process watchers with anomaly detection
- **Backup & Restore**: Encrypted backup creation and restoration
- **Command Processing**: Remote command execution from SaaS backend
- **Offline Queue**: SQLite-based offline data storage and sync
- **Alert System**: Human-readable alerts via WhatsApp and email
- **Audit Logging**: Comprehensive audit trail with rollback capabilities

## Installation

1. **Prerequisites**:
   - Python 3.8 or higher
   - Windows 10/11 (primary target platform)

2. **Install the agent**:
   ```bash
   python install.py
   ```

3. **Configure the agent**:
   - Edit `config.ini` with your SaaS backend details
   - Set up alert channels (WhatsApp webhook, email SMTP)

4. **Run the agent**:
   ```bash
   python main.py
   ```

## Configuration

The agent is configured via `config.ini`:

### Agent Settings
```ini
[agent]
name = ProtektAgent
version = 1.0.0
log_level = INFO
data_dir = ./data
backup_dir = ./backups
```

### SaaS Backend
```ini
[saas]
base_url = http://localhost:3000
api_key = your_api_key
device_token = your_device_token
org_id = your_org_id
heartbeat_interval = 300
command_poll_interval = 60
```

### Monitoring
```ini
[monitoring]
cpu_threshold = 80.0
memory_threshold = 85.0
disk_threshold = 90.0
file_watch_paths = C:\Users,C:\Program Files
exclude_paths = C:\Windows\Temp
```

### Alerts
```ini
[alerts]
enabled = true
whatsapp_webhook = https://hooks.slack.com/...
email_smtp_server = smtp.gmail.com
email_smtp_port = 587
email_username = your_email@gmail.com
email_password = your_app_password
```

## Usage

### Starting the Agent
```bash
python main.py
```

### Windows Service
```bash
# Install service
python protekt_service.py install

# Start service
python protekt_service.py start

# Stop service
python protekt_service.py stop

# Remove service
python protekt_service.py remove
```

### Manual Commands

#### Create Backup
```python
from services.backup_manager import BackupManager
backup_manager = BackupManager(config, db, logger)
backup_id = backup_manager.create_backup(['C:\\Users\\Documents'], 'manual', 'Manual backup')
```

#### Check Queue Status
```python
from services.offline_queue import OfflineQueue
queue = OfflineQueue(config, db, logger)
status = queue.get_queue_status()
print(status)
```

#### Send Test Alert
```python
from services.alert_manager import AlertManager
alert_manager = AlertManager(config, db, logger)
alert_manager.test_alert_system()
```

## API Integration

The agent integrates with the SaaS backend through these endpoints:

- `POST /api/devices/register` - Device registration
- `POST /api/devices/heartbeat` - Telemetry data
- `GET /api/devices/{id}/commands` - Command polling
- `POST /api/devices/{id}/command-result` - Command results
- `POST /api/devices/telemetry-batch` - Batch telemetry
- `POST /api/devices/security-events-batch` - Batch security events

## Security Features

### Ransomware Detection
- Monitors file system for mass operations
- Detects encryption patterns in filenames
- Tracks suspicious process behavior
- Uses machine learning for anomaly detection

### File Monitoring
- Watches critical system directories
- Excludes temporary and cache directories
- Configurable file size limits
- Real-time event processing

### Process Monitoring
- Tracks running processes
- Detects suspicious process names
- Monitors resource usage
- Identifies potential malware

## Backup System

### Features
- Encrypted backup creation
- Compressed archives (tar.gz)
- Checksum verification
- Cloud upload support
- Retention policies

### Usage
```python
# Create backup
backup_id = backup_manager.create_backup(
    source_paths=['C:\\Users\\Documents'],
    backup_type='scheduled',
    description='Daily backup'
)

# Restore backup
success = backup_manager.restore_backup(backup_id, 'C:\\restore')
```

## Alert System

### Alert Types
- Ransomware detection
- System anomalies
- Resource threshold violations
- Backup status
- Command execution
- Device status changes

### Delivery Channels
- WhatsApp webhooks
- Email (SMTP)
- Local logging
- Database storage

## Offline Operation

The agent is designed to work offline:
- Queues all data locally in SQLite
- Syncs when connection is restored
- Maintains full functionality offline
- Automatic retry mechanisms

## Troubleshooting

### Common Issues

1. **Agent won't start**:
   - Check Python version (3.8+ required)
   - Verify all dependencies are installed
   - Check config.ini syntax

2. **No telemetry data**:
   - Verify SaaS backend URL and API key
   - Check network connectivity
   - Review logs in `data/logs/`

3. **Backup failures**:
   - Check disk space
   - Verify source paths exist
   - Review backup directory permissions

4. **Alert delivery issues**:
   - Verify webhook URLs
   - Check SMTP credentials
   - Review alert configuration

### Logs
- Agent logs: `data/logs/agent.log`
- Security logs: `data/logs/security.log`
- Audit logs: `data/logs/audit.log`

### Database
- SQLite database: `data/agent.db`
- Use SQLite browser to inspect data
- Backup database regularly

## Development

### Project Structure
```
apps/agent/
├── main.py                 # Main entry point
├── config.ini             # Configuration
├── requirements.txt       # Dependencies
├── install.py            # Installation script
├── core/                 # Core modules
│   ├── config.py
│   ├── logger.py
│   └── database.py
└── services/             # Service modules
    ├── registration.py
    ├── telemetry.py
    ├── file_watcher.py
    ├── anomaly_detector.py
    ├── backup_manager.py
    ├── command_processor.py
    ├── offline_queue.py
    ├── alert_manager.py
    └── audit_logger.py
```

### Adding New Features
1. Create new service module in `services/`
2. Import and initialize in `main.py`
3. Add configuration options to `config.ini`
4. Update documentation

## License

This project is part of the Protekt SME security platform.
