import { Effect, EffectAttribute } from "postprocessing";
import { Color, Matrix4, Uniform, Vector3, type Texture } from "three";

/**
 * The shared "print" pass (S2.6): color-window mask -> mono grade ->
 * registered single-screen halftone -> crosshatch shadow steps -> ink edge
 * (Sobel on normals+depth, one uniform line weight) -> paper+grain multiply
 * -> vignette -> impact flash. One effect, recipe-driven uniforms, zero
 * channel offsets (S2.16).
 *
 * Crosshatch (noir): screen-space, luminance-stepped -- one stroke
 * direction in shadow, the cross direction added deeper, bolder strokes in
 * the deepest step. Static in screen space (no boil jitter) so instanced
 * rain can move over it without shimmer.
 *
 * Dark-paper polarity (ruling 2026-07-02): halftone + hatch coverage is
 * driven by a tonal axis flipped when uPaper is dark (light ink on dark
 * paper) -- dark subjects stay paper-black silhouettes, ink lands on lit
 * forms and midtones. Derived in-shader from uPaper luminance; no recipe
 * field, so cross-fades between polarities stay smooth.
 *
 * Color window (S0 Phase 1 noir): ONE world-space rect exempt from mono +
 * hatch, reconstructed per pixel from the depth buffer via
 * uInvViewProjection -- costs zero render targets. Positioned at runtime
 * through shaders/colorWindow.ts.
 *
 * Spot rect (ruling 2026-07-03): a SECOND independent mono-exempt rect
 * (uSpot*) sharing the window's reconstruction -- scenes track the mascot
 * with it per-frame (shaders/colorWindow.ts spotRect/setSpotRect).
 * uSpotStrength < 1 keeps partial mono/hatch on the subject; halftone and
 * ink line stay full (S2.16 clean, single-layer color op).
 *
 * verified 2026-07 (postprocessing v6.39): uniforms must be a Map of
 * three.Uniform; mainImage signature with EffectAttribute.DEPTH gains a
 * depth param and readDepth(uv); resolution/texelSize are provided.
 */
