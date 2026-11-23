// Fecha Estelar — «El túnel de estrellas».
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { FramePack, SequencePlayer } from './sequence.js';
import { sunOverlay } from './sunlive.js';
import { posterSVG, CITIES, cityByName, fmtCoords, fmtDateDots } from './sky.js';

gsap.registerPlugin(ScrollTrigger);
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const eio = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const mq = (q) => matchMedia(q).matches;
const root = document.documentElement;
const reduced = mq('(prefers-reduced-motion: reduce)');
const fine = mq('(hover: hover) and (pointer: fine)');
const conn = navigator.connection || {};
const slow = !!conn.saveData || /2g/.test(conn.effectiveType || '');
root.classList.add('fe-js');
if (reduced) root.classList.add('fe-reduced');
window.__feBoot = true;
// keep amounts and their units together: «9,99 €», «4–8 días», «30×40 cm»
const nb = (t) => t.replace(/(\d) (?=€|días|cm|h\b)/g, '$1\u00a0');
{
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) if (/\d (€|días|cm|h\b)/.test(n.data)) n.data = nb(n.data);
}

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

// ---------- stops: one gesture carries the film to the next stop ----------
// Four resting points (the star, the Sun, the Earth, the sky), each with its headline fully on screen.
// Inside the journey a wheel gesture, a swipe or a key press glides to the next stop in that direction;
// the rest of the page scrolls normally. Momentum and scrollbar drags settle on the nearest stop ahead.
const STOPS = [0, 0.35, 0.67, 1];
function stops(sec) {
  let busy = false, raf = 0, lastWheel = 0, lastAbs = 0, landed = 0, wheelDone = false, touch = null, lastY = scrollY, dir = 1, lastMove = 0;
  const top = () => sec.getBoundingClientRect().top + scrollY;
  const run = () => sec.offsetHeight - innerHeight;
  const cur = () => clamp((scrollY - top()) / run());
  const inside = () => { const r = sec.getBoundingClientRect(); return r.top <= 1 && r.bottom >= innerHeight - 1; };
  const next = (d) => { const c = cur(); return d > 0 ? STOPS.find((s) => s > c + 0.012) : [...STOPS].reverse().find((s) => s < c - 0.012); };
  const glide = (s) => {
    const from = scrollY, to = Math.round(top() + s * run()), dist = Math.abs(to - from);
    if (dist < 2) return;
    const dur = Math.min(1700, 700 + (dist / innerHeight) * 520);
    busy = true;
    const done = () => { busy = false; lastMove = landed = performance.now(); };
    if (lenis) { lenis.scrollTo(to, { duration: dur / 1000, easing: eio, lock: true, force: true, onComplete: done }); return; }
    const t0 = performance.now();
    cancelAnimationFrame(raf);
    const step = (now) => { const k = clamp((now - t0) / dur); scrollTo(0, from + (to - from) * eio(k)); if (k < 1) raf = requestAnimationFrame(step); else done(); };
    raf = requestAnimationFrame(step);
  };
  const go = (d) => { const s = next(d); if (s == null) return false; glide(s); return true; };

  // wheel / trackpad: one gesture = one stop; its inertia tail is swallowed
  addEventListener('wheel', (e) => {
    if (e.ctrlKey || !inside()) return;
    const d = Math.sign(e.deltaY); if (!d) return;
    // a new gesture is a real pause, or a fresh push (the delta rises instead of decaying like an inertia tail)
    const now = performance.now(), gap = now - lastWheel, abs = Math.abs(e.deltaY);
    // (a long pause only counts once the last flick had died down, or between mouse-wheel notches,
    //  so a stall in the middle of an inertia tail does not fire a second stop)
    const fresh = (gap > 600 && (lastAbs < 8 || (abs >= 50 && lastAbs >= 50))) || gap > 1400 || (gap > 160 && abs > lastAbs * 1.15) || (abs > lastAbs * 2 && abs > 14);
    lastWheel = now; lastAbs = abs;
    if (fresh && !busy && now - landed > 250) wheelDone = false; // a pause, once the glide has landed, starts a new gesture
    if (!busy && !wheelDone && next(d) == null) return; // at an end: the page carries on
    e.preventDefault(); e.stopImmediatePropagation();
    if (!busy && !wheelDone) { wheelDone = go(d); }
  }, { passive: false, capture: true });

  // touch: a vertical swipe inside the journey moves one stop; horizontal drags (the lámina) pass
  addEventListener('touchstart', (e) => { touch = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY, done: false, free: false } : null; }, { passive: true });
  addEventListener('touchmove', (e) => {
    if (!touch || touch.free || !inside()) return;
    const dy = touch.y - e.touches[0].clientY, dx = touch.x - e.touches[0].clientX;
    if (!touch.done && !busy && Math.abs(dy) > 2 && next(Math.sign(dy)) == null) { touch.free = true; return; } // at an end: native scroll
    if (e.cancelable) e.preventDefault();
    if (!touch.done && !busy && Math.abs(dy) > 28 && Math.abs(dy) > Math.abs(dx) * 1.2) touch.done = go(Math.sign(dy));
  }, { passive: false });
  addEventListener('touchend', () => { touch = null; }, { passive: true });

  // keys, scrollbar, momentum: settle on the next stop in the direction of travel
  addEventListener('scroll', () => { const y = scrollY; if (y !== lastY) { dir = Math.sign(y - lastY); lastY = y; lastMove = performance.now(); } }, { passive: true });
  const settle = () => {
    requestAnimationFrame(settle);
    if (busy || touch || performance.now() - lastMove < 170 || performance.now() - lastWheel < 200 || !inside()) return;
    const c = cur();
    if (STOPS.some((s) => Math.abs(s - c) < 0.006)) return;
    const s = next(dir) ?? next(-dir); if (s != null) glide(s);
  };
  requestAnimationFrame(settle);
}

