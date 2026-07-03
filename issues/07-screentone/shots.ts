import gsap from "gsap";
import { clamp01, easeInOut, easeOutCubic, type Shot } from "@/lib/shots";
import { printRecipe } from "@/lib/recipes";
import { registerJawDrop } from "@/lib/beats";
import { issueCenter, RANGES } from "../timeline";

/**
 * Issue 7 SCREENTONE -- authored shots (S0.8 table in ./shots.md).
 * One subway line west to east: platform establish -> through-window
 * tracking -> map insert beat -> low wheel-level run -> edge-run finale.
 * All intra-issue gutters are whips (speed-line grammar); the exit
 * page-flip is the registry gutter's job (native mode 7, showcase 0.015).
 */

const [S, E] = RANGES[7]!;
const W = E - S;
const at = (f: number) => S + f * W;
const [CX] = issueCenter(7);

/**
 * Issue 7's full look (S0.4 row 7): manga B&W screentone, fine dots, bright
 * ink edges. Extends the Phase 0 RECIPES[7] row but with mono 0: the world
 * is AUTHORED grayscale, so the spot yellow (train stripe, map line, station
 * marks) survives the post chain. Dark-paper dot polarity flips in-shader
 * (Phase 1 ruling) -- no recipe field needed.
 */
export const SCREENTONE_RECIPE = printRecipe({
  paper: "#101014",
  ink: "#E8E8E8",
  mono: 0,
  edge: 0.9,
  edgeColor: "#E8E8E8",
  halftone: 0.65,
  halftoneScale: 4.5,
  vignette: 0.35,
  boil: 0.45,
});

// ---- the line (set-local x; Screentone.tsx builds the world around these) --
/** 8 stations, index-aligned with content.timeline + stationCaptions. */
export const STATION_X: number[] = Array.from({ length: 8 }, (_, i) => -84 + i * 24);
/** half train length (2 cars); nose = trainX + TRAIN_HALF */
export const TRAIN_HALF = 7.65;

// ---- train motion profile (pure f(t), scrub-safe) --------------------------
// Dwell plateaus at stations, smoothstep runs between; easeOutCubic arrival
// into S0, cubic-in LAUNCH off the east page edge at issue end. S3 and S5
// pass at speed by design (they read on the map insert).
interface Knot {
  f: number;
  x: number;
  /** ease of the segment ENDING at this knot (default smoothstep) */
  ease?: (e: number) => number;
}

const smooth = (e: number) => e * e * (3 - 2 * e);

const KNOTS: Knot[] = [
  { f: 0.0, x: STATION_X[0]! - 52 }, // beyond the west page edge
  { f: 0.055, x: STATION_X[0]! - 52 }, // hold: empty-platform read (cat + spread)
  { f: 0.13, x: STATION_X[0]!, ease: easeOutCubic },
  { f: 0.165, x: STATION_X[0]! }, // dwell: Started Programming (shot 1)
  { f: 0.26, x: STATION_X[1]! },
  { f: 0.3, x: STATION_X[1]! }, // dwell: University (shot 2)
  { f: 0.42, x: STATION_X[2]! },
  { f: 0.465, x: STATION_X[2]! }, // dwell: First Job (shots 2-3)
  { f: 0.6, x: STATION_X[4]! }, // run past S3 (reads on the map)
  { f: 0.645, x: STATION_X[4]! }, // dwell: Senior Frontend Engineer
  { f: 0.8, x: STATION_X[6]! }, // run past S5 (reads on the map)
  { f: 0.845, x: STATION_X[6]! }, // dwell: AI Job Hunter
  { f: 0.915, x: STATION_X[7]! },
  { f: 0.945, x: STATION_X[7]! }, // last stop: Streaming
  { f: 1.0, x: STATION_X[7]! + 56, ease: (e) => e * e * e }, // THE EDGE RUN
];

