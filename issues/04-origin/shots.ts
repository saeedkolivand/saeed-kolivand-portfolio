import gsap from "gsap";
import { easeInOut, type Shot } from "@/lib/shots";
import { printRecipe } from "@/lib/recipes";
import { registerJawDrop } from "@/lib/beats";
import { snapshots } from "@/lib/snapshots";
import { issueCenter, RANGES } from "../timeline";

/**
 * Issue 4 ORIGIN PAGE -- authored shots (S0.8 table in ./shots.md).
 * Establish -> reading drift -> intimate row-3 pan -> portal glide.
 * The camera DRIFTS (quiet valley, intensity 1): each shot's end pose is
 * EXACTLY the next shot's from pose (C0 match; easeInOut gives zero
 * velocity at both ends, so the chain is C1), and every intra-issue
 * gutter declares out: "drift" -- no whip, no speed lines, no blink.
 * That continuity is what makes the quiet gutter legal (S1).
 */

const [S, E] = RANGES[4]!;
const W = E - S;
const at = (f: number) => S + f * W;
const [CX] = issueCenter(4);

/** Issue 4's full look -- muted valley (S0.4 row 4), one printRecipe(). */
export const ORIGIN_RECIPE = printRecipe({
  paper: "#EDE7DB",
  ink: "#2A2722",
  halftone: 0.3,
  edge: 0.5,
  boil: 0.3,
});

/**
 * Portal crossing: shot 4's camera z runs 6.0 -> -3.4 (easeInOut) and
 * crosses the page plane (local z=0) at easeInOut(p) = 6.0/9.4 => p ~ 0.593.
 * The glide itself is pure f(t); this t only fires the gentle beat below.
 */
export const ORIGIN_PORTAL_T = at(0.855 + 0.593 * 0.145);

/** The cat's margin walk, then its hop ONTO the portal's bottom frame --
 *  perched at the portal mouth through the glide (the guide moment, S5b.1). */
export const ORIGIN_CAT_WALK: [number, number] = [at(0.61), at(0.78)];
export const ORIGIN_CAT_HOP: [number, number] = [at(0.78), at(0.84)];

/** Gentle authored-time border breath, read by Origin.tsx (0 when idle). */
export const PORTAL_POP = { v: 0 };

// Retain the quoted issues from module load (not mount): PostPipeline only
// captures a retained issue in its exit-shot tail, and Noir/Desk tails are
// filmed long BEFORE Origin mounts on a clean forward read. Never released:
// the Issue 10 spread quotes every issue anyway, so permanent retention is
// the end state (snapshots are framebuffer copies, NOT live RTs -- S2.10).
snapshots.retain(1);
snapshots.retain(2);
snapshots.retain(3);

let portalTl: gsap.core.Timeline | null = null;

// S5b jaw-drop, gentle BY DESIGN: no flash (quiet-valley clause in
// JawDropSpec), just a 0.9s breath on the portal frame as we pass through.
// BeatRunner handles hysteresis re-arm + reduced-motion skip centrally.
registerJawDrop({
  id: "origin-portal",
  t: ORIGIN_PORTAL_T,
  animate: () => {
    portalTl?.kill();
    portalTl = gsap
      .timeline()
      .set(PORTAL_POP, { v: 0 })
      .to(PORTAL_POP, { v: 1, duration: 0.35, ease: "sine.out" })
      .to(PORTAL_POP, { v: 0, duration: 0.55, ease: "sine.inOut" });
  },
});

export const ORIGIN_SHOTS: Shot[] = [
  {
    // establish: whole page in a paper void, 3/4 from frame-left, then a
    // slow commit toward row 1 -- ends exactly on shot 2's from pose
    id: "origin-establish",
    issue: 4,
    range: [at(0), at(0.24)],
    kind: "dolly",
    from: { position: [CX - 7, 1.5, 19], target: [CX + 0.3, 0.2, 0], roll: -0.02, fov: 55 },
    to: { position: [CX - 4.6, 5.3, 8.6], target: [CX - 2.888, 4.75, 0], roll: -0.015, fov: 46 },
    ease: easeInOut,
    out: "drift",
  },
  {
    // reading drift: down the page from row 1 to row 3's first panel
    // (full page width in frame at 46; tightens to 26 as it settles on
    // the noir panel) -- ends exactly on shot 3's from pose
    id: "origin-read",
    issue: 4,
    range: [at(0.3), at(0.55)],
    kind: "dolly",
    from: { position: [CX - 4.6, 5.3, 8.6], target: [CX - 2.888, 4.75, 0], roll: -0.015, fov: 46 },
    to: { position: [CX - 3.3, -2.7, 9.0], target: [CX - 2.5, -3.05, 0], roll: 0.015, fov: 26 },
    ease: easeInOut,
    out: "drift",
  },
  {
    // intimate row-3 pan: open-source night panel -> the portal panel,
    // squaring up dead-center on the portal mouth (widening 26 -> 44 as
    // it draws in) -- ends exactly on shot 4's from pose
    id: "origin-close",
    issue: 4,
    range: [at(0.61), at(0.8)],
    kind: "dolly",
    from: { position: [CX - 3.3, -2.7, 9.0], target: [CX - 2.5, -3.05, 0], roll: 0.015, fov: 26 },
    to: { position: [CX + 3.275, -3.15, 6.0], target: [CX + 3.275, -3.15, -6.4], roll: 0, fov: 44 },
    ease: easeInOut,
    out: "drift",
  },
  {
    // the portal glide: dead-center push THROUGH the panel surface into the
    // recessed dark interior (that IS the transition out, S0.3)
    id: "origin-portal",
    issue: 4,
    range: [at(0.855), at(1)],
    kind: "dolly",
    from: { position: [CX + 3.275, -3.15, 6.0], target: [CX + 3.275, -3.15, -6.4], fov: 44 },
    to: { position: [CX + 3.275, -3.15, -3.4], target: [CX + 3.275, -3.15, -6.4], fov: 54 },
    ease: easeInOut,
  },
];
