import gsap from "gsap";
import { fx } from "./fx";
import { requestFlash } from "./flashBudget";
import { RANGES } from "@/issues/timeline";
import { NEON_CASCADE_T } from "@/issues/03-neon/shots";

/**
 * S2.14 beat engine -- authored-time sequences fired when t crosses a
 * trigger. Idempotent, hysteresis re-armed, skipped under reduced motion.
 * Travel stays f(t); beats play at their own fixed duration.
 */
export interface Beat {
  id: string;
  trigger: number;
  /** re-arms once t retreats below trigger - hysteresis */
  hysteresis: number;
  fire: () => void;
}

export class BeatRunner {
  private states = new Map<string, { armed: boolean }>();
  private lastT: number | null = null;

  /** `beats` is a provider so late registerJawDrop() calls are picked up. */
  constructor(private beats: () => readonly Beat[]) {}

  update(t: number, reducedMotion: boolean) {
    const last = this.lastT;
    this.lastT = t;
    for (const b of this.beats()) {
      let st = this.states.get(b.id);
      if (!st) {
        // first sighting (page may load mid-timeline; issues may register
        // their jaw-drop after construction): arm only if not already passed
        st = { armed: t < b.trigger };
        this.states.set(b.id, st);
        continue;
      }
      if (last === null) continue;
      if (st.armed && last < b.trigger && t >= b.trigger) {
        st.armed = false;
        if (!reducedMotion) b.fire();
      } else if (!st.armed && t < b.trigger - b.hysteresis) {
        st.armed = true;
      }
    }
  }
}

/**
 * S5b jaw-drop helper (Phase 2/3 authoring surface) -- every issue registers
 * its one designed jaw-drop declaratively; trigger crossing, hysteresis
 * re-arm and the flash budget are enforced HERE, never per issue. The
 * scroll-driven part of a jaw-drop stays pure f(t) inside the issue
 * (scrub-safe); only authored-time motion goes through `animate`.
 *
 *   // in the issue's shots.ts or component module scope:
 *   registerJawDrop({ id: "press-stamp", t: PRESS_STAMP_T, flash: 1,
 *     animate: () => { myTl?.kill(); myTl = gsap.timeline()... } });
 */
export interface JawDropSpec {
  id: string;
  /** global t that fires the drop */
  t: number;
  /**
   * impact-frame intensity 0..1: the flash, granted through the central
   * requestFlash() budget (S2.13). Plays the standard double pop + sub-thump
   * on fx.impact. Omit (or 0) for quiet-valley jaw-drops (Issues 4, 9).
   */
  flash?: number;
  /**
   * authored-time hook (own GSAP timeline, 0.4-1.5s per S2.14). Runs even
   * when the flash is denied; kill your previous timeline before rebuilding
   * so hysteresis re-fires stay clean.
   */
  animate?: () => void;
  /** re-arm distance below t, default 0.006 */
  hysteresis?: number;
}

const jawDrops = new Map<string, Beat>();
let beatList: Beat[] | null = null;

/** Phase 4 audio hook: the director registers a one-shot player; called after animate/flash. */
let beatSound: ((id: string, flash: number) => void) | null = null;

export function setBeatSound(fn: ((id: string, flash: number) => void) | null): void {
  beatSound = fn;
}

/** flash-budget-guarded impact double pop + sub-thump, shared by all drops */
function impactPop(intensity: number) {
  if (!requestFlash()) return;
  gsap
    .timeline()
    .to(fx, { impact: intensity, duration: 0.05, ease: "none" })
    .to(fx, { impact: 0, duration: 0.12, ease: "power2.out" })
    .to(fx, { impact: 0.7 * intensity, duration: 0.04, ease: "none" }, "+=0.06") // sub-thump
    .to(fx, { impact: 0, duration: 0.18, ease: "power2.out" });
}

/** Idempotent by id (HMR/StrictMode safe): re-registering replaces the drop. */
export function registerJawDrop(spec: JawDropSpec): void {
  jawDrops.set(spec.id, {
    id: spec.id,
    trigger: spec.t,
    hysteresis: spec.hysteresis ?? 0.006,
    fire: () => {
      spec.animate?.();
      if (spec.flash) impactPop(spec.flash);
      beatSound?.(spec.id, spec.flash ?? 0);
    },
  });
  beatList = null;
}

/** Live beat list for BeatRunner -- cached, rebuilt on registration (no per-frame alloc). */
export function allBeats(): readonly Beat[] {
  return (beatList ??= [...jawDrops.values()]);
}

/** Issue 1 -> Issue 2 gutter entry (noir range end, S0.3): the title drop. */
const TITLE_DROP_T = RANGES[1]![1];

let titleTl: gsap.core.Timeline | null = null;

// S5b.3 title drop -- card VISIBILITY is a scroll-anchored window, pure f(t)
// in components/Lettering.tsx (user ruling 2026-07-03: no timer fade). This
// beat plays only the authored SLAM: fx.title snaps to 1 (oversized impact
// frame, held ~60ms) then settles to 0 with a back.out dip. Flash stays
// gated here, never tied to the opacity window. Re-fires cleanly after
// hysteresis re-arm: the previous timeline is killed.
registerJawDrop({
  id: "title-drop",
  t: TITLE_DROP_T,
  flash: 1,
  animate: () => {
    titleTl?.kill();
    titleTl = gsap
      .timeline()
      .set(fx, { title: 1 })
      .to(fx, { title: 0, duration: 0.34, ease: "back.out(2.5)" }, "+=0.06");
  },
});

// Issue 3 jaw-drop: the power-on cascade sub-thump. The cascade itself is
// pure f(t) in issues/03-neon (scrub-safe); only this budgeted impact pop
// rides the beat engine. Same trigger t as the wave.
registerJawDrop({ id: "neon-cascade", t: NEON_CASCADE_T, flash: 1 });