// ---------- the journey: a golden star, then the Sun, the Earth and the sky, in two screens ----------
// Scroll progress p (0..1 over the section) maps to the time t of the pre-rendered film, so the four
// stops land on the star, the Sun (0.50), the Earth (0.68) and the drawn constellations (0.87).
const PT = [0.41, 0.5, 0.68, 0.87];
const tOf = (p) => { for (let i = 0; i < 3; i++) if (p <= STOPS[i + 1]) return PT[i] + (PT[i + 1] - PT[i]) * clamp((p - STOPS[i]) / (STOPS[i + 1] - STOPS[i])); return PT[3]; };
// the packs hold only this stretch of the full render (frames i0..i1 of `full`)
const FILM = { m: { file: 'fe-film-m.bin', full: 180, i0: 71, i1: 158 }, d: { file: 'fe-film-d.bin', full: 150, i0: 59, i1: 132 } };
const ss = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };

function trip(sec) {
  const stage = $('.trip__stage', sec);
  const canvas = $('.trip__film', sec);
  const hero = $('.trip__hero', sec);
  const starCv = $('.trip__star', sec);
  const beats = $$('[data-beat]', sec);
  beats.forEach((b) => { b.inert = !b.hasAttribute('data-on'); });
  const portrait = innerHeight > innerWidth;
  const film = portrait ? FILM.m : FILM.d;
  const media = sec.dataset.media;
  const gl = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } })();
  // less motion asked, or nothing to draw with: the still star and the first headline
  if (reduced || (!gl && !window.createImageBitmap)) { sec.classList.add('is-still'); return; }

  let target = 0, p = 0, dirty = true, visible = true, player = null, sunLive = null, star = null;
  ScrollTrigger.create({ trigger: sec, start: 'top top', end: 'bottom bottom', onUpdate: (s) => { target = s.progress; dirty = true; } });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(sec);

  const useFrames = () => {
    player = new SequencePlayer(canvas, { cache: portrait ? 10 : 14 });
    player.onReady = () => { dirty = true; };
    sec.__player = player;
    const pack = new FramePack(media + film.file, { maxFrames: slow ? 24 : Infinity, onFrame: () => { dirty = true; } });
    player.setPack(pack);
    pack.load().catch(() => {});
    // the frames hold the film; a tiny live layer keeps the sun's surface boiling while you rest on it
    if (!slow && gl) sunLive = sunOverlay(stage, canvas, media + (portrait ? 'fe-sun-m.json' : 'fe-sun-d.json'));
  };

  // ---- the star follows the finger, the pointer and the gyroscope ----
  const inp = { x: 0, y: 0, tx: 0, ty: 0, spin: 0, v: 0, drag: null, gyro: null, asked: false };
  stage.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') { inp.tx = (e.clientX / innerWidth) * 2 - 1; inp.ty = (e.clientY / innerHeight) * 2 - 1; }
    else if (inp.drag) { const dx = e.clientX - inp.drag.x; inp.drag.x = e.clientX; inp.v = dx * 0.012; inp.spin += dx * 0.012; }
  });
  stage.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') inp.drag = { x: e.clientX, x0: e.clientX, y0: e.clientY }; });
  const askGyro = () => {
    const D = window.DeviceOrientationEvent;
    if (D && typeof D.requestPermission === 'function' && !inp.asked) { inp.asked = true; D.requestPermission().catch(() => {}); }
  };
  stage.addEventListener('pointerup', (e) => {
    // a tap on the star: iOS asks once for the motion sensor
    if (inp.drag && Math.hypot(e.clientX - inp.drag.x0, e.clientY - inp.drag.y0) < 8 && p < 0.1) askGyro();
    inp.drag = null;
  });
  stage.addEventListener('pointercancel', () => { inp.drag = null; });
  addEventListener('deviceorientation', (e) => {
    if (e.beta == null) return;
    inp.gyro ??= { b: e.beta, g: e.gamma };
    inp.tx = clamp((e.gamma - inp.gyro.g) / 22, -1, 1); inp.ty = clamp((e.beta - inp.gyro.b) / 22, -1, 1);
  });

  // Three.js arrives after the page has loaded: the first paint is the still star, which the live one replaces
  const useStar = async () => {
    if (!gl) return;
    try {
      const { createStar } = await import('./scene/star.js');
      star = createStar({ canvas: starCv });
      star.dpr = Math.min(devicePixelRatio || 1, portrait ? 1.75 : 1.5);
      star.resize(stage.clientWidth, stage.clientHeight, star.dpr);
      star.t0 = performance.now() / 1000 - 2.2; // the still was rendered at t = 2.2 s: the live star takes over without a jump
      star.frame(2.2, { x: 0, y: 0, spin: 0, dive: 0 });
      requestAnimationFrame(() => sec.classList.add('has-star'));
    } catch { star = null; }
  };
  const start = async () => { await useStar(); useFrames(); };
  if (document.readyState === 'complete') setTimeout(start, 30); else addEventListener('load', () => setTimeout(start, 30), { once: true });

  const progress = $('.trip__progress i', sec), last = {};
  let lastT = 0; const ft = [];
  const tick = (time) => {
    if (!visible) return;
    const dt = lastT ? Math.min(0.05, (time - lastT) / 1000) : 0.016; lastT = time;
    const d = target - p;
    p = Math.abs(d) < 0.0002 ? target : p + d * (fine ? 0.14 : 0.2);
    const t = tOf(p);

    // the star: drawn only while it is on screen; it dives into the light as the film takes over
    const ha = (1 - ss((p - 0.05) / 0.2)).toFixed(3);
    if (ha !== last.ha) { hero.style.opacity = ha; hero.style.visibility = ha === '0.000' ? 'hidden' : ''; last.ha = ha; }
    if (star && ha !== '0.000') {
      inp.x += (inp.tx - inp.x) * Math.min(1, dt * 4); inp.y += (inp.ty - inp.y) * Math.min(1, dt * 4);
      if (!inp.drag) { inp.spin += inp.v; inp.v *= Math.exp(-dt * 3); }
      star.frame(performance.now() / 1000 - star.t0, { x: inp.x, y: inp.y, spin: inp.spin, dive: clamp(p / 0.24) });
      // a phone that cannot keep up gets fewer pixels, then the still star
      ft.push(dt); if (ft.length > 40) ft.shift();
      const avg = ft.reduce((a, b) => a + b, 0) / ft.length;
      if (ft.length === 40 && avg > 0.045 && !/[?&]fe=live/.test(location.search)) {
        ft.length = 0;
        if (star.dpr > 1) { star.dpr = 1; star.resize(stage.clientWidth, stage.clientHeight, 1); }
        else { sec.classList.remove('has-star'); star.dispose(); star = null; }
      }
    }

    const fa = ss((p - 0.03) / 0.12).toFixed(3);
    if (fa !== last.fa) { canvas.style.opacity = fa; last.fa = fa; }
    if (!dirty && p === target) return;
    dirty = false;
    if (player) { player.draw(clamp((t * (film.full - 1) - film.i0) / (film.i1 - film.i0))); sunLive?.update(t, player.pack); }
    const bar = p.toFixed(4);
    if (bar !== last.bar && progress) { progress.style.transform = `scaleX(${bar})`; last.bar = bar; }
    const pc = p * 100;
    for (const b of beats) {
      const on = pc >= +b.dataset.from && pc < +b.dataset.to;
      if (on !== b.hasAttribute('data-on')) { b.toggleAttribute('data-on', on); b.inert = !on; }
    }
  };
  gsap.ticker.add((tm) => tick(tm * 1000));
  stops(sec);
  new ResizeObserver(() => { player?.resize(); star?.resize(stage.clientWidth, stage.clientHeight, star.dpr); dirty = true; }).observe(stage);
}

