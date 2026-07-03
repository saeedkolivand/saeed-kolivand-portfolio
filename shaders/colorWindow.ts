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

/**
 * SECOND independent mono-exempt rect -- the SPOT RECT (ruling 2026-07-03):
 * scenes drive it per-frame (setSpotRect in useFrame) to keep the mascot's
 * golden-tabby colors visible inside mono/duotone print worlds. Same
 * depth-reconstruction mask and zero-RT cost as the window. `strength` < 1
 * leaves part of the mono/hatch grade on the subject so the cat still sits
 * in the world's print texture (terminal ~0.8, noir ~0.9). Halftone and the
 * ink line are NOT exempted (same as the window) -- the exemption is
 * color, not post. Recipe cross-fades cannot pop: the exemption multiplies
 * the already cross-faded uMono/uHatch uniforms.
 */
export const spotRect = {
  /** 0..1 master blend (fade in/out here); 0 skips the shader branch */
  enabled: 0,
  /** 0..1 exemption inside the rect; uploaded as enabled * strength */
  strength: 1,
  /** rect center in world units */
  center: [0, 0, 0] as [number, number, number],
  /** half-width axis, world units */
  halfU: [1, 0, 0] as [number, number, number],
  /** half-height axis, world units */
  halfV: [0, 1, 0] as [number, number, number],
  /** half-thickness along the rect normal, world units */
  depth: 0.6,
};

/**
 * Per-frame convenience for tracking a moving subject: copies values in
 * (no retained references). Does NOT touch `enabled` -- scenes own the
 * fade via spotRect.enabled (set 0 on unmount, like the window).
 */
export function setSpotRect(
  center: readonly [number, number, number],
  halfU: readonly [number, number, number],
  halfV: readonly [number, number, number],
  depth: number,
  strength: number,
): void {
  spotRect.center[0] = center[0];
  spotRect.center[1] = center[1];
  spotRect.center[2] = center[2];
  spotRect.halfU[0] = halfU[0];
  spotRect.halfU[1] = halfU[1];
  spotRect.halfU[2] = halfU[2];
  spotRect.halfV[0] = halfV[0];
  spotRect.halfV[1] = halfV[1];
  spotRect.halfV[2] = halfV[2];
  spotRect.depth = depth;
  spotRect.strength = strength;
}
