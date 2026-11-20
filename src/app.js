// Fecha Estelar — «El túnel de estrellas».
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { FramePack, SequencePlayer } from './sequence.js';
import { posterSVG, CITIES, cityByName, fmtCoords, fmtDateDots } from './sky.js';

gsap.registerPlugin(ScrollTrigger);
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const mq = (q) => matchMedia(q).matches;
const root = document.documentElement;
const reduced = mq('(prefers-reduced-motion: reduce)');
const fine = mq('(hover: hover) and (pointer: fine)');
const conn = navigator.connection || {};
const slow = !!conn.saveData || /2g/.test(conn.effectiveType || '');
root.classList.add('fe-js');
if (reduced) root.classList.add('fe-reduced');
window.__feBoot = true;

// smooth scroll on wheel devices; native momentum on touch
let lenis = null;
if (!reduced && fine) {
  lenis = new Lenis({ lerp: 0.085, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  const id = a?.getAttribute('href').slice(1);
  const el = id && document.getElementById(id);
  if (!el) return;
  e.preventDefault();
  if (lenis) lenis.scrollTo(el, { duration: 1.6, easing: (x) => 1 - Math.pow(1 - x, 4) });
  else el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
  history.replaceState(null, '', '#' + id);
  el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
});

// ---------- the lámina that stays: drag to turn, spring back ----------
function lamina(el) {
  const card = $('.lam__card', el);
  let rx = 0, ry = 0, vx = 0, vy = 0, tx = 0, ty = 0, drag = null, raf = 0, t0 = performance.now();
  const K = 120, D = 14; // spring: stiffness, damping (≈ bounce 0.2)
  const step = (now) => {
    const dt = Math.min(0.032, (now - t0) / 1000); t0 = now;
    const idle = drag ? 0 : Math.sin(now / 1600) * 3;
    vx += (K * ((drag ? tx : 0) + idle * 0.4 - rx) - D * vx) * dt; rx += vx * dt;
    vy += (K * ((drag ? ty : 0) + idle - ry) - D * vy) * dt; ry += vy * dt;
    card.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
    card.style.setProperty('--sheen', (ry / 18).toFixed(3));
    raf = el.hasAttribute('data-live') ? requestAnimationFrame(step) : 0;
  };
  el.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', (e) => {
    if (drag) { ty = clamp((e.clientX - drag.x) / 6, -24, 24); tx = clamp(-(e.clientY - drag.y) / 8, -14, 14); }
    else if (fine) { const r = el.getBoundingClientRect(); tx = 0; ty = 0; ry += ((e.clientX - r.left) / r.width - 0.5) * 0.6; }
  });
  const end = () => { drag = null; };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  return { start() { if (!raf && !reduced) { t0 = performance.now(); raf = requestAnimationFrame(step); } } };
}

