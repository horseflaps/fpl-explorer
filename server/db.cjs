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
