# Protekt Agent - User Configuration Guide

## 🚀 Quick Start (For Non-Technical Users)

### Step 1: Deploy the Agent
```bash
python deploy.py
```

### Step 2: Configure Settings
Edit `config.ini` file:

#### Basic Settings
```ini
[agent]
name = YourCompanyAgent
log_level = INFO

[saas]
base_url = https://your-saas-backend.com
api_key = your_api_key_here
org_id = your_organization_id
```

#### Alert Settings
```ini
[alerts]
enabled = true
whatsapp_webhook = https://hooks.slack.com/services/YOUR/WEBHOOK/URL
email_smtp_server = smtp.gmail.com
email_smtp_port = 587
email_username = your_email@gmail.com
email_password = your_app_password
```

#### Monitoring Settings
```ini
[monitoring]
cpu_threshold = 80.0
memory_threshold = 85.0
disk_threshold = 90.0
```

### Step 3: Run the Agent
- **Windows**: Double-click `start_agent.bat`
- **Command Line**: `python main.py`

## 📊 How to Verify It's Working

### 1. Check Status
```bash
python inspect_data.py
```

### 2. Run Tests
```bash
python test_agent.py
```

### 3. View Logs
- **Agent Log**: `data/logs/agent.log`
- **Security Log**: `data/logs/security.log`
- **Audit Log**: `data/logs/audit.log`

## 🔧 Troubleshooting

### Common Issues

1. **"Python not found"**
   - Install Python 3.8+ from python.org
   - Make sure Python is in your PATH

2. **"Database is locked"**
   - Stop the agent (Ctrl+C)
   - Wait 5 seconds
   - Restart the agent

3. **"No alerts received"**
   - Check WhatsApp webhook URL
   - Verify email SMTP settings
   - Check `data/logs/agent.log` for errors

4. **"Too many false alerts"**
   - Let the agent run for 24-48 hours
   - It will learn your system's normal patterns
   - Adjust thresholds in config.ini

## 📈 What to Expect

### First Day
- Many alerts (learning phase)
- High CPU/memory usage (normal)
- Some false positives

### After 1 Week
- Fewer false positives
- More accurate detection
- Stable performance

### After 1 Month
- Highly accurate detection
- Minimal false positives
- Optimized performance

## 🛡️ Security Features

The agent monitors:
- ✅ **File Changes** - Detects ransomware
- ✅ **Process Behavior** - Finds malware
- ✅ **System Resources** - Prevents overload
- ✅ **Network Activity** - Blocks threats
- ✅ **Anomalies** - ML-based detection

## 📞 Support

If you need help:
1. Check the logs in `data/logs/`
2. Run `python test_agent.py`
3. Contact your IT administrator
4. Review this guide
