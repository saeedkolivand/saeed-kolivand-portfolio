import gsap from "gsap";
import { clamp01, easeInOut, type Shot } from "@/lib/shots";
import { printRecipe } from "@/lib/recipes";
import { registerJawDrop } from "@/lib/beats";
import { PopPool } from "@/lib/pops";
import { sayWord } from "@/lib/onomatopoeia";
import { issueCopy, lettering } from "@/lib/content";
import { issueCenter, RANGES } from "../timeline";

/**
 * Issue 8 POP PRINT -- authored shots (S0.8 table in ./shots.md).
 * Open island stage: establish -> chat-wall track -> donation beat -> THE
 * 360 whip-orbit. The orbit is WORLD-SPIN (ruling in shots.md): poseAt() is
 * a strict from/to lerp, so the island group rotates 2PI as a pure f(t)
 * while the camera runs a butter from/to crane -- optically identical to a
 * camera orbit, scrub-safe both directions, zero engine edits.
 */

const [S, E] = RANGES[8]!;
const W = E - S;
const at = (f: number) => S + f * W;
const [CX] = issueCenter(8);

// ---- palette: S0.4 row 8 (shared with Pop.tsx) ------------------------------
export const PAPER = "#1B0F2E";
export const INK = "#F4EFFF";
export const PINK = "#FF3D81";
export const CYAN = "#29E0FF";
export const YELLOW = "#FFD32E";
const ACCENT_CYCLE = [PINK, CYAN, YELLOW] as const;

/**
 * Issue 8's full look (S0.4 row 8): oversaturated webcomic on deep purple.
 * Extends the Phase 0 RECIPES[8] row; grain/paperTex kept low on dark paper
 * (Neon S2.16 precedent -- no flicker on a saturated world).
 */
export const POP_RECIPE = printRecipe({
  paper: PAPER,
  ink: INK,
  edge: 0.8,
  edgeColor: INK,
  halftone: 0.5,
  halftoneScale: 9,
  boil: 0.65,
  grain: 0.05,
  paperTex: 0.08,
  vignette: 0.3,
});

const hash = (i: number, n: number) => {
  const x = Math.sin((i + 1) * n) * 43758.5453;
  return x - Math.floor(x);
};

// ---- chat balloon pool (lib/pops.ts PopPool -- built for this issue) --------
// Anchors are SET-LOCAL: Pop.tsx renders both pools inside the spinning
// island group, so balloons ride the 360 with the world.
export interface ChatData {
  line: string;
  accent: string;
}

export const chatPool = new PopPool<ChatData>(8, 2.6, () => ({
  line: "",
  accent: PINK,
}));

const CHAT_LINES = issueCopy.popPrint.chat;
let chatIdx = 0;

/**
 * Spawn the next chat line onto the chat column (5 lanes, deterministic
 * jitter). Sequential cycling gives every locked line airtime. Zero alloc.
 * Default seed derives from the line index -- no Math.random anywhere on a
 * scrub path (ruling 2026-07-03, lib/onomatopoeia.ts).
 */
export function spawnChat(seed?: number): void {
  const i = chatIdx++;
  seed ??= hash(i, 12.71);
  const lane = i % 5;
  // wider lane spread + 3 depth rows so concurrent balloons stack instead of
  // occluding each other's text (iteration 1, loop log in shots.md)
  const x = 5.2 + 0.95 * lane + 0.8 * (hash(i, 3.31) - 0.5);
  const y = 1.8 + 1.15 * ((i * 2) % 5) + 0.5 * hash(i, 7.73);
  const z = -1.6 + 1.6 * (i % 3) + 0.8 * (hash(i, 5.17) - 0.5);
  const slot = chatPool.spawn([x, y, z], seed);
  slot.data.line = CHAT_LINES[i % CHAT_LINES.length]!;
  slot.data.accent = ACCENT_CYCLE[i % ACCENT_CYCLE.length]!;
}

// ---- donation beat (the issue's ONE budgeted flash, S2.16) ------------------
export const DONATION_T = at(0.55); // shot 3 p ~ 0.5

/**
 * Donation scroll window (user directive 2026-07-03, title-card ruling):
 * alert + KA-CHING visibility is a pure f(t) opacity window with 0.30 edge
 * fades -- scrub-safe both directions, deep jumps land them resting visible
 * at scale exactly 1. [at(0.36), at(0.76)] spans late shot 2 -> early orbit:
 * ~7.5 wheel notches total, ~3 notches of full-opacity plateau at 2400vh
 * pacing, DONATION_T inside the plateau so the armed crossing fires its
 * budgeted flash while both are fully visible. The two elements never
 * overlap spatially (boom rests below the alert -- loop log in shots.md).
 */
export const DONATION_WINDOW: [number, number] = [at(0.36), at(0.76)];

/** fade in/out over 30% each end (Lettering.tsx windowOpacity pattern). */
export function donationOpacity(t: number): number {
  const p = (t - DONATION_WINDOW[0]) / (DONATION_WINDOW[1] - DONATION_WINDOW[0]);
  if (p <= 0 || p >= 1) return 0;
  return Math.min(1, p / 0.3, (1 - p) / 0.3);
}

/** authored-time slam kick read by Pop.tsx (1 -> 0 settle, 0 idle/rest). */
export const DON_KICK = { v: 0 };

let donTl: gsap.core.Timeline | null = null;

