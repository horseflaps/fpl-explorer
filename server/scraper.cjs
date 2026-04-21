const puppeteer = require('puppeteer');
const RSSParser = require('rss-parser');
const db = require('./db.cjs');
const crypto = require('crypto');
const robotsParser = require('robots-parser');
const https = require('https');
const http = require('http');

// News Sources
// type: 'rss'       — fetched via rss-parser, fast and lightweight
// type: 'puppeteer' — fetched via headless browser, for sites with no RSS
const SOURCES = [
    {
        type: 'rss',
        name: 'BBC Sport Gossip',
        url: 'https://feeds.bbci.co.uk/sport/football/gossip/rss.xml',
    },
    {
        type: 'rss',
        name: 'Sky Sports Football',
        url: 'https://www.skysports.com/rss/12040',
    },
    {
        type: 'rss',
        name: 'The Guardian Football',
        url: 'https://www.theguardian.com/football/rss',
    },
    {
        type: 'rss',
        name: 'Mirror Football',
        url: 'https://www.mirror.co.uk/sport/football/rss.xml',
    },
    {
        type: 'rss',
        name: 'FourFourTwo',
        url: 'https://www.fourfourtwo.com/rss',
    },
    {
        type: 'rss',
        name: '90min',
        url: 'https://www.90min.com/posts.rss',
    },
    // Puppeteer fallbacks — no RSS available
    {
        type: 'puppeteer',
        name: 'NewsNow',
        url: 'https://www.newsnow.co.uk/h/Sport/Football/Gossip',
        selector: 'a.hll, .newsfeed-article-link, .newsfeed a',
        parser: (text) => text.trim()
    },
    {
        type: 'puppeteer',
        name: 'TransferFeed',
        url: 'https://www.transferfeed.com/',
        selector: '.title-link, a.title, .article-title a, .post-title, h2, h3, p',
        parser: (text) => text.trim()
    },
    {
        type: 'puppeteer',
        name: 'Premier League Transfers',
        url: 'https://www.premierleague.com/transfers',
        selector: '.transferCardWrapper p, .transferCard__playerInfo, .player__name, .transferCard__clubName, p',
        parser: (text) => text.trim()
    },
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

const FOOTBALL_KEYWORDS = [
    'football', 'soccer', 'premier league', 'championship', 'league one', 'league two',
    'transfer', 'signing', 'contract', 'loan', 'release clause', 'fee', 'deal',
    'manager', 'coach', 'head coach', 'sacked', 'appointed',
    'striker', 'midfielder', 'defender', 'goalkeeper', 'winger', 'forward',
    'squad', 'lineup', 'formation', 'starting eleven', 'bench',
    'goal', 'assist', 'hat-trick', 'clean sheet', 'penalty',
    'champions league', 'europa league', 'conference league', 'fa cup', 'carabao',
    'world cup', 'euros', 'euro 2024', 'nations league',
    'relegation', 'promotion', 'title race', 'top four', 'fixture',
    'gameweek', 'matchday', 'kick-off', 'final whistle',
    // common club references
    'arsenal', 'chelsea', 'liverpool', 'manchester', 'tottenham', 'spurs',
    'newcastle', 'aston villa', 'west ham', 'everton', 'brighton', 'brentford',
    'fulham', 'wolves', 'nottingham', 'bournemouth', 'crystal palace', 'leicester',
    'ipswich', 'southampton',
    // FPL-specific
    'fpl', 'fantasy premier league', 'fantasy football', 'gameweek',
    // common player injury/fitness terms
    'injury', 'injured', 'fitness', 'suspended', 'suspension', 'return to training',
    'doubtful', 'ruled out', 'available for selection',
];

function isFootballRelevant(text) {
    if (!text) return false;
    const lower = text.toLowerCase();
    return FOOTBALL_KEYWORDS.some(kw => lower.includes(kw));
}

function isSafeArticle(text) {
    if (!text || text.length < 20) return false;
    const lower = text.toLowerCase();
    return !BLACKLIST.some(word => lower.includes(word.toLowerCase()));
}

function stripHtml(str) {
    return (str || '').replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
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

// Map to cache robots.txt contents
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
                    if (res.statusCode !== 200) { resolve(''); return; }
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => resolve(data));
                });
                req.on('error', () => resolve(''));
                req.on('timeout', () => { req.destroy(); resolve(''); });
            });
            robotsCache.set(robotsUrl, robotsTxt);
        }

        if (!robotsTxt) return true;
        const robots = robotsParser(robotsUrl, robotsTxt);
        const isAllowed = robots.isAllowed(urlStr, userAgent);
        return isAllowed !== false;
    } catch (e) {
        console.warn(`[Scraper] Could not verify robots.txt for ${urlStr}: ${e.message}`);
        return true;
    }
}

