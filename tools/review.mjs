// Full visual + behaviour review of the home page at 390 and 1440 px.
// usage: node tools/review.mjs [page=dist/index.html] [--only 390|1440]
// Writes qa/review-<w>-<nn>-<name>.png and prints every problem it finds.
import { chromium, devices } from 'playwright';
const page0 = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'dist/index.html';
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const problems = [];
const say = (w, m) => { problems.push(`[${w}] ${m}`); console.log(`[${w}] ✗ ${m}`); };

for (const [w, ctxo] of [['390', devices['iPhone 13']], ['1440', { viewport: { width: 1440, height: 900 } }]]) {
  if (only && only !== w) continue;
  const ctx = await b.newContext(ctxo);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && !/GL Driver|favicon/.test(m.text()) && errs.push(m.text()));
  const t0 = Date.now();
  await p.goto(`http://127.0.0.1:4173/${page0}`, { waitUntil: 'load' });
  const lcp = await p.evaluate(() => new Promise((r) => { new PerformanceObserver((l) => { const e = l.getEntries().at(-1); r(Math.round(e.startTime)); }).observe({ type: 'largest-contentful-paint', buffered: true }); setTimeout(() => r(-1), 3000); }));
  console.log(`[${w}] load ${Date.now() - t0} ms · LCP ${lcp} ms`);
  await p.waitForFunction(() => document.querySelector('.trip')?.classList.contains('has-star'), null, { timeout: 30000 }).catch(() => say(w, 'live star did not appear within 30 s'));
  await p.waitForTimeout(800);
  let n = 0;
  const shot = async (name) => { await p.screenshot({ path: `qa/review-${w}-${String(++n).padStart(2, '0')}-${name}.png` }); };
  await shot('hero');
  const barAt = () => p.evaluate(() => { const b = document.querySelector('[data-bar]'); return b ? (b.hasAttribute('data-away') ? 'away' : getComputedStyle(b).display === 'none' ? 'none' : 'shown') : 'missing'; });
  if (w === '390' && (await barAt()) !== 'shown') say(w, 'buy bar not shown on the hero');

  // journey stops
  const trip = await p.evaluate(() => { const s = document.querySelector('.trip'); return { top: s.offsetTop, run: s.offsetHeight - innerHeight, h: s.offsetHeight, vh: innerHeight }; });
  if (trip.h > trip.vh * 2.01) say(w, `journey is ${(trip.h / trip.vh).toFixed(2)} screens tall (max 2)`);
  await p.waitForFunction(() => document.querySelector('.trip')?.__player?.pack?.loaded, null, { timeout: 60000 }).catch(() => say(w, 'film pack did not load'));
  for (const [name, at] of [['sun', 0.35], ['earth', 0.67], ['sky', 1]]) {
    await p.evaluate(([y]) => scrollTo(0, y), [trip.top + at * trip.run]);
    await p.waitForTimeout(1800);
    await shot(name);
  }
  const creatorTop = await p.evaluate(() => document.querySelector('[data-creator]').getBoundingClientRect().top + scrollY);
  if (creatorTop > trip.top + trip.h + 2) say(w, 'the creator does not follow the journey directly');

  // every section, top of section at the top of the screen
  for (const sel of ['[data-creator]', '[data-formats]', '#preguntas', '.close', '.foot']) {
    const ok = await p.evaluate((s) => { const el = document.querySelector(s) || document.querySelector(s === '#preguntas' ? '.faq' : s); if (!el) return false; scrollTo(0, el.getBoundingClientRect().top + scrollY - 0); return true; }, sel);
    if (!ok) { say(w, `section ${sel} not found`); continue; }
    await p.waitForTimeout(1100);
    await shot(sel.replace(/[^a-z]/g, ''));
    if (w === '390' && sel === '[data-creator]') { await p.evaluate(() => scrollBy(0, 200)); await p.waitForTimeout(500); if ((await barAt()) !== 'away') say(w, 'buy bar still visible over the creator'); }
    if (w === '390' && sel === '[data-formats]') { await p.waitForTimeout(400); if ((await barAt()) !== 'shown') say(w, 'buy bar not back after the creator'); }
  }
  // the other sections in between (moments, guarantee)
  for (const [name, sel] of [['moments', '.moments'], ['promise', '.promise']]) {
    await p.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center' }), sel);
    await p.waitForTimeout(1100);
    await shot(name);
  }

  // overflow / cut text
  const cut = await p.evaluate(() => {
    const out = [], W = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth > W + 1) out.push(`page scrolls sideways (${document.documentElement.scrollWidth} > ${W})`);
    for (const el of document.querySelectorAll('h1,h2,h3,p,a,span,em,strong,b,label,li,summary,button')) {
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
      const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
      if (el.closest('.moments, .sr, [aria-hidden=true], svg')) continue;
      if (r.right > W + 1 || r.left < -1) out.push(`${el.tagName.toLowerCase()}.${el.className} "${el.textContent.trim().slice(0, 40)}" runs off screen (${Math.round(r.left)}–${Math.round(r.right)})`);
      else if (el.scrollWidth > el.clientWidth + 2 && cs.overflow !== 'visible' && el.clientWidth) out.push(`${el.tagName.toLowerCase()}.${el.className} "${el.textContent.trim().slice(0, 40)}" is clipped`);
    }
    return out.slice(0, 12);
  });
  cut.forEach((m) => say(w, m));

  // no blue anywhere in the interface
  const blues = await p.evaluate(() => {
    const out = new Set();
    const rgb = (c) => (c.match(/rgba?\(([^)]+)\)/) || [])[1]?.split(',').map((x) => parseFloat(x));
    const blue = (c) => { const v = rgb(c); if (!v || (v[3] !== undefined && v[3] < 0.15)) return false; const [r, g, bb] = v; return bb > r + 25 && bb > g + 8; };
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('svg') || /CANVAS|IMG|PICTURE|SOURCE/.test(el.tagName)) continue;
      const cs = getComputedStyle(el);
      for (const k of ['color', 'backgroundColor', 'borderTopColor', 'outlineColor']) {
        if (k === 'outlineColor' && cs.outlineStyle === 'none') continue;
        if (k === 'borderTopColor' && parseFloat(cs.borderTopWidth) === 0) continue;
        if (blue(cs[k])) out.add(`${el.tagName.toLowerCase()}.${el.className} ${k} ${cs[k]}`);
      }
      if (/rgb/.test(cs.backgroundImage) && cs.backgroundImage.match(/rgba?\([^)]+\)/g).some(blue) && !el.matches('.sec')) out.add(`${el.tagName.toLowerCase()}.${el.className} background-image`);
    }
    return [...out].slice(0, 10);
  });
  blues.forEach((m) => say(w, `blue: ${m}`));
  const btn = await p.evaluate(() => { const cs = getComputedStyle(document.querySelector('.btn')); return [cs.backgroundColor, cs.color]; });
  if (btn[0] !== 'rgb(212, 175, 99)' || btn[1] !== 'rgb(5, 7, 13)') say(w, `button is ${btn.join(' / ')}`);

  // Spanish date and 24 h time
  await p.evaluate(() => document.querySelector('[data-creator]').scrollIntoView());
  await p.waitForTimeout(600);
  const d = p.locator('input[name=date]'), tm = p.locator('input[name=time]');
  await d.fill(''); await d.pressSequentially('01022020'); await tm.fill(''); await tm.pressSequentially('0930');
  await p.waitForTimeout(400);
  const dv = await d.inputValue(), tv = await tm.inputValue(), coords = await p.locator('[data-coords]').textContent();
  if (dv !== '01/02/2020' || tv !== '09:30') say(w, `date/time mask gave ${dv} ${tv}`);
  if (!coords.includes('01/02/2020') || !coords.includes('09:30')) say(w, `coords line: ${coords}`);
  const poster = await p.locator('[data-preview]').innerHTML();
  if (!poster.includes('01/02/2020 · 09:30')) say(w, 'poster date is not DD/MM/AAAA · HH:MM');

  // the digital card
  await p.evaluate(() => document.querySelector('[data-formats]').scrollIntoView());
  const order = await p.$$eval('.fmt .fmt__t', (e) => e.map((x) => x.textContent.trim().replace(/\s/g, ' ')));
  const checked = await p.$eval('.fmt input:checked', (e) => e.dataset.title);
  if (order.join('|') !== 'Con marco de roble|Lámina 30×40 cm|Lámina A4|Digital' || checked !== 'Lámina 30×40 cm') say(w, `formats ${order.join(' → ')} checked ${checked}`);
  await p.locator('.fmt', { hasText: 'Digital' }).click();
  await p.waitForTimeout(300);
  const dig = await p.evaluate(() => ({ total: document.querySelector('[data-total]').textContent, ship: getComputedStyle(document.querySelector('.facts--ship')).display, digi: document.querySelector('.facts--digital').textContent.trim().replace(/\s+/g, ' ') }));
  if (!/9,99/.test(dig.total) || dig.ship !== 'none' || !/Sin envío/.test(dig.digi)) say(w, `digital: ${JSON.stringify(dig)}`);
  await p.locator('.fmt', { hasText: 'Lámina 30×40 cm' }).first().click();

  // «Desde 9,99 €» everywhere, nothing at 4,95
  const txt = await p.evaluate(() => document.body.innerText);
  if (/(^|[^\d])4,95/.test(txt)) say(w, 'page still mentions 4,95 €');
  const desde = (txt.match(/desde\s*9,99/gi) || []).length;
  console.log(`[${w}] «desde 9,99 €» appears ${desde}×`);
  if (errs.length) say(w, `console: ${errs.slice(0, 3).join(' | ')}`);
  await ctx.close();
}
await b.close();
console.log(problems.length ? `\n${problems.length} problem(s)` : '\nno problems found');
