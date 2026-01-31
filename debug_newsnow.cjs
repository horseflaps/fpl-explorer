const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    console.log('Launching browser...');
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    try {
        console.log('Navigating to NewsNow...');
        await page.goto('https://www.newsnow.co.uk/h/Sport/Football/Gossip', { waitUntil: 'domcontentloaded', timeout: 30000 });

        console.log('Fetching content...');
        const html = await page.content();
        fs.writeFileSync('newsnow_debug.html', html);
        console.log('HTML saved to newsnow_debug.html');

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await browser.close();
    }
})();
