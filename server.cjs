require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./server/db.cjs');
const sqlite3 = require('sqlite3').verbose();
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
console.log('[Resend] API key loaded:', process.env.RESEND_API_KEY ? 'YES' : 'MISSING');

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
    const emailToken = require('crypto').randomBytes(32).toString('hex');

    db.run('INSERT INTO users (displayname, email, password_hash, is_verified, email_token) VALUES (?, ?, ?, 0, ?)', [display_name, email, hash, emailToken], function (err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                if (err.message.includes('users.email')) return res.status(409).json({ error: 'Email already registered' });
                return res.status(409).json({ error: 'Error creating user' });
            }
            return res.status(500).json({ error: err.message });
        }

        const token = jwt.sign({ id: this.lastID, displayname: display_name, email, is_verified: false, membership_tier: 1 }, JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({ token, user: { id: this.lastID, displayname: display_name, email, is_verified: false, membership_tier: 1 } });

        // Send welcome email (non-blocking)
        resend.emails.send({
            from: 'The Wolf <thewolf@fantasypremierwolf.com>',
            to: email,
            subject: 'Welcome to FantasyPremierWolf',
            html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#1e293b;border-radius:16px;border:1px solid #334155;overflow:hidden;">

        <!-- Top bar -->
        <tr><td style="height:4px;background:linear-gradient(90deg,#00ff87,#02efff);"></td></tr>

        <!-- Header -->
        <tr><td style="padding:36px 40px 24px;">
          <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#00ff87;letter-spacing:0.2em;text-transform:uppercase;">FantasyPremierWolf</p>
          <h1 style="margin:0;font-size:28px;font-weight:900;color:#ffffff;line-height:1.2;">Welcome, ${display_name}.</h1>
          <p style="margin:12px 0 0;font-size:15px;color:#94a3b8;line-height:1.6;">Your Wolf account is live. You're now one step away from AI-powered FPL analysis that actually wins gameweeks.</p>
        </td></tr>

        <!-- Divider -->
        <tr><td style="padding:0 40px;"><div style="height:1px;background:#334155;"></div></td></tr>

        <!-- Steps -->
        <tr><td style="padding:28px 40px;">
          <p style="margin:0 0 16px;font-size:12px;font-weight:700;color:#64748b;letter-spacing:0.15em;text-transform:uppercase;">Get started in 2 steps</p>
          <table cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="width:32px;vertical-align:top;padding-top:2px;">
                <div style="width:24px;height:24px;background:#00ff87;border-radius:6px;text-align:center;line-height:24px;font-size:12px;font-weight:900;color:#0f172a;">1</div>
              </td>
              <td style="padding:0 0 16px 12px;">
                <p style="margin:0;font-size:14px;font-weight:700;color:#ffffff;">Install the Chrome extension</p>
                <p style="margin:4px 0 0;font-size:13px;color:#94a3b8;">Links your FPL account so the Wolf can read your squad automatically.</p>
              </td>
            </tr>
            <tr>
              <td style="width:32px;vertical-align:top;padding-top:2px;">
                <div style="width:24px;height:24px;background:#00ff87;border-radius:6px;text-align:center;line-height:24px;font-size:12px;font-weight:900;color:#0f172a;">2</div>
              </td>
              <td style="padding:0 0 0 12px;">
                <p style="margin:0;font-size:14px;font-weight:700;color:#ffffff;">Hit "Unleash the Wolf"</p>
                <p style="margin:4px 0 0;font-size:13px;color:#94a3b8;">Get a full AI breakdown of your squad, transfers, and captaincy pick.</p>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- CTA -->
        <tr><td style="padding:0 40px 36px;">
          <a href="${process.env.APP_URL || 'https://fantasypremierwolf.com'}/api/auth/verify/${emailToken}" style="display:block;text-align:center;background:#00ff87;color:#0f172a;font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:0.15em;text-decoration:none;padding:14px 24px;border-radius:10px;">
            Activate My Account
          </a>
          <p style="margin:12px 0 0;font-size:11px;color:#475569;text-align:center;">Button not working? Copy and paste this link into your browser:<br><span style="color:#64748b;word-break:break-all;">${process.env.APP_URL || 'https://fantasypremierwolf.com'}/api/auth/verify/${emailToken}</span></p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 40px;border-top:1px solid #1e293b;background:#0f172a;border-radius:0 0 16px 16px;">
          <p style="margin:0;font-size:12px;color:#475569;text-align:center;">You're receiving this because you signed up at fantasypremierwolf.com.<br>© ${new Date().getFullYear()} FantasyPremierWolf</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
        }).then(result => console.log('[Resend] Welcome email sent:', JSON.stringify(result)))
          .catch(err => console.error('[Resend] Welcome email failed:', err.message, err));
    });
});

