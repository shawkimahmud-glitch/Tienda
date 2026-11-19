// Packs a WebP frame folder into one progressive file: coarse frames first, then the gaps.
// Format: "FEPK" | u16 count | u16 width | u16 height | (u16 index | u32 bytes | data)*
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
const [dir, out] = process.argv.slice(2);
const files = readdirSync(dir).filter((f) => f.endsWith('.webp')).sort();
const N = files.length;
const { width, height } = await sharp(`${dir}/${files[0]}`).metadata();
const order = [], seen = new Set();
for (let s = 32; s >= 1; s >>= 1) for (let i = 0; i < N; i += s) if (!seen.has(i)) { seen.add(i); order.push(i); }
if (!seen.has(N - 1)) order.splice(1, 0, N - 1);
const parts = [];
const head = Buffer.alloc(10); head.write('FEPK', 0); head.writeUInt16LE(N, 4); head.writeUInt16LE(width, 6); head.writeUInt16LE(height, 8); parts.push(head);
let total = 0;
for (const i of order) { const d = readFileSync(`${dir}/${files[i]}`); const h = Buffer.alloc(6); h.writeUInt16LE(i, 0); h.writeUInt32LE(d.length, 2); parts.push(h, d); total += d.length; }
writeFileSync(out, Buffer.concat(parts));
console.log(out, N, 'frames', width + 'x' + height, (total / 1024 / 1024).toFixed(2) + ' MB', 'first 16 frames:', (order.slice(0, 16).reduce((a, i) => a + readFileSync(`${dir}/${files[i]}`).length, 0) / 1024).toFixed(0) + ' KB');