// ---------- creator: the lámina redraws as you type ----------
// Date and time are typed the Spanish way (DD/MM/AAAA, 24 h) whatever the browser's locale:
// the slashes and the colon appear on their own, and the lámina keeps the last valid value.
const state = { names: '', phrase: '', city: 'Madrid', date: '2021-05-14', time: '22:00', style: 'noche' };
const maskDate = (v) => { const d = v.replace(/\D/g, '').slice(0, 8); return [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join('/'); };
const maskTime = (v) => { const d = v.replace(/\D/g, '').slice(0, 4); return d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d; };
const isoDate = (v) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v); if (!m) return null;
  const [, d, mo, y] = m.map(Number), dt = new Date(Date.UTC(y, mo - 1, d));
  if (y < 1900 || y > 2100 || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
};
const isoTime = (v) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : null);
function creator(sec) {
  const form = $('[data-form]', sec), prev = $('[data-preview]', sec), coords = $('[data-coords]', sec);
  if (!form) return;
  const sel = form.elements.city, cur = sel.value || 'Madrid';
  sel.innerHTML = CITIES.map((c) => `<option${c[0] === cur ? ' selected' : ''}>${c[0]}</option>`).join('');
  const fd = form.elements.date, ftm = form.elements.time;
  let raf = 0;
  const draw = () => {
    raf = 0;
    const f = form.elements;
    const date = isoDate(fd.value), time = isoTime(ftm.value);
    fd.setAttribute('aria-invalid', String(fd.value.length === 10 && !date));
    ftm.setAttribute('aria-invalid', String(ftm.value.length === 5 && !time));
    Object.assign(state, { names: f.names.value.trim(), phrase: f.phrase.value.trim(), city: f.city.value, date: date || state.date, time: time || state.time, style: form.querySelector('[name=style]:checked')?.value || 'noche' });
    prev.innerHTML = posterSVG({ ...state, names: state.names || 'Vuestros nombres', cityName: state.city, id: 'cp' });
    const c = cityByName(state.city);
    coords.textContent = nb(`${c[0]} · ${fmtCoords(c[1], c[2])} · ${fmtDateDots(state.date)} · ${state.time}`);
  };
  const mask = (el, fn) => el.addEventListener('input', (e) => {
    if (e.inputType?.startsWith('delete')) return; // let backspace remove a slash or the colon
    const v = fn(el.value); if (v !== el.value) el.value = v;
  });
  mask(fd, maskDate); mask(ftm, maskTime);
  form.addEventListener('input', () => { raf ||= requestAnimationFrame(draw); });
  form.addEventListener('submit', (e) => e.preventDefault());
  if (reduced) draw(); else new IntersectionObserver(([e], o) => { if (e.isIntersecting) { draw(); o.disconnect(); } }, { rootMargin: '600px' }).observe(sec);
}

