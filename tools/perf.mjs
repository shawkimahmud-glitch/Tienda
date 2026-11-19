// Mobile perf check: LCP, CLS, long tasks and scroll frame times on a throttled mid-range profile.
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await page.addInitScript(() => {
  window.__lcp = 0; window.__cls = 0; window.__long = 0;
  new PerformanceObserver((l) => { for (const e of l.getEntries()) { window.__lcp = e.startTime; window.__lcpEl = (e.element && (e.element.className || e.element.tagName)) + ' ' + (e.url || ''); } }).observe({ type: 'largest-contentful-paint', buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long += e.duration; }).observe({ type: 'longtask', buffered: true });
});
const t0 = Date.now();
await page.goto('http://localhost:4173/dist/index.html', { waitUntil: 'load' });
const load = Date.now() - t0;
await page.waitForTimeout(3000);
const m = await page.evaluate(() => ({ lcp: Math.round(window.__lcp), cls: +window.__cls.toFixed(3), longTasks: Math.round(window.__long), fcp: Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0), el: window.__lcpEl, res: performance.getEntriesByType('resource').map((r) => [r.name.replace(location.origin, ''), Math.round(r.startTime), Math.round(r.responseEnd), Math.round(r.transferSize / 1024) + 'KB']) }));
console.log('Slow 4G + 4x CPU:', JSON.stringify({ load, ...m }, null, 1));
await browser.close();
