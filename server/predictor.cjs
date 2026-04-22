const db = require('./db.cjs');
const https = require('https');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(e); }
            });
        }).on('error', reject);
    });
}

function dbGet(sql, params) {
    return new Promise((resolve, reject) =>
        db.get(sql, params, (err, row) => err ? reject(err) : resolve(row))
    );
}
function dbAll(sql, params) {
    return new Promise((resolve, reject) =>
        db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []))
    );
}
function dbRun(sql, params) {
    return new Promise((resolve, reject) =>
        db.run(sql, params, function (err) { err ? reject(err) : resolve(this); })
    );
}

// ─── Pre-GW: Run player predictions ──────────────────────────────────────────

async function runPlayerPredictions() {
    console.log('[Predictor] Starting pre-GW player predictions...');
    try {
        const bootstrap = await fetchJson('https://fantasy.premierleague.com/api/bootstrap-static/');
        const currentEvent = bootstrap.events.find(e => e.is_current) || bootstrap.events.find(e => e.is_next);
        if (!currentEvent) { console.warn('[Predictor] No current/next event found.'); return; }

        const gw = currentEvent.id;

        // Check if we already ran predictions for this GW
        const existing = await dbGet('SELECT COUNT(*) as cnt FROM player_predictions WHERE gameweek = ?', [gw]);
        if (existing?.cnt > 0) {
            console.log(`[Predictor] Predictions already exist for GW${gw} — skipping.`);
            return;
        }

        const stmt = db.prepare(`INSERT OR REPLACE INTO player_predictions
            (player_id, player_name, team_id, position, gameweek, predicted_points, ep_next, form, price)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);

        let count = 0;
        for (const player of bootstrap.elements) {
            // Skip unavailable players
            if (player.status === 'u') continue;
            const cop = player.chance_of_playing_next_round ?? 100;
            if (cop === 0) continue;

            const epNext = parseFloat(player.ep_next) || 0;
            const form = parseFloat(player.form) || 0;

            // Predicted = ep_next adjusted for availability + form signal
            // ep_next already accounts for fixtures, so this is a light adjustment
            let predicted = epNext * (cop / 100);

            // Small form bonus/penalty: deviate up to ±0.3pts based on form vs season avg
            const seasonAvgPts = player.total_points / Math.max(1, bootstrap.events.filter(e => e.finished).length);
            const formDelta = (form - seasonAvgPts) * 0.1;
            predicted = Math.max(0, predicted + formDelta);
            predicted = Math.round(predicted * 10) / 10;

            stmt.run(
                player.id, player.web_name, player.team, player.element_type,
                gw, predicted, epNext, form, player.now_cost
            );
            count++;
        }

        stmt.finalize();
        console.log(`[Predictor] Stored predictions for ${count} players in GW${gw}.`);
    } catch (err) {
        console.error('[Predictor] Error running predictions:', err.message);
    }
}

// ─── Post-GW: Score predictions against actuals ───────────────────────────────

async function scoreGwPredictions() {
    console.log('[Predictor] Starting post-GW accuracy scoring...');
    try {
        const bootstrap = await fetchJson('https://fantasy.premierleague.com/api/bootstrap-static/');

        // Find the most recently finished AND fully processed GW that hasn't been scored yet.
        // data_checked = true means all fixtures are done and bonus points are finalised.
        const finishedEvents = bootstrap.events
            .filter(e => e.finished && e.data_checked)
            .sort((a, b) => b.id - a.id);
        if (!finishedEvents.length) { console.log('[Predictor] No fully processed events yet (data_checked = false).'); return; }

        for (const event of finishedEvents) {
            const gw = event.id;

            // Check if already scored
            const scored = await dbGet('SELECT COUNT(*) as cnt FROM prediction_accuracy WHERE gameweek = ?', [gw]);
            if (scored?.cnt > 0) continue; // already done

            // Check if we have predictions for this GW
            const preds = await dbAll('SELECT * FROM player_predictions WHERE gameweek = ?', [gw]);
            if (!preds.length) { console.log(`[Predictor] No predictions found for GW${gw} — skipping.`); continue; }

            console.log(`[Predictor] Scoring GW${gw} (${preds.length} predictions)...`);

            const live = await fetchJson(`https://fantasy.premierleague.com/api/event/${gw}/live/`);
            const liveMap = {};
            for (const el of live.elements) liveMap[el.id] = el.stats.total_points;

            const stmt = db.prepare(`INSERT OR REPLACE INTO prediction_accuracy
                (player_id, player_name, position, price, gameweek, predicted_points, actual_points, error, abs_error)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);

            let saved = 0;
            for (const pred of preds) {
                const actual = liveMap[pred.player_id];
                if (actual === undefined) continue;
                const error = actual - pred.predicted_points;
                stmt.run(
                    pred.player_id, pred.player_name, pred.position, pred.price,
                    gw, pred.predicted_points, actual, error, Math.abs(error)
                );
                saved++;
            }
            stmt.finalize();
            console.log(`[Predictor] GW${gw} scored: ${saved} players.`);

            // Only score the most recent unscored GW per run to avoid hammering the API
            break;
        }

        // After scoring, regenerate the bias digest
        await generateBiasDigest();

    } catch (err) {
        console.error('[Predictor] Error scoring predictions:', err.message);
    }
}

// ─── Bias Digest ──────────────────────────────────────────────────────────────

async function generateBiasDigest() {
    console.log('[Predictor] Generating bias digest...');
    try {
        const rows = await dbAll(`
            SELECT * FROM prediction_accuracy
            ORDER BY gameweek DESC
            LIMIT 500
        `, []);

        if (rows.length < 20) {
            console.log('[Predictor] Not enough accuracy data yet — skipping digest.');
            return;
        }

        // Overall stats
        const mae = rows.reduce((s, r) => s + r.abs_error, 0) / rows.length;
        const overCount = rows.filter(r => r.error < 0).length;
        const underCount = rows.filter(r => r.error > 0).length;
        const overPct = Math.round((overCount / rows.length) * 100);

        // By position
        const posNames = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' };
        const byPos = {};
        for (const r of rows) {
            if (!byPos[r.position]) byPos[r.position] = [];
            byPos[r.position].push(r.error);
        }
        const posBias = Object.entries(byPos).map(([pos, errs]) => {
            const avg = errs.reduce((s, e) => s + e, 0) / errs.length;
            return `${posNames[pos] || pos}: ${avg >= 0 ? '+' : ''}${avg.toFixed(2)}pts`;
        }).join(', ');

        // By price band
        const bands = [
            { label: '£4–6m', min: 40, max: 60 },
            { label: '£6–8m', min: 60, max: 80 },
            { label: '£8–10m', min: 80, max: 100 },
            { label: '£10m+', min: 100, max: Infinity },
        ];
        const priceBias = bands.map(b => {
            const band = rows.filter(r => r.price >= b.min && r.price < b.max);
            if (!band.length) return null;
            const avg = band.reduce((s, r) => s + r.error, 0) / band.length;
            return `${b.label}: ${avg >= 0 ? '+' : ''}${avg.toFixed(2)}pts`;
        }).filter(Boolean).join(', ');

        // Top-pick accuracy: did top 10 predicted scorers per GW actually score well?
        const gwNums = [...new Set(rows.map(r => r.gameweek))];
        let topPickHits = 0, topPickTotal = 0;
        for (const gw of gwNums) {
            const gwRows = rows.filter(r => r.gameweek === gw);
            const sorted = [...gwRows].sort((a, b) => b.predicted_points - a.predicted_points);
            const top10Ids = sorted.slice(0, 10).map(r => r.player_id);
            const gwAvg = gwRows.reduce((s, r) => s + r.actual_points, 0) / gwRows.length;
            const top10Actual = gwRows.filter(r => top10Ids.includes(r.player_id));
            const top10Avg = top10Actual.reduce((s, r) => s + r.actual_points, 0) / Math.max(1, top10Actual.length);
            if (top10Avg > gwAvg) topPickHits++;
            topPickTotal++;
        }
        const topPickAccuracy = topPickTotal > 0 ? Math.round((topPickHits / topPickTotal) * 100) : 0;

        const gwsCovered = gwNums.length;
        const digest = [
            `WOLF PREDICTION ACCURACY (last ${gwsCovered} GW${gwsCovered !== 1 ? 's' : ''}, ${rows.length} player-predictions scored):`,
            `- Overall MAE: ${mae.toFixed(2)}pts | Overestimated ${overPct}% of players, underestimated ${100 - overPct}%`,
            `- Position bias (avg error, +ve = underestimated): ${posBias}`,
            `- Price band bias: ${priceBias}`,
            `- Top-10 pick accuracy: predicted top scorers outperformed GW average in ${topPickAccuracy}% of GWs`,
            `Use this data to self-correct: if you have historically overestimated a position/price band, apply a small downward adjustment to those players when calibrating your confidence.`,
        ].join('\n');

        await dbRun(`INSERT OR REPLACE INTO wolf_insights (key, value, updated_at) VALUES (?, ?, ?)`,
            ['bias_digest', digest, new Date().toISOString()]
        );

        console.log('[Predictor] Bias digest generated and stored.');
    } catch (err) {
        console.error('[Predictor] Error generating bias digest:', err.message);
    }
}

// ─── Fetch digest for Wolf prompt ─────────────────────────────────────────────

async function getBiasDigest() {
    try {
        const row = await dbGet(`SELECT value FROM wolf_insights WHERE key = 'bias_digest'`, []);
        return row?.value || null;
    } catch {
        return null;
    }
}

if (require.main === module) {
    const cmd = process.argv[2];
    if (cmd === 'predict') runPlayerPredictions().then(() => process.exit(0));
    else if (cmd === 'score') scoreGwPredictions().then(() => process.exit(0));
    else if (cmd === 'digest') generateBiasDigest().then(() => process.exit(0));
    else { console.log('Usage: node predictor.cjs [predict|score|digest]'); process.exit(1); }
}

module.exports = { runPlayerPredictions, scoreGwPredictions, generateBiasDigest, getBiasDigest };
