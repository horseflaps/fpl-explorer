const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./server/db.cjs');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-prod';

// Per-user FPL token validation cache { [userId]: { valid: bool, at: timestamp } }
const fplValidationCache = {};

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

app.post('/api/auth/logout', (req, res) => {
    const decoded = requireAuth(req, res);
    if (!decoded) return;
    // Clear FPL connection on logout so next session starts fresh
    delete fplValidationCache[decoded.id];
    db.run('UPDATE users SET fpl_session = NULL, fpl_refresh_token = NULL, fpl_expires_at = NULL, fpl_entry_id = NULL WHERE id = ?', [decoded.id], () => {
        res.json({ ok: true });
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

// --- Past Analyses Routes ---

app.get('/api/user/analyses', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });
    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Invalid token' });
        db.all('SELECT id, team_name, entry_id, gameweek, analysis_text, created_at FROM analyses WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', [decoded.id], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    });
});

app.post('/api/user/analyses', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });
    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Invalid token' });
        const { team_name, entry_id, gameweek, analysis_text } = req.body;
        if (!analysis_text) return res.status(400).json({ error: 'analysis_text required' });
        db.run('INSERT INTO analyses (user_id, team_name, entry_id, gameweek, analysis_text) VALUES (?, ?, ?, ?, ?)',
            [decoded.id, team_name || 'Unknown', entry_id || null, gameweek || null, analysis_text],
            function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.status(201).json({ id: this.lastID });
            });
    });
});

app.delete('/api/user/analyses/:id', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });
    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Invalid token' });
        db.run('DELETE FROM analyses WHERE id = ? AND user_id = ?', [req.params.id, decoded.id], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: 'Not found or unauthorized' });
            res.json({ message: 'Deleted' });
        });
    });
});

// Get News Articles (for AI Context)
app.get('/api/news', (req, res) => {
    // Return top 20 most recent articles
    db.all("SELECT source, title, summary FROM articles ORDER BY published_at DESC LIMIT 20", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// --- FPL Account Connection ---

function fplHttpRequest(hostname, path, method, headers, body) {
    return new Promise((resolve, reject) => {
        const opts = {
            hostname,
            path,
            method,
            headers: body ? { ...headers, 'Content-Length': Buffer.byteLength(body) } : headers,
        };
        const req = https.request(opts, (res) => {
            const cookies = res.headers['set-cookie'] || [];
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, cookies, body: data }));
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

function requireAuth(req, res) {
    const authHeader = req.headers.authorization;
    if (!authHeader) { res.status(401).json({ error: 'No token provided' }); return null; }
    try {
        return jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    } catch {
        res.status(401).json({ error: 'Invalid token' });
        return null;
    }
}

// Save FPL entry ID to user profile
app.post('/api/fpl/connect', (req, res) => {
    const decoded = requireAuth(req, res);
    if (!decoded) return;

    const { entry_id } = req.body;
    if (!entry_id) return res.status(400).json({ error: 'entry_id required' });

    db.run('UPDATE users SET fpl_entry_id = ? WHERE id = ?', [Number(entry_id), decoded.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ entry_id: Number(entry_id) });
    });
});

app.get('/api/fpl/status', (req, res) => {
    const decoded = requireAuth(req, res);
    if (!decoded) return;
    db.get('SELECT fpl_entry_id, fpl_session, fpl_expires_at, fpl_refresh_token FROM users WHERE id = ?', [decoded.id], async (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row?.fpl_session) return res.json({ fpl_entry_id: null, fpl_connected: false });

        // Check cache (5 min TTL) — skip cache if entry ID is missing
        const cached = fplValidationCache[decoded.id];
        if (cached && (Date.now() - cached.at) < 5 * 60 * 1000 && row.fpl_entry_id) {
            if (!cached.valid) {
                db.run('UPDATE users SET fpl_session = NULL, fpl_refresh_token = NULL, fpl_expires_at = NULL, fpl_entry_id = NULL WHERE id = ?', [decoded.id]);
                return res.json({ fpl_entry_id: null, fpl_connected: false });
            }
            return res.json({ fpl_entry_id: row.fpl_entry_id || null, fpl_connected: true });
        }

        // Validate token against FPL API
        try {
            const fplToken = await getValidFplToken(decoded.id, row);
            const testRes = await fetch('https://fantasy.premierleague.com/api/me/', {
                headers: {
                    'Authorization': `Bearer ${fplToken}`,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                }
            });

            if (testRes.status === 401 || testRes.status === 403) {
                fplValidationCache[decoded.id] = { valid: false, at: Date.now() };
                db.run('UPDATE users SET fpl_session = NULL, fpl_refresh_token = NULL, fpl_expires_at = NULL, fpl_entry_id = NULL WHERE id = ?', [decoded.id]);
                return res.json({ fpl_entry_id: null, fpl_connected: false });
            }

            let entryId = row.fpl_entry_id;

            // If entry ID missing, fetch it from FPL and store it
            if (!entryId) {
                try {
                    const meRes = await fetch('https://fantasy.premierleague.com/api/me/', {
                        headers: {
                            'Authorization': `Bearer ${fplToken}`,
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        }
                    });
                    if (meRes.ok) {
                        const meData = await meRes.json();
                        entryId = meData.player?.entry || null;
                        if (entryId) {
                            db.run('UPDATE users SET fpl_entry_id = ? WHERE id = ?', [entryId, decoded.id]);
                        }
                    }
                } catch {}
            }

            fplValidationCache[decoded.id] = { valid: true, at: Date.now() };
            res.json({ fpl_entry_id: entryId || null, fpl_connected: true });
        } catch {
            // Network error — assume still connected, don't clear
            fplValidationCache[decoded.id] = { valid: true, at: Date.now() };
            res.json({ fpl_entry_id: row.fpl_entry_id || null, fpl_connected: true });
        }
    });
});

app.post('/api/fpl/disconnect', (req, res) => {
    const decoded = requireAuth(req, res);
    if (!decoded) return;
    delete fplValidationCache[decoded.id];
    db.run('UPDATE users SET fpl_session = NULL, fpl_entry_id = NULL WHERE id = ?', [decoded.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'FPL account disconnected' });
    });
});

