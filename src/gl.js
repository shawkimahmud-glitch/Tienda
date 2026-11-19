// Real-time part of the journey: the frozen sky over the city, its constellations drawn in gold,
// and thousands of GPU particles that fly into the lámina. Loaded lazily (dynamic import).
import { WebGLRenderer, Scene, OrthographicCamera, BufferGeometry, BufferAttribute, ShaderMaterial, Points, LineSegments, AdditiveBlending, Color } from 'three';
import { computeSky, POSTER, starRadius } from './sky.js';

const FONT_SERIF = "'Bodoni Moda', Didot, serif";
const FONT_SANS = 'Manrope, system-ui, sans-serif';

export class SkyGL {
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.o = opts; // { names, phrase, cityName, city, date, time, posterEl, lite }
    this.renderer = new WebGLRenderer({ canvas, alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.scene = new Scene();
    this.camera = new OrthographicCamera(0, 1, 0, 1, -1, 1);
    this.state = { sky: 0, lines: 0, morph: 0, alpha: 0, time: 0 };
    this.sky = computeSky({ date: opts.date, time: opts.time, lat: opts.city[1], lon: opts.city[2], tz: opts.city[3] ? 'Atlantic/Canary' : 'Europe/Madrid' });
    this.dust = opts.lite ? 1800 : 5200;
    this.build();
    this.resize();
  }

  // ---- static attributes (randomness, sizes) ----
  build() {
    const S = this.sky.stars, N = S.length + this.dust;
    this.N = N;
    const g = new BufferGeometry();
    this.aSky = new Float32Array(N * 2);
    this.aPoster = new Float32Array(N * 2);
    const aSize = new Float32Array(N * 2), aSeed = new Float32Array(N), aKind = new Float32Array(N);
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < N; i++) {
      aSeed[i] = rnd();
      if (i < S.length) { aKind[i] = 1; aSize[i * 2] = starRadius(S[i].mag); aSize[i * 2 + 1] = S[i].mag; }
      else { aKind[i] = 0; aSize[i * 2] = 0.35 + rnd() * 0.5; aSize[i * 2 + 1] = 6; }
    }
    this.rand = Array.from({ length: this.dust }, () => [rnd(), rnd(), rnd()]);
    g.setAttribute('position', new BufferAttribute(new Float32Array(N * 3), 3));
    g.setAttribute('aSky', new BufferAttribute(this.aSky, 2));
    g.setAttribute('aPoster', new BufferAttribute(this.aPoster, 2));
    g.setAttribute('aSize', new BufferAttribute(aSize, 2));
    g.setAttribute('aSeed', new BufferAttribute(aSeed, 1));
    g.setAttribute('aKind', new BufferAttribute(aKind, 1));
    this.uniforms = {
      uMorph: { value: 0 }, uSky: { value: 0 }, uTime: { value: 0 }, uAlpha: { value: 1 },
      uSkyScale: { value: 1 }, uPosterScale: { value: 1 }, uDpr: { value: 1 },
      uGold: { value: new Color('#D4AF63') }, uIvory: { value: new Color('#F3EBD8') },
    };
    const mat = new ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthTest: false, depthWrite: false, blending: AdditiveBlending, premultipliedAlpha: true,
      vertexShader: /* glsl */ `
        attribute vec2 aSky; attribute vec2 aPoster; attribute vec2 aSize; attribute float aSeed; attribute float aKind;
        uniform float uMorph; uniform float uSky; uniform float uTime; uniform float uSkyScale; uniform float uPosterScale; uniform float uDpr;
        varying float vA; varying float vGold; varying float vM;
        float ease(float x){ return x<.5 ? 4.*x*x*x : 1.-pow(-2.*x+2.,3.)/2.; }
        void main(){
          float m = ease(clamp(uMorph*1.45 - aSeed*0.45, 0., 1.));
          vec2 d = aPoster - aSky;
          vec2 n = vec2(-d.y, d.x);
          vec2 p = mix(aSky, aPoster, m) + n * sin(m*3.14159) * (0.18 + aSeed*0.22);
          // stars appear brightest first, as the eye adapts to the dark
          float appear = clamp(uSky*1.6 - (aSize.y + 1.5)/7.5*0.9 - aSeed*0.1, 0., 1.);
          float tw = 0.78 + 0.22*sin(uTime*(1.2+aSeed*2.4) + aSeed*40.);
          float skyA = aKind > .5 ? appear*tw : 0.22*appear*(0.5+0.5*sin(uTime*0.7+aSeed*30.));
          vA = mix(skyA, 1., m);
          vM = m;
          vGold = aKind > .5 ? step(aSize.y, 1.5) : 1.;
          float sizeSky = aKind > .5 ? aSize.x*uSkyScale*2.4 : 1.1;
          float sizePoster = aSize.x*uPosterScale*2.0;
          gl_PointSize = max(1., mix(sizeSky, sizePoster, m) * uDpr + (aKind > .5 ? 2.0*uDpr*(1.-m) : 0.));
          gl_Position = projectionMatrix * vec4(p, 0., 1.);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uGold; uniform vec3 uIvory; uniform float uAlpha;
        varying float vA; varying float vGold; varying float vM;
        void main(){
          vec2 q = gl_PointCoord*2.-1.; float r = dot(q,q);
          float core = smoothstep(1., 0.25, r);
          float halo = exp(-r*3.5) * (1.-vM) * 0.6;
          vec3 c = mix(uIvory, uGold, vGold);
          float a = clamp((core+halo)*vA*uAlpha, 0., 1.);
          gl_FragColor = vec4(c*a, a);
        }`,
    });
    this.points = new Points(g, mat);
    this.points.frustumCulled = false;
    this.scene.add(this.points);

    // constellation lines, drawn in order, morphing with their stars
    const L = this.sky.lines;
    const lg = new BufferGeometry();
    this.lSky = new Float32Array(L.length * 4);
    this.lPoster = new Float32Array(L.length * 4);
    const lOrder = new Float32Array(L.length * 2), lEnd = new Float32Array(L.length * 2);
    // order by angle around the zenith, so the gold spreads like a hand drawing
    const ord = L.map((l, i) => [i, Math.atan2(l[1] + l[3], l[0] + l[2])]).sort((a, b) => a[1] - b[1]);
    ord.forEach(([i], k) => { lOrder[i * 2] = lOrder[i * 2 + 1] = k / L.length; lEnd[i * 2] = 0; lEnd[i * 2 + 1] = 1; });
    lg.setAttribute('position', new BufferAttribute(new Float32Array(L.length * 6), 3));
    lg.setAttribute('aSky', new BufferAttribute(this.lSky, 2));
    lg.setAttribute('aPoster', new BufferAttribute(this.lPoster, 2));
    lg.setAttribute('aOrder', new BufferAttribute(lOrder, 1));
    lg.setAttribute('aEnd', new BufferAttribute(lEnd, 1));
    this.lUniforms = { uDraw: { value: 0 }, uMorph: this.uniforms.uMorph, uGold: this.uniforms.uGold, uAlpha: this.uniforms.uAlpha };
    const lm = new ShaderMaterial({
      uniforms: this.lUniforms, transparent: true, depthTest: false, depthWrite: false, blending: AdditiveBlending, premultipliedAlpha: true,
      vertexShader: /* glsl */ `attribute vec2 aSky; attribute vec2 aPoster; attribute float aOrder; attribute float aEnd;
        uniform float uMorph; uniform float uDraw; varying float vK; varying float vEnd;
        float ease(float x){ return x<.5 ? 4.*x*x*x : 1.-pow(-2.*x+2.,3.)/2.; }
        void main(){ float m = ease(clamp(uMorph*1.3, 0., 1.));
          vK = clamp((uDraw*1.25 - aOrder)*6., 0., 1.); vEnd = aEnd;
          gl_Position = projectionMatrix * vec4(mix(aSky, aPoster, m), 0., 1.); }`,
      fragmentShader: /* glsl */ `uniform vec3 uGold; uniform float uAlpha; varying float vK; varying float vEnd;
        void main(){ if (vEnd > vK) discard; float a = 0.62*uAlpha; gl_FragColor = vec4(uGold*a, a); }`,
    });
    this.lines = new LineSegments(lg, lm);
    this.lines.frustumCulled = false;
    this.scene.add(this.lines);
  }

  // ---- layout-dependent targets ----
  layout() {
    const w = this.w, h = this.h;
    const S = this.sky.stars;
    // the sky: zenith at the centre, horizon beyond the corners
    const R = Math.hypot(w, h) * 0.5 * 1.02;
    const cx = w / 2, cy = h / 2;
    // the lámina, as it sits in the DOM
    const pr = this.o.posterEl.getBoundingClientRect();
    const k = pr.width / POSTER.w;
    const px = (x) => pr.left + (POSTER.cx + x * POSTER.r) * k;
    const py = (y) => pr.top + (POSTER.cy + y * POSTER.r) * k;
    this.uniforms.uSkyScale.value = Math.min(1.6, Math.max(0.9, R / 520));
    this.uniforms.uPosterScale.value = k;
    for (let i = 0; i < S.length; i++) {
      this.aSky[i * 2] = cx + S[i].x * R; this.aSky[i * 2 + 1] = cy + S[i].y * R;
      this.aPoster[i * 2] = px(S[i].x); this.aPoster[i * 2 + 1] = py(S[i].y);
    }
    // dust: faint stars in the sky that become the letters, the frame and the ring of the lámina
    const targets = this.sampleText(pr, k);
    for (let j = 0; j < this.dust; j++) {
      const i = S.length + j, [a, b] = this.rand[j];
      this.aSky[i * 2] = a * w; this.aSky[i * 2 + 1] = b * h;
      const t = targets[j % targets.length];
      this.aPoster[i * 2] = t[0]; this.aPoster[i * 2 + 1] = t[1];
    }
    this.points.geometry.attributes.aSky.needsUpdate = true;
    this.points.geometry.attributes.aPoster.needsUpdate = true;
    const L = this.sky.lines;
    for (let i = 0; i < L.length; i++) {
      const [x1, y1, x2, y2] = L[i];
      this.lSky.set([cx + x1 * R, cy + y1 * R, cx + x2 * R, cy + y2 * R], i * 4);
      this.lPoster.set([px(x1), py(y1), px(x2), py(y2)], i * 4);
    }
    this.lines.geometry.attributes.aSky.needsUpdate = true;
    this.lines.geometry.attributes.aPoster.needsUpdate = true;
  }

  // Rasterise the lámina's lettering and frame at screen size, keep lit pixels as targets.
  sampleText(pr, k) {
    const W = Math.ceil(pr.width), H = Math.ceil(pr.height);
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.scale(k, k);
    x.fillStyle = '#fff'; x.strokeStyle = '#fff'; x.textAlign = 'center';
    const P = POSTER, o = this.o;
    x.font = `400 23px ${FONT_SERIF}`; x.fillText(o.names, 150, P.namesY);
    x.font = `italic 400 9.4px ${FONT_SERIF}`; x.fillText(o.phrase, 150, P.phraseY);
    x.font = `600 6.6px ${FONT_SANS}`; x.fillText(o.city[0].toUpperCase().split('').join(' '), 150, P.cityY);
    x.lineWidth = 0.8; x.strokeRect(11, 11, 278, 378);
    x.beginPath(); x.arc(P.cx, P.cy, P.r, 0, Math.PI * 2); x.stroke();
    x.beginPath(); x.moveTo(128, P.lineY); x.lineTo(172, P.lineY); x.stroke();
    const data = x.getImageData(0, 0, W, H).data;
    const pts = [];
    const step = Math.max(1, Math.round(Math.sqrt((W * H) / 26000)));
    for (let yy = 0; yy < H; yy += step) for (let xx = 0; xx < W; xx += step) if (data[(yy * W + xx) * 4 + 3] > 110) pts.push([pr.left + xx, pr.top + yy]);
    // spread evenly over the available particles
    for (let i = pts.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pts[i], pts[j]] = [pts[j], pts[i]]; }
    return pts.length ? pts : [[pr.left + pr.width / 2, pr.top + pr.height / 2]];
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.w = r.width; this.h = r.height;
    const dpr = Math.min(window.devicePixelRatio || 1, this.o.lite ? 1.5 : 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(this.w, this.h, false);
    this.uniforms.uDpr.value = dpr;
    this.camera.left = 0; this.camera.right = this.w; this.camera.top = 0; this.camera.bottom = this.h;
    this.camera.updateProjectionMatrix();
    this.layout();
  }

  render({ sky, lines, morph, alpha, time }) {
    this.uniforms.uSky.value = sky;
    this.uniforms.uMorph.value = morph;
    this.uniforms.uTime.value = time;
    this.uniforms.uAlpha.value = alpha;
    this.lUniforms.uDraw.value = lines;
    this.renderer.render(this.scene, this.camera);
  }

  dispose() { this.renderer.dispose(); }
}
