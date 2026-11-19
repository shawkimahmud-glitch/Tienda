// Fecha Estelar — storefront experience.
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { FramePack, SequencePlayer } from './sequence.js';
import { posterSVG, CITIES, cityByName, fmtCoords, fmtDateDots } from './sky.js';

gsap.registerPlugin(ScrollTrigger);

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const mq = (q) => window.matchMedia(q).matches;
const root = document.documentElement;

const reduced = mq('(prefers-reduced-motion: reduce)');
const fine = mq('(hover: hover) and (pointer: fine)');
const conn = navigator.connection || {};
const slow = conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '') || conn.effectiveType === '3g';
const lowEnd = (navigator.deviceMemory && navigator.deviceMemory <= 3) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
root.classList.add('fe-js');
window.__feBoot = true;
if (reduced) root.classList.add('fe-reduced');

// ---------- smooth scroll ----------
let lenis = null;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.09, smoothWheel: true, syncTouch: false });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
const scrollToEl = (el) => {
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { duration: 1.8, easing: (x) => 1 - Math.pow(1 - x, 4) });
  else el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
};
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || a.getAttribute('href').length < 2) return;
  const el = document.getElementById(a.getAttribute('href').slice(1));
  if (!el) return;
  e.preventDefault();
  scrollToEl(el);
  el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
});

