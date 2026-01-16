import sqlite3 from 'sqlite3';
import path from 'path';

export default async function handler(req, res) {
    const { q } = req.query;

    if (!q || q.length < 2) {
        return res.status(200).json([]);
    }

    const dbPath = path.join(process.cwd(), 'fpl.db');
    const db = new sqlite3.Database(dbPath);

    return new Promise((resolve, reject) => {
        const query = `
            SELECT team_id, team_name, manager_name, rank, total_points
            FROM teams
            WHERE team_name LIKE ? OR manager_name LIKE ?
            ORDER BY rank ASC
            LIMIT 20
        `;
        const searchTerm = `%${q}%`;

        db.all(query, [searchTerm, searchTerm], (err, rows) => {
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
