// Fecha Estelar — "El viaje cósmico" offline film.
// Rendered frame by frame (tools/render-film.mjs) into an image sequence that the storefront
// scrubs with the scroll. Heavy on purpose: bloom, 30k stars, procedural shaders, 8k Earth.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const q = new URLSearchParams(location.search);
const W = +q.get('w') || 1280;
const H = +q.get('h') || 720;
const PX = Math.min(W, H) / 900; // point-size scale so mobile and desktop read the same
const portrait = H > W;

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const sstep = (x) => x * x * (3 - 2 * x);
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const easeOutExpo = (x) => (x === 1 ? 1 : 1 - Math.pow(2, -10 * x));
const bump = (t, a, b, c) => (t < b ? sstep(seg(t, a, b)) : 1 - sstep(seg(t, b, c)));
const lerp = (a, b, k) => a + (b - a) * k;

// ---------- GLSL ----------
const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm(vec3 p){float f=0.,a=.5;for(int i=0;i<5;i++){f+=a*snoise(p);p*=2.03;a*=.5;}return f;}
`;

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.setClearColor(0x000000, 1);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(portrait ? 52 : 38, W / H, 0.05, 6000);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.8, 0.5, 0.62);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------- background sky ----------
function starfield() {
  const N = 26000;
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N);
  // Milky Way plane, tilted against the ecliptic
  const band = new THREE.Vector3(0.25, 0.9, 0.35).normalize();
  const tmp = new THREE.Vector3();
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const gauss = () => { let u = 0; for (let i = 0; i < 4; i++) u += rnd(); return (u - 2) / 0.58; };
  for (let i = 0; i < N; i++) {
    const inBand = i > N * 0.32;
    tmp.set(gauss(), gauss(), gauss()).normalize();
    if (inBand) {
      tmp.addScaledVector(band, -tmp.dot(band) * (0.86 + 0.13 * rnd())).normalize();
    }
    tmp.multiplyScalar(2400);
    pos.set([tmp.x, tmp.y, tmp.z], i * 3);
    const m = Math.pow(rnd(), inBand ? 5.5 : 3.2);
    size[i] = (0.8 + m * 4.2) * PX;
    const k = rnd();
    const c = k < 0.12 ? [0.72, 0.82, 1.0] : k < 0.24 ? [1.0, 0.86, 0.62] : [1.0, 0.97, 0.92];
    const b = inBand ? 0.10 + m * 1.1 : 0.22 + m * 1.5;
    col.set([c[0] * b, c[1] * b, c[2] * b], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('size', new THREE.BufferAttribute(size, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { uFade: { value: 1 } },
    vertexShader: `attribute float size; attribute vec3 color; varying vec3 vC; uniform float uFade;
      void main(){ vC=color*uFade; vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv; gl_PointSize=size; }`,
    fragmentShader: `varying vec3 vC; void main(){ vec2 p=gl_PointCoord*2.-1.; float r=dot(p,p); float a=exp(-r*4.5); gl_FragColor=vec4(vC*a,1.); }`,
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
  });
  const pts = new THREE.Points(g, m);
  pts.renderOrder = -2;
  return pts;
}
const stars = starfield();
scene.add(stars);

// faint nebula dome along the Milky Way
const nebula = new THREE.Mesh(
  new THREE.SphereGeometry(2300, 64, 32),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending,
    uniforms: { uFade: { value: 1 } },
    vertexShader: `varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: NOISE + `varying vec3 vP; uniform float uFade;
      void main(){ vec3 band=normalize(vec3(0.25,0.9,0.35)); float d=abs(dot(vP,band));
        float n=fbm(vP*3.2)*0.5+0.5; float n2=fbm(vP*9.0+3.)*0.5+0.5;
        float m=exp(-d*d*38.)*(0.35+0.9*n)*(0.6+0.6*n2);
        float dust=smoothstep(0.55,0.8,fbm(vP*6.0+11.)*0.5+0.5);
        vec3 c=mix(vec3(0.10,0.13,0.26),vec3(0.42,0.33,0.24),n2)*m*(1.-dust*0.7);
        gl_FragColor=vec4(c*0.11*uFade,1.); }`,
  }),
);
nebula.renderOrder = -3;
scene.add(nebula);

