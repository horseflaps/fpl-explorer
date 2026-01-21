import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createRequire } from 'module';
import path from 'path'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url);
const sqlite3 = require('sqlite3').verbose();

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'fpl-local-api',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const urlStr = req.url || '';

          if (urlStr.startsWith('/api/team-search')) {
            const urlObj = new URL(urlStr, `http://${req.headers.host || 'localhost'}`);
            const q = urlObj.searchParams.get('q');

            console.log(`[API] Searching for: ${q}`);

            if (!q || q.length < 2) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify([]));
              return;
            }

            const dbPath = path.resolve(__dirname, 'fpl.db');
            const db = new sqlite3.Database(dbPath);

            const queryCode = `
              SELECT t.team_id, t.team_name, t.manager_name
              FROM teams_fts f
              JOIN teams t ON f.rowid = t.id
              WHERE teams_fts MATCH ?
              ORDER BY rank
              LIMIT 20
            `;

            // FTS5 Prefix Search
            // "Man Cit" -> "Man* Cit*"
            // This matches "Manchester City", "Man City", etc.
            const searchQuery = q.trim().split(/\s+/).map(term => term + '*').join(' ');

            db.all(queryCode, [searchQuery], (err: any, rows: any[]) => {
              db.close();
              if (err) {
                console.error('[API] DB Error:', err);
                res.statusCode = 500;
                res.end(JSON.stringify({ error: err.message }));
              } else {
                console.log(`[API] Found ${rows.length} results`);
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(rows));
              }
            });
            return;
          }

          next();
        });
      }
    }
  ],
  server: {
    proxy: {
      '/api': {
        target: 'https://fantasy.premierleague.com',
        changeOrigin: true,
        secure: false,
        // Bypass proxy for our custom local endpoints
        bypass: (req) => {
          if (req.url?.startsWith('/api/team-search') || req.url?.startsWith('/api/wolf-analysis')) {
            return req.url;
          }
        },
      }
    }
  }
})
