# Fix for Ubuntu SQLite3 Error

## Problem
The SQLite3 module was compiled for macOS and won't work on Ubuntu due to different architectures.

## Solution
Run these commands on your Ubuntu server:

```bash
# Remove node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Install build tools (if not already installed)
apt-get update
apt-get install -y build-essential python3

# Reinstall dependencies (this will rebuild native modules for Linux)
npm install

# Start the application
npm start
```

## Alternative: Use Docker (Recommended)
If you continue having issues, use Docker for consistent cross-platform deployment:

```bash
# Build the Docker image
docker build -t poker-tracker .

# Run the container
docker run -p 80:80 -v $(pwd)/database:/app/database poker-tracker
```

## Why This Happens
- SQLite3 contains native C++ code that must be compiled for each platform
- macOS and Linux use different architectures (x86_64 vs ARM64, different libraries)
- npm install rebuilds these native modules for the current platform