// ---------- the journey ----------
function trip(sec) {
  const stage = $('.trip__stage', sec);
  let canvas = $('.trip__film', sec);
  const lam = $('.lam', sec);
  const ex = JSON.parse(sec.dataset.example);
  $('[data-lam]', sec).innerHTML = posterSVG({ ...ex, city: undefined, cityName: ex.city, id: 'lam' });
  const beats = $$('[data-beat]', sec);
  const portrait = innerHeight > innerWidth;
  const showStill = () => {
    sec.classList.add('is-still');
    const img = $('.trip__still', sec);
    img.src = portrait ? img.dataset.srcM : img.dataset.srcD;
  };
  const gl = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } })();
  if (reduced || !gl && !window.createImageBitmap) return showStill();

  const L = lamina(lam);
  let target = 0, p = 0, dirty = true, visible = true, mode = null, player = null, scene = null;
  ScrollTrigger.create({ trigger: sec, start: 'top top', end: 'bottom bottom', onUpdate: (s) => { target = s.progress; dirty = true; } });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(sec);

  const useFrames = () => {
    if (mode === 'frames') return;
    scene?.dispose(); scene = null; mode = 'frames';
    const url = portrait ? sec.dataset.framesM : sec.dataset.framesD;
    if (canvas.dataset.used) { const c = canvas.cloneNode(); canvas.replaceWith(c); canvas = c; }
    player = new SequencePlayer(canvas);
    const pack = new FramePack(url, { maxFrames: slow ? 24 : Infinity, onFrame: () => { player.last = null; dirty = true; } });
    player.setPack(pack);
    pack.load().catch(() => { if (!pack.loaded) showStill(); });
  };
  const useLive = async () => {
    mode = 'live';
    try {
      const { createTunnel } = await import('./scene/tunnel.js');
      canvas.dataset.used = '1';
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      scene = createTunnel({ canvas, media: sec.dataset.media, quality: 'live', example: ex, poster: portrait ? { h: 0.5, cy: 0.42 } : { h: 0.62, cy: 0.47, cx: 0.64 } });
      scene.resize(stage.clientWidth, stage.clientHeight, dpr);
      await scene.ready;
      dirty = true;
      // performance guard: if the GPU can't hold ~35 fps, fall back to the pre-rendered film
      let n = 0, sum = 0, last = performance.now();
      const probe = (now) => { sum += now - last; last = now; if (++n < 50) return requestAnimationFrame(probe); if (sum / n > 28) useFrames(); };
      requestAnimationFrame(probe);
    } catch { useFrames(); }
  };
  const wantLive = !portrait && fine && innerWidth >= 900 && gl && !slow && (navigator.hardwareConcurrency || 8) >= 6;
  const start = () => (wantLive ? useLive() : useFrames());
  // first paint is the black field and the gold point (CSS); the 3D comes after load
  if (document.readyState === 'complete') setTimeout(start, 50); else addEventListener('load', () => setTimeout(start, 50), { once: true });

  // in frames mode, place the DOM lámina where the frames drew it (cover crop aware)
  const fitLam = () => {
    const pk = player?.pack; if (!pk?.width) return;
    const P = portrait ? { h: 0.5, cy: 0.42, cx: 0.5 } : { h: 0.62, cy: 0.47, cx: 0.64 };
    const vw = stage.clientWidth, vh = stage.clientHeight, k = Math.max(vw / pk.width, vh / pk.height);
    const fw = pk.width * k, fh = pk.height * k;
    lam.style.setProperty('--lam-h', ((P.h * fh) / vh).toFixed(4));
    lam.style.setProperty('--lam-cy', ((P.cy * fh + (vh - fh) / 2) / vh).toFixed(4));
    lam.style.setProperty('--lam-cx', ((P.cx * fw + (vw - fw) / 2) / vw).toFixed(4));
  };
  const tick = (time) => {
    if (!visible) return;
    const d = target - p;
    p = Math.abs(d) < 0.0002 ? target : p + d * (fine ? 0.14 : 0.2);
    if (!dirty && p === target && mode !== 'live') return;
    dirty = false;
    if (mode === 'frames') { player.draw(p); if (!lam.dataset.fit && player.pack?.width) { lam.dataset.fit = 1; fitLam(); } }
    if (mode === 'live' && scene) scene.frameAt(p, time / 1000);
    stage.style.setProperty('--p', p.toFixed(4));
    stage.style.setProperty('--point', (1 - clamp((p - 0.02) / 0.06)).toFixed(3));
    const crisp = clamp((p - 0.965) / 0.03);
    stage.style.setProperty('--crisp', crisp.toFixed(3));
    if (crisp > 0.98 !== lam.hasAttribute('data-live')) { lam.toggleAttribute('data-live', crisp > 0.98); if (crisp > 0.98) L.start(); }
    const pc = p * 100;
    for (const b of beats) {
      const on = pc >= +b.dataset.from && pc < +b.dataset.to;
      if (on !== b.hasAttribute('data-on')) b.toggleAttribute('data-on', on);
      b.inert = !on;
    }
  };
  gsap.ticker.add((t) => tick(t * 1000));
  new ResizeObserver(() => { player?.resize(); if (mode === 'frames') fitLam(); scene?.resize(stage.clientWidth, stage.clientHeight, Math.min(devicePixelRatio || 1, 1.5)); dirty = true; }).observe(stage);
}