// ---------- the sun ----------
const SUN_R = 6;
const sunMat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uHeat: { value: 1 } },
  vertexShader: `varying vec3 vP; varying vec3 vN; void main(){ vP=position; vN=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: NOISE + `varying vec3 vP; varying vec3 vN; uniform float uTime; uniform float uHeat;
    void main(){ vec3 p=normalize(vP);
      float n=fbm(p*3.0+vec3(0.,uTime*.03,0.));
      float c=snoise(p*14.+uTime*.08)*0.5+0.5;
      float h=n*0.75+c*0.35;
      vec3 col=mix(vec3(0.75,0.18,0.02),vec3(1.0,0.55,0.12),smoothstep(-0.35,0.25,h));
      col=mix(col,vec3(1.0,0.9,0.62),smoothstep(0.25,0.75,h));
      float mu=max(dot(normalize(vN),vec3(0.,0.,1.)),0.);
      col*=0.5+0.75*pow(mu,0.45);
      gl_FragColor=vec4(col*1.55*uHeat,1.); }`,
});
const sun = new THREE.Mesh(new THREE.SphereGeometry(SUN_R, 160, 80), sunMat);
scene.add(sun);

const billboard = (size, frag, uniforms = {}) => {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uAmp: { value: 1 }, ...uniforms },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: NOISE + frag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  m.renderOrder = 2;
  return m;
};
const corona = billboard(SUN_R * 9, `varying vec2 vUv; uniform float uTime; uniform float uAmp;
  void main(){ vec2 p=vUv*2.-1.; float r=length(p); float a=atan(p.y,p.x);
    float rays=snoise(vec3(cos(a)*2.5,sin(a)*2.5,uTime*.05))*0.5+0.5;
    rays*=snoise(vec3(cos(a)*9.,sin(a)*9.,uTime*.08+4.))*0.5+0.5;
    float inner=smoothstep(0.24,0.21,r);
    float g=exp(-max(r-0.21,0.)*9.)*0.9 + pow(max(0.,1.-r/1.),4.)*rays*1.6;
    g*=(1.-inner*0.6);
    vec3 c=mix(vec3(1.0,0.48,0.12),vec3(1.0,0.82,0.5),exp(-r*5.));
    gl_FragColor=vec4(c*g*uAmp,1.); }`);
scene.add(corona);

// the single point of light, before everything
const spark = billboard(3.2, `varying vec2 vUv; uniform float uAmp;
  void main(){ vec2 p=vUv*2.-1.; float r=length(p);
    float core=exp(-r*r*900.)*4.;
    float halo=exp(-r*9.)*0.6;
    float cross=(exp(-abs(p.y)*160.)+exp(-abs(p.x)*160.))*exp(-r*3.5)*0.7;
    vec3 c=vec3(1.0,0.86,0.6)*(core+halo+cross);
    gl_FragColor=vec4(c*uAmp,1.); }`);
scene.add(spark);

// ignition shock ring
const shock = new THREE.Mesh(
  new THREE.RingGeometry(0.94, 1, 256),
  new THREE.ShaderMaterial({ uniforms: { uAmp: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float uAmp; void main(){ gl_FragColor=vec4(vec3(1.0,0.78,0.42)*uAmp,1.); }` }),
);
scene.add(shock);

