const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = 'T:\\My Drive\\FPL\\db\\users.db';
const db = new sqlite3.Database(DB_PATH);

console.log(`[Migration] Opening DB at ${DB_PATH}`);

db.serialize(() => {
    // Check if column exists first (optional, but good for debugging)
    db.all("PRAGMA table_info(users)", (err, rows) => {
        if (err) {
            console.error('[Migration] Failed to get table info:', err);
            return;
        }

        const hasEmail = rows.some(r => r.name === 'email');
        console.log('[Migration] Current columns:', rows.map(r => r.name));

        if (hasEmail) {
            console.log('[Migration] Email column already exists.');
        } else {
            console.log('[Migration] Email column missing. Attempting to add...');
            db.run("ALTER TABLE users ADD COLUMN email TEXT", (err) => {
                if (err) {
                    console.error('[Migration] Failed to add email column:', err.message);
                    db.close();
                } else {
                    console.log('[Migration] Successfully added email column. Creating index...');
                    db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)", (err) => {
                        if (err) console.error('[Migration] Failed to create unique index:', err.message);
                        else console.log('[Migration] Successfully created unique index on email.');
                        db.close();
                    });
                }
            });
        }
    });
});