const delay = (ms) => new Promise(res => setTimeout(res, ms));

function saveItems(items, sourceName, sourceUrl) {
    const stmt = db.prepare("INSERT OR IGNORE INTO articles (title, url, summary, source, published_at) VALUES (?, ?, ?, ?, ?)");
    let addedCount = 0;
    for (const { title, summary, id } of items) {
        const combined = `${title} ${summary}`;
        if (!isFootballRelevant(combined)) continue;
        if (!isSafeArticle(title) && !isSafeArticle(summary)) continue;
        const hash = crypto.createHash('md5').update(id || title).digest('hex');
        const uniqueId = `${sourceUrl}#${hash}`;
        stmt.run(title, uniqueId, summary, sourceName, new Date().toISOString());
        addedCount++;
    }
    stmt.finalize();
    return addedCount;
}

async function scrapeRSS(source) {
    const parser = new RSSParser({ timeout: 10000 });
    const feed = await parser.parseURL(source.url);
    const items = (feed.items || []).slice(0, 40).map(item => ({
        title: stripHtml(item.title || ''),
        summary: stripHtml(item.contentSnippet || item.content || item.title || ''),
        id: item.guid || item.link || item.title,
    })).filter(i => i.title.length > 20);
    return items;
}

async function scrapeNews() {
    console.log('[Scraper] Starting news scrape...');

    const customUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

    // --- RSS sources (no browser needed) ---
    const rssSources = SOURCES.filter(s => s.type === 'rss');
    for (const source of rssSources) {
        console.log(`[Scraper] Checking robots.txt for ${source.name}...`);
        const allowed = await isAllowedByRobots(source.url, customUA);
        if (!allowed) {
            console.log(`[Scraper] Skipping ${source.name} - Disallowed by robots.txt`);
            continue;
        }
        console.log(`[Scraper] Fetching RSS: ${source.name}...`);
        try {
            const items = await scrapeRSS(source);
            console.log(`[Scraper] Found ${items.length} items from ${source.name}`);
            const saved = saveItems(items, source.name, source.url);
            console.log(`[Scraper] Saved ${saved} relevant items from ${source.name}`);
        } catch (err) {
            console.error(`[Scraper] RSS error for ${source.name}:`, err.message);
        }
        await delay(500); // polite pause between RSS fetches
    }

    // --- Puppeteer sources (headless browser) ---
    const puppeteerSources = SOURCES.filter(s => s.type === 'puppeteer');
    if (puppeteerSources.length === 0) {
        pruneOldArticles();
        console.log('[Scraper] Finished.');
        return;
    }

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
        await page.setUserAgent(customUA);
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1'
        });
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
        });

        for (const source of puppeteerSources) {
            console.log(`[Scraper] Checking robots.txt for ${source.name}...`);
            const allowed = await isAllowedByRobots(source.url, customUA);
            if (!allowed) {
                console.log(`[Scraper] Skipping ${source.name} - Disallowed by robots.txt`);
                continue;
            }

            console.log(`[Scraper] Scraping ${source.name}...`);
            try {
                await page.goto(source.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
                await delay(3000);

                const rawData = await page.evaluate((sel) => {
                    return Array.from(document.querySelectorAll(sel))
                        .map(el => el.textContent.trim())
                        .filter(t => t.length > 30);
                }, source.selector);

                console.log(`[Scraper] Found ${rawData.length} items from ${source.name}`);

                const items = rawData.map(text => {
                    text = text.replace(/\s+/g, ' ').trim();
                    let title = text;
                    const splitIndex = text.indexOf('.');
                    if (splitIndex > 5 && splitIndex < 150) title = text.substring(0, splitIndex + 1);
                    else if (text.length > 150) title = text.substring(0, 147) + '...';
                    return { title, summary: text, id: text };
                });

                const saved = saveItems(items, source.name, source.url);
                console.log(`[Scraper] Saved ${saved} relevant items from ${source.name}`);

                const waitTime = Math.floor(Math.random() * 4000) + 3000;
                console.log(`[Scraper] Waiting ${waitTime}ms before next source...`);
                await delay(waitTime);

            } catch (pageErr) {
                console.error(`[Scraper] Error processing ${source.name}:`, pageErr.message);
            }
        }
    } catch (err) {
        console.error('[Scraper] Fatal error:', err);
    } finally {
        if (browser) {
            try { await browser.close(); } catch (e) {}
        }
    }

    pruneOldArticles();
    console.log('[Scraper] Finished.');
}

if (require.main === module) {
    scrapeNews();
}

module.exports = { scrapeNews };
