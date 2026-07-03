/**
 * Mutable per-frame FX channels written by beats (GSAP timelines) and read
 * by the post pipeline each frame. Plain module state: React-free on
 * purpose -- these change at 60fps.
 */
export const fx = {
  /** 0..1 impact-frame flash (flash-budget guarded at the beat that drives it) */
  impact: 0,
  /**
   * title-drop SLAM energy: 1 = oversized impact frame, 0 = at rest
   * (back.out briefly dips it negative for the settle). Transform only --
   * card opacity is a pure f(t) scroll window in components/Lettering.tsx,
   * so an unfired beat (deep jump, reduced motion) shows the card resting.
   */
  title: 0,
};
