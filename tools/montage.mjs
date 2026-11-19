import sharp from 'sharp'; import { readdirSync } from 'node:fs';
const [dir, out, cols = 3, tw = 640] = process.argv.slice(2);
const files = readdirSync(dir).filter((f) => /\.(png|webp)$/.test(f)).sort();
const metas = await Promise.all(files.map((f) => sharp(`${dir}/${f}`).metadata()));
const th = Math.round((tw * metas[0].height) / metas[0].width);
const C = +cols, R = Math.ceil(files.length / C);
const comps = await Promise.all(files.map(async (f, i) => ({ input: await sharp(`${dir}/${f}`).resize(+tw, th).toBuffer(), left: (i % C) * (+tw + 4), top: Math.floor(i / C) * (th + 4) })));
await sharp({ create: { width: C * (+tw + 4), height: R * (th + 4), channels: 3, background: '#333' } }).composite(comps).png().toFile(out);
console.log(files.join(' '));
