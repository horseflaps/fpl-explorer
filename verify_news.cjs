const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = 'T:\\My Drive\\FPL\\db\\users.db';
const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
    console.log('--- Latest News Articles ---');
    db.all("SELECT id, title, source, published_at FROM articles ORDER BY published_at DESC LIMIT 10", [], (err, rows) => {
        if (err) {
            console.error('Error querying articles:', err.message);
            return;
        }
        
        if (rows.length === 0) {
            console.log('No articles found in the database.');
        } else {
            rows.forEach(row => {
                console.log(`[${row.id}] ${row.source} (${row.published_at}): ${row.title}`);
            });
        }
        db.close();
    });
});
