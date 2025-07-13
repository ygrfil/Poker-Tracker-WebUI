# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Poker Tracker WebUI is a simple, self-contained web application for tracking poker results. It's designed specifically for Ubuntu servers and features a minimalist dark-mode interface. The application tracks poker sessions with club names, account names, results, and timestamps, providing period-based filtering and summaries.

## Architecture

### Backend (server.js)
- **Express.js server** running on port 80
- **SQLite database** (`./database/poker.db`) with single `results` table
- **RESTful API** with CRUD operations for poker results
- **File upload support** via multer for database backup/restore
- **User settings-aware period filtering** - respects custom day start times and week start days

### Frontend (public/)
- **Vanilla JavaScript** SPA with single `PokerTracker` class
- **CSS Grid/Flexbox layout** with two-panel design (280px form + flexible results)
- **Period filtering** with four time periods: day, week, month, year
- **LocalStorage persistence** for user settings and autocomplete data

### Database Schema
```sql
CREATE TABLE results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    club_name TEXT NOT NULL,
    account_name TEXT NOT NULL,
    result REAL NOT NULL,
    date_time TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE club_commissions (
    club_name TEXT PRIMARY KEY,
    commission_percentage REAL DEFAULT 0
);
```

## Key API Endpoints

### Core CRUD Operations
- `GET /api/results?period={period}&date={date}&dayStartTime={hours}&weekStartDay={day}` - Filtered results
- `POST /api/results` - Add new result
- `PUT /api/results/:id` - Update existing result  
- `DELETE /api/results/:id` - Delete result
- `GET /api/summary?period={period}&date={date}&dayStartTime={hours}&weekStartDay={day}` - Club summaries

### Commission Management
- `GET /api/commissions` - Get all commission rates
- `GET /api/commissions/:clubName` - Get commission rate for specific club
- `POST /api/commissions` - Set commission rate (body: {club_name, commission_percentage})

### Backup/Restore
- `GET /api/backup` - Download JSON backup with automatic filename
- `POST /api/restore` - Upload JSON backup file (multipart/form-data)

## Period Filtering Logic

The application implements sophisticated period filtering that respects user preferences:

- **dayStartTime**: Hour (0-23) when a "day" begins (for late-night poker sessions)
- **weekStartDay**: Day of week (0=Sunday, 1=Monday) when week begins
- **Period calculations**: All periods (day/week/month/year) use these settings for boundary calculations

Critical: Both `/api/results` and `/api/summary` must receive identical parameters to maintain UI consistency.

## Commission System

The application supports club-specific commission rates that affect displayed totals while preserving original result data:

- **Commission application**: Applied to both winnings and losses using `adjusted_amount = original_amount * (1 - commission_rate/100)`
- **Data preservation**: Original results in database remain unchanged; commission is applied only for display calculations
- **UI integration**: Club summary cards are clickable to set commission rates via modal
- **Summary calculations**: `/api/summary` returns both `total_result` (original) and `adjusted_total` (after commission)
- **Frontend display**: Club cards show commission percentage in title (e.g., "Club Name (5%)") and use adjusted totals

## Frontend State Management

### PokerTracker Class
- **Settings persistence**: `loadSettings()` from localStorage with defaults
- **Period state**: `currentPeriod` ('day'|'week'|'month'|'year') and `currentDate`
- **Autocomplete enhancement**: Period-specific entries sorted by recency + localStorage fallback
- **Form persistence**: Club/account values remain after successful submission

### User Settings Structure
```javascript
{
    dayStartTime: 0,        // 0-23 hours
    weekStartDay: 1,        // 0-6 (Sunday=0)
    dateFormat: 'default',  // 'default'|'iso'|'european'
    currencySymbol: '$'
}
```

## Development Commands

```bash
# Development with auto-reload
npm run dev

# Production start
npm start

# Install dependencies (rebuilds native SQLite module on Ubuntu)
npm install
```

## Production Deployment (Ubuntu)

### Auto-restart Setup
```bash
# One-time setup for systemd service with auto-restart
sudo ./setup-keepalive.sh

# Manual control
./keepalive.sh status|start|stop|restart|run
sudo systemctl status|restart|stop poker-tracker
```

### After Code Updates
```bash
git pull
npm install  # Rebuilds native modules if needed
sudo systemctl restart poker-tracker
```

## Critical Implementation Notes

### Period Filtering Consistency
When modifying period filtering logic, ensure both `/api/results` and `/api/summary` endpoints use identical date calculation logic. The frontend sends `dayStartTime` and `weekStartDay` parameters that must be respected.

### SQLite Native Module Handling
The app uses SQLite3 with native C++ bindings. After `git pull` on Ubuntu, always run `npm install` to rebuild native modules for the current platform before restarting.

### Form State Persistence
The form preserves club and account values after successful submission while resetting only the result amount and updating the datetime. This supports rapid entry of multiple results from the same session.

### Database Backup/Restore
Backup creates timestamped JSON files. Restore completely replaces all data (DELETE + INSERT). The uploads directory is automatically cleaned after restore operations.

### Commission System Integration
When modifying the commission system, maintain these principles:
- Commission calculations must preserve original data integrity 
- The `/api/summary` endpoint joins with `club_commissions` table and calculates adjusted totals in JavaScript
- Frontend commission modal (`openCommissionModal()`) provides real-time preview of commission impact
- Commission rates are validated (0-100%) and stored per club

## File Structure Significance

- `server.js` - Single-file Express server with all API endpoints
- `public/script.js` - Monolithic frontend class (no build process)
- `public/style.css` - CSS custom properties for dark theme
- `keepalive.sh` - Production monitoring script with health checks
- `database/poker.db` - SQLite database (auto-created on first run)