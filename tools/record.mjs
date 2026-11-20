// Records a smooth scroll through the whole home as a video (mobile 390 / desktop 1440).
// usage: node tools/record.mjs <page> <mobile|desktop> <out.mp4> [--seconds 40]
import { chromium, devices } from 'playwright';
import { mkdtempSync, readdirSync, renameSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const [pg = 'dist/prod.html', kind = 'mobile', out = 'scroll.mp4', ...rest] = process.argv.slice(2);
const secs = +(rest[rest.indexOf('--seconds') + 1] || 40);
const dir = mkdtempSync(join(tmpdir(), 'rec-'));
const size = kind === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 };
const browser = await chromium.launch({ proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined, args: ['--ignore-certificate-errors', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ ...(kind === 'mobile' ? devices['iPhone 13'] : {}), viewport: size, deviceScaleFactor: 1, recordVideo: { dir, size } });
const page = await ctx.newPage();
await page.goto('http://localhost:4173/' + pg, { waitUntil: 'load' });
await page.waitForFunction(() => { const p = document.querySelector('.trip').__player; return p && p.pack && p.pack.loaded >= p.pack.count; }, null, { timeout: 120000 });
await page.waitForTimeout(1500);
// glide: 70 % of the time through the journey, the rest through the sections
await page.evaluate(async (ms) => {
  const trip = document.querySelector('.trip');
  const endTrip = trip.offsetTop + trip.offsetHeight - innerHeight;
  const endAll = document.documentElement.scrollHeight - innerHeight;
  const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
  const glide = (from, to, dur) => new Promise((res) => { const t0 = performance.now(); const f = (now) => { const k = Math.min(1, (now - t0) / dur); scrollTo(0, from + (to - from) * ease(k)); k < 1 ? requestAnimationFrame(f) : res(); }; requestAnimationFrame(f); });
  await glide(0, endTrip, ms * 0.7);
  await new Promise((r) => setTimeout(r, 1500));
  await glide(endTrip, endAll, ms * 0.3);
}, secs * 1000);
await page.waitForTimeout(1000);
await ctx.close(); await browser.close();
const webm = join(dir, readdirSync(dir).find((f) => f.endsWith('.webm')));
execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-preset', 'veryfast', '-movflags', '+faststart', out]);
console.log('saved', out);