function xAtU(u: number): number {
  for (let i = 1; i < KNOTS.length; i++) {
    const a = KNOTS[i - 1]!;
    const b = KNOTS[i]!;
    if (u <= b.f || i === KNOTS.length - 1) {
      if (a.x === b.x) return a.x;
      const e = clamp01((u - a.f) / (b.f - a.f));
      return a.x + (b.x - a.x) * (b.ease ?? smooth)(e);
    }
  }
  return KNOTS[KNOTS.length - 1]!.x;
}

/** set-local train center x for any t -- scrub-safe both directions. */
export const trainX = (t: number) => xAtU(clamp01((t - S) / W));

/**
 * Reduced-motion display position: piecewise STILL -- parked at the station
 * nearest trainX(t), so the train is never seen moving (ruling in shots.md).
 */
export function trainDisplayX(t: number, reduced: boolean): number {
  const x = trainX(t);
  if (!reduced) return x;
  let best = STATION_X[0]!;
  for (const s of STATION_X) if (Math.abs(s - x) < Math.abs(best - x)) best = s;
  return best;
}

// numeric derivative of the profile, normalized to run cruise speed
// (48 units over 0.135 fraction * smoothstep peak 1.5 ~= 533 x/u); the
// arrival/launch spikes saturate at 1. Deterministic pure f(t).
const DU = 5e-4;
const SPEED_REF = 480;

/** 0..1 train speed for any t; drives speed-line length + visibility. */
export function trainSpeed(t: number): number {
  const u = clamp01((t - S) / W);
  const a = xAtU(Math.max(u - DU, 0));
  const b = xAtU(Math.min(u + DU, 1));
  return clamp01(Math.abs(b - a) / (2 * DU * SPEED_REF));
}

// ---- shot windows (fractions of the issue range; table in ./shots.md) ------
const F: [number, number][] = [
  [0.0, 0.16], // 1 platform establish (low)
  [0.19, 0.42], // 2 through-window tracking
  [0.45, 0.63], // 3 map insert beat
  [0.66, 0.82], // 4 low wheel-level run
  [0.85, 1.0], // 5 edge-run finale
];

// ---- the jaw-drop: the edge run --------------------------------------------
/** shot 5 p~0.63: the train launches at the east page border. */
export const EDGE_RUN_T = at(0.945);
/** authored-time squash-stretch channel read by Screentone.tsx (0 idle). */
export const TRAIN_LURCH = { v: 0 };

/**
 * Edge-run word scroll window (standing rule 2026-07-03, Pop DONATION_WINDOW
 * pattern): SWISH visibility is a pure f(t) opacity window with 0.30 edge
 * fades -- scrub-safe both directions, deep jumps land it resting at scale
 * exactly 1. The beat contributes only the TRAIN_LURCH slam + its budgeted
 * flash; reduced motion = window only. Screentone sits outside the
 * ScrollProxy slow window -- plain notch math (~0.0043 t/notch):
 * [at(0.82), at(1.0)] = ~3.3 notches total, ~1.3-notch plateau (the finale
 * is short and the end is pinned to the issue range, so the word is fully
 * gone at E = 0.656 -- BEFORE the page-flip gutter [0.656, 0.671] carries
 * the world away). EDGE_RUN_T lands at window p ~ 0.69, inside the plateau,
 * so the armed crossing slams a fully visible word.
 */
export const SWISH_WINDOW: [number, number] = [at(0.82), at(1.0)];

/** fade in/out over 30% each end (Pop donationOpacity pattern). */
export function swishOpacity(t: number): number {
  const p = (t - SWISH_WINDOW[0]) / (SWISH_WINDOW[1] - SWISH_WINDOW[0]);
  if (p <= 0 || p >= 1) return 0;
  return Math.min(1, p / 0.3, (1 - p) / 0.3);
}

let lurchTl: gsap.core.Timeline | null = null;

