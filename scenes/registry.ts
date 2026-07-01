/** Props every real scene Component (wired by id in SceneManager's SCENE_COMPONENTS map)
 *  receives. Real scenes are authored in a local frame placed on the spline by SceneShell:
 *  the camera flies in along local -Z, +Y is world up, origin is the scene's spline center.
 *  The camera passes THROUGH the origin (a fly-through, not a framed tableau) entering from
 *  the +Z side, so arrange content around the approach rather than piling it at the origin;
 *  and its view can pitch up to ~±24° relative to this level frame, since orientation is
 *  yaw-only. */
export interface SceneComponentProps {
  /** Registry index of this scene (0-based). */
  index: number;
}

/** The contract every scene region implements (spec §3). This is a pure data module (labels
 *  + ranges) so label-only consumers like UIOverlay never pull in the 3D bundle. Real scene
 *  Components are wired by `id` in SceneManager; a region with no mapped Component renders a
 *  labeled placeholder. */
export interface SceneDef {
  id: string;
  label: string;
  /** [startT, endT] on the global 0..1 timeline. */
  range: [number, number];
  /** Extra t-margin to mount early. */
  preload?: number;
}

// TODO(asset): each scene gets a real Component in later phases. Phase 0 renders every
// entry as a labeled wireframe placeholder so the whole journey is walkable end-to-end.
const NAMES: ReadonlyArray<readonly [string, string]> = [
  ["01-outside", "OUTSIDE"],
  ["02-desk", "DESK"],
  ["03-enter-monitor", "ENTER MONITOR"],
  ["04-about", "ABOUT"],
  ["05-skills", "SKILLS"],
  ["06-open-source", "OPEN SOURCE"],
  ["07-timeline", "TIMELINE"],
  ["08-streaming", "STREAMING"],
  ["09-architecture", "ARCHITECTURE"],
  ["10-space", "SPACE"],
  ["11-terminal", "TERMINAL"],
];

export const scenes: SceneDef[] = NAMES.map(([id, label], i) => ({
  id,
  label,
  range: [i / NAMES.length, (i + 1) / NAMES.length],
  preload: 0.05,
}));
