import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import sqlite3 from 'sqlite3'
import path from 'path'
import url from 'url'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'fpl-local-api',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const parsedUrl = url.parse(req.url || '', true);

          if (parsedUrl.pathname === '/api/team-search') {
            const q = parsedUrl.query.q as string;
            if (!q || q.length < 2) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify([]));
              return;
            }

            const dbPath = path.resolve(__dirname, 'fpl.db');
            const db = new sqlite3.Database(dbPath);

            const queryCode = `
              SELECT team_id, team_name, manager_name, rank, total_points
              FROM teams
              WHERE team_name LIKE ? OR manager_name LIKE ?
              ORDER BY rank ASC
              LIMIT 20
            `;
            const searchTerm = `%${q}%`;

            db.all(queryCode, [searchTerm, searchTerm], (err, rows) => {
              db.close();
              if (err) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: err.message }));
              } else {
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