// S5b jaw-drop: the launch itself is pure f(t) (final KNOT segment); this
// beat adds only the authored-time lurch + one spot-yellow whip word. flash
// 0.6 through the central requestFlash budget -- a single impact frame on a
// dark paper world stays well clear of strobe (S2.16). BeatRunner owns
// hysteresis + reduced-motion skip.
registerJawDrop({
  id: "screentone-edge-run",
  t: EDGE_RUN_T,
  flash: 0.6,
  animate: () => {
    lurchTl?.kill();
    lurchTl = gsap
      .timeline()
      .set(TRAIN_LURCH, { v: 0 })
      .to(TRAIN_LURCH, { v: 1, duration: 0.1, ease: "power2.in" })
      .to(TRAIN_LURCH, { v: 0, duration: 0.45, ease: "power2.out" });
    // word visibility lives in swishOpacity(t) (standing rule 2026-07-03)
  },
});

export const SCREENTONE_SHOTS: Shot[] = [
  {
    // platform establish: wheel-height dutch at S0; cat on the bench past the
    // nose mark; the train arrives frame-left at p~0.6 and stops
    id: "tone-platform",
    issue: 7,
    range: [at(F[0]![0]), at(F[0]![1])],
    kind: "hold",
    from: { position: [CX - 93, 0.9, 8.5], target: [CX - 81, 2.4, -3], roll: -0.045, fov: 56 },
    to: { position: [CX - 89, 1.15, 7.6], target: [CX - 81, 2.3, -3], roll: -0.02, fov: 56 },
    ease: easeInOut,
  },
  {
    // through-window tracking: eastward pace at window height; dwells at S1,
    // arrival at S2; spreads read over the roof, windows sweep the lower third
    id: "tone-window",
    issue: 7,
    range: [at(F[1]![0]), at(F[1]![1])],
    kind: "dolly",
    from: { position: [CX - 76, 3.1, 4.6], target: [CX - 73.5, 3.3, -5.5], roll: 0.015, fov: 42 },
    to: { position: [CX - 33, 3.2, 4.6], target: [CX - 30.5, 3.3, -5.5], roll: -0.01, fov: 42 },
    ease: easeInOut,
  },
  {
    // map insert beat: hold on the floating inset panel; the S2->S4 run
    // blasts through the bottom frame under it
    id: "tone-map",
    issue: 7,
    range: [at(F[2]![0]), at(F[2]![1])],
    kind: "hold",
    from: { position: [CX - 14, 4.0, 6.8], target: [CX - 8.5, 6.0, -6.3], roll: 0.02, fov: 37 },
    to: { position: [CX - 10, 4.5, 6.4], target: [CX - 8, 6.2, -6.3], roll: 0, fov: 37 },
    ease: easeInOut,
  },
  {
    // low wheel-level: rail-height heavy dutch; the S4->S6 run hammers past
    id: "tone-wheels",
    issue: 7,
    range: [at(F[3]![0]), at(F[3]![1])],
    kind: "dolly",
    from: { position: [CX + 38, 0.5, 3.4], target: [CX + 47, 1.0, -0.6], roll: 0.055, fov: 66 },
    to: { position: [CX + 50, 0.55, 3.0], target: [CX + 60, 0.9, -0.6], roll: 0.025, fov: 66 },
    ease: easeInOut,
  },
  {
    // edge-run finale: looking east; last-stop micro-dwell, then the LAUNCH
    // at the border line; push + widen after it, page-flip takes the gutter
    id: "tone-edge",
    issue: 7,
    range: [at(F[4]![0]), at(F[4]![1])],
    kind: "crash",
    from: { position: [CX + 58, 2.2, 7.2], target: [CX + 84, 1.9, -0.5], roll: -0.02, fov: 46 },
    to: { position: [CX + 72, 1.6, 4.6], target: [CX + 118, 1.5, 0], roll: 0.035, fov: 62 },
    ease: easeInOut,
  },
];
