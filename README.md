# Poker Tracker WebUI

A modern, minimal web application for tracking poker results with day/week/month/year views and club summaries.

## Features

- **Add Results**: Track poker results with club name, account name, and result amount
- **Edit Results**: Click-to-edit functionality for existing results and dates
- **Time Management**: Automatic timestamp with user correction capability
- **Multi-Period Views**: Day, week, month, and year filtering
- **Club Summaries**: Aggregated statistics by club including total, sessions, average, and best results
- **Modern UI**: Clean, responsive design optimized for both desktop and mobile
- **Real-time Updates**: Instant updates without page refreshes

## Technology Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Node.js with Express
- **Database**: SQLite
- **Containerization**: Docker

## Installation

### Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open your browser and navigate to `http://localhost:80`

### Production Deployment

1. Build the Docker image:
   ```bash
   docker build -t poker-tracker .
   ```

2. Run the container:
   ```bash
   docker run -p 80:80 -v $(pwd)/database:/app/database poker-tracker
   ```

### LXC Container Deployment

1. Build the Docker image
2. Import into LXC or build directly in LXC container
3. Ensure port 80 is accessible from the host network
4. The application will be available at your LXC container's IP address

## Usage

1. **Adding Results**: Fill in the form with club name, account name, and result. The date/time is automatically set but can be adjusted.

2. **Viewing Results**: Use the filter buttons (Day/Week/Month/Year) and date picker to view results for specific periods.

3. **Editing Results**: Click the "Edit" button on any result to modify it. You can change all fields including the date/time.

4. **Summary View**: The summary section shows aggregated statistics for each club in the selected time period.

## Database Schema

The application uses SQLite with the following schema:

```sql
CREATE TABLE results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    club_name TEXT NOT NULL,
    account_name TEXT NOT NULL,
    result REAL NOT NULL,
    date_time TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoints

- `GET /api/results` - Get results with optional period and date filtering
- `POST /api/results` - Add a new result
- `PUT /api/results/:id` - Update an existing result
- `DELETE /api/results/:id` - Delete a result
- `GET /api/summary` - Get summary statistics grouped by club

## Development

The application is built with vanilla JavaScript for maximum compatibility and minimal dependencies. The backend uses Express.js with SQLite for data persistence.

### File Structure

```
poker-tracker/
├── server.js              # Express server
├── package.json           # Dependencies
├── Dockerfile            # Container configuration
├── public/
│   ├── index.html        # Main application
│   ├── style.css         # Styling
│   └── script.js         # Frontend logic
└── database/
    └── poker.db          # SQLite database (created automatically)
```

## License

MIT License