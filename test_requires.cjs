try {
    require('express');
    console.log('express OK');
    require('cors');
    console.log('cors OK');
    require('jsonwebtoken');
    console.log('jsonwebtoken OK');
    require('bcryptjs');
    console.log('bcryptjs OK');
    require('sqlite3');
    console.log('sqlite3 OK');
    require('node-cron');
    console.log('node-cron OK');
    require('puppeteer');
    console.log('puppeteer OK');
    require('robots-parser');
    console.log('robots-parser OK');
} catch (e) {
    console.error('FAILED REQUIRE:', e.message);
    process.exit(1);
}