// Refresh FPL access token using stored refresh token
const OIDC_TOKEN_URL = 'https://account.premierleague.com/as/token.oauth2';
const FPL_CLIENT_ID = 'bfcbaf69-aade-4c1b-8f00-c1cb8a193030';

async function refreshFplToken(userId, refreshToken) {
    const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: FPL_CLIENT_ID,
    });

    const resp = await fetch(OIDC_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });

    if (!resp.ok) throw new Error(`Token refresh failed: ${resp.status}`);

    const data = await resp.json();
    const expiresAt = Math.floor(Date.now() / 1000) + (data.expires_in || 3600);

    await new Promise((resolve, reject) => {
        db.run(
            'UPDATE users SET fpl_session = ?, fpl_refresh_token = ?, fpl_expires_at = ? WHERE id = ?',
            [data.access_token, data.refresh_token || refreshToken, expiresAt, userId],
            (err) => err ? reject(err) : resolve()
        );
    });

    console.log(`[FPL] Token refreshed for user ${userId}, expires at ${new Date(expiresAt * 1000).toISOString()}`);
    return data.access_token;
}

// Get a valid FPL token, refreshing if expired
async function getValidFplToken(userId, row) {
    const nowSecs = Math.floor(Date.now() / 1000);
    const isExpired = row.fpl_expires_at && (row.fpl_expires_at - 60) < nowSecs; // refresh 60s early

    if (isExpired && row.fpl_refresh_token) {
        console.log(`[FPL] Access token expired for user ${userId}, refreshing...`);
        return await refreshFplToken(userId, row.fpl_refresh_token);
    }

    return row.fpl_session;
}