// Redirect to frontend — actual activation requires the user to be logged in (POST below)
app.get('/api/auth/verify/:token', (req, res) => {
    const { token } = req.params;
    res.redirect(`${process.env.APP_URL || 'https://fantasypremierwolf.com'}/?activate=${token}`);
});

// Protected activation — requires valid JWT so only the logged-in user can activate their own account
app.post('/api/auth/activate', (req, res) => {
    const decoded = requireAuth(req, res);
    if (!decoded) return;

    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Activation token required' });

    db.get('SELECT * FROM users WHERE email_token = ? AND id = ?', [token, decoded.id], (err, user) => {
        if (err || !user) return res.status(400).json({ error: 'Invalid or expired activation link' });
        db.run('UPDATE users SET is_verified = 1, email_token = NULL WHERE id = ?', [user.id], (err2) => {
            if (err2) return res.status(500).json({ error: 'Activation failed' });
            res.json({ ok: true });
        });
    });
});

app.post('/api/auth/check-email', (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    db.get('SELECT id FROM users WHERE email = ?', [email.trim()], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ taken: !!row });
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

        const token = jwt.sign({ id: user.id, displayname: user.displayname, email: user.email, is_verified: !!user.is_verified, membership_tier: user.membership_tier || 1 }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user.id, displayname: user.displayname, email: user.email, is_verified: !!user.is_verified, membership_tier: user.membership_tier || 1 } });
    });
});

app.get('/api/auth/me', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });

    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Invalid token' });
        // Fetch fresh is_verified from DB so it reflects after email verification
        db.get('SELECT is_verified, membership_tier, credits, manager_dna FROM users WHERE id = ?', [decoded.id], (dbErr, row) => {
            res.json({ user: { ...decoded, is_verified: row ? !!row.is_verified : decoded.is_verified, membership_tier: row?.membership_tier || decoded.membership_tier || 1, credits: row?.credits ?? 1, manager_dna: row?.manager_dna || null } });
        });
    });
});

app.post('/api/fpl/disconnect', (req, res) => {
    const decoded = requireAuth(req, res);
    if (!decoded) return;
    delete fplValidationCache[decoded.id];
    db.run('UPDATE users SET fpl_session = NULL, fpl_refresh_token = NULL, fpl_expires_at = NULL WHERE id = ?', [decoded.id], () => {
        res.json({ ok: true });
    });
});

