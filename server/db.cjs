const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = 'T:\\My Drive\\FPL\\db\\users.db';

// Ensure DB file exists (sqlite3 creates it, but good to be explicit about location)
console.log(`[DB] Connecting to database at ${DB_PATH}`);

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('[DB] Connection error:', err.message);
    } else {
        console.log('[DB] Connected to the users database.');
        // WAL mode allows concurrent reads alongside writes
        db.run('PRAGMA journal_mode=WAL');
        // Wait up to 5s instead of immediately returning SQLITE_BUSY
        db.run('PRAGMA busy_timeout=5000');
        initDb();
    }
});

function initDb() {
    db.serialize(() => {
        // Users Table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            displayname TEXT,
            email TEXT UNIQUE,
            password_hash TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) console.error('[DB] Error creating users table:', err.message);
            else {
                console.log('[DB] Users table ready.');
                // Migration: Add email column if it doesn't exist (for existing DBs)
                db.run("ALTER TABLE users ADD COLUMN email TEXT UNIQUE", (err) => {
                    // Ignore error if column already exists
                    if (!err) console.log('[DB] Added email column to users table.');
                });
            }
        });

        // Saved Teams Table
        // team_data will be a JSON string of the team structure
        db.run(`CREATE TABLE IF NOT EXISTS saved_teams (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            name TEXT,
            team_data TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`, (err) => {
            if (err) console.error('[DB] Error creating saved_teams table:', err.message);
            else console.log('[DB] Saved teams table ready.');
        });

        // Past Analyses Table
        db.run(`CREATE TABLE IF NOT EXISTS analyses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            team_name TEXT,
            entry_id INTEGER,
            gameweek INTEGER,
            analysis_text TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`, (err) => {
            if (err) console.error('[DB] Error creating analyses table:', err.message);
            else console.log('[DB] Analyses table ready.');
        });

        // Cached Lineups Table — stores the last live lineup per user+entry
        db.run(`CREATE TABLE IF NOT EXISTS cached_lineups (
            user_id INTEGER NOT NULL,
            entry_id INTEGER NOT NULL,
            picks_data TEXT NOT NULL,
            gameweek INTEGER,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, entry_id),
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`, (err) => {
            if (err) console.error('[DB] Error creating cached_lineups table:', err.message);
            else console.log('[DB] Cached lineups table ready.');
        });

        // Migration: Add FPL session columns
        db.run("ALTER TABLE users ADD COLUMN fpl_session TEXT", () => {});
        db.run("ALTER TABLE users ADD COLUMN fpl_entry_id INTEGER", () => {});
        db.run("ALTER TABLE users ADD COLUMN fpl_refresh_token TEXT", () => {});
        db.run("ALTER TABLE users ADD COLUMN fpl_expires_at INTEGER", () => {});

        // Migration: Email verification
        db.run("ALTER TABLE users ADD COLUMN is_verified INTEGER DEFAULT 0", () => {});
        db.run("ALTER TABLE users ADD COLUMN email_token TEXT", () => {});

        // Migration: Membership tier (1=Scout, 2=Co-Pilot, 3=Autopilot)
        db.run("ALTER TABLE users ADD COLUMN membership_tier INTEGER DEFAULT 1", () => {});

        // Migration: Analysis credits
        db.run("ALTER TABLE users ADD COLUMN credits INTEGER DEFAULT 1", () => {});
        db.run("UPDATE users SET credits = 1 WHERE credits IS NULL", () => {});

        // Migration: Subscription start date and Stripe subscription ID
        db.run("ALTER TABLE users ADD COLUMN subscription_started_at TEXT", () => {});
        db.run("ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT", () => {});

        // Migration: Manager DNA archetype
        db.run("ALTER TABLE users ADD COLUMN manager_dna TEXT", () => {});

        // Migration: Auto-pilot
        db.run("ALTER TABLE users ADD COLUMN autopilot_enabled INTEGER DEFAULT 0", () => {});
        db.run("ALTER TABLE users ADD COLUMN autopilot_last_gw INTEGER DEFAULT 0", () => {});
        // Existing users are considered verified
        db.run("UPDATE users SET is_verified = 1 WHERE is_verified IS NULL OR is_verified = 0 AND email_token IS NULL", () => {});

        // Migration: active flag — recreate table to drop email UNIQUE constraint,
        // replace with partial unique index (unique email only when active = 1)
        db.get("SELECT COUNT(*) as count FROM pragma_table_info('users') WHERE name='active'", (err, row) => {
            if (err || row?.count > 0) return; // already migrated
            console.log('[DB] Migrating: adding active column and replacing email unique constraint...');
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                db.run(`CREATE TABLE users_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    displayname TEXT,
                    email TEXT,
                    password_hash TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    fpl_session TEXT,
                    fpl_entry_id INTEGER,
                    fpl_refresh_token TEXT,
                    fpl_expires_at INTEGER,
                    is_verified INTEGER DEFAULT 0,
                    email_token TEXT,
                    membership_tier INTEGER DEFAULT 1,
                    credits INTEGER DEFAULT 1,
                    manager_dna TEXT,
                    active INTEGER DEFAULT 1
                )`);
                db.run(`INSERT INTO users_new SELECT
                    id, displayname, email, password_hash, created_at,
                    fpl_session, fpl_entry_id, fpl_refresh_token, fpl_expires_at,
                    is_verified, email_token, membership_tier, credits, manager_dna, 1
                    FROM users`);
                db.run('DROP TABLE users');
                db.run('ALTER TABLE users_new RENAME TO users');
                db.run('CREATE UNIQUE INDEX idx_users_active_email ON users(email) WHERE active = 1');
                db.run('COMMIT', (err) => {
                    if (err) {
                        console.error('[DB] Migration failed:', err.message);
                        db.run('ROLLBACK');
                    } else {
                        console.log('[DB] active column migration complete.');
                    }
                });
            });
        });

        // TV Broadcast Cache Table — stores full event result per event+country
        // Drop old per-fixture schema if it exists, then recreate
        db.run(`DROP TABLE IF EXISTS tv_cache`, () => {
            db.run(`CREATE TABLE IF NOT EXISTS tv_cache (
                event_id INTEGER NOT NULL,
                country_code TEXT NOT NULL,
                result_json TEXT NOT NULL,
                fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (event_id, country_code)
            )`, (err) => {
                if (err) console.error('[DB] Error creating tv_cache table:', err.message);
                else console.log('[DB] TV cache table ready.');
            });
        });

        // FPL Free Credit Tracking — one free credit per unique FPL manager ID
        db.run(`CREATE TABLE IF NOT EXISTS fpl_free_credits (
            fpl_entry_id INTEGER PRIMARY KEY,
            awarded_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) console.error('[DB] Error creating fpl_free_credits table:', err.message);
            else console.log('[DB] FPL free credits tracking table ready.');
        });

        // Migration: new users start with 0 credits (free credit awarded on FPL link, not sign-up)
        db.run("UPDATE users SET credits = 0 WHERE credits = 1 AND fpl_entry_id IS NULL", () => {});

        // Tier Definitions Table
        db.run(`CREATE TABLE IF NOT EXISTS tiers (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            monthly_credits INTEGER NOT NULL DEFAULT 0,
            price_gbp REAL NOT NULL DEFAULT 0.0,
            active INTEGER NOT NULL DEFAULT 1
        )`, (err) => {
            if (err) { console.error('[DB] Error creating tiers table:', err.message); return; }
            console.log('[DB] Tiers table ready.');
            // Seed default tiers (INSERT OR IGNORE so reruns are safe)
            const seed = [
                [1, 'Free',       'Basic access — 1 analysis credit to get started.',                          1,  0.0],
                [2, 'Co-Pilot',  'Monthly credits and full AI analysis to guide your FPL decisions.',         30,  3.99],
                [3, 'Auto-Pilot','Maximum credits, priority analysis, and early access to new features.',    100,  7.99],
            ];
            const stmt = db.prepare('INSERT OR IGNORE INTO tiers (id, name, description, monthly_credits, price_gbp) VALUES (?, ?, ?, ?, ?)');
            seed.forEach(row => stmt.run(row));
            stmt.finalize();
        });

        // News Articles Table
        db.run(`CREATE TABLE IF NOT EXISTS articles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            url TEXT UNIQUE,
            summary TEXT,
            source TEXT,
            published_at DATETIME
        )`, (err) => {
            if (err) console.error('[DB] Error creating articles table:', err.message);
            else console.log('[DB] Articles table ready.');
        });
    });
}

module.exports = db;
