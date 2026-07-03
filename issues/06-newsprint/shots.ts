import gsap from "gsap";
import { clamp01, easeInOut, type Shot } from "@/lib/shots";
import { printRecipe } from "@/lib/recipes";
import { registerJawDrop } from "@/lib/beats";
import { sayWord } from "@/lib/onomatopoeia";
import { issueCenter, RANGES } from "../timeline";

/**
 * Issue 6 NEWSPRINT -- authored shots (S0.8 table in ./shots.md).
 * Left-to-right broadsheet walk: headline establish -> ticker tracking ->
 * front-page approach (the color flood) -> close hold on the story panel.
 * Shots 1-2 and 2-3 cut on default whips; 3-4 is a continuity DRIFT (end
 * pose === next from pose, lib/shots.ts contract) so the flood lands
 * uninterrupted. Exit paper-tear is the registry gutter's job.
 */

const [S, E] = RANGES[6]!;
const W = E - S;
const at = (f: number) => S + f * W;
const [CX] = issueCenter(6);

/**
 * Issue 6's full look (S0.4 row 6): light newsprint paper, near-black ink,
 * FULL mono -- the whole world prints B&W so the colorWindow flood (which
 * exempts mono per pixel, shaders/colorWindow.ts) is the only color event.
 * Coarse dots + heavy fiber + speckle = cheap pulp stock.
 */
export const NEWSPRINT_RECIPE = printRecipe({
  paper: "#EAE3D2",
  ink: "#221F1A",
  mono: 1,
  edge: 0.75,
  edgeColor: "#221F1A",
  halftone: 0.55,
  halftoneScale: 6,
  grain: 0.09,
  paperTex: 0.22,
  vignette: 0.2,
  boil: 0.4,
});

// ---- page layout anchors (set-local x/y/z; Newsprint.tsx builds around these)
/** front-page story panel group origin */
export const NEWS_PANEL_POS = [15, 4.2, -1] as const;
/** ticker band centerline */
export const NEWS_TICKER_Y = 6.2;
export const NEWS_TICKER_Z = -5;

// ---- shot windows (fractions of the issue range; table in ./shots.md) -------
const F: [number, number][] = [
  [0.0, 0.27], // 1 headline establish
  [0.305, 0.55], // 2 ticker tracking
  [0.585, 0.85], // 3 front-page approach (flood)
  [0.875, 1.0], // 4 story close (buttons)
];

// ---- the flood (pure f(t); the jaw-drop garnish rides the beat engine) ------
/** colorWindow.enabled ramp across the shot-3 approach (monotonic). */
export const NEWS_FLOOD_RANGE: [number, number] = [at(0.6), at(0.82)];
/** shot 3 p~0.73: the flood crests -- frame pop + spot-red word pop. */
export const NEWS_FLOOD_T = at(0.78);
/** authored-time squash channel read by Newsprint.tsx (0 when idle). */
export const NEWS_FLOOD_POP = { v: 0 };

/** 0..1 flood amount for any t -- scrub-safe both directions. */
export const newsFlood = (t: number) =>
  clamp01((t - NEWS_FLOOD_RANGE[0]) / (NEWS_FLOOD_RANGE[1] - NEWS_FLOOD_RANGE[0]));

let floodTl: gsap.core.Timeline | null = null;

// S5b jaw-drop: the front page floods to color. NO flash requested -- an
// impact frame on a bright paper world edges toward strobe (S2.16); the
// color arriving IS the drop, and it stays pure f(t) above. This beat only
// adds the authored-time squash + one budgetless word pop (sayWord is pooled
// lettering, not a flash). BeatRunner owns hysteresis + reduced-motion skip.
registerJawDrop({
  id: "newsprint-flood",
  t: NEWS_FLOOD_T,
  animate: () => {
    floodTl?.kill();
    floodTl = gsap
      .timeline()
      .set(NEWS_FLOOD_POP, { v: 0 })
      .to(NEWS_FLOOD_POP, { v: 1, duration: 0.12, ease: "back.out(3)" })
      .to(NEWS_FLOOD_POP, { v: 0, duration: 0.5, ease: "power2.out" });
    // Authored beat, not a pool pick: always the spot-red "KRAKA-THOOM"
    // (present in lettering.onomatopoeia.impact; passed as a 1-word list so
    // the pick can't drift if the pool reorders). Fixed seed keeps sprite
    // jitter identical on every crossing -- no Math.random in scrub paths.
    sayWord(
      ["KRAKA-THOOM"],
      // upper-right of the panel, inside the CLOSE_POSE frame (iter: was
      // y 9.8 -- off-frame above at the close framing)
      [CX + NEWS_PANEL_POS[0] + 2.5, 7.6, 1.5],
      0.37,
      "#C63D2F", // spot red, S0.4 row 6
    );
  },
});

// shot 3 end pose === shot 4 from pose (drift contract, lib/shots.ts).
// Near-frontal at ~11.7 units: fov 44 frames banner-to-buttons with the ink
// frame just cropping -- full-bleed front page, buttons readable (iter 1)
const CLOSE_POSE = {
  position: [CX + 13.8, 4.2, 10.6] as [number, number, number],
  target: [CX + 15, 4.2, -1] as [number, number, number],
  roll: 0,
  fov: 44,
};

export const NEWSPRINT_SHOTS: Shot[] = [
  {
    // establish: high 3/4 from front-left, headline sheet left third
    id: "news-establish",
    issue: 6,
    range: [at(F[0]![0]), at(F[0]![1])],
    kind: "hold",
    from: { position: [CX - 24, 8.5, 17], target: [CX - 4, 4, -4], roll: -0.025, fov: 58 },
    to: { position: [CX - 19, 7, 15], target: [CX - 5, 4, -4], roll: 0.012, fov: 58 },
    ease: easeInOut,
  },
  {
    // ticker tracking: truck right pacing the stepped crawl; cat photo FG
    id: "news-ticker",
    issue: 6,
    range: [at(F[1]![0]), at(F[1]![1])],
    kind: "dolly",
    // path rides ABOVE the sheet tops (SH2 5.9 / SH3 6.4) so the band owns
    // the upper frame; cat photo plate passes lower-left FG (iter 1)
    from: { position: [CX - 2, 6.5, 11], target: [CX + 3, 5.8, -5], roll: 0.02, fov: 40 },
    to: { position: [CX + 6, 6.9, 10], target: [CX + 11, 6.0, -5], roll: -0.015, fov: 40 },
    ease: easeInOut,
  },
  {
    // approach: push on the front-page panel; the flood ramps across this
    id: "news-approach",
    issue: 6,
    range: [at(F[2]![0]), at(F[2]![1])],
    kind: "dolly",
    from: { position: [CX + 2, 5.2, 13], target: [CX + 15, 4.3, -1], roll: -0.018, fov: 46 },
    to: CLOSE_POSE,
    ease: easeInOut,
    out: "drift",
  },
  {
    // close hold: story + blurb + the two diegetic buttons, micro-drift only
    id: "news-frontpage",
    issue: 6,
    range: [at(F[3]![0]), at(F[3]![1])],
    kind: "hold",
    from: CLOSE_POSE,
    to: { position: [CX + 14.2, 4.15, 9.8], target: [CX + 15, 4.2, -1], roll: 0.008, fov: 42 },
    ease: easeInOut,
  },
];
