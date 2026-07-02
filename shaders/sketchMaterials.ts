import { Color, ShaderMaterial, Vector2, Vector3, type IUniform } from "three";

/**
 * Issue 9 "Sketchbook" material layer (SPEC Phase 3 Issue 9, palette S0.4
 * row 9). Procedural pencil-to-ink-to-color material plus an ink pawprint
 * decal material. No textures, no render targets; everything is a pure
 * function of the uniforms, so the whole issue scrubs both directions.
 *
 * The look morphs through three authored stages on ONE uniform, uInk:
 *   A [0.00 .. 0.05]  pencil: graphite hatch on paper, direction-jittered
 *                     strokes with hand-pressure gaps, 8 fps line boil.
 *   B [0.05 .. 0.60]  inking: each stroke draws itself on tip-first in
 *                     hash order and solidifies to ink (pressure variance
 *                     drops out). Monotonic in uInk, deterministic both
 *                     scroll directions. Contours ink in the first quarter.
 *   -- (0.60 .. 0.65) fully inked line art, held breath, no color yet.
 *   C [0.65 .. 1.00]  color flood: flat wash fill sweeps across the set
 *                     like a print run; front position is a pure linear
 *                     f(uInk) along uSweepDir across uSweepSpan.
 *
 * Contract for the scene builder:
 * - Drive uInk from shot-local t (scrub-safe). Drive uTime STEPPED:
 *     mat.uniforms.uTime.value = stepTime(clock.elapsedTime, 8) // lib/steppedClock
 *   Boil is 8 fps by design (this issue is the slow one) and only reseats
 *   strokes laterally by <= 0.05 of the row spacing (S2.16-small).
 * - Lit, not unlit (deliberate): uLightDir drives hatch density -- the lit
 *   side carries one light layer, the shade side gains the cross-hatch
 *   layer. Flat cel logic only; match the issue key light.
 * - uSweepSpan must bracket dot(localPos, uSweepDir) over every mesh that
 *   shares the sweep (the shader pads 0.25 for the ragged roller edge).
 *   One shared span across the set makes the flood read as one print run.
 * - Instancing works (USE_INSTANCING branch); patterns are in post-instance
 *   local space, so robot clones hatch differently for free.
 * - Uniform-scale meshes assumed (mat3(modelMatrix) normal transform).
 * - Dispose: material.dispose() is sufficient -- no textures or RTs are
 *   allocated here. Pawprints are one clone() per print (each carries its
 *   own uSeed); dispose each clone, or share one geometry + dispose it once.
 * - S2.16: single-layer color ops only; one AA edge per stroke/front; no
 *   channel tricks anywhere. Flood is a hard ragged wipe, never a fade-blur.
 */

// ---- palette (S0.4 row 9 -- locked) ----------------------------------------
export const SKETCH_PALETTE = {
  paper: "#F7F2E7",
  graphite: "#5A564E",
  ink: "#232019",
  wash: "#6FA8DC",
} as const;

// ---- shared vertex: local-space pos + world normal/view (press convention) --
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

const HASH = /* glsl */ `
  float pjHash(const in vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
`;

// ---- fragment helpers (pj* prefix, PrintEffect conventions) -----------------
const HELPERS = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vNormal;
  varying vec3 vView;

  ${HASH}

  // dominant-axis planar projection: stable 2D pattern coords on boxy geo
  vec2 pjPlanar(const in vec3 p, const in vec3 n) {
    vec3 a = abs(n);
    if (a.y >= a.x && a.y >= a.z) return p.xz;
    if (a.x >= a.z) return p.zy;
    return p.xy;
  }

  // hard-stepped fresnel rim: the pencil/ink silhouette contour
  float pjRim(const in float edge) {
    return step(edge, 1.0 - max(dot(normalize(vNormal), normalize(vView)), 0.0));
  }

  // One hatch layer, evaluated in rotated stroke space.
  //   x = stroke core mask (AA line, end-taper gaps + lifted strokes applied)
  //   y = hand-pressure weight (0.55..1.0 per stroke, pencil only)
  //   z = per-stroke reveal hash (0..1: ink draw order)
  //   w = along-stroke coord (0..1: the draw-on tip runs left to right)
  vec4 pjHatch(const in vec2 q, const in float angle, const in float seed, const in float boil) {
    float c = cos(angle);
    float s = sin(angle);
    vec2 r = mat2(c, s, -s, c) * q;
    float rid = floor(r.y);
    float rh = pjHash(vec2(rid, seed));
    // strokes segment the row; hash phase so ends never align across rows
    float sc = r.x * 0.55 + rh * 7.0;
    float sid = floor(sc);
    float sx = fract(sc);
    float hs = pjHash(vec2(rid * 0.317 + sid, seed + 9.1));
    // direction jitter: each stroke tilts a touch off the row axis
    float tilt = (hs - 0.5) * 0.4 * (sx - 0.5);
    // 8 fps boil: tiny lateral reseat per step (amplitude 0.05 row, S2.16)
    float bo = (pjHash(vec2(rid, sid) + boil * 0.173) - 0.5) * 0.1;
    float d = abs(fract(r.y + tilt + bo) - 0.5);
    float aa = fwidth(r.y) * 0.75 + 1e-3;
    float w = 0.05 + 0.09 * pjHash(vec2(sid, rid) + seed);
    float line = 1.0 - smoothstep(w, w + aa, d);
    // hand pressure: tapered ends leave gaps, some strokes lift entirely
    float ends = smoothstep(0.0, 0.14, sx) * (1.0 - smoothstep(0.82, 1.0, sx));
    float lift = step(0.12, hs);
    float press = 0.55 + 0.45 * pjHash(vec2(sid + 5.2, rid) + seed);
    return vec4(line * ends * lift, press, hs, sx);
  }