// ---------- formats: total, buy link, honest urgency ----------
function formats(sec) {
  const total = $('[data-total]', sec), buy = $('[data-buy]', sec), urge = $('[data-urge]', sec);
  const upd = () => {
    const r = $('input[name=format]:checked', sec);
    if (!r) return;
    total.textContent = nb(r.dataset.price);
    sec.toggleAttribute('data-digital', r.hasAttribute('data-digital')); // shipping facts only for printed láminas
    const u = new URL(sec.dataset.base, location.href);
    if (r.value) u.searchParams.set('variant', r.value);
    buy.href = u.pathname + u.search;
  };
  sec.addEventListener('change', upd); upd();
  const dl = sec.dataset.deadline;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dl)) {
    const end = new Date(dl + 'T23:59:59');
    const [y, m, d] = dl.split('-');
    urge.textContent = Date.now() > end ? urge.dataset.after : urge.dataset.before.replace('[FECHA]', `${d}/${m}/${y}`);
  }
}

// ---------- small láminas ----------
function minis() {
  const draw = (el) => { const d = el.dataset; el.innerHTML = posterSVG({ names: d.names, phrase: d.phrase, cityName: d.city, date: d.date, time: d.time, style: d.style, id: 'm' + Math.random().toString(36).slice(2, 6) }); };
  if (reduced) return $$('[data-mini]').forEach(draw);
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { draw(e.target); io.unobserve(e.target); } }), { rootMargin: '600px' });
  $$('[data-mini]').forEach((el) => io.observe(el));
}

