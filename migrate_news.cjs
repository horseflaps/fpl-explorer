const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.resolve(__dirname, 'users.db');
const db = new sqlite3.Database(DB_PATH);

console.log('[Migration] Adding articles table to users.db...');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS articles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        url TEXT UNIQUE,
        summary TEXT,
        source TEXT,
        published_at DATETIME
    )`, (err) => {
        if (err) {
            console.error('[Migration] Failed to create articles table:', err.message);
        } else {
            console.log('[Migration] Successfully checked/created articles table.');
        }
        db.close();
    });
});
