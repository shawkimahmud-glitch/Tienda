// The hero: a golden, crystalline star floating in front of three layers of stars.
// Physical material (transmission, clearcoat, a touch of iridescence) under a warm studio light,
// finished with bloom. It turns slowly, follows the finger / pointer / gyroscope, and dives
// towards the camera as the journey starts (the star becomes the Sun of the film).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ss = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };

// a crystalline star in true 3D: faceted rays along every axis (long in the picture plane, shorter
// towards the viewer, small ones on the diagonals), so it reads as a star from any angle
function starGeometry() {
  const p = [];
  const ray = (dir, len, base) => {
    const d = new THREE.Vector3(...dir).normalize();
    const u = new THREE.Vector3(Math.abs(d.y) > 0.9 ? 1 : 0, Math.abs(d.y) > 0.9 ? 0 : 1, 0).cross(d).normalize();
    const v = d.clone().cross(u).normalize();
    const tip = d.clone().multiplyScalar(len);
    const c = [u.clone().multiplyScalar(base), v.clone().multiplyScalar(base), u.clone().multiplyScalar(-base), v.clone().multiplyScalar(-base)];
    for (let i = 0; i < 4; i++) { const A = c[i], B = c[(i + 1) % 4]; p.push(A.x, A.y, A.z, B.x, B.y, B.z, tip.x, tip.y, tip.z); }
  };
  for (const s of [1, -1]) { ray([s, 0, 0], 1, 0.2); ray([0, s, 0], 1.12, 0.2); ray([0, 0, s], 0.62, 0.18); }
  for (const a of [1, -1]) for (const b of [1, -1]) { ray([a, b, 0], 0.5, 0.13); ray([a * 0.7, b * 0.7, 0.6], 0.36, 0.1); ray([a * 0.7, b * 0.7, -0.6], 0.36, 0.1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.computeVertexNormals();
  return g;
}

// a soft additive sprite (core glow and the long glints)
function glow(size, frag) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.ShaderMaterial({
    uniforms: { uA: { value: 1 }, uT: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `varying vec2 vUv; uniform float uA; uniform float uT; ${frag}`,
  }));
  return m;
}

function starLayer(count, zNear, zFar, size, spread, gold, seed) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const pos = new Float32Array(count * 3), sz = new Float32Array(count), ph = new Float32Array(count), warm = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const z = -(zNear + (zFar - zNear) * rnd()), w = (spread.x * -z), h = (spread.y * -z);
    pos[i * 3] = (rnd() * 2 - 1) * w; pos[i * 3 + 1] = (rnd() * 2 - 1) * h; pos[i * 3 + 2] = z;
    sz[i] = size[0] + (size[1] - size[0]) * Math.pow(rnd(), 3);
    ph[i] = rnd() * 6.283; warm[i] = rnd() < gold ? 1 : rnd() * 0.25;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
  g.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
  g.setAttribute('aWarm', new THREE.BufferAttribute(warm, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uPx: { value: 1 }, uT: { value: 0 }, uA: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aSize; attribute float aPh; attribute float aWarm; uniform float uPx; uniform float uT; varying float vB; varying float vW;
      void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv;
        float tw=0.75+0.25*sin(uT*1.3+aPh*7.0); vB=tw; vW=aWarm; gl_PointSize=aSize*uPx; }`,
    fragmentShader: `uniform float uA; varying float vB; varying float vW;
      void main(){ vec2 c=gl_PointCoord-0.5; float d=length(c); float a=smoothstep(0.5,0.0,d); a*=a;
        vec3 col=mix(vec3(1.0,0.96,0.88), vec3(1.0,0.8,0.45), vW);
        gl_FragColor=vec4(col*a*vB*uA, a*vB*uA); }`,
  });
  return new THREE.Points(g, mat);
}

/**
 * @param {{ canvas: HTMLCanvasElement, quality?: 'high'|'live' }} o
 */
export function createStar(o) {
  const high = o.quality === 'high';
  const renderer = new THREE.WebGLRenderer({ canvas: o.canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: high });
  renderer.setClearColor(0x000000, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  const pmrem = new THREE.PMREMGenerator(renderer);
  // a jeweller's studio: dark room, a few warm softbox strips → deep facets with sharp bright edges
  const studio = new THREE.Scene();
  studio.background = new THREE.Color(0x020202);
  const box = (w, h, pos, rot, k) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.88, 0.68).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos); m.rotation.set(...rot); studio.add(m);
  };
  box(6, 1.2, [0, 6, 2], [Math.PI / 2, 0, 0], 3.2);
  box(1.4, 8, [-7, 0, 3], [0, Math.PI / 2, 0], 2.6);
  box(1.0, 6, [7, 1, -2], [0, -Math.PI / 2, 0], 2.2);
  box(8, 0.6, [0, -5, -4], [-Math.PI / 3, 0, 0], 2.2);
  box(3, 3, [0, 1, 8], [0, Math.PI, 0], 1.4);
  const env = pmrem.fromScene(studio, 0.02).texture;
  scene.environment = env;
  scene.environmentIntensity = 1.3;

  // warm key, soft fill, golden rim: the star reads as cut glass, not plastic
  const key = new THREE.DirectionalLight(0xfff0d0, 3.2); key.position.set(3, 4, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffc870, 3.2); rim.position.set(-4, -1.5, -3); scene.add(rim);
  const fill = new THREE.PointLight(0xffe2a8, 0.45, 8, 2); fill.position.set(1.2, 1.6, 2.6); scene.add(fill);

  const star = new THREE.Group();
  star.rotation.order = 'YXZ';
  const gem = new THREE.Mesh(starGeometry(), new THREE.MeshPhysicalMaterial({
    color: 0xeab552, metalness: 0.74, roughness: 0.06, transmission: 0.22, thickness: 0.8, ior: 2.2,
    attenuationColor: new THREE.Color(0xd4af63), attenuationDistance: 0.75,
    clearcoat: 1, clearcoatRoughness: 0.05, iridescence: 0.28, iridescenceIOR: 1.45,
    specularIntensity: 1, specularColor: new THREE.Color(0xfff0c8), envMapIntensity: 2.4,
    emissive: new THREE.Color(0x7a4c10), emissiveIntensity: 0.42, flatShading: true, side: THREE.DoubleSide,
  }));
  star.add(gem);
  // the light inside the crystal, and the long glints that make it a star
  const core = glow(1.5, `void main(){ vec2 p=vUv*2.-1.; float r=length(p);
      float c=exp(-r*r*48.)*1.0+exp(-r*6.5)*0.26; gl_FragColor=vec4(vec3(1.,.83,.5)*c*uA,1.); }`);
  core.renderOrder = 2; star.add(core);
  const rays = glow(2.9, `void main(){ vec2 p=vUv*2.-1.; float r=length(p);
      float s=exp(-abs(p.y)*170.)*exp(-abs(p.x)*3.6)+exp(-abs(p.x)*170.)*exp(-abs(p.y)*3.6);
      vec2 q=mat2(.7071,-.7071,.7071,.7071)*p; s+=0.3*(exp(-abs(q.y)*240.)*exp(-abs(q.x)*6.)+exp(-abs(q.x)*240.)*exp(-abs(q.y)*6.));
      float tw=0.85+0.15*sin(uT*1.7); gl_FragColor=vec4(vec3(1.,.86,.6)*s*tw*uA*0.7,1.); }`);
  rays.position.z = 0.05; rays.renderOrder = 3;
  scene.add(star); scene.add(rays);

  // three depths of stars → parallax when the camera drifts with the finger / gyro
  const spread = { x: 0.9, y: 1.1 };
  const layers = [
    starLayer(1100, 38, 70, [1.1, 2.4], spread, 0.08, 7),
    starLayer(420, 16, 30, [1.6, 3.4], spread, 0.18, 13),
    starLayer(70, 6, 11, [2.6, 5.2], spread, 0.4, 29),
  ];
  for (const l of layers) scene.add(l);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.55, 0.86);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  let W = 1, H = 1, dist = 6, lift = 0, spin = 0;
  const cam = new THREE.Vector3();

  function resize(w, h, dpr) {
    W = w; H = h;
    renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
    composer.setPixelRatio(dpr); composer.setSize(w, h);
    bloom.resolution.set((w * dpr) / 2, (h * dpr) / 2);
    const aspect = w / h, t = Math.tan((camera.fov * Math.PI) / 360);
    camera.aspect = aspect; camera.updateProjectionMatrix();
    // the star spans ~56% of the width on a phone, ~46% of the height on a wide screen
    dist = Math.max(2.24 / (aspect < 0.8 ? 0.4 : 0.5) / (2 * t), 2 / 0.82 / (2 * t * aspect));
    lift = aspect < 0.8 ? 0.31 * dist * t : 0.08 * dist * t; // keep the lower part free for the headline
    const px = dpr * Math.max(0.8, Math.min(1.5, Math.hypot(w, h) / 1100));
    for (const l of layers) l.material.uniforms.uPx.value = px;
  }

  /**
   * @param {number} time seconds
   * @param {{ x: number, y: number, spin: number, dive: number }} s  pointer/gyro (-1..1), extra spin (rad), dive 0..1
   */
  function frame(time, s) {
    spin = s.spin;
    const d = ss(s.dive);
    // the camera looks at the centre, so the star (raised by `lift`) sits above the headline;
    // on the dive it travels up to the star
    cam.set(s.x * 0.55, -s.y * 0.4 + lift * d, dist * (1 - 0.72 * d));
    camera.position.copy(cam);
    camera.lookAt(0, lift * d, 0);
    star.position.y = lift + Math.sin(time * 0.9) * 0.07;
    // it turns slowly in its own plane (always showing its face) and sways; the finger turns it round
    star.rotation.set(0.22 * Math.sin(time * 0.27) + s.y * 0.35, 0.55 * Math.sin(time * 0.33) + spin + s.x * 0.6, time * 0.16);
    rays.position.y = star.position.y;
    rays.quaternion.copy(camera.quaternion);
    core.quaternion.copy(camera.quaternion).premultiply(star.quaternion.clone().invert());
    rays.material.uniforms.uT.value = time;
    rays.material.uniforms.uA.value = 1 + d * 1.2;
    core.material.uniforms.uA.value = 1 + d * 1.6;
    bloom.strength = 0.6 + d * 1.0;
    for (let i = 0; i < 3; i++) { layers[i].material.uniforms.uT.value = time; layers[i].rotation.z = time * (0.004 + i * 0.002); }
    composer.render();
  }

  return { frame, resize, dispose: () => { renderer.dispose(); env.dispose(); pmrem.dispose(); } };
}
