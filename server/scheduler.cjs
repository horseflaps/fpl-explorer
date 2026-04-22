const cron = require('node-cron');
const { scrapeNews } = require('./scraper.cjs');
const { runPlayerPredictions, scoreGwPredictions } = require('./predictor.cjs');

function initScheduler() {
    console.log('[Scheduler] Initializing schedulers...');

    // News scrape every 6 hours
    cron.schedule('0 */6 * * *', async () => {
        console.log('[Scheduler] Triggering scheduled news scrape...');
        try {
            await scrapeNews();
        } catch (err) {
            console.error('[Scheduler] Scheduled scrape failed:', err);
        }
    });
    console.log('[Scheduler] News scraper scheduled for every 6 hours.');

    // Pre-GW predictions: daily at 09:00. Skips automatically if predictions already exist for
    // the current GW, so this is safe to run every day — it only does work when a new GW opens.
    // Running daily covers Saturday deadlines (normal GWs) and midweek deadlines equally.
    cron.schedule('0 9 * * *', async () => {
        console.log('[Scheduler] Triggering pre-GW player predictions...');
        try {
            await runPlayerPredictions();
        } catch (err) {
            console.error('[Scheduler] Player predictions failed:', err);
        }
    });
    console.log('[Scheduler] Player predictions scheduled daily at 09:00.');

    // Post-GW scoring: runs at 06:00 Tue–Fri until data_checked is true for the latest GW.
    // Most GWs are done by Tuesday, but late fixtures or VAR reviews can push bonus points to Wed/Thu.
    cron.schedule('0 6 * * 2-5', async () => {
        console.log('[Scheduler] Triggering post-GW prediction scoring...');
        try {
            await scoreGwPredictions();
        } catch (err) {
            console.error('[Scheduler] Prediction scoring failed:', err);
        }
    });
    console.log('[Scheduler] Prediction scoring scheduled for Tue–Fri 06:00 (skips if GW not yet fully processed).');
}

module.exports = { initScheduler };
