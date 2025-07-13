const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = 80;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

const db = new sqlite3.Database('./database/poker.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database.');
        initializeDatabase();
    }
});

function initializeDatabase() {
    db.run(`CREATE TABLE IF NOT EXISTS results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        club_name TEXT NOT NULL,
        account_name TEXT NOT NULL,
        result REAL NOT NULL,
        date_time TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    // Create commission table
    db.run(`CREATE TABLE IF NOT EXISTS club_commissions (
        club_name TEXT PRIMARY KEY,
        commission_percentage REAL DEFAULT 0
    )`, (err) => {
        if (err) {
            console.error('Error creating commissions table:', err.message);
        } else {
            console.log('Commission table created/verified.');
        }
    });
    
    // Add performance indexes
    db.run(`CREATE INDEX IF NOT EXISTS idx_results_datetime 
            ON results(date_time DESC)`, (err) => {
        if (err) {
            console.error('Error creating date_time index:', err.message);
        } else {
            console.log('Database index on date_time created/verified.');
        }
    });

    // Add compound index for club-specific queries
    db.run(`CREATE INDEX IF NOT EXISTS idx_results_club_datetime 
            ON results(club_name, date_time DESC)`, (err) => {
        if (err) {
            console.error('Error creating club_datetime index:', err.message);
        } else {
            console.log('Database compound index on club_name+date_time created/verified.');
        }
    });
}

app.post('/api/results', (req, res) => {
    const { club_name, account_name, result, date_time } = req.body;
    
    if (!club_name || !account_name || result === undefined || !date_time) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    
    const query = `INSERT INTO results (club_name, account_name, result, date_time) VALUES (?, ?, ?, ?)`;
    db.run(query, [club_name, account_name, result, date_time], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ id: this.lastID, message: 'Result added successfully' });
    });
});

app.get('/api/results', (req, res) => {
    const { period, date, dayStartTime, weekStartDay } = req.query;
    let query = `SELECT * FROM results`;
    let params = [];
    
    if (period && date) {
        const startDate = new Date(date);
        let endDate = new Date(date);
        
        // Parse user settings with defaults
        const dayStart = parseInt(dayStartTime) || 0;
        const weekStart = parseInt(weekStartDay) || 1;
        
        switch (period) {
            case 'day':
                // Start at user's day start time
                startDate.setHours(dayStart, 0, 0, 0);
                endDate.setDate(startDate.getDate() + 1);
                endDate.setHours(dayStart, 0, 0, 0);
                break;
            case 'week':
                // Calculate week start based on user setting
                const dayOfWeek = startDate.getDay();
                const daysFromWeekStart = (dayOfWeek - weekStart + 7) % 7;
                startDate.setDate(startDate.getDate() - daysFromWeekStart);
                startDate.setHours(dayStart, 0, 0, 0);
                endDate.setDate(startDate.getDate() + 7);
                endDate.setHours(dayStart, 0, 0, 0);
                break;
            case 'month':
                // Start of month at user's day start time
                startDate.setDate(1);
                startDate.setHours(dayStart, 0, 0, 0);
                endDate.setMonth(startDate.getMonth() + 1);
                endDate.setDate(1);
                endDate.setHours(dayStart, 0, 0, 0);
                break;
            case 'year':
                // Start of year at user's day start time
                startDate.setMonth(0, 1);
                startDate.setHours(dayStart, 0, 0, 0);
                endDate.setFullYear(startDate.getFullYear() + 1);
                endDate.setMonth(0, 1);
                endDate.setHours(dayStart, 0, 0, 0);
                break;
        }
        
        query += ` WHERE date_time >= ? AND date_time < ?`;
        params = [startDate.toISOString(), endDate.toISOString()];
    }
    
    query += ` ORDER BY date_time DESC`;
    
    db.all(query, params, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

app.put('/api/results/:id', (req, res) => {
    const { id } = req.params;
    const { club_name, account_name, result, date_time } = req.body;
    
    if (!club_name || !account_name || result === undefined || !date_time) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    
    const query = `UPDATE results SET club_name = ?, account_name = ?, result = ?, date_time = ? WHERE id = ?`;
    db.run(query, [club_name, account_name, result, date_time, id], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Result not found' });
        }
        res.json({ message: 'Result updated successfully' });
    });
});

app.delete('/api/results/:id', (req, res) => {
    const { id } = req.params;
    
    const query = `DELETE FROM results WHERE id = ?`;
    db.run(query, [id], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Result not found' });
        }
        res.json({ message: 'Result deleted successfully' });
    });
});

app.get('/api/summary', (req, res) => {
    const { period, date, dayStartTime, weekStartDay } = req.query;
    
    // Optimized query with SQL aggregation
    let query = `SELECT 
                    r.club_name,
                    COALESCE(c.commission_percentage, 0) as commission_percentage,
                    SUM(r.result) as total_result,
                    SUM(r.result * (1 - COALESCE(c.commission_percentage, 0) / 100.0)) as adjusted_total
                 FROM results r
                 LEFT JOIN club_commissions c ON r.club_name = c.club_name`;
    let params = [];
    
    if (period && date) {
        const startDate = new Date(date);
        let endDate = new Date(date);
        
        // Parse user settings with defaults
        const dayStart = parseInt(dayStartTime) || 0;
        const weekStart = parseInt(weekStartDay) || 1;
        
        switch (period) {
            case 'day':
                // Start at user's day start time
                startDate.setHours(dayStart, 0, 0, 0);
                endDate.setDate(startDate.getDate() + 1);
                endDate.setHours(dayStart, 0, 0, 0);
                break;
            case 'week':
                // Calculate week start based on user setting
                const dayOfWeek = startDate.getDay();
                const daysFromWeekStart = (dayOfWeek - weekStart + 7) % 7;
                startDate.setDate(startDate.getDate() - daysFromWeekStart);
                startDate.setHours(dayStart, 0, 0, 0);
                endDate.setDate(startDate.getDate() + 7);
                endDate.setHours(dayStart, 0, 0, 0);
                break;
            case 'month':
                // Start of month at user's day start time
                startDate.setDate(1);
                startDate.setHours(dayStart, 0, 0, 0);
                endDate.setMonth(startDate.getMonth() + 1);
                endDate.setDate(1);
                endDate.setHours(dayStart, 0, 0, 0);
                break;
            case 'year':
                // Start of year at user's day start time
                startDate.setMonth(0, 1);
                startDate.setHours(dayStart, 0, 0, 0);
                endDate.setFullYear(startDate.getFullYear() + 1);
                endDate.setMonth(0, 1);
                endDate.setHours(dayStart, 0, 0, 0);
                break;
        }
        
        query += ` WHERE r.date_time >= ? AND r.date_time < ?`;
        params = [startDate.toISOString(), endDate.toISOString()];
    }
    
    query += ` GROUP BY r.club_name, c.commission_percentage
               ORDER BY adjusted_total DESC`;
    
    db.all(query, params, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        // Data is already aggregated by SQL - just return it
        res.json(rows);
    });
});

// Commission management endpoints
app.get('/api/commissions', (req, res) => {
    const query = `SELECT * FROM club_commissions ORDER BY club_name`;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

app.get('/api/commissions/:clubName', (req, res) => {
    const { clubName } = req.params;
    const query = `SELECT * FROM club_commissions WHERE club_name = ?`;
    
    db.get(query, [clubName], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(row || { club_name: clubName, commission_percentage: 0 });
    });
});

app.post('/api/commissions', (req, res) => {
    const { club_name, commission_percentage } = req.body;
    
    if (!club_name || commission_percentage === undefined) {
        return res.status(400).json({ error: 'Club name and commission percentage are required' });
    }
    
    if (commission_percentage < 0 || commission_percentage > 100) {
        return res.status(400).json({ error: 'Commission percentage must be between 0 and 100' });
    }
    
    const query = `INSERT OR REPLACE INTO club_commissions (club_name, commission_percentage) VALUES (?, ?)`;
    db.run(query, [club_name, commission_percentage], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Commission updated successfully' });
    });
});

// Database backup endpoint
app.get('/api/backup', (req, res) => {
    const query = `SELECT * FROM results ORDER BY date_time DESC`;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to backup database: ' + err.message });
        }
        
        const backup = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            data: rows
        };
        
        const filename = `poker-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.json(backup);
    });
});

