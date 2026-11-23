// Real sky for a date, time and place, and the lámina drawn from it.
// Stars: J2000 catalogue (d3-celestial). Precession since 2000 is < 0.4°, below what a print shows.
import { STARS, LINES, CITIES } from './data.js';

export { CITIES };
const D2R = Math.PI / 180;

const julian = (ms) => ms / 86400000 + 2440587.5;
const gmst = (jd) => (((280.46061837 + 360.98564736629 * (jd - 2451545.0)) % 360) + 360) % 360;

function tzOffsetMin(ms, tz) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const p = {};
  for (const x of f.formatToParts(new Date(ms))) p[x.type] = x.value;
  return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - ms) / 60000;
}

/** Local wall-clock time in a time zone → epoch ms. */
export function localToUTC(dateStr, timeStr, tz = 'Europe/Madrid') {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = (timeStr || '22:00').split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh || 0, mm || 0);
  let ms = guess - tzOffsetMin(guess, tz) * 60000;
  ms = guess - tzOffsetMin(ms, tz) * 60000;
  return ms;
}

export const cityByName = (name) => CITIES.find((c) => c[0] === name) || CITIES[0];
export const tzFor = (city) => (city[3] ? 'Atlantic/Canary' : 'Europe/Madrid');

/**
 * Stereographic projection of the sky seen looking straight up.
 * Unit disk: zenith at (0,0), horizon at r = 1, north up, east left (as on a real star chart).
 */
export function computeSky({ date, time, lat, lon, tz }) {
  const ms = localToUTC(date, time, tz);
  const lst = gmst(julian(ms)) + lon;
  const sp = Math.sin(lat * D2R), cp = Math.cos(lat * D2R);
  const proj = (ra, dec) => {
    const H = (lst - ra) * D2R, d = dec * D2R;
    const sd = Math.sin(d), cd = Math.cos(d), cH = Math.cos(H);
    const sinAlt = sd * sp + cd * cp * cH;
    const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
    const az = Math.atan2(-cd * Math.sin(H), sd * cp - cd * sp * cH);
    const r = Math.tan((Math.PI / 2 - alt) / 2);
    return [-r * Math.sin(az), -r * Math.cos(az), alt];
  };
  const stars = [];
  for (let i = 0; i < STARS.length; i += 3) {
    const [x, y, alt] = proj(STARS[i] / 20, STARS[i + 1] / 20);
    if (alt < -0.01) continue;
    stars.push({ x, y, mag: STARS[i + 2] / 10 });
  }
  const lines = [];
  for (const seg of LINES) {
    let prev = null;
    for (let i = 0; i < seg.length; i += 2) {
      const p = proj(seg[i] / 20, seg[i + 1] / 20);
      if (prev && prev[2] > 0.02 && p[2] > 0.02) lines.push([prev[0], prev[1], p[0], p[1]]);
      prev = p;
    }
  }
  return { stars, lines, ms };
}

// ---------- formatting ----------
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const fmtDateDots = (date) => { const [y, m, d] = date.split('-'); return `${d}/${m}/${y}`; };
export const fmtDateLong = (date) => { const [y, m, d] = date.split('-').map(Number); return `${d} de ${MONTHS[m - 1]} de ${y}`; };
export function fmtCoord(v, pos, neg) {
  const a = Math.abs(v), d = Math.floor(a), m = Math.round((a - d) * 60);
  return `${d}°${String(m === 60 ? 0 : m).padStart(2, '0')}′${v >= 0 ? pos : neg}`;
}
export const fmtCoords = (lat, lon) => `${fmtCoord(lat, 'N', 'S')} · ${fmtCoord(lon, 'E', 'O')}`;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Poster geometry, shared with the particle morph so both land on the same pixels.
export const POSTER = { w: 300, h: 400, cx: 150, cy: 150, r: 106, namesY: 296, phraseY: 316, lineY: 330, cityY: 347, dateY: 359, coordY: 371 };
export const starRadius = (mag) => Math.max(0.32, 1.9 - mag * 0.3);

export const PALETTES = {
  noche: { bg: '#0B1426', disc: '#08101F', ink: '#F3EBD8', gold: '#D4AF63', line: 'rgba(212,175,99,.55)', sub: 'rgba(243,235,216,.72)' },
  marfil: { bg: '#F3EBD8', disc: '#EFE5CF', ink: '#0B1426', gold: '#9A7A36', line: 'rgba(11,20,38,.42)', sub: 'rgba(11,20,38,.7)' },
};

