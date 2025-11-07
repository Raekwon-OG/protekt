# Agent-Backend Integration Summary

## ✅ Completed Integration

All agent services are now connected to the backend API. Here's what was implemented:

### Backend API Endpoints Added

1. **Device Registration** - `POST /api/devices/register`
   - Allows agents to register with the backend
   - Accepts device_id, device_name, device_type, org_id, api_key
   - Returns device_id, org_id, status, registered_at

2. **Heartbeat** - `POST /api/devices/heartbeat`
   - Receives telemetry data from agents
   - Updates device status, lastSeen, and risk level
   - Accepts full telemetry payload from agent

3. **Backup Upload** - `POST /api/backup/upload`
   - Returns pre-signed upload URLs for backup files
   - Accepts device_id, backup_id, file_size
   - Returns upload_url, expires_at, method

4. **Security Routes** - Added aliases for agent compatibility
   - `POST /api/security/urlscan` (alias for scan-url)
   - `POST /api/security/emailscan` (alias for ingest-email)

### Agent Services Created

1. **Email Scanner** (`services/email_scanner.py`)
   - Scans emails for phishing and malware
   - Extracts URLs and attachments
   - Sends to backend `/api/security/emailscan`
   - Logs results to local database

2. **URL Scanner** (`services/url_scanner.py`)
   - Scans URLs for threats
   - Normalizes URL format
   - Sends to backend `/api/security/urlscan`
   - Logs results to local database

### Database Updates

Added tables to agent database:
- `email_scan_logs` - Stores email scan results
- `url_scan_logs` - Stores URL scan results

### Integration Points

1. **Registration Flow**
   - Agent registers on startup if not already registered
   - Supports online (with backend) and offline modes
   - Saves registration data to local database

2. **Heartbeat Flow**
   - Telemetry collector sends data every 5 minutes (configurable)
   - Falls back to offline queue if backend unavailable
   - Updates device status in backend

3. **Email/URL Scanning**
   - Services can be called programmatically
   - Results logged locally and sent to backend
   - Offline queue support for when backend unavailable

4. **Backup Upload**
   - Backup manager requests upload URL from backend
   - Uploads backup file to provided URL
   - Marks backup as uploaded in local database

### Configuration

Agent configuration (`config.ini`):
```ini
[saas]
base_url = http://localhost:3000  # Backend URL
api_key =                          # Optional API key
org_id = offline                   # Organization ID
heartbeat_interval = 300           # Seconds between heartbeats
```

### Usage Examples

#### Scan an Email
```python
from services.email_scanner import EmailScanner
scanner = EmailScanner(config, db, logger)
result = scanner.scan_email(email_content)
```

#### Scan a URL
```python
from services.url_scanner import URLScanner
scanner = URLScanner(config, db, logger)
result = scanner.scan_url("https://example.com")
```

#### Upload Backup
```python
from services.backup_manager import BackupManager
backup_manager = BackupManager(config, db, logger)
backup_id = backup_manager.create_backup(['C:\\Users\\Documents'], 'manual')
backup_manager.upload_backup(backup_id)  # Automatically gets upload URL
```

### Testing

To test the integration:

1. **Start the backend API**
   ```bash
   cd apps/api
   npm run dev
   ```

2. **Configure agent** - Update `apps/agent/config.ini`:
   ```ini
   [saas]
   base_url = http://localhost:3000
   org_id = your-org-id
   ```

3. **Start the agent**
   ```bash
   cd apps/agent
   python main.py
   ```

4. **Verify registration** - Check backend logs for registration request

5. **Verify heartbeat** - Check backend logs for heartbeat every 5 minutes

### API Endpoints Summary

| Endpoint | Method | Purpose | Auth Required |
|----------|--------|---------|---------------|
| `/api/devices/register` | POST | Device registration | No |
| `/api/devices/heartbeat` | POST | Telemetry/heartbeat | No |
| `/api/security/urlscan` | POST | URL scanning | Optional |
| `/api/security/emailscan` | POST | Email scanning | Optional |
| `/api/backup/upload` | POST | Get backup upload URL | Optional |

### Next Steps

1. Add authentication tokens for device-to-backend communication
2. Implement S3 pre-signed URLs for backup uploads
3. Add webhook support for real-time alerts
4. Implement command polling from backend
5. Add batch upload endpoints for efficiency

### Notes

- All endpoints support offline mode (data queued locally)
- Agent gracefully handles backend unavailability
- All scan results are logged locally for audit trail
- Registration works with or without org_id (for testing)

