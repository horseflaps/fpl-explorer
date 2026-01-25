const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.resolve(__dirname, 'users.db');
const db = new sqlite3.Database(DB_PATH);

console.log(`[Migration] Opening DB at ${DB_PATH}`);

db.serialize(() => {
    // 1. Rename column username -> displayname
    console.log('[Migration] Renaming username to displayname...');
    db.run("ALTER TABLE users RENAME COLUMN username TO displayname", (err) => {
        if (err) {
            console.error('[Migration] Failed to rename column (it might not exist or already be renamed):', err.message);
        } else {
            console.log('[Migration] Successfully renamed username to displayname.');
        }

        // 2. Check structure
        db.all("PRAGMA table_info(users)", (err, rows) => {
            if (err) {
                console.error('[Migration] Failed to get table info:', err);
            } else {
                console.log('[Migration] Current columns:', rows.map(r => r.name));
            }
            db.close();
        });
    });
});
