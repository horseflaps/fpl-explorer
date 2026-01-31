const cron = require('node-cron');
const { scrapeNews } = require('./scraper.cjs');

function initScheduler() {
    console.log('[Scheduler] Initializing news scraper scheduler...');

    // Run every 6 hours: 0 */6 * * *
    cron.schedule('0 */6 * * *', async () => {
        console.log('[Scheduler] Triggering scheduled news scrape...');
        try {
            await scrapeNews();
        } catch (err) {
            console.error('[Scheduler] Scheduled scrape failed:', err);
        }
    });

    console.log('[Scheduler] News scraper scheduled for every 6 hours.');

    // Optional: Run immediately on startup (or not, maybe too heavy for dev restart)
    // We'll let the user trigger it manually or wait for the schedule.
    // Actually, for the user's requirement "scrape loads... permanently", running on start is good 
    // BUT in dev mode with nodemon it might trigger too often. 
    // Let's run it once on startup if the DB is empty? 
    // For now, simpler is just schedule.
}

module.exports = { initScheduler };
