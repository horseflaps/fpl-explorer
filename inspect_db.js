const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('fpl.db');

db.serialize(() => {
    console.log('--- Tables ---');
    db.each("SELECT name FROM sqlite_master WHERE type='table'", (err, row) => {
        if (err) console.error(err);
        console.log(row.name);

        // For each table, get the schema
        const tableName = row.name;
        db.all(`PRAGMA table_info(${tableName})`, (err, columns) => {
            if (err) console.error(err);
            console.log(`\nTable: ${tableName}`);
            console.table(columns);

            // Get sample data
            db.all(`SELECT * FROM ${tableName} LIMIT 3`, (err, rows) => {
                if (err) console.error(err);
                console.log(`Sample data for ${tableName}:`);
                console.log(rows);
            });
        });
    });
});

setTimeout(() => db.close(), 2000);
