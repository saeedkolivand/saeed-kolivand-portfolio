import { RANGES } from "../timeline";

/**
 * Issue 10 THE SPREAD -- shared shot/caption windows, PURE data. No gsap,
 * three, react, or snapshot side effects, so components/Lettering.tsx can
 * import these two windows without pulling in ./shots.ts's module side
 * effects (registerJawDrop / snapshots.retain / gsap). Both ./shots.ts
 * (SPREAD_SHOTS[0]/[1]) and Lettering consume these, so the numbers cannot
 * diverge. Derived from the same authored fractions over RANGES[10].
 */

const [S, E] = RANGES[10]!;
const W = E - S;
const at = (f: number) => S + f * W;

/** Shot 1 (spread-cosmos): cosmos establish. */
export const COSMOS_R: [number, number] = [at(0), at(0.2)];

/** Shot 2 (spread-chart): star-chart approach. */
export const CHART_R: [number, number] = [at(0.24), at(0.46)];
