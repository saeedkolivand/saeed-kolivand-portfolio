import { easeInOut, type EaseFn, type Shot, type Vec3 } from "@/lib/shots";
import { issueCenter, RANGES } from "../timeline";

/**
 * Issue 1 -- NOIR authored shot list (S0.8 canonical table, see shots.md):
 * hold 24mm 0.45 / whip 28mm 0.215 / dolly 50mm 0.135 / crash 85->35mm 0.20,
 * chained inside RANGES[1] with three intra-issue whip gutters. Everything
 * here is pure data; Lettering.tsx maps the 3 noir captions onto shots 1-3.
 * Rebalanced 2026-07-02 (hold+whip grew at the dolly's expense), then again
 * 2026-07-03 (live feedback: the opening street still read as a flash) --
 * shot 1 grew to 0.45 taken ~evenly from whip/dolly. Round 2 same day (the
 * facade climb still whipped by too fast): whip 0.179 -> 0.215, taken
 * entirely from the static dolly window-dwell (0.171 -> 0.135) per the
 * standing ruling (never from hold or crash). The exact pair 0.215/0.135
 * was picked so the seg() float accumulation reproduces shot 4's t-range
 * BIT-identically (sum 0.35 alone is not enough at double precision;
 * verified old===new via Object.is on both endpoints). Leap k-window is
 * in-shot p, untouched.
 */

/** vertical fov in degrees for a full-frame lens: 2*atan(12/mm) */
const lens = (mm: number) => (2 * Math.atan(12 / mm) * 180) / Math.PI;

/** crash grammar: hang back on the cat, slam in the last quarter */
const easeInCubic: EaseFn = (x) => x * x * x;

const [S, E] = RANGES[1]!;
/** intra-issue whip gutters carved from the range (deadband-safe width) */
const GUTTER = 0.003;
const SHARES = [0.45, 0.215, 0.135, 0.2];
const SPAN = E - S - GUTTER * (SHARES.length - 1);

const seg = (i: number): [number, number] => {
  let a = S;
  for (let k = 0; k < i; k++) a += SHARES[k]! * SPAN + GUTTER;
  return [a, a + SHARES[i]! * SPAN];
};

const [cx, cy, cz] = issueCenter(1);
const at = (x: number, y: number, z: number): Vec3 => [cx + x, cy + y, cz + z];

/** local-space center of THE window; shaders/colorWindow rect lives here too */
export const NOIR_WINDOW = { x: 2.5, y: 10.5, z: -7.82 };

export const NOIR_SHOTS: Shot[] = [
  {
    // low dutch from the street: FG railing, MG rain, BG facade,
    // the one lit window in the upper third
    id: "noir-street-hold",
    issue: 1,
    range: seg(0),
    kind: "hold",
    from: { position: at(-1.6, -1.1, 12.5), target: at(1.2, 5.2, -8), roll: -0.1, fov: lens(24) },
    to: { position: at(-1.0, -0.9, 11.9), target: at(1.5, 5.6, -8), roll: -0.085, fov: lens(24) },
    ease: easeInOut,
  },
  {
    // vertical whip up the facade; velocity-driven speed lines from post
    id: "noir-facade-whip",
    issue: 1,
    range: seg(1),
    kind: "whip",
    from: { position: at(1.0, 0.5, 3.5), target: at(2.5, 2.0, -8), roll: 0.02, fov: lens(28) },
    to: { position: at(1.0, 13.5, 3.5), target: at(2.5, 17.5, -8), roll: -0.02, fov: lens(28) },
    ease: easeInOut,
  },
  {
    // slow 50mm push, window dead-center: the color reveal composition
    // (S5b jaw-drop); cat silhouette walks in frame-left on the rooftop FG
    id: "noir-window-dolly",
    issue: 1,
    range: seg(2),
    kind: "dolly",
    from: {
      position: at(-4.5, 9.7, 10.5),
      target: at(NOIR_WINDOW.x, NOIR_WINDOW.y, NOIR_WINDOW.z),
      roll: 0.03,
      fov: lens(50),
    },
    to: {
      position: at(-0.5, 10.05, 4.0),
      target: at(NOIR_WINDOW.x, NOIR_WINDOW.y, NOIR_WINDOW.z),
      roll: 0,
      fov: lens(50),
    },
    ease: easeInOut,
  },
  {
    // 85mm tight on the cat (from-target sits ON the crouch spot so the
    // cat holds frame through the rack), then the target racks to the
    // window as the camera crashes; the cat leaps frame-right from p~0.72,
    // crosses the lit window in screen space at p~0.8 and is fully out
    // frame-right by p~0.93 -- motivated cut (gate fix attempt 1,
    // framing iteration 1/3, verified by NDC projection sweep)
    id: "noir-window-crash",
    issue: 1,
    range: seg(3),
    kind: "crash",
    from: { position: at(-1.2, 9.4, 10.5), target: at(-0.9, 9.2, 0.8), roll: -0.04, fov: lens(85) },
    to: {
      position: at(1.3, 10.3, -3.4),
      target: at(NOIR_WINDOW.x, NOIR_WINDOW.y, NOIR_WINDOW.z),
      roll: 0,
      fov: lens(35),
    },
    ease: easeInCubic,
  },
];
