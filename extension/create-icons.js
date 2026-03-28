// Run this with Node to generate simple placeholder icons
// node create-icons.js
// Requires: npm install canvas (or just use any 16x16, 48x48, 128x128 PNG images)

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

function createIcon(size) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Background
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, '#00ff87');
    grad.addColorStop(1, '#00d1ff');
    ctx.fillStyle = grad;
    ctx.roundRect(0, 0, size, size, size * 0.2);
    ctx.fill();

    // Wolf emoji / text
    ctx.fillStyle = '#0f172a';
    ctx.font = `bold ${size * 0.55}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🐺', size / 2, size / 2);

    return canvas.toBuffer('image/png');
}

[16, 48, 128].forEach(size => {
    const buf = createIcon(size);
    const file = path.join(__dirname, `icons/icon${size}.png`);
    fs.writeFileSync(file, buf);
    console.log(`Created ${file}`);
});