// ---------- planets ----------
const SUN_POS = new THREE.Vector3();
const LIT = { value: 0 };
function planetMat({ a, b, type = 0, atmo = [0, 0, 0], freq = 3, seed = 0 }) {
  return new THREE.ShaderMaterial({
    uniforms: { uA: { value: new THREE.Color(...a) }, uB: { value: new THREE.Color(...b) }, uAtmo: { value: new THREE.Color(...atmo) }, uType: { value: type }, uFreq: { value: freq }, uSeed: { value: seed }, uSun: { value: SUN_POS }, uLit: LIT },
    vertexShader: `varying vec3 vO; varying vec3 vW; varying vec3 vN;
      void main(){ vO=position; vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: NOISE + `varying vec3 vO; varying vec3 vW; varying vec3 vN;
      uniform vec3 uA; uniform vec3 uB; uniform vec3 uAtmo; uniform float uType; uniform float uFreq; uniform float uSeed; uniform vec3 uSun; uniform float uLit;
      void main(){ vec3 p=normalize(vO); vec3 N=normalize(vN); vec3 L=normalize(uSun-vW); vec3 V=normalize(cameraPosition-vW);
        float n;
        if(uType>1.5){ n=fbm(p*uFreq+uSeed)*0.5+0.5; n=smoothstep(0.2,0.8,n); }
        else if(uType>0.5){ float w=fbm(p*vec3(2.,9.,2.)+uSeed)*0.6; n=sin(p.y*uFreq*6.+w*4.)*0.5+0.5; n=mix(n,fbm(p*12.+uSeed)*0.5+0.5,0.25); }
        else { n=fbm(p*uFreq+uSeed)*0.5+0.5; float cr=smoothstep(0.62,0.66,snoise(p*uFreq*3.+uSeed)*0.5+0.5); n=mix(n,n*0.6,cr); }
        vec3 base=mix(uA,uB,n);
        float d=max(dot(N,L),0.);
        float wrap=smoothstep(-0.15,0.35,dot(N,L));
        vec3 col=base*(0.006+pow(d,0.85)*1.25*uLit)*mix(0.6,1.,wrap);
        float fr=pow(1.-max(dot(N,V),0.),3.);
        col+=uAtmo*fr*(0.05+1.4*wrap)*uLit;
        gl_FragColor=vec4(col,1.); }`,
  });
}
const P = {
  mercury: { r: 13, R: 0.5, a0: 2.2, sp: 1.6, mat: planetMat({ a: [0.25, 0.23, 0.22], b: [0.55, 0.52, 0.5], freq: 4, seed: 1 }) },
  venus: { r: 19, R: 0.95, a0: 4.1, sp: 1.1, mat: planetMat({ a: [0.75, 0.6, 0.38], b: [0.95, 0.86, 0.66], type: 2, freq: 2.2, seed: 3, atmo: [0.6, 0.45, 0.25] }) },
  mars: { r: 38, R: 0.85, a0: 0.75, sp: 0.55, mat: planetMat({ a: [0.4, 0.13, 0.05], b: [0.78, 0.38, 0.18], freq: 3, seed: 9, atmo: [0.5, 0.25, 0.15] }) },
  jupiter: { r: 56, R: 4.2, a0: 2.15, sp: 0.25, mat: planetMat({ a: [0.55, 0.4, 0.28], b: [0.93, 0.85, 0.72], type: 1, freq: 2.2, seed: 5, atmo: [0.35, 0.3, 0.25] }) },
  saturn: { r: 76, R: 3.5, a0: 5.35, sp: 0.18, mat: planetMat({ a: [0.7, 0.6, 0.42], b: [0.95, 0.88, 0.7], type: 1, freq: 1.4, seed: 2, atmo: [0.4, 0.35, 0.25] }) },
};
for (const k in P) {
  const p = P[k];
  p.mesh = new THREE.Mesh(new THREE.SphereGeometry(p.R, 96, 48), p.mat);
  p.mesh.rotation.z = 0.2;
  scene.add(p.mesh);
}
// Saturn's rings
const rings = new THREE.Mesh(
  new THREE.RingGeometry(P.saturn.R * 1.35, P.saturn.R * 2.4, 256, 1),
  new THREE.ShaderMaterial({
    side: THREE.DoubleSide, transparent: true, depthWrite: false,
    uniforms: { uSun: { value: SUN_POS }, uIn: { value: P.saturn.R * 1.35 }, uOut: { value: P.saturn.R * 2.4 } },
    vertexShader: `varying vec3 vL; varying vec3 vW; void main(){ vL=position; vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: NOISE + `varying vec3 vL; varying vec3 vW; uniform float uIn; uniform float uOut;
      void main(){ float r=(length(vL.xy)-uIn)/(uOut-uIn);
        float b=snoise(vec3(r*38.,0.,0.))*0.5+0.5; b=mix(b,snoise(vec3(r*140.,1.,0.))*0.5+0.5,0.4);
        float gap=smoothstep(0.55,0.57,r)*(1.-smoothstep(0.6,0.62,r));
        float a=(0.25+0.75*b)*(1.-gap*0.9)*smoothstep(0.,0.04,r)*smoothstep(1.,0.92,r);
        vec3 c=mix(vec3(0.55,0.47,0.36),vec3(0.93,0.86,0.7),b);
        gl_FragColor=vec4(c*0.85,a*0.85); }`,
  }),
);
rings.rotation.x = -Math.PI / 2 + 0.42;
scene.add(rings);

// orbits
const orbitMat = new THREE.LineBasicMaterial({ color: 0xd4af63, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
const orbits = new THREE.Group();
for (const r of [13, 19, 28, 38, 56, 76]) {
  const pts = [];
  for (let i = 0; i <= 360; i++) { const a = (i / 360) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)); }
  orbits.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), orbitMat));
}
scene.add(orbits);

