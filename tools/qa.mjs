// End-to-end QA of the home on production CDNs: load metrics, film start, a full scroll through the
// journey, frame memory, console errors, reduced motion. usage: node tools/qa.mjs [page] [--mobile|--desktop] [--throttle] [--reduced] [--shots dir]
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'node:fs';
const args = process.argv.slice(2);
const page_ = args.find((a) => !a.startsWith('--')) || 'dist/cdn.html';
const mobile = !args.includes('--desktop');
const throttle = args.includes('--throttle');
const reduced = args.includes('--reduced');
const shotsAt = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;
if (shotsAt) mkdirSync(shotsAt, { recursive: true });
const browser = await chromium.launch({ proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined, args: ['--ignore-certificate-errors', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] });
const ctx = await browser.newContext(mobile ? { ...devices['iPhone 13'], reducedMotion: reduced ? 'reduce' : 'no-preference' } : { viewport: { width: 1440, height: 900 }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
const page = await ctx.newPage();
const errs = [], failed = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
page.on('console', (m) => m.type() === 'error' && errs.push('console: ' + m.text()));
page.on('requestfailed', (r) => failed.push(r.url().slice(0, 120) + ' ' + r.failure()?.errorText));
page.on('response', (r) => r.status() >= 400 && failed.push(r.status() + ' ' + r.url().slice(0, 120)));
if (throttle) {
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 70, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (1.5 * 1024 * 1024) / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
}
await page.addInitScript(() => {
  window.__m = { lcp: 0, cls: 0, long: 0 };
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__m.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__m.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__m.long += e.duration; }).observe({ type: 'longtask', buffered: true });
});
const t0 = Date.now();
await page.goto('http://localhost:4173/' + page_, { waitUntil: 'load', timeout: 120000 });
const loadMs = Date.now() - t0;
// wait for the film to start drawing (or the still, in reduced motion)
let filmMs = -1;
for (let i = 0; i < 60; i++) {
  const st = await page.evaluate(() => { const t = document.querySelector('.trip'); const p = t.__player; return { mode: t.dataset.mode || (t.classList.contains('is-still') ? 'still' : ''), loaded: p?.pack?.loaded || 0, count: p?.pack?.count || 0, drawn: p?.drawn ?? -1 }; });
  if (st.mode === 'still' || st.drawn >= 0 || st.mode === 'live') { filmMs = Date.now() - t0; break; }
  await page.waitForTimeout(500);
}
const base = await page.evaluate(() => ({ fcp: Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0), lcp: Math.round(window.__m.lcp), boot: !!window.__feBoot, mode: document.querySelector('.trip').dataset.mode || (document.querySelector('.trip').classList.contains('is-still') ? 'still' : '?') }));
console.log(JSON.stringify({ device: mobile ? 'iPhone 13' : 'desktop 1440', throttle, reduced, loadMs, filmStartMs: filmMs, ...base }));
// scroll through the whole journey
const steps = 40, maxCache = [];
for (let i = 0; i <= steps; i++) {
  await page.evaluate((k) => { const j = document.querySelector('.trip'); scrollTo(0, j.offsetTop + (j.offsetHeight - innerHeight) * k); }, i / steps);
  await page.waitForTimeout(throttle ? 450 : 250);
  const s = await page.evaluate(() => { const p = document.querySelector('.trip').__player; return { bm: p?.bitmaps?.size ?? 0, loaded: p?.pack?.loaded ?? 0, count: p?.pack?.count ?? 0, drawn: p?.drawn ?? -1, on: [...document.querySelectorAll('[data-beat][data-on]')].map((b) => b.textContent.trim().slice(0, 22)).join(' | ') }; });
  maxCache.push(s.bm);
  if (shotsAt && i % 8 === 0) await page.screenshot({ path: `${shotsAt}/${mobile ? 'm' : 'd'}-${String(i).padStart(2, '0')}.png` });
  if (i % 8 === 0) console.log(`  ${Math.round((i / steps) * 100)}%  frames ${s.loaded}/${s.count}  decoded-in-memory ${s.bm}  drawn ${s.drawn}  text: ${s.on}`);
}
const end = await page.evaluate(() => ({ cls: +window.__m.cls.toFixed(3), longTasksMs: Math.round(window.__m.long), heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null, lam: getComputedStyle(document.querySelector('.lam')).opacity }));
console.log(JSON.stringify({ maxDecodedFrames: Math.max(...maxCache), ...end }));
// the rest of the page renders and the buy link is live
await page.evaluate(() => document.getElementById('formatos').scrollIntoView());
await page.waitForTimeout(800);
const buy = await page.evaluate(() => { const r = document.querySelector('#formatos input[name=format]:checked'); return { checked: r?.dataset.title, total: document.querySelector('[data-total]').textContent, href: document.querySelector('[data-buy]').getAttribute('href'), urge: document.querySelector('[data-urge]').textContent }; });
console.log(JSON.stringify(buy));
console.log('errors:', errs.length ? [...new Set(errs)].slice(0, 8) : 'none');
console.log('failed requests:', failed.length ? [...new Set(failed)].slice(0, 8) : 'none');
await browser.close();
