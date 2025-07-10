# Ubuntu Deployment Guide

This guide provides automated setup and deployment for Poker Tracker on Ubuntu servers.

## Quick Setup (One-time)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/ygrfil/Poker-Tracker-WebUI.git
   cd Poker-Tracker-WebUI
   ```

2. **Run the deployment script:**
   ```bash
   sudo ./deploy.sh
   ```

This script will:
- Install all required dependencies (Node.js, build tools)
- Install npm packages and rebuild native modules for Ubuntu
- Create and configure systemd service
- Start the application on port 80

## Regular Updates (After git pull)

After pulling new changes from the repository:

```bash
git pull
sudo ./update.sh
```

The update script will:
- Stop the service
- Update npm dependencies
- Restart the service

## Manual Service Management

### Check service status:
```bash
systemctl status poker-tracker
```

### View live logs:
```bash
journalctl -u poker-tracker -f
```

### Restart service:
```bash
sudo systemctl restart poker-tracker
```

### Stop service:
```bash
sudo systemctl stop poker-tracker
```

### Start service:
```bash
sudo systemctl start poker-tracker
```

## Troubleshooting

### Port 80 is already in use:
```bash
# Check what's using port 80
sudo netstat -tlnp | grep :80

# Stop common web servers
sudo systemctl stop apache2
sudo systemctl stop nginx

# Restart poker tracker
sudo systemctl restart poker-tracker
```

### SQLite3 native module errors:
```bash
# Remove and reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Service won't start:
```bash
# Check detailed logs
journalctl -u poker-tracker --no-pager

# Check if database directory exists
ls -la database/

# Test manual startup
node server.js
```

## File Structure

```
/Poker-Tracker-WebUI/
├── server.js                 # Main application
├── package.json              # Dependencies
├── deploy.sh                 # Initial deployment script
├── update.sh                 # Regular update script
├── poker-tracker.service     # Systemd service template
├── database/
│   └── poker.db             # SQLite database
├── public/                  # Frontend files
└── uploads/                 # Temporary backup uploads
```

## Security Notes

- The application runs as root (for port 80 access)
- Ensure firewall is configured if needed
- Database backups are recommended before major updates
- Upload directory is cleaned automatically after restore operations

## Performance

- Service automatically restarts on crashes
- Native modules are rebuilt for optimal Ubuntu performance
- Logs are managed by systemd journal