// ---------- Earth at night ----------
const EARTH = { r: 28, R: 2.0, a0: 0.62, sp: 0.4 };
const IBERIA = { lat: 40.42, lon: -3.7 };
const LON0 = -10.5, LON1 = 4.5, LAT0 = 35.2, LAT1 = 44.2;
const ll2v = (lat, lon) => { const a = THREE.MathUtils.degToRad(lat), o = THREE.MathUtils.degToRad(lon); return new THREE.Vector3(Math.cos(a) * Math.cos(o), Math.sin(a), -Math.cos(a) * Math.sin(o)); };

async function earthTextures() {
  const [land50, land10, cities] = await Promise.all([
    fetch('/node_modules/world-atlas/land-50m.json').then((r) => r.json()),
    fetch('/node_modules/world-atlas/land-10m.json').then((r) => r.json()),
    fetch('/node_modules/cities.json/cities.json').then((r) => r.json()),
  ]);
  const drawLand = (ctx, topo, proj, unwrap) => {
    const f = topojson.feature(topo, topo.objects.land);
    ctx.beginPath();
    const geoms = f.features ? f.features.map((x) => x.geometry) : [f.geometry];
    const polys = geoms.flatMap((g) => (g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates]));
    for (const shift of unwrap ? [-360, 0, 360] : [0]) for (const poly of polys) for (const ring of poly) {
      let prev = null, off = 0;
      ring.forEach(([lo, la], i) => {
        if (prev !== null) { const d = lo + off - prev; if (d > 180) off -= 360; else if (d < -180) off += 360; }
        const L = lo + off; prev = L;
        const [x, y] = proj(L + shift, la);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.closePath();
    }
    ctx.fill('evenodd');
  };
  // global: R = land mask, lights painted separately
  const TW = 8192, TH = 4096;
  const proj = (lo, la) => [((lo + 180) / 360) * TW, ((90 - la) / 180) * TH];
  const land = document.createElement('canvas'); land.width = TW; land.height = TH;
  let c = land.getContext('2d'); c.fillStyle = '#000'; c.fillRect(0, 0, TW, TH); c.fillStyle = '#fff'; drawLand(c, land50, proj, true);
  const lights = document.createElement('canvas'); lights.width = TW; lights.height = TH;
  c = lights.getContext('2d'); c.fillStyle = '#000'; c.fillRect(0, 0, TW, TH);
  c.globalCompositeOperation = 'lighter';
  c.fillStyle = 'rgba(255,190,120,0.22)';
  for (const ci of cities) { const [x, y] = proj(+ci.lng, +ci.lat); c.fillRect(x - 1, y - 1, 2.2, 2.2); }
  const glow = (cv, blur, k) => { const g = document.createElement('canvas'); g.width = cv.width; g.height = cv.height; const gc = g.getContext('2d'); gc.filter = `blur(${blur}px)`; gc.drawImage(cv, 0, 0); const cc = cv.getContext('2d'); cc.globalCompositeOperation = 'lighter'; cc.globalAlpha = k; cc.drawImage(g, 0, 0); cc.globalAlpha = 1; };
  glow(lights, 3, 0.9);
  // Iberia detail
  const DW = 3072, DH = Math.round(DW * ((LAT1 - LAT0) / (LON1 - LON0)) / Math.cos(THREE.MathUtils.degToRad(40)));
  const dproj = (lo, la) => [((lo - LON0) / (LON1 - LON0)) * DW, ((LAT1 - la) / (LAT1 - LAT0)) * DH];
  const dl = document.createElement('canvas'); dl.width = DW; dl.height = DH;
  c = dl.getContext('2d'); c.fillStyle = '#000'; c.fillRect(0, 0, DW, DH); c.fillStyle = '#fff'; drawLand(c, land10, dproj, false);
  const dli = document.createElement('canvas'); dli.width = DW; dli.height = DH;
  c = dli.getContext('2d'); c.fillStyle = '#000'; c.fillRect(0, 0, DW, DH); c.globalCompositeOperation = 'lighter';
  for (const ci of cities) {
    const lo = +ci.lng, la = +ci.lat;
    if (lo < LON0 - 1 || lo > LON1 + 1 || la < LAT0 - 1 || la > LAT1 + 1) continue;
    const [x, y] = dproj(lo, la);
    c.fillStyle = 'rgba(255,196,128,0.55)'; c.fillRect(x - 1.5, y - 1.5, 3, 3);
  }
  // larger glow for the capitals people will recognise
  const big = [[40.42, -3.70, 46], [41.39, 2.17, 34], [39.47, -0.38, 24], [37.39, -5.99, 22], [41.65, -0.88, 16], [36.72, -4.42, 18], [43.26, -2.93, 16], [38.71, -9.14, 26], [41.15, -8.61, 18]];
  for (const [la, lo, r] of big) { const [x, y] = dproj(lo, la); const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,205,140,0.9)'); g.addColorStop(1, 'rgba(255,160,80,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
  glow(dli, 3, 0.8);
  const tex = (cv) => { const t = new THREE.CanvasTexture(cv); t.anisotropy = 8; t.colorSpace = THREE.NoColorSpace; return t; };
  return { land: tex(land), lights: tex(lights), dLand: tex(dl), dLights: tex(dli) };
}

const earthMat = new THREE.ShaderMaterial({
  uniforms: { uLand: { value: null }, uLights: { value: null }, uDLand: { value: null }, uDLights: { value: null }, uSun: { value: SUN_POS }, uBox: { value: new THREE.Vector4(LON0, LON1, LAT0, LAT1) }, uCity: { value: 0 }, uLit: LIT },
  vertexShader: `varying vec3 vO; varying vec3 vW; varying vec3 vN;
    void main(){ vO=position; vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*w; }`,
  fragmentShader: NOISE + `varying vec3 vO; varying vec3 vW; varying vec3 vN;
    uniform sampler2D uLand; uniform sampler2D uLights; uniform sampler2D uDLand; uniform sampler2D uDLights; uniform vec3 uSun; uniform vec4 uBox; uniform float uCity; uniform float uLit;
    const float PI=3.14159265;
    void main(){ vec3 p=normalize(vO); float lat=asin(p.y); float lon=atan(-p.z,p.x);
      vec2 uv=vec2((lon+PI)/(2.*PI),(lat+PI*.5)/PI);
      float land=texture2D(uLand,uv).r; float li=texture2D(uLights,uv).r;
      float dlon=degrees(lon), dlat=degrees(lat);
      vec2 duv=vec2((dlon-uBox.x)/(uBox.y-uBox.x),(dlat-uBox.z)/(uBox.w-uBox.z));
      float inBox=step(0.,duv.x)*step(duv.x,1.)*step(0.,duv.y)*step(duv.y,1.);
      float edge=smoothstep(0.,0.08,min(min(duv.x,1.-duv.x),min(duv.y,1.-duv.y)))*inBox;
      land=mix(land,texture2D(uDLand,duv).r,edge); li=mix(li*0.6,texture2D(uDLights,duv).r,edge);
      vec3 N=normalize(vN); vec3 L=normalize(uSun-vW); vec3 V=normalize(cameraPosition-vW);
      float day=smoothstep(-0.08,0.25,dot(N,L))*uLit;
      float cl=smoothstep(0.55,0.85,fbm(p*5.+2.)*0.5+0.5);
      vec3 dayc=mix(vec3(0.01,0.04,0.11),vec3(0.16,0.14,0.09),land);
      dayc=mix(dayc,vec3(0.85),cl*0.6);
      vec3 H=normalize(L+V); float spec=pow(max(dot(N,H),0.),60.)*(1.-land)*0.6;
      vec3 night=mix(vec3(0.004,0.008,0.02),vec3(0.012,0.016,0.024),land);
      night+=vec3(0.02,0.04,0.09)*(1.-land)*0.25;
      vec3 col=mix(night,dayc*1.3,day)+spec*day;
      col+=vec3(1.0,0.66,0.32)*pow(li,1.35)*1.7*(1.-day)*(1.-cl*0.45);
      float fr=pow(1.-max(dot(N,V),0.),2.6);
      float tw=smoothstep(-0.35,0.2,dot(N,L));
      col+=vec3(0.22,0.45,1.0)*fr*(0.06+1.4*tw)*uLit;
      gl_FragColor=vec4(col,1.); }`,
});
const earth = new THREE.Mesh(new THREE.SphereGeometry(EARTH.R, 256, 128), earthMat);
scene.add(earth);
// atmosphere shell
const atmo = new THREE.Mesh(
  new THREE.SphereGeometry(EARTH.R * 1.035, 128, 64),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uSun: { value: SUN_POS }, uC: { value: new THREE.Vector3() } },
    vertexShader: `varying vec3 vW; varying vec3 vN; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `varying vec3 vW; varying vec3 vN; uniform vec3 uSun; uniform vec3 uC;
      void main(){ vec3 V=normalize(cameraPosition-vW); vec3 N=normalize(vN); float f=pow(max(dot(-N,V),0.),5.0)*1.0;
        float lit=smoothstep(-0.5,0.4,dot(normalize(vW-uC),normalize(uSun-uC)));
        vec3 c=mix(vec3(0.15,0.3,0.9),vec3(0.55,0.75,1.0),lit)*f*(0.25+1.5*lit);
        gl_FragColor=vec4(c,1.); }`,
  }),
);
scene.add(atmo);
const moon = new THREE.Mesh(new THREE.SphereGeometry(0.55, 96, 48), planetMat({ a: [0.22, 0.22, 0.23], b: [0.62, 0.61, 0.6], freq: 3.2, seed: 21 }));
scene.add(moon);
// gold beacon over the chosen city
const beacon = billboard(0.5, `varying vec2 vUv; uniform float uAmp;
  void main(){ vec2 p=vUv*2.-1.; float r=length(p); float g=exp(-r*r*60.)*2.2+exp(-r*7.)*0.5; gl_FragColor=vec4(vec3(1.0,0.8,0.45)*g*uAmp,1.); }`);
scene.add(beacon);

// ---------- layout (planets freeze after the overview, so the camera spline is exact) ----------
const orbitAngle = (p, t) => p.a0 + p.sp * Math.min(seg(t, 0.12, 0.5), 1) * 0.5;
const at = (p, t) => { const a = orbitAngle(p, t); return new THREE.Vector3(Math.cos(a) * p.r, 0, Math.sin(a) * p.r); };
const E_FINAL = at(EARTH, 1);
const antiSun = E_FINAL.clone().normalize();
const side = new THREE.Vector3(0, 1, 0).cross(antiSun).normalize();
const nW = antiSun.clone().multiplyScalar(0.42).addScaledVector(new THREE.Vector3(0, 1, 0), 0.38).addScaledVector(side, -0.82).normalize();
// orient the Earth so Iberia faces nW with north up
{
  const nL = ll2v(IBERIA.lat, IBERIA.lon);
  const a = THREE.MathUtils.degToRad(IBERIA.lat), o = THREE.MathUtils.degToRad(IBERIA.lon);
  const eastL = new THREE.Vector3(-Math.sin(o), 0, -Math.cos(o)).normalize();
  const northL = new THREE.Vector3(-Math.sin(a) * Math.cos(o), Math.cos(a), Math.sin(a) * Math.sin(o)).normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const northW = up.clone().addScaledVector(nW, -up.dot(nW)).normalize();
  const eastW = northW.clone().cross(nW).normalize();
  const ML = new THREE.Matrix4().makeBasis(eastL, northL, nL);
  const MW = new THREE.Matrix4().makeBasis(eastW, northW, nW);
  const R = MW.multiply(ML.transpose());
  earth.quaternion.setFromRotationMatrix(R);
  EARTH.northW = northW;
  EARTH.nL = nL;
}
const MOON_OFF = side.clone().multiplyScalar(-5.2).addScaledVector(antiSun, 3.2).add(new THREE.Vector3(0, 1.4, 0));
const marsAt = at(P.mars, 1);

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const OVER = portrait ? v3(-30, 120, 150) : v3(-24, 74, 128);
const camPath = new THREE.CatmullRomCurve3([
  v3(0, 6, 46),
  OVER,
  marsAt.clone().add(v3(4, 7, 10)).lerp(OVER, 0.25),
  E_FINAL.clone().add(MOON_OFF).addScaledVector(nW, 9).add(v3(0, 2.5, 0)),
  E_FINAL.clone().addScaledVector(nW, EARTH.R * 7),
  E_FINAL.clone().addScaledVector(nW, EARTH.R * 1.32),
], false, 'centripetal', 0.5);

// ---------- frame ----------
const tmpV = new THREE.Vector3();
function frame(t) {
  const time = t * 60;
  sunMat.uniforms.uTime.value = time;
  corona.material.uniforms.uTime.value = time;

  // 0 – 0.12 darkness & the single point
  const ign = seg(t, 0.115, 0.2);
  const s = ign <= 0 ? 0.0001 : Math.max(0.0001, easeOutExpo(ign) * (1 + 0.15 * Math.sin(ign * Math.PI)));
  sun.scale.setScalar(s);
  corona.scale.setScalar(Math.max(0.0001, s));
  spark.material.uniforms.uAmp.value = (0.55 + 0.45 * sstep(seg(t, 0, 0.11))) * (1 - seg(t, 0.12, 0.16));
  const flash = bump(t, 0.112, 0.124, 0.165);
  bloom.strength = 0.7 + 1.6 * flash;
  bloom.radius = 0.18 + 0.25 * flash;
  bloom.threshold = 0.62 - 0.4 * flash;
  sunMat.uniforms.uHeat.value = 1 + 0.9 * flash;
  corona.material.uniforms.uAmp.value = 0.55 + 1.3 * flash;
  LIT.value = sstep(seg(t, 0.12, 0.2));
  const sh = seg(t, 0.12, 0.3);
  shock.scale.setScalar(Math.max(0.0001, SUN_R * (0.9 + easeOut(sh) * 16)));
  shock.material.uniforms.uAmp.value = sh > 0 && sh < 1 ? (1 - sh) * 1.4 : 0;
  // stars wake up with the light
  const wake = sstep(seg(t, 0.13, 0.32));
  stars.material.uniforms.uFade.value = wake;
  nebula.material.uniforms.uFade.value = wake;
  orbitMat.opacity = 0.22 * bump(t, 0.24, 0.36, 0.6);

  for (const k in P) { const p = P[k]; p.mesh.position.copy(at(p, t)); p.mesh.rotation.y = t * 6 + p.a0; }
  rings.position.copy(P.saturn.mesh.position);
  const born = t > 0.116;
  for (const k in P) P[k].mesh.visible = born;
  rings.visible = earth.visible = atmo.visible = moon.visible = orbits.visible = born;
  earth.position.copy(at(EARTH, t));
  atmo.position.copy(earth.position);
  atmo.material.uniforms.uC.value.copy(earth.position);
  moon.position.copy(earth.position).add(MOON_OFF);
  moon.rotation.y = t * 3;

  // camera
  let pos, look;
  const a = seg(t, 0.0, 0.16);
  const close = v3(0, 0, 26);
  if (t < 0.16) {
    pos = close.clone().lerp(v3(0, 6, 46), easeInOut(seg(t, 0.12, 0.16)) * 0.0);
    look = v3(0, 0, 0);
  } else {
    // 0.16 → 1 along the spline, slow-in/slow-out per leg
    const u = seg(t, 0.16, 1);
    const k = easeInOut(seg(u, 0, 0.32)) * 0.2 + sstep(seg(u, 0.32, 0.62)) * 0.4 + easeInOut(seg(u, 0.62, 1)) * 0.4;
    pos = camPath.getPointAt(Math.min(k, 1));
    const pre = close.clone().lerp(camPath.getPointAt(0), easeInOut(seg(t, 0.16, 0.24)));
    pos = pre.lerp(pos, sstep(seg(t, 0.2, 0.3)));
    const lookSun = v3(0, 0, 0);
    const lookEarth = earth.position.clone();
    const lookCity = earth.position.clone().addScaledVector(nW, EARTH.R);
    look = lookSun.clone().lerp(lookEarth, easeInOut(seg(t, 0.46, 0.66))).lerp(lookCity, easeInOut(seg(t, 0.82, 0.97)));
  }
  camera.position.copy(pos);
  camera.up.set(0, 1, 0).lerp(EARTH.northW, easeInOut(seg(t, 0.7, 0.9))).normalize();
  camera.lookAt(look);
  // gentle roll on the dive for a sense of flight
  camera.rotateZ(Math.sin(seg(t, 0.4, 0.8) * Math.PI) * 0.12);
  void a;

  for (const b of [corona, spark, shock, beacon]) b.quaternion.copy(camera.quaternion);
  beacon.position.copy(earth.position).addScaledVector(nW, EARTH.R * 1.004);
  const bk = seg(t, 0.86, 0.98);
  beacon.material.uniforms.uAmp.value = sstep(bk) * (0.8 + 0.2 * Math.sin(t * 400));
  beacon.scale.setScalar(0.25 + 0.75 * (1 - bk * 0.6));
  earthMat.uniforms.uCity.value = bk;
  composer.render();
}

let ready;
window.filmReady = (async () => {
  const t = await earthTextures();
  earthMat.uniforms.uLand.value = t.land;
  earthMat.uniforms.uLights.value = t.lights;
  earthMat.uniforms.uDLand.value = t.dLand;
  earthMat.uniforms.uDLights.value = t.dLights;
  frame(0);
  ready = true;
  return true;
})();
window.renderFrame = (t) => { frame(t); return new Promise((r) => requestAnimationFrame(() => r(true))); };
window.grab = (type = 'image/png') => renderer.domElement.toDataURL(type);
if (q.has('t')) window.filmReady.then(() => frame(+q.get('t')));
if (q.has('nocorona')) corona.visible = false;
