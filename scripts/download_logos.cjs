const fs = require('fs');
const path = require('path');

const logos = {
    'sky': 'https://upload.wikimedia.org/wikipedia/en/8/84/Sky_Sports_logo_2020.svg',
    'tnt': 'https://upload.wikimedia.org/wikipedia/commons/7/72/TNT_Sports_logo.svg',
    'prime': 'https://upload.wikimedia.org/wikipedia/commons/1/11/Amazon_Prime_Video_logo.svg'
};

async function dl() {
    const d = path.join(__dirname, '..', 'public', 'tv');
    if (!fs.existsSync(d)) fs.mkdirSync(d, {recursive: true});
    for(const k of Object.keys(logos)) {
        const r = await fetch(logos[k], { headers: {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'} });
        if(r.ok) {
            const text = await r.text();
            fs.writeFileSync(path.join(d, k + '.svg'), text);
            console.log('Saved', k);
        } else {
            console.log('Failed', k, r.status);
        }
    }
}
dl();