`;

/**
 * The Sketchbook workhorse. One material, three stages, one scrub uniform.
 *
 * Uniforms the scene drives:
 * - uInk        (float 0..1) master stage scrub -- see the band map above.
 * - uTime       (float, seconds) STEPPED: stepTime(elapsed, 8). Pencil/ink
 *               line boil only; 0 freezes the boil, nothing else moves.
 * - uLightDir   (vec3, world) hatch-density light; match the issue key.
 * - uFill       (color) stage-C flat fill; default wash #6FA8DC. Set per
 *               prop for palette variety (fill floods, linework stays ink).
 * - uSweepDir   (vec3, LOCAL space) flood travel direction (normalized in
 *               shader). Default (1, 0.35, 0): left-to-right, slightly up.
 * - uSweepSpan  (vec2 lo,hi) dot(localPos, uSweepDir) range to cover.
 * - uHatchScale (float) stroke rows per world unit (default 6; raise for
 *               small props so hatching stays readable at 200px).
 */
export function sketchMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    name: "sketch",
    vertexShader: VERT,
    fragmentShader:
      HELPERS +
      /* glsl */ `
      uniform vec3 uPaper;
      uniform vec3 uGraphite;
      uniform vec3 uInkCol;
      uniform vec3 uFill;
      uniform vec3 uLightDir;
      uniform vec3 uSweepDir;
      uniform vec2 uSweepSpan;
      uniform float uInk;
      uniform float uTime;
      uniform float uHatchScale;

      void main() {
        vec3 N = normalize(vNormal);
        vec2 q = pjPlanar(vPos, N) * uHatchScale;
        float boil = floor(uTime * 8.0);

        // paper with a static micro tooth
        vec3 col = uPaper - pjHash(floor(q * 7.3)) * 0.045;

        float nl = dot(N, normalize(uLightDir)) * 0.5 + 0.5;

        // stage progress: B ink band [0.05, 0.60], C flood band [0.65, 1.0]
        float prog = clamp((uInk - 0.05) / 0.55, 0.0, 1.0);
        float fprog = clamp((uInk - 0.65) / 0.35, 0.0, 1.0);

        // C: print-run sweep -- hard ragged front, pure f(uInk)
        float dsw = dot(vPos, normalize(uSweepDir));
        float front = mix(uSweepSpan.x - 0.25, uSweepSpan.y + 0.25, fprog);
        float rag = (pjHash(vec2(floor(q.y * 1.7), 5.5)) - 0.5) * 0.3;
        float flood = step(dsw + rag, front) * step(1e-4, fprog);
        col = mix(col, uFill, flood);

        // hatch: main diagonal layer always, cross layer in shade only
        vec4 h1 = pjHatch(q, 0.75, 3.0, boil);
        vec4 h2 = pjHatch(q, -0.6, 11.0, boil);
        float shade = step(nl, 0.55);

        // B: draw-on -- stroke starts at hash*0.85, tip advances over 0.15
        float draw1 = step(h1.w, clamp((prog - h1.z * 0.85) / 0.15, 0.0, 1.0));
        float draw2 = step(h2.w, clamp((prog - h2.z * 0.85) / 0.15, 0.0, 1.0));

        // graphite: pressure-weighted, lighter where lit, gone under flood
        float g1 = h1.x * h1.y * (0.45 + 0.55 * (1.0 - nl));
        float g2 = h2.x * h2.y * shade;
        float graphite = max(g1, g2) * (1.0 - flood);
        // ink: solid (pressure drops out), stays on top of the fill
        float ink = max(h1.x * draw1, h2.x * draw2 * shade);

        col = mix(col, uGraphite, graphite * (1.0 - ink) * 0.8);
        col = mix(col, uInkCol, ink);

        // silhouette contour inks during the first quarter of band B
        float outline = pjRim(0.62);
        float drawO = step(pjHash(floor(q * 0.9)) * 0.25, prog);
        col = mix(col, mix(uGraphite, uInkCol, drawO), outline * 0.9);

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    uniforms: {
      uPaper: { value: new Color(SKETCH_PALETTE.paper) },
      uGraphite: { value: new Color(SKETCH_PALETTE.graphite) },
      uInkCol: { value: new Color(SKETCH_PALETTE.ink) },
      uFill: { value: new Color(SKETCH_PALETTE.wash) },
      uLightDir: { value: new Vector3(0.4, 0.9, 0.5).normalize() },
      uSweepDir: { value: new Vector3(1, 0.35, 0) },
      uSweepSpan: { value: new Vector2(-1.5, 1.5) },
      uInk: { value: 0 },
      uTime: { value: 0 },
      uHatchScale: { value: 6 },
    } satisfies Record<string, IUniform>,
  });
}

