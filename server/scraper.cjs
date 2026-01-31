const puppeteer = require('puppeteer');
const db = require('./db.cjs');
const crypto = require('crypto');

// News Sources
const SOURCES = [
    {
        name: 'BBC Sport',
        url: 'https://www.bbc.com/sport/football/gossip',
        selector: '[data-component="text-block"]',
        parser: (text) => text.trim()
    },
    {
        name: 'Sky Sports',
        url: 'https://www.skysports.com/football/transfer-paper-talk',
        selector: '.sdc-article-body p',
        parser: (text) => text.trim()
    },
    {
        name: 'NewsNow',
        url: 'https://www.newsnow.co.uk/h/Sport/Football/Gossip',
        selector: '.newsfeed a.hll',
        parser: (text) => text.trim()
    },
    {
        name: 'The Guardian',
        url: 'https://www.theguardian.com/football/series/rumourmill',
        selector: 'a.u-faux-block-link__overlay',
        parser: (text) => text.trim()
    },
    {
        name: 'SportsMole',
        url: 'https://www.sportsmole.co.uk/football/premier-league/',
        selector: '.sm-news-title a',
        parser: (text) => text.trim()
    },
    {
        name: 'Football Transfer League',
        url: 'https://www.footballtransferleague.co.uk/football_rumours',
        selector: '.rumour_text',
        parser: (text) => text.trim()
    },
    {
        name: 'TransferFeed',
        url: 'https://www.transferfeed.com/',
        selector: '.title-link',
        parser: (text) => text.trim()
    }
];

// Keywords to exclude non-football/spam content
const BLACKLIST = [
    'Trump', 'Starmer', 'Biden', 'Sunak', 'Parliament', 'Senate', 'White House',
    'War', 'Gaza', 'Israel', 'Ukraine', 'Russia', 'China', 'Economy', 'Inflation',
    'Stock Market', 'Election', 'Vote', 'Poll', 'Crisis', 'Epstein', 'Prince',
    'Royal', 'Climate', 'Weather', 'WWE', 'Wrestling', 'Cricket', 'T20', 'Test Match',
    'Rugby', 'F1', 'Formula 1', 'Tennis', 'Djokovic', 'Nadal', 'Murray', 'Boxing',
    'UFC', 'MMA', 'NFL', 'Super Bowl', 'NBA'
];

function isSafeArticle(text) {
    const lower = text.toLowerCase();
    return !BLACKLIST.some(word => lower.includes(word.toLowerCase()));
}

// Helper to clean old articles (retention policy: 14 days)
function pruneOldArticles() {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const dateStr = twoWeeksAgo.toISOString();

    db.run("DELETE FROM articles WHERE published_at < ?", [dateStr], function (err) {
        if (err) console.error('[Scraper] Prune error:', err.message);
        else if (this.changes > 0) console.log(`[Scraper] Pruned ${this.changes} old articles.`);
    });
}

async function scrapeNews() {
    console.log('[Scraper] Starting news scrape...');
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        for (const source of SOURCES) {
            console.log(`[Scraper] Scraping ${source.name}...`);
            try {
                await page.goto(source.url, { waitUntil: 'domcontentloaded', timeout: 30000 });

                // Get text content based on selector
                const rawData = await page.evaluate((sel) => {
                    const elements = document.querySelectorAll(sel);
                    return Array.from(elements).map(el => el.textContent).filter(t => t.length > 20);
                }, source.selector);

                console.log(`[Scraper] Found ${rawData.length} items from ${source.name}`);

                // Store in DB
                const stmt = db.prepare("INSERT OR IGNORE INTO articles (title, url, summary, source, published_at) VALUES (?, ?, ?, ?, ?)");

                let addedCount = 0;
                rawData.forEach(text => {
                    // Filter out non-football/blacklist items
                    if (!isSafeArticle(text)) {
                        return;
                    }

                    // Basic heuristic: First sentence is title, rest is summary
                    const splitIndex = text.indexOf('.');
                    let title = text;
                    let summary = text;

                    if (splitIndex > 5 && splitIndex < 100) {
                        title = text.substring(0, splitIndex + 1);
                        summary = text;
                    } else if (text.length > 100) {
                        title = text.substring(0, 97) + '...';
                    }

                    // Use MD5 hash for unique ID
                    const hash = crypto.createHash('md5').update(text).digest('hex');
                    const uniqueId = `${source.url}#${hash}`;

                    stmt.run(title, uniqueId, summary, source.name, new Date().toISOString());
                    addedCount++;
                });

                stmt.finalize();
                console.log(`[Scraper] Saved ${addedCount} relevant items from ${source.name}`);

            } catch (pageErr) {
                console.error(`[Scraper] Error processing ${source.name}:`, pageErr.message);
            }
        }

        pruneOldArticles();

    } catch (err) {
        console.error('[Scraper] Fatal error:', err);
    } finally {
        if (browser) await browser.close();
        console.log('[Scraper] Finished.');
    }
}

// Allow standalone run
if (require.main === module) {
    scrapeNews();
}

module.exports = { scrapeNews };
