// Draws the app icons as pixel art and writes them to icons/. Run with:  node tools/make-icons.js   (no installs needed)
// One 32 x 32 picture (a cream pawn on a plum chequerboard) is scaled up with hard pixel edges. The pawn stays inside
// the middle 80% so phones can crop the icon to a circle or rounded square ("maskable") without cutting it.
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const out = path.join(__dirname, '..', 'icons');

const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const COL = {
  light: hex('#4e3270'), lightDark: hex('#3e2760'), dark: hex('#2c1c44'), darkDark: hex('#221636'), shadow: hex('#170f26'), ink: hex('#0d0a1c'),
  piece: hex('#f7ead2'), pieceLit: hex('#fff4dd'), pieceDark: hex('#d9c7a8'), pieceShade: hex('#b09a7a'),
};
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const dither = (x, y, t) => t > (BAYER[y & 3][x & 3] + 0.5) / 16;   // true on roughly a fraction t of pixels

const N = 32, CX = 16;
// the pawn's half-width on a row (grid pixels), or 0 where the row isn't part of it; py is the row's middle
function half(px, py) {
  const head = 4.3, hy = 9.2;
  if (Math.abs(py - hy) <= head) { const w = Math.sqrt(head * head - (py - hy) ** 2); if (Math.abs(px - CX) <= w) return w; }
  if (py >= 13.5 && py < 15.3) return 4.6;                                  // collar
  if (py >= 15.3 && py < 21.5) return 2.4 + 2.8 * ((py - 15.3) / 6.2) ** 1.6;   // body, flaring out
  if (py >= 21.5 && py < 23) return 6;                                      // lip of the base
  if (py >= 23 && py < 25.5) return 7;                                      // base
  return 0;
}
const inside = (x, y) => { const w = half(x + 0.5, y + 0.5); return w > 0 && Math.abs(x + 0.5 - CX) <= w; };

function pixel(x, y) {
  const px = x + 0.5, py = y + 0.5;
  if (inside(x, y)) {
    // lit from the top left: the head as a ball, the rest as a turned shape lit across each row
    let light;
    if (py < 13.5) light = (-(px - CX) - (py - 9.2)) / (1.414 * 4.3);
    else light = -(px - CX) / half(px, py) * 0.9 - (py > 23 ? 0.15 : 0);
    if (Math.hypot(px - 14.4, py - 7.6) < 1.2) return COL.pieceLit;
    if (light > 0.45) return dither(x, y, (light - 0.45) * 3) ? COL.pieceLit : COL.piece;
    if (light < -0.6) return dither(x, y, (-0.6 - light) * 4) ? COL.pieceShade : COL.pieceDark;
    if (light < -0.2) return dither(x, y, (-0.2 - light) * 3) ? COL.pieceDark : COL.piece;
    return COL.piece;
  }
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (inside(x + dx, y + dy)) return COL.ink;   // the game's dark outline
  if (inside(x - 1, y - 1) || inside(x - 2, y - 1) || (inside(x - 2, y - 2) && y > 20)) return COL.shadow;   // a shadow to the lower right
  const sq = ((x >> 3) + (y >> 3)) & 1;                                     // 8 x 8 squares
  const edge = Math.hypot(px - 16, py - 16) / 22.6;                          // darker towards the corners, dithered like the game
  const dk = dither(x, y, (edge - 0.45) * 1.8);
  return sq ? (dk ? COL.darkDark : COL.dark) : (dk ? COL.lightDark : COL.light);
}

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = buf => { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size) {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;                     // filter: none
    for (let x = 0; x < size; x++) {
      const c = pixel(Math.floor(x * N / size), Math.floor(y * N / size));
      raw.set(c, y * (size * 3 + 1) + 1 + x * 3);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2;                          // 8 bits per channel, RGB
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

fs.mkdirSync(out, { recursive: true });
for (const [name, size] of [['favicon-32.png', 32], ['icon-192.png', 192], ['icon-512.png', 512]]) {
  fs.writeFileSync(path.join(out, name), png(size));
  console.log(`Wrote icons/${name} (${size} x ${size})`);
}
