import type { FC } from "react";

/** The contract every scene implements (spec §3). */
export interface SceneDef {
  id: string;
  label: string;
  /** [startT, endT] on the global 0..1 timeline. */
  range: [number, number];
  /** Extra t-margin to mount early. */
  preload?: number;
  /** Real scene component; when absent, a labeled placeholder is rendered (Phase 0). */
  Component?: FC;
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
