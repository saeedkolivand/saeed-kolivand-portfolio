import gsap from "gsap";
import { easeInOut, type Shot } from "@/lib/shots";
import { printRecipe } from "@/lib/recipes";
import { registerJawDrop } from "@/lib/beats";
import { snapshots } from "@/lib/snapshots";
import { issueCenter, RANGES } from "../timeline";
import { COSMOS_R, CHART_R } from "./ranges";

/**
 * Issue 10 THE SPREAD -- authored shots (S0.8 table in ./shots.md).
 * Cosmos establish -> star-chart approach -> constellation drift -> THE
 * UNFOLD. Intensity 5 via scale + starfield density + the unfold (S2.16:
 * zero strobe). Exit: dot-match -- shot 4 ends with the bright cursor star
 * dead-center so the gutter shader can match it to Issue 11's terminal
 * cursor.
 */

const [S, E] = RANGES[10]!;
const W = E - S;
const at = (f: number) => S + f * W;
const [CX] = issueCenter(10);

/**
 * Issue 10's full look -- cosmic near-black (S0.4 row 10), one printRecipe().
 * Mirrors RECIPES[10] with grain/paperTex lowered: high-frequency flicker on
 * a near-black world edges toward strobe (Neon S2.16 precedent, 2026-07-02).
 */
export const SPREAD_RECIPE = printRecipe({
  paper: "#05060D",
  ink: "#EAF2FF",
  edge: 0.4,
  edgeColor: "#EAF2FF",
  halftone: 0.18,
  halftoneScale: 5,
  vignette: 0.5,
  grain: 0.03,
  paperTex: 0.05,
  boil: 0.4,
});

/**
 * The unfold driver window: U = (t - start)/(end - start), pure f(t) inside
 * Spread.tsx (scrub-safe). Ends at at(0.94): the last 6% of the issue is a
 * settled full-spread frame for the dot-match exit + closing caption.
 */
export const UNFOLD_RANGE: [number, number] = [at(0.74), at(0.94)];

/** The cat's drift across the constellation arc (shot 3, guide moment). */
export const CAT_DRIFT: [number, number] = [at(0.52), at(0.7)];

/** Authored-time breath on the spread group, read by Spread.tsx (0 idle). */
export const UNFOLD_POP = { v: 0 };

// Retain every quoted issue from module load (not mount): PostPipeline only
// refreshes a retained key in that issue's exit-shot tail, and most tails are
// filmed long before Spread mounts on a clean forward read. 1/2/3 are already
// permanently retained by Origin's shots.ts (deliberately never released);
// retaining here is the same end state for the rest of the run. Snapshots are
// framebuffer copies, NOT live RTs -- the S2.10 budget is untouched.
snapshots.retain(0);
for (let i = 4; i <= 9; i++) snapshots.retain(i);

let unfoldTl: gsap.core.Timeline | null = null;

// THE JAW-DROP OF THE WHOLE SITE (S5b): the frame unfolds into the
// double-page spread. The unfold itself is pure f(t) in Spread.tsx; this
// beat adds the budgeted impact flash + a 0.9s authored breath as the
// stack cracks open. BeatRunner owns hysteresis re-arm + reduced-motion skip.
registerJawDrop({
  id: "spread-unfold",
  t: UNFOLD_RANGE[0],
  flash: 1,
  animate: () => {
    unfoldTl?.kill();
    unfoldTl = gsap
      .timeline()
      .set(UNFOLD_POP, { v: 0 })
      .to(UNFOLD_POP, { v: 1, duration: 0.3, ease: "back.out(3)" })
      .to(UNFOLD_POP, { v: 0, duration: 0.6, ease: "sine.inOut" });
  },
});

export const SPREAD_SHOTS: Shot[] = [
  {
    // cosmos establish: low drift from frame-left; chart glows upper-right,
    // constellation arc + dome behind, krackle FG
    id: "spread-cosmos",
    issue: 10,
    range: COSMOS_R,
    kind: "dolly",
    from: { position: [CX - 24, 6, 22], target: [CX - 2, 5, -20], roll: -0.05, fov: 58 },
    to: { position: [CX - 16, 4.5, 17], target: [CX - 3, 6, -22], roll: -0.02, fov: 52 },
    ease: easeInOut,
  },
  {
    // star-chart approach: climb + head-on push; the grid resolves into a
    // wide star band, green highs sparkling
    id: "spread-chart",
    issue: 10,
    range: CHART_R,
    kind: "dolly",
    from: { position: [CX + 4, 5, 10], target: [CX - 4, 11, -30], roll: 0.03, fov: 50 },
    to: { position: [CX - 2, 11, -13.2], target: [CX - 4, 11, -30], roll: 0, fov: 38 },
    ease: easeInOut,
  },
  {
    // constellation drift: lateral pan across the labeled arc; the cat
    // drifts through mid-shot -- ends EXACTLY on shot 4's from pose (drift
    // gutter C0 rule, lib/shots.ts)
    id: "spread-drift",
    issue: 10,
    range: [at(0.5), at(0.68)],
    kind: "dolly",
    from: { position: [CX - 13, 6.5, 9], target: [CX - 22, 5.5, -26], roll: -0.03, fov: 42 },
    to: { position: [CX + 10, 3.5, 10], target: [CX + 16, 2.5, -28], roll: 0.02, fov: 40 },
    ease: easeInOut,
    out: "drift",
  },
  {
    // THE UNFOLD: pull back + center while the spread fans out; end frame
    // holds the whole journey with the cursor star dead-center (dot-match)
    id: "spread-unfold",
    issue: 10,
    range: [at(0.72), at(1)],
    kind: "dolly",
    from: { position: [CX + 10, 3.5, 10], target: [CX + 16, 2.5, -28], roll: 0.02, fov: 40 },
    to: { position: [CX, 0.6, 30], target: [CX, 0.1, -14], roll: 0, fov: 55 },
    ease: easeInOut,
  },
];