/**
 * Ink pawprint decal (the cat pads across the paper). Unlit, transparent,
 * procedural paw shape in mesh UV space -- put it on a small PlaneGeometry
 * laid flat a hair above the paper (scene's job: tiny y offset or
 * polygonOffset to dodge z-fighting; depthWrite is already off here).
 *
 * Reveal uses the same uInk/hash logic as the sketch strokes: clone() one
 * per print and set uSeed to the print's reveal threshold (walk order along
 * the cat's path, e.g. spread across uInk 0.2..0.5 so the cat crosses while
 * the sketch inks). The blot swells for 0.04 of uInk after landing --
 * pure f(uInk), scrub-deterministic.
 *
 * Uniforms the scene drives:
 * - uInk    (float 0..1) same master scrub the sketch materials get.
 * - uSeed   (float 0..1) this print appears when uInk >= uSeed.
 * - uInkCol (color) default ink #232019.
 */
export function pawprintMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    name: "pawprint",
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 p = vec4(position, 1.0);
        #ifdef USE_INSTANCING
          p = instanceMatrix * p;
        #endif
        gl_Position = projectionMatrix * modelViewMatrix * p;
      }
    `,
    fragmentShader:
      HASH +
      /* glsl */ `
      varying vec2 vUv;
      uniform vec3 uInkCol;
      uniform float uInk;
      uniform float uSeed;

      // normalized ellipse distance (1.0 at the rim)
      float pjPad(const in vec2 p, const in vec2 c, const in vec2 r) {
        return length((p - c) / r);
      }

      void main() {
        float on = step(uSeed, uInk);
        // fresh print swells slightly as the ink settles
        float spread = mix(0.82, 1.0, clamp((uInk - uSeed) / 0.04, 0.0, 1.0));

        float d = pjPad(vUv, vec2(0.5, 0.36), vec2(0.24, 0.19) * spread);
        d = min(d, pjPad(vUv, vec2(0.24, 0.62), vec2(0.09, 0.115) * spread));
        d = min(d, pjPad(vUv, vec2(0.415, 0.74), vec2(0.09, 0.12) * spread));
        d = min(d, pjPad(vUv, vec2(0.585, 0.74), vec2(0.09, 0.12) * spread));
        d = min(d, pjPad(vUv, vec2(0.76, 0.62), vec2(0.09, 0.115) * spread));
        // inky blot edge: hash raggedness, still ONE hard AA edge (S2.16)
        d += (pjHash(floor(vUv * 26.0)) - 0.5) * 0.22;
        float aa = fwidth(d) + 1e-3;
        float shape = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, d);
        // uneven ink take-up inside the pad, never below 0.82
        float body = 0.82 + 0.18 * pjHash(floor(vUv * 9.0));
        float alpha = shape * on * body;
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(uInkCol, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    uniforms: {
      uInkCol: { value: new Color(SKETCH_PALETTE.ink) },
      uInk: { value: 0 },
      uSeed: { value: 0 },
    } satisfies Record<string, IUniform>,
  });
}
