# Poker Tracker WebUI

A simple poker results tracking web application designed for Ubuntu servers.

## Features

- Track poker results with club name, account name, and result amount
- Day/week/month/year period filtering
- Club summaries with totals and session counts
- Database backup/restore functionality
- Clean, responsive dark mode interface

## Ubuntu Installation

### Prerequisites
```bash
# Update system
sudo apt update

# Install Node.js and npm
sudo apt install -y nodejs npm

# Install build tools (for SQLite3)
sudo apt install -y build-essential python3
```

### Setup
```bash
# Clone repository
git clone https://github.com/ygrfil/Poker-Tracker-WebUI.git
cd Poker-Tracker-WebUI

# Install dependencies
npm install

# Start application
npm start
```

The application will be available at `http://your-server-ip:80`

### Keep App Running (Auto-restart)
To automatically start the app on boot and restart it if it crashes:

```bash
# Setup auto-restart service
sudo ./setup-keepalive.sh
```

This will:
- Install a systemd service that starts on boot
- Monitor the app and restart it if it crashes
- Automatically restart after container reboots

### Manual Control
```bash
# Check if app is running
./keepalive.sh status

# Start the app with monitoring
./keepalive.sh run

# Restart the app
./keepalive.sh restart

# Control the service
sudo systemctl status poker-tracker
sudo systemctl restart poker-tracker
```

### After Updates
When you pull new changes:
```bash
git pull
npm install  # Rebuilds native modules for Ubuntu
sudo systemctl restart poker-tracker  # Restart service
```

## Usage

1. **Add Results**: Fill in club name, account name, and result amount
2. **Period Filtering**: Use Day/Week/Month/Year buttons to filter results
3. **Backup/Restore**: Use settings menu to backup or restore your database
4. **Edit Results**: Click Edit button on any result to modify it

## Database

- Uses SQLite database stored in `./database/poker.db`
- Automatic database creation on first run
- Backup/restore functionality built into the app

## Troubleshooting

### Port 80 in use:
```bash
sudo systemctl stop apache2
sudo systemctl stop nginx
sudo pkill -f node
```

### SQLite3 errors after git pull:
```bash
rm -rf node_modules package-lock.json
npm install
```

## License

MIT License