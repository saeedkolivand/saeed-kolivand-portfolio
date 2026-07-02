import { Effect } from "postprocessing";
import { Color, Uniform, type Texture } from "three";

/**
 * S5 transition layer as a final fullscreen effect, driven by scrub-safe
 * local p from the gutter evaluator. Phase 0 modes: 0 none, 1 whip
 * (radial speed lines, no directional blur yet -- S2.16-safe), 2 dot-zoom
 * (outgoing snapshot collapsing into a registered dot screen), 3 cut
 * (paper-color page blink masking the pose jump). Velocity speed lines
 * (S2.9) ride the same lines function outside gutters.
 *
 * verified 2026-07 (three r185 + project memory): canvas snapshots are
 * sRGB-encoded and FramebufferTexture is NOT auto-decoded in custom
 * shaders -- decode with pow(rgb, 2.2) before linear-space mixing.
 */
const fragment = /* glsl */ `
  uniform sampler2D uSnapshot;
  uniform float uHasSnapshot;
  uniform float uMode;
  uniform float uP;
  uniform float uVelocity;
  uniform vec3 uFallback;

  float pjtHash(const in vec2 p) {
    return fract(sin(dot(p, vec2(269.5, 183.3))) * 43758.5453);
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

    // whip intensity: peaks mid-gutter; velocity lines fade in on hard scroll
    float whipK = uMode == 1.0 ? sin(clamp(uP, 0.0, 1.0) * 3.14159) : 0.0;
    float velK = clamp((abs(uVelocity) - 0.35) * 1.2, 0.0, 0.6);
    float lines = pjtSpeedLines(uv, max(whipK, velK));
    col = mix(col, vec3(1.0), lines * 0.85);

    if (uMode == 2.0) {
      // dot-zoom: outgoing frame lives inside a dot screen that shrinks away
      mat2 R = mat2(0.70710678, -0.70710678, 0.70710678, 0.70710678);
      float scale = mix(90.0, 14.0, uP);
      vec2 p = (R * (uv * resolution)) / scale;
      vec2 f = fract(p) - 0.5;
      float radial = 1.0 - distance(uv, vec2(0.5)) * 0.35;
      float r = pow(1.0 - uP, 1.3) * 0.85 * radial;
      float d = length(f);
      float aa = fwidth(d) + 1e-4;
      float cover = 1.0 - smoothstep(r - aa, r + aa, d);
      vec3 snap = uHasSnapshot > 0.5
        ? pow(texture2D(uSnapshot, uv).rgb, vec3(2.2))
        : uFallback;
      col = mix(col, snap, cover);
    } else if (uMode == 3.0) {
      // cut: quick paper-tone page blink centered on the pose jump
      float q = 1.0 - abs(2.0 * uP - 1.0);
      col = mix(col, uFallback, smoothstep(0.62, 0.95, q));
    }

    outputColor = vec4(col, inputColor.a);
  }
`;

const MODE = { none: 0, whip: 1, "dot-zoom": 2, cut: 3 } as const;
export type EffectModeName = keyof typeof MODE;

export class TransitionEffect extends Effect {
  constructor() {
    super("TransitionEffect", fragment, {
      uniforms: new Map<string, Uniform>([
        ["uSnapshot", new Uniform<Texture | null>(null)],
        ["uHasSnapshot", new Uniform(0)],
        ["uMode", new Uniform(0)],
        ["uP", new Uniform(0)],
        ["uVelocity", new Uniform(0)],
        ["uFallback", new Uniform(new Color("#F2EAD9"))],
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
