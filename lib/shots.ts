export type Vec3 = [number, number, number];

export interface Pose {
  position: Vec3;
  target: Vec3;
  /** radians around the view axis (dutch) */
  roll?: number;
  fov?: number;
}

export type ShotKind = "hold" | "dolly" | "orbit" | "crash" | "whip" | "spline";

/** Full S0.3 transition vocabulary. */
export type TransitionKind =
  | "cut"
  | "whip"
  | "dot-zoom"
  | "crash-through"
  | "title-drop"
  | "panel-wipe"
  | "panel-portal"
  | "stamp"
  | "paper-tear"
  | "page-flip"
  | "ink-flood"
  | "dot-match";

/** What the TransitionEffect can render (Phase 1: + crash-through). */
export type TransitionMode = "cut" | "whip" | "dot-zoom" | "crash-through";

// ponytail: unbuilt kinds map to nearest analog (S0.1), swapped for real
// implementations in Phases 1-2 without touching the registry.
export const TRANSITION_FALLBACK: Record<TransitionKind, TransitionMode> = {
  cut: "cut",
  whip: "whip",
  "dot-zoom": "dot-zoom",
  "crash-through": "crash-through",
  "title-drop": "whip",
  "panel-wipe": "cut",
  "panel-portal": "cut",
  stamp: "cut",
  "paper-tear": "cut",
  "page-flip": "cut",
  "ink-flood": "cut",
  "dot-match": "cut",
};

export type EaseFn = (x: number) => number;

export interface Shot {
  id: string;
  issue: number;
  range: [number, number];
  kind: ShotKind;
  from: Pose;
  to?: Pose;
  ease?: EaseFn;
}

export interface ShotSegment {
  type: "shot";
  range: [number, number];
  shot: Shot;
}

export interface GutterSegment {
  type: "gutter";
  range: [number, number];
  fromShot: Shot;
  toShot: Shot;
  kind: TransitionKind;
  mode: TransitionMode;
  interIssue: boolean;
}

export type Segment = ShotSegment | GutterSegment;

export const easeInOut: EaseFn = (x) => x * x * (3 - 2 * x);
export const easeOutCubic: EaseFn = (x) => 1 - Math.pow(1 - x, 3);

export const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);
export const lerp = (a: number, b: number, x: number) => a + (b - a) * x;

const lerpV3 = (a: Vec3, b: Vec3, x: number): Vec3 => [
  lerp(a[0], b[0], x),
  lerp(a[1], b[1], x),
  lerp(a[2], b[2], x),
];

export function poseAt(shot: Shot, p: number): Pose {
  const to = shot.to;
  if (!to) return shot.from;
  const e = (shot.ease ?? easeInOut)(clamp01(p));
  return {
    position: lerpV3(shot.from.position, to.position, e),
    target: lerpV3(shot.from.target, to.target, e),
    roll: lerp(shot.from.roll ?? 0, to.roll ?? shot.from.roll ?? 0, e),
    fov: lerp(shot.from.fov ?? 45, to.fov ?? shot.from.fov ?? 45, e),
  };
}

/** Where within a gutter the camera jumps from the outgoing to the incoming shot. */
function cutPoint(mode: TransitionMode): number {
  // dot-zoom and crash-through film the incoming issue for the whole
  // gutter -- the outgoing issue is only present as its snapshot overlay.
  return mode === "dot-zoom" || mode === "crash-through" ? 0 : 0.5;
}

export interface TransitionSample {
  mode: TransitionMode;
  /** deadbanded local progress through the gutter, 0..1 */
  p: number;
  fromIssue: number;
  toIssue: number;
}

export interface TimelineSample {
  segment: Segment;
  /** issue the camera is filming right now */
  filmIssue: number;
  /** issue used for active+/-1 mounting and recipe targeting */
  activeIssue: number;
  pose: Pose;
  shotP: number;
  shotKind: ShotKind | null;
  transition: TransitionSample | null;
}

/**
 * Build the flat, gap-free segment list: shots as given (their ranges must
 * not touch), a gutter between every consecutive pair. Inter-issue gutters
 * take the issue's outTransition kind; intra-issue gutters default to whip.
 */
export function compileSegments(
  shots: Shot[],
  outTransitionOf: (issue: number) => TransitionKind,
): Segment[] {
  const segments: Segment[] = [];
  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i]!;
    segments.push({ type: "shot", range: shot.range, shot });
    const next = shots[i + 1];
    if (!next) break;
    const interIssue = next.issue !== shot.issue;
    const kind: TransitionKind = interIssue ? outTransitionOf(shot.issue) : "whip";
    segments.push({
      type: "gutter",
      range: [shot.range[1], next.range[0]],
      fromShot: shot,
      toShot: next,
      kind,
      mode: TRANSITION_FALLBACK[kind],
      interIssue,
    });
  }
  return segments;
}

/** S2.4 deadband: freeze p just inside gutter edges so hovering never strobes. */
function deadbandedP(t: number, range: [number, number]): number {
  const width = range[1] - range[0];
  const db = Math.min(0.002, width * 0.25);
  return clamp01((t - range[0] - db) / (width - 2 * db));
}

/** Pure f(t): the whole camera + transition state for any scroll position. */
export function evaluateTimeline(t: number, segments: Segment[]): TimelineSample {
  const tc = clamp01(t);
  let lo = 0;
  let hi = segments.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (tc >= segments[mid]!.range[1]) lo = mid + 1;
    else hi = mid;
  }
  const segment = segments[lo]!;

  if (segment.type === "shot") {
    const [s, e] = segment.range;
    const p = clamp01((tc - s) / (e - s));
    return {
      segment,
      filmIssue: segment.shot.issue,
      activeIssue: segment.shot.issue,
      pose: poseAt(segment.shot, p),
      shotP: p,
      shotKind: segment.shot.kind,
      transition: null,
    };
  }

  const p = deadbandedP(tc, segment.range);
  const afterCut = p >= cutPoint(segment.mode);
  const filmShot = afterCut ? segment.toShot : segment.fromShot;
  return {
    segment,
    filmIssue: filmShot.issue,
    activeIssue: p < 0.5 ? segment.fromShot.issue : segment.toShot.issue,
    pose: afterCut ? poseAt(segment.toShot, 0) : poseAt(segment.fromShot, 1),
    shotP: 0,
    shotKind: null,
    transition: segment.interIssue
      ? {
          mode: segment.mode,
          p,
          fromIssue: segment.fromShot.issue,
          toIssue: segment.toShot.issue,
        }
      : { mode: "whip", p, fromIssue: segment.fromShot.issue, toIssue: segment.toShot.issue },
  };
}