// ---------- creator: the lámina redraws as you type ----------
const state = { names: '', phrase: '', city: 'Madrid', date: '2021-05-14', time: '22:00', style: 'noche' };
function creator(sec) {
  const form = $('[data-form]', sec), prev = $('[data-preview]', sec), coords = $('[data-coords]', sec);
  if (!form) return;
  const sel = form.elements.city, cur = sel.value || 'Madrid';
  sel.innerHTML = CITIES.map((c) => `<option${c[0] === cur ? ' selected' : ''}>${c[0]}</option>`).join('');
  let raf = 0;
  const draw = () => {
    raf = 0;
    const f = form.elements;
    Object.assign(state, { names: f.names.value.trim(), phrase: f.phrase.value.trim(), city: f.city.value, date: f.date.value || '2021-05-14', time: f.time.value || '22:00', style: form.querySelector('[name=style]:checked')?.value || 'noche' });
    prev.innerHTML = posterSVG({ ...state, names: state.names || 'Vuestros nombres', cityName: state.city, id: 'cp' });
    const c = cityByName(state.city);
    coords.textContent = `${c[0]} · ${fmtCoords(c[1], c[2])} · ${fmtDateDots(state.date)} · ${state.time} h`;
  };
  form.addEventListener('input', () => { raf ||= requestAnimationFrame(draw); });
  form.addEventListener('submit', (e) => e.preventDefault());
  new IntersectionObserver(([e], o) => { if (e.isIntersecting) { draw(); o.disconnect(); } }, { rootMargin: '600px' }).observe(sec);
}

// ---------- formats: total, buy link, honest urgency ----------
function formats(sec) {
  const total = $('[data-total]', sec), buy = $('[data-buy]', sec), urge = $('[data-urge]', sec);
  const upd = () => {
    const r = $('input[name=format]:checked', sec);
    if (!r) return;
    total.textContent = r.dataset.price;
    const u = new URL(sec.dataset.base, location.href);
    if (r.value) u.searchParams.set('variant', r.value);
    buy.href = u.pathname + u.search;
  };
  sec.addEventListener('change', upd); upd();
  const dl = sec.dataset.deadline;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dl)) {
    const end = new Date(dl + 'T23:59:59');
    const [y, m, d] = dl.split('-');
    urge.textContent = Date.now() > end ? urge.dataset.after : urge.dataset.before.replace('[FECHA]', `${+d}/${+m}/${y}`);
  }
}

// ---------- small láminas ----------
function minis() {
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    const d = e.target.dataset;
    e.target.innerHTML = posterSVG({ names: d.names, phrase: d.phrase, cityName: d.city, date: d.date, time: d.time, style: d.style, id: 'm' + Math.random().toString(36).slice(2, 6) });
    io.unobserve(e.target);
  }), { rootMargin: '600px' });
  $$('[data-mini]').forEach((el) => io.observe(el));
}

// ---------- cards that lean toward the pointer (spring), fine pointers only ----------
function tilt() {
  if (!fine || reduced) return;
  $$('[data-tilt]').forEach((el) => {
    let rx = 0, ry = 0, vx = 0, vy = 0, tx = 0, ty = 0, raf = 0, t0 = 0;
    const step = (now) => {
      const dt = Math.min(0.032, (now - t0) / 1000); t0 = now;
      vx += (170 * (tx - rx) - 18 * vx) * dt; rx += vx * dt;
      vy += (170 * (ty - ry) - 18 * vy) * dt; ry += vy * dt;
      el.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
      raf = Math.abs(tx - rx) + Math.abs(ty - ry) + Math.abs(vx) + Math.abs(vy) > 0.02 ? requestAnimationFrame(step) : 0;
    };
    const go = () => { if (!raf) { t0 = performance.now(); raf = requestAnimationFrame(step); } };
    el.addEventListener('pointermove', (e) => { const r = el.getBoundingClientRect(); ty = ((e.clientX - r.left) / r.width - 0.5) * 12; tx = -((e.clientY - r.top) / r.height - 0.5) * 10; go(); });
    el.addEventListener('pointerleave', () => { tx = ty = 0; go(); });
  });
}