// Fetch live authenticated team picks (reflects pending transfers/captain changes)
app.get('/api/fpl/my-picks', async (req, res) => {
    const decoded = requireAuth(req, res);
    if (!decoded) return;

    db.get('SELECT fpl_session, fpl_refresh_token, fpl_expires_at, fpl_entry_id FROM users WHERE id = ?', [decoded.id], async (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row?.fpl_session) return res.status(401).json({ error: 'No FPL token stored' });
        if (!row?.fpl_entry_id) return res.status(400).json({ error: 'No FPL entry ID stored' });

        let fplToken;
        try {
            fplToken = await getValidFplToken(decoded.id, row);
        } catch (e) {
            return res.status(401).json({ error: 'FPL token expired and refresh failed. Reconnect via browser extension.' });
        }

        const headers = {
            'Authorization': `Bearer ${fplToken}`,
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json',
            'Origin': 'https://fantasy.premierleague.com',
            'Referer': 'https://fantasy.premierleague.com/',
        };

        try {
            const response = await fetch(`https://fantasy.premierleague.com/api/my-team/${row.fpl_entry_id}/`, { headers });

            if (response.status === 401) {
                // Token expired — clear it
                db.run('UPDATE users SET fpl_session = NULL WHERE id = ?', [decoded.id]);
                return res.status(401).json({ error: 'FPL token expired. Reconnect via browser extension.' });
            }

            if (!response.ok) {
                const txt = await response.text();
                return res.status(response.status).json({ error: txt });
            }

            const data = await response.json();

            // my-team returns { picks, chips, transfers } — convert to same shape as
            // /entry/{id}/event/{gw}/picks/ so the app can use it directly
            res.json({
                active_chip: data.active_chip || null,
                automatic_subs: [],
                entry_history: null,
                picks: data.picks.map(p => ({
                    element: p.element,
                    position: p.position,
                    multiplier: p.is_captain ? 2 : p.is_vice_captain ? 1 : p.position > 11 ? 0 : 1,
                    is_captain: p.is_captain,
                    is_vice_captain: p.is_vice_captain,
                })),
                _live: true,
                _transfers: data.transfers || null, // { limit, made, cost, bank, value }
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
});

// Receive FPL token from browser extension
app.post('/api/fpl/token', async (req, res) => {
    const decoded = requireAuth(req, res);
    if (!decoded) return;

    const { fpl_token, fpl_refresh_token, fpl_expires_at, entry_id } = req.body;
    if (!fpl_token) return res.status(400).json({ error: 'fpl_token required' });

    let resolvedEntryId = entry_id ? Number(entry_id) : null;

    // If no entry ID provided, fetch it from FPL /api/me/
    if (!resolvedEntryId) {
        try {
            const meRes = await fetch('https://fantasy.premierleague.com/api/me/', {
                headers: {
                    'Authorization': `Bearer ${fpl_token}`,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                }
            });
            if (meRes.ok) {
                const meData = await meRes.json();
                resolvedEntryId = meData.player?.entry || null;
            }
        } catch {}
    }

    const updates = ['fpl_session = ?', 'fpl_refresh_token = ?', 'fpl_expires_at = ?', 'fpl_entry_id = ?'];
    const params = [fpl_token, fpl_refresh_token || null, fpl_expires_at || null, resolvedEntryId];
    params.push(decoded.id);

    db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        delete fplValidationCache[decoded.id];
        res.json({ ok: true, entry_id: resolvedEntryId });
    });
});

// Set captain or vice-captain
app.post('/api/fpl/set-captain', async (req, res) => {
    const decoded = requireAuth(req, res);
    if (!decoded) return;

    const { element, role } = req.body;
    if (!element || !['captain', 'vice_captain'].includes(role)) {
        return res.status(400).json({ error: 'element and role (captain|vice_captain) required' });
    }

    db.get('SELECT fpl_session, fpl_refresh_token, fpl_expires_at, fpl_entry_id FROM users WHERE id = ?', [decoded.id], async (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row?.fpl_session) return res.status(401).json({ error: 'No FPL token stored' });

        let fplToken;
        try { fplToken = await getValidFplToken(decoded.id, row); }
        catch (e) { return res.status(401).json({ error: 'FPL token expired. Reconnect via extension.' }); }

        const headers = {
            'Authorization': `Bearer ${fplToken}`,
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json',
            'Origin': 'https://fantasy.premierleague.com',
            'Referer': 'https://fantasy.premierleague.com/',
        };

        // Fetch current team
        const teamRes = await fetch(`https://fantasy.premierleague.com/api/my-team/${row.fpl_entry_id}/`, { headers });
        if (!teamRes.ok) return res.status(teamRes.status).json({ error: 'Failed to fetch current team' });
        const teamData = await teamRes.json();

        // Update captain/VC flags
        const updatedPicks = teamData.picks.map(p => ({
            element: p.element,
            position: p.position,
            is_captain: role === 'captain' ? p.element === element : p.is_captain && p.element !== element,
            is_vice_captain: role === 'vice_captain' ? p.element === element : p.is_vice_captain && p.element !== element,
        }));

        const updateRes = await fetch(`https://fantasy.premierleague.com/api/my-team/${row.fpl_entry_id}/`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ picks: updatedPicks, chips: null }),
        });

        const updateBody = await updateRes.json();
        if (!updateRes.ok) return res.status(updateRes.status).json(updateBody);
        res.json({ ok: true });
    });
});

// Proxy authenticated FPL requests (uses stored fpl_session token if available)
app.use('/api/fpl-auth', async (req, res) => {
    const req_path = req.path;
    const decoded = requireAuth(req, res);
    if (!decoded) return;

    db.get('SELECT fpl_session, fpl_entry_id FROM users WHERE id = ?', [decoded.id], async (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row?.fpl_session) return res.status(401).json({ error: 'No FPL token stored. Connect via browser extension.' });

        const fplPath = '/' + req_path;
        const targetUrl = `https://fantasy.premierleague.com/api${fplPath}`;

        try {
            const response = await fetch(targetUrl, {
                method: req.method,
                headers: {
                    'Authorization': `Bearer ${row.fpl_session}`,
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Accept': 'application/json',
                    'Origin': 'https://fantasy.premierleague.com',
                    'Referer': 'https://fantasy.premierleague.com/',
                },
                body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
            });

            const data = await response.json();
            if (!response.ok) return res.status(response.status).json(data);
            res.json(data);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
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

const { initScheduler } = require('./server/scheduler.cjs');

// Initialize Scheduler
initScheduler();

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
