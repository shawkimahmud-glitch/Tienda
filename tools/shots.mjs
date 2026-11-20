// Screenshots of the local preview at journey progress points and sections, mobile + desktop.
// usage: node tools/shots.mjs out_dir [mobile|desktop|both] [--p 0,0.1,...] [--sections]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const [out = 'shots', which = 'both', ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(rest.reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]] : a), []));
mkdirSync(out, { recursive: true });
const ps = (opt.p || '0,0.05,0.14,0.2,0.33,0.48,0.58,0.64,0.7,0.78,0.88,0.97').split(',').map(Number);
const vps = { mobile: { width: 390, height: 844, isMobile: true, hasTouch: true }, desktop: { width: 1440, height: 900 } };
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const name of which === 'both' ? ['mobile', 'desktop'] : [which]) {
  const v = vps[name];
  const ctx = await browser.newContext({ viewport: { width: v.width, height: v.height }, deviceScaleFactor: 1, isMobile: !!v.isMobile, hasTouch: !!v.hasTouch, reducedMotion: opt.reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await page.goto('http://localhost:4173/dist/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  if (!opt.sections || opt.p) {
    for (const p of ps) {
      await page.evaluate((p) => { const j = document.querySelector('.trip'); const top = j.offsetTop + (j.offsetHeight - innerHeight) * p; window.scrollTo(0, top); }, p);
      await page.waitForTimeout(p > 0.6 ? 1600 : 900);
      await page.screenshot({ path: `${out}/${name}-j${String(Math.round(p * 100)).padStart(3, '0')}.png` });
    }
  }
  if (opt.sections) {
    for (const sel of ['#crea', '#formatos', '.moments', '.promise', '#preguntas', '.close', '.foot']) {
      const ok = await page.evaluate((sel) => { const el = document.querySelector(sel); if (!el) return false; window.scrollTo(0, el.getBoundingClientRect().top + scrollY - (sel === '.fe-ribbon' ? 200 : 0)); return true; }, sel);
      if (!ok) continue;
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${out}/${name}-s-${sel.replace(/[^a-z]/g, '')}.png` });
    }
  }
  if (errs.length) console.log(name, 'errors:', [...new Set(errs)].join('\n'));
  await ctx.close();
}
await browser.close();
