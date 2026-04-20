const puppeteer = require('puppeteer');
const db = require('./db.cjs');
const crypto = require('crypto');
const robotsParser = require('robots-parser');
const https = require('https');
const http = require('http');

// News Sources
const SOURCES = [
    {
        name: 'BBC Sport',
        url: 'https://www.bbc.com/sport/football/gossip',
        selector: 'p, article p, div[data-component="text-block"]',
        parser: (text) => text.trim()
    },
    {
        name: 'Sky Sports (Transfer Centre)',
        url: 'https://www.skysports.com/transfer-centre',
        selector: '.sdc-article-body p, .sdc-news-article-body--lead p, .sdc-site-tile__headline, .news-list__headline',
        parser: (text) => text.trim()
    },
    {
        name: 'NewsNow',
        url: 'https://www.newsnow.co.uk/h/Sport/Football/Gossip',
        selector: 'a.hll, .newsfeed-article-link, .newsfeed a',
        parser: (text) => text.trim()
    },
    {
        name: 'The Guardian',
        url: 'https://www.theguardian.com/football/series/rumourmill',
        selector: 'a[data-link-name="article"], h3 span, .dcr-1698686 a, article p',
        parser: (text) => text.trim()
    },
    {
        name: 'TransferFeed',
        url: 'https://www.transferfeed.com/',
        selector: '.title-link, a.title, .article-title a, .post-title, h2, h3, p',
        parser: (text) => text.trim()
    },
    {
        name: 'Premier League Transfers',
        url: 'https://www.premierleague.com/transfers',
        selector: '.transferCardWrapper p, .transferCard__playerInfo, .player__name, .transferCard__clubName, p',
        parser: (text) => text.trim()
    },
    {
        name: 'FourFourTwo',
        url: 'https://www.fourfourtwo.com/features/transfer-news',
        selector: 'article p, .article-body p, .content-body p, h2, h3',
        parser: (text) => text.trim()
    },
    {
        name: 'Mirror Football',
        url: 'https://www.mirror.co.uk/sport/football/transfer-news/',
        selector: 'article p, .article-body p, .mirror-article-body p, h2, h3',
        parser: (text) => text.trim()
    },
    {
        name: 'Express Football',
        url: 'https://www.express.co.uk/sport/football/transfer-news',
        selector: 'article p, .article-text p, .text-description p, h2, h3',
        parser: (text) => text.trim()
    }
];

const slurs = require('./slurs.cjs');

const BLACKLIST = [
    'Trump', 'Starmer', 'Biden', 'Sunak', 'Parliament', 'Senate', 'White House',
    'War', 'Gaza', 'Israel', 'Ukraine', 'Russia', 'China', 'Economy', 'Inflation',
    'Stock Market', 'Election', 'Vote', 'Poll', 'Crisis', 'Epstein', 'Prince',
    'Royal', 'Climate', 'Weather', 'WWE', 'Wrestling', 'Cricket', 'T20', 'Test Match',
    'Rugby', 'F1', 'Formula 1', 'Tennis', 'Djokovic', 'Nadal', 'Murray', 'Boxing',
    'UFC', 'MMA', 'NFL', 'Super Bowl', 'NBA',
    'Gambling', 'Gamble', 'GambleAware', 'BeGambleAware', 'Gambling Therapy',
    'Responsible Gambling', 'Betting', 'Monte Carlo', 'Casino', 'Poker',
    'Odds', 'Wager', 'Bookmaker', 'Accumulator', 'Each Way',
    // War & conflict
    'Airstrike', 'Missile', 'Nuclear', 'Military', 'Troops', 'Invasion',
    'Ceasefire', 'Refugee', 'Sanctions', 'Bomb', 'Hostage', 'Kidnap',
    'Terrorist', 'Terrorism', 'Terror Attack',
    // Public tragedies
    'Shooting', 'Gunman', 'Massacre', 'Stabbing', 'Explosion', 'Disaster',
    'Earthquake', 'Tsunami', 'Wildfire', 'Flood', 'Famine', 'Genocide',
    // Racism & discrimination
    'Racist', 'Racism', 'Hate Crime', 'Antisemitic', 'Islamophobic',
    'White Supremac', 'Far Right', 'Neo-Nazi', 'Discrimination',
    // Sexism & misogyny
    'Sexist', 'Sexism', 'Misogyn', 'Sexual Harassment', 'Sexual Assault',
    'Rape', 'Domestic Abuse', 'Gender Violence',
    ...slurs,
];

function isSafeArticle(text) {
    if (!text || text.length < 20) return false;
    const lower = text.toLowerCase();
    return !BLACKLIST.some(word => lower.includes(word.toLowerCase()));
}

function pruneOldArticles() {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const dateStr = twoWeeksAgo.toISOString();

    db.run("DELETE FROM articles WHERE published_at < ?", [dateStr], function (err) {
        if (err) console.error('[Scraper] Prune error:', err.message);
        else if (this.changes > 0) console.log(`[Scraper] Pruned ${this.changes} old articles.`);
    });
}

