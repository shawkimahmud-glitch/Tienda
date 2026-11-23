// Renders stills of the hero star (film/star.html) in headless Chromium.
// usage: node tools/render-star.mjs --w 780 --h 1688 --t 2.2 --out qa/star.png [--x 0 --y 0 --dive 0]
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const a = Object.fromEntries(process.argv.slice(2).reduce((r, v, i, arr) => (v.startsWith('--') ? [...r, [v.slice(2), arr[i + 1]]] : r), []));
const W = +a.w || 780, H = +a.h || 1688;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: W, height: H } });
p.on('pageerror', (e) => console.log('pageerror', e.message));
p.on('console', (m) => m.type() === 'error' && console.log('console', m.text()));
await p.goto(`http://localhost:4173/film/star.html?w=${W}&h=${H}`);
await p.waitForFunction(() => window.starReady, null, { timeout: 60000 });
await p.evaluate(([t, x, y, d]) => window.renderAt(t, x, y, d), [+a.t || 2.2, +a.x || 0, +a.y || 0, +a.dive || 0]);
const url = await p.evaluate(() => window.grab());
writeFileSync(a.out || 'qa/star.png', Buffer.from(url.split(',')[1], 'base64'));
await b.close();
console.log('saved', a.out);
