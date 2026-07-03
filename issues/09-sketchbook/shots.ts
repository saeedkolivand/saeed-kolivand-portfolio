import gsap from "gsap";
import { clamp01, easeInOut, type Pose, type Shot } from "@/lib/shots";
import { printRecipe } from "@/lib/recipes";
import { registerJawDrop } from "@/lib/beats";
import { issueCenter, RANGES } from "../timeline";

/**
 * Issue 9 SKETCHBOOK -- authored shots (S0.8 table in ./shots.md).
 * One page, one continuous breath: overhead establish descending west ->
 * low track east along the chain as the sketch inks itself -> pull back
 * for the flood finale. Both intra-issue gutters are DRIFT (quiet-valley
 * grammar): the shared Pose constants below make each shot's end pose the
 * next shot's from pose, so the camera never cuts inside the issue. The
 * exit ink-flood to black is the registry gutter's job (native mode 10,
 * standard 0.010).
 */

const [S, E] = RANGES[9]!;
const W = E - S;
const at = (f: number) => S + f * W;
const [CX] = issueCenter(9);

/**
 * Issue 9's full look (S0.4 row 9): graphite on cream paper, soft edges,
 * visible tooth. Extends the Phase 0 RECIPES[9] row but with mono 0
 * (ruling in ./shots.md): the world is AUTHORED graphite/ink restraint,
 * so the stage-C wash flood #6FA8DC -- the whole color payoff -- survives
 * the post chain. Paper is LIGHT: standard halftone/hatch polarity, no
 * dark-paper flip. Post hatch stays 0; sketchMaterials.ts already hatches
 * in-scene and doubling strokes would smear (S2.16).
 */
export const SKETCH_RECIPE = printRecipe({
  paper: "#F7F2E7",
  ink: "#232019",
  mono: 0,
  edge: 0.45,
  edgeColor: "#5A564E",
  halftone: 0.1,
  halftoneScale: 7,
  grain: 0.07,
  paperTex: 0.22,
  vignette: 0.3,
  boil: 0.6,
});

/**
 * Master scrub for the whole sketch set: issue-local u drives uInk on every
 * sketch/pawprint material (band map in shaders/sketchMaterials.ts header).
 * Pure f(t) -- the page pencils, inks, breathes and floods identically in
 * both scroll directions.
 */
export const inkAt = (t: number) => clamp01((t - S) / W);

// ---- the jaw-drop: the print run finishes -----------------------------------
/** flood band start (uInk 0.65): flat color starts sweeping the page. */
export const FLOOD_T = at(0.65);
/** authored-time pencil-settle channel read by Sketchbook.tsx (0 idle). */
export const SKETCH_SETTLE = { v: 0 };

let settleTl: gsap.core.Timeline | null = null;

// S5b jaw-drop, FLASHLESS (quiet-valley drop per lib/beats.ts -- Issues 4
// and 9 omit the impact frame). The self-inking + flood is entirely pure
// f(uInk) in the materials; this beat adds only a 0.7s authored nudge on
// the resting pencil, as if it just finished the page. Deliberately slow
// and near-silent -- the journey's held breath. BeatRunner owns hysteresis
// and the reduced-motion skip.
registerJawDrop({
  id: "sketch-print-run",
  t: FLOOD_T,
  animate: () => {
    settleTl?.kill();
    settleTl = gsap
      .timeline()
      .set(SKETCH_SETTLE, { v: 0 })
      .to(SKETCH_SETTLE, { v: 1, duration: 0.2, ease: "power2.out" })
      .to(SKETCH_SETTLE, { v: 0, duration: 0.5, ease: "power2.inOut" });
  },
});

// ---- shot windows (fractions of the issue range; table in ./shots.md) ------
const F: [number, number][] = [
  [0.0, 0.3], // 1 overhead establish (descends west)
  [0.34, 0.62], // 2 low tracking along the chain
  [0.66, 1.0], // 3 flood finale
];

// Drift-gutter contract (lib/shots.ts): out: "drift" requires the end pose
// to BE the next shot's from pose. Shared constants enforce it by identity.
const P_DESCEND: Pose = {
  position: [CX - 19, 6.5, 14.5],
  target: [CX - 14.5, 0.5, -2.5],
  roll: 0.02,
  fov: 40,
};
const P_TRACK_END: Pose = {
  position: [CX + 12, 5, 13],
  target: [CX + 16.5, 0.5, -2.5],
  roll: -0.02,
  fov: 40,
};

export const SKETCH_SHOTS: Shot[] = [
  {
    // overhead establish: the whole chain in pencil, reading left-to-right;
    // FG pencil + stain south, MG chain + robots, BG annotations + binding;
    // descends toward the west end as the inking starts (u=.05 at p~.17)
    id: "sketch-overhead",
    issue: 9,
    range: [at(F[0]![0]), at(F[0]![1])],
    kind: "dolly",
    from: { position: [CX, 30, 26], target: [CX, 0, -1], roll: 0, fov: 52 },
    to: P_DESCEND,
    ease: easeInOut,
    out: "drift",
  },
  {
    // low tracking west->east: annotations FG lower third, robots/packets on
    // the chain mid, node machines BG; the cat crosses the FG paper at
    // u .20-.50 leaving pawprints -- window [.34,.62] catches the second
    // half of the walk plus the sit; ink completes (u=.60) just before the
    // held-breath drift gutter [.62,.66]
    id: "sketch-track",
    issue: 9,
    range: [at(F[1]![0]), at(F[1]![1])],
    kind: "dolly",
    from: P_DESCEND,
    to: P_TRACK_END,
    ease: easeInOut,
    out: "drift",
  },
  {
    // flood finale: slow pull up + back to the composed full page while the
    // wash front sweeps W->E (one shared uSweepSpan print run), finishing
    // flat at issue end; the gutter ink-floods the world to black
    id: "sketch-flood",
    issue: 9,
    range: [at(F[2]![0]), at(F[2]![1])],
    kind: "dolly",
    from: P_TRACK_END,
    to: { position: [CX + 1, 27, 29], target: [CX, 0, -2], roll: 0, fov: 52 },
    ease: easeInOut,
  },
];
