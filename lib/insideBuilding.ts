import { scenes } from "@/scenes/registry";

// The DESK "inside the building" window, expressed as fractions of the scene ranges so it tracks
// automatically when scene pacing weights (scenes/registry) change. From ENTER_T you're inside
// (OutsideScene hides, DeskScene shows); at EXIT_T the room hands off to the ENTER-MONITOR dive.
const lerp = (r: readonly [number, number], f: number) => r[0] + f * (r[1] - r[0]);

export const ENTER_T = lerp(scenes[1]!.range, 0.89); // ~89% into DESK (scene 1) — the reveal
export const EXIT_T = lerp(scenes[2]!.range, 0.86); // ~86% into ENTER-MONITOR (scene 2) — the dive

export function insideBuilding(t: number): boolean {
  return t >= ENTER_T && t < EXIT_T;
}
