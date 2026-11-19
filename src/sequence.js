// Image-sequence scrubbing, Apple style, with one twist: all frames travel in a single
// progressive pack (coarse frames first). The film is playable end-to-end after ~15% of the
// download and sharpens as the rest arrives. Frames decode off the main thread (createImageBitmap).

export class FramePack {
  constructor(url, { maxFrames = Infinity, onFrame } = {}) {
    this.url = url;
    this.maxFrames = maxFrames;
    this.onFrame = onFrame;
    this.frames = [];
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
    const append = (chunk) => { const n = new Uint8Array(buf.length + chunk.length); n.set(buf); n.set(chunk, buf.length); buf = n; };
    const pending = [];
    for (;;) {
      const { value, done } = await reader.read();
      if (value) append(value);
      let off = 0;
      const dv = () => new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
      if (!header && buf.length >= 10) {
        if (String.fromCharCode(...buf.subarray(0, 4)) !== 'FEPK') throw new Error('bad pack');
        const v = dv();
        this.count = v.getUint16(4, true); this.width = v.getUint16(6, true); this.height = v.getUint16(8, true);
        this.frames = new Array(this.count).fill(null);
        header = true; off = 10;
      }
      if (header) {
        const v = dv();
        while (buf.length - off >= 6) {
          const idx = v.getUint16(off, true), len = v.getUint32(off + 2, true);
          if (buf.length - off - 6 < len) break;
          const bytes = buf.slice(off + 6, off + 6 + len);
          off += 6 + len;
          pending.push(this.decode(idx, bytes));
          if (pending.length >= this.maxFrames) { this.abort.abort(); await Promise.all(pending); return this; }
        }
        buf = buf.slice(off);
      }
      if (done) break;
    }
    await Promise.all(pending);
    return this;
  }

  async decode(idx, bytes) {
    const blob = new Blob([bytes], { type: 'image/webp' });
    const bmp = await (self.createImageBitmap ? createImageBitmap(blob) : new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = URL.createObjectURL(blob); }));
    this.frames[idx] = bmp;
    this.loaded++;
    this.onFrame?.(idx);
  }

  /** Nearest decoded frame to a fractional index. */
  nearest(f) {
    const i = Math.round(f);
    if (this.frames[i]) return this.frames[i];
    for (let d = 1; d < this.count; d++) {
      if (this.frames[i - d]) return this.frames[i - d];
      if (this.frames[i + d]) return this.frames[i + d];
    }
    return null;
  }
}

export class SequencePlayer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.pack = null;
    this.t = 0;
    this.last = null;
    this.resize();
  }
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.round(r.width * dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * dpr));
    this.last = null;
    this.draw(this.t);
  }
  setPack(pack) { this.pack = pack; this.last = null; }
  draw(t) {
    this.t = t;
    const p = this.pack;
    if (!p || !p.count) return;
    const img = p.nearest(t * (p.count - 1));
    if (!img || img === this.last) return;
    this.last = img;
    const { width: cw, height: ch } = this.canvas;
    const s = Math.max(cw / p.width, ch / p.height);
    const w = p.width * s, h = p.height * s;
    this.ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
  }
}
