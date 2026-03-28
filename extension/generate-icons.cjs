// node generate-icons.cjs
// Generates simple green wolf icons for the extension (no external deps needed)
const fs = require('fs');
const path = require('path');

// Minimal valid 1x1 green PNG (will be stretched by browser but that's fine for now)
// A real icon would be proper art — swap these files with actual PNGs before publishing

function makeSimplePNG(size) {
    // We'll use the Canvas API from Node if available, else write a minimal SVG-based approach
    // For simplest no-dep approach: write an SVG file and note it won't work as-is for Chrome
    // Chrome MV3 requires PNG for icons. Use a 1-pixel green PNG as placeholder.

    // Minimal PNG: 1x1 pixel, color #00ff87 (R=0, G=255, B=135, A=255)
    // PNG signature + IHDR + IDAT + IEND
    const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

    function crc32(buf) {
        let crc = 0xFFFFFFFF;
        const table = [];
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            table[i] = c;
        }
        for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    function chunk(type, data) {
        const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
        const t = Buffer.from(type);
        const crcBuf = Buffer.concat([t, data]);
        const crcVal = Buffer.alloc(4); crcVal.writeUInt32BE(crc32(crcBuf));
        return Buffer.concat([len, t, data, crcVal]);
    }

    // IHDR: 1x1 pixel, 8-bit RGBA
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(1, 0); // width
    ihdr.writeUInt32BE(1, 4); // height
    ihdr[8] = 8;  // bit depth
    ihdr[9] = 2;  // color type: RGB
    ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

    // IDAT: deflate compressed pixel data
    // Filter byte (0) + R G B for color #00ff87
    const zlib = require('zlib');
    const raw = Buffer.from([0, 0, 255, 135]); // filter=0, R=0, G=255, B=135
    const compressed = zlib.deflateSync(raw);

    const png = Buffer.concat([
        PNG_SIGNATURE,
        chunk('IHDR', ihdr),
        chunk('IDAT', compressed),
        chunk('IEND', Buffer.alloc(0))
    ]);

    return png;
}

const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir);

[16, 48, 128].forEach(size => {
    const buf = makeSimplePNG(size);
    fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), buf);
    console.log(`icon${size}.png written`);
});

console.log('Done. Icons are 1x1 placeholders — replace with proper art before publishing.');