const fragment = /* glsl */ `
  uniform sampler2D tNormal;
  uniform vec3 uPaper;
  uniform vec3 uEdgeColor;
  uniform float uMono;
  uniform float uEdge;
  uniform float uHalftone;
  uniform float uHalftoneScale;
  uniform float uGrain;
  uniform float uPaperTex;
  uniform float uVignette;
  uniform float uImpact;
  uniform vec2 uBoilJitter;
  uniform float uStepSeed;
  uniform float uHatch;
  uniform float uHatchScale;
  uniform float uWindow;
  uniform vec3 uWinCenter;
  uniform vec3 uWinU;
  uniform vec3 uWinV;
  uniform float uWinDepth;
  uniform float uSpotStrength;
  uniform vec3 uSpotCenter;
  uniform vec3 uSpotU;
  uniform vec3 uSpotV;
  uniform float uSpotDepth;
  uniform mat4 uInvViewProjection;

  float pjLuma(const in vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

  float pjHash(const in vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float pjEdge(const in vec2 uv, const in vec2 px) {
    vec3 n0 = texture2D(tNormal, uv).xyz;
    vec3 nx = texture2D(tNormal, uv + vec2(px.x, 0.0)).xyz;
    vec3 ny = texture2D(tNormal, uv + vec2(0.0, px.y)).xyz;
    vec3 nx2 = texture2D(tNormal, uv - vec2(px.x, 0.0)).xyz;
    vec3 ny2 = texture2D(tNormal, uv - vec2(0.0, px.y)).xyz;
    float dn = distance(n0, nx) + distance(n0, ny) + distance(n0, nx2) + distance(n0, ny2);

    float d0 = readDepth(uv);
    float dd = abs(readDepth(uv + vec2(px.x, 0.0)) - d0)
             + abs(readDepth(uv + vec2(0.0, px.y)) - d0)
             + abs(readDepth(uv - vec2(px.x, 0.0)) - d0)
             + abs(readDepth(uv - vec2(0.0, px.y)) - d0);

    float e = smoothstep(0.35, 0.9, dn) + smoothstep(0.02, 0.08, dd * 60.0);
    return clamp(e, 0.0, 1.0);
  }

  float pjHalftone(const in vec2 fragPx, const in float shade) {
    mat2 R = mat2(0.70710678, -0.70710678, 0.70710678, 0.70710678);
    vec2 p = (R * fragPx) / max(uHalftoneScale, 1.0);
    vec2 f = fract(p) - 0.5;
    float r = (1.0 - shade) * 0.75;
    float d = length(f);
    float aa = fwidth(d) + 1e-4;
    return 1.0 - smoothstep(r - aa, r + aa, d);
  }

  float pjHatchLine(const in float x, const in float w) {
    float aa = fwidth(x) * 0.75 + 1e-3;
    return 1.0 - smoothstep(w, w + aa, abs(fract(x) - 0.5));
  }

  // "shade" is the polarity-mapped tone: low = take ink, high = stay paper
  float pjHatch(const in vec2 fragPx, const in float shade) {
    float pitch = max(uHatchScale, 2.0);
    // two fixed stroke directions ~60deg apart, static in screen space
    float xa = (fragPx.x * 0.5 + fragPx.y * 0.866) / pitch;
    float xb = (fragPx.x * 0.866 - fragPx.y * 0.5) / pitch;
    float s1 = smoothstep(0.5, 0.34, shade);  // first step: direction A
    float s2 = smoothstep(0.3, 0.16, shade);  // deeper: direction B crosses A
    float s3 = smoothstep(0.14, 0.05, shade); // deepest: bolder strokes
    float w = 0.16 + s3 * 0.14;
    return clamp(pjHatchLine(xa, w) * s1 + pjHatchLine(xb, w) * s2, 0.0, 1.0);
  }

  // shared world-space rect mask: q = worldPos - rectCenter, U/V half-axes,
  // dTol = half-thickness along the rect normal (window + spot rect)
  float pjRectMask(const in vec3 q, const in vec3 U, const in vec3 V, const in float dTol) {
    float a = abs(dot(q, U)) / max(dot(U, U), 1e-5);
    float b = abs(dot(q, V)) / max(dot(V, V), 1e-5);
    float n = abs(dot(q, normalize(cross(U, V)))) / max(dTol, 1e-3);
    float edge = 1.0 - smoothstep(0.92, 1.0, max(a, b));
    return edge * (1.0 - step(1.0, n));
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
    vec3 col = inputColor.rgb;
    vec2 fragPx = uv * resolution;

    // 0 -- mono-exempt rects: the color window plus the per-frame SPOT RECT
    // (mascot tracker, ruling 2026-07-03). Both reconstruct world position
    // from the depth buffer -- zero RTs, one shared matrix multiply. With
    // both channels disabled the masks are exactly 0.0 and every mix below
    // reduces to the pre-spot math bit-for-bit.
    float win = 0.0;
    float spot = 0.0;
    if (uWindow > 0.001 || uSpotStrength > 0.001) {
      vec4 h = uInvViewProjection * vec4(vec3(uv, depth) * 2.0 - 1.0, 1.0);
      vec3 wp = h.xyz / max(h.w, 1e-6);
      win = pjRectMask(wp - uWinCenter, uWinU, uWinV, uWinDepth) * uWindow;
      spot = pjRectMask(wp - uSpotCenter, uSpotU, uSpotV, uSpotDepth) * uSpotStrength;
    }
    float ex = max(win, spot);

    // 1 -- mono grade
    col = mix(col, vec3(pjLuma(col)), uMono * (1.0 - ex));

    // pre-halftone luminance feeds both screens (avoids dot/hatch moire)
    float lum = pjLuma(col);

    // 1b -- dark-paper polarity: both screens assume dark ink on light
    // paper (darkness -> coverage). On a dark-paper recipe the ink is
    // LIGHT, so coverage must track brightness instead: light ink goes to
    // lit forms and midtone hatch, deep shadow stays paper-black
    // silhouette. Derived from uPaper luminance (linear space: dark papers
    // < 0.02, light papers > 0.7) so recipe cross-fades stay smooth.
    float flip = 1.0 - smoothstep(0.05, 0.25, pjLuma(uPaper));
    float shade = mix(lum, 1.0 - lum, flip);

    // 2 -- registered halftone: ink dots on paper, dot size from tone
    float dotMask = pjHalftone(fragPx, shade);
    col = mix(col, mix(uPaper, col * 0.88, dotMask), uHalftone);

    // 2b -- crosshatch shading in shadow steps (2 directions + cross)
    float hm = pjHatch(fragPx, shade) * uHatch * (1.0 - ex);
    col = mix(col, uEdgeColor, hm * 0.85);

    // 3 -- one uniform ink line for the whole frame, boiling at step rate.
    // Boil is POSITION-only: jittering the Sobel radius as well (the old
    // texelSize * (1.0 + uBoilJitter.x * 2.0)) rescaled dn/dd globally every
    // step, so any near-threshold region (grazing floors at wheel height)
    // flipped between fully inked and clean -- 30%-frame flicker at rest in
    // the Issue 7 whip gutter (gate check-4, measured 2026-07-03). A fixed
    // 1-texel radius is the old modulation's mean, so line weight is
    // unchanged; the sub-texel offset keeps the hand-drawn wobble.
    float e = pjEdge(uv + uBoilJitter * texelSize, texelSize);
    col = mix(col, uEdgeColor, e * uEdge);

    // 4 -- paper fiber + stepped grain, multiplicative (never a color fringe)
    float fiber = pjHash(floor(fragPx * 0.5) / 0.5 * 0.013);
    float speck = pjHash(fragPx * 0.31 + uStepSeed);
    col *= 1.0 - uPaperTex * (fiber * 0.35 + 0.1);
    col *= 1.0 + (speck - 0.5) * 2.0 * uGrain;

    // 5 -- vignette
    float v = smoothstep(0.95, 0.35, distance(uv, vec2(0.5)));
    col *= mix(1.0, v, uVignette);

    // 6 -- impact frame: full-frame invert pop (single layer, budget-guarded)
    col = mix(col, vec3(1.0) - col, uImpact);

    outputColor = vec4(col, inputColor.a);
  }
`;

