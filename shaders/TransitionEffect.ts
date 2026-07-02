import { Effect, EffectAttribute } from "postprocessing";
import { Color, Uniform, type Texture } from "three";

/**
 * S5 transition layer as a final fullscreen effect, driven by scrub-safe
 * local p from the gutter evaluator. Modes: 0 none, 1 whip (directional
 * smear along the whip axis + radial speed lines), 2 dot-zoom (outgoing
 * snapshot collapsing into a registered dot screen), 3 cut (paper-color
 * page blink), 4 crash-through (cover tears radially into paper fragments
 * over a settling zoom punch -- Cover -> Issue 1). Everything is a pure
 * function of uP: scrub-deterministic both directions. Velocity speed
 * lines (S2.9) ride the same lines function outside gutters.
 *
 * verified 2026-07 (postprocessing wiki Custom-Effects): sampling the
 * INPUT BUFFER at neighbor texels requires EffectAttribute.CONVOLUTION;
 * one convolution effect per EffectPass -- this is it (DECISIONS
 * 2026-07-02). inputBuffer holds the PRE-print linear frame, so smear /
 * punch taps are re-graded with uSmearMono (the cross-faded recipe mono)
 * to stay consistent with the printed frame they blend into. Canvas
 * snapshots are sRGB-encoded and NOT auto-decoded in custom shaders --
 * decode pow(rgb, 2.2) before linear-space mixing (project memory).
 *
 * S2.16: the smear is a single-layer box average (no channel offsets, no
 * ghosting) and only exists inside a whip gutter (whipK == 0 at rest);
 * the crash punch is a single-layer radial resample, zero chromatic ops.
 */
