// The main tunables for the OUTSIDE hero scene — "The One Warm Window", a restrained noir
// descent: palette, instance counts, layout, and motion speeds. (Some purely-procedural art
// constants — window-grid density, per-tower size ranges — still live inline in shaders.ts /
// CityInstances.tsx.) Art direction: a cold desaturated cyan rain-city dissolving into the
// shared #05060a fog, with exactly ONE warm amber window (the developer's desk) as the sole
// warm mark.

import type { QualityTier } from "@/lib/scrollStore";

/** Palette (exact hexes from the art direction). THREE.Color reads these as sRGB and
 *  converts to linear for the shaders — the whole scene works in linear space. */
export const COLOR = {
  towerBody: "#0a1018",
  edge: "#1b2c44",
  windowDim: "#2a3d55",
  cyan: "#8fd4ff",
  rain: "#6f8598",
  warm: "#ffcf8a",
} as const;

/** Per-instance counts by quality tier — low tier thins the fill-heavy systems. */
export const COUNT = {
  towers: { high: 260, low: 90 },
  aerials: { high: 80, low: 0 },
  signage: { high: 130, low: 50 },
} as const;

export const pick = (tier: QualityTier, c: { high: number; low: number }) =>
  tier === "low" ? c.low : c.high;

/** Local-frame placement (camera flies +Z entry -> origin -> -Z exit, +Y world up). */
export const LAYOUT = {
  // minX 30 keeps a clear central flight tube (so the next scene's content isn't occluded by a
  // tower); zBack -120 stops the city invading DESK's space downstream (scenes are ~30u apart).
  corridor: { minX: 30, maxX: 62, zFront: 90, zBack: -120, spanY: 46 },
  // Hero z pulled inside the camera's actual local-Z reach (~-32 at scene-0 exit) so the warm
  // window is genuinely approached and grows into the DESK bloom-handoff, not viewed from afar.
  hero: { pos: [-8, -24, -40] as const, size: [16, 46, 16] as const, yawDeg: 15 },
  warmWindow: { size: [1.6, 2.2] as const, glow: 22 },
  glass: { size: [46, 28] as const, tiltDeg: 8, z: 6 },
  // Ground/street level. Raised from -40 toward the flight corridor so the wet asphalt actually
  // enters frame under the descending camera (was ~50u below and never seen). NOTE: only the
  // INSTANCED city (towers/aerials/signage) grounds off this; the hero tower + warm window + glass
  // are fixed local positions (hero.pos/glass), so the wet floor now sits just below the warm window.
  street: { y: -22, size: 900 },
  sky: { radius: 340 },
} as const;

/** Motion in units/sec (or rad/sec) — every value is applied `* delta` via the shared
 *  uTime clock, which only advances when reduced motion is off. */
export const MOTION = {
  rivulet: 1.0,
  ripple: 0.6,
} as const;
