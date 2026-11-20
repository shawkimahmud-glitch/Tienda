// Image-sequence scrubbing, Apple style, built for phones.
// All frames travel in one progressive pack (coarse frames first, then the gaps), so the film is
// playable end-to-end after a small part of the download. Frames stay COMPRESSED in memory (a few MB);
// only a small window around the playhead is decoded, at screen size, and the rest is released.
// (Decoding every frame of a 1080×1920 film would need ~1.5 GB and crash mobile Safari.)

export class FramePack {
  constructor(url, { maxFrames = Infinity, onFrame } = {}) {
    this.url = url;
    this.maxFrames = maxFrames;
    this.onFrame = onFrame;
    this.blobs = [];
    this.count = 0;
    this.loaded = 0;
    this.width = 0;
    this.height = 0;
    this.abort = new AbortController();
  }

  async load() {
    const res = await fetch(this.url, { signal: this.abort.signal });
    if (!res.ok || !res.body) throw new Error('pack ' + res.status);
    const reader = res.body.getReader();
    let buf = new Uint8Array(0);
    let header = false;
    for (;;) {
      const { value, done } = await reader.read();
      if (value) { const n = new Uint8Array(buf.length + value.length); n.set(buf); n.set(value, buf.length); buf = n; }
      let off = 0;
      if (!header && buf.length >= 10) {
        if (String.fromCharCode(buf[0], buf[1], buf[2], buf[3]) !== 'FEPK') throw new Error('bad pack');
        const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
        this.count = v.getUint16(4, true); this.width = v.getUint16(6, true); this.height = v.getUint16(8, true);
        this.blobs = new Array(this.count).fill(null);
        header = true; off = 10;
      }
      if (header) {
        const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
        while (buf.length - off >= 6) {
          const idx = v.getUint16(off, true), len = v.getUint32(off + 2, true);
          if (buf.length - off - 6 < len) break;
          this.blobs[idx] = new Blob([buf.subarray(off + 6, off + 6 + len)], { type: 'image/webp' });
          off += 6 + len;
          this.loaded++;
          this.onFrame?.(idx);
          if (this.loaded >= this.maxFrames) { this.abort.abort(); return this; }
        }
        buf = buf.slice(off);
      }
      if (done) break;
    }
    return this;
  }

  /** Index of the nearest frame that has arrived. */
  nearestLoaded(i) {
    if (this.blobs[i]) return i;
    for (let d = 1; d < this.count; d++) {
      if (this.blobs[i - d]) return i - d;
      if (this.blobs[i + d]) return i + d;
    }
    return -1;
  }
}

export class SequencePlayer {
  constructor(canvas, { cache = 12 } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.pack = null;
    this.t = 0;
    this.drawn = -1;
    this.cacheSize = cache;
    this.bitmaps = new Map(); // frame index → ImageBitmap (decoded, screen size)
    this.pending = new Map(); // frame index → Promise
    this.onReady = null;
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.round(r.width * dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * dpr));
    this.flush();
    this.drawn = -1;
    this.draw(this.t);
  }

  setPack(pack) { this.pack = pack; this.flush(); this.drawn = -1; }

  flush() { for (const b of this.bitmaps.values()) b.close?.(); this.bitmaps.clear(); }

  // decode size: cover the canvas, never larger than the source
  target() {
    const p = this.pack, { width: cw, height: ch } = this.canvas;
    const s = Math.min(1, Math.max(cw / p.width, ch / p.height));
    return { w: Math.round(p.width * s), h: Math.round(p.height * s) };
  }

  decode(i) {
    if (this.bitmaps.has(i) || this.pending.has(i) || !this.pack.blobs[i]) return;
    const { w, h } = this.target();
    const blob = this.pack.blobs[i];
    const job = createImageBitmap(blob, { resizeWidth: w, resizeHeight: h, resizeQuality: 'medium' })
      .catch(() => createImageBitmap(blob))
      .then((bmp) => {
        this.pending.delete(i);
        this.bitmaps.set(i, bmp);
        this.evict();
        this.onReady?.(i);
      })
      .catch(() => this.pending.delete(i));
    this.pending.set(i, job);
  }

  evict() {
    if (this.bitmaps.size <= this.cacheSize) return;
    const at = Math.round(this.t * (this.pack.count - 1));
    const far = [...this.bitmaps.keys()].sort((a, b) => Math.abs(b - at) - Math.abs(a - at));
    while (this.bitmaps.size > this.cacheSize && far.length) { const k = far.shift(); if (k === this.drawn) continue; this.bitmaps.get(k)?.close?.(); this.bitmaps.delete(k); }
  }

  draw(t) {
    const p = this.pack;
    const dir = t >= this.t ? 1 : -1;
    this.t = t;
    if (!p || !p.count) return;
    const want = p.nearestLoaded(Math.round(t * (p.count - 1)));
    if (want < 0) return;
    // decode the wanted frame and a few ahead in the direction of travel
    this.decode(want);
    for (let k = 1; k <= 3; k++) { const j = p.nearestLoaded(want + dir * k); if (j >= 0) this.decode(j); }
    let show = want;
    if (!this.bitmaps.has(show)) {
      // until it is decoded, keep the closest frame we already have on screen
      let best = -1, bd = Infinity;
      for (const k of this.bitmaps.keys()) { const d = Math.abs(k - want); if (d < bd) { bd = d; best = k; } }
      if (best < 0) return;
      show = best;
    }
    if (show === this.drawn) return;
    this.drawn = show;
    const img = this.bitmaps.get(show);
    const { width: cw, height: ch } = this.canvas;
    const s = Math.max(cw / img.width, ch / img.height);
    const w = img.width * s, h = img.height * s;
    this.ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
  }
}
