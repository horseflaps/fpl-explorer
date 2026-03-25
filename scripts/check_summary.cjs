const db = require('../server/db.cjs');

db.all('SELECT source, COUNT(*) as count FROM articles GROUP BY source', [], (err, rows) => {
    if (err) throw err;
    const fs = require('fs');
    fs.writeFileSync('db_summary.txt', JSON.stringify(rows, null, 2));
    console.log('Summary written to db_summary.txt');
    process.exit(0);
});