/** The lámina as an SVG string. */
export function posterSVG(o) {
  const P = POSTER;
  const c = PALETTES[o.style] || PALETTES.noche;
  const city = Array.isArray(o.city) ? o.city : cityByName(o.cityName || o.city || 'Madrid');
  const lat = o.lat ?? city[1], lon = o.lon ?? city[2];
  const sky = o.sky || computeSky({ date: o.date, time: o.time, lat, lon, tz: tzFor(city) });
  const id = o.id || 'p' + Math.random().toString(36).slice(2, 7);
  const sx = (x) => (P.cx + x * P.r).toFixed(2), sy = (y) => (P.cy + y * P.r).toFixed(2);
  let ticks = '';
  for (let a = 0; a < 360; a += 5) {
    const r0 = P.r + 3, r1 = P.r + (a % 30 ? 5 : 8), t = a * D2R;
    ticks += `M${(P.cx + Math.cos(t) * r0).toFixed(2)} ${(P.cy + Math.sin(t) * r0).toFixed(2)}L${(P.cx + Math.cos(t) * r1).toFixed(2)} ${(P.cy + Math.sin(t) * r1).toFixed(2)}`;
  }
  let lines = '';
  for (const [x1, y1, x2, y2] of sky.lines) lines += `M${sx(x1)} ${sy(y1)}L${sx(x2)} ${sy(y2)}`;
  let stars = '';
  for (const s of sky.stars) {
    const rr = starRadius(s.mag);
    stars += `<circle cx="${sx(s.x)}" cy="${sy(s.y)}" r="${rr.toFixed(2)}"${s.mag < 1.5 ? ` fill="${c.gold}"` : ''}/>`;
  }
  const label = `Mapa estelar de ${esc(city[0])} el ${fmtDateLong(o.date)} a las ${esc(o.time)}${o.names ? ', para ' + esc(o.names) : ''}`;
  return `<svg viewBox="0 0 ${P.w} ${P.h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label}" class="fe-poster-svg">
<rect width="${P.w}" height="${P.h}" fill="${c.bg}"/>
<rect x="11" y="11" width="278" height="378" fill="none" stroke="${c.gold}" stroke-width=".6"/>
<rect x="14.5" y="14.5" width="271" height="371" fill="none" stroke="${c.gold}" stroke-width=".25" opacity=".7"/>
<defs><clipPath id="${id}c"><circle cx="${P.cx}" cy="${P.cy}" r="${P.r}"/></clipPath></defs>
<circle cx="${P.cx}" cy="${P.cy}" r="${P.r}" fill="${c.disc}" stroke="${c.gold}" stroke-width=".7"/>
<circle cx="${P.cx}" cy="${P.cy}" r="${P.r + 3}" fill="none" stroke="${c.gold}" stroke-width=".25"/>
<path d="${ticks}" stroke="${c.gold}" stroke-width=".3"/>
<g clip-path="url(#${id}c)"><path class="fe-poster-lines" d="${lines}" fill="none" stroke="${c.line}" stroke-width=".42" stroke-linecap="round"/>
<g class="fe-poster-stars" fill="${c.ink}">${stars}</g></g>
<g text-anchor="middle">
<text x="150" y="${P.namesY}" font-family="'Instrument Serif',Georgia,serif" font-size="25" fill="${c.ink}" letter-spacing=".2">${esc(o.names)}</text>
<text x="150" y="${P.phraseY}" font-family="'Instrument Serif',Georgia,serif" font-style="italic" font-size="10.5" fill="${c.gold}">${esc(o.phrase)}</text>
<path d="M128 ${P.lineY}H172" stroke="${c.gold}" stroke-width=".4"/>
<text x="150" y="${P.cityY}" font-family="'Geist',system-ui,sans-serif" font-size="6.6" font-weight="600" letter-spacing="2.6" fill="${c.ink}">${esc(city[0].toUpperCase())}</text>
<text x="150" y="${P.dateY}" font-family="'Geist',system-ui,sans-serif" font-size="6" letter-spacing="1.8" fill="${c.sub}">${fmtDateDots(o.date)} · ${esc(o.time)}</text>
<text x="150" y="${P.coordY}" font-family="'Geist',system-ui,sans-serif" font-size="5.6" letter-spacing="1.4" fill="${c.sub}">${fmtCoords(lat, lon)}</text>
</g></svg>`;
}