// ---------- magnetic buttons ----------
function magnetic() {
  if (!fine || reduced) return;
  $$('[data-magnetic]').forEach((el) => {
    let x = 0, y = 0, tx = 0, ty = 0, raf = 0;
    const step = () => { x += (tx - x) * 0.2; y += (ty - y) * 0.2; el.style.translate = `${x.toFixed(2)}px ${y.toFixed(2)}px`; raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.05 ? requestAnimationFrame(step) : 0; };
    el.addEventListener('pointermove', (e) => { const r = el.getBoundingClientRect(); tx = (e.clientX - r.left - r.width / 2) * 0.22; ty = (e.clientY - r.top - r.height / 2) * 0.3; raf ||= requestAnimationFrame(step); });
    el.addEventListener('pointerleave', () => { tx = ty = 0; raf ||= requestAnimationFrame(step); });
  });
}

// ---------- the close: the tunnel again, backwards (stars fall into the vanishing point) ----------
function warp(cv) {
  const ctx = cv.getContext('2d');
  let w, h, dpr, S = [], run = false, speed = 0.6, lastY = scrollY;
  const size = () => {
    dpr = Math.min(devicePixelRatio || 1, 2); w = cv.clientWidth; h = cv.clientHeight;
    cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    S = Array.from({ length: Math.round(Math.min(700, (w * h) / 1600)) }, () => ({ a: Math.random() * 6.283, z: Math.random(), g: Math.random() < 0.18 }));
    if (reduced) draw(0);
  };
  const draw = (dz) => {
    ctx.fillStyle = reduced ? '#000' : 'rgba(0,0,0,0.28)'; ctx.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h * 0.42, R = Math.hypot(w, h) * 0.6;
    for (const s of S) {
      const z0 = s.z; s.z -= dz; if (s.z <= 0.02) { s.z += 1; continue; }
      const r0 = R * Math.pow(z0, 2.2), r1 = R * Math.pow(s.z, 2.2);
      const k = 1 - s.z;
      ctx.strokeStyle = s.g ? `rgba(212,175,99,${(0.15 + 0.8 * (1 - k)).toFixed(3)})` : `rgba(243,235,216,${(0.12 + 0.75 * (1 - k)).toFixed(3)})`;
      ctx.lineWidth = 0.5 + 1.4 * s.z;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(s.a) * r0, cy + Math.sin(s.a) * r0); ctx.lineTo(cx + Math.cos(s.a) * Math.min(r1, r0 - 0.8), cy + Math.sin(s.a) * Math.min(r1, r0 - 0.8)); ctx.stroke();
    }
  };
  const loop = () => { if (!run) return; const dy = Math.abs(scrollY - lastY); lastY = scrollY; speed += (0.6 + Math.min(dy, 120) / 12 - speed) * 0.08; draw(0.0016 * speed); requestAnimationFrame(loop); };
  size(); new ResizeObserver(size).observe(cv);
  if (!reduced) new IntersectionObserver(([e]) => { const was = run; run = e.isIntersecting; if (run && !was) loop(); }).observe(cv);
}

// ---------- reveal headings on view (one grammar: blur + rise) ----------
function reveals() {
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { threshold: 0.25 });
  $$('[data-reveal]').forEach((el) => io.observe(el));
}

// ---------- nav pill follows the section in view ----------
function navState() {
  const links = $$('.pills a[href^="#"]');
  const map = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
  const io = new IntersectionObserver((es) => es.forEach((e) => { const a = map.get(e.target.id); if (a && e.isIntersecting) links.forEach((l) => l.setAttribute('aria-current', String(l === a))); }), { rootMargin: '-45% 0px -50% 0px' });
  map.forEach((_, id) => { const el = document.getElementById(id); if (el) io.observe(el); });
}

$$('[data-trip]').forEach(trip);
$$('[data-creator]').forEach(creator);
$$('[data-formats]').forEach(formats);
$$('[data-warp]').forEach(warp);
minis(); tilt(); magnetic(); reveals(); navState();
addEventListener('load', () => ScrollTrigger.refresh());
document.fonts?.ready.then(() => ScrollTrigger.refresh());
