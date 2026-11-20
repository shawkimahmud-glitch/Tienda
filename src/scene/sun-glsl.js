// The Sun, shared by the live 3D scene, the offline film render and the light overlay that keeps it
// alive on top of the film frames. Physics it follows, loosely:
// · granulation: convection cells (bright centres, dark lanes) that boil, drawn as animated Worley cells
// · limb darkening I(μ) = 1 − u(1 − μ), with u larger in blue than in red, so the edge runs warmer
// · faculae: bright patches that only show near the limb · slow differential rotation
// · corona: smooth K-corona plus streamers that flow outwards; a thin chromosphere rim and
//   red prominences just above the limb; a faint star glint so it reads as a star, not a ball.
export const SNOISE = /* glsl */ `
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
`;

// needs snoise; `detail` 0..1 fades the granulation out when the disc is too small to resolve it
export const SUN_SURFACE = /* glsl */ `
vec3 sunH3(vec3 p){ p=vec3(dot(p,vec3(127.1,311.7,74.7)),dot(p,vec3(269.5,183.3,246.1)),dot(p,vec3(113.5,271.9,124.6))); return fract(sin(p)*43758.5453); }
vec2 sunCells(vec3 p, float T){
  vec3 i=floor(p); vec3 f=fract(p); float d1=9.0; float d2=9.0;
  for(int z=-1;z<=1;z++) for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){
    vec3 g=vec3(float(x),float(y),float(z)); vec3 o=sunH3(i+g); o=0.5+0.42*sin(T*0.55+6.2831*o);
    vec3 r=g+o-f; float d=dot(r,r);
    if(d<d1){ d2=d1; d1=d; } else if(d<d2){ d2=d; }
  }
  return sqrt(vec2(d1,d2));
}
vec3 sunSurface(vec3 n, float mu, float T, float detail){
  float rot=T*0.012*(1.0-0.25*n.y*n.y); float c=cos(rot); float s=sin(rot);
  vec3 q=vec3(c*n.x+s*n.z, n.y, -s*n.x+c*n.z);
  vec2 w=sunCells(q*44.0, T); vec2 w2=sunCells(q*88.0+3.1, T*1.3);
  float lane=smoothstep(0.0,0.42,w.y-w.x)*0.75+smoothstep(0.0,0.42,w2.y-w2.x)*0.25;
  float gran=lane*(1.0-w.x*0.35);
  float sup=snoise(q*5.5+vec3(0.0,0.0,T*0.03))*0.5+0.5;
  float act=snoise(q*2.6+vec3(T*0.01,0.0,0.0))*0.5+0.5;
  float I=0.62+0.1*sup+mix(0.14,0.24*gran,detail);
  I+=smoothstep(0.6,0.82,act)*pow(1.0-mu,1.4)*0.42;
  // target colours picked in sRGB (white-gold core, gold body, red-orange limb), written here in linear
  vec3 cLimb=vec3(0.78,0.12,0.006); vec3 cBody=vec3(1.0,0.5,0.06); vec3 cCore=vec3(1.0,0.8,0.38);
  vec3 col=mix(cLimb*0.5, cBody*0.74, smoothstep(0.0,0.75,mu));
  col=mix(col, cCore*0.86, pow(mu,6.0));
  col*=I*1.12;
  return col;
}
`;

// p in disc units (1 = the limb); returns additive light outside the disc
export const SUN_CORONA = /* glsl */ `
vec3 sunCorona(vec2 p, float T){
  float r=length(p); float a=atan(p.y,p.x); vec2 d=p/max(r,1e-4); float o=max(r-1.0,0.0);
  float k=exp(-o*7.0)*0.8+exp(-o*2.2)*0.12;
  float big=snoise(vec3(d*2.1, T*0.02))*0.5+0.5;
  float fine=snoise(vec3(d*12.0, o*2.4-T*0.14))*0.5+0.5;
  float st=pow(big,2.4)*(0.35+0.65*fine)*exp(-o*1.6);
  float pm=smoothstep(0.64,0.86,snoise(vec3(d*4.6, T*0.025+7.0))*0.5+0.5);
  float fl=snoise(vec3(p*8.0, T*0.22))*0.5+0.5;
  float prom=pm*exp(-o*13.0)*smoothstep(0.3,0.75,fl);
  float rim=exp(-abs(r-1.0)*80.0);
  float sp=(pow(abs(cos(a*2.0)),220.0)+0.45*pow(abs(cos(a*2.0+0.785)),480.0))*exp(-o*0.5);
  vec3 c=vec3(1.0,0.55,0.18)*(k+st*0.7)+vec3(1.0,0.22,0.1)*(prom*1.6+rim*0.7)+vec3(1.0,0.78,0.5)*sp*0.28;
  return c*smoothstep(0.985,1.0,r);
}
`;
