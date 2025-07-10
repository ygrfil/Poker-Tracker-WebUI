#!/bin/bash

# Simple keepalive script for Poker Tracker
# Keeps the app running and restarts it if it crashes

APP_DIR="/Poker-Tracker-WebUI"
LOG_FILE="$APP_DIR/keepalive.log"
PID_FILE="$APP_DIR/app.pid"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

start_app() {
    cd "$APP_DIR"
    log "Starting Poker Tracker..."
    
    # Kill any existing processes on port 80
    lsof -ti:80 | xargs kill -9 2>/dev/null || true
    
    # Start the app in background
    nohup npm start > app.log 2>&1 &
    APP_PID=$!
    echo $APP_PID > "$PID_FILE"
    
    sleep 3
    
    # Check if it started successfully
    if ps -p $APP_PID > /dev/null; then
        log "✓ App started successfully (PID: $APP_PID)"
        return 0
    else
        log "✗ App failed to start"
        return 1
    fi
}

stop_app() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p $PID > /dev/null; then
            log "Stopping app (PID: $PID)..."
            kill $PID
            sleep 2
            # Force kill if still running
            if ps -p $PID > /dev/null; then
                kill -9 $PID
            fi
        fi
        rm -f "$PID_FILE"
    fi
    
    # Also kill any process on port 80
    lsof -ti:80 | xargs kill -9 2>/dev/null || true
}

is_app_running() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p $PID > /dev/null; then
            # Check if port 80 is responding
            if curl -s http://localhost:80 > /dev/null 2>&1; then
                return 0
            fi
        fi
    fi
    return 1
}

# Handle script termination
cleanup() {
    log "Keepalive script stopping..."
    stop_app
    exit 0
}

trap cleanup SIGTERM SIGINT

# Main function
case "${1:-run}" in
    start)
        log "=== Poker Tracker Keepalive Starting ==="
        start_app
        ;;
    stop)
        log "=== Stopping Poker Tracker ==="
        stop_app
        ;;
    restart)
        log "=== Restarting Poker Tracker ==="
        stop_app
        sleep 2
        start_app
        ;;
    run)
        log "=== Poker Tracker Keepalive Starting ==="
        
        # Initial start
        start_app || {
            log "Failed to start app initially, exiting"
            exit 1
        }
        
        # Monitor loop
        while true; do
            if ! is_app_running; then
                log "⚠ App not responding, restarting..."
                stop_app
                sleep 2
                start_app || {
                    log "Failed to restart app, will try again in 30 seconds"
                    sleep 30
                }
            fi
            sleep 10  # Check every 10 seconds
        done
        ;;
    status)
        if is_app_running; then
            echo -e "${GREEN}✓ Poker Tracker is running${NC}"
            if [ -f "$PID_FILE" ]; then
                PID=$(cat "$PID_FILE")
                echo "PID: $PID"
            fi
        else
            echo -e "${RED}✗ Poker Tracker is not running${NC}"
            exit 1
        fi
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|run|status}"
        echo "  start   - Start the app once"
        echo "  stop    - Stop the app"
        echo "  restart - Restart the app"
        echo "  run     - Start and monitor (default)"
        echo "  status  - Check if app is running"
        exit 1
        ;;
esac