const fragment = /* glsl */ `
  uniform sampler2D uSnapshot;
  uniform float uHasSnapshot;
  uniform float uMode;
  uniform float uP;
  uniform float uVelocity;
  uniform vec3 uFallback;
  uniform vec2 uWhipDir;
  uniform float uSmearMono;

  float pjtLuma(const in vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

  float pjtHash(const in vec2 p) {
    return fract(sin(dot(p, vec2(269.5, 183.3))) * 43758.5453);
  }

  vec3 pjtGrade(const in vec3 c) {
    return mix(c, vec3(pjtLuma(c)), uSmearMono);
  }

  float pjtSpeedLines(const in vec2 uv, const in float k) {
    if (k <= 0.001) return 0.0;
    vec2 d = uv - 0.5;
    d.x *= aspect;
    float r = length(d);
    float ang = atan(d.y, d.x);
    float seg = floor(ang * 28.0);
    float h = pjtHash(vec2(seg, seg * 0.7));
    float len = 0.25 + h * 0.6;
    float line = step(1.0 - k * len, r + h * 0.2) * step(0.82, pjtHash(vec2(seg, 1.0)) + k * 0.5);
    return line * smoothstep(0.15, 0.5, r);
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 col = inputColor.rgb;
    float p = clamp(uP, 0.0, 1.0);

    // whip intensity peaks mid-gutter; velocity lines fade in on hard scroll
    float whipK = uMode == 1.0 ? sin(p * 3.14159) : 0.0;

    // directional smear along the whip axis (the pass's one CONVOLUTION
    // job): 8 dithered taps of the raw buffer, re-graded to the active
    // mono level. whipK gates it to gutter interiors only (S2.16).
    if (whipK > 0.004) {
      float spread = whipK * 0.12;
      float j = pjtHash(uv * 913.7) - 0.5;
      vec3 acc = vec3(0.0);
      for (int i = 0; i < 8; i++) {
        float s = (float(i) + j) / 7.0 - 0.5;
        acc += texture2D(inputBuffer, uv + uWhipDir * spread * s).rgb;
      }
      col = mix(col, pjtGrade(acc * 0.125), smoothstep(0.0, 0.35, whipK));
    }

    float velK = clamp((abs(uVelocity) - 0.35) * 1.2, 0.0, 0.6);
    float lines = pjtSpeedLines(uv, max(whipK, velK));
    col = mix(col, vec3(1.0), lines * 0.85);

    if (uMode == 2.0) {
      // dot-zoom: outgoing frame lives inside a dot screen that shrinks away
      mat2 R = mat2(0.70710678, -0.70710678, 0.70710678, 0.70710678);
      float scale = mix(90.0, 14.0, p);
      vec2 q = (R * (uv * resolution)) / scale;
      vec2 f = fract(q) - 0.5;
      float radial = 1.0 - distance(uv, vec2(0.5)) * 0.35;
      float r = pow(1.0 - p, 1.3) * 0.85 * radial;
      float d = length(f);
      float aa = fwidth(d) + 1e-4;
      float cover = 1.0 - smoothstep(r - aa, r + aa, d);
      vec3 snap = uHasSnapshot > 0.5
        ? pow(texture2D(uSnapshot, uv).rgb, vec3(2.2))
        : uFallback;
      col = mix(col, snap, cover);
    } else if (uMode == 3.0) {
      // cut: quick paper-tone page blink centered on the pose jump
      float q = 1.0 - abs(2.0 * p - 1.0);
      col = mix(col, uFallback, smoothstep(0.62, 0.95, q));
    } else if (uMode == 4.0) {
      // crash-through: the live incoming frame takes a settling zoom punch
      // while the printed cover bursts center-out into paper fragments.
      float punch = smoothstep(0.12, 0.5, p) * (1.0 - smoothstep(0.5, 0.92, p));
      vec2 zuv = 0.5 + (uv - 0.5) / (1.0 + punch * 0.35);
      vec3 live = pjtGrade(texture2D(inputBuffer, zuv).rgb);
      col = mix(col, live, clamp(punch * 2.5, 0.0, 1.0));

      // polar fragment grid: each cell departs when p passes its threshold
      // (radius + hash), so the tear opens at the center and races outward
      vec2 d = uv - 0.5;
      d.x *= aspect;
      float r = length(d);
      vec2 cell = vec2((atan(d.y, d.x) * 0.15915494 + 0.5) * 18.0, r * 6.0);
      float h = pjtHash(floor(cell));
      float tearP = clamp(p * 1.43, 0.0, 1.0);
      float f = clamp((tearP - (r * 0.5 + h * 0.4)) * 3.5, 0.0, 1.0);
      if (f < 1.0) {
        // departing fragments scale outward and drift tangentially,
        // carrying their patch of the printed cover with them
        vec2 snapUv = 0.5 + (uv - 0.5) / (1.0 + f * (0.6 + h * 0.8));
        snapUv += vec2(-d.y, d.x) * (h - 0.5) * f * 0.3;
        vec3 snap = uHasSnapshot > 0.5
          ? pow(texture2D(uSnapshot, snapUv).rgb, vec3(2.2))
          : uFallback;
        // torn paper edge in the cover's page color along fragment borders
        vec2 e2 = min(fract(cell), 1.0 - fract(cell));
        float torn = smoothstep(0.10, 0.02, min(e2.x, e2.y)) * step(0.001, f);
        snap = mix(snap, uFallback, torn * 0.9);
        col = mix(col, snap, 1.0 - smoothstep(0.85, 1.0, f));
      }
    }

    outputColor = vec4(col, inputColor.a);
  }
`;

const MODE = { none: 0, whip: 1, "dot-zoom": 2, cut: 3, "crash-through": 4 } as const;
export type EffectModeName = keyof typeof MODE;

export class TransitionEffect extends Effect {
  constructor() {
    super("TransitionEffect", fragment, {
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, Uniform>([
        ["uSnapshot", new Uniform<Texture | null>(null)],
        ["uHasSnapshot", new Uniform(0)],
        ["uMode", new Uniform(0)],
        ["uP", new Uniform(0)],
        ["uVelocity", new Uniform(0)],
        ["uFallback", new Uniform(new Color("#F2EAD9"))],
        ["uWhipDir", new Uniform({ x: 1, y: 0 })],
        ["uSmearMono", new Uniform(0)],
      ]),
    });
  }

  setMode(name: EffectModeName) {
    (this.uniforms.get("uMode") as { value: number }).value = MODE[name];
  }

  u<T>(name: string): { value: T } {
    return this.uniforms.get(name) as { value: T };
  }
}
