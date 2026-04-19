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
const multer = require('multer');
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const resend = new Resend(process.env.RESEND_API_KEY);
console.log('[Resend] API key loaded:', process.env.RESEND_API_KEY ? 'YES' : 'MISSING');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-prod';

// Per-user FPL token validation cache { [userId]: { valid: bool, at: timestamp } }
const fplValidationCache = {};

// Bootstrap-static cache — refresh every 5 minutes, serve stale on FPL API errors
let bootstrapCache = null;  // { data: Object, at: number }
const BOOTSTRAP_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Middleware
app.use(cors());

// Stripe webhook — must use raw body BEFORE express.json()
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('[Stripe] Webhook signature failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        const type = session.metadata?.type;

        if (!userId) {
            console.error('[Stripe] Webhook missing userId in metadata');
            return res.json({ received: true });
        }

        if (type === 'credits') {
            const qty = parseInt(session.metadata?.qty, 10);
            if (!qty || qty < 1) {
                console.error('[Stripe] Webhook invalid qty:', session.metadata?.qty);
                return res.json({ received: true });
            }
            db.run('UPDATE users SET credits = credits + ? WHERE id = ?', [qty, userId], (err) => {
                if (err) console.error('[Stripe] Failed to add credits:', err.message);
                else console.log(`[Stripe] Added ${qty} credits to user ${userId}`);
            });

        } else if (type === 'subscription') {
            const plan = session.metadata?.plan;
            const tier = plan === 'autopilot' ? 3 : plan === 'copilot' ? 2 : null;
            if (!tier) {
                console.error('[Stripe] Unknown plan in metadata:', plan);
                return res.json({ received: true });
            }
            const now = new Date().toISOString();
            const stripeSubId = session.subscription || null;
            db.run('UPDATE users SET membership_tier = ?, subscription_started_at = ?, stripe_subscription_id = ? WHERE id = ?', [tier, now, stripeSubId, userId], (err) => {
                if (err) console.error('[Stripe] Failed to update tier:', err.message);
                else console.log(`[Stripe] User ${userId} upgraded to tier ${tier} (${plan}), sub: ${stripeSubId}`);
            });
        }
    }

    res.json({ received: true });
});

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

    db.run('INSERT INTO users (displayname, email, password_hash, is_verified, email_token, active) VALUES (?, ?, ?, 0, ?, 1)', [display_name, email, hash, emailToken], function (err) {
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
    db.get('SELECT id FROM users WHERE email = ? AND active = 1', [email.trim()], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ taken: !!row });
    });
});

app.post('/api/auth/login', (req, res) => {
    let { email, password } = req.body;
    if (email) email = email.trim();

    db.get('SELECT * FROM users WHERE email = ? AND active = 1', [email], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        if (!bcrypt.compareSync(password, user.password_hash)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user.id, displayname: user.displayname, email: user.email, is_verified: !!user.is_verified, membership_tier: user.membership_tier || 1 }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user.id, displayname: user.displayname, email: user.email, is_verified: !!user.is_verified, membership_tier: user.membership_tier || 1, credits: user.credits ?? 1, manager_dna: user.manager_dna || null } });
    });
});

