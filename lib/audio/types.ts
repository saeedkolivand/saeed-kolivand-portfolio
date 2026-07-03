import type { ToneAudioNode } from "tone";

/**
 * Phase 4 audio contracts (Wave A). Tone.js is NEVER imported statically at
 * value level -- the director lazy-imports it on first enable and hands the
 * module to each recipe as `T`. This file is types + the recipe slot table
 * only, so it stays out of the server/initial bundle.
 */

/** The lazily imported tone module: `const T = await import("tone")`. */
export type ToneModule = typeof import("tone");

/**
 * One per-issue sound design (Wave B authors these). Lifecycle, all driven
 * by the director (lib/audio/director.ts):
 *
 *   build   -- called once, lazily, the first time the issue enters the
 *              active +/-1 window while audio is enabled. Create sources /
 *              synths / effects here and return the recipe's single output
 *              node; the director connects it to the music bus behind a
 *              per-issue crossfade gain it owns (recipes never touch the
 *              destination or master chain).
 *   start   -- (re)start continuous sources. May be called again after
 *              stop() -- Tone sources restart fine; keep your instances.
 *   stop    -- stop continuous sources; do NOT dispose (instances are kept
 *              and restarted when the issue re-enters the window).
 *   update  -- once per director rAF tick while in the active window.
 *              tLocal is 0..1 through the issue's own range (clamped;
 *              scrub-safe both directions), dtSec is the frame delta,
 *              velocity is the smoothed scroll velocity ~[-1, 1].
 *              Param moves use rampTo(), never per-frame .value writes.
 *   dispose -- full teardown of everything built; only on engine teardown.
 */
export interface AudioRecipe {
  build(T: ToneModule): ToneAudioNode;
  start(): void;
  stop(): void;
  update(tLocal: number, dtSec: number, velocity: number): void;
  dispose(): void;
}

/**
 * Indexed like issues/registry.ts ISSUES (12 slots). null = silence for that
 * issue (legal placeholder). Wave B fills these in place.
 */
export const audioRecipes: (AudioRecipe | null)[] = Array.from({ length: 12 }, () => null);
