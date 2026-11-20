// Checks the journey stops: one swipe / one wheel gesture = one stop; and the live sun layer.
// usage: node tools/stops-test.mjs [page]   (served by tools/serve.mjs on :4173)
import { chromium, devices } from 'playwright';
const page0 = process.argv[2] || 'dist/index.html';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const prog = (p) => p.evaluate(() => { const s = document.querySelector('.trip'); return +((scrollY - s.offsetTop) / (s.offsetHeight - innerHeight)).toFixed(3); });
const settle = async (p) => { let last = -1; for (let i = 0; i < 40; i++) { await p.waitForTimeout(150); const y = await p.evaluate(() => scrollY); if (y === last) break; last = y; } };
// mobile: swipes through CDP touch events
{
  const ctx = await b.newContext({ ...devices['iPhone 13'] });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://127.0.0.1:4173/${page0}?fe=film`, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => document.querySelector('.trip')?.__player?.pack?.loaded, null, { timeout: 60000 }).catch(() => {});
  const cdp = await ctx.newCDPSession(p);
  const swipe = async (dy) => {
    const x = 200, y0 = 500, steps = 8;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
    for (let i = 1; i <= steps; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 - (dy * i) / steps }] }); await p.waitForTimeout(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  const seq = [];
  for (let i = 0; i < 6; i++) { await swipe(160); await settle(p); seq.push(await prog(p)); if (seq.at(-1) > 0.49 && seq.at(-1) < 0.51) { await p.waitForTimeout(600); await p.screenshot({ path: 'qa/stop-sun-390.png' }); const o = await p.evaluate(() => getComputedStyle(document.querySelector('.trip__sun')).opacity); seq.push('sun-layer ' + o); } }
  await swipe(-160); await settle(p); seq.push('back ' + (await prog(p)));
  console.log('mobile', JSON.stringify(seq), 'scrollH', await p.evaluate(() => document.body.scrollHeight), errs);
  await ctx.close();
}
// desktop: wheel gestures (film mode, as without a GPU)
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://127.0.0.1:4173/${page0}?fe=film`, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => document.querySelector('.trip')?.__player?.pack?.loaded, null, { timeout: 60000 }).catch(() => {});
  await p.mouse.move(700, 450);
  const seq = [];
  for (let i = 0; i < 6; i++) {
    for (let k = 0; k < 6; k++) { await p.mouse.wheel(0, 60); await p.waitForTimeout(30); } // one trackpad-like gesture
    await settle(p); await p.waitForTimeout(300); seq.push(await prog(p));
    if (seq.at(-1) > 0.49 && seq.at(-1) < 0.51) await p.screenshot({ path: 'qa/stop-sun-1440.png' });
  }
  await p.keyboard.press('PageUp'); await p.waitForTimeout(400); await settle(p); seq.push('key ' + (await prog(p)));
  console.log('desktop', JSON.stringify(seq), 'scrollH', await p.evaluate(() => document.body.scrollHeight), errs);
  await ctx.close();
}
await b.close();
