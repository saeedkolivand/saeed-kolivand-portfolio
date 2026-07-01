// GLSL for the OUTSIDE scene. Kept as string constants so the .tsx files stay readable and
// the shaders are diffable in one place. Every fragment that writes final scene colour ends
// with the same chunk trio three's own materials use — <tonemapping_fragment> /
// <colorspace_fragment> / <fog_fragment> — so these ShaderMaterials behave identically to
// built-ins under the @react-three/postprocessing composer (they render linear into its
// buffer; the composer owns the final sRGB encode). Light overlays (rain + glow are additive,
// glass is alpha-blended) skip tonemapping+fog and only encode colour.

// Small self-contained hash/value-noise/fbm prelude, injected where needed.
const NOISE = /* glsl */ `
float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  float a=h21(i), b=h21(i+vec2(1.0,0.0)), c=h21(i+vec2(0.0,1.0)), d=h21(i+vec2(1.0,1.0));
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }
float fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<2;i++){ s+=a*n2(p); p*=2.0; a*=0.5; } return s; }
`;

// (The sky dome now uses a real equirect night-sky texture — see Environment.tsx.)

// ---- City / hero towers: instanced, in-shader window grid + fresnel edge, fogged ----
// USE_INSTANCING is defined by three only for InstancedMesh, so this one shader serves both
// the instanced city AND the single non-instanced hero tower (which has no instanceMatrix).
export const TOWER_VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
#ifdef USE_INSTANCING
  attribute float aSeed;
  attribute float aLit;
#else
  uniform float aSeed;
  uniform float aLit;
