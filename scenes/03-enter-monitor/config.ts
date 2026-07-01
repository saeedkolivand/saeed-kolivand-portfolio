// Tunables for the ENTER MONITOR scene — the dive INTO the screen. A swirling tube of GPU
// particles streams past the diving camera toward a glowing core, in the code editor's cool
// cyan/white so it reads as plunging into the monitor. The tube half-length (length/2 = 30)
// stays inside the ~34u spacing to the neighbouring DESK / ABOUT scenes co-mounted by the ±1
// budget, so it doesn't overreach their centers.

import type { QualityTier } from "@/lib/scrollStore";

export const COLOR = {
  particleA: "#7ec8ff", // cyan (screen continuity)
  particleB: "#eaf6ff", // bright white-cyan
  core: "#bfe9ff", // the glowing core the camera passes through
} as const;

export const PARTICLES = {
  count: { high: 16000, low: 6000 },
  radius: 30, // tube radius
  length: 60, // tube length along local z (shader wraps particles over this; half-length 30 < 34u gap)
  size: 2.6,
  maxPointPx: 14, // near-camera point-size cap — keeps additive overdraw in budget
  swirl: 0.5, // rad/sec angular drift (faster near the axis)
  stream: 26, // units/sec toward +z, so particles rush past the -z-diving camera
} as const;

/** The glowing core the camera passes through (additive, so it flares rather than occludes). */
export const CORE = { radius: 3, segments: 24, opacity: 0.85 } as const;

export const pickCount = (tier: QualityTier) =>
  tier === "low" ? PARTICLES.count.low : PARTICLES.count.high;
