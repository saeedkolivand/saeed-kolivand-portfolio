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

interface BeatState {
  armed: boolean;
}

export class BeatRunner {
  private states = new Map<string, BeatState>();
  private lastT: number | null = null;

  constructor(private beats: Beat[]) {
    for (const b of beats) this.states.set(b.id, { armed: true });
  }

  update(t: number, reducedMotion: boolean) {
    const last = this.lastT;
    this.lastT = t;
    if (last === null) {
      // First sample (page may load mid-timeline): disarm anything already passed.
      for (const b of this.beats) this.states.get(b.id)!.armed = t < b.trigger;
      return;
    }
    for (const b of this.beats) {
      const st = this.states.get(b.id)!;
      if (st.armed && last < b.trigger && t >= b.trigger) {
        st.armed = false;
        if (!reducedMotion) b.fire();
      } else if (!st.armed && t < b.trigger - b.hysteresis) {
        st.armed = true;
      }
    }
  }
}

/** Issue 1 -> Issue 2 gutter entry (noir range end, S0.3): the title drop. */
const TITLE_DROP_T = RANGES[1]![1];

let titleTl: gsap.core.Timeline | null = null;

/**
 * S5b.3 title drop -- the name card slams in as a full-frame comic title at
 * authored speed (the card itself lives in components/Lettering.tsx and reads
 * fx.title), with a flash-budget-guarded impact double pop as the sub-thump.
 * Re-fires cleanly after hysteresis re-arm: the previous timeline is killed.
 */
export function makeBeats(): Beat[] {
  return [
    {
      id: "title-drop",
      trigger: TITLE_DROP_T,
      hysteresis: 0.006,
      fire: () => {
        titleTl?.kill();
        titleTl = gsap
          .timeline()
          .set(fx, { title: 0 })
          .to(fx, { title: 1, duration: 0.22, ease: "back.out(2.5)" })
          .to(fx, { title: 0, duration: 0.16, ease: "power3.in" }, "+=0.72");
        if (!requestFlash()) return; // card still plays; only the flashes are budgeted
        gsap
          .timeline()
          .to(fx, { impact: 1, duration: 0.05, ease: "none" })
          .to(fx, { impact: 0, duration: 0.12, ease: "power2.out" })
          .to(fx, { impact: 0.7, duration: 0.04, ease: "none" }, "+=0.06") // sub-thump
          .to(fx, { impact: 0, duration: 0.18, ease: "power2.out" });
      },
    },
    {
      // Issue 3 jaw-drop: the power-on cascade sub-thump. The cascade itself
      // is pure f(t) in issues/03-neon (scrub-safe); only this authored-time
      // impact double pop rides the beat engine. Same trigger t as the wave.
      id: "neon-cascade",
      trigger: NEON_CASCADE_T,
      hysteresis: 0.006,
      fire: () => {
        if (!requestFlash()) return; // flash budget (S2.13); wave plays regardless
        gsap
          .timeline()
          .to(fx, { impact: 1, duration: 0.05, ease: "none" })
          .to(fx, { impact: 0, duration: 0.12, ease: "power2.out" })
          .to(fx, { impact: 0.7, duration: 0.04, ease: "none" }, "+=0.06") // sub-thump
          .to(fx, { impact: 0, duration: 0.18, ease: "power2.out" });
      },
    },
  ];
}
