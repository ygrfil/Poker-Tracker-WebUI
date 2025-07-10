#!/bin/bash

# Poker Tracker Ubuntu Deployment Script
# This script automates the deployment process on Ubuntu servers

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SERVICE_NAME="poker-tracker"
USER="root"
INSTALL_DIR="/Poker-Tracker-WebUI"
PORT=80

echo -e "${GREEN}Starting Poker Tracker Deployment...${NC}"

# Function to print status messages
print_status() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
    print_error "Please run this script as root or with sudo"
    exit 1
fi

# Update system packages
print_status "Updating system packages..."
apt-get update

# Install required dependencies
print_status "Installing required dependencies..."
apt-get install -y build-essential python3 nodejs npm git

# Check if directory exists
if [ ! -d "$INSTALL_DIR" ]; then
    print_error "Directory $INSTALL_DIR does not exist. Please clone the repository first."
    exit 1
fi

# Navigate to project directory
cd "$INSTALL_DIR"

# Stop existing service if running
print_status "Stopping existing service..."
systemctl stop $SERVICE_NAME 2>/dev/null || true

# Kill any existing node processes on port 80
print_status "Killing existing processes on port $PORT..."
lsof -ti:$PORT | xargs kill -9 2>/dev/null || true

# Pull latest changes
print_status "Pulling latest changes from Git..."
git pull origin master

# Remove node_modules to force rebuild of native modules
print_status "Removing old node_modules..."
rm -rf node_modules package-lock.json

# Install dependencies (rebuilds native modules for current platform)
print_status "Installing dependencies..."
npm install

# Create uploads directory if it doesn't exist
mkdir -p uploads

# Set proper permissions
print_status "Setting permissions..."
chown -R $USER:$USER "$INSTALL_DIR"

# Test the application
print_status "Testing application startup..."
timeout 10s npm start &
APP_PID=$!
sleep 5

# Check if app started successfully
if ps -p $APP_PID > /dev/null; then
    print_success "Application test startup successful"
    kill $APP_PID
else
    print_error "Application failed to start during testing"
    exit 1
fi

# Create systemd service
print_status "Creating systemd service..."
cat > /etc/systemd/system/$SERVICE_NAME.service << EOF
[Unit]
Description=Poker Tracker Web Application
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

# Restart service if it crashes
StartLimitInterval=60s
StartLimitBurst=3

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and enable service
print_status "Configuring systemd service..."
systemctl daemon-reload
systemctl enable $SERVICE_NAME

# Start the service
print_status "Starting Poker Tracker service..."
systemctl start $SERVICE_NAME

# Wait a moment for service to start
sleep 3

# Check service status
if systemctl is-active --quiet $SERVICE_NAME; then
    print_success "Poker Tracker service is running!"
    print_success "Application should be available at http://$(hostname -I | awk '{print $1}'):$PORT"
else
    print_error "Service failed to start. Check logs with: journalctl -u $SERVICE_NAME"
    exit 1
fi

# Display service status
print_status "Service status:"
systemctl status $SERVICE_NAME --no-pager

print_success "Deployment completed successfully!"
print_status "Useful commands:"
echo "  - Check status: systemctl status $SERVICE_NAME"
echo "  - View logs: journalctl -u $SERVICE_NAME -f"
echo "  - Restart: systemctl restart $SERVICE_NAME"
echo "  - Stop: systemctl stop $SERVICE_NAME"