app.get('/api/auth/me', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });

    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Invalid token' });
        // Fetch fresh is_verified from DB so it reflects after email verification
        db.get('SELECT is_verified, membership_tier, credits, manager_dna, subscription_started_at, autopilot_enabled, fpl_connected_at FROM users WHERE id = ?', [decoded.id], (dbErr, row) => {
            res.json({ user: { ...decoded, is_verified: row ? !!row.is_verified : decoded.is_verified, membership_tier: row?.membership_tier || decoded.membership_tier || 1, credits: row?.credits ?? 1, manager_dna: row?.manager_dna || null, subscription_started_at: row?.subscription_started_at || null, autopilot_enabled: !!row?.autopilot_enabled, fpl_connected_at: row?.fpl_connected_at || null } });
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

app.post('/api/user/deduct-credit', (req, res) => {
    const decoded = requireAuth(req, res);
    if (!decoded) return;
    db.get('SELECT credits FROM users WHERE id = ?', [decoded.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row || row.credits < 1) return res.status(403).json({ error: 'No analysis credits remaining.' });
        db.run('UPDATE users SET credits = credits - 1 WHERE id = ?', [decoded.id], (err2) => {
            if (err2) return res.status(500).json({ error: err2.message });
            res.json({ ok: true, credits: row.credits - 1 });
        });
    });
});

// Wolf Analysis — server-side Gemini proxy with atomic credit gate
// 1. Authenticate  2. Check credits  3. Deduct  4. Call Gemini  5. Return result
// The Gemini API key never leaves the server. Credits are deducted BEFORE the
// Gemini call so there is no window where a client can receive the analysis
// without paying for it.
app.post('/api/wolf-analysis', async (req, res) => {
    const decoded = requireAuth(req, res);
    if (!decoded) return;

    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string') return res.status(400).json({ error: 'prompt required' });

    // AI_PROVIDER: "gemini" (default) or "claude" — change env var to switch providers
    const AI_PROVIDER = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (AI_PROVIDER === 'gemini' && !GEMINI_API_KEY) return res.status(500).json({ error: 'Wolf analysis not configured on server.' });
    if (AI_PROVIDER !== 'gemini' && !ANTHROPIC_API_KEY) return res.status(500).json({ error: 'Wolf analysis not configured on server.' });

    // Check and atomically deduct credit — if deduction fails the AI call never happens
    const creditOk = await new Promise((resolve) => {
        db.get('SELECT credits FROM users WHERE id = ?', [decoded.id], (err, row) => {
            if (err || !row || row.credits < 1) return resolve(false);
            db.run('UPDATE users SET credits = credits - 1 WHERE id = ?', [decoded.id], (err2) => {
                resolve(!err2);
            });
        });
    });
    if (!creditOk) return res.status(403).json({ error: 'No analysis credits remaining.' });

    try {
        const aiController = new AbortController();
        const aiTimeout = setTimeout(() => aiController.abort(), 170_000); // 170s — just under client's 180s

        let aiRes;
        if (AI_PROVIDER === 'gemini') {
            aiRes = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    signal: aiController.signal,
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
                    }),
                }
            );
        } else {
            aiRes = await fetch(
                'https://api.anthropic.com/v1/messages',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': ANTHROPIC_API_KEY,
                        'anthropic-version': '2023-06-01',
                    },
                    signal: aiController.signal,
                    body: JSON.stringify({
                        model: 'claude-sonnet-4-6',
                        max_tokens: 16000,
                        temperature: 0.7,
                        messages: [{ role: 'user', content: prompt }],
                    }),
                }
            );
        }

        clearTimeout(aiTimeout);
        if (!aiRes.ok) {
            const errBody = await aiRes.json().catch(() => ({}));
            console.error('[Wolf] AI error:', aiRes.status, errBody);
            // Refund credit — AI service failed through no fault of the user
            db.run('UPDATE users SET credits = credits + 1 WHERE id = ?', [decoded.id], () => {});
            return res.status(502).json({ error: 'AI service error — credit refunded.' });
        }

        const aiData = await aiRes.json();
        const text = AI_PROVIDER === 'gemini'
            ? (aiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '')
            : (aiData?.content?.[0]?.text ?? '');
        res.json({ result: text, provider: AI_PROVIDER });
    } catch (error) {
        console.error('[Wolf] Fetch error:', error.message);
        // Refund credit on network error
        db.run('UPDATE users SET credits = credits + 1 WHERE id = ?', [decoded.id], () => {});
        res.status(500).json({ error: 'Network error reaching AI service — credit refunded.' });
    }
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
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 20;
    const offset = (page - 1) * limit;
    console.log(`[API] Searching for: ${q} (page ${page})`);

    if (!q || q.length < 2) {
        return res.json([]);
    }

    const fplDb = new sqlite3.Database(FPL_DB_PATH);

    // Numeric query → direct team_id lookup
    const isNumeric = /^\d+$/.test(q.trim());
    const queryCode = isNumeric
        ? `SELECT team_id, team_name, manager_name FROM teams WHERE team_id = ? LIMIT ${limit} OFFSET ${offset}`
        : `SELECT t.team_id, t.team_name, t.manager_name FROM teams_fts f JOIN teams t ON f.rowid = t.id WHERE teams_fts MATCH ? ORDER BY f.rank LIMIT ${limit} OFFSET ${offset}`;

    // FTS5 Prefix Search
    const searchQuery = isNumeric ? q.trim() : q.trim().split(/\s+/).map(term => term + '*').join(' ');

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
        db.all('SELECT id, team_name, entry_id, gameweek, analysis_text, ai_provider, created_at FROM analyses WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', [decoded.id], (err, rows) => {
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
        const { team_name, entry_id, gameweek, analysis_text, ai_provider } = req.body;
        if (!analysis_text) return res.status(400).json({ error: 'analysis_text required' });
        db.run('INSERT INTO analyses (user_id, team_name, entry_id, gameweek, analysis_text, ai_provider) VALUES (?, ?, ?, ?, ?, ?)',
            [decoded.id, team_name || 'Unknown', entry_id || null, gameweek || null, analysis_text, ai_provider || null],
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

// Contact form
app.post('/api/contact', upload.single('attachment'), async (req, res) => {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !subject || !message) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    const attachments = [];
    if (req.file) {
        attachments.push({
            filename: req.file.originalname,
            content: req.file.buffer.toString('base64'),
        });
    }

    try {
        await resend.emails.send({
            from: 'The Wolf <thewolf@fantasypremierwolf.com>',
            to: 'thewolf@fantasypremierwolf.com',
            replyTo: email,
            subject: `[Contact] ${subject}`,
            html: `
                <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0f172a;color:#e2e8f0;padding:32px;border-radius:12px;">
                    <h2 style="color:#00ff87;margin:0 0 24px;">New Contact Message</h2>
                    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
                        <tr><td style="padding:8px 0;color:#94a3b8;width:80px;">From</td><td style="padding:8px 0;color:#fff;">${name} &lt;${email}&gt;</td></tr>
                        <tr><td style="padding:8px 0;color:#94a3b8;">Subject</td><td style="padding:8px 0;color:#fff;">${subject}</td></tr>
                    </table>
                    <div style="background:#1e293b;border-radius:8px;padding:16px;white-space:pre-wrap;color:#e2e8f0;font-size:14px;line-height:1.6;">${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
                    ${req.file ? `<p style="margin-top:16px;color:#94a3b8;font-size:12px;">📎 Attachment: ${req.file.originalname}</p>` : ''}
                </div>
            `,
            attachments,
        });
        res.json({ ok: true });
    } catch (err) {
        console.error('[Contact] Email error:', err);
        res.status(500).json({ error: 'Failed to send message.' });
    }
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

    const numericEntryId = Number(entry_id);

    db.run('UPDATE users SET fpl_entry_id = ? WHERE id = ?', [numericEntryId, decoded.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        stampTeamConnectedAt(decoded.id, numericEntryId);

        // Award 1 free credit if this FPL manager ID has never been used before
        db.get('SELECT fpl_entry_id FROM fpl_free_credits WHERE fpl_entry_id = ?', [numericEntryId], (err2, row) => {
            if (err2 || row) {
                // Already claimed — just return without credit
                return res.json({ entry_id: numericEntryId, free_credit_awarded: false });
            }
            // First time this FPL account has been linked — award 1 credit
            db.run('INSERT INTO fpl_free_credits (fpl_entry_id) VALUES (?)', [numericEntryId], (err3) => {
                if (err3) return res.json({ entry_id: numericEntryId, free_credit_awarded: false });
                db.run('UPDATE users SET credits = credits + 1 WHERE id = ?', [decoded.id], (err4) => {
                    if (err4) return res.json({ entry_id: numericEntryId, free_credit_awarded: false });
                    console.log(`[Credits] Free credit awarded to user ${decoded.id} for FPL entry ${numericEntryId}`);
                    res.json({ entry_id: numericEntryId, free_credit_awarded: true });
                });
            });
        });
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
                    selling_price: p.selling_price ?? null,
                    purchase_price: p.purchase_price ?? null,
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
function stampTeamConnectedAt(userId, entryId) {
    db.run(
        "UPDATE saved_teams SET last_connected_at = ? WHERE user_id = ? AND json_extract(team_data, '$.entry_id') = ?",
        [new Date().toISOString(), userId, entryId],
        (err) => { if (err) console.error('[DB] stampTeamConnectedAt error:', err.message); }
    );
}

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

    const updates = ['fpl_session = ?', 'fpl_refresh_token = ?', 'fpl_expires_at = ?', 'fpl_entry_id = ?', 'fpl_connected_at = ?'];
    const params = [fpl_token, fpl_refresh_token || null, fpl_expires_at || null, resolvedEntryId, new Date().toISOString()];
    params.push(decoded.id);

    db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        delete fplValidationCache[decoded.id];
        if (resolvedEntryId) {
            autoSaveConnectedTeam(decoded.id, resolvedEntryId).catch(() => {});
            stampTeamConnectedAt(decoded.id, resolvedEntryId);
        }
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

        // Update captain/VC flags (mutually exclusive per player)
        const updatedPicks = teamData.picks.map(p => ({
            element: p.element,
            position: p.position,
            is_captain: role === 'captain' ? p.element === element : (p.is_captain && p.element !== element),
            is_vice_captain: role === 'vice_captain' ? p.element === element : (p.is_vice_captain && p.element !== element && !(role === 'captain' && p.element === element)),
        }));

        const updateRes = await fetch(`https://fantasy.premierleague.com/api/my-team/${row.fpl_entry_id}/`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ picks: updatedPicks, chip: null }),
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

            const text = await response.text();
            let data;
            try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
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

// Bootstrap-static with cache + stale-on-error fallback
app.get('/api/bootstrap-static/', async (req, res) => {
    const now = Date.now();
    // Serve from cache if still fresh
    if (bootstrapCache && (now - bootstrapCache.at) < BOOTSTRAP_TTL_MS) {
        return res.json(bootstrapCache.data);
    }
    try {
        const response = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
                'Accept': 'application/json',
            },
        });
        if (!response.ok) {
            // FPL API is unhappy — serve stale cache if we have one, otherwise propagate the error
            if (bootstrapCache) {
                console.warn(`[Bootstrap] FPL returned ${response.status} — serving stale cache (age: ${Math.round((now - bootstrapCache.at) / 1000)}s)`);
                return res.json(bootstrapCache.data);
            }
            return res.status(response.status).json({ error: `FPL API Error: ${response.status}`, details: response.statusText });
        }
        const data = await response.json();
        bootstrapCache = { data, at: now };
        res.json(data);
    } catch (error) {
        // Network error — serve stale cache if available
        if (bootstrapCache) {
            console.warn(`[Bootstrap] Fetch error (${error.message}) — serving stale cache (age: ${Math.round((now - bootstrapCache.at) / 1000)}s)`);
            return res.json(bootstrapCache.data);
        }
        console.error('[Bootstrap] Fatal fetch error and no cache:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// --- Stripe Checkout ---

const CREDIT_PACKS = {
    1:  { amount: 200,  label: '1 Analysis Credit' },
    3:  { amount: 500,  label: '3 Analysis Credits' },
    5:  { amount: 750,  label: '5 Analysis Credits' },
    10: { amount: 1250, label: '10 Analysis Credits' },
    50: { amount: 5000, label: '50 Analysis Credits' },
};

const SUBSCRIPTION_PRICES = {
    copilot:   process.env.STRIPE_PRICE_COPILOT,
    autopilot: process.env.STRIPE_PRICE_AUTOPILOT,
};

app.post('/api/stripe/create-checkout', async (req, res) => {
    const decoded = requireAuth(req, res);
    if (!decoded) return;

    const { type, qty, plan } = req.body;
    const appUrl = process.env.APP_URL || 'https://fantasypremierwolf.com';

    try {
        let session;

        if (type === 'credits') {
            const pack = CREDIT_PACKS[Number(qty)];
            if (!pack) return res.status(400).json({ error: 'Invalid credit quantity.' });

            session = await stripe.checkout.sessions.create({
                mode: 'payment',
                line_items: [{
                    price_data: {
                        currency: 'gbp',
                        unit_amount: pack.amount,
                        product_data: { name: pack.label, description: 'FantasyPremierWolf — credits never expire.' },
                    },
                    quantity: 1,
                }],
                custom_text: {
                    submit: { message: 'A percentage of every purchase goes towards carbon offsetting. Thank you for playing sustainably.' },
                },
                metadata: { userId: String(decoded.id), type: 'credits', qty: String(qty) },
                success_url: `${appUrl}/pricing?success=credits&qty=${qty}`,
                cancel_url:  `${appUrl}/pricing?cancelled=1`,
            });

        } else if (type === 'subscription') {
            const priceId = SUBSCRIPTION_PRICES[plan];
            if (!priceId) return res.status(400).json({ error: 'Invalid plan.' });

            session = await stripe.checkout.sessions.create({
                mode: 'subscription',
                line_items: [{ price: priceId, quantity: 1 }],
                custom_text: {
                    submit: { message: 'A percentage of every purchase goes towards carbon offsetting. Thank you for playing sustainably.' },
                },
                metadata: { userId: String(decoded.id), type: 'subscription', plan },
                success_url: `${appUrl}/pricing?success=subscription&plan=${plan}`,
                cancel_url:  `${appUrl}/pricing?cancelled=1`,
            });

        } else {
            return res.status(400).json({ error: 'Invalid checkout type.' });
        }

        res.json({ url: session.url });
    } catch (err) {
        console.error('[Stripe] Checkout error:', err.message);
        res.status(500).json({ error: 'Failed to create checkout session.' });
    }
});

app.post('/api/stripe/cancel-subscription', async (req, res) => {
    const decoded = requireAuth(req, res);
    if (!decoded) return;

    db.get('SELECT stripe_subscription_id, membership_tier FROM users WHERE id = ?', [decoded.id], async (err, row) => {
        if (err || !row) return res.status(500).json({ error: 'Failed to fetch user.' });
        if (!row.stripe_subscription_id) return res.status(400).json({ error: 'No active subscription found.' });
        if (row.membership_tier <= 1) return res.status(400).json({ error: 'No active subscription to cancel.' });

        try {
            await stripe.subscriptions.cancel(row.stripe_subscription_id);
            db.run('UPDATE users SET membership_tier = 1, stripe_subscription_id = NULL, subscription_started_at = NULL WHERE id = ?', [decoded.id], (err2) => {
                if (err2) return res.status(500).json({ error: 'Subscription cancelled with Stripe but failed to update account.' });
                console.log(`[Stripe] User ${decoded.id} cancelled subscription ${row.stripe_subscription_id}`);
                res.json({ ok: true });
            });
        } catch (err2) {
            console.error('[Stripe] Cancel error:', err2.message);
            res.status(500).json({ error: 'Failed to cancel subscription.' });
        }
    });
});

// ===========================
// AUTO-PILOT
// ===========================

const ARCHETYPE_DIRECTIVES_SERVER = {
    maverick: {
        strategy: 'High-Risk / High-Reward. Prioritise players with <10% ownership. Chase upside over safety.',
        logic: 'Ignore Effective Ownership (EO). Actively look for differential captains to swing mini-leagues. Embrace variance.',
        tone: "The Hype-Man. Energetic, bold, and slightly rebellious. Use phrases like \"Fortune favors the bold.\"",
        captain: 'Prefer a differential captain (ownership <15%) where credible. If a standout player dominates goals/assists, back them — frame it as "even a Maverick knows when to take the obvious pick."',
        hitRule: 'This manager embraces hits. A -4 or even -8 is on the table if the EV case is strong. However in auto-pilot mode, be conservative — only recommend a hit if EV gain is very clear.',
    },
    spreadsheet: {
        strategy: 'Data-Driven / EV Focused. Prioritise xG, xA, and 5-week fixture difficulty (FDR).',
        logic: 'Ignore form if underlying stats are good. Use Expected Value (EV) to justify hits. Trust the model above all else.',
        tone: 'The Analyst. Cold, calculated, and precise. Use terminology like "statistically significant" and "regression to the mean."',
        captain: 'Justify captain pick with xG, xA, and fixture data. Let the stats speak.',
        hitRule: 'Only recommend a hit if EV clearly supports it. Show the maths. In auto-pilot, require minimum +8pt EV gain above free transfer alternative.',
    },
    template: {
        strategy: 'Low-Risk / Rank Protection. Prioritise players with >40% ownership.',
        logic: 'Follow the pack. Avoid points hits unless 2+ players are red-flagged.',
        tone: 'The Guardian. Protective, cautious, and steady.',
        captain: 'Lean toward the high-ownership, in-form captain to protect rank.',
        hitRule: 'Strongly avoid hits. Only recommend if 2+ players are injured/suspended with no bench cover.',
    },
    kneejerk: {
        strategy: 'Form-Chasing / Reactive. Prioritise top scorers from the last two weeks.',
        logic: 'Focus on price rises and immediate momentum. Move fast.',
        tone: "The Scout. Urgent, fast-paced, and opportunistic.",
        captain: 'Back whoever is in the best form right now.',
        hitRule: 'Hits acceptable to chase in-form players. In auto-pilot, only if strong EV case.',
    },
    eyetest: {
        strategy: 'Intuition / Tactical. Prioritise role on the pitch and visual form.',
        logic: 'Focus on Out of Position (OOP) assets. Trust the vibe over the numbers.',
        tone: 'The Tactician. Observant, insightful, and old-school.',
        captain: 'Back whoever looked most dangerous on the pitch recently.',
        hitRule: 'Consider hits only for players clearly out of favour visually. Must have tactical justification.',
    },
};

function buildServerWolfPrompt(bootstrapData, picksData, entryData, historyData, transfersAvailable, fixtures, availableChips, managerDna, recentTransferHistory, nextGw) {
    const getPlayer = (id) => bootstrapData.elements.find(e => e.id === id);
    const getTeam = (id) => bootstrapData.teams.find(t => t.id === id);

    const teamName = entryData.name;
    const managerName = `${entryData.player_first_name} ${entryData.player_last_name}`;
    const latestHistory = historyData?.current?.[historyData.current.length - 1];
    const overallRank = latestHistory?.overall_rank ?? 0;
    const totalPoints = latestHistory?.total_points ?? 0;
    const gwPoints = latestHistory?.points ?? 0;
    const bank = (entryData.last_deadline_bank ?? 0) / 10;

    // Multi-GW fixture lookup
    const gwRange = [nextGw, nextGw + 1, nextGw + 2, nextGw + 3].filter(gw => gw <= 38);
    const fixtureByTeamGw = {};
    for (const fix of fixtures) {
        const gw = fix.event ?? nextGw;
        const homeTeam = getTeam(fix.team_h);
        const awayTeam = getTeam(fix.team_a);
        if (!fixtureByTeamGw[fix.team_h]) fixtureByTeamGw[fix.team_h] = {};
        if (!fixtureByTeamGw[fix.team_a]) fixtureByTeamGw[fix.team_a] = {};
        if (!fixtureByTeamGw[fix.team_h][gw]) fixtureByTeamGw[fix.team_h][gw] = [];
        if (!fixtureByTeamGw[fix.team_a][gw]) fixtureByTeamGw[fix.team_a][gw] = [];
        fixtureByTeamGw[fix.team_h][gw].push(`vs ${awayTeam?.short_name ?? '?'} (H) FDR:${fix.team_h_difficulty}`);
        fixtureByTeamGw[fix.team_a][gw].push(`vs ${homeTeam?.short_name ?? '?'} (A) FDR:${fix.team_a_difficulty}`);
    }

    // DGW/BGW schedule
    const scheduleLines = [];
    for (const gw of gwRange) {
        const dgwTeams = [], bgwTeams = [];
        for (const team of bootstrapData.teams) {
            const gwFix = fixtureByTeamGw[team.id]?.[gw] ?? [];
            if (gwFix.length === 0) bgwTeams.push(team.short_name);
            else if (gwFix.length >= 2) dgwTeams.push(`${team.short_name}(${gwFix.join(', ')})`);
        }
        const dgwNote = dgwTeams.length > 0 ? ` 🟢 DGW: ${dgwTeams.join(' | ')}` : '';
        const bgwNote = bgwTeams.length > 0 ? ` 🔴 BGW: ${bgwTeams.join(', ')}` : '';
        scheduleLines.push(dgwNote || bgwNote ? `GW${gw}:${dgwNote}${bgwNote}` : `GW${gw}: All teams play`);
    }
    const fixtureScheduleContext = `**FIXTURE SCHEDULE — NEXT 4 GWs:**\n${scheduleLines.join('\n')}\n\n⚠️ DGW: bringing in DGW players now is often worth a transfer. ⚠️ BGW: blanking players score 0 — flag if 5+ starters blank.`;

    // Squad
    const myPlayers = picksData.picks.map(p => {
        const player = getPlayer(p.element);
        const team = player ? getTeam(player.team) : null;
        if (!player || !team) return null;
        const multiFixture = gwRange.map(gw => {
            const gwFix = fixtureByTeamGw[player.team]?.[gw] ?? [];
            if (gwFix.length === 0) return `GW${gw}:BLANK`;
            if (gwFix.length >= 2) return `GW${gw}:DGW(${gwFix.join(' & ')})`;
            return `GW${gw}:${gwFix[0]}`;
        }).join(' | ');
        return {
            name: player.web_name,
            team: team.short_name,
            position: ['?', 'GKP', 'DEF', 'MID', 'FWD'][player.element_type],
            squad_pos: p.position <= 11 ? `XI #${p.position}` : `Bench #${p.position - 11}`,
            is_captain: p.is_captain,
            is_vice_captain: p.is_vice_captain,
            cost: player.now_cost / 10,
            form: player.form,
            ep_next: player.ep_next,
            last_gw_pts: player.event_points,
            ownership: player.selected_by_percent,
            fixtures: multiFixture,
            status: player.status === 'a' ? 'Available' : player.status === 'd' ? 'Doubtful' : player.status === 'i' ? 'Injured' : player.status,
        };
    }).filter(Boolean);

    // Club distribution
    const squadClubCount = {};
    for (const p of picksData.picks) {
        const player = getPlayer(p.element);
        if (player) squadClubCount[player.team] = (squadClubCount[player.team] ?? 0) + 1;
    }
    const squadClubSummary = Object.entries(squadClubCount)
        .sort(([, a], [, b]) => b - a)
        .map(([teamId, count]) => {
            const t = getTeam(Number(teamId))?.short_name ?? `Team${teamId}`;
            return `${t}: ${count}${count >= 3 ? ' ← AT LIMIT (max 3)' : ''}`;
        }).join(', ');

    const squadElementIds = new Set(picksData.picks.map(p => p.element));

    // Top buy targets
    const topMarketTargets = bootstrapData.elements
        .filter(p => !squadElementIds.has(p.id) && p.status !== 'u' && p.status !== 'i')
        .sort((a, b) => parseFloat(b.ep_next) - parseFloat(a.ep_next))
        .slice(0, 20)
        .map(p => {
            const ownedFromClub = squadClubCount[p.team] ?? 0;
            const clubBlocked = ownedFromClub >= 3 ? ' ⛔ BLOCKED' : ownedFromClub === 2 ? ' ⚠️ CAUTION (2/3)' : '';
            const multiFixture = gwRange.map(gw => {
                const gwFix = fixtureByTeamGw[p.team]?.[gw] ?? [];
                if (gwFix.length === 0) return `GW${gw}:BLANK`;
                if (gwFix.length >= 2) return `GW${gw}:DGW(${gwFix.join(' & ')})`;
                return `GW${gw}:${gwFix[0]}`;
            }).join(' | ');
            return {
                name: p.web_name,
                team: getTeam(p.team)?.short_name || '?',
                pos: ['?', 'GKP', 'DEF', 'MID', 'FWD'][p.element_type],
                cost: p.now_cost / 10,
                ep_next: p.ep_next,
                form: p.form,
                fixtures: multiFixture,
                ownership: p.selected_by_percent,
                club_rule: ownedFromClub === 0 ? 'OK' : `${ownedFromClub}/3 owned${clubBlocked}`,
                sentiment: `+${p.transfers_in_event.toLocaleString()} in / -${p.transfers_out_event.toLocaleString()} out this GW`,
            };
        });

    const chipNameMap = { wildcard: 'Wildcard', freehit: 'Free Hit', bboost: 'Bench Boost', '3xc': 'Triple Captain' };
    const chipsUsedNames = historyData?.chips?.map(c => chipNameMap[c.name] || c.name).join(', ') || 'None';
    const availableChipNames = availableChips.map(c => chipNameMap[c] || c).join(', ') || 'None remaining';

    const gwsPlayed = historyData?.current?.length ?? 0;
    const totalHitCost = historyData?.current?.reduce((sum, gw) => sum + (gw.event_transfers_cost ?? 0), 0) ?? 0;
    const totalHitsTaken = totalHitCost / 4;
    const hitFrequency = gwsPlayed > 0 ? (totalHitsTaken / gwsPlayed).toFixed(2) : '0.00';
    const historyContext = gwsPlayed > 0
        ? `This manager has taken ${totalHitsTaken} hit(s) across ${gwsPlayed} GWs (${hitFrequency} hits/GW average).`
        : 'No seasonal history yet.';

    let toneInstruction = '';
    if (overallRank === 0) toneInstruction = 'TONE: WELCOMING. Brand new team. Be encouraging.';
    else if (overallRank < 10000) toneInstruction = 'TONE: ELITE RESPECT. Top 10k. Professional and concise.';
    else if (overallRank < 100000) toneInstruction = 'TONE: ENCOURAGING BUT FIRM. Top 100k.';
    else if (overallRank < 1000000) toneInstruction = 'TONE: STANDARD WOLF BANTER. Sarcastic but helpful.';
    else toneInstruction = 'TONE: ROAST MODE. Rank >1M. Be ruthless but give useful tips.';

    let rankUrgency = '';
    if (overallRank === 0) rankUrgency = 'RANK CONTEXT: New team. Play safe — no hits, no chips unless exceptional.';
    else if (overallRank < 100000) rankUrgency = `RANK CONTEXT: Elite (${overallRank.toLocaleString()}). Protect position. Only Wildcard if 5+ XI players have FDR ≥ 4.`;
    else if (overallRank < 1000000) rankUrgency = `RANK CONTEXT: Good rank (${overallRank.toLocaleString()}). Standard thresholds. Wildcard if 5+ XI have FDR ≥ 4 or 4+ injured.`;
    else if (overallRank < 5000000) rankUrgency = `RANK CONTEXT: Poor rank (${overallRank.toLocaleString()}). Be more aggressive. Lower Wildcard threshold to 4+ weak players. Hits acceptable with clear EV.`;
    else rankUrgency = `RANK CONTEXT: DISASTER ZONE (${overallRank.toLocaleString()}). Wildcard is the default if available. Maximum hits justified by EV.`;

    const recentTransferContext = recentTransferHistory.length > 0 ? `**RECENT TRANSFER HISTORY:**\n${recentTransferHistory.slice(0, 12).map(t => {
        const pIn = getPlayer(t.element_in);
        const pOut = getPlayer(t.element_out);
        return `  GW${t.event}: ${pOut?.web_name ?? t.element_out} OUT → ${pIn?.web_name ?? t.element_in} IN`;
    }).join('\n')}\n\n` : '';

    const activeChip = picksData.active_chip ?? null;

    return `
You are the **Fantasy Premier Wolf** — an elite FPL strategist with zero tolerance for bad decisions AND zero tolerance for unnecessary tinkering.
Analyse this team and produce a verdict for GW${nextGw}. A "no changes needed" recommendation is valid and correct when the squad is well-structured.
${toneInstruction}

⚠️ **AUTO-PILOT MODE — CRITICAL**: This analysis was triggered automatically. The manager is NOT online to review it. Your recommendation WILL be executed immediately without any human review. Therefore:
- Be CONSERVATIVE on multi-hit strategies — the manager cannot intervene if something goes wrong
- Prefer FREE TRANSFERS over hits. Only recommend a hit if EV gain is extremely clear (minimum +8pts above free transfer alternative)
- Prefer SAFE CAPTAIN picks (high ownership, in-form, good fixture) — not differentials
- When in doubt, recommend holding the squad

**MANAGER:**
- Team: ${teamName} | Manager: ${managerName}
- Overall Rank: ${overallRank.toLocaleString()} | Total Points: ${totalPoints} | GW Points: ${gwPoints}

**CURRENT SQUAD (positions 1-11 = starting XI, 12-15 = bench):**
${JSON.stringify(myPlayers, null, 2)}

**SQUAD CLUB DISTRIBUTION (3-per-club rule):**
${squadClubSummary}

**FINANCES:**
- Bank: £${bank}m
- Free Transfers Available: ${transfersAvailable}
- Chips Used: ${chipsUsedNames}
- **Chips Available: ${availableChipNames}**
${activeChip === 'wildcard' ? `\n🃏 **WILDCARD ACTIVE** — ALL transfers are FREE. chip in JSON must be "wildcard".\n` : ''}
${activeChip === 'freehit' ? `\n🎯 **FREE HIT ACTIVE** — ALL transfers FREE this GW only. Optimise purely for this week. chip in JSON must be "freehit".\n` : ''}

**TOP BUY TARGETS (not in squad, sorted by ep_next):**
${JSON.stringify(topMarketTargets, null, 2)}

${fixtureScheduleContext}

${managerDna && ARCHETYPE_DIRECTIVES_SERVER[managerDna] ? `**MANAGER DNA: ${managerDna.toUpperCase()}**
- Strategy: ${ARCHETYPE_DIRECTIVES_SERVER[managerDna].strategy}
- Logic: ${ARCHETYPE_DIRECTIVES_SERVER[managerDna].logic}
- Captain: ${ARCHETYPE_DIRECTIVES_SERVER[managerDna].captain}
- Hit Rule (override with auto-pilot conservatism): ${ARCHETYPE_DIRECTIVES_SERVER[managerDna].hitRule}
- ${historyContext}` : `**SEASONAL HIT PATTERN**: ${historyContext}`}

**LANGUAGE: No profanity, slurs, or offensive language.**

${recentTransferContext}**MANDATORY RULES:**
1. **Budget**: [buy_price] ≤ [sell_price of outgoing] + [bank]. Update bank after each transfer.
2. **Position Match**: GKP→GKP, DEF→DEF, MID→MID, FWD→FWD only.
3. **Squad Legality**: max 3 from same club, 2 GKP, 5 DEF, 5 MID, 3 FWD after all transfers.
4. **Blank GWs**: Do NOT buy a player with "BLANK" fixture unless using Free Hit.
5. **AUTO-PILOT HIT RULE**: Do NOT recommend a hit unless EV gain ≥ +8pts above free transfer alternative. Conservative plan strongly preferred.
6. **Feasibility**: Every recommended player MUST appear in TOP BUY TARGETS.

${rankUrgency}

**OUTPUT FORMAT:**

## 🧠 REASONING SUMMARY
4–6 bullets covering key factors.

## 🐺 THE WOLF'S VERDICT
2-3 sentence roast/praise calibrated to rank.

## 📋 THE PLAN
- **Transfers**: list swaps as "[OUT] (£Xm) → [IN] (£Xm)". If no transfers: "No transfers".
- **Hits taken**: X (-Xpts)
- **Bank after**: £Xm
- **Chip**: [name] OR None
- **Captain**: [Name] | **Vice-Captain**: [Name]
- **Why this captain**: one line
- **Bench order**: [1st sub] → [2nd sub] → [3rd sub]

## 🔍 PLAYER BREAKDOWN
For each transfer: Floor / Ceiling / Risk

## ⚠️ RISKS
Key risks with this plan.

## ✅ POSITION VERIFICATION
Count transfers by position before JSON. Must balance.

---WOLF_PLAN_JSON---
Output ONE line of JSON only:
{"transfers":[{"out_name":"EXACT_WEB_NAME","in_name":"EXACT_WEB_NAME","sell_price":0.0,"buy_price":0.0}],"chip":null,"captain":"EXACT_WEB_NAME","vice_captain":"EXACT_WEB_NAME","hits_taken":0,"bank_after":0.0,"bench_order":["BENCH_1","BENCH_2","BENCH_3"]}
Rules: EXACT web_name values. chip: null/"wildcard"/"freehit"/"bboost"/"3xc". bench_order: 3 outfield bench web_names (not GK). Empty transfers [] is valid when squad needs no changes.
---END_WOLF_PLAN---
`;
}

function parseWolfPlan(text) {
    const planStart = text.indexOf('---WOLF_PLAN_JSON---');
    const planEnd = text.indexOf('---END_WOLF_PLAN---');
    if (planStart !== -1 && planEnd !== -1) {
        try {
            const between = text.slice(planStart + '---WOLF_PLAN_JSON---'.length, planEnd);
            const clean = between.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').replace(/\n\s*/g, ' ').trim();
            const obj = JSON.parse(clean);
            if (obj && Array.isArray(obj.transfers)) return obj;
        } catch {}
    }
    // Fallback: find last {...} with "transfers"
    const lastBrace = text.lastIndexOf('}');
    if (lastBrace !== -1) {
        const transfersIdx = text.lastIndexOf('"transfers"', lastBrace);
        if (transfersIdx !== -1) {
            let openBrace = -1;
            for (let i = transfersIdx - 1; i >= 0; i--) {
                if (text[i] === '{') { openBrace = i; break; }
            }
            if (openBrace !== -1) {
                try {
                    const clean = text.slice(openBrace, lastBrace + 1).replace(/\n\s*/g, ' ').trim();
                    const obj = JSON.parse(clean);
                    if (obj && Array.isArray(obj.transfers)) return obj;
                } catch {}
            }
        }
    }
    return null;
}

async function executeWolfPlanServerSide(entryId, fplToken, wolfPlan, bootstrapData, picksData, nextGwId) {
    const fplHeaders = {
        'Authorization': `Bearer ${fplToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Origin': 'https://fantasy.premierleague.com',
        'Referer': 'https://fantasy.premierleague.com/',
    };

    const TRANSFER_CHIPS = ['wildcard', 'freehit', 'bboost'];
    const MY_TEAM_CHIPS = ['3xc'];
    const rawChip = wolfPlan.chip ? wolfPlan.chip.toLowerCase() : null;
    const currentActiveChip = picksData?.active_chip || null;
    const transfersChip = TRANSFER_CHIPS.includes(currentActiveChip ?? '') ? currentActiveChip
        : TRANSFER_CHIPS.includes(rawChip ?? '') ? rawChip : null;
    const myTeamChip = MY_TEAM_CHIPS.includes(rawChip ?? '') ? rawChip : null;

    let validTransfers = [];
    const skippedReasons = [];

    if (wolfPlan.transfers.length > 0 || transfersChip) {
        // Fetch live team for accurate selling prices
        let sellingPriceMap = {};
        try {
            const liveRes = await fetch(`https://fantasy.premierleague.com/api/my-team/${entryId}/`, { headers: fplHeaders });
            if (liveRes.ok) {
                const liveData = await liveRes.json();
                for (const p of (liveData.picks || [])) {
                    if (p.element && p.selling_price != null) sellingPriceMap[p.element] = p.selling_price;
                }
            }
        } catch {}

        const squadElementIds = new Set(picksData.picks.map(p => p.element));
        const squadClubCount = {};
        for (const p of picksData.picks) {
            const pl = bootstrapData.elements.find(e => e.id === p.element);
            if (pl) squadClubCount[pl.team] = (squadClubCount[pl.team] ?? 0) + 1;
        }

        const resolvedTransfers = wolfPlan.transfers.map(t => {
            const outPlayer = bootstrapData.elements.find(e => e.web_name === t.out_name && squadElementIds.has(e.id))
                ?? bootstrapData.elements.find(e => e.web_name === t.out_name);
            const inPlayer = bootstrapData.elements.find(e => e.web_name === t.in_name && !squadElementIds.has(e.id))
                ?? bootstrapData.elements.find(e => e.web_name === t.in_name);
            if (!outPlayer || !inPlayer) return null;
            const actualSellPrice = sellingPriceMap[outPlayer.id] ?? Math.round((t.sell_price ?? 0) * 10);
            return {
                element_in: inPlayer.id, element_out: outPlayer.id,
                purchase_price: inPlayer.now_cost, selling_price: actualSellPrice,
                type_in: inPlayer.element_type, type_out: outPlayer.element_type,
                team_in: inPlayer.team, team_out: outPlayer.team,
            };
        }).filter(Boolean);

        // Re-pair by position
        const outByPos = {}, inByPos = {};
        for (const t of resolvedTransfers) {
            if (!outByPos[t.type_out]) outByPos[t.type_out] = [];
            if (!inByPos[t.type_in]) inByPos[t.type_in] = [];
            outByPos[t.type_out].push(t);
            inByPos[t.type_in].push(t);
        }
        const chosenInIds = new Set(resolvedTransfers.map(t => t.element_in));
        const squadState = new Set(squadElementIds);
        const repairedTransfers = [];
        const allPositions = new Set([...Object.keys(outByPos), ...Object.keys(inByPos)].map(Number));
        const posLabel = ['?', 'GKP', 'DEF', 'MID', 'FWD'];
        for (const pos of allPositions) {
            const outs = outByPos[pos] ?? [];
            let ins = [...(inByPos[pos] ?? [])];
            while (ins.length < outs.length) {
                const substitute = bootstrapData.elements
                    .filter(e => e.element_type === pos && e.status !== 'u' && !squadState.has(e.id) && !chosenInIds.has(e.id))
                    .sort((a, b) => parseFloat(b.ep_next) - parseFloat(a.ep_next))[0];
                if (!substitute) break;
                chosenInIds.add(substitute.id);
                const base = outs[ins.length];
                ins.push({ ...base, element_in: substitute.id, purchase_price: substitute.now_cost, team_in: substitute.team, type_in: pos });
            }
            const pairCount = Math.min(outs.length, ins.length);
            for (let i = 0; i < pairCount; i++) {
                repairedTransfers.push({ ...outs[i], element_in: ins[i].element_in, purchase_price: ins[i].purchase_price, team_in: ins[i].team_in, type_in: pos });
            }
            for (let i = pairCount; i < outs.length; i++) {
                const outName = bootstrapData.elements.find(e => e.id === outs[i].element_out)?.web_name ?? String(outs[i].element_out);
                skippedReasons.push(`${outName}: no valid ${posLabel[pos] ?? 'position'} replacement`);
            }
        }

        // Validate
        const clubCount = { ...squadClubCount };
        const allOutIds = new Set(repairedTransfers.map(t => t.element_out));
        for (const t of repairedTransfers) {
            const outName = bootstrapData.elements.find(e => e.id === t.element_out)?.web_name ?? String(t.element_out);
            const inName = bootstrapData.elements.find(e => e.id === t.element_in)?.web_name ?? String(t.element_in);
            if (!squadState.has(t.element_out)) { skippedReasons.push(`${outName} not in squad`); continue; }
            if (squadState.has(t.element_in)) { skippedReasons.push(`${inName} already in squad`); continue; }
            if (allOutIds.has(t.element_in)) { skippedReasons.push(`Circular: ${inName}`); continue; }
            if (Number(t.type_in) !== Number(t.type_out)) { skippedReasons.push(`${outName}→${inName}: position mismatch`); continue; }
            if ((clubCount[Number(t.team_in)] ?? 0) + 1 > 3) { skippedReasons.push(`${inName}: club limit`); continue; }
            validTransfers.push({ element_in: t.element_in, element_out: t.element_out, purchase_price: t.purchase_price, selling_price: t.selling_price });
            squadState.delete(t.element_out);
            squadState.add(t.element_in);
            clubCount[t.team_out] = Math.max(0, (clubCount[t.team_out] ?? 1) - 1);
            clubCount[t.team_in] = (clubCount[t.team_in] ?? 0) + 1;
        }

        if (skippedReasons.length > 0) {
            return { success: false, message: `Transfers invalid: ${skippedReasons.join('; ')}`, skipped: skippedReasons };
        }

        if (validTransfers.length > 0 || transfersChip) {
            const transferPayload = { confirmed: true, transfers: validTransfers, chip: transfersChip, entry: entryId, event: nextGwId };
            const res = await fetch('https://fantasy.premierleague.com/api/transfers/', {
                method: 'POST', headers: fplHeaders, body: JSON.stringify(transferPayload),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                const msg = err.detail || err.non_field_errors?.[0] || err.error || `Transfer failed (${res.status})`;
                return { success: false, message: `FPL transfer error: ${msg}` };
            }
        }
    }

    // Update captain/VC/bench via my-team
    const liveTeamRes = await fetch(`https://fantasy.premierleague.com/api/my-team/${entryId}/`, { headers: fplHeaders });
    if (!liveTeamRes.ok) return { success: false, message: 'Could not fetch updated team for captain update' };
    const liveTeamData = await liveTeamRes.json();

    const captainPlayer = bootstrapData.elements.find(e => e.web_name === wolfPlan.captain);
    const vcPlayer = bootstrapData.elements.find(e => e.web_name === wolfPlan.vice_captain);

    let positionMap = {};
    if (wolfPlan.bench_order && wolfPlan.bench_order.length >= 3) {
        const benchGk = liveTeamData.picks?.find(p => p.position === 15);
        const outfieldBench = liveTeamData.picks?.filter(p => p.position >= 12 && p.position <= 14) ?? [];
        wolfPlan.bench_order.slice(0, 3).forEach((webName, i) => {
            const player = bootstrapData.elements.find(e => e.web_name === webName);
            const pick = player ? outfieldBench.find(p => p.element === player.id) : null;
            if (pick) positionMap[pick.element] = 12 + i;
        });
        let fallbackPos = 12;
        for (const p of outfieldBench) {
            if (!positionMap[p.element]) {
                while (Object.values(positionMap).includes(fallbackPos)) fallbackPos++;
                positionMap[p.element] = fallbackPos++;
            }
        }
        if (benchGk) positionMap[benchGk.element] = 15;
    }

    const myTeamPicks = (liveTeamData.picks || []).map(p => ({
        element: p.element,
        position: positionMap[p.element] ?? p.position,
        is_captain: captainPlayer ? p.element === captainPlayer.id : p.is_captain,
        is_vice_captain: vcPlayer ? p.element === vcPlayer.id : p.is_vice_captain,
    }));

    const teamRes = await fetch(`https://fantasy.premierleague.com/api/my-team/${entryId}/`, {
        method: 'POST', headers: fplHeaders, body: JSON.stringify({ picks: myTeamPicks, chip: myTeamChip }),
    });
    if (!teamRes.ok) {
        const err = await teamRes.json().catch(() => ({}));
        return { success: false, message: `Captain update failed: ${err.detail || err.error || teamRes.status}` };
    }

    const transferSummary = wolfPlan.transfers.length > 0
        ? wolfPlan.transfers.map(t => `${t.out_name} → ${t.in_name}`).join(', ')
        : 'No transfers';
    return { success: true, message: `${transferSummary}. Captain: ${wolfPlan.captain}.` };
}

let _puppeteerBrowser = null;
async function getPuppeteerBrowser() {
    if (!_puppeteerBrowser || !_puppeteerBrowser.connected) {
        const puppeteer = require('puppeteer');
        _puppeteerBrowser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        });
    }
    return _puppeteerBrowser;
}

async function generateAnalysisPDF(analysisText, userName, teamName, gameweek) {
    const browser = await getPuppeteerBrowser();
    const page = await browser.newPage();
    const htmlContent = analysisText
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{font-family:'Segoe UI',Arial,sans-serif;color:#e2e8f0;margin:0;padding:0;background:#0f172a;}
.header{background:linear-gradient(135deg,#0f172a,#1e293b);padding:32px 40px;border-bottom:2px solid #00ff87;}
.header h1{margin:0 0 4px;font-size:24px;color:#00ff87;font-weight:900;}
.header .sub{color:#64748b;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;}
.meta{margin-top:16px;display:flex;gap:12px;flex-wrap:wrap;}
.meta span{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);padding:5px 12px;border-radius:8px;font-size:12px;color:#cbd5e1;font-weight:600;}
.badge{background:#00ff87;color:#0f172a;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:900;text-transform:uppercase;margin-left:4px;}
.content{padding:28px 40px;line-height:1.8;font-size:13px;color:#cbd5e1;}
h2{color:#00ff87;font-size:15px;font-weight:800;margin:26px 0 10px;padding-bottom:6px;border-bottom:1px solid rgba(0,255,135,0.25);}
strong{font-weight:700;color:#f1f5f9;}li{margin:4px 0;color:#cbd5e1;}p{margin:8px 0;}
.footer{margin-top:32px;padding:14px 40px;background:#0a0f1e;border-top:1px solid rgba(255,255,255,0.06);font-size:11px;color:#475569;display:flex;justify-content:space-between;}
</style></head><body>
<div class="header"><div class="sub">Auto-Pilot Analysis</div><h1>🐺 FantasyPremierWolf</h1>
<div class="meta"><span>👤 ${userName}</span><span>⚽ ${teamName}</span><span>📅 GW${gameweek}</span><span>🤖 Auto-Pilot<span class="badge">Executed</span></span></div></div>
<div class="content"><p>${htmlContent}</p></div>
<div class="footer"><span>Generated by FantasyPremierWolf Auto-Pilot • ${new Date().toLocaleString('en-GB')}</span><span>fantasypremierwolf.com</span></div>
</body></html>`;
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } });
    await page.close();
    return pdf;
}

async function sendAutopilotEmail(email, displayName, teamName, gameweek, analysisText, pdfBuffer, executionResult) {
    const verdictMatch = analysisText.match(/## 🐺 THE WOLF'S VERDICT\s*([\s\S]*?)(?=##|---)/);
    const planMatch = analysisText.match(/## 📋 THE PLAN\s*([\s\S]*?)(?=##|---)/);
    const verdictText = verdictMatch ? verdictMatch[1].trim().slice(0, 400).replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
    const planText = planMatch ? planMatch[1].trim().slice(0, 500).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') : '';
    const statusBadge = executionResult.success
        ? `<span style="background:#00ff87;color:#0f172a;padding:3px 12px;border-radius:20px;font-weight:900;font-size:12px;">✓ EXECUTED</span>`
        : `<span style="background:#ef4444;color:white;padding:3px 12px;border-radius:20px;font-weight:900;font-size:12px;">⚠ FAILED</span>`;
    const attachments = pdfBuffer ? [{ filename: `wolf-gw${gameweek}-${teamName.replace(/\s+/g, '-')}.pdf`, content: Buffer.from(pdfBuffer).toString('base64'), type: 'application/pdf' }] : [];

    await resend.emails.send({
        from: 'The Wolf <thewolf@fantasypremierwolf.com>',
        to: email,
        subject: `🐺 Auto-Pilot: GW${gameweek} — ${teamName}`,
        html: `<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f172a;color:#e2e8f0;border-radius:16px;overflow:hidden;">
<div style="background:linear-gradient(135deg,#0f172a,#1e293b);padding:28px 32px;border-bottom:1px solid rgba(255,255,255,0.08);">
  <div style="color:#00ff87;font-size:11px;font-weight:900;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:6px;">Auto-Pilot Report</div>
  <h1 style="margin:0;color:white;font-size:22px;font-weight:900;">🐺 GW${gameweek} Analysis Complete</h1>
  <p style="margin:8px 0 0;color:#94a3b8;font-size:13px;">Hi <strong style="color:#e2e8f0;">${displayName}</strong> — The Wolf has analysed <strong style="color:#e2e8f0;">${teamName}</strong> and made your moves.</p>
</div>
<div style="padding:24px 32px;">
  <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:14px 18px;margin-bottom:18px;display:flex;align-items:center;justify-content:space-between;">
    <span style="color:#94a3b8;font-size:13px;font-weight:600;">Execution Status</span>${statusBadge}
  </div>
  ${!executionResult.success ? `<div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);border-radius:10px;padding:14px 18px;margin-bottom:18px;"><p style="margin:0;color:#fca5a5;font-size:13px;">⚠️ ${(executionResult.message || 'The plan could not be executed. Please log in and check your team.').replace(/</g, '&lt;')}</p></div>` : ''}
  ${verdictText ? `<h3 style="color:#00ff87;font-size:12px;font-weight:900;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 8px;">The Wolf's Verdict</h3><p style="color:#cbd5e1;font-size:13px;line-height:1.6;margin:0 0 18px;">${verdictText}</p>` : ''}
  ${planText ? `<h3 style="color:#00ff87;font-size:12px;font-weight:900;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 8px;">The Plan</h3><div style="color:#cbd5e1;font-size:13px;line-height:1.8;margin:0 0 18px;">${planText}</div>` : ''}
  <p style="color:#64748b;font-size:12px;margin:20px 0 0;padding-top:16px;border-top:1px solid rgba(255,255,255,0.05);">Full analysis attached as PDF. Manage Auto-pilot at <a href="https://fantasypremierwolf.com/autopilot" style="color:#00ff87;">fantasypremierwolf.com/autopilot</a>.</p>
</div></div>`,
        attachments,
    });
}

async function runAutopilotForUser(user, bootstrapData, nextGw) {
    console.log(`[Autopilot] Processing user ${user.id} (${user.displayname})`);
    try {
        // 1. Get FPL token
        const fplToken = await getValidFplToken(user.id, user);
        if (!fplToken) {
            console.warn(`[Autopilot] User ${user.id}: no valid FPL token — skipping`);
            return;
        }
        const fplHeaders = {
            'Authorization': `Bearer ${fplToken}`,
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json',
            'Origin': 'https://fantasy.premierleague.com',
            'Referer': 'https://fantasy.premierleague.com/',
        };

        // 2. Fetch team, entry, history, fixtures, transfers in parallel
        const [teamRes, entryRes, historyRes, transfersRes] = await Promise.all([
            fetch(`https://fantasy.premierleague.com/api/my-team/${user.fpl_entry_id}/`, { headers: fplHeaders }),
            fetch(`https://fantasy.premierleague.com/api/entry/${user.fpl_entry_id}/`),
            fetch(`https://fantasy.premierleague.com/api/entry/${user.fpl_entry_id}/history/`),
            fetch(`https://fantasy.premierleague.com/api/entry/${user.fpl_entry_id}/transfers/`),
        ]);

        if (!teamRes.ok) throw new Error(`Failed to fetch team: ${teamRes.status}`);
        const [teamData, entryData, historyData, transfersData] = await Promise.all([
            teamRes.json(), entryRes.json(), historyRes.json(), transfersRes.json(),
        ]);

        // 3. Fetch fixtures for next 4 GWs
        const fixtureGws = [nextGw, nextGw + 1, nextGw + 2, nextGw + 3].filter(gw => gw <= 38);
        const fixtureArrays = await Promise.all(
            fixtureGws.map(gw => fetch(`https://fantasy.premierleague.com/api/fixtures/?event=${gw}`)
                .then(r => r.json()).then(data => (Array.isArray(data) ? data : []).map(f => ({ ...f, event: gw }))).catch(() => []))
        );
        const fixtures = fixtureArrays.flat();

        // 4. Build picksData from my-team response
        const picksData = {
            picks: teamData.picks || [],
            active_chip: teamData.transfers?.active_chip ?? null,
            entry_history: (() => {
                const latest = historyData?.current?.[historyData.current.length - 1];
                return latest
                    ? { event: latest.event, overall_rank: latest.overall_rank, total_points: latest.total_points, points: latest.points }
                    : { event: nextGw - 1, overall_rank: 0, total_points: 0, points: 0 };
            })(),
        };

        // 5. Calculate free transfers
        const transfersAvailable = Math.max(0, (teamData.transfers?.limit ?? 1) - (teamData.transfers?.made ?? 0));

        // 6. Available chips
        const usedChipNames = (historyData?.chips || []).map(c => c.name);
        const wcEvents = (historyData?.chips || []).filter(c => c.name === 'wildcard').map(c => c.event);
        // FPL gives two wildcards: first half (GW1–20) and second half (GW21–38).
        // A wildcard played in GW>20 is the second-half one — no more wildcards after that.
        // A wildcard played in GW<=20 was first-half; second-half still available if current GW>20.
        const firstHalfWcUsed = wcEvents.some(e => e <= 20);
        const secondHalfWcUsed = wcEvents.some(e => e > 20);
        const wildcardAvailable = nextGw <= 20
            ? !firstHalfWcUsed                        // still in first half
            : !secondHalfWcUsed;                      // in second half — only matters if 2nd WC unused
        const availableChips = ['wildcard', 'freehit', 'bboost', '3xc'].filter(c => {
            if (c === 'wildcard') return wildcardAvailable;
            return !usedChipNames.includes(c);
        });

        // 7. Race-condition credit check & deduction
        const creditOk = await new Promise((resolve) => {
            db.get('SELECT credits FROM users WHERE id = ?', [user.id], (err, row) => {
                if (err || !row || row.credits < 1) return resolve(false);
                db.run('UPDATE users SET credits = credits - 1 WHERE id = ?', [user.id], err2 => resolve(!err2));
            });
        });
        if (!creditOk) {
            console.warn(`[Autopilot] User ${user.id}: no credits — skipping`);
            return;
        }

        // 8. Build prompt & call Claude
        const recentTransferHistory = Array.isArray(transfersData) ? transfersData.slice(0, 12) : [];
        const prompt = buildServerWolfPrompt(bootstrapData, picksData, entryData, historyData, transfersAvailable, fixtures, availableChips, user.manager_dna, recentTransferHistory, nextGw);

        const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
        const aiProvider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
        let analysisText;

        if (aiProvider === 'gemini') {
            const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
            if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');
            const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 16000 } }),
            });
            if (!gRes.ok) { db.run('UPDATE users SET credits = credits + 1 WHERE id = ?', [user.id], () => {}); throw new Error(`Gemini error: ${gRes.status}`); }
            const gData = await gRes.json();
            analysisText = gData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        } else {
            if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set');
            const cRes = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
                body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 16000, temperature: 0.7, messages: [{ role: 'user', content: prompt }] }),
            });
            if (!cRes.ok) { db.run('UPDATE users SET credits = credits + 1 WHERE id = ?', [user.id], () => {}); throw new Error(`Claude error: ${cRes.status}`); }
            const cData = await cRes.json();
            analysisText = cData?.content?.[0]?.text ?? '';
        }

        if (!analysisText) throw new Error('Empty response from AI');

        // 9. Parse & execute plan
        const wolfPlan = parseWolfPlan(analysisText);
        let executionResult = { success: false, message: 'Could not parse plan from AI response' };
        if (wolfPlan) {
            executionResult = await executeWolfPlanServerSide(user.fpl_entry_id, fplToken, wolfPlan, bootstrapData, picksData, nextGw);
        }

        // 10. Mark GW as processed
        db.run('UPDATE users SET autopilot_last_gw = ? WHERE id = ?', [nextGw, user.id], () => {});

        // 11. Save analysis to history
        db.run('INSERT INTO analyses (user_id, team_name, entry_id, gameweek, analysis_text, ai_provider) VALUES (?,?,?,?,?,?)',
            [user.id, entryData.name, user.fpl_entry_id, nextGw, analysisText, aiProvider], () => {});

        // 12. Generate PDF (non-fatal if fails)
        let pdfBuffer = null;
        try {
            pdfBuffer = await generateAnalysisPDF(analysisText, user.displayname, entryData.name, nextGw);
        } catch (pdfErr) {
            console.warn(`[Autopilot] PDF failed for user ${user.id}:`, pdfErr.message);
        }

        // 13. Send email
        await sendAutopilotEmail(user.email, user.displayname, entryData.name, nextGw, analysisText, pdfBuffer, executionResult);

        console.log(`[Autopilot] Done for user ${user.id}: ${executionResult.success ? 'SUCCESS' : 'FAIL — ' + executionResult.message}`);

    } catch (err) {
        console.error(`[Autopilot] Error for user ${user.id}:`, err.message);
    }
}

// GET membership tiers (prices from DB)
app.get('/api/tiers', (req, res) => {
    db.all('SELECT id, name, description, monthly_credits, price_gbp FROM tiers WHERE active = 1 ORDER BY id', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// GET autopilot status
app.get('/api/user/autopilot', (req, res) => {
    const decoded = requireAuth(req, res);
    if (!decoded) return;
    db.get('SELECT membership_tier, credits, autopilot_enabled, autopilot_last_gw, fpl_entry_id, fpl_session FROM users WHERE id = ?', [decoded.id], (err, row) => {
        if (err || !row) return res.status(500).json({ error: 'Failed to get autopilot status' });
        const base = {
            autopilot_enabled: !!row.autopilot_enabled,
            autopilot_last_gw: row.autopilot_last_gw ?? 0,
            credits: row.credits ?? 0,
            membership_tier: row.membership_tier ?? 1,
            fpl_connected: !!(row.fpl_session && row.fpl_entry_id),
            fpl_entry_id: row.fpl_entry_id ?? null,
            connected_team_name: null,
        };
        if (!row.fpl_entry_id) return res.json(base);
        db.get("SELECT name FROM saved_teams WHERE user_id = ? AND json_extract(team_data, '$.entry_id') = ? LIMIT 1",
            [decoded.id, row.fpl_entry_id], (err2, teamRow) => {
                base.connected_team_name = teamRow?.name?.replace(/\s*\(GW\d+\)$/, '') ?? null;
                res.json(base);
            }
        );
    });
});

// POST toggle autopilot
app.post('/api/user/autopilot', (req, res) => {
    const decoded = requireAuth(req, res);
    if (!decoded) return;
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'enabled (boolean) required' });
    db.get('SELECT membership_tier FROM users WHERE id = ?', [decoded.id], (err, row) => {
        if (err || !row) return res.status(500).json({ error: 'User not found' });
        if ((row.membership_tier ?? 1) < 3) return res.status(403).json({ error: 'Auto-pilot requires the Auto-Pilot tier.' });
        db.run('UPDATE users SET autopilot_enabled = ? WHERE id = ?', [enabled ? 1 : 0, decoded.id], err2 => {
            if (err2) return res.status(500).json({ error: 'Failed to update autopilot' });
            res.json({ autopilot_enabled: enabled });
        });
    });
});

function initAutopilot() {
    const cron = require('node-cron');
    let autopilotRunningForGw = 0; // in-memory lock to prevent double-runs

    cron.schedule('*/30 * * * *', async () => {
        try {
            // Fetch bootstrap to find next deadline
            const bsRes = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/');
            if (!bsRes.ok) return;
            const bootstrapData = await bsRes.json();

            const nextEvent = bootstrapData.events?.find(e => e.is_next);
            if (!nextEvent?.deadline_time) return;

            const deadlineMs = new Date(nextEvent.deadline_time).getTime();
            const nowMs = Date.now();
            const hoursUntilDeadline = (deadlineMs - nowMs) / (1000 * 60 * 60);

            // Run if deadline is between 10 minutes and 6 hours away, and not already run for this GW
            if (hoursUntilDeadline < 0.17 || hoursUntilDeadline > 6) return;
            if (autopilotRunningForGw === nextEvent.id) return;

            console.log(`[Autopilot] Triggering for GW${nextEvent.id} — ${hoursUntilDeadline.toFixed(1)}h until deadline`);
            autopilotRunningForGw = nextEvent.id;

            // Get eligible users: tier 3, autopilot on, credits ≥ 1, FPL connected, not yet run this GW
            const users = await new Promise((resolve) => {
                db.all(`SELECT id, displayname, email, manager_dna, fpl_entry_id, fpl_session, fpl_refresh_token, fpl_expires_at
                        FROM users
                        WHERE membership_tier >= 3
                          AND autopilot_enabled = 1
                          AND credits >= 1
                          AND fpl_entry_id IS NOT NULL
                          AND fpl_session IS NOT NULL
                          AND (autopilot_last_gw IS NULL OR autopilot_last_gw < ?)
                          AND active = 1`,
                    [nextEvent.id],
                    (err, rows) => resolve(err ? [] : rows)
                );
            });

            if (users.length === 0) {
                console.log(`[Autopilot] No eligible users for GW${nextEvent.id}`);
                return;
            }

            console.log(`[Autopilot] ${users.length} users to process for GW${nextEvent.id}`);

            // Process in batches of 20
            const BATCH_SIZE = 20;
            for (let i = 0; i < users.length; i += BATCH_SIZE) {
                const batch = users.slice(i, i + BATCH_SIZE);
                await Promise.all(batch.map(user => runAutopilotForUser(user, bootstrapData, nextEvent.id)));
                console.log(`[Autopilot] Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(users.length / BATCH_SIZE)} complete`);
            }

            console.log(`[Autopilot] GW${nextEvent.id} complete — ${users.length} users processed`);

        } catch (err) {
            console.error('[Autopilot] Cron error:', err.message);
        }
    });

    console.log('[Autopilot] Scheduled — checks every 30 minutes, triggers 6h before deadline');
}

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

// Fallback: Serve React App (Production) — must be LAST
if (process.env.NODE_ENV === 'production') {
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
}

const { initScheduler } = require('./server/scheduler.cjs');

// Initialize Scheduler
initScheduler();
initAutopilot();

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
