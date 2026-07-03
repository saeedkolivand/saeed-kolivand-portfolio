import { Color, ShaderMaterial, Vector3, type IUniform } from "three";

/**
 * Issue 5 "The Press" department material treatments (SPEC Phase 3 Issue 5,
 * palette S0.4 row 5). Four zero-arg factories, each returning a fresh
 * custom ShaderMaterial; the scene builder assembles the factory set and
 * feeds the animation uniforms. Everything is procedural (no textures, so
 * no sRGB decode concern); palette colors go in as three.Color uniforms,
 * which the default color management converts to working linear space.
 *
 * Contract for the scene builder:
 * - Animation uniforms are pure functions of values the scene passes.
 *   Where a material animates over time, feed STEPPED time:
 *     mat.uniforms.uTime.value = stepTime(clock.elapsedTime, fps) // lib/steppedClock
 *   (12 fps, 8 on low tier). Camera/scroll stay smooth per S2.8.
 * - Instancing works out of the box (USE_INSTANCING branch in the shared
 *   vertex shader). Patterns live in post-instance local space, so clones
 *   get distinct pattern phases for free.
 * - Uniform-scale meshes assumed (mat3(modelMatrix) normal transform).
 * - Dispose: standard material.dispose() is sufficient -- these factories
 *   allocate no textures or render targets.
 * - S2.16: single-layer color ops only; emissive variation amplitudes are
 *   clamped in-shader. Spark/pulse POP envelopes are the scene's job and
 *   must go through lib/flashBudget like any flash.
 */

// ---- palette (S0.4 row 5 -- locked) ----------------------------------------
export const PRESS_PALETTE = {
  paper: "#23272E",
  ink: "#E8E4DC",
  react: "#4FC3F7",
  ts: "#3B82C4",
  rust: "#D9772F",
  ai: "#9D6BFF",
} as const;

