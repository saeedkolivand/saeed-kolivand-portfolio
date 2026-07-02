import { easeInOut, easeOutCubic, type Shot, type Vec3 } from "@/lib/shots";

/**
 * Leaf module: locked timeline numbers + placeholder shot generator.
 * Lives below registry.ts so per-issue shots.ts files can import ranges
 * without creating an import cycle (registry imports the shot lists).
 */

/** World-space distance between issue set origins (S2.5 -- isolated sets). */
export const ISSUE_SPACING = 200;

export const issueCenter = (index: number): Vec3 => [index * ISSUE_SPACING, 0, 0];

/** S0.3 locked timeline -- ranges + gutters chain exactly to 1.000. Do not re-balance. */
export const RANGES: readonly [number, number][] = [
  [0.0, 0.03], // 0 cover
  [0.04, 0.108], // 1 noir
  [0.123, 0.21], // 2 desk
  [0.225, 0.305], // 3 neon
  [0.315, 0.378], // 4 origin
  [0.388, 0.478], // 5 press
  [0.488, 0.566], // 6 newsprint
  [0.576, 0.656], // 7 screentone
  [0.671, 0.752], // 8 pop
  [0.762, 0.838], // 9 sketch
  [0.848, 0.93], // 10 spread
  [0.94, 1.0], // 11 terminal
];

/**
 * Placeholder coverage: 2 shots per issue (hold, then a push-in dolly with a
 * mild crash feel), separated by a small intra-issue whip gutter. Real
 * per-issue shot lists replace this per phase (S0.8).
 */
export function placeholderShots(id: string, index: number): Shot[] {
  const [s, e] = RANGES[index]!;
  const w = e - s;
  const [cx, cy, cz] = issueCenter(index);
  return [
    {
      id: `${id}-hold`,
      issue: index,
      range: [s, s + 0.46 * w],
      kind: "hold",
      from: { position: [cx - 1.2, cy + 2.2, cz + 9.5], target: [cx, cy + 1, cz], roll: -0.03, fov: 42 },
      to: { position: [cx + 1.2, cy + 2.6, cz + 8.8], target: [cx, cy + 1, cz], roll: 0.03, fov: 42 },
      ease: easeInOut,
    },
    {
      id: `${id}-dolly`,
      issue: index,
      range: [s + 0.54 * w, e],
      kind: "dolly",
      from: { position: [cx - 5, cy + 2.8, cz + 7], target: [cx, cy + 1, cz], roll: 0.06, fov: 50 },
      to: { position: [cx, cy + 1.4, cz + 4], target: [cx, cy + 1, cz], roll: 0, fov: 36 },
      ease: easeOutCubic,
    },
  ];
}
