import { Effect, EffectAttribute } from "postprocessing";
import { Color, Uniform, type Texture } from "three";

/**
 * The shared "print" pass (S2.6): mono grade -> ink edge (Sobel on
 * normals+depth, one uniform line weight) -> registered single-screen
 * halftone -> paper+grain multiply -> vignette -> impact flash. One effect,
 * recipe-driven uniforms, zero channel offsets (S2.16).
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

  float pjHalftone(const in vec2 fragPx, const in float lum) {
    mat2 R = mat2(0.70710678, -0.70710678, 0.70710678, 0.70710678);
    vec2 p = (R * fragPx) / max(uHalftoneScale, 1.0);
    vec2 f = fract(p) - 0.5;
    float r = (1.0 - lum) * 0.75;
    float d = length(f);
    float aa = fwidth(d) + 1e-4;
    return 1.0 - smoothstep(r - aa, r + aa, d);
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
    vec3 col = inputColor.rgb;
    vec2 fragPx = uv * resolution;

    // 1 -- mono grade
    col = mix(col, vec3(pjLuma(col)), uMono);

    // 2 -- registered halftone: ink dots on paper, dot size from luminance
    float dotMask = pjHalftone(fragPx, pjLuma(col));
    col = mix(col, mix(uPaper, col * 0.88, dotMask), uHalftone);

    // 3 -- one uniform ink line for the whole frame, boiling at step rate
    float e = pjEdge(uv + uBoilJitter * texelSize, texelSize * (1.0 + uBoilJitter.x * 2.0));
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
      ]),
    });
  }

  u<T>(name: string): { value: T } {
    return this.uniforms.get(name) as { value: T };
  }
}
