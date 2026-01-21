const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'fpl.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // Get schema
    db.all("SELECT sql FROM sqlite_master WHERE type='table' AND name='teams'", (err, rows) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log("Schema for 'teams':");
        rows.forEach(row => console.log(row.sql));
    });

    // Get count
    db.get("SELECT COUNT(*) as count FROM teams", (err, row) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log(`Row count in 'teams': ${row.count}`);
    });

    // Check for FTS table
    db.all("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'teams_fts%'", (err, rows) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log("FTS Tables:");
        console.log(rows);
    });
});

db.close();
