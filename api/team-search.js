import sqlite3 from 'sqlite3';
import path from 'path';

export default async function handler(req, res) {
    const { q, page: pageParam } = req.query;
    const page = Math.max(1, parseInt(pageParam) || 1);
    const limit = 20;
    const offset = (page - 1) * limit;

    if (!q || q.length < 2) {
        return res.status(200).json([]);
    }

    const dbPath = 'T:\\My Drive\\FPL\\db\\fpl.db';
    const db = new sqlite3.Database(dbPath);

    return new Promise((resolve, reject) => {
        const query = `
            SELECT t.team_id, t.team_name, t.manager_name
            FROM teams_fts f
            JOIN teams t ON f.rowid = t.id
            WHERE teams_fts MATCH ?
            ORDER BY f.rank
            LIMIT ${limit} OFFSET ${offset}
        `;
        // FTS5 Prefix Search
        // "Man Cit" -> "Man* Cit*"
        const searchQuery = q.trim().split(/\s+/).map(term => term + '*').join(' ');

        db.all(query, [searchQuery], (err, rows) => {
            db.close();
            if (err) {
                console.error('Database error:', err);
                res.status(500).json({ error: 'Database query failed' });
                resolve();
            } else {
                res.status(200).json(rows);
                resolve();
            }
        });
    });
}
