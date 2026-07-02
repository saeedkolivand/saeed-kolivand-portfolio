/**
 * S2.8 -- stepped time ("on 2s"). World/prop animation samples this; the
 * camera and scroll always run smooth. 12 fps default, 8 fps for low tier.
 */
export const stepTime = (elapsed: number, fps = 12) => Math.floor(elapsed * fps) / fps;

/** Deterministic per-step jitter in [-1,1], for line boil and hand-drawn wobble. */
export function stepNoise(elapsed: number, fps = 12, seed = 0) {
  const s = Math.floor(elapsed * fps) + seed * 374761;
  const x = Math.sin(s * 12.9898) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}