export class PrintEffect extends Effect {
  constructor(normalTexture: Texture) {
    super("PrintEffect", fragment, {
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map<string, Uniform>([
        ["tNormal", new Uniform(normalTexture)],
        ["uPaper", new Uniform(new Color("#F2EAD9"))],
        ["uEdgeColor", new Uniform(new Color("#201D18"))],
        ["uMono", new Uniform(0)],
        ["uEdge", new Uniform(0.7)],
        ["uHalftone", new Uniform(0.4)],
        ["uHalftoneScale", new Uniform(6)],
        ["uGrain", new Uniform(0.06)],
        ["uPaperTex", new Uniform(0.1)],
        ["uVignette", new Uniform(0.25)],
        ["uImpact", new Uniform(0)],
        ["uBoilJitter", new Uniform({ x: 0, y: 0 })],
        ["uStepSeed", new Uniform(0)],
        ["uHatch", new Uniform(0)],
        ["uHatchScale", new Uniform(7)],
        ["uWindow", new Uniform(0)],
        ["uWinCenter", new Uniform(new Vector3())],
        ["uWinU", new Uniform(new Vector3(1, 0, 0))],
        ["uWinV", new Uniform(new Vector3(0, 1, 0))],
        ["uWinDepth", new Uniform(0.6)],
        ["uSpotStrength", new Uniform(0)],
        ["uSpotCenter", new Uniform(new Vector3())],
        ["uSpotU", new Uniform(new Vector3(1, 0, 0))],
        ["uSpotV", new Uniform(new Vector3(0, 1, 0))],
        ["uSpotDepth", new Uniform(0.6)],
        ["uInvViewProjection", new Uniform(new Matrix4())],
      ]),
    });
  }

  u<T>(name: string): { value: T } {
    return this.uniforms.get(name) as { value: T };
  }
}