registerJawDrop({
  id: "pop-donation",
  t: DONATION_T,
  flash: 0.5,
  animate: () => {
    donTl?.kill();
    // the beat contributes pop energy ONLY (title-card ruling): visibility
    // lives in donationOpacity(t). back.out settle dips slightly negative
    // for the slam; unfired beat / reduced motion = kick 0 = scale 1.
    donTl = gsap
      .timeline()
      .set(DON_KICK, { v: 1 })
      .to(DON_KICK, { v: 0, duration: 0.7, ease: "back.out(2.4)" });
  },
});

// ---- the jaw-drop: the 360 whip-orbit ---------------------------------------
const ORBIT_F = 0.67; // shot 4 window start (fraction of the issue)
export const ORBIT_START_T = at(ORBIT_F);

/**
 * World-spin angle for any t -- pure f(t), scrub-safe. Smoothstep ramp gives
 * the whip-orbit its accelerate/decelerate punch while staying C1-smooth;
 * ends at exactly 2PI so exit framing equals entry framing (whip-clean).
 * Reduced motion (ruling in shots.md): 3 static angles, never seen rotating.
 */
export function spinAngle(t: number, reduced: boolean): number {
  const p = clamp01((t - ORBIT_START_T) / (E - ORBIT_START_T));
  if (reduced) return ((2 * Math.PI) / 3) * Math.min(Math.floor(p * 3), 2);
  return 2 * Math.PI * easeInOut(p);
}

/** authored-time squash kick on the island at orbit start (0 idle). */
export const ORBIT_KICK = { v: 0 };

let orbitTl: gsap.core.Timeline | null = null;

// S5b jaw-drop: the orbit itself is pure f(t) (spinAngle); this beat adds
// authored garnish only -- island squash, a chat volley, one whip word. NO
// flash: the issue's single budgeted flash is the donation beat (S2.16).
registerJawDrop({
  id: "pop-orbit-360",
  t: ORBIT_START_T,
  animate: () => {
    orbitTl?.kill();
    orbitTl = gsap
      .timeline()
      .set(ORBIT_KICK, { v: 0 })
      .to(ORBIT_KICK, { v: 1, duration: 0.12, ease: "power2.in" })
      .to(ORBIT_KICK, { v: 0, duration: 0.5, ease: "power2.out" });
    spawnChat(0.17);
    spawnChat(0.53);
    spawnChat(0.89);
    sayWord(lettering.onomatopoeia.whip, [CX, 9.5, 0], undefined, CYAN);
  },
});

// ---- shot windows (fractions of the issue range; table in ./shots.md) ------
const F: [number, number][] = [
  [0.0, 0.2], // 1 island establish
  [0.24, 0.44], // 2 chat-wall track
  [0.47, 0.63], // 3 donation beat
  [ORBIT_F, 1.0], // 4 THE 360 whip-orbit
];

export const POP_SHOTS: Shot[] = [
  {
    // establish: high front-left over the whole island; ON AIR sign
    // upper-left (off-center at the whip gutter, PR #22 ruling), desk + cat
    // center, chat balloons popping frame-right
    id: "pop-establish",
    issue: 8,
    range: [at(F[0]![0]), at(F[0]![1])],
    kind: "hold",
    from: { position: [CX - 8, 5.6, 15.5], target: [CX + 0.8, 3.0, 0], roll: -0.03, fov: 57 },
    to: { position: [CX - 6.2, 5.1, 14.6], target: [CX + 0.6, 2.9, 0], roll: -0.012, fov: 57 },
    ease: easeInOut,
  },
  {
    // chat-wall track: slide along the balloon column at balloon height;
    // balloons fill MG, emotes cross FG, desk + sign read BG-left
    id: "pop-chat",
    issue: 8,
    range: [at(F[1]![0]), at(F[1]![1])],
    kind: "dolly",
    from: { position: [CX + 9.5, 3.4, 10.5], target: [CX + 6.8, 3.8, -0.5], roll: 0.02, fov: 44 },
    to: { position: [CX + 4.5, 4.4, 9.6], target: [CX + 5.6, 4.0, -1], roll: -0.015, fov: 44 },
    ease: easeInOut,
  },
  {
    // donation beat: front-on over the desk at monitor height; the alert
    // pops above the monitor at p~0.5 and KA-CHING! floods the upper frame
    id: "pop-donation",
    issue: 8,
    range: [at(F[2]![0]), at(F[2]![1])],
    kind: "hold",
    from: { position: [CX - 1.6, 3.5, 8.6], target: [CX + 0.3, 3.4, 0], roll: 0.015, fov: 40 },
    to: { position: [CX - 0.6, 3.3, 7.8], target: [CX + 0.3, 3.5, 0], roll: 0, fov: 40 },
    ease: easeInOut,
  },
  {
    // THE 360: butter crane down/in while the world whip-orbits underneath
    // (spinAngle); ends at 0 rotation -- the registry whip takes the gutter
    id: "pop-orbit",
    issue: 8,
    range: [at(F[3]![0]), at(F[3]![1])],
    kind: "orbit",
    from: { position: [CX - 2, 7.0, 15.2], target: [CX, 3.0, 0], roll: 0, fov: 52 },
    to: { position: [CX + 1.6, 4.6, 12.9], target: [CX, 2.7, 0], roll: 0.025, fov: 55 },
    ease: easeInOut,
  },
];
