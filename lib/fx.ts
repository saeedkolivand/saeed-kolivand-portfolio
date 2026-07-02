/**
 * Mutable per-frame FX channels written by beats (GSAP timelines) and read
 * by the post pipeline each frame. Plain module state: React-free on
 * purpose -- these change at 60fps.
 */
export const fx = {
  /** 0..1 impact-frame flash (flash-budget guarded at the beat that drives it) */
  impact: 0,
  /** 0..1(+overshoot) title-drop card presence, driven by the title-drop beat */
  title: 0,
};
