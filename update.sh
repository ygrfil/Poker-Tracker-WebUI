#!/bin/bash

# Simple update script for Poker Tracker
# Run this after git pull to update dependencies and restart service

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Updating Poker Tracker...${NC}"

# Stop service
echo -e "${YELLOW}Stopping service...${NC}"
systemctl stop poker-tracker 2>/dev/null || true

# Install/update dependencies
echo -e "${YELLOW}Updating dependencies...${NC}"
npm install

# Create uploads directory if needed
mkdir -p uploads

# Start service
echo -e "${YELLOW}Starting service...${NC}"
systemctl start poker-tracker

# Check status
if systemctl is-active --quiet poker-tracker; then
    echo -e "${GREEN}✓ Update completed successfully!${NC}"
    echo -e "Service is running on port 80"
else
    echo -e "${RED}✗ Service failed to start${NC}"
    echo "Check logs with: journalctl -u poker-tracker"
    exit 1
fi