// ---------- words, for staged text reveals ----------
function splitWords(el) {
  if (el.dataset.split) return;
  el.dataset.split = '1';
  const walk = (node) => {
    for (const n of [...node.childNodes]) {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((w) => {
          if (!w) return;
          if (/^\s+$/.test(w)) { frag.append(w); return; }
          const s = document.createElement('span'); s.className = 'fe-w'; s.textContent = w; frag.append(s);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && !n.matches('a,button,.fe-btn')) walk(n);
    }
  };
  walk(el);
  $$('.fe-w', el).forEach((w, i) => w.style.setProperty('--i', i));
}

// ---------- the cosmic journey ----------
function journey(sec) {
  const stage = $('.fe-journey__stage', sec);
  const seqCanvas = $('.fe-journey__seq', sec);
  const glCanvas = $('.fe-journey__gl', sec);
  const posterWrap = $('.fe-journey__poster', sec);
  const ticker = $('[data-ticker]', sec);
  const bar = $('.fe-journey__progress i', sec);
  const beats = $$('[data-beat]', sec);
  const ex = JSON.parse(sec.dataset.example);
  const city = cityByName(ex.city);
  posterWrap.innerHTML = posterSVG({ ...ex, city: undefined, cityName: ex.city, id: 'jp' });
  beats.forEach((b) => $$('.fe-split', b).forEach(splitWords));

  if (reduced) { sec.classList.add('is-static'); return; }

  const portrait = innerHeight > innerWidth;
  const packUrl = portrait ? sec.dataset.framesM : sec.dataset.framesD;
  const player = new SequencePlayer(seqCanvas);
  let pack = null;
  const startPack = () => {
    if (pack || !packUrl) return;
    pack = new FramePack(packUrl, { maxFrames: slow ? 24 : Infinity, onFrame: () => { player.last = null; dirty = true; } });
    player.setPack(pack);
    pack.load().then(() => sec.classList.add('has-film')).catch(() => sec.classList.add('no-film'));
  };
  // the first screen is type and a single point of light: the film loads after first paint
  if (document.readyState === 'complete') setTimeout(startPack, 60); else addEventListener('load', () => setTimeout(startPack, 60), { once: true });
  addEventListener('scroll', startPack, { once: true, passive: true });

  let gl = null, glLoading = false;
  const loadGL = () => {
    if (gl || glLoading) return;
    glLoading = true;
    const test = document.createElement('canvas');
    if (!(test.getContext('webgl2') || test.getContext('webgl'))) { sec.classList.add('no-gl'); return; }
    Promise.all([import('./gl.js'), document.fonts?.load?.("400 23px 'Bodoni Moda'"), document.fonts?.load?.("italic 400 10px 'Bodoni Moda'"), document.fonts?.load?.('600 7px Manrope')].filter(Boolean))
      .then(([m]) => { gl = new m.SkyGL(glCanvas, { ...ex, city, posterEl: posterWrap, lite: lowEnd || slow }); dirty = true; })
      .catch(() => sec.classList.add('no-gl'));
  };

  let target = 0, p = 0, dirty = true, visible = true;
  const st = ScrollTrigger.create({ trigger: sec, start: 'top top', end: 'bottom bottom', onUpdate: (s) => { target = s.progress; dirty = true; if (target > 0.25) loadGL(); } });
  setTimeout(loadGL, 4500);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(sec);

  const today = Date.now();
  const exMs = Date.UTC(...ex.date.split('-').map((v, i) => +v - (i === 1 ? 1 : 0)), ...ex.time.split(':').map(Number));
  const pad = (n) => String(n).padStart(2, '0');

  const tick = (time) => {
    if (!visible) return;
    const d = target - p;
    p = Math.abs(d) < 0.0002 ? target : p + d * (fine ? 0.16 : 0.22);
    const moving = p !== target;
    if (!dirty && !moving && !(gl && p > 0.6)) return;
    dirty = false;

    // film
    const film = seg(p, 0, 0.6);
    player.draw(film);
    const look = ease(seg(p, 0.585, 0.68));
    seqCanvas.style.transform = `translate3d(0, ${(look * 28).toFixed(2)}%, 0) scale(${(1 + look * 0.12).toFixed(4)})`;
    seqCanvas.style.opacity = (1 - look).toFixed(3);
    stage.style.setProperty('--look', look.toFixed(3));
    stage.style.setProperty('--spark', (1 - seg(p, 0.03, 0.09)).toFixed(3));
    bar.style.transform = `scaleX(${p.toFixed(4)})`;

    // the date rewinds to the night
    const tk = seg(p, 0.5, 0.64);
    if (ticker && tk > 0 && tk < 1.01) {
      const ms = today + (exMs - today) * (1 - Math.pow(1 - tk, 4));
      const dd = new Date(ms);
      ticker.textContent = `${pad(dd.getUTCDate())} · ${pad(dd.getUTCMonth() + 1)} · ${dd.getUTCFullYear()}  —  ${pad(dd.getUTCHours())}:${pad(dd.getUTCMinutes())}`;
    }

    // sky, constellation, morph
    const sky = seg(p, 0.6, 0.73), lines = seg(p, 0.71, 0.84), morph = seg(p, 0.83, 0.95), crisp = ease(seg(p, 0.93, 0.975));
    stage.style.setProperty('--crisp', crisp.toFixed(3));
    stage.style.setProperty('--morph', morph.toFixed(3));
    if (gl) {
      glCanvas.style.opacity = (1 - crisp).toFixed(3);
      const live = p > 0.57 && crisp < 1;
      if (live || gl.live) gl.render({ sky: live ? sky : 0, lines, morph, alpha: live ? 1 : 0, time: time / 1000 });
      gl.live = live;
    } else {
      stage.style.setProperty('--fallback', seg(p, 0.66, 0.9).toFixed(3));
    }

    // beats
    for (const b of beats) {
      const a = +b.dataset.in, z = +b.dataset.out;
      const inK = a <= 0 ? 1 : seg(p, a, a + (z - a) * 0.3), outK = z >= 1 ? 0 : seg(p, z - (z - Math.max(a, 0)) * 0.3, z);
      const v = inK * (1 - outK);
      b.style.setProperty('--v', v.toFixed(3));
      b.style.setProperty('--o', outK.toFixed(3));
      const on = v > 0.02;
      if (on !== b._on) { b._on = on; b.toggleAttribute('data-on', on); b.setAttribute('aria-hidden', String(!on)); b.inert = !on; }
    }
  };
  gsap.ticker.add((t) => tick(t * 1000));
  const ro = new ResizeObserver(() => { player.resize(); gl?.resize(); dirty = true; });
  ro.observe(stage);
  void st;
}

// ---------- creator (live mock until the Customall block is placed) ----------
function creator(sec) {
  const form = $('form', sec);
  if (!form) return;
  const prev = $('[data-preview]', sec);
  const price = $('[data-price]', sec);
  const cta = $('[data-cta]', sec);
  const coords = $('[data-coords]', sec);
  const sel = form.elements.city;
  const current = sel.value || 'Madrid';
  sel.innerHTML = CITIES.map((c) => `<option${c[0] === current ? ' selected' : ''}>${c[0]}</option>`).join('');
  let raf = 0;
  const draw = () => {
    raf = 0;
    const f = form.elements;
    const date = f.date.value || '2021-05-14';
    const v = form.querySelector('input[name="variant"]:checked');
    prev.innerHTML = posterSVG({ names: f.names.value.trim() || 'Vuestros nombres', phrase: f.phrase.value.trim(), cityName: f.city.value, date, time: f.time.value || '22:00', style: form.querySelector('input[name="style"]:checked')?.value || 'noche', id: 'cp' });
    sec.classList.toggle('is-framed', !!v?.dataset.frame);
    const c = cityByName(f.city.value);
    if (coords) coords.textContent = `${c[0]} · ${fmtCoords(c[1], c[2])} · ${fmtDateDots(date)}`;
    if (v) {
      price.textContent = v.dataset.price;
      const u = new URL(cta.dataset.base, location.href);
      if (v.value) u.searchParams.set('variant', v.value);
      cta.href = u.pathname + u.search;
    }
  };
  form.addEventListener('input', () => { if (!raf) raf = requestAnimationFrame(draw); });
  form.addEventListener('submit', (e) => { e.preventDefault(); location.href = cta.href; });
  new IntersectionObserver(([e], o) => { if (e.isIntersecting) { draw(); o.disconnect(); } }, { rootMargin: '400px' }).observe(sec);
}

// ---------- mini láminas in the stories ----------
function minis() {
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    const el = e.target, d = el.dataset;
    el.innerHTML = posterSVG({ names: d.names, phrase: d.phrase, cityName: d.city, date: d.date, time: d.time, style: d.style || 'noche', id: 'm' + Math.random().toString(36).slice(2, 6) });
    io.unobserve(el);
  }), { rootMargin: '600px' });
  $$('[data-fe-mini]').forEach((el) => io.observe(el));
}

