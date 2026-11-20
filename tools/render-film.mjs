// Renders film/ frame by frame in headless Chromium and writes WebP frames + a progressive pack.
// usage: node tools/render-film.mjs --w 720 --h 1280 --frames 120 --out film/out/m [--only 0,0.2,0.5] [--q 62] [--from i --to j]
// Also writes <out>/sun.json: where the sun sits in every frame (x, y, r as fractions, T, visible).
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const W = +args.w || 1280, H = +args.h || 720, N = +args.frames || 120, out = args.out || 'film/out/test', Q = +args.q || 62;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('console', (m) => m.type() === 'error' && console.log('console:', m.text()));
page.on('pageerror', (e) => console.log('pageerror:', e.message));
await page.goto(`http://localhost:4173/film/${args.page || ''}?w=${W}&h=${H}`);
await page.waitForFunction(() => window.filmReady, null, { timeout: 120000 });
await page.evaluate(() => window.filmReady);
const all = args.only ? args.only.split(',').map(Number) : Array.from({ length: N }, (_, i) => i / (N - 1));
const i0 = +args.from || 0, i1 = args.to != null ? +args.to : all.length - 1;
const ts = all.slice(i0, i1 + 1);
const sun = [];
const t0 = Date.now();
for (let i = 0; i < ts.length; i++) {
  await page.evaluate((t) => window.renderFrame(t), ts[i]);
  const si = await page.evaluate(() => window.sunInfo());
  sun.push([+si.x.toFixed(4), +si.y.toFixed(4), +si.r.toFixed(4), +si.T.toFixed(3), si.vis]);
  const url = await page.evaluate(() => window.grab());
  const png = Buffer.from(url.split(',')[1], 'base64');
  const name = args.only ? `t${String(ts[i]).replace('.', '_')}` : String(i0 + i).padStart(3, '0');
  if (args.only) writeFileSync(`${out}/${name}.png`, png);
  else await sharp(png).webp({ quality: Q, effort: 6, smartSubsample: true }).toFile(`${out}/${name}.webp`);
  if (i % 10 === 0) console.log(`frame ${i + 1}/${ts.length} ${((Date.now() - t0) / (i + 1) / 1000).toFixed(1)}s/frame`);
}
if (!args.only) writeFileSync(`${out}/sun-${i0}-${i1}.json`, JSON.stringify({ frames: all.length, from: i0, sun }));
await browser.close();
