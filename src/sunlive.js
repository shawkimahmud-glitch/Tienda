// Keeps the sun alive on top of the film frames: a small WebGL canvas that redraws only the solar
// disc (boiling granulation, slow rotation) exactly where the frame drew it, with the same shader
// as the 3D scene. It runs only while the film rests near the sun, at 30 fps, and costs nothing elsewhere.
import { SNOISE, SUN_SURFACE } from './scene/sun-glsl.js';

const VS = 'attribute vec2 a; varying vec2 v; void main(){ v=a; gl_Position=vec4(a,0.,1.); }';
const FS = `precision highp float; varying vec2 v; uniform float uT; uniform float uDetail; uniform float uGain;
${SNOISE}${SUN_SURFACE}
vec3 toSRGB(vec3 c){ c=clamp(c,0.,1.); return mix(c*12.92, 1.055*pow(c,vec3(1./2.4))-0.055, step(0.0031308,c)); }
void main(){
  vec2 p=v*1.06; float r=length(p);
  if(r>1.0){ gl_FragColor=vec4(0.); return; }
  float mu=sqrt(1.0-r*r);
  vec3 c=toSRGB(sunSurface(vec3(p.x,p.y,mu),mu,uT,uDetail)*uGain);
  float a=smoothstep(1.0,0.965,r);
  gl_FragColor=vec4(c*a,a);
}`;

const ss = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };

export function sunOverlay(stage, film, url) {
  const cv = document.createElement('canvas');
  cv.className = 'trip__sun';
  cv.setAttribute('aria-hidden', 'true');
  film.after(cv);
  const gl = cv.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
  if (!gl) { cv.remove(); return null; }
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { cv.remove(); return null; }
  gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'a');
  gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uT = gl.getUniformLocation(pr, 'uT'), uD = gl.getUniformLocation(pr, 'uDetail'), uG = gl.getUniformLocation(pr, 'uGain');
  gl.uniform1f(uG, 1.2);

  let data = null, raf = 0, on = false, live = 0, since = 0, lastDraw = 0, size = 0;
  const st = { p: 0, pack: null };
  fetch(url).then((r) => r.json()).then((d) => { data = d; }).catch(() => {});

  const at = (p) => {
    const f = p * (data.frames - 1) - data.from, n = data.sun.length;
    if (f < 0 || f > n - 1) return null;
    const i = Math.floor(f), k = f - i, A = data.sun[i], B = data.sun[Math.min(n - 1, i + 1)];
    return { x: A[0] + (B[0] - A[0]) * k, y: A[1] + (B[1] - A[1]) * k, r: A[2] + (B[2] - A[2]) * k, T: A[3] + (B[3] - A[3]) * k, vis: A[4] && B[4] };
  };
  const frame = (now) => {
    raf = on ? requestAnimationFrame(frame) : 0;
    if (!on || now - lastDraw < 32) return; // 30 fps is plenty for a boiling surface
    lastDraw = now;
    const s = at(st.p); if (!s) return;
    const pk = st.pack, vw = stage.clientWidth, vh = stage.clientHeight;
    const k = Math.max(vw / pk.width, vh / pk.height), fw = pk.width * k, fh = pk.height * k;
    const cx = (vw - fw) / 2 + s.x * fw, cy = (vh - fh) / 2 + s.y * fh, R = s.r * fh * 1.06;
    const dpr = Math.min(devicePixelRatio || 1, 1.25), px = Math.ceil(R * 2 * dpr);
    if (Math.abs(px - size) > size * 0.08) { size = px; cv.width = cv.height = px; gl.viewport(0, 0, px, px); }
    cv.style.width = cv.style.height = `${(R * 2).toFixed(1)}px`;
    cv.style.transform = `translate(${(cx - R).toFixed(1)}px, ${(cy - R).toFixed(1)}px)`;
    live += since ? (now - since) / 1000 : 0; since = now;
    gl.uniform1f(uT, s.T + live * 1.4);
    gl.uniform1f(uD, 0.6 * Math.min(1, Math.max(0, (R * 2 - 60) / 200))); // the film is softened by bloom; match it
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  return {
    // called by the film every tick with the smoothed progress
    update(p, pack) {
      if (!data || !pack?.width) return;
      st.p = p; st.pack = pack;
      const s = at(p);
      const a = s && s.vis ? ss((p - 0.462) / 0.025) * (1 - ss((p - 0.548) / 0.03)) : 0;
      cv.style.opacity = a.toFixed(3);
      const want = a > 0.001;
      if (want && !on) { on = true; since = 0; live = 0; raf ||= requestAnimationFrame(frame); }
      if (!want && on) { on = false; }
    },
  };
}
