import type { ComponentType } from "react";
import { compileSegments, type Segment, type Shot, type TransitionKind } from "@/lib/shots";
import { ACCENTS, RECIPES, type PrintRecipe } from "@/lib/recipes";
import { ISSUE_SPACING, issueCenter, placeholderShots, RANGES } from "./timeline";
import PlaceholderIssue from "./PlaceholderIssue";
import Cover from "./00-cover/Cover";
import Noir from "./01-noir/Noir";
import Desk from "./02-desk/Desk";
import Neon from "./03-neon/Neon";
import { COVER_SHOTS } from "./00-cover/shots";
import { NOIR_SHOTS } from "./01-noir/shots";
import { DESK_SHOTS } from "./02-desk/shots";
import { NEON_SHOTS } from "./03-neon/shots";

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
  /** scene set rendered by SceneManager (entries 4-11 stay on the placeholder) */
  component: IssueComponent;
}

const row = (
  id: string,
  title: string,
  index: number,
  intensity: number,
  outTransition: TransitionKind,
  component: IssueComponent,
): IssueEntry => ({
  id,
  title,
  range: [RANGES[index]![0], RANGES[index]![1]],
  intensity,
  outTransition,
  recipe: RECIPES[index]!,
  accents: ACCENTS[index]!,
  component,
});

/** S0.3 locked timeline -- ranges + gutters chain exactly to 1.000. Do not re-balance. */
export const ISSUES: IssueEntry[] = [
  row("cover", "PANEL JUMP", 0, 1, "crash-through", Cover),
  row("noir", "ISSUE 1 - NOIR", 1, 2, "title-drop", Noir),
  row("desk", "ISSUE 2 - DESK", 2, 2, "dot-zoom", Desk),
  row("neon", "ISSUE 3 - NEON INK", 3, 5, "panel-wipe", Neon),
  row("origin", "ISSUE 4 - ORIGIN PAGE", 4, 1, "panel-portal", PlaceholderIssue),
  row("press", "ISSUE 5 - THE PRESS", 5, 3, "stamp", PlaceholderIssue),
  row("newsprint", "ISSUE 6 - NEWSPRINT", 6, 3, "paper-tear", PlaceholderIssue),
  row("screentone", "ISSUE 7 - SCREENTONE", 7, 4, "page-flip", PlaceholderIssue),
  row("pop", "ISSUE 8 - POP PRINT", 8, 5, "whip", PlaceholderIssue),
  row("sketch", "ISSUE 9 - SKETCHBOOK", 9, 2, "ink-flood", PlaceholderIssue),
  row("spread", "ISSUE 10 - THE SPREAD", 10, 5, "dot-match", PlaceholderIssue),
  row("terminal", "ISSUE 11 - LETTERS PAGE", 11, 1, "cut", PlaceholderIssue),
];

// Entries 0-3 own their shot lists (issues/XX-*/shots.ts); 4-11 stay placeholder.
export const SHOTS: Shot[] = [
  ...COVER_SHOTS,
  ...NOIR_SHOTS,
  ...DESK_SHOTS,
  ...NEON_SHOTS,
  ...ISSUES.slice(4).flatMap((issue, i) => placeholderShots(issue.id, i + 4)),
];

export const SEGMENTS: Segment[] = compileSegments(
  SHOTS,
  (issue) => ISSUES[issue]!.outTransition,
);
