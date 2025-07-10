#!/bin/bash

# Simple setup script for Poker Tracker keepalive service

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}Setting up Poker Tracker Keepalive Service${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run with sudo${NC}"
    exit 1
fi

APP_DIR="/Poker-Tracker-WebUI"

# Check if app directory exists
if [ ! -d "$APP_DIR" ]; then
    echo -e "${RED}Directory $APP_DIR not found${NC}"
    echo "Please ensure the app is installed at $APP_DIR"
    exit 1
fi

# Copy service file to systemd
echo -e "${YELLOW}Installing systemd service...${NC}"
cp "$APP_DIR/poker-tracker.service" /etc/systemd/system/

# Reload systemd
echo -e "${YELLOW}Reloading systemd...${NC}"
systemctl daemon-reload

# Enable service to start on boot
echo -e "${YELLOW}Enabling service...${NC}"
systemctl enable poker-tracker

# Start the service
echo -e "${YELLOW}Starting service...${NC}"
systemctl start poker-tracker

# Wait a moment
sleep 3

# Check status
if systemctl is-active --quiet poker-tracker; then
    echo -e "${GREEN}✓ Poker Tracker service is running!${NC}"
    echo -e "Application should be available at http://$(hostname -I | awk '{print $1}'):80"
    echo ""
    echo "Useful commands:"
    echo "  systemctl status poker-tracker    # Check service status"
    echo "  systemctl restart poker-tracker   # Restart service"
    echo "  systemctl stop poker-tracker      # Stop service"
    echo "  journalctl -u poker-tracker -f    # View live logs"
    echo "  ./keepalive.sh status             # Check app status"
else
    echo -e "${RED}✗ Service failed to start${NC}"
    echo "Check logs with: journalctl -u poker-tracker"
    exit 1
fi