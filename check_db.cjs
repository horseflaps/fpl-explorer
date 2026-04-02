const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('T:\\My Drive\\FPL\\db\\fpl.db');

db.serialize(() => {
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log('Tables:', tables);

        // Check columns for a likely table
        if (tables.length > 0) {
            tables.forEach(table => {
                db.all(`PRAGMA table_info(${table.name})`, (err, cols) => {
                    console.log(`Columns for ${table.name}:`, cols.map(c => c.name));
                });
            });
        }
    });
});

setTimeout(() => db.close(), 1000);
