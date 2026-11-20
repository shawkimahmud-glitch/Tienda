// «El túnel de estrellas» — one continuous shot, t ∈ [0, 1].
// Used live on desktop (scroll → t) and offline to pre-render the mobile frame pack.
// 1 darkness + gold point · 2 nebula tunnel · 3 the sun ignites · 4 Earth, Spain at night
// 5 looking up: the real sky, constellations drawn in gold · 6 the stars flatten into the lámina.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { computeSky, cityByName, tzFor, POSTER, starRadius } from '../sky.js';

export const BEATS = [0, 0.12, 0.38, 0.54, 0.74, 0.88, 1];
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const ss = (x) => x * x * (3 - 2 * x);
const eio = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const eout = (x) => 1 - Math.pow(1 - x, 3);
const bump = (t, a, b, c) => (t < b ? ss(seg(t, a, b)) : 1 - ss(seg(t, b, c)));
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy; i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx; vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_); vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw); vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3))); p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm(vec3 p){float f=0.,a=.5;for(int i=0;i<OCT;i++){f+=a*snoise(p);p*=2.03;a*=.5;}return f;}
`;

/**
 * @param {object} o
 * @param {HTMLCanvasElement} o.canvas
 * @param {string} o.media   base URL of the textures (ends with /)
 * @param {'high'|'live'} o.quality  high = offline render, live = desktop real time
 * @param {object} o.example {names, phrase, city, date, time}
 * @param {object} o.poster  {h, cy} lámina height and centre, as fractions of the viewport height
 */
export function createTunnel(o) {
  const high = o.quality === 'high';
  const OCT = high ? 6 : 4;
  const noise = NOISE.replace(/OCT/g, String(OCT));
  const renderer = new THREE.WebGLRenderer({ canvas: o.canvas, antialias: high, preserveDrawingBuffer: high, powerPreference: 'high-performance', alpha: false });
  renderer.setClearColor(0x000000, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 4000);
  scene.add(camera);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.9, 0.35, 0.55);
  composer.addPass(bloom);

  // ---- lens flare + grade (one screen pass) ----
  const flare = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uSun: { value: new THREE.Vector2(0.5, 0.5) }, uAmt: { value: 0 }, uAspect: { value: 1 }, uVig: { value: 1 }, uGrain: { value: 0 }, uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: /* glsl */ `uniform sampler2D tDiffuse; uniform vec2 uSun; uniform float uAmt; uniform float uAspect; uniform float uVig; uniform float uGrain; uniform float uTime; varying vec2 vUv;
      float ring(vec2 p, vec2 c, float r, float w){ float d=length((p-c)*vec2(uAspect,1.)); return smoothstep(r+w,r,d)*smoothstep(r-w*3.,r-w,d); }
      float disk(vec2 p, vec2 c, float r){ float d=length((p-c)*vec2(uAspect,1.)); return smoothstep(r,r*0.2,d); }
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
      void main(){ vec3 c=texture2D(tDiffuse,vUv).rgb;
        if(uAmt>0.001){ vec2 dir=vec2(0.5)-uSun; vec3 f=vec3(0.);
          f+=vec3(1.,.72,.38)*disk(vUv,uSun+dir*0.45,0.05)*0.18;
          f+=vec3(.55,.7,1.)*disk(vUv,uSun+dir*0.9,0.025)*0.35;
          f+=vec3(1.,.8,.5)*ring(vUv,uSun+dir*1.25,0.11,0.006)*0.22;
          f+=vec3(.6,.75,1.)*disk(vUv,uSun+dir*1.6,0.07)*0.12;
          f+=vec3(1.,.85,.6)*disk(vUv,uSun+dir*2.0,0.018)*0.4;
          float sy=abs(vUv.y-uSun.y); float sx=abs(vUv.x-uSun.x)*uAspect;
          f+=vec3(.7,.8,1.)*exp(-sy*220.)*exp(-sx*1.6)*0.55;
          c+=f*uAmt; }
        vec2 q=vUv-0.5; q.x*=uAspect; c*=mix(1., smoothstep(1.15,0.25,length(q)), uVig);
        c+=(h(vUv*vec2(1733.,977.)+uTime)-0.5)*uGrain;
        gl_FragColor=vec4(c,1.); }`,
  });
  composer.addPass(flare);
  composer.addPass(new OutputPass());

  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin('anonymous');
  const tex = (n, srgb) => new Promise((res) => loader.load(o.media + n, (t) => { t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 8; res(t); }, undefined, () => res(null)));

  // ---- deep field: stars on a far sphere ----
  const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  {
    const N = high ? 14000 : 7000;
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), sz = new Float32Array(N);
    const tmp = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      tmp.set(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize().multiplyScalar(2500);
      pos.set([tmp.x, tmp.y, tmp.z], i * 3);
      const m = Math.pow(rnd(), 3.2), k = rnd();
      const c = k < 0.12 ? [0.7, 0.8, 1] : k < 0.25 ? [1, 0.85, 0.6] : [1, 0.97, 0.92];
      col.set(c.map((v) => v * (0.25 + m * 1.6)), i * 3);
      sz[i] = 0.8 + m * 3.6;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('size', new THREE.BufferAttribute(sz, 1));
    var field = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: { uFade: { value: 0 }, uPx: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'attribute float size; attribute vec3 color; varying vec3 vC; uniform float uFade; uniform float uPx; void main(){ vC=color*uFade; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); gl_PointSize=size*uPx; }',
      fragmentShader: 'varying vec3 vC; void main(){ vec2 p=gl_PointCoord*2.-1.; gl_FragColor=vec4(vC*exp(-dot(p,p)*4.5),1.); }',
    }));
    field.frustumCulled = false;
    scene.add(field);
  }

  // ---- the tunnel: nested nebula shells + dust + streaks ----
  const TZ0 = -12, TZ1 = -210, TL = TZ0 - TZ1;
  const shellMat = (r, scale, seed, alpha) => new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uA: { value: 0 }, uCam: { value: 0 } }, side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec3 vP; varying vec3 vW; void main(){ vP=position; vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
    fragmentShader: noise + `varying vec3 vP; varying vec3 vW; uniform float uT; uniform float uA; uniform float uCam;
      void main(){ float a=atan(vP.x,vP.z); vec3 q=vec3(cos(a)*${(r * 0.18).toFixed(2)}, sin(a)*${(r * 0.18).toFixed(2)}, vW.z*${(0.035 * scale).toFixed(4)});
        q+=vec3(${seed.toFixed(1)},0.,uT*0.15);
        vec3 w=vec3(fbm(q+vec3(1.7,9.2,0.)), fbm(q+vec3(8.3,2.8,3.)), 0.)*1.4;
        float n=fbm(q+w)*0.5+0.5; float d=smoothstep(0.42,0.95,n);
        float gold=smoothstep(0.52,0.86,fbm(q*1.7+w+4.)*0.5+0.5)*d;
        vec3 c=mix(vec3(0.02,0.05,0.13),vec3(0.13,0.25,0.55),d)*d*0.9 + vec3(1.0,0.66,0.28)*gold*1.3;
        float ends=smoothstep(${TZ0.toFixed(1)},${(TZ0 - 25).toFixed(1)},vW.z)*smoothstep(${TZ1.toFixed(1)},${(TZ1 + 30).toFixed(1)},vW.z);
        float near=smoothstep(2.,26.,abs(vW.z-uCam));
        gl_FragColor=vec4(c*ends*near*uA*${alpha.toFixed(2)},1.); }`,
  });
  const shells = [];
  for (const [r, sc, sd, al] of [[5.5, 1.3, 3, 0.75], [9, 1, 11, 1], [15, 0.7, 23, 1.1]]) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, TL, 96, 64, true), shellMat(r, sc, sd, al));
    m.rotation.x = Math.PI / 2; m.position.z = (TZ0 + TZ1) / 2;
    shells.push(m); scene.add(m);
  }
  // dust (soft points) and streaks (lines that stretch with speed)
  const DUST = high ? 9000 : 4500;
  {
    const pos = new Float32Array(DUST * 3), sz = new Float32Array(DUST), gold = new Float32Array(DUST);
    for (let i = 0; i < DUST; i++) {
      const a = rnd() * Math.PI * 2, r = 1.2 + Math.pow(rnd(), 0.6) * 12;
      pos.set([Math.cos(a) * r, Math.sin(a) * r, TZ0 + 8 - rnd() * (TL + 30)], i * 3);
      sz[i] = 0.4 + Math.pow(rnd(), 4) * 2.6; gold[i] = rnd() < 0.22 ? 1 : 0;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('size', new THREE.BufferAttribute(sz, 1));
    g.setAttribute('gold', new THREE.BufferAttribute(gold, 1));
    var dust = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: { uA: { value: 0 }, uPx: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'attribute float size; attribute float gold; varying float vG; varying float vF; uniform float uPx; void main(){ vG=gold; vec4 mv=modelViewMatrix*vec4(position,1.); vF=smoothstep(140.,20.,-mv.z)*smoothstep(0.5,3.,-mv.z); gl_Position=projectionMatrix*mv; gl_PointSize=size*uPx*(30./max(1.,-mv.z))+1.; }',
      fragmentShader: 'varying float vG; varying float vF; uniform float uA; void main(){ vec2 p=gl_PointCoord*2.-1.; vec3 c=mix(vec3(.75,.85,1.),vec3(1.,.75,.4),vG); gl_FragColor=vec4(c*exp(-dot(p,p)*3.5)*vF*uA,1.); }',
    }));
    dust.frustumCulled = false;
    scene.add(dust);
  }
  const STREAK = high ? 520 : 300;
  {
    const pos = new Float32Array(STREAK * 6), end = new Float32Array(STREAK * 2);
    for (let i = 0; i < STREAK; i++) {
      const a = rnd() * Math.PI * 2, r = 2 + rnd() * 9, z = TZ0 - rnd() * TL;
      pos.set([Math.cos(a) * r, Math.sin(a) * r, z, Math.cos(a) * r, Math.sin(a) * r, z], i * 6);
      end[i * 2 + 1] = 1;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
    var streaks = new THREE.LineSegments(g, new THREE.ShaderMaterial({
      uniforms: { uLen: { value: 0 }, uA: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'attribute float aEnd; uniform float uLen; varying float vE; varying float vF; void main(){ vE=aEnd; vec3 p=position; p.z+=aEnd*uLen; vec4 mv=modelViewMatrix*vec4(p,1.); vF=smoothstep(120.,10.,-mv.z)*smoothstep(0.3,2.,-mv.z); gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'varying float vE; varying float vF; uniform float uA; void main(){ gl_FragColor=vec4(vec3(.8,.86,1.)*(1.-vE)*(1.-vE)*vF*uA*.35,1.); }',
    }));
    streaks.frustumCulled = false;
    scene.add(streaks);
  }

  // ---- the sun ----
  const SUN = v3(0, 0, -330), SUN_R = 34;
  const sunMat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uHeat: { value: 1 } },
    vertexShader: 'varying vec3 vP; varying vec3 vN; void main(){ vP=position; vN=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: noise + `varying vec3 vP; varying vec3 vN; uniform float uT; uniform float uHeat;
      void main(){ vec3 p=normalize(vP)*2.4; vec3 w=vec3(fbm(p+uT*.04),fbm(p+vec3(5.2,1.3,2.)-uT*.03),fbm(p+vec3(2.,7.,4.)))*1.2;
        float n=fbm(p*1.6+w+uT*.02)*.5+.5; float cell=snoise(normalize(vP)*38.+uT*.1)*.5+.5;
        float h=n*.8+cell*.3;
        vec3 c=mix(vec3(.7,.16,.02),vec3(1.,.5,.1),smoothstep(.3,.6,h)); c=mix(c,vec3(1.,.92,.68),smoothstep(.62,.9,h));
        float mu=max(dot(normalize(vN),vec3(0.,0.,1.)),0.); c*=.45+.8*pow(mu,.5);
        gl_FragColor=vec4(c*0.95*uHeat,1.); }`,
  });
  const sun = new THREE.Mesh(new THREE.SphereGeometry(SUN_R, 128, 64), sunMat);
  sun.position.copy(SUN);
  scene.add(sun);
  const billboard = (size, frag) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uA: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: noise + frag,
    }));
    m.renderOrder = 3; scene.add(m); return m;
  };
  const corona = billboard(SUN_R * 7, `varying vec2 vUv; uniform float uT; uniform float uA;
    void main(){ vec2 p=vUv*2.-1.; float r=length(p); float a=atan(p.y,p.x);
      float rays=(snoise(vec3(cos(a)*2.5,sin(a)*2.5,uT*.05))*.5+.5)*(snoise(vec3(cos(a)*9.,sin(a)*9.,uT*.08+4.))*.5+.5);
      float g=exp(-max(r-.29,0.)*8.)*.8+pow(max(0.,1.-r),3.)*rays*1.4; g*=1.-smoothstep(.31,.27,r)*.7;
      gl_FragColor=vec4(mix(vec3(1.,.45,.12),vec3(1.,.82,.52),exp(-r*4.))*g*uA,1.); }`);
  corona.position.copy(SUN);
  // the single point of light (the sun, before it wakes)
  const spark = billboard(14, `varying vec2 vUv; uniform float uA;
    void main(){ vec2 p=vUv*2.-1.; float r=length(p);
      float c=exp(-r*r*700.)*5.+exp(-r*8.)*.7+(exp(-abs(p.y)*150.)+exp(-abs(p.x)*150.))*exp(-r*3.)*.9;
      gl_FragColor=vec4(vec3(1.,.82,.5)*c*uA,1.); }`);
  spark.position.copy(SUN).add(v3(0, 0, SUN_R + 2));

  // ---- Earth at night (NASA Blue Marble + Black Marble) ----
  const EARTH = v3(150, -6, -300), ER = 7;
  const IB = { lat: 40.42, lon: -3.7 }, BOX = new THREE.Vector4(-10.5, 4.5, 35.2, 44.2);
  const earthMat = new THREE.ShaderMaterial({
    uniforms: { uDay: { value: null }, uNight: { value: null }, uIb: { value: null }, uSun: { value: SUN }, uBox: { value: BOX }, uC: { value: EARTH } },
    vertexShader: 'varying vec3 vO; varying vec3 vW; varying vec3 vN; void main(){ vO=position; vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*w; }',
    fragmentShader: noise + `varying vec3 vO; varying vec3 vW; varying vec3 vN; uniform sampler2D uDay; uniform sampler2D uNight; uniform sampler2D uIb; uniform vec3 uSun; uniform vec4 uBox; uniform vec3 uC;
      const float PI=3.14159265;
      void main(){ vec3 p=normalize(vO); float lat=asin(p.y); float lon=atan(-p.z,p.x);
        vec2 uv=vec2((lon+PI)/(2.*PI),(lat+PI*.5)/PI);
        vec3 day=texture2D(uDay,uv).rgb; float li=texture2D(uNight,uv).r; float land=0.;
        vec2 d=vec2((degrees(lon)-uBox.x)/(uBox.y-uBox.x),(degrees(lat)-uBox.z)/(uBox.w-uBox.z));
        float inb=step(0.,d.x)*step(d.x,1.)*step(0.,d.y)*step(d.y,1.);
        float e=smoothstep(0.,.22,min(min(d.x,1.-d.x),min(d.y,1.-d.y)))*inb;
        vec3 ib=texture2D(uIb,d).rgb; li=mix(li*.75,ib.r*.85,e); land=ib.g*e*.5;
        vec3 N=normalize(vN); vec3 L=normalize(uSun-vW); vec3 V=normalize(cameraPosition-vW);
        float k=dot(N,L); float dayk=smoothstep(-.1,.3,k);
        vec3 c=day*dayk*1.2;
        vec3 night=vec3(.006,.01,.022)+vec3(.012,.016,.024)*land;
        c+=night*(1.-dayk);
        c+=vec3(1.,.66,.32)*pow(li,1.4)*2.2*(1.-dayk);
        float fr=pow(1.-max(dot(N,V),0.),2.4);
        c+=vec3(.25,.48,1.)*fr*(.08+1.5*smoothstep(-.35,.25,k));
        gl_FragColor=vec4(c,1.); }`,
  });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(ER, 192, 96), earthMat);
  earth.position.copy(EARTH);
  scene.add(earth);
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(ER * 1.035, 96, 48), new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uSun: { value: SUN }, uC: { value: EARTH } },
    vertexShader: 'varying vec3 vW; varying vec3 vN; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*w; }',
    fragmentShader: 'varying vec3 vW; varying vec3 vN; uniform vec3 uSun; uniform vec3 uC; void main(){ vec3 V=normalize(cameraPosition-vW); float f=pow(max(dot(-normalize(vN),V),0.),5.); float lit=smoothstep(-.5,.4,dot(normalize(vW-uC),normalize(uSun-uC))); gl_FragColor=vec4(mix(vec3(.15,.3,.9),vec3(.55,.75,1.),lit)*f*(.25+1.4*lit),1.); }',
  }));
  atmo.position.copy(EARTH);
  scene.add(atmo);
  // orient Earth so Iberia faces nW, north up; the sun sits behind and to the side → night with a lit rim
  const ll2v = (la, lo) => { const a = THREE.MathUtils.degToRad(la), b = THREE.MathUtils.degToRad(lo); return v3(Math.cos(a) * Math.cos(b), Math.sin(a), -Math.cos(a) * Math.sin(b)); };
  const anti = EARTH.clone().sub(SUN).normalize();
  const side = v3(0, 1, 0).cross(anti).normalize();
  const nW = anti.clone().multiplyScalar(0.45).addScaledVector(v3(0, 1, 0), 0.3).addScaledVector(side, 0.84).normalize();
  const northW = v3(0, 1, 0).addScaledVector(nW, -nW.y).normalize();
  {
    const a = THREE.MathUtils.degToRad(IB.lat), b = THREE.MathUtils.degToRad(IB.lon);
    const nL = ll2v(IB.lat, IB.lon), eL = v3(-Math.sin(b), 0, -Math.cos(b)), uL = v3(-Math.sin(a) * Math.cos(b), Math.cos(a), Math.sin(a) * Math.sin(b));
    const eW = northW.clone().cross(nW).normalize();
    const R = new THREE.Matrix4().makeBasis(eW, northW, nW).multiply(new THREE.Matrix4().makeBasis(eL, uL, nL).transpose());
    earth.quaternion.setFromRotationMatrix(R);
  }
  const beacon = billboard(0.9, `varying vec2 vUv; uniform float uA; void main(){ vec2 p=vUv*2.-1.; float r=length(p); gl_FragColor=vec4(vec3(1.,.8,.45)*(exp(-r*r*60.)*2.4+exp(-r*7.)*.5)*uA,1.); }`);
  beacon.position.copy(EARTH).addScaledVector(nW, ER * 1.004);

  // ---- 5 + 6: the sky over the city, built on a camera-attached plane (units: viewport height = 1) ----
  const ex = o.example;
  const city = cityByName(ex.city);
  const sky = computeSky({ date: ex.date, time: ex.time, lat: city[1], lon: city[2], tz: tzFor(city) });
  const skyGroup = new THREE.Group();
  camera.add(skyGroup);
  const D = 10;
  skyGroup.position.z = -D;
  const veil = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    uniforms: { uA: { value: 0 } }, transparent: true, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'varying vec2 vUv; uniform float uA; void main(){ vec3 top=vec3(.012,.018,.04); vec3 bot=vec3(.05,.08,.17); vec3 c=mix(bot,top,smoothstep(0.,.75,vUv.y)); c+=vec3(.5,.28,.12)*exp(-vUv.y*9.)*.35; gl_FragColor=vec4(c,uA); }',
  }));
  veil.renderOrder = 10; skyGroup.add(veil);
  const SN = sky.stars.length;
  const sA = new Float32Array(SN * 3), sB = new Float32Array(SN * 3), sMag = new Float32Array(SN), sSeed = new Float32Array(SN);
  for (let i = 0; i < SN; i++) { sMag[i] = sky.stars[i].mag; sSeed[i] = rnd(); }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(sA, 3));
  sg.setAttribute('aB', new THREE.BufferAttribute(sB, 3));
  sg.setAttribute('aMag', new THREE.BufferAttribute(sMag, 1));
  sg.setAttribute('aSeed', new THREE.BufferAttribute(sSeed, 1));
  const skyU = { uA: { value: 0 }, uM: { value: 0 }, uT: { value: 0 }, uPx: { value: 1 }, uPosterPx: { value: 1 } };
  const skyStars = new THREE.Points(sg, new THREE.ShaderMaterial({
    uniforms: skyU, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `attribute vec3 aB; attribute float aMag; attribute float aSeed; uniform float uA; uniform float uM; uniform float uT; uniform float uPx; uniform float uPosterPx; varying float vA; varying float vG;
      float e(float x){ return x<.5?4.*x*x*x:1.-pow(-2.*x+2.,3.)/2.; }
      void main(){ float m=e(clamp(uM*1.35-aSeed*.35,0.,1.)); vec3 p=mix(position,aB,m);
        float app=clamp(uA*1.7-(aMag+1.5)/7.*.9-aSeed*.1,0.,1.);
        vA=mix(app*(.8+.2*sin(uT*1.5+aSeed*40.)),1.,m); vG=step(aMag,1.5);
        float r=max(.32,1.9-aMag*.3);
        gl_PointSize=max(1.,mix(r*2.6*uPx, r*2.*uPosterPx, m));
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.); }`,
    fragmentShader: 'varying float vA; varying float vG; void main(){ vec2 q=gl_PointCoord*2.-1.; float r=dot(q,q); float c=smoothstep(1.,.2,r)+exp(-r*3.)*.5; gl_FragColor=vec4(mix(vec3(.953,.922,.847),vec3(.83,.69,.39),vG)*c*vA,1.); }',
  }));
  skyStars.renderOrder = 11; skyStars.frustumCulled = false; skyGroup.add(skyStars);
  const LN = sky.lines.length;
  const lA = new Float32Array(LN * 6), lB = new Float32Array(LN * 6), lO = new Float32Array(LN * 2), lE = new Float32Array(LN * 2);
  sky.lines.map((l, i) => [i, Math.atan2(l[1] + l[3], l[0] + l[2])]).sort((a, b) => a[1] - b[1]).forEach(([i], k) => { lO[i * 2] = lO[i * 2 + 1] = k / LN; lE[i * 2 + 1] = 1; });
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.BufferAttribute(lA, 3));
  lg.setAttribute('aB', new THREE.BufferAttribute(lB, 3));
  lg.setAttribute('aO', new THREE.BufferAttribute(lO, 1));
  lg.setAttribute('aE', new THREE.BufferAttribute(lE, 1));
  const lineU = { uDraw: { value: 0 }, uM: skyU.uM, uA: { value: 0 } };
  const skyLines = new THREE.LineSegments(lg, new THREE.ShaderMaterial({
    uniforms: lineU, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'attribute vec3 aB; attribute float aO; attribute float aE; uniform float uDraw; uniform float uM; varying float vK; varying float vE; float e(float x){ return x<.5?4.*x*x*x:1.-pow(-2.*x+2.,3.)/2.; } void main(){ vK=clamp((uDraw*1.25-aO)*6.,0.,1.); vE=aE; gl_Position=projectionMatrix*modelViewMatrix*vec4(mix(position,aB,e(clamp(uM*1.2,0.,1.))),1.); }',
    fragmentShader: 'varying float vK; varying float vE; uniform float uA; void main(){ if(vE>vK) discard; gl_FragColor=vec4(vec3(.83,.69,.39)*.75*uA,1.); }',
  }));
  skyLines.renderOrder = 12; skyLines.frustumCulled = false; skyGroup.add(skyLines);
  // the lámina's frame lines, drawn as the stars land
  const frame = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xd4af63, transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }));
  frame.renderOrder = 13; skyGroup.add(frame);

  let W = 1, H = 1, unit = 1;
  function layoutSky() {
    // world units per viewport height at distance D
    unit = 2 * D * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const aspect = W / H;
    veil.scale.set(unit * aspect * 1.02, unit * 1.02, 1);
    const R = 0.5 * Math.hypot(aspect, 1) * 1.04 * unit;
    const ph = o.poster.h, pw = ph * 0.75, pcy = 0.5 - o.poster.cy;
    const k = ph / POSTER.h;
    const pcx = ((o.poster.cx ?? 0.5) - 0.5) * aspect;
    const cx = pcx * unit, cy = pcy * unit + (ph / 2 - POSTER.cy * k) * unit;
    const pr = POSTER.r * k * unit;
    for (let i = 0; i < SN; i++) {
      const s = sky.stars[i];
      sA.set([s.x * R, -s.y * R, 0], i * 3);
      sB.set([cx + s.x * pr, cy - s.y * pr, 0], i * 3);
    }
    for (let i = 0; i < LN; i++) {
      const [x1, y1, x2, y2] = sky.lines[i];
      lA.set([x1 * R, -y1 * R, 0, x2 * R, -y2 * R, 0], i * 6);
      lB.set([cx + x1 * pr, cy - y1 * pr, 0, cx + x2 * pr, cy - y2 * pr, 0], i * 6);
    }
    sg.attributes.position.needsUpdate = sg.attributes.aB.needsUpdate = true;
    lg.attributes.position.needsUpdate = lg.attributes.aB.needsUpdate = true;
    // frame: outer rectangle, inner rectangle, disc ring
    const pts = [];
    const top = pcy * unit + (ph / 2) * unit, left = cx - (pw / 2) * unit;
    const rect = (x0, y0, x1, y1) => pts.push(x0, y0, 0, x1, y0, 0, x1, y0, 0, x1, y1, 0, x1, y1, 0, x0, y1, 0, x0, y1, 0, x0, y0, 0);
    const P = (x, y) => [left + x * k * unit, top - y * k * unit];
    rect(...P(11, 11), ...P(289, 389));
    for (let i = 0; i < 128; i++) { const a = (i / 128) * Math.PI * 2, b = ((i + 1) / 128) * Math.PI * 2; pts.push(cx + Math.cos(a) * pr, cy + Math.sin(a) * pr, 0, cx + Math.cos(b) * pr, cy + Math.sin(b) * pr, 0); }
    frame.geometry.dispose();
    frame.geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const px = H / unit; // pixels per world unit
    skyU.uPosterPx.value = (k * unit) * px * (renderer.getPixelRatio());
  }

  // ---- camera path ----
  const E_END = EARTH.clone().addScaledVector(nW, ER * 1.45);
  const path = new THREE.CatmullRomCurve3([
    v3(0, 0, 18), v3(0, 0, 2), v3(0.6, -0.4, -60), v3(-0.8, 0.5, -130), v3(0, 0.6, -205), v3(0, 1, -222),
    v3(60, 14, -250), EARTH.clone().addScaledVector(nW, ER * 9).add(v3(0, 4, 0)), EARTH.clone().addScaledVector(nW, ER * 3.2), E_END,
  ], false, 'centripetal', 0.5);
  // t → arc position: each beat owns a slice of the path, so text and picture stay in step
  const PATHK = [0, 1 / 9, 4 / 9, 5 / 9, 1, 1, 1]; // control-point index / 9 (getPoint, not arc length)
  const pathAt = (t) => {
    for (let i = 0; i < 6; i++) if (t <= BEATS[i + 1]) return PATHK[i] + (PATHK[i + 1] - PATHK[i]) * eio(seg(t, BEATS[i], BEATS[i + 1]));
    return 1;
  };
  const tmp = v3(0, 0, 0);
  const sunScreen = new THREE.Vector3();
  let last = 0;

  function frameAt(t, time = 0) {
    const k = pathAt(t);
    const pos = path.getPoint(Math.min(k, 1));
    const ahead = k < 0.995 ? path.getPoint(Math.min(k + 0.01, 1)) : pos.clone().add(v3(0, 0, -1));
    const speed = pos.distanceTo(path.getPoint(Math.max(k - 0.01, 0)));
    camera.position.copy(pos);
    const toEarth = seg(t, 0.54, 0.62);
    const look = ahead.clone().lerp(SUN, 1 - seg(t, 0.3, 0.42) * 0 ).lerp(ahead, 0);
    tmp.copy(ahead).lerp(SUN, eio(seg(t, 0.34, 0.44)));
    if (t > 0.5) tmp.lerp(EARTH, eio(toEarth));
    if (t > 0.62) tmp.lerp(beacon.position, eio(seg(t, 0.62, 0.72)));
    camera.up.set(0, 1, 0).lerp(northW, eio(seg(t, 0.62, 0.74))).normalize();
    camera.lookAt(tmp);
    camera.rotateZ(Math.sin(seg(t, 0.14, 0.38) * Math.PI * 2) * 0.05);
    void look;

    // 1 darkness → 2 tunnel
    const tun = ss(seg(t, 0.08, 0.16)) * (1 - ss(seg(t, 0.38, 0.47)));
    for (const s of shells) { s.material.uniforms.uA.value = tun; s.material.uniforms.uT.value = time * 0.05 + t * 6; s.material.uniforms.uCam.value = pos.z; }
    dust.material.uniforms.uA.value = ss(seg(t, 0.03, 0.14)) * (1 - ss(seg(t, 0.42, 0.5)));
    streaks.material.uniforms.uA.value = tun;
    streaks.material.uniforms.uLen.value = Math.min(9, speed * (high ? 3.2 : 3.2));
    field.material.uniforms.uFade.value = 0.15 + 0.85 * ss(seg(t, 0.36, 0.5));

    // 3 the sun wakes
    const ign = seg(t, 0.4, 0.5);
    const sScale = Math.max(0.001, 0.02 + 0.98 * eout(ign));
    sun.scale.setScalar(sScale); corona.scale.setScalar(Math.max(0.001, sScale));
    const flash = bump(t, 0.4, 0.425, 0.47);
    sunMat.uniforms.uHeat.value = 0.75 + 0.7 * flash;
    sunMat.uniforms.uT.value = time * 0.3 + t * 40;
    corona.material.uniforms.uA.value = 0.35 + 0.7 * flash;
    corona.material.uniforms.uT.value = time * 0.3 + t * 40;
    spark.material.uniforms.uA.value = (0.7 + 0.3 * ss(seg(t, 0, 0.1))) * (1 - ss(seg(t, 0.4, 0.45)));
    bloom.strength = 0.7 + 0.9 * flash;
    bloom.threshold = 0.72 - 0.25 * flash;
    for (const b of [corona, spark, beacon]) b.quaternion.copy(camera.quaternion);

    // flare follows the sun on screen
    sunScreen.copy(SUN).project(camera);
    const vis = sunScreen.z < 1 && Math.abs(sunScreen.x) < 1.3 && Math.abs(sunScreen.y) < 1.3 ? 1 : 0;
    flare.uniforms.uSun.value.set(sunScreen.x * 0.5 + 0.5, sunScreen.y * 0.5 + 0.5);
    flare.uniforms.uAmt.value = vis * ss(seg(t, 0.42, 0.5)) * (1 - ss(seg(t, 0.6, 0.68))) * 0.9;
    flare.uniforms.uTime.value = high ? 0 : time;

    // 4 Earth (born when the sun has had its moment)
    earth.visible = atmo.visible = beacon.visible = t > 0.5;
    beacon.material.uniforms.uA.value = ss(seg(t, 0.64, 0.72)) * (0.85 + 0.15 * Math.sin(time * 3));
    beacon.scale.setScalar(0.5 + 0.5 * (1 - seg(t, 0.66, 0.74)));

    // 5 looking up → 6 the lámina
    const up = ss(seg(t, 0.72, 0.78));
    veil.material.uniforms.uA.value = up;
    skyU.uA.value = seg(t, 0.75, 0.83);
    skyU.uT.value = time;
    lineU.uDraw.value = seg(t, 0.79, 0.87);
    lineU.uA.value = up;
    skyU.uM.value = seg(t, 0.88, 0.97);
    frame.material.opacity = 0.75 * ss(seg(t, 0.93, 0.99));
    skyStars.visible = skyLines.visible = up > 0.001;

    composer.render();
    last = t;
  }

  function resize(w, h, dpr) {
    W = w; H = h;
    renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
    composer.setPixelRatio(dpr); composer.setSize(w, h);
    bloom.resolution.set((w * dpr) / 2, (h * dpr) / 2);
    camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 64 : 46;
    camera.updateProjectionMatrix();
    flare.uniforms.uAspect.value = w / h;
    const px = dpr * Math.min(w, h) / 900;
    field.material.uniforms.uPx.value = px; dust.material.uniforms.uPx.value = px;
    skyU.uPx.value = dpr * Math.max(1, Math.min(1.6, Math.hypot(w, h) / 1100));
    layoutSky();
    frameAt(last);
  }

  const ready = Promise.all([tex('earth_day_2048.jpg', true), tex('earth_lights_2048.jpg'), tex('iberia.jpg')]).then(([d, n, ib]) => {
    earthMat.uniforms.uDay.value = d; earthMat.uniforms.uNight.value = n; earthMat.uniforms.uIb.value = ib;
    if (high) { flare.uniforms.uGrain.value = 0.012; }
    return true;
  });
  return { frameAt, resize, ready, renderer, dispose: () => renderer.dispose() };
}