#endif
varying vec2 vUv; varying vec3 vViewNormal; varying float vSeed; varying float vLit;
void main(){
  vUv = uv; vSeed = aSeed; vLit = aLit;
  #ifdef USE_INSTANCING
    mat4 local = instanceMatrix;
  #else
    mat4 local = mat4(1.0);
  #endif
  vec4 mvPosition = modelViewMatrix * local * vec4(position, 1.0);
  vViewNormal = normalize((modelViewMatrix * local * vec4(normal, 0.0)).xyz);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;
export const TOWER_FRAG = /* glsl */ `
#include <common>
#include <tonemapping_pars_fragment>
#include <fog_pars_fragment>
uniform vec3 uBody; uniform vec3 uEdge; uniform vec3 uWindowDim; uniform vec3 uCyan;
uniform float uTime; uniform float uThreshold;
varying vec2 vUv; varying vec3 vViewNormal; varying float vSeed; varying float vLit;
float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
void main(){
  vec2 grid = vec2(5.0, 14.0);
  vec2 cell = floor(vUv*grid);
  vec2 f = fract(vUv*grid);
  float win = step(0.16,f.x)*step(f.x,0.84)*step(0.14,f.y)*step(f.y,0.86);
  float lit = step(uThreshold, h21(cell + vSeed*17.3)) * vLit;
  float flick = 1.0 - 0.35*step(0.98, h21(cell + floor(uTime*1.7)));
  vec3 winCol = mix(uWindowDim, uCyan, step(0.90, h21(cell + vSeed*3.1))) * flick;
  float fres = pow(1.0 - abs(vViewNormal.z), 2.5);
  vec3 body = mix(uBody, uEdge, fres*0.8);
  vec3 col = mix(body, winCol, win*lit);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

// ---- Rain: GPU points stretched into slanted streaks, wrap-falling via uTime ----
export const RAIN_VERT = /* glsl */ `
uniform float uTime; uniform float uFall; uniform float uWind; uniform float uSpanY; uniform float uSize;
attribute float aSeed;
varying float vFade;
void main(){
  vec3 p = position;
  float fall = mod(p.y - uTime*uFall + aSeed*uSpanY, uSpanY);
  p.y = fall - uSpanY*0.5;
  p.x += (uSpanY*0.5 - fall) * uWind * 0.015;
  vFade = 0.6 + 0.4*aSeed;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = clamp(uSize * (260.0 / -mv.z), 1.0, 28.0);
  gl_Position = projectionMatrix * mv;
}
`;
export const RAIN_FRAG = /* glsl */ `
uniform vec3 uColor; uniform float uOpacity; uniform sampler2D uSprite;
varying float vFade;
void main(){
  float t = texture2D(uSprite, gl_PointCoord).r; // white streak on black
  float a = t * uOpacity * vFade;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}
`;

// ---- Rain-on-glass threshold pane: procedural rivulets + beads (transparent overlay) ----
export const GLASS_VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
export const GLASS_FRAG = /* glsl */ `
uniform float uTime; uniform float uRivulet; uniform vec3 uWarm; uniform vec3 uCool;
varying vec2 vUv;
${NOISE}
void main(){
  vec2 uv = vUv;
  float trail = fbm(vec2(uv.x*26.0, uv.y*7.0 - uTime*uRivulet));
  float rivulet = smoothstep(0.62, 0.95, trail);
  float beads = smoothstep(0.75, 1.0, h21(floor(uv*vec2(34.0, 54.0))));
  float wet = max(rivulet, beads*0.6);
  vec3 col = uCool*wet*0.5 + uWarm*pow(wet, 3.0)*0.9;
  float alpha = clamp(wet*0.55, 0.0, 0.8);
  gl_FragColor = vec4(col, alpha);
  #include <colorspace_fragment>
}
`;

// ---- Neon signage: instanced quads, each showing one cell of the neon atlas (additive) ----
export const SIGN_VERT = /* glsl */ `
uniform vec2 uGrid;
attribute float aCell;
varying vec2 vUv;
void main(){
  float col = mod(aCell, uGrid.x);
  float row = floor(aCell / uGrid.x);
  vec2 cell = vec2(col, uGrid.y - 1.0 - row); // flip row so cell 0 is top-left of the atlas
  vUv = (uv + cell) / uGrid;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}
`;
export const SIGN_FRAG = /* glsl */ `
uniform sampler2D uAtlas;
varying vec2 vUv;
void main(){
  vec3 c = texture2D(uAtlas, vUv).rgb; // neon glyphs on black; additive => black adds nothing
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}
`;

// ---- Radial additive glow: window glow sprite + haze pockets (fake volumetric) ----
export const GLOW_VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
export const GLOW_FRAG = /* glsl */ `
uniform vec3 uColor; uniform float uOpacity;
varying vec2 vUv;
void main(){
  float d = length(vUv - 0.5) * 2.0;
  float a = smoothstep(1.0, 0.0, d);
  a *= a;
  gl_FragColor = vec4(uColor, a*uOpacity);
  #include <colorspace_fragment>
}
`;

// ---- Wet street: analytic accent reflections + fresnel sheen + ripples, fogged ----
export const STREET_VERT = /* glsl */ `
#include <fog_pars_vertex>
varying vec2 vUv;
void main(){
  vUv = uv;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;
export const STREET_FRAG = /* glsl */ `
#include <common>
#include <tonemapping_pars_fragment>
#include <fog_pars_fragment>
uniform float uTime; uniform sampler2D uAsphalt; uniform float uTile; uniform vec3 uCyan; uniform vec3 uWarm; uniform float uRipple;
varying vec2 vUv;
void main(){
  vec3 col = texture2D(uAsphalt, vUv * uTile).rgb * 0.85; // real wet-asphalt albedo, tiled

  float up = smoothstep(0.0, 1.0, vUv.y);
  float ripple = sin(length(vUv - 0.5)*60.0 - uTime*uRipple*10.0)*0.5 + 0.5;
  float cyanSmear = smoothstep(0.5, 0.0, abs(vUv.x - 0.35)) * up * (0.5 + 0.5*ripple);
  float warmSmear = smoothstep(0.5, 0.0, abs(vUv.x - 0.62)) * up;
  col += uCyan * cyanSmear * 0.25;
  col += uWarm * warmSmear * 0.12;
  col += uCyan * pow(vUv.y, 4.0) * 0.06;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;
