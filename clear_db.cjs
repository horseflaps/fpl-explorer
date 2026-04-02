const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = 'T:\\My Drive\\FPL\\db\\users.db';
const db = new sqlite3.Database(DB_PATH);

console.log(`[Cleaner] Opening DB at ${DB_PATH}`);

db.serialize(() => {
    db.run("DELETE FROM saved_teams", (err) => {
        if (err) console.error("Error clearing saved_teams:", err.message);
        else console.log("Cleared saved_teams.");
    });

    db.run("DELETE FROM users", (err) => {
        if (err) console.error("Error clearing users:", err.message);
        else console.log("Cleared users.");
    });

    // Reset Auto Increment?
    db.run("DELETE FROM sqlite_sequence WHERE name='users' OR name='saved_teams'", (err) => {
        if (!err) console.log("Reset auto-increment counters.");
    });
});

db.close(() => {
    console.log("[Cleaner] Closed DB connection.");
});
