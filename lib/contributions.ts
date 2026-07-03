// Typed loader for the build-time-baked contribution grid (SPEC 0.5).
// Data is baked by scripts/bake-contributions.mjs (prebuild); this is a
// static JSON import -- no runtime fetch, ever.

import data from "@/public/data/contributions.json";

export type ContributionDay = {
  /** ISO date YYYY-MM-DD */
  d: string;
  /** intensity level 0-4 */
  l: number;
};

export type ContributionGrid = {
  source: "github" | "procedural";
  from: string;
  to: string;
  /** 53 weeks x 7 days, columns Sun-Sat */
  weeks: ContributionDay[][];
};

export const CONTRIB_WEEKS = 53;
export const CONTRIB_DAYS = 7;

export function getContributions(): ContributionGrid {
  return data as ContributionGrid;
}