// Database restore endpoint
app.post('/api/restore', upload.single('backup'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No backup file provided' });
    }
    
    try {
        const fileContent = fs.readFileSync(req.file.path, 'utf8');
        const backup = JSON.parse(fileContent);
        
        // Validate backup format
        if (!backup.data || !Array.isArray(backup.data)) {
            return res.status(400).json({ error: 'Invalid backup file format' });
        }
        
        // Clear existing data and restore
        db.serialize(() => {
            db.run('DELETE FROM results', (err) => {
                if (err) {
                    return res.status(500).json({ error: 'Failed to clear existing data: ' + err.message });
                }
                
                // Insert restored data
                const insertQuery = `INSERT INTO results (club_name, account_name, result, date_time) VALUES (?, ?, ?, ?)`;
                const stmt = db.prepare(insertQuery);
                
                let insertedCount = 0;
                backup.data.forEach((row) => {
                    stmt.run([row.club_name, row.account_name, row.result, row.date_time], (err) => {
                        if (err) {
                            console.error('Error inserting row:', err);
                        } else {
                            insertedCount++;
                        }
                    });
                });
                
                stmt.finalize((err) => {
                    // Clean up uploaded file
                    fs.unlinkSync(req.file.path);
                    
                    if (err) {
                        return res.status(500).json({ error: 'Failed to restore data: ' + err.message });
                    }
                    
                    res.json({ 
                        message: 'Database restored successfully', 
                        restored_records: backup.data.length 
                    });
                });
            });
        });
        
    } catch (error) {
        // Clean up uploaded file on error
        fs.unlinkSync(req.file.path);
        res.status(400).json({ error: 'Failed to parse backup file: ' + error.message });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Database connection closed.');
        process.exit(0);
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Poker Tracker WebUI server running on port ${PORT}`);
});