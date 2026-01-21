const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'fpl.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // Get indexes
    db.all("SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='teams'", (err, rows) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log("Indexes for 'teams':");
        if (rows.length === 0) {
            console.log("No indexes found.");
        } else {
            rows.forEach(row => console.log(`Name: ${row.name}, SQL: ${row.sql}`));
        }
    });
});

db.close();
