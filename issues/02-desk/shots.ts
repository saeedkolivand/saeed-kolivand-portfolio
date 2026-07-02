import { easeInOut, easeOutCubic, type Shot } from "@/lib/shots";
import { issueCenter, RANGES } from "../timeline";

/**
 * Issue 2 - Desk (S0.3 range 0.123-0.210). Four shots, 0.004 intra-issue
 * whip gutters. Continuity: Noir's cat exits frame-right, so shot 1 has the
 * cat entering frame-left. Shot 4's dot-bat motivates the dot-zoom out.
 * Absolute t windows are exported so Desk.tsx animation stays pure f(t).
 */

const [S, E] = RANGES[2]!;
const [CX] = issueCenter(2);

export const LAND_R: [number, number] = [S, S + 0.0205]; // 0.123 - 0.1435
export const KEYS_R: [number, number] = [S + 0.0245, S + 0.043]; // 0.1475 - 0.166
export const PANELS_R: [number, number] = [S + 0.047, S + 0.069]; // 0.170 - 0.192
export const MON_R: [number, number] = [S + 0.073, E]; // 0.196 - 0.210

export const DESK_SHOTS: Shot[] = [
  {
    id: "desk-landing",
    issue: 2,
    range: LAND_R,
    kind: "hold",
    from: { position: [CX - 3.2, 2.3, 6.4], target: [CX - 2.2, 0.7, 0.6], roll: -0.02, fov: 42 },
    to: { position: [CX - 2.5, 1.9, 5.7], target: [CX - 2.2, 0.55, 0.6], roll: 0.015, fov: 42 },
    ease: easeInOut,
  },
  {
    id: "desk-keys",
    issue: 2,
    range: KEYS_R,
    kind: "dolly",
    from: { position: [CX - 1.9, 0.85, 2.9], target: [CX - 0.9, 0.16, 1.05], roll: 0.03, fov: 34 },
    to: { position: [CX + 1.9, 0.75, 2.7], target: [CX + 1.75, 0.14, 1.0], roll: -0.02, fov: 34 },
    ease: easeInOut,
  },
  {
    id: "desk-panels",
    issue: 2,
    range: PANELS_R,
    kind: "dolly",
    from: { position: [CX, 8, 7.3], target: [CX, 8, 2.9], roll: 0, fov: 40 },
    to: { position: [CX, 8, 6.6], target: [CX, 8, 2.9], roll: 0, fov: 40 },
    ease: easeInOut,
  },
  {
    id: "desk-monitor",
    issue: 2,
    range: MON_R,
    kind: "hold",
    from: { position: [CX + 2.3, 1.7, 3.4], target: [CX + 0.2, 1.3, -1.4], roll: -0.02, fov: 36 },
    to: { position: [CX + 1.5, 1.45, 2.6], target: [CX + 0.2, 1.25, -1.4], roll: 0.01, fov: 36 },
    ease: easeOutCubic,
  },
];
