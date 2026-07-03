import { easeInOut, easeOutCubic, type EaseFn, type Shot } from "@/lib/shots";
import { issueCenter, RANGES } from "../timeline";

/**
 * Issue 3 NEON INK / CODE CITY -- authored shots (S0.8 table in ./shots.md).
 * Free-fall dive -> crash-zoom past the hero tower -> dutch landing hold.
 * All fractions of the locked neon range (S0.3); intra-issue gutters get the
 * default whip from compileSegments.
 */

const [S, E] = RANGES[3]!;
const W = E - S;
const at = (f: number) => S + f * W;
const [CX, CY, CZ] = issueCenter(3);

/** accelerating fall */
const easeInQuad: EaseFn = (x) => x * x;

/**
 * Power-on cascade window (the jaw-drop): starts the instant the landing
 * shot begins, wave fully out 70% into the hold. Pure f(t) -- Neon.tsx maps
 * t through this window into a quantized radial wave; lib/beats.ts fires the
 * sub-thump at the same trigger.
 */
export const NEON_CASCADE_T = at(0.67);
export const NEON_CASCADE_END = at(0.67 + 0.33 * 0.7);

export const NEON_SHOTS: Shot[] = [
  {
    // free-fall dive: straight down at the dead city, pre-lit signs only
    id: "neon-dive",
    issue: 3,
    range: [at(0), at(0.32)],
    kind: "crash",
    from: { position: [CX, CY + 85, CZ + 30], target: [CX, CY, CZ + 4], roll: 0.02, fov: 62 },
    to: { position: [CX + 2, CY + 38, CZ + 14], target: [CX, CY, CZ + 4], roll: -0.04, fov: 66 },
    ease: easeInQuad,
  },
  {
    // crash-zoom past the hero tower: opens on the roof (sign + cat +
    // keyboard as PROPS against surrounding blocks -- the pull-back from
    // the 2026-07-03 scale ruling keeps the tower reading as a building,
    // not a frame-filling box), then dives to the street. Range unchanged.
    id: "neon-crash",
    issue: 3,
    range: [at(0.395), at(0.595)],
    kind: "crash",
    from: { position: [CX + 0.5, CY + 28, CZ + 15], target: [CX + 8, CY + 19.5, CZ + 1], roll: 0.03, fov: 32 },
    to: { position: [CX + 1.5, CY + 4, CZ + 10], target: [CX, CY + 1, CZ + 4], roll: -0.05, fov: 54 },
    ease: easeOutCubic,
  },
  {
    // dutch landing hold: street level, cascade wave rolls out into depth
    id: "neon-landing",
    issue: 3,
    range: [at(0.67), at(1)],
    kind: "hold",
    from: { position: [CX - 4, CY + 2.6, CZ + 15], target: [CX + 2, CY + 2.8, CZ - 10], roll: -0.14, fov: 46 },
    to: { position: [CX - 2.5, CY + 2.1, CZ + 13.5], target: [CX + 2, CY + 3.2, CZ - 10], roll: -0.11, fov: 44 },
    ease: easeInOut,
  },
];