// Map to cache txt contents
const robotsCache = new Map();

async function isAllowedByRobots(urlStr, userAgent) {
    try {
        const parsed = new URL(urlStr);
        const robotsUrl = `${parsed.protocol}//${parsed.host}/robots.txt`;
        
        let robotsTxt = robotsCache.get(robotsUrl);
        
        if (!robotsTxt) {
            robotsTxt = await new Promise((resolve) => {
                const reqLib = parsed.protocol === 'https:' ? https : http;
                const req = reqLib.get(robotsUrl, { timeout: 5000 }, (res) => {
                    if (res.statusCode !== 200) {
                        resolve('');
                        return;
                    }
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => resolve(data));
                });
                req.on('error', () => resolve(''));
                req.on('timeout', () => { req.destroy(); resolve(''); });
            });
            robotsCache.set(robotsUrl, robotsTxt);
        }

        if (!robotsTxt) return true; // If unreachable, assume allowed

        const robots = robotsParser(robotsUrl, robotsTxt);
        const isAllowed = robots.isAllowed(urlStr, userAgent);
        return isAllowed !== false; // if undefined, it's allowed
    } catch (e) {
        console.warn(`[Scraper] Could not verify robots.txt for ${urlStr}: ${e.message}`);
        return true;
    }
}

// Random delay helper
const delay = (ms) => new Promise(res => setTimeout(res, ms));

async function scrapeNews() {
    console.log('[Scraper] Starting news scrape...');
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--window-size=1920,1080'
            ]
        });
        
        const page = await browser.newPage();
        
        const customUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
        await page.setUserAgent(customUA);
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1'
        });

        // Hide webdriver
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
        });

        for (const source of SOURCES) {
            console.log(`[Scraper] Checking robots.txt for ${source.name}...`);
            const allowed = await isAllowedByRobots(source.url, customUA);
            
            if (!allowed) {
                console.log(`[Scraper] Skipping ${source.name} - Disallowed by robots.txt`);
                continue;
            }

            console.log(`[Scraper] Scraping ${source.name}...`);
            try {
                // Special handling for the index-based sources (BBC)
                if (source.name === 'BBC Sport' && source.url.includes('/gossip')) {
                    await page.goto(source.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
                    const latestUrl = await page.evaluate(() => {
                        const links = Array.from(document.querySelectorAll('a'));
                        const gossipLink = links.find(a => a.href.includes('/articles/') && a.textContent.toLowerCase().includes('gossip'));
                        return gossipLink ? gossipLink.href : null;
                    });
                    
                    if (latestUrl) {
                        console.log(`[Scraper] Found latest BBC gossip link: ${latestUrl}`);
                        await delay(2000); // polite pause
                        await page.goto(latestUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
                    }
                } else {
                    await page.goto(source.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
                }

                // Wait for SPA or dynamically loaded content (e.g. React/Vue sites)
                await delay(3000);

                // Generic text extraction
                const rawData = await page.evaluate((sel) => {
                    const elements = document.querySelectorAll(sel);
                    return Array.from(elements)
                        .map(el => el.textContent.trim())
                        .filter(t => t.length > 30);
                }, source.selector);

                console.log(`[Scraper] Found ${rawData.length} items from ${source.name}`);

                const stmt = db.prepare("INSERT OR IGNORE INTO articles (title, url, summary, source, published_at) VALUES (?, ?, ?, ?, ?)");

                let addedCount = 0;
                rawData.forEach(text => {
                    if (!isSafeArticle(text)) return;

                    text = text.replace(/\s+/g, ' ').trim();

                    const splitIndex = text.indexOf('.');
                    let title = text;
                    let summary = text;

                    if (splitIndex > 5 && splitIndex < 150) {
                        title = text.substring(0, splitIndex + 1);
                    } else if (text.length > 150) {
                        title = text.substring(0, 147) + '...';
                    }

                    const hash = crypto.createHash('md5').update(text).digest('hex');
                    const uniqueId = `${source.url}#${hash}`;

                    stmt.run(title, uniqueId, summary, source.name, new Date().toISOString());
                    addedCount++;
                });

                stmt.finalize();
                console.log(`[Scraper] Saved ${addedCount} relevant items from ${source.name}`);

                // Polite delay between domains 3 to 7 secs
                const waitTime = Math.floor(Math.random() * 4000) + 3000;
                console.log(`[Scraper] Waiting ${waitTime}ms before next source...`);
                await delay(waitTime);

            } catch (pageErr) {
                console.error(`[Scraper] Error processing ${source.name}:`, pageErr.message);
            }
        }

        pruneOldArticles();

    } catch (err) {
        console.error('[Scraper] Fatal error:', err);
    } finally {
        if (browser) {
            try {
                await browser.close();
            } catch (e) {}
        }
        console.log('[Scraper] Finished.');
    }
}

if (require.main === module) {
    scrapeNews();
}

module.exports = { scrapeNews };