// ---------- horizontal stories on wide screens ----------
function stories(sec) {
  const track = $('.fe-stories__track', sec);
  if (!track || reduced) return;
  const wide = window.matchMedia('(min-width: 900px) and (hover: hover)');
  let st = null;
  const setup = () => {
    st?.kill(); st = null;
    sec.style.height = ''; track.style.transform = '';
    if (!wide.matches) return;
    const dist = () => track.scrollWidth - track.parentElement.clientWidth;
    sec.style.height = `${dist() + innerHeight}px`;
    st = ScrollTrigger.create({ trigger: sec, start: 'top top', end: 'bottom bottom', onUpdate: (s) => { track.style.transform = `translate3d(${(-dist() * s.progress).toFixed(1)}px,0,0)`; } });
  };
  setup();
  wide.addEventListener('change', setup);
  addEventListener('resize', () => { clearTimeout(stories.t); stories.t = setTimeout(() => { setup(); ScrollTrigger.refresh(); }, 200); });
}

// ---------- "El instante": the date rolls into place ----------
function instant(sec) {
  $$('[data-roll]', sec).forEach((el) => {
    const txt = el.textContent;
    el.setAttribute('aria-label', txt);
    el.innerHTML = [...txt].map((ch, i) => (/\d/.test(ch) ? `<span class="fe-roll" aria-hidden="true" style="--d:${ch};--i:${i}"><span>${'0123456789'.split('').map((n) => `<b>${n}</b>`).join('')}</span></span>` : `<span aria-hidden="true">${ch}</span>`)).join('');
  });
  new IntersectionObserver(([e], o) => { if (e.isIntersecting) { sec.classList.add('is-in'); o.disconnect(); } }, { threshold: 0.35 }).observe(sec);
}

// ---------- reveal on view (one entrance style, staged per word) ----------
function reveals() {
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { threshold: 0.2, rootMargin: '0px 0px -8% 0px' });
  $$('[data-reveal]').forEach((el) => { if (el.matches('.fe-split, [data-reveal="words"]')) splitWords(el); io.observe(el); });
}

// ---------- star trails for the finale ----------
function trails(canvas) {
  const ctx = canvas.getContext('2d');
  let w, h, dpr, stars, run = false, a0 = 0;
  const size = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect(); w = r.width; h = r.height;
    canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let s = 3;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const R = Math.hypot(w, h);
    stars = Array.from({ length: Math.round(Math.min(520, (w * h) / 2600)) }, () => ({ r: Math.pow(rnd(), 0.7) * R, a: rnd() * Math.PI * 2, b: 0.25 + Math.pow(rnd(), 3) * 0.75, g: rnd() < 0.18 }));
    ctx.fillStyle = '#05070D'; ctx.fillRect(0, 0, w, h);
    if (reduced) drawArc(0.42, 1);
  };
  const drawArc = (len, alpha) => {
    const cx = w / 2, cy = h * 0.08;
    ctx.lineCap = 'round';
    for (const s of stars) {
      ctx.strokeStyle = s.g ? `rgba(212,175,99,${s.b * alpha})` : `rgba(243,235,216,${s.b * 0.8 * alpha})`;
      ctx.lineWidth = s.b > 0.7 ? 1.3 : 0.8;
      ctx.beginPath(); ctx.arc(cx, cy, s.r, s.a + a0, s.a + a0 + len); ctx.stroke();
    }
  };
  const loop = () => {
    if (!run) return;
    ctx.fillStyle = 'rgba(5,7,13,0.045)'; ctx.fillRect(0, 0, w, h);
    drawArc(0.0045, 0.9); a0 += 0.0026;
    requestAnimationFrame(loop);
  };
  size();
  new ResizeObserver(size).observe(canvas);
  if (!reduced) new IntersectionObserver(([e]) => { const was = run; run = e.isIntersecting; if (run && !was) loop(); }).observe(canvas);
}

// ---------- magnetic buttons & stardust cursor (pointer: fine only) ----------
function magnetic() {
  if (!fine || reduced) return;
  $$('[data-magnetic]').forEach((el) => {
    const inner = el.querySelector('.fe-btn__label') || el;
    let x = 0, y = 0, tx = 0, ty = 0, raf = 0;
    const step = () => {
      x += (tx - x) * 0.18; y += (ty - y) * 0.18;
      el.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0)`;
      if (inner !== el) inner.style.transform = `translate3d(${(x * 0.35).toFixed(2)}px,${(y * 0.35).toFixed(2)}px,0)`;
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.05 ? requestAnimationFrame(step) : 0;
    };
    const go = () => { if (!raf) raf = requestAnimationFrame(step); };
    el.addEventListener('pointermove', (e) => { const r = el.getBoundingClientRect(); tx = (e.clientX - r.left - r.width / 2) * 0.28; ty = (e.clientY - r.top - r.height / 2) * 0.38; go(); });
    el.addEventListener('pointerleave', () => { tx = ty = 0; go(); });
  });
}

function cursor() {
  if (!fine || reduced) return;
  const c = document.createElement('canvas');
  c.className = 'fe-dust'; c.setAttribute('aria-hidden', 'true');
  const dot = document.createElement('div'); dot.className = 'fe-cursor'; dot.setAttribute('aria-hidden', 'true');
  document.body.append(c, dot);
  root.classList.add('fe-has-cursor');
  const ctx = c.getContext('2d');
  let dpr = 1, W = 0, H = 0;
  const size = () => { dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; c.width = W * dpr; c.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  size(); addEventListener('resize', size);
  const P = [];
  let mx = -99, my = -99, cx = -99, cy = -99, lx = null, ly = null, run = false;
  addEventListener('pointermove', (e) => {
    mx = e.clientX; my = e.clientY;
    if (lx !== null) {
      const d = Math.hypot(mx - lx, my - ly), n = Math.min(6, Math.floor(d / 7));
      for (let i = 0; i < n; i++) {
        const k = i / n;
        P.push({ x: lx + (mx - lx) * k + (Math.random() - 0.5) * 6, y: ly + (my - ly) * k + (Math.random() - 0.5) * 6, vx: (Math.random() - 0.5) * 0.35, vy: Math.random() * 0.25 + 0.05, life: 1, s: Math.random() * 1.6 + 0.5, g: Math.random() < 0.7 });
      }
      if (P.length > 260) P.splice(0, P.length - 260);
    }
    lx = mx; ly = my;
    const t = e.target.closest?.('a,button,label,summary,[role="button"],input,select,textarea');
    dot.classList.toggle('is-hover', !!t && !t.matches('input,select,textarea'));
    dot.classList.toggle('is-text', !!t && t.matches('input,textarea'));
    if (!run) { run = true; requestAnimationFrame(loop); }
  }, { passive: true });
  document.addEventListener('pointerleave', () => { dot.style.opacity = '0'; });
  document.addEventListener('pointerenter', () => { dot.style.opacity = ''; });
  const loop = () => {
    cx += (mx - cx) * 0.32; cy += (my - cy) * 0.32;
    dot.style.transform = `translate3d(${cx.toFixed(1)}px,${cy.toFixed(1)}px,0)`;
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.life -= 0.022; p.x += p.vx; p.y += p.vy;
      if (p.life <= 0) { P.splice(i, 1); continue; }
      ctx.fillStyle = p.g ? `rgba(212,175,99,${(p.life * 0.9).toFixed(3)})` : `rgba(243,235,216,${(p.life * 0.8).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.s * p.life, 0, 6.283); ctx.fill();
    }
    if (P.length || Math.abs(mx - cx) > 0.3 || Math.abs(my - cy) > 0.3) requestAnimationFrame(loop); else run = false;
  };
}

// ---------- header state ----------
function header() {
  const h = $('.fe-header');
  if (!h) return;
  let last = 0;
  ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (s) => { const y = s.scroll(); h.classList.toggle('is-scrolled', y > 40); h.classList.toggle('is-hidden', y > last && y > 400 && s.direction === 1); last = y; } });
}

// ---------- boot ----------
$$('[data-fe-journey]').forEach(journey);
$$('[data-fe-creator]').forEach(creator);
$$('[data-fe-stories]').forEach(stories);
$$('[data-fe-instant]').forEach(instant);
$$('[data-fe-trails]').forEach(trails);
minis();
reveals();
magnetic();
cursor();
header();
addEventListener('load', () => ScrollTrigger.refresh());
document.fonts?.ready.then(() => ScrollTrigger.refresh());