// ---------- cards that lean toward the pointer (spring), fine pointers only ----------
function tilt() {
  if (reduced) return;
  if (!fine) {
    // touch: in the swipe carousel each card leans by how far it sits from the centre of the screen
    $$('.moments').forEach((row) => {
      const cards = $$('[data-tilt]', row);
      let raf = 0;
      const lean = () => {
        raf = 0;
        const mid = innerWidth / 2;
        for (const c of cards) {
          const r = c.getBoundingClientRect();
          const k = clamp(((r.left + r.width / 2) - mid) / innerWidth, -1, 1);
          c.style.transform = `rotateY(${(-k * 16).toFixed(2)}deg) scale(${(1 - Math.abs(k) * 0.05).toFixed(3)})`;
        }
      };
      row.addEventListener('scroll', () => { raf ||= requestAnimationFrame(lean); }, { passive: true });
      lean();
    });
    return;
  }
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
  if (reduced) { $$('[data-reveal]').forEach((el) => el.classList.add('is-in')); return; }
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

// ---------- the phone's buy button: always there, except while the creator is on screen ----------
function buyBar() {
  const bar = $('[data-bar]'), maker = $('[data-creator]');
  if (!bar || !maker) return;
  new IntersectionObserver(([e]) => { bar.toggleAttribute('data-away', e.isIntersecting); }, { threshold: 0.12 }).observe(maker);
}

$$('[data-trip]').forEach(trip);
$$('[data-creator]').forEach(creator);
$$('[data-formats]').forEach(formats);
$$('[data-warp]').forEach(warp);
minis(); tilt(); magnetic(); reveals(); navState(); buyBar();
addEventListener('load', () => ScrollTrigger.refresh());
document.fonts?.ready.then(() => ScrollTrigger.refresh());
