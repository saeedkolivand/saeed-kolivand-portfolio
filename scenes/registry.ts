import type { FC } from "react";

/** Props every real scene Component receives from the SceneManager. */
export interface SceneComponentProps {
  /** Registry index of this scene (0-based). */
  index: number;
}

/** The contract every scene implements (spec §3). */
export interface SceneDef {
  id: string;
  label: string;
  /** [startT, endT] on the global 0..1 timeline. */
  range: [number, number];
  /** Extra t-margin to mount early. */
  preload?: number;
  /** Real scene component; when absent, a labeled placeholder is rendered (Phase 0).
   *  Authored in a local frame placed on the spline by SceneShell: camera flies in along
   *  local -Z, +Y is world up, origin is the scene's spline center. Note the camera passes
   *  THROUGH the origin (a fly-through, not a framed tableau) entering from the +Z side, so
   *  arrange content around the approach rather than piling it at the origin; and its view
   *  can pitch up to ~±24° relative to this level frame, since orientation is yaw-only. */
  Component?: FC<SceneComponentProps>;
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
