import type { Filter, Gain, Noise, Oscillator } from "tone";
import { clamp01 } from "@/lib/shots";
import { RANGES } from "@/issues/timeline";
import type { ToneModule } from "./types";
import { moveTo } from "./util";

/**
 * Wave B: scored transitions. Pure f(t, velocity) gains on the sfx bus,
 * driven once per director loop tick (the single call site). Scrub-safe both
 * directions: everything is windowed on the gutter's t-range, nothing is
 * event-armed. Sub-thumps stay with the beat hook -- never doubled here.
 *
 * Gutters derived from issues/timeline.ts RANGES (never hardcoded):
 * - riser: Desk -> Neon dot-zoom gutter (pitch + cutoff climb with progress)
 * - whoosh: Noir -> Desk title whip and Pop -> Sketchbook whip; gain =
 *   gutter-progress bell x |velocity|, so a parked scrub stays silent
 */

const DOT_ZOOM: readonly [number, number] = [RANGES[2]![1], RANGES[3]![0]];
const WHIPS: readonly (readonly [number, number])[] = [
  [RANGES[1]![1], RANGES[2]![0]], // noir -> desk title whip
  [RANGES[8]![1], RANGES[9]![0]], // pop -> sketchbook whip
];

/** Sources idle this long at zero gain before they are stopped. */
const QUIET_STOP_S = 0.3;

interface Rig {
  riser: Oscillator;
  riserLp: Filter;
  riserGain: Gain;
  whoosh: Noise;
  whooshBp: Filter;
  whooshGain: Gain;
}

let rig: Rig | null = null;
let riserOn = false;
let whooshOn = false;
let riserQuiet = 0;
let whooshQuiet = 0;
const gR = { v: 0 };
const gW = { v: 0 };
const fFreq = { v: 70 };
const fLp = { v: 320 };
const fBp = { v: 380 };

function build(T: ToneModule, sfx: Gain): Rig {
  const riser = new T.Oscillator({ frequency: 70, type: "sawtooth", volume: -10 });
  const riserLp = new T.Filter(320, "lowpass");
  const riserGain = new T.Gain(0);
  riser.chain(riserLp, riserGain, sfx);
  const whoosh = new T.Noise("pink");
  const whooshBp = new T.Filter(380, "bandpass");
  const whooshGain = new T.Gain(0);
  whoosh.chain(whooshBp, whooshGain, sfx);
  return { riser, riserLp, riserGain, whoosh, whooshBp, whooshGain };
}

/** Called once per director rAF tick while audio is enabled. */
export function scoreTransitions(
  T: ToneModule,
  sfx: Gain,
  t: number,
  dtSec: number,
  velocity: number,
): void {
  if (!rig) rig = build(T, sfx);

  // riser into the dot-zoom: gain and pitch are pure functions of gutter
  // progress (backwards scrub = falling riser, equally valid)
  const p = clamp01((t - DOT_ZOOM[0]) / (DOT_ZOOM[1] - DOT_ZOOM[0]));
  const inRiser = t > DOT_ZOOM[0] && t < DOT_ZOOM[1];
  const riserTarget = inRiser ? p * p * 0.4 : 0;
  if (riserTarget > 0.001) {
    if (!riserOn) {
      rig.riser.start();
      riserOn = true;
    }
    riserQuiet = 0;
    moveTo(rig.riser.frequency, fFreq, 70 * Math.pow(2, 2.6 * p), 0.05, 1.5);
    moveTo(rig.riserLp.frequency, fLp, 320 + 2400 * p * p, 0.05, 25);
  } else if (riserOn) {
    riserQuiet += dtSec;
    if (riserQuiet > QUIET_STOP_S) {
      rig.riser.stop();
      riserOn = false;
    }
  }
  moveTo(rig.riserGain.gain, gR, riserTarget, 0.05, 0.008);

  // whoosh on the whip gutters: bell envelope x |velocity|
  let bell = 0;
  for (let i = 0; i < WHIPS.length; i++) {
    const w = WHIPS[i]!;
    if (t > w[0] && t < w[1]) {
      bell = Math.sin(Math.PI * clamp01((t - w[0]) / (w[1] - w[0])));
      break;
    }
  }
  const whooshTarget = bell * Math.min(Math.abs(velocity), 1) * 0.55;
  if (whooshTarget > 0.001) {
    if (!whooshOn) {
      rig.whoosh.start();
      whooshOn = true;
    }
    whooshQuiet = 0;
    moveTo(rig.whooshBp.frequency, fBp, 380 + 2600 * bell, 0.05, 30);
  } else if (whooshOn) {
    whooshQuiet += dtSec;
    if (whooshQuiet > QUIET_STOP_S) {
      rig.whoosh.stop();
      whooshOn = false;
    }
  }
  moveTo(rig.whooshGain.gain, gW, whooshTarget, 0.04, 0.008);
}

/** Disable path: silence + stop sources (instances kept; restart is cheap). */
export function stopTransitions(): void {
  const r = rig;
  if (!r) return;
  gR.v = 0;
  gW.v = 0;
  r.riserGain.gain.rampTo(0, 0.1);
  r.whooshGain.gain.rampTo(0, 0.1);
  if (riserOn) {
    r.riser.stop();
    riserOn = false;
  }
  if (whooshOn) {
    r.whoosh.stop();
    whooshOn = false;
  }
}
