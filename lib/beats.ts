import gsap from "gsap";
import { fx } from "./fx";
import { requestFlash } from "./flashBudget";

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

/**
 * Phase 0 demo beat -- a flash-safe impact frame at the title-drop gutter
 * entry (t = 0.108). Plays at authored speed for fast and slow scrollers.
 */
export function makeDemoBeats(): Beat[] {
  return [
    {
      id: "demo-impact",
      trigger: 0.108,
      hysteresis: 0.006,
      fire: () => {
        if (!requestFlash()) return;
        gsap
          .timeline()
          .to(fx, { impact: 1, duration: 0.05, ease: "none" })
          .to(fx, { impact: 0, duration: 0.12, ease: "power2.out" })
          .to(fx, { impact: 0.7, duration: 0.04, ease: "none" }, "+=0.06")
          .to(fx, { impact: 0, duration: 0.18, ease: "power2.out" });
      },
    },
  ];
}