// ---- shared vertex: local-space pos + world normal/view ---------------------
const VERT = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vNormal;
  varying vec3 vView;

  void main() {
    vec4 p = vec4(position, 1.0);
    vec3 n = normal;
    #ifdef USE_INSTANCING
      p = instanceMatrix * p;
      n = mat3(instanceMatrix) * n;
    #endif
    vPos = p.xyz;
    vec4 wp = modelMatrix * p;
    vNormal = normalize(mat3(modelMatrix) * n);
    vView = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

// ---- shared fragment helpers (pj* prefix, PrintEffect conventions) ----------
const HELPERS = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vNormal;
  varying vec3 vView;

  float pjHash(const in vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  // dominant-axis planar projection: stable 2D pattern coords on boxy geo
  vec2 pjPlanar(const in vec3 p, const in vec3 n) {
    vec3 a = abs(n);
    if (a.y >= a.x && a.y >= a.z) return p.xz;
    if (a.x >= a.z) return p.zy;
    return p.xy;
  }

  // AA line at cell centers of x, half-width w (same convention as PrintEffect)
  float pjLine(const in float x, const in float w) {
    float aa = fwidth(x) * 0.75 + 1e-3;
    return 1.0 - smoothstep(w, w + aa, abs(fract(x) - 0.5));
  }

  // hard-stepped fresnel rim: the inked/energy silhouette band
  float pjRim(const in float edge) {
    return step(edge, 1.0 - max(dot(normalize(vNormal), normalize(vView)), 0.0));
  }
`;

const press = (name: string, frag: string, uniforms: Record<string, IUniform>) =>
  new ShaderMaterial({ name, vertexShader: VERT, fragmentShader: HELPERS + frag, uniforms });

/**
 * 1. REACT dept -- cel-shaded blue energy core.
 * 3 toon steps (matches lib/toon.ts ramp 70/160/255) + hard energy bands
 * rising through the form + stepped fresnel rim, all in #4FC3F7.
 *
 * Uniforms the scene drives:
 * - uTime  (float, seconds) STEPPED: stepTime(elapsed, fps). Bands advance
 *   in discrete 2s pops; leave at 0 for a frozen core.
 * - uEnergy (float 0..1) core glow master; 0 = plain cel object.
 * - uLightDir (vec3, world) match the dept key light.
 */
export function pressReactMaterial(): ShaderMaterial {
  return press(
    "pressReact",
    /* glsl */ `
      uniform vec3 uBase;
      uniform vec3 uGlow;
      uniform vec3 uShadow;
      uniform vec3 uLightDir;
      uniform float uTime;
      uniform float uEnergy;
      uniform float uBandScale;

      void main() {
        float nl = dot(normalize(vNormal), normalize(uLightDir)) * 0.5 + 0.5;
        float cel = nl < 0.34 ? 0.27 : (nl < 0.67 ? 0.63 : 1.0);
        vec3 col = mix(uShadow, uBase, cel);

        // energy bands: hard-edged, ride up the core on stepped time
        float band = step(0.82, fract(vPos.y * uBandScale - uTime * 0.6));
        float glow = clamp(band + pjRim(0.7), 0.0, 1.0) * uEnergy;
        col = mix(col, uGlow, glow);

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    {
      uBase: { value: new Color(PRESS_PALETTE.react).multiplyScalar(0.42) },
      uGlow: { value: new Color(PRESS_PALETTE.react) },
      uShadow: { value: new Color(PRESS_PALETTE.paper) },
      uLightDir: { value: new Vector3(0.5, 0.8, 0.6).normalize() },
      uTime: { value: 0 },
      uEnergy: { value: 1 },
      uBandScale: { value: 1.5 },
    },
  );
}

/**
 * 2. TYPESCRIPT dept -- blueprint lineart. Dark paper ground, #3B82C4
 * minor/major grid, per-cell circuit traces with ink solder nodes, stepped
 * blueprint outline. Fully static: no uTime.
 *
 * Uniforms the scene drives:
 * - uTrace (float 0..1) draw-on progress; traces pop in hash order as it
 *   rises (scrub-safe, monotonic). Drive from shot-local t or a beat.
 * - uGridScale (float, cells per world unit) fit to prop size (default 2).
 */
export function pressTypescriptMaterial(): ShaderMaterial {
  return press(
    "pressTypescript",
    /* glsl */ `
      uniform vec3 uGround;
      uniform vec3 uLine;
      uniform vec3 uBright;
      uniform float uTrace;
      uniform float uGridScale;

      void main() {
        vec2 g = pjPlanar(vPos, normalize(vNormal)) * uGridScale;
        vec3 col = uGround;

        float minor = max(pjLine(g.x, 0.03), pjLine(g.y, 0.03));
        float major = max(pjLine(g.x * 0.2, 0.012), pjLine(g.y * 0.2, 0.012));
        col = mix(col, uLine, minor * 0.25 + major * 0.4);

        // circuit traces: per-cell hash picks a horizontal or vertical run,
        // revealed in hash order by uTrace -- broken segments read as circuits
        vec2 id = floor(g);
        float carry = step(0.62, pjHash(id));
        float horiz = step(0.5, pjHash(id + 31.7));
        float lane = mix(pjLine(g.x, 0.07), pjLine(g.y, 0.07), horiz);
        float on = carry * step(pjHash(id + 7.7), uTrace);
        col = mix(col, uLine, lane * on);

        // solder nodes at live trace cells, in ink
        float node = (1.0 - smoothstep(0.1, 0.16, length(fract(g) - 0.5))) * on;
        col = mix(col, uBright, node * 0.9);

        col = mix(col, uLine, pjRim(0.68) * 0.85);

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    {
      uGround: { value: new Color(PRESS_PALETTE.paper).multiplyScalar(0.7) },
      uLine: { value: new Color(PRESS_PALETTE.ts) },
      uBright: { value: new Color(PRESS_PALETTE.ink) },
      uTrace: { value: 1 },
      uGridScale: { value: 2 },
    },
  );
}

/**
 * 3. RUST dept -- heavy-ink industrial. Brutal 2-step cel over dark iron,
 * THICK near-black fresnel edge band, #D9772F spark speckle gated by a
 * scene-fed pop envelope.
 *
 * Uniforms the scene drives:
 * - uSpark (float 0..1) spark pop envelope. Scene owns the shape (GSAP
 *   beat: fast attack, <=0.4s decay, re-fires < 3 Hz, flashBudget-guarded
 *   per S2.16). Coverage AND brightness scale with it; 0 = fully quiet.
 * - uTime (float, seconds) STEPPED: stepTime(elapsed, fps). Only reseeds
 *   the speckle layout while uSpark > 0; irrelevant when quiet.
 * - uLightDir (vec3, world) match the dept key light.
 */
export function pressRustMaterial(): ShaderMaterial {
  return press(
    "pressRust",
    /* glsl */ `
      uniform vec3 uBase;
      uniform vec3 uInkCol;
      uniform vec3 uSparkCol;
      uniform vec3 uLightDir;
      uniform float uTime;
      uniform float uSpark;

      void main() {
        vec3 N = normalize(vNormal);
        float nl = dot(N, normalize(uLightDir)) * 0.5 + 0.5;
        float cel = nl < 0.45 ? 0.55 : 1.0;
        vec3 col = uBase * cel;

        // heavy ink: wide hard edge band, the signature of this dept
        col = mix(col, uInkCol, pjRim(0.52));

        // sparks: hash speckle, coverage + brightness from the envelope,
        // layout reseeded per time step so pops scatter
        vec2 sp = pjPlanar(vPos, N) * 9.0;
        float seed = floor(uTime * 12.0);
        float lit = step(1.0 - uSpark * 0.22, pjHash(floor(sp) + seed * 0.173));
        float fleck = 1.0 - smoothstep(0.18, 0.3, length(fract(sp) - 0.5));
        col = mix(col, uSparkCol, lit * fleck * uSpark);

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    {
      uBase: { value: new Color(PRESS_PALETTE.paper).multiplyScalar(0.85) },
      uInkCol: { value: new Color(PRESS_PALETTE.paper).multiplyScalar(0.25) },
      uSparkCol: { value: new Color(PRESS_PALETTE.rust) },
      uLightDir: { value: new Vector3(-0.4, 0.9, 0.3).normalize() },
      uTime: { value: 0 },
      uSpark: { value: 0 },
    },
  );
}

/**
 * 4. AI dept -- krackle neural constellation. Near-black field, #9D6BFF
 * glow discs with dark blob cores (the krackle read, same hash-cell idea
 * as the Neon issue's instanced krackle but procedural), per-node shimmer
 * clamped to 0.8..1.0 amplitude and spatially incoherent -- no strobe
 * (S2.16).
 *
 * Uniforms the scene drives:
 * - uTime  (float, seconds) STEPPED: stepTime(elapsed, fps); shimmer +
 *   node reseed happen per 2s step. Leave at 0 for a frozen field.
 * - uPulse (float 0..1) constellation activity; scales node brightness
 *   0.55 -> 1.0 (never to black, so it cannot flash).
 * - uDensity (float, cells per world unit) node density (default 2.5).
 */
export function pressAiMaterial(): ShaderMaterial {
  return press(
    "pressAi",
    /* glsl */ `
      uniform vec3 uField;
      uniform vec3 uNode;
      uniform vec3 uInkCol;
      uniform float uTime;
      uniform float uPulse;
      uniform float uDensity;

      void main() {
        vec3 N = normalize(vNormal);
        vec2 q = pjPlanar(vPos, N) * uDensity;
        vec2 id = floor(q);
        vec2 f = fract(q);

        vec2 c = vec2(0.25) + 0.5 * vec2(pjHash(id), pjHash(id + 13.1));
        float d = length(f - c);
        float r = 0.16 + 0.1 * pjHash(id + 3.7);
        float aa = fwidth(d) + 1e-3;

        // bounded, per-cell incoherent shimmer -- never a full-field flash
        float tw = 0.8 + 0.2 * pjHash(id + floor(uTime * 12.0) * 0.31);

        float glow = 1.0 - smoothstep(r * 0.4, r + aa, d);
        float core = 1.0 - smoothstep(r * 0.34 - aa, r * 0.34 + aa, d);

        vec3 col = uField;
        col = mix(col, uNode * tw * (0.55 + 0.45 * uPulse), glow);
        col = mix(col, uInkCol, core); // dark blob inside the glow = krackle
        col = mix(col, uNode * 0.5, pjRim(0.66) * 0.6);

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    {
      uField: { value: new Color(PRESS_PALETTE.paper).multiplyScalar(0.45) },
      uNode: { value: new Color(PRESS_PALETTE.ai) },
      uInkCol: { value: new Color(PRESS_PALETTE.paper).multiplyScalar(0.2) },
      uTime: { value: 0 },
      uPulse: { value: 1 },
      uDensity: { value: 2.5 },
    },
  );
}
