import { Effect, EffectAttribute } from "postprocessing";
import { Color, Uniform, type Texture } from "three";

/**
 * S5 transition layer as a final fullscreen effect, driven by scrub-safe
 * local p from the gutter evaluator. Modes: 0 none, 1 whip (directional
 * smear + radial speed lines), 2 dot-zoom (outgoing snapshot collapsing
 * into a registered dot screen), 3 cut (paper-color page blink),
 * 4 crash-through (cover tears radially into paper fragments over a
 * settling zoom punch), 5 panel-wipe (paper gutter bars sweep in, the
 * incoming shot grows from a bordered panel to full bleed), 6 paper-tear
 * (fibered rip left to right), 7 page-flip (whole-viewport cylindrical
 * page curl, paper backside, incoming underneath), 8 stamp (incoming
 * slams down: scale-squash, paper-tone impact pop, radial burst, pressed
 * shadow ring), 9 dot-match (pose-matched iris: incoming inside one
 * growing inked dot), 10 ink-flood (ink swallows the page at mid-gutter,
 * hiding the camera cut, then drains). Everything is a pure function of
 * uP: scrub-deterministic both directions.
 *
 * verified 2026-07 (postprocessing wiki Custom-Effects): sampling the
 * INPUT BUFFER at neighbor texels requires EffectAttribute.CONVOLUTION;
 * one convolution effect per EffectPass -- this is it (DECISIONS
 * 2026-07-02). inputBuffer holds the PRE-print linear frame, so smear /
 * punch / stamp taps are re-graded with pjtPrint (mono + the registered
 * halftone screen + paper tint from the cross-faded recipe: uSmearMono /
 * uSmearHalftone / uSmearScale / uSmearPaper) so displaced live samples
 * match the printed frame they settle into (PR #22 ruling 3). Canvas
 * snapshots are sRGB-encoded and NOT auto-decoded in custom shaders --
 * decode pow(rgb, 2.2) before linear-space mixing (project memory).
 *
 * S2.16: every mode is a single-layer color op -- no channel offsets, no
 * ghosting; page-flip's backside is flat paper (no mirrored content);
 * stamp's impact frame is one paper-tone pop, same class as cut's blink.
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
  uniform float uSmearHalftone;
  uniform float uSmearScale;
  uniform vec3 uSmearPaper;

  float pjtLuma(const in vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

  float pjtHash(const in vec2 p) {
    return fract(sin(dot(p, vec2(269.5, 183.3))) * 43758.5453);
  }

  float pjtNoise(const in vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(pjtHash(i), pjtHash(i + vec2(1.0, 0.0)), u.x),
      mix(pjtHash(i + vec2(0.0, 1.0)), pjtHash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  vec3 pjtGrade(const in vec3 c) {
    return mix(c, vec3(pjtLuma(c)), uSmearMono);
  }

  // approximate print grade for displaced inputBuffer taps: mono + the
  // same 45deg screen-registered dot screen as PrintEffect (dots anchored
  // to SCREEN uv so they never swim with the resample), dark-paper
  // polarity derived from paper luminance exactly like the print pass.
  vec3 pjtPrint(const in vec3 c, const in vec2 screenUv) {
    vec3 g = pjtGrade(c);
    if (uSmearHalftone < 0.005) return g;
    float lum = pjtLuma(g);
    float flip = 1.0 - smoothstep(0.05, 0.25, pjtLuma(uSmearPaper));
    float shade = mix(lum, 1.0 - lum, flip);
    mat2 R = mat2(0.70710678, -0.70710678, 0.70710678, 0.70710678);
    vec2 q = (R * (screenUv * resolution)) / max(uSmearScale, 1.0);
    vec2 f = fract(q) - 0.5;
    float r = (1.0 - shade) * 0.75;
    float d = length(f);
    float aa = fwidth(d) + 1e-4;
    float dotMask = 1.0 - smoothstep(r - aa, r + aa, d);
    return mix(g, mix(uSmearPaper, g * 0.88, dotMask), uSmearHalftone);
  }

  // outgoing snapshot (sRGB canvas copy -> linear), flat paper fallback
  vec3 pjtSnap(const in vec2 suv) {
    return uHasSnapshot > 0.5
      ? pow(texture2D(uSnapshot, clamp(suv, 0.001, 0.999)).rgb, vec3(2.2))
      : uFallback;
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
      col = mix(col, pjtSnap(uv), cover);
    } else if (uMode == 3.0) {
      // cut: quick paper-tone page blink centered on the pose jump
      float q = 1.0 - abs(2.0 * p - 1.0);
      col = mix(col, uFallback, smoothstep(0.62, 0.95, q));
    } else if (uMode == 4.0) {
      // crash-through: the live incoming frame takes a settling zoom punch
      // while the printed cover bursts center-out into paper fragments.
      float punch = smoothstep(0.12, 0.5, p) * (1.0 - smoothstep(0.5, 0.92, p));
      vec2 zuv = 0.5 + (uv - 0.5) / (1.0 + punch * 0.35);
      // pjtPrint re-grades the pre-print tap so the punch frames match the
      // printed frame they settle into (PR #22 ruling 3 polish, zero RTs)
      vec3 live = pjtPrint(texture2D(inputBuffer, zuv).rgb, uv);
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
        vec3 snap = pjtSnap(snapUv);
        // torn paper edge in the cover's page color along fragment borders
        vec2 e2 = min(fract(cell), 1.0 - fract(cell));
        float torn = smoothstep(0.10, 0.02, min(e2.x, e2.y)) * step(0.001, f);
        snap = mix(snap, uFallback, torn * 0.9);
        col = mix(col, snap, 1.0 - smoothstep(0.85, 1.0, f));
      }
    } else if (uMode == 5.0) {
      // panel-wipe: paper gutter bars sweep in over the outgoing page,
      // then the incoming shot enters as an ink-bordered panel that grows
      // to full bleed (S5).
      vec3 page = pjtSnap(uv);
      float ebar = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
      float barW = smoothstep(0.0, 0.4, p) * 0.055;
      float aaE = fwidth(ebar) + 1e-4;
      vec3 gutter = mix(uFallback, vec3(1.0), 0.25);
      page = mix(page, gutter, 1.0 - smoothstep(barW - aaE, barW + aaE, ebar));
      float g = smoothstep(0.12, 0.95, p);
      vec2 dr = abs(uv - 0.5) - vec2(0.52) * g;
      float rd = max(dr.x, dr.y);
      float aaR = fwidth(rd) + 1e-4;
      float inside = 1.0 - smoothstep(-aaR, aaR, rd);
      col = mix(page, col, inside);
      float rim = 1.0 - smoothstep(0.005, 0.005 + aaR * 2.0, abs(rd));
      rim *= step(0.001, g) * (1.0 - smoothstep(0.8, 0.95, p));
      col = mix(col, vec3(0.10, 0.09, 0.08), rim);
    } else if (uMode == 6.0) {
      // paper-tear: the outgoing page rips left to right with a fibered
      // white edge, dragged slightly as it goes; the incoming page sits
      // underneath with a soft shadow along the tear.
      float front = mix(-0.3, 1.3, p);
      float jag = (pjtNoise(vec2(uv.y * 9.0, 2.0)) - 0.5) * 0.14
                + (pjtNoise(vec2(uv.y * 51.0, 7.0)) - 0.5) * 0.04;
      float dd = uv.x + (uv.y - 0.5) * 0.12 + jag - front;
      if (dd > 0.0) {
        vec3 page = pjtSnap(uv - vec2(0.05, 0.012) * p);
        float fiberN = pjtHash(uv * vec2(240.0, 900.0));
        float band = 1.0 - smoothstep(0.0, 0.014 + fiberN * 0.02, dd);
        col = mix(page, mix(uFallback, vec3(1.0), 0.55), band);
      } else {
        col *= 1.0 - (1.0 - smoothstep(0.0, 0.06, -dd)) * 0.22;
      }
    } else if (uMode == 7.0) {
      // page-flip: whole-viewport cylindrical curl (radius R), turning
      // right-to-left like a comic page; flat paper backside (S2.16: no
      // mirrored ghost), incoming issue underneath. Inverse-mapped per
      // pixel: pure curl geometry of p, single layer.
      float R = 0.14;
      float sweep = p * p * (3.0 - 2.0 * p);
      float c = mix(1.0 + R, -0.36 - R * 3.14159, sweep);
      float d = uv.x - c;
      vec3 back = mix(uFallback, vec3(1.0), 0.4);
      back *= 1.0 - pjtHash(vec2(floor(uv.y * 160.0), 5.0)) * 0.05;
      if (d < 0.0) {
        // paper coord of the turned-over tail lying face-down on top
        float s3 = 2.0 * c + 3.14159 * R - uv.x;
        if (s3 <= 1.0) {
          col = back * (0.88 + 0.12 * smoothstep(0.0, 0.4, -d));
          col *= 1.0 - (1.0 - smoothstep(0.0, 0.012, 1.0 - s3)) * 0.3;
        } else {
          col = pjtSnap(uv);
          col *= 1.0 - (1.0 - smoothstep(0.0, 0.2, -d)) * 0.15;
        }
      } else {
        // revealed incoming page, shadowed under the roll
        col *= 1.0 - (1.0 - smoothstep(0.0, 0.24, d - R)) * 0.28;
        if (d < R) {
          float theta = asin(clamp(d / R, 0.0, 1.0));
          float s1 = c + R * theta;                // front face rising
          float s2 = c + R * (3.14159 - theta);    // backside over the top
          if (s2 <= 1.0) {
            col = back * (0.72 + 0.28 * sin(theta));
            col *= 1.0 - (1.0 - smoothstep(0.0, 0.012, 1.0 - s2)) * 0.3;
          } else if (s1 <= 1.0) {
            col = pjtSnap(vec2(s1, uv.y)) * (1.0 - 0.38 * sin(theta));
          }
        }
      }
    } else if (uMode == 8.0) {
      // stamp: the incoming shot slams down like a rubber stamp --
      // scale-squash descent over the outgoing page, one paper-tone impact
      // pop, radial burst, pressed-paper shadow ring (S5, S2.16-safe).
      float drop = smoothstep(0.12, 0.55, p);
      float squash = smoothstep(0.55, 0.60, p) * (1.0 - smoothstep(0.60, 0.78, p));
      float mx = mix(1.8, 1.0, drop) * (1.0 + squash * 0.05);
      float my = mix(1.8, 1.0, drop) * (1.0 - squash * 0.07);
      vec3 face = pjtPrint(texture2D(inputBuffer, 0.5 + (uv - 0.5) / vec2(mx, my)).rgb, uv);
      vec3 page = pjtSnap(uv);
      page *= 1.0 - drop * 0.35 * smoothstep(0.9, 0.2, distance(uv, vec2(0.5)));
      // hand the magnified pre-print face back to the true printed frame
      // as the scale settles to 1 (same trick as the crash punch)
      float disp = clamp((abs(mx - 1.0) + abs(my - 1.0)) * 14.0, 0.0, 1.0);
      float appear = smoothstep(0.15, 0.40, p);
      col = mix(page, mix(col, face, disp), appear);
      float hit = smoothstep(0.53, 0.57, p) * (1.0 - smoothstep(0.60, 0.70, p));
      col = mix(col, uFallback, hit * 0.55);
      col = mix(col, vec3(1.0), pjtSpeedLines(uv, hit * 0.9) * 0.85);
      float ed = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
      float ring = smoothstep(0.02, 0.05, ed) - smoothstep(0.05, 0.12, ed);
      col *= 1.0 - ring * smoothstep(0.55, 0.62, p) * (1.0 - smoothstep(0.72, 1.0, p)) * 0.22;
    } else if (uMode == 9.0) {
      // dot-match (S5 match-cut): pose-matched iris -- the incoming shot
      // lives inside one inked dot growing from the matched circular focal
      // point to full bleed. Shot authoring centers a circle on both sides.
      vec2 d = uv - 0.5;
      d.x *= aspect;
      float rad = length(d);
      float rEnd = length(vec2(0.5 * aspect, 0.5)) + 0.03;
      float r = rEnd * p * p * (3.0 - 2.0 * p);
      float aa = fwidth(rad) + 1e-4;
      float inside = 1.0 - smoothstep(r - aa, r + aa, rad);
      col = mix(pjtSnap(uv), col, inside);
      float rim = 1.0 - smoothstep(0.005, 0.005 + aa * 2.0, abs(rad - r));
      rim *= smoothstep(0.02, 0.08, p) * (1.0 - smoothstep(0.85, 0.97, p));
      col = mix(col, vec3(0.10, 0.09, 0.08), rim);
    } else if (uMode == 10.0) {
      // ink-flood: ink pours from the top and swallows the page around
      // mid-gutter (full cover hides the camera cut like cut's blink --
      // no snapshot needed), then drains to reveal the incoming issue.
      float q = 1.0 - abs(2.0 * p - 1.0);
      vec2 d = uv - vec2(0.5, 1.15);
      d.x *= aspect;
      float n = 1.0 + (pjtNoise(uv * 6.0) - 0.5) * 0.5 + (pjtNoise(uv * 21.0) - 0.5) * 0.16;
      float radn = length(d) * n;
      float front = smoothstep(0.0, 0.82, q) * (length(vec2(0.5 * aspect, 1.15)) * 1.38 + 0.08);
      float m = 1.0 - smoothstep(front - 0.05, front, radn);
      col = mix(col, vec3(0.07, 0.06, 0.05), m);
    }

    outputColor = vec4(col, inputColor.a);
  }
`;

const MODE = {
  none: 0,
  whip: 1,
  "dot-zoom": 2,
  cut: 3,
  "crash-through": 4,
  "panel-wipe": 5,
  "paper-tear": 6,
  "page-flip": 7,
  stamp: 8,
  "dot-match": 9,
  "ink-flood": 10,
} as const;
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
        ["uSmearHalftone", new Uniform(0.4)],
        ["uSmearScale", new Uniform(6)],
        ["uSmearPaper", new Uniform(new Color("#F2EAD9"))],
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