app.post('/api/user/manager-dna', (req, res) => {
    const decoded = requireAuth(req, res);
    if (!decoded) return;
    const { dna } = req.body;
    const valid = ['maverick', 'spreadsheet', 'template', 'kneejerk', 'eyetest'];
    if (!valid.includes(dna)) return res.status(400).json({ error: 'Invalid DNA value' });
    db.run('UPDATE users SET manager_dna = ? WHERE id = ?', [dna, decoded.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ ok: true, dna });
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
const FPL_DB_PATH = 'T:\\My Drive\\FPL\\db\\fpl.db';

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
            // Deduplicate by entry_id (keep first/oldest per entry)
            const seen = new Set();
            const deduped = rows.filter(row => {
                try {
                    const d = JSON.parse(row.team_data);
                    if (d.entry_id) {
                        if (seen.has(d.entry_id)) return false;
                        seen.add(d.entry_id);
                    }
                } catch {}
                return true;
            });
            res.json(deduped);
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

// --- Lineup Cache Routes ---

// Save (upsert) latest live lineup for an entry
app.put('/api/user/lineup-cache/:entry_id', (req, res) => {
    const decoded = requireAuth(req, res);
    if (!decoded) return;
    const entryId = Number(req.params.entry_id);
    const { picks_data, gameweek, chips_data } = req.body;
    if (!picks_data || !Array.isArray(picks_data)) return res.status(400).json({ error: 'picks_data array required' });
    // Add chips_data column if it doesn't exist yet (migration)
    db.run("ALTER TABLE cached_lineups ADD COLUMN chips_data TEXT", () => {});
    db.run(
        `INSERT OR REPLACE INTO cached_lineups (user_id, entry_id, picks_data, gameweek, chips_data, updated_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [decoded.id, entryId, JSON.stringify(picks_data), gameweek || null, chips_data ? JSON.stringify(chips_data) : null],
        (err) => err ? res.status(500).json({ error: err.message }) : res.json({ ok: true })
    );
});

// Get cached lineup for an entry
app.get('/api/user/lineup-cache/:entry_id', (req, res) => {
    const decoded = requireAuth(req, res);
    if (!decoded) return;
    const entryId = Number(req.params.entry_id);
    db.get('SELECT * FROM cached_lineups WHERE user_id = ? AND entry_id = ?', [decoded.id, entryId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.json(null);
        res.json({
            ...row,
            picks_data: JSON.parse(row.picks_data),
            chips_data: row.chips_data ? JSON.parse(row.chips_data) : null,
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
      ORDER BY f.rank
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

app.get('/api/fpl/entry/:entryId', async (req, res) => {
    try {
        const r = await fetch(`https://fantasy.premierleague.com/api/entry/${req.params.entryId}/`);
        if (!r.ok) return res.status(r.status).json({ error: 'FPL API error' });
        const d = await r.json();
        res.json({ name: d.name, manager: `${d.player_first_name || ''} ${d.player_last_name || ''}`.trim() });
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch entry' });
    }
});

app.get('/api/fpl/status', (req, res) => {
    const decoded = requireAuth(req, res);
    if (!decoded) return;
    db.get('SELECT fpl_entry_id, fpl_session, fpl_expires_at, fpl_refresh_token FROM users WHERE id = ?', [decoded.id], async (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row?.fpl_session) return res.json({ fpl_entry_id: row.fpl_entry_id || null, fpl_connected: false });

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
    db.run('UPDATE users SET fpl_session = NULL, fpl_refresh_token = NULL, fpl_expires_at = NULL WHERE id = ?', [decoded.id], (err) => {
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
        try {
            return await refreshFplToken(userId, row.fpl_refresh_token);
        } catch (err) {
            console.warn(`[FPL] Token refresh failed for user ${userId} — clearing session. User must reconnect.`);
            db.run('UPDATE users SET fpl_session = NULL, fpl_refresh_token = NULL, fpl_expires_at = NULL WHERE id = ?', [userId]);
            return null;
        }
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
                // Don't clear session here — status endpoint is the authority for that
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
                _transfers: data.transfers || null,
                _chips: data.chips || [],
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
});

// Auto-save a connected team to saved_teams if not already saved
async function autoSaveConnectedTeam(userId, entryId) {
    if (!entryId) return;
    const existing = await new Promise((resolve, reject) =>
        db.get("SELECT id FROM saved_teams WHERE user_id = ? AND json_extract(team_data, '$.entry_id') = ?",
            [userId, entryId], (err, row) => err ? reject(err) : resolve(row))
    );
    if (existing) return;

    const entryRes = await fetch(`https://fantasy.premierleague.com/api/entry/${entryId}/`);
    if (!entryRes.ok) return;
    const entryData = await entryRes.json();

    const teamName = entryData.name || `Team ${entryId}`;
    const manager = `${entryData.player_first_name || ''} ${entryData.player_last_name || ''}`.trim() || 'Unknown';
    const teamDataStr = JSON.stringify({ entry_id: entryId, manager });

    // Use INSERT with NOT EXISTS to prevent duplicates even under race conditions
    await new Promise((resolve, reject) =>
        db.run(
            `INSERT INTO saved_teams (user_id, name, team_data)
             SELECT ?, ?, ?
             WHERE NOT EXISTS (
                 SELECT 1 FROM saved_teams WHERE user_id = ? AND json_extract(team_data, '$.entry_id') = ?
             )`,
            [userId, teamName, teamDataStr, userId, entryId],
            (err) => err ? reject(err) : resolve()
        )
    );
}

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
        if (resolvedEntryId) autoSaveConnectedTeam(decoded.id, resolvedEntryId).catch(() => {});
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

// --- TV Broadcast Data ---
// Maps channel name substrings (lowercase) to logo URLs we control
const CHANNEL_LOGO_MAP = {
    'sky sports':   'https://resources.premierleague.com/premierleague25/broadcasters/large/sky.png',
    'tnt sports':   'https://resources.premierleague.com/premierleague25/broadcasters/large/tnt.png',
    'amazon prime': 'https://resources.premierleague.com/premierleague25/broadcasters/large/amazon.png',
    'peacock':      'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/NBCUniversal_Peacock_Logo.svg/120px-NBCUniversal_Peacock_Logo.svg.png',
    'nbc':          'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/NBC_Sports_logo.svg/120px-NBC_Sports_logo.svg.png',
    'usa network':  '/tv/usa.svg',
    'telemundo':    '/tv/telemundo.svg',
    'universo':     '/tv/universo.svg',
    'dazn':         '/tv/dazn.svg',
    'optus':        '/tv/optus.svg',
    'fubo':         '/tv/fubo.svg',
    'sky sport':    'https://upload.wikimedia.org/wikipedia/en/thumb/d/de/Sky_Sport_-_2020_logo.svg/250px-Sky_Sport_-_2020_logo.svg.png',
    'canal':        '/tv/canal.svg',
    'bein':         'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/BeIN_Sports_logo.svg/120px-BeIN_Sports_logo.svg.png',
    'viaplay':      'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Viaplay_logo.svg/120px-Viaplay_logo.svg.png',
    'movistar':     'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2b/Movistar%2B_logo.svg/120px-Movistar%2B_logo.svg.png',
    'supersport':   'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/SuperSport_Logo.svg/120px-SuperSport_Logo.svg.png',
    'espn':         'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/ESPN_wordmark.svg/120px-ESPN_wordmark.svg.png',
    'star':         'https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/Star_Sports_logo.svg/120px-Star_Sports_logo.svg.png',
    'jio':          'https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/JioCinema_logo.svg/120px-JioCinema_logo.svg.png',
    'virgin':       'https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Virgin_Media_logo_2021.svg/120px-Virgin_Media_logo_2021.svg.png',
};

function resolveChannelLogo(name) {
    const lower = name.toLowerCase();
    for (const [key, url] of Object.entries(CHANNEL_LOGO_MAP)) {
        if (lower.includes(key)) return url;
    }
    return null;
}

// GET /api/fixtures/tv?event=32&country=GB
app.get('/api/fixtures/tv', async (req, res) => {
    const eventId = parseInt(req.query.event);
    const country = (req.query.country || 'GB').toUpperCase();
    if (!eventId) return res.status(400).json({ error: 'event required' });
    console.log(`[TV] Request: event=${eventId} country=${country}`);

    try {
        // Check cache (valid for 6 hours)
        const cached = await new Promise((resolve, reject) =>
            db.get(
                `SELECT result_json FROM tv_cache
                 WHERE event_id = ? AND country_code = ? AND fetched_at > datetime('now', '-6 hours')`,
                [eventId, country],
                (err, row) => err ? reject(err) : resolve(row)
            )
        ).catch(() => null); // Don't fail if table not ready yet

        if (cached) {
            console.log(`[TV] Serving from cache: event ${eventId} / ${country}`);
            return res.json(JSON.parse(cached.result_json));
        }

        // Fetch FPL fixtures for this event to get kickoff times
        const fplRes = await fetch(`https://fantasy.premierleague.com/api/fixtures/?event=${eventId}`, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const fixtures = await fplRes.json();
        console.log(`[TV] FPL fixtures for event ${eventId}: ${fixtures?.length ?? 0}`);
        if (!fixtures?.length) return res.json({});

        console.log(`[TV] Launching puppeteer to scrape livesoccertv.com for ${country}`);

        const puppeteer = require('puppeteer');
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        });

        // Map our 2-letter country codes to livesoccertv.com country slugs
        const LSTV_COUNTRY = {
            GB: 'united-kingdom', IE: 'ireland', US: 'usa', CA: 'canada',
            AU: 'australia', NZ: 'new-zealand', DE: 'germany', FR: 'france',
            ES: 'spain', IT: 'italy', NL: 'netherlands', NO: 'norway',
            SE: 'sweden', DK: 'denmark', FI: 'finland', IN: 'india',
            JP: 'japan', KR: 'south-korea', SG: 'singapore',
            SA: 'saudi-arabia', AE: 'united-arab-emirates', ZA: 'south-africa',
            BR: 'brazil', AR: 'argentina', MX: 'mexico',
        };

        const result = {};
        try {
            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
            await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-GB,en;q=0.9' });

            const countrySlug = LSTV_COUNTRY[country] || 'united-kingdom';
            const url = `https://www.livesoccertv.com/competitions/english-premier-league/`;
            console.log(`[TV] Navigating to ${url}`);
            await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

            // Set country via their selector if possible, then extract match rows
            // livesoccertv.com shows matches with TV channels per country
            // Try to click the country selector
            try {
                await page.evaluate((slug) => {
                    // Look for country links/buttons
                    const links = Array.from(document.querySelectorAll('a[href*="' + slug + '"], button'));
                    const match = links.find(el => el.textContent.toLowerCase().includes(slug.replace('-', ' ').split(' ')[0]));
                    if (match) match.click();
                }, countrySlug);
                await new Promise(r => setTimeout(r, 2000));
            } catch {}

            // Extract all match rows with TV channel info
            const matchRows = await page.evaluate(() => {
                const rows = [];
                // livesoccertv typically uses table rows or match blocks
                document.querySelectorAll('tr.match, tr[class*="match"], .match-row, [data-match]').forEach(row => {
                    const timeEl = row.querySelector('.time, .match-time, [class*="time"]');
                    const homeEl = row.querySelector('.home, .team-home, [class*="home"]');
                    const awayEl = row.querySelector('.away, .team-away, [class*="away"]');
                    const tvEls = row.querySelectorAll('img[src*="channel"], img[src*="tv"], .channel img, .tv-channel img, [class*="channel"] img');
                    if (timeEl || homeEl) {
                        const channels = Array.from(tvEls).map(img => ({
                            name: img.alt || img.title || '',
                            src: img.src || '',
                        }));
                        rows.push({
                            time: timeEl?.textContent?.trim() || '',
                            home: homeEl?.textContent?.trim() || '',
                            away: awayEl?.textContent?.trim() || '',
                            channels,
                        });
                    }
                });
                return rows;
            });

            console.log(`[TV] livesoccertv rows found: ${matchRows.length}`);
            if (matchRows.length > 0) console.log(`[TV] Sample row:`, JSON.stringify(matchRows[0]));

            // If livesoccertv scraping got channels, match to FPL fixtures
            // Otherwise fall back to kickoff-time heuristic for UK
            const hasChannelData = matchRows.some(r => r.channels.length > 0);

            if (hasChannelData) {
                for (const fixture of fixtures) {
                    if (!fixture.kickoff_time) { result[fixture.id] = []; continue; }
                    const ko = new Date(fixture.kickoff_time);
                    const koHHMM = `${String(ko.getUTCHours()).padStart(2,'0')}:${String(ko.getUTCMinutes()).padStart(2,'0')}`;
                    // Match by kickoff time (UTC) AND team names for better accuracy
                    const matched = matchRows.find(r => {
                        const timeMatch = r.time && r.time.includes(koHHMM);
                        if (!timeMatch) return false;
                        
                        const home = (fixture.team_h_name || homeTeam?.name || '').toLowerCase();
                        const away = (fixture.team_a_name || awayTeam?.name || '').toLowerCase();
                        const rHome = r.home.toLowerCase();
                        const rAway = r.away.toLowerCase();
                        
                        // Fuzzy match team names
                        return rHome.includes(home.split(' ')[0]) || rAway.includes(away.split(' ')[0]);
                    });

                    if (!matched) { result[fixture.id] = []; continue; }
                    const channels = matched.channels
                        .filter(c => c.name || c.src)
                        .map(c => ({ name: c.name, logo: resolveChannelLogo(c.name) || c.src || null }));
                    result[fixture.id] = channels;
                    console.log(`[TV] Fixture ${fixture.id} (${koHHMM}): ${channels.map(c => c.name).join(', ') || 'no channels'}`);
                }
            } else {
                // Heuristic fallbacks when scraper doesn't find data
                if (country === 'GB' || country === 'IE') {
                    console.log('[TV] No channel data from livesoccertv, using UK kickoff heuristic');
                    const SKY = { name: 'Sky Sports', logo: CHANNEL_LOGO_MAP['sky sports'] };
                    const TNT = { name: 'TNT Sports', logo: CHANNEL_LOGO_MAP['tnt sports'] };
                    for (const fixture of fixtures) {
                    if (!fixture.kickoff_time) { result[fixture.id] = []; continue; }
                    const ko = new Date(fixture.kickoff_time);
                    const utcDay = ko.getUTCDay(); // 0=Sun,1=Mon,...,5=Fri,6=Sat
                    const utcH = ko.getUTCHours();
                    const utcM = ko.getUTCMinutes();
                    const isSat = utcDay === 6, isSun = utcDay === 0, isMon = utcDay === 1, isFri = utcDay === 5;
                    const isBlackout = isSat && utcM === 0 && (utcH === 14 || utcH === 15);
                    if (isBlackout) { result[fixture.id] = []; continue; }

                    // UK Broadcaster Heuristics (Typical Slots)
                    // Sat 12:30 (11:30 UTC in BST) -> TNT Sports
                    if (isSat && utcM === 30 && (utcH === 11 || utcH === 12)) { result[fixture.id] = [TNT]; continue; }
                    // Sat 17:30 (16:30 UTC in BST) -> Sky Sports
                    if (isSat && utcM === 30 && (utcH === 16 || utcH === 17)) { result[fixture.id] = [SKY]; continue; }
                    // Sun 14:00 (13:00 UTC in BST) or 16:30 (15:30 UTC in BST) -> Sky Sports
                    if (isSun && ((utcM === 0 && (utcH === 13 || utcH === 14)) || (utcM === 30 && (utcH === 15 || utcH === 16)))) { 
                        result[fixture.id] = [SKY]; continue; 
                    }
                    // Mon 20:00 (19:00 UTC in BST) or Fri 20:00 (19:00 UTC in BST) -> Sky Sports
                    if ((isMon || isFri) && utcM === 0 && (utcH === 19 || utcH === 20)) { result[fixture.id] = [SKY]; continue; }

                    // If we can't be sure, default to empty rather than showing both incorrectly
                    result[fixture.id] = [];
                    }
                } else if (country === 'US') {
                    console.log('[TV] No channel data from livesoccertv, using US kickoff heuristic');
                    const PEACOCK = { name: 'Peacock', logo: CHANNEL_LOGO_MAP['peacock'] };
                    const NBC = { name: 'NBC Sports', logo: CHANNEL_LOGO_MAP['nbc'] };
                    const USA = { name: 'USA Network', logo: CHANNEL_LOGO_MAP['usa network'] };
                    const TELE = { name: 'Telemundo', logo: CHANNEL_LOGO_MAP['telemundo'] };
                    const UNIV = { name: 'Universo', logo: CHANNEL_LOGO_MAP['universo'] };
                    
                    for (const fixture of fixtures) {
                        if (!fixture.kickoff_time) { result[fixture.id] = []; continue; }
                        const ko = new Date(fixture.kickoff_time);
                        const utcDay = ko.getUTCDay();
                        const utcH = ko.getUTCHours();
                        const utcM = ko.getUTCMinutes();
                        
                        if (utcDay === 5 && utcM === 0 && (utcH === 19 || utcH === 20)) {
                            result[fixture.id] = [USA, UNIV]; // Fri 20:00
                        } else if (utcDay === 6 && utcM === 30 && (utcH === 11 || utcH === 12)) {
                            result[fixture.id] = [USA, UNIV]; // Sat 12:30
                        } else if (utcDay === 6 && utcM === 0 && (utcH === 14 || utcH === 15)) {
                            result[fixture.id] = [PEACOCK]; // Sat 15:00
                        } else if (utcDay === 6 && utcM === 30 && (utcH === 16 || utcH === 17)) {
                            result[fixture.id] = [NBC, TELE]; // Sat 17:30
                        } else if (utcDay === 0 && utcM === 0 && (utcH === 13 || utcH === 14)) {
                            result[fixture.id] = [USA, TELE]; // Sun 14:00 (often one USA, rest Peacock, assuming USA as primary)
                        } else if (utcDay === 0 && utcM === 30 && (utcH === 15 || utcH === 16)) {
                            result[fixture.id] = [USA, TELE]; // Sun 16:30
                        } else if (utcDay === 1 && utcM === 0 && (utcH === 19 || utcH === 20)) {
                            result[fixture.id] = [USA, UNIV]; // Mon 20:00
                        } else {
                            result[fixture.id] = [PEACOCK]; // Default
                        }
                    }
                } else if (country === 'AU') {
                    console.log('[TV] No channel data from livesoccertv, using AU heuristic');
                    const OPTUS = { name: 'Optus Sport', logo: CHANNEL_LOGO_MAP['optus'] };
                    for (const fixture of fixtures) result[fixture.id] = [OPTUS];
                } else if (country === 'CA') {
                    console.log('[TV] No channel data from livesoccertv, using CA heuristic');
                    const FUBO = { name: 'fuboTV', logo: CHANNEL_LOGO_MAP['fubo'] };
                    for (const fixture of fixtures) result[fixture.id] = [FUBO];
                } else if (country === 'DE' || country === 'IT') {
                    console.log(`[TV] No channel data from livesoccertv, using ${country} heuristic`);
                    const SKY = { name: country === 'DE' ? 'Sky Sport' : 'Sky Sport Uno', logo: CHANNEL_LOGO_MAP['sky sport'] };
                    for (const fixture of fixtures) result[fixture.id] = [SKY];
                } else if (country === 'FR') {
                    console.log('[TV] No channel data from livesoccertv, using FR heuristic');
                    const CANAL = { name: 'Canal+', logo: CHANNEL_LOGO_MAP['canal'] };
                    for (const fixture of fixtures) result[fixture.id] = [CANAL];
                } else if (country === 'ES') {
                    console.log('[TV] No channel data from livesoccertv, using ES heuristic');
                    const DAZN = { name: 'DAZN', logo: CHANNEL_LOGO_MAP['dazn'] };
                    for (const fixture of fixtures) result[fixture.id] = [DAZN];
                } else {
                    // For other countries where scraper fails, render nothing rather than wrong channels
                    console.log(`[TV] Scraper failed and country is ${country}. No fallback available.`);
                    for (const fixture of fixtures) result[fixture.id] = [];
                }
            }
        } finally {
            await browser.close();
        }

        db.run(
            `INSERT OR REPLACE INTO tv_cache (event_id, country_code, result_json, fetched_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
            [eventId, country, JSON.stringify(result)]
        );

        console.log('[TV] Final result sample:', JSON.stringify(Object.entries(result).slice(0, 2)));
        res.json(result);
    } catch (e) {
        console.error('[TV] Error:', e.message);
        res.status(500).json({ error: 'Failed to fetch broadcast data' });
    }
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
            // Special handling for picks: if FPL returns 404 (common for future/limbo GWs),
            // return 200 and null to avoid messy browser console red error logs.
            if (response.status === 404 && fplPath.includes('/picks/')) {
                console.log(`[Proxy] Silencing 404 for picks: ${finalUrl}`);
                return res.status(200).json(null);
            }

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
