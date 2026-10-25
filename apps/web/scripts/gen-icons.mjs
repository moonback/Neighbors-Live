// Generates the PWA icons (PNG) without any image dependency: a yellow location pin with a red
// "record" dot on the app background. Run once: node apps/web/scripts/gen-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';

const BG = [11, 13, 16];
const PIN = [255, 211, 77];
const DOT = [255, 90, 79];

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

/** `scale` < 1 keeps the drawing inside the maskable safe zone. */
function icon(size, scale) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  const c = size / 2;
  const r = (size / 2) * 0.62 * scale; // pin head radius
  const tipY = c + r * 1.75; // pin tip
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x += 1) {
      const cy = c - r * 0.35;
      const dx = x + 0.5 - c;
      const dy = y + 0.5 - cy;
      const inHead = dx * dx + dy * dy <= r * r;
      // Triangle from the head down to the tip.
      const t = (y + 0.5 - cy) / (tipY - cy);
      const inTail = t >= 0 && t <= 1 && Math.abs(dx) <= r * 0.75 * (1 - t);
      const inDot = dx * dx + dy * dy <= (r * 0.42) ** 2;
      const color = inDot ? DOT : inHead || inTail ? PIN : BG;
      raw.set(color, y * (size * 3 + 1) + 1 + x * 3);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = resolve(import.meta.dirname, '../public/icons');
mkdirSync(out, { recursive: true });
for (const [name, size, scale] of [
  ['icon-192.png', 192, 0.85],
  ['icon-512.png', 512, 0.85],
  ['maskable-512.png', 512, 0.72],
  ['apple-touch-icon.png', 180, 0.85],
  ['badge-96.png', 96, 1],
]) {
  writeFileSync(resolve(out, name), icon(size, scale));
}
console.log('icons written to', out);
