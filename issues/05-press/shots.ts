import gsap from "gsap";
import { clamp01, easeInOut, lerp, type Shot } from "@/lib/shots";
import { printRecipe } from "@/lib/recipes";
import { registerJawDrop } from "@/lib/beats";
import { requestFlash } from "@/lib/flashBudget";
import { snapshots } from "@/lib/snapshots";
import { sayWord } from "@/lib/onomatopoeia";
import { lettering } from "@/lib/content";
import { PRESS_PALETTE } from "@/shaders/pressMaterials";
import { issueCenter, RANGES } from "../timeline";

/**
 * Issue 5 THE PRESS -- authored shots (S0.8 table in ./shots.md).
 * One tracking line, frame-left to frame-right, following the single UI
 * button being manufactured: REACT establish -> TS trace -> RUST press ->
 * AI constellation -> stamp finale. Departments cut on intra-issue
 * PANEL-WIPES (Shot.out); the finale takes the default whip for contrast.
 */

const [S, E] = RANGES[5]!;
const W = E - S;
const at = (f: number) => S + f * W;
const [CX] = issueCenter(5);

/** Issue 5's full look -- dark factory, strong ink (S0.4 row 5), one printRecipe(). */
export const PRESS_RECIPE = printRecipe({
  paper: "#23272E",
  ink: "#E8E4DC",
  edgeColor: "#E8E4DC",
  edge: 0.85,
  halftone: 0.35,
  halftoneScale: 5,
});

// ---- factory layout (set-local x; Press.tsx builds the world around these) --
export const PRESS_BAY_X = [-19.5, -6.5, 6.5, 19.5] as const;
export const PRESS_STAMP_X = 27.5;
export const PRESS_BELT_TOP = 0.9;

// ---- shot windows (fractions of the issue range; table in ./shots.md) -------
const F: [number, number][] = [
  [0.0, 0.2], // 1 REACT establish
  [0.235, 0.42], // 2 TS tracking
  [0.455, 0.64], // 3 RUST tracking
  [0.675, 0.84], // 4 AI drift
  [0.865, 1.0], // 5 stamp finale
];

/**
 * The through-line button's belt position, pure f(t) (scrub-safe): tracks
 * bay i across shot i, sits at the next shot's start during gutters (their
 * panel-wipes film the incoming shot from p=0), parks under the stamp.
 */
const BUTTON_SPANS: [number, number][] = [
  [PRESS_BAY_X[0] - 4, PRESS_BAY_X[0] + 4],
  [PRESS_BAY_X[1] - 4, PRESS_BAY_X[1] + 4],
  [PRESS_BAY_X[2] - 4, PRESS_BAY_X[2] + 4],
  [PRESS_BAY_X[3] - 4, PRESS_BAY_X[3] + 4],
  [PRESS_BAY_X[3] + 4, PRESS_STAMP_X],
];

export function pressButtonX(t: number): number {
  for (let i = F.length - 1; i >= 0; i--) {
    const [fs, fe] = F[i]!;
    if (t < at(fs)) continue;
    const span = BUTTON_SPANS[i]!;
    // finale: arrive under the stamp by p=0.45, then hold for the slam
    const pEnd = i === F.length - 1 ? 0.45 : 1;
    const p = clamp01((t - at(fs)) / (at(fe) - at(fs)) / pEnd);
    return lerp(span[0], span[1], easeInOut(p));
  }
  return BUTTON_SPANS[0]![0];
}

/** Department part i attaches to the button once its shot is done (gutter entry). */
export const PRESS_PART_T: readonly number[] = [at(0.2), at(0.42), at(0.64), at(0.84)];

// ---- material drive ranges (all pure, monotonic f(t) per the contracts) -----
/** REACT uEnergy ramp across the establish. */
export const PRESS_ENERGY_RANGE: [number, number] = [at(0.0), at(0.08)];
/** TS uTrace draw-on as the camera crosses the blueprint bay (monotonic). */
export const PRESS_TRACE_RANGE: [number, number] = [at(0.235), at(0.365)];
/** AI uPulse wake-up as the constellation bay is crossed. */
export const PRESS_PULSE_RANGE: [number, number] = [at(0.675), at(0.775)];

// ---- beats (authored-time only; travel stays f(t)) ---------------------------
/** Shot 5 p=0.5: the stamp head slams (head travel itself is pure f(t)). */
export const PRESS_STAMP_T = at(0.865 + 0.5 * 0.135);
/** Shot 3 p=0.5: the RUST clank + spark envelope. */
export const PRESS_SPARK_T = at(0.455 + 0.5 * 0.185);

/** Authored-time channels read by Press.tsx / PressCta.tsx (0 when idle). */
export const PRESS_STAMP_POP = { v: 0 };
export const PRESS_SPARK = { v: 0 };
/** 1 = CTA held above the frame, 0 = rested in place (drop-in plays 1 -> 0). */
export const PRESS_CTA_DROP = { v: 0 };

/** DOM CTA presence, pure f(t): in just after the stamp, out across the exit gutter. */
export const PRESS_CTA_IN: [number, number] = [PRESS_STAMP_T + 0.0006, PRESS_STAMP_T + 0.004];
export const PRESS_CTA_OUT: [number, number] = [0.479, 0.487];
/** CTA scroll target: Issue 6 newsprint front-page story (S0.3 range [0.488, 0.566]). */
export const PRESS_PROJECTS_T = 0.51;

