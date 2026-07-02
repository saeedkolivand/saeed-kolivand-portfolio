/**
 * Runtime channel for the S0 Phase 1 noir COLOR WINDOW: one world-space
 * rect that prints in full color inside an otherwise mono recipe. Issue
 * components write here (plain mutable module state, same pattern as
 * lib/fx); PostPipeline uploads it to PrintEffect every frame. The mask is
 * reconstructed per pixel from the depth buffer, so this costs zero render
 * targets and no extra draw (ruling 2026-07-02).
 *
 * The rect is center + two half-axis vectors: center + halfU is the middle
 * of the right edge, center + halfV the middle of the top edge. `depth` is
 * the half-thickness tolerance along the rect normal in world units --
 * keep it just deep enough to catch the window geometry.
 */
export const colorWindow = {
  /** 0..1 master blend; 0 skips the shader branch entirely */
  enabled: 0,
  /** rect center in world units */
  center: [0, 0, 0] as [number, number, number],
  /** half-width axis, world units */
  halfU: [1, 0, 0] as [number, number, number],
  /** half-height axis, world units */
  halfV: [0, 1, 0] as [number, number, number],
  /** half-thickness along the rect normal, world units */
  depth: 0.6,
};
