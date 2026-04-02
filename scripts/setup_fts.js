import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = 'T:\\My Drive\\FPL\\db\\fpl.db';

const db = new sqlite3.Database(dbPath);

console.log('Setting up FTS5 for teams table...');

db.serialize(() => {
    // 1. Create the virtual table
    const createTableSql = `
        CREATE VIRTUAL TABLE IF NOT EXISTS teams_fts USING fts5(
            team_name, 
            manager_name, 
            content='teams', 
            content_rowid='id'
        );
    `;

    db.run(createTableSql, (err) => {
        if (err) {
            console.error('Error creating virtual table:', err);
            return;
        }
        console.log('Virtual table `teams_fts` created (or already exists).');

        // 2. Clear existing FTS data to avoid duplicates (optional, but safer)
        db.run(`DELETE FROM teams_fts;`, (err) => {
            if (err) {
                console.error('Error clearing FTS table:', err);
                return;
            }
            console.log('Cleared existing FTS data.');

            // 3. Populate from existing data
            console.log('Populating FTS table from `teams`... this may take a moment.');
            const populateSql = `
                INSERT INTO teams_fts(rowid, team_name, manager_name)
                SELECT id, team_name, manager_name FROM teams;
            `;

            db.run(populateSql, function (err) {
                if (err) {
                    console.error('Error populating FTS table:', err);
                } else {
                    console.log(`Successfully populated FTS table. Rows affected: ${this.changes}`);

                    // 4. Verify
                    db.get("SELECT COUNT(*) as count FROM teams_fts", (err, row) => {
                        console.log(`FTS Table Count: ${row.count}`);
                    });
                }
                db.close();
            });
        });
    });
});