// Keep this issue's own snapshot fresh in every shot tail (PostPipeline
// captures retained issues): the intra-issue PANEL-WIPES between departments
// need the outgoing frame. Never released -- the Issue 10 spread quotes every
// issue anyway (snapshots are framebuffer copies, NOT live RTs -- S2.10).
snapshots.retain(5);

let stampTl: gsap.core.Timeline | null = null;

// S5b jaw-drop: the final stamp. flash: 1 plays the budgeted impact frame +
// sub-thump centrally (lib/beats.ts); animate drives the squash/radial burst
// and the CTA drop-in. BeatRunner owns hysteresis re-arm + reduced-motion
// skip; the stamped face + CTA presence stay pure f(t) so nothing is lost
// when the beat is skipped.
registerJawDrop({
  id: "press-stamp",
  t: PRESS_STAMP_T,
  flash: 1,
  animate: () => {
    stampTl?.kill();
    stampTl = gsap
      .timeline()
      .set(PRESS_STAMP_POP, { v: 0 })
      .set(PRESS_CTA_DROP, { v: 1 })
      .to(PRESS_STAMP_POP, { v: 1, duration: 0.09, ease: "power4.out" })
      .to(PRESS_STAMP_POP, { v: 0, duration: 0.55, ease: "power2.in" })
      .to(PRESS_CTA_DROP, { v: 0, duration: 0.6, ease: "bounce.out" }, 0.14);
    sayWord(lettering.onomatopoeia.impact, [CX + PRESS_STAMP_X, 4.2, 1.4], undefined, "#E8E4DC");
  },
});

let sparkTl: gsap.core.Timeline | null = null;

// Secondary beat: the RUST department clank. No impact frame; the uSpark
// envelope is still a flash by the material's contract, so it asks the
// central budget first (S2.13/S2.16). Beat hysteresis keeps it under 3Hz.
registerJawDrop({
  id: "press-clank",
  t: PRESS_SPARK_T,
  animate: () => {
    if (!requestFlash()) return;
    sparkTl?.kill();
    sparkTl = gsap
      .timeline()
      .set(PRESS_SPARK, { v: 0 })
      .to(PRESS_SPARK, { v: 1, duration: 0.05, ease: "none" })
      .to(PRESS_SPARK, { v: 0, duration: 0.35, ease: "power2.out" });
    sayWord(
      lettering.onomatopoeia.impact,
      [CX + PRESS_BAY_X[2], 4.6, 1.2],
      undefined,
      PRESS_PALETTE.rust,
    );
  },
});

export const PRESS_SHOTS: Shot[] = [
  {
    // establish: wide 3/4 down the line, REACT energy arch over the belt
    id: "press-react",
    issue: 5,
    range: [at(F[0]![0]), at(F[0]![1])],
    kind: "hold",
    from: { position: [CX - 27.5, 3.4, 12.5], target: [CX - 20.5, 2.0, -1], roll: -0.025, fov: 55 },
    to: { position: [CX - 20.5, 2.6, 10.2], target: [CX - 15.5, 1.8, -0.5], roll: 0.01, fov: 55 },
    ease: easeInOut,
    out: "panel-wipe",
  },
  {
    // TS tracking: truck right pacing the button past the blueprint wall
    id: "press-ts",
    issue: 5,
    range: [at(F[1]![0]), at(F[1]![1])],
    kind: "dolly",
    from: { position: [CX - 12.2, 2.6, 8.6], target: [CX - 10.5, 2.1, -0.6], roll: 0.02, fov: 46 },
    to: { position: [CX - 4.2, 2.3, 8.2], target: [CX - 2.5, 2.0, -0.6], roll: -0.012, fov: 46 },
    ease: easeInOut,
    out: "panel-wipe",
  },
  {
    // RUST low tracking: heavy press flanks the belt, piston on 2s
    id: "press-rust",
    issue: 5,
    range: [at(F[2]![0]), at(F[2]![1])],
    kind: "dolly",
    from: { position: [CX + 0.8, 1.4, 7.2], target: [CX + 2.5, 2.0, -0.4], roll: -0.035, fov: 50 },
    to: { position: [CX + 8.8, 1.6, 6.8], target: [CX + 10.5, 1.9, -0.4], roll: 0.025, fov: 50 },
    ease: easeInOut,
    out: "panel-wipe",
  },
  {
    // AI drift, slightly high: krackle wall + node cells wake as we pass
    id: "press-ai",
    issue: 5,
    range: [at(F[3]![0]), at(F[3]![1])],
    kind: "dolly",
    from: { position: [CX + 13.2, 3.6, 9.2], target: [CX + 15.5, 2.3, -1.2], roll: 0.02, fov: 40 },
    to: { position: [CX + 21.2, 2.7, 8.2], target: [CX + 23.5, 2.1, -1.2], roll: -0.015, fov: 40 },
    ease: easeInOut,
    // default whip out: pace shift into the stamp finale
  },
  {
    // stamp finale: low push-in looking back down the line; slam at p=0.5
    id: "press-stamp",
    issue: 5,
    range: [at(F[4]![0]), at(F[4]![1])],
    kind: "dolly",
    from: { position: [CX + 34.8, 2.2, 9.8], target: [CX + 27.5, 2.4, 0], roll: -0.02, fov: 34 },
    to: { position: [CX + 32.6, 1.9, 8.0], target: [CX + 27.5, 2.0, 0], roll: 0, fov: 34 },
    ease: easeInOut,
  },
];
