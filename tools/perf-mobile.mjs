// Mobile LCP on a throttled connection (≈ slow 4G, 4× slower CPU), the reduced-motion still, and 360 px.
import { chromium, devices } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
{
  const ctx = await b.newContext({ ...devices['iPhone 13'] }); const p = await ctx.newPage();
  const c = await ctx.newCDPSession(p);
  await c.send('Network.enable');
  await c.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  await c.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await p.goto('http://127.0.0.1:4173/dist/index.html', { waitUntil: 'load' });
  const lcp = await p.evaluate(() => new Promise((r) => new PerformanceObserver((l) => r(l.getEntries().at(-1))).observe({ type: 'largest-contentful-paint', buffered: true })).then((e) => ({ t: Math.round(e.startTime), el: e.element?.tagName + '.' + e.element?.className })));
  const cls = await p.evaluate(() => new Promise((r) => { let s = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) s += e.value; }).observe({ type: 'layout-shift', buffered: true }); setTimeout(() => r(s.toFixed(3)), 500); }));
  console.log('throttled mobile LCP', lcp, 'CLS', cls);
  await ctx.close();
}
{
  const ctx = await b.newContext({ ...devices['iPhone 13'], reducedMotion: 'reduce' }); const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:4173/dist/index.html', { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
  await p.screenshot({ path: 'qa/review-390-reduced.png' });
  console.log('reduced:', await p.evaluate(() => ({ still: document.querySelector('.trip').classList.contains('is-still'), h: document.querySelector('.trip').offsetHeight, vh: innerHeight })));
  await ctx.close();
}
{
  const ctx = await b.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:4173/dist/index.html', { waitUntil: 'networkidle' });
  const bad = await p.evaluate(() => { const W = document.documentElement.clientWidth, out = []; if (document.documentElement.scrollWidth > W) out.push('sideways scroll');
    for (const el of document.querySelectorAll('.hl span, .hl em, .btn, .fmt__p, .fmt__t, h1, label, .bar__btn')) { const r = el.getBoundingClientRect(); if (r.width && (r.right > W + 1 || r.left < -1)) out.push(el.className + ' ' + el.textContent.trim().slice(0, 30)); }
    return out; });
  console.log('360 px problems:', bad.length ? bad : 'none');
  await ctx.close();
}
await b.close();
