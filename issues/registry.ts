import type { ComponentType } from "react";
import { compileSegments, type Segment, type Shot, type TransitionKind } from "@/lib/shots";
import { ACCENTS, RECIPES, type PrintRecipe } from "@/lib/recipes";
import { ISSUE_SPACING, issueCenter, placeholderShots, RANGES } from "./timeline";
import PlaceholderIssue from "./PlaceholderIssue";
import Cover from "./00-cover/Cover";
import Noir from "./01-noir/Noir";
import Desk from "./02-desk/Desk";
import Neon from "./03-neon/Neon";
import Origin from "./04-origin/Origin";
import Press from "./05-press/Press";
import Newsprint from "./06-newsprint/Newsprint";
import Screentone from "./07-screentone/Screentone";
import { COVER_SHOTS } from "./00-cover/shots";
import { NOIR_SHOTS } from "./01-noir/shots";
import { DESK_SHOTS } from "./02-desk/shots";
import { NEON_SHOTS } from "./03-neon/shots";
import { ORIGIN_RECIPE, ORIGIN_SHOTS } from "./04-origin/shots";
import { PRESS_RECIPE, PRESS_SHOTS } from "./05-press/shots";
import { NEWSPRINT_RECIPE, NEWSPRINT_SHOTS } from "./06-newsprint/shots";
import { SCREENTONE_RECIPE, SCREENTONE_SHOTS } from "./07-screentone/shots";

// Timeline numbers live in ./timeline (leaf); re-exported here for consumers.
export { ISSUE_SPACING, issueCenter };

export type IssueComponent = ComponentType<{ index: number }>;

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
  /** this issue's shot list, in timeline order (SHOTS below is derived from these) */
  shots: Shot[];
  /** scene set rendered by SceneManager (entries 4-11 stay on the placeholder) */
  component: IssueComponent;
}

/**
 * Phase 2 gate: a new issue = ONE component file (exporting its component +
 * printRecipe() + shot list + optional registerJawDrop at module scope) +
 * ONE row here. Omitted opts fall back to the S0.4 tables / placeholder
 * shots -- nothing else in the engine changes.
 */
interface RowOpts {
  /** the issue's full look -- one printRecipe() object (lib/recipes.ts) */
  recipe?: PrintRecipe;
  shots?: Shot[];
  accents?: string[];
}

const row = (
  id: string,
  title: string,
  index: number,
  intensity: number,
  outTransition: TransitionKind,
  component: IssueComponent,
  opts: RowOpts = {},
): IssueEntry => ({
  id,
  title,
  range: [RANGES[index]![0], RANGES[index]![1]],
  intensity,
  outTransition,
  recipe: opts.recipe ?? RECIPES[index]!,
  accents: opts.accents ?? ACCENTS[index]!,
  shots: opts.shots ?? placeholderShots(id, index),
  component,
});

/** S0.3 locked timeline -- ranges + gutters chain exactly to 1.000. Do not re-balance. */
export const ISSUES: IssueEntry[] = [
  row("cover", "PANEL JUMP", 0, 1, "crash-through", Cover, { shots: COVER_SHOTS }),
  row("noir", "ISSUE 1 - NOIR", 1, 2, "title-drop", Noir, { shots: NOIR_SHOTS }),
  row("desk", "ISSUE 2 - DESK", 2, 2, "dot-zoom", Desk, { shots: DESK_SHOTS }),
  row("neon", "ISSUE 3 - NEON INK", 3, 5, "panel-wipe", Neon, { shots: NEON_SHOTS }),
  row("origin", "ISSUE 4 - ORIGIN PAGE", 4, 1, "panel-portal", Origin, {
    recipe: ORIGIN_RECIPE,
    shots: ORIGIN_SHOTS,
  }),
  row("press", "ISSUE 5 - THE PRESS", 5, 3, "stamp", Press, {
    recipe: PRESS_RECIPE,
    shots: PRESS_SHOTS,
  }),
  row("newsprint", "ISSUE 6 - NEWSPRINT", 6, 3, "paper-tear", Newsprint, {
    recipe: NEWSPRINT_RECIPE,
    shots: NEWSPRINT_SHOTS,
  }),
  row("screentone", "ISSUE 7 - SCREENTONE", 7, 4, "page-flip", Screentone, {
    recipe: SCREENTONE_RECIPE,
    shots: SCREENTONE_SHOTS,
  }),
  row("pop", "ISSUE 8 - POP PRINT", 8, 5, "whip", PlaceholderIssue),
  row("sketch", "ISSUE 9 - SKETCHBOOK", 9, 2, "ink-flood", PlaceholderIssue),
  row("spread", "ISSUE 10 - THE SPREAD", 10, 5, "dot-match", PlaceholderIssue),
  row("terminal", "ISSUE 11 - LETTERS PAGE", 11, 1, "cut", PlaceholderIssue),
];

/** Flat shot list in timeline order, derived from the rows above. */
export const SHOTS: Shot[] = ISSUES.flatMap((issue) => issue.shots);

export const SEGMENTS: Segment[] = compileSegments(
  SHOTS,
  (issue) => ISSUES[issue]!.outTransition,
);
