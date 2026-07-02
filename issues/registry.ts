import {
  compileSegments,
  easeInOut,
  easeOutCubic,
  type Segment,
  type Shot,
  type TransitionKind,
  type Vec3,
} from "@/lib/shots";
import { ACCENTS, RECIPES, type PrintRecipe } from "@/lib/recipes";

/** World-space distance between issue set origins (S2.5 -- isolated sets). */
export const ISSUE_SPACING = 200;

export interface IssueEntry {
  id: string;
  title: string;
  /** slice of global t, S0.3 (gutters live between consecutive ranges) */
  range: [number, number];
  /** S5b.2 beat chart, 1-5 */
  intensity: number;
  /** how we leave this issue (S0.3 table) */
  outTransition: TransitionKind;
  recipe: PrintRecipe;
  accents: string[];
}

const row = (
  id: string,
  title: string,
  range: [number, number],
  intensity: number,
  outTransition: TransitionKind,
  index: number,
): IssueEntry => ({
  id,
  title,
  range,
  intensity,
  outTransition,
  recipe: RECIPES[index]!,
  accents: ACCENTS[index]!,
});

/** S0.3 locked timeline -- ranges + gutters chain exactly to 1.000. Do not re-balance. */
export const ISSUES: IssueEntry[] = [
  row("cover", "PANEL JUMP", [0.0, 0.03], 1, "crash-through", 0),
  row("noir", "ISSUE 1 - NOIR", [0.04, 0.108], 2, "title-drop", 1),
  row("desk", "ISSUE 2 - DESK", [0.123, 0.21], 2, "dot-zoom", 2),
  row("neon", "ISSUE 3 - NEON INK", [0.225, 0.305], 5, "panel-wipe", 3),
  row("origin", "ISSUE 4 - ORIGIN PAGE", [0.315, 0.378], 1, "panel-portal", 4),
  row("press", "ISSUE 5 - THE PRESS", [0.388, 0.478], 3, "stamp", 5),
  row("newsprint", "ISSUE 6 - NEWSPRINT", [0.488, 0.566], 3, "paper-tear", 6),
  row("screentone", "ISSUE 7 - SCREENTONE", [0.576, 0.656], 4, "page-flip", 7),
  row("pop", "ISSUE 8 - POP PRINT", [0.671, 0.752], 5, "whip", 8),
  row("sketch", "ISSUE 9 - SKETCHBOOK", [0.762, 0.838], 2, "ink-flood", 9),
  row("spread", "ISSUE 10 - THE SPREAD", [0.848, 0.93], 5, "dot-match", 10),
  row("terminal", "ISSUE 11 - LETTERS PAGE", [0.94, 1.0], 1, "cut", 11),
];

export const issueCenter = (index: number): Vec3 => [index * ISSUE_SPACING, 0, 0];

/**
 * Phase 0 placeholder coverage: 2 shots per issue (hold, then a push-in
 * dolly with a mild crash feel), separated by a small intra-issue whip
 * gutter. Real per-issue shot lists replace this in Phases 1/3 (S0.8).
 */
function placeholderShots(issue: IssueEntry, index: number): Shot[] {
  const [s, e] = issue.range;
  const w = e - s;
  const [cx, cy, cz] = issueCenter(index);
  return [
    {
      id: `${issue.id}-hold`,
      issue: index,
      range: [s, s + 0.46 * w],
      kind: "hold",
      from: { position: [cx - 1.2, cy + 2.2, cz + 9.5], target: [cx, cy + 1, cz], roll: -0.03, fov: 42 },
      to: { position: [cx + 1.2, cy + 2.6, cz + 8.8], target: [cx, cy + 1, cz], roll: 0.03, fov: 42 },
      ease: easeInOut,
    },
    {
      id: `${issue.id}-dolly`,
      issue: index,
      range: [s + 0.54 * w, e],
      kind: "dolly",
      from: { position: [cx - 5, cy + 2.8, cz + 7], target: [cx, cy + 1, cz], roll: 0.06, fov: 50 },
      to: { position: [cx, cy + 1.4, cz + 4], target: [cx, cy + 1, cz], roll: 0, fov: 36 },
      ease: easeOutCubic,
    },
  ];
}

export const SHOTS: Shot[] = ISSUES.flatMap((issue, i) => placeholderShots(issue, i));

export const SEGMENTS: Segment[] = compileSegments(
  SHOTS,
  (issue) => ISSUES[issue]!.outTransition,
);
