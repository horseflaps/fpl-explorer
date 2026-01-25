const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./server/db.cjs');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-prod';

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the React app build directory (only in production)
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
}

// --- API Routes ---

// 1. Auth Routes
// 1. Auth Routes
app.post('/api/auth/signup', (req, res) => {
    let { email, password, display_name } = req.body;

    if (display_name) display_name = display_name.trim();
    if (email) email = email.trim();

    if (!email || !password || !display_name) {
        return res.status(400).json({ error: 'Email, password, and display name required' });
    }

    const hash = bcrypt.hashSync(password, 10);

    // Using 'displayname' column
    db.run('INSERT INTO users (displayname, email, password_hash) VALUES (?, ?, ?)', [display_name, email, hash], function (err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                if (err.message.includes('users.email')) return res.status(409).json({ error: 'Email already registered' });
                return res.status(409).json({ error: 'Error creating user' });
            }
            return res.status(500).json({ error: err.message });
        }

        const token = jwt.sign({ id: this.lastID, displayname: display_name, email }, JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({ token, user: { id: this.lastID, displayname: display_name, email } });
    });
});

app.post('/api/auth/login', (req, res) => {
    let { email, password } = req.body;
    if (email) email = email.trim();

    db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        if (!bcrypt.compareSync(password, user.password_hash)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user.id, displayname: user.displayname, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user.id, displayname: user.displayname, email: user.email } });
    });
});

app.get('/api/auth/me', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });

    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Invalid token' });
        res.json({ user: decoded }); // Echo back user info from token
    });
});

// 2. FPL Proxy Routes & Custom Logic (Migrated from Vite middleware)

// Team Search (Local FPL DB)
// We need to open the FPL db separately here
const FPL_DB_PATH = path.resolve(__dirname, 'fpl.db');

// --- Saved Teams Routes ---

// Get Saved Teams for User
app.get('/api/user/teams', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });

    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Invalid token' });

        db.all('SELECT * FROM saved_teams WHERE user_id = ? ORDER BY created_at DESC', [decoded.id], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    });
});

// Save a Team
app.post('/api/user/teams', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });

    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Invalid token' });

        const { name, team_data, entry_id } = req.body;

        if (!name || !entry_id) {
            return res.status(400).json({ error: 'Team name and entry ID required' });
        }

        // We can store entry_id in team_data JSON if we want, or add a column. 
        // For now, let's store it in team_data or name?
        // Actually, schema has `team_data` (TEXT). We can store { entry_id: 123, ... }

        const dataStr = JSON.stringify({ entry_id, ...team_data });

        db.run('INSERT INTO saved_teams (user_id, name, team_data) VALUES (?, ?, ?)', [decoded.id, name, dataStr], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ id: this.lastID, name });
        });
    });
});

// Delete a Saved Team
app.delete('/api/user/teams/:id', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });

    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Invalid token' });

        const teamId = req.params.id;
        db.run('DELETE FROM saved_teams WHERE id = ? AND user_id = ?', [teamId, decoded.id], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: 'Team not found or unauthorized' });
            res.json({ message: 'Team deleted' });
        });
    });
});

app.get('/api/team-search', (req, res) => {
    const q = req.query.q;
    console.log(`[API] Searching for: ${q}`);

    if (!q || q.length < 2) {
        return res.json([]);
    }

    const fplDb = new sqlite3.Database(FPL_DB_PATH);

    const queryCode = `
      SELECT t.team_id, t.team_name, t.manager_name
      FROM teams_fts f
      JOIN teams t ON f.rowid = t.id
      WHERE teams_fts MATCH ?
      ORDER BY rank
      LIMIT 20
    `;

    // FTS5 Prefix Search
    const searchQuery = q.trim().split(/\s+/).map(term => term + '*').join(' ');

    fplDb.all(queryCode, [searchQuery], (err, rows) => {
        fplDb.close();
        if (err) {
            console.error('[API] DB Error:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// FPL API Proxy
app.use('/api', async (req, res) => {
    // This catches everything else under /api that wasn't handled above
    // e.g. /api/bootstrap-static/

    // We strip /api from the start to get the real FPL path
    const fplPath = req.originalUrl.replace(/^\/api/, '');
    // BUT wait, req.url in express mount is relative to mount, but here we are using a wildcard match,
    // so let's stick to cleaning req.url or originalUrl. 
    // The previous proxy logic used `req.query.path` which was specific to Vercel functions [ ...path].js
    // Here we want standard proxy behavior: localhost:3001/api/foo -> fantasy.premierleague.com/api/foo

    // Actually, FPL API is https://fantasy.premierleague.com/api/
    // So if we request /api/bootstrap-static, we want https://fantasy.premierleague.com/api/bootstrap-static/

    const targetUrl = `https://fantasy.premierleague.com/api${fplPath}`;

    // Ensure trailing slash if it's a directory-like endpoint (FPL is picky)
    // Most FPL endpoints need a trailing slash? Let's check previous proxy code.
    // Previous proxy: `const targetUrl = https://fantasy.premierleague.com/api/${cleanPath}/;` (enforced trailing slash)

    let finalUrl = targetUrl;
    if (!finalUrl.endsWith('/') && !finalUrl.includes('?')) {
        finalUrl += '/';
    }

    console.log(`[Proxy] Forwarding to: ${finalUrl}`);

    try {
        const response = await fetch(finalUrl, {
            method: req.method,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            return res.status(response.status).json({
                error: `FPL API Error: ${response.status}`,
                details: response.statusText
            });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Proxy Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Fallback: Serve React App (Production)
if (process.env.NODE_ENV === 'production') {
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
}

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
