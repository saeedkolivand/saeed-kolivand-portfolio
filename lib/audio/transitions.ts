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
 *
 * Phase 4 enrichment: 8 more gutter voices + 1 global page-riffle complete
 * all 11 gutters. Each new voice is a pooled Noise/Osc/Filter/Gain built once,
 * driven pure f(t[,velocity]) via moveTo(), and quiet-stopped when idle like
 * the whoosh. Percussive accents (crash punch-through, stamp metal contact,
 * tear flap, dot-match resolve) fire once on a forward gutter-progress
 * crossing with hysteresis re-arm (BeatRunner idiom) -- idempotent both
 * directions and deep-jump safe (a single fire, never a catch-up burst).
 */

const DOT_ZOOM: readonly [number, number] = [RANGES[2]![1], RANGES[3]![0]];
const WHIPS: readonly (readonly [number, number])[] = [
  [RANGES[1]![1], RANGES[2]![0]], // noir -> desk title whip
  [RANGES[8]![1], RANGES[9]![0]], // pop -> sketchbook whip
];

/** Sources idle this long at zero gain before they are stopped. */
const QUIET_STOP_S = 0.3;

// ---- new-voice shared helpers -------------------------------------------

/** Anything with start()/stop() -- Tone sources (Noise/Oscillator/LFO). */
type Src = { start(): void; stop(): void };
interface Gate {
  on: boolean;
  quiet: number;
}
interface Cross {
  init: boolean;
  armed: boolean;
  last: number;
}
interface Voice {
  update(t: number, dtSec: number, velocity: number): void;
  stop(): void;
}

const bell = (p: number): number => Math.sin(Math.PI * p);
const tri = (p: number, c: number, w: number): number => clamp01(1 - Math.abs(p - c) / w);
/** Gutter i->j window = [range i end, range j start] (never hardcoded). */
const win = (a: number, b: number): readonly [number, number] => [RANGES[a]![1], RANGES[b]![0]];

/** whoosh-style start/quiet-stop for a group of pooled sources (no alloc). */
function runGate(g: Gate, active: boolean, dt: number, srcs: readonly Src[]): void {
  if (active) {
    if (!g.on) {
      for (const s of srcs) s.start();
      g.on = true;
    }
    g.quiet = 0;
  } else if (g.on) {
    g.quiet += dt;
    if (g.quiet > QUIET_STOP_S) {
      for (const s of srcs) s.stop();
      g.on = false;
    }
  }
}

/**
 * BeatRunner hysteresis as pure module state: true once, on a forward cross
 * of `trig`; re-arms only after `value` retreats below trig - hyst. First
 * sighting primes without firing (no retroactive hit on a mid-page load);
 * a deep jump across the trigger fires exactly once (no catch-up burst).
 */
function crossFwd(c: Cross, value: number, trig: number, hyst: number): boolean {
  if (!c.init) {
    c.init = true;
    c.armed = value < trig;
    c.last = value;
    return false;
  }
  const last = c.last;
  c.last = value;
  if (c.armed && last < trig && value >= trig) {
    c.armed = false;
    return true;
  }
  if (!c.armed && value < trig - hyst) c.armed = true;
  return false;
}

// ---- gutter windows ------------------------------------------------------

const CRASH = win(0, 1); // 0->1 cover crash-through (+ absorbed crash-tear)
const PWIPE = win(3, 4); // 3->4 panel-wipe swish
const PORTAL = win(4, 5); // 4->5 panel-portal glide
const STAMP = win(5, 6); // 5->6 stamp cut
const TEAR = win(6, 7); // 6->7 paper-tear
const FLIP = win(7, 8); // 7->8 page-flip world-turn
const INK = win(9, 10); // 9->10 ink-flood to black
const DOTM = win(10, 11); // 10->11 dot-match twinkle-zip

// ---- new gutter voices ---------------------------------------------------

/** 0->1 crash-through-cover: paper burst + punch body + membrane/chirp hit. */
function buildCrash(T: ToneModule, sfx: Gain): Voice {
  const w = CRASH;
  const burst = new T.Noise("white");
  const burstBp = new T.Filter(900, "bandpass");
  burstBp.Q.value = 1.2;
  const burstGain = new T.Gain(0);
  burst.chain(burstBp, burstGain, sfx);
  const body = new T.Oscillator({ frequency: 140, type: "sine", volume: -6 });
  const bodyLp = new T.Filter(200, "lowpass");
  const bodyGain = new T.Gain(0);
  body.chain(bodyLp, bodyGain, sfx);
  const crash = new T.MembraneSynth({
    pitchDecay: 0.1,
    octaves: 4,
    envelope: { attack: 0.002, decay: 0.3, sustain: 0, release: 0.1 },
    volume: -9,
  });
  crash.connect(sfx);
  const chirp = new T.Synth({
    oscillator: { type: "square" },
    envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.05 },
    volume: -14,
  });
  chirp.connect(sfx);
  const g: Gate = { on: false, quiet: 0 };
  const srcs: Src[] = [burst, body];
  const cx: Cross = { init: false, armed: true, last: 0 };
  const gB = { v: 0 };
  const gY = { v: 0 };
  const fB = { v: 900 };
  const fY = { v: 140 };
  return {
    update(t, dt, velocity) {
      const p = clamp01((t - w[0]) / (w[1] - w[0]));
      const inw = t > w[0] && t < w[1];
      const av = Math.min(Math.abs(velocity), 1);
      const bt = tri(p, 0.4, 0.35);
      const burstT = inw ? Math.min(tri(p, 0.3, 0.3) * tri(p, 0.3, 0.3) * av, 0.5) : 0;
      const bodyT = inw ? Math.min(bt * bt * (0.4 + 0.6 * av), 0.4) : 0;
      runGate(g, burstT > 0.001 || bodyT > 0.001, dt, srcs);
      moveTo(burstBp.frequency, fB, 900 + 1700 * p, 0.05, 20);
      moveTo(body.frequency, fY, 140 - 80 * p, 0.05, 1);
      moveTo(burstGain.gain, gB, burstT, 0.04, 0.008);
      moveTo(bodyGain.gain, gY, bodyT, 0.04, 0.008);
      if (crossFwd(cx, p, 0.3, 0.1) && av > 0.05) {
        const now = T.now();
        crash.triggerAttackRelease("C1", 0.3, now, 0.5 * av);
        chirp.triggerAttackRelease(300, 0.18, now, 0.5 * av);
        chirp.frequency.rampTo(80, 0.18, now);
      }
    },
    stop() {
      gB.v = 0;
      gY.v = 0;
      burstGain.gain.rampTo(0, 0.1);
      bodyGain.gain.rampTo(0, 0.1);
      if (g.on) {
        for (const s of srcs) s.stop();
        g.on = false;
      }
    },
  };
}

/** 3->4 panel-wipe: crisp high bandpass swipe, bell x |velocity|. */
function buildPanelWipe(T: ToneModule, sfx: Gain): Voice {
  const w = PWIPE;
  const noise = new T.Noise("white");
  const bp = new T.Filter(1500, "bandpass");
  bp.Q.value = 2.5;
  const gain = new T.Gain(0);
  noise.chain(bp, gain, sfx);
  const g: Gate = { on: false, quiet: 0 };
  const srcs: Src[] = [noise];
  const gC = { v: 0 };
  const fC = { v: 1500 };
  return {
    update(t, dt, velocity) {
      const p = clamp01((t - w[0]) / (w[1] - w[0]));
      const inw = t > w[0] && t < w[1];
      const av = Math.min(Math.abs(velocity), 1);
      const target = inw ? Math.min(bell(p) * av, 0.35) : 0;
      runGate(g, target > 0.001, dt, srcs);
      moveTo(bp.frequency, fC, 1500 + 2500 * p, 0.05, 25);
      moveTo(gain.gain, gC, target, 0.04, 0.008);
    },
    stop() {
      gC.v = 0;
      gain.gain.rampTo(0, 0.1);
      if (g.on) {
        noise.stop();
        g.on = false;
      }
    },
  };
}

/** 4->5 panel-portal: ethereal glide tone + air through a delay tail (no vel gate). */
function buildPortal(T: ToneModule, sfx: Gain): Voice {
  const w = PORTAL;
  const delay = new T.FeedbackDelay(0.2, 0.25);
  delay.wet.value = 0.25;
  delay.connect(sfx);
  const glide = new T.Oscillator({ frequency: 300, type: "sine", volume: -8 });
  const glideLp = new T.Filter(600, "lowpass");
  const glideGain = new T.Gain(0);
  glide.chain(glideLp, glideGain, delay);
  const air = new T.Noise("pink");
  const airBp = new T.Filter(2000, "bandpass");
  const airGain = new T.Gain(0);
  air.chain(airBp, airGain, delay);
  const g: Gate = { on: false, quiet: 0 };
  const srcs: Src[] = [glide, air];
  const gG = { v: 0 };
  const gA = { v: 0 };
  const fG = { v: 300 };
  const fL = { v: 600 };
  return {
    update(t, dt) {
      const p = clamp01((t - w[0]) / (w[1] - w[0]));
      const inw = t > w[0] && t < w[1];
      const b = bell(p);
      const gT = inw ? Math.pow(b, 0.8) * 0.3 : 0;
      const aT = inw ? b * 0.12 : 0;
      runGate(g, gT > 0.001 || aT > 0.001, dt, srcs);
      moveTo(glide.frequency, fG, 300 + 600 * p, 0.05, 5);
      moveTo(glideLp.frequency, fL, 600 + 2400 * p, 0.06, 25);
      moveTo(glideGain.gain, gG, gT, 0.05, 0.008);
      moveTo(airGain.gain, gA, aT, 0.05, 0.008);
    },
    stop() {
      gG.v = 0;
      gA.v = 0;
      glideGain.gain.rampTo(0, 0.1);
      airGain.gain.rampTo(0, 0.1);
      if (g.on) {
        for (const s of srcs) s.stop();
        g.on = false;
      }
    },
  };
}

/** 5->6 stamp cut: ka-chunk body + metal-contact transient + pneumatic hiss. */
function buildStamp(T: ToneModule, sfx: Gain): Voice {
  const w = STAMP;
  const chunk = new T.Oscillator({ frequency: 220, type: "square", volume: -8 });
  const chunkBp = new T.Filter(800, "bandpass");
  chunkBp.Q.value = 2;
  const chunkGain = new T.Gain(0);
  chunk.chain(chunkBp, chunkGain, sfx);
  const metal = new T.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.02, sustain: 0 },
    volume: -8,
  });
  metal.connect(sfx);
  const air = new T.Noise("white");
  const airHp = new T.Filter(3000, "highpass");
  const airGain = new T.Gain(0);
  air.chain(airHp, airGain, sfx);
  const g: Gate = { on: false, quiet: 0 };
  const srcs: Src[] = [chunk, air];
  const cx: Cross = { init: false, armed: true, last: 0 };
  const gC = { v: 0 };
  const gA = { v: 0 };
  const fC = { v: 220 };
  return {
    update(t, dt, velocity) {
      const p = clamp01((t - w[0]) / (w[1] - w[0]));
      const inw = t > w[0] && t < w[1];
      const av = Math.min(Math.abs(velocity), 1);
      const ct = tri(p, 0.32, 0.28);
      const chunkT = inw ? Math.min(Math.pow(ct, 4) * av, 0.5) : 0;
      const airT = inw ? clamp01((p - 0.4) / 0.6) * 0.25 : 0; // not vel-gated: hiss lingers
      runGate(g, chunkT > 0.001 || airT > 0.001, dt, srcs);
      moveTo(chunk.frequency, fC, 220 - 70 * p, 0.05, 2);
      moveTo(chunkGain.gain, gC, chunkT, 0.03, 0.008);
      moveTo(airGain.gain, gA, airT, 0.05, 0.008);
      if (crossFwd(cx, p, 0.32, 0.1) && av > 0.05)
        metal.triggerAttackRelease(0.01, T.now(), 0.5 * av);
    },
    stop() {
      gC.v = 0;
      gA.v = 0;
      chunkGain.gain.rampTo(0, 0.1);
      airGain.gain.rampTo(0, 0.1);
      if (g.on) {
        for (const s of srcs) s.stop();
        g.on = false;
      }
    },
  };
}

/** 6->7 paper-tear: rising bandpass tear line (ripple texture) + late flap. */
function buildTear(T: ToneModule, sfx: Gain): Voice {
  const w = TEAR;
  const noise = new T.Noise("pink");
  const bp = new T.Filter(1200, "bandpass");
  bp.Q.value = 1;
  const gain = new T.Gain(0);
  noise.chain(bp, gain, sfx);
  const flap = new T.NoiseSynth({
    noise: { type: "brown" },
    envelope: { attack: 0.002, decay: 0.12, sustain: 0 },
    volume: -8,
  });
  const flapLp = new T.Filter(300, "lowpass");
  flap.chain(flapLp, sfx);
  const g: Gate = { on: false, quiet: 0 };
  const srcs: Src[] = [noise];
  const cx: Cross = { init: false, armed: true, last: 0 };
  const gC = { v: 0 };
  const fC = { v: 1200 };
  const fQ = { v: 1 };
  return {
    update(t, dt, velocity) {
      const p = clamp01((t - w[0]) / (w[1] - w[0]));
      const inw = t > w[0] && t < w[1];
      const av = Math.min(Math.abs(velocity), 1);
      // sin ripple is amplitude texture (depth 0.4, well under strobe threshold)
      const ripple = 0.6 + 0.4 * Math.abs(Math.sin(40 * Math.PI * p));
      const target = inw ? Math.min(Math.pow(p, 0.6) * ripple * av, 0.45) : 0;
      runGate(g, target > 0.001, dt, srcs);
      moveTo(bp.frequency, fC, 1200 + 2300 * p, 0.05, 25);
      moveTo(bp.Q, fQ, 1 + 2 * p, 0.08, 0.05);
      moveTo(gain.gain, gC, target, 0.04, 0.008);
      if (crossFwd(cx, p, 0.85, 0.08) && av > 0.05)
        flap.triggerAttackRelease(0.14, T.now(), 0.4 * av);
    },
    stop() {
      gC.v = 0;
      gain.gain.rampTo(0, 0.1);
      if (g.on) {
        noise.stop();
        g.on = false;
      }
    },
  };
}

/** 7->8 page-flip: early flutter flap (page catching air) + late whoosh tail. */
function buildFlip(T: ToneModule, sfx: Gain): Voice {
  const w = FLIP;
  const noise = new T.Noise("pink");
  const flapBp = new T.Filter(700, "bandpass");
  const flapGain = new T.Gain(0);
  noise.chain(flapBp, flapGain, sfx);
  const whBp = new T.Filter(400, "bandpass");
  const whGain = new T.Gain(0);
  noise.connect(whBp);
  whBp.connect(whGain);
  whGain.connect(sfx);
  const g: Gate = { on: false, quiet: 0 };
  const srcs: Src[] = [noise];
  const gF = { v: 0 };
  const gW = { v: 0 };
  const fW = { v: 400 };
  return {
    update(t, dt, velocity) {
      const p = clamp01((t - w[0]) / (w[1] - w[0]));
      const inw = t > w[0] && t < w[1];
      const av = Math.min(Math.abs(velocity), 1);
      const flapT = inw ? Math.min(tri(p, 0.28, 0.22) * (0.7 + 0.3 * Math.sin(12 * Math.PI * p)), 0.4) : 0;
      const whT = inw ? Math.min(bell(p) * (0.3 + 0.7 * p) * av, 0.4) : 0;
      runGate(g, flapT > 0.001 || whT > 0.001, dt, srcs);
      moveTo(whBp.frequency, fW, 400 + 2000 * p, 0.05, 25);
      moveTo(flapGain.gain, gF, flapT, 0.04, 0.008);
      moveTo(whGain.gain, gW, whT, 0.04, 0.008);
    },
    stop() {
      gF.v = 0;
      gW.v = 0;
      flapGain.gain.rampTo(0, 0.1);
      whGain.gain.rampTo(0, 0.1);
      if (g.on) {
        noise.stop();
        g.on = false;
      }
    },
  };
}

/** 9->10 ink-flood: sub swell + dark liquid gulp, resolves to true silence (no vel gate). */
function buildInk(T: ToneModule, sfx: Gain): Voice {
  const w = INK;
  const sub = new T.Oscillator({ frequency: 50, type: "sine", volume: -6 });
  const subLp = new T.Filter(400, "lowpass");
  const subGain = new T.Gain(0);
  sub.chain(subLp, subGain, sfx);
  const gulp = new T.Noise("brown");
  const gulpLp = new T.Filter(300, "lowpass");
  const gulpGain = new T.Gain(0);
  gulp.chain(gulpLp, gulpGain, sfx);
  const g: Gate = { on: false, quiet: 0 };
  const srcs: Src[] = [sub, gulp];
  const gS = { v: 0 };
  const gGl = { v: 0 };
  const fS = { v: 400 };
  const fGl = { v: 300 };
  return {
    update(t, dt) {
      const p = clamp01((t - w[0]) / (w[1] - w[0]));
      const inw = t > w[0] && t < w[1];
      const swell = inw ? Math.min(clamp01(p / 0.65), clamp01((1 - p) / 0.35)) : 0;
      runGate(g, swell > 0.001, dt, srcs);
      moveTo(subLp.frequency, fS, 400 - 310 * p, 0.06, 15); // muffling into black
      moveTo(gulpLp.frequency, fGl, 300 - 220 * p, 0.06, 10);
      moveTo(subGain.gain, gS, swell * 0.4, 0.06, 0.008);
      moveTo(gulpGain.gain, gGl, swell * 0.3, 0.06, 0.008);
    },
    stop() {
      gS.v = 0;
      gGl.v = 0;
      subGain.gain.rampTo(0, 0.1);
      gulpGain.gain.rampTo(0, 0.1);
      if (g.on) {
        for (const s of srcs) s.stop();
        g.on = false;
      }
    },
  };
}

/** 10->11 dot-match: twinkle partials (9Hz shimmer) + zip, resolving to a cursor sine. */
function buildDotMatch(T: ToneModule, sfx: Gain): Voice {
  const w = DOTM;
  const pa = new T.Oscillator({ frequency: 400, type: "sine", volume: -12 });
  const pb = new T.Oscillator({ frequency: 600, type: "sine", volume: -12 });
  const twBp = new T.Filter(800, "bandpass");
  const shim = new T.Gain(0); // 9Hz shimmer, LFO-driven (base 0 + LFO = [0.65, 1])
  const twGain = new T.Gain(0); // bell envelope
  const shimLfo = new T.LFO(9, 0.65, 1);
  pa.connect(twBp);
  pb.connect(twBp);
  twBp.chain(shim, twGain, sfx);
  shimLfo.connect(shim.gain);
  const zip = new T.Noise("white");
  const zipHp = new T.Filter(2000, "highpass");
  const zipGain = new T.Gain(0);
  zip.chain(zipHp, zipGain, sfx);
  const resolve = new T.Synth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.005, decay: 0.15, sustain: 0, release: 0.05 },
    volume: -14,
  });
  resolve.connect(sfx);
  const g: Gate = { on: false, quiet: 0 };
  const srcs: Src[] = [pa, pb, zip, shimLfo];
  const cx: Cross = { init: false, armed: true, last: 0 };
  const gT = { v: 0 };
  const gZ = { v: 0 };
  const fA = { v: 400 };
  const fBb = { v: 600 };
  const fT = { v: 800 };
  const fZ = { v: 2000 };
  return {
    update(t, dt, velocity) {
      const p = clamp01((t - w[0]) / (w[1] - w[0]));
      const inw = t > w[0] && t < w[1];
      const av = Math.min(Math.abs(velocity), 1);
      const b = bell(p);
      const twT = inw ? Math.min(b * (0.5 + 0.5 * av) * 0.3, 0.3) : 0;
      const zpT = inw ? b * 0.15 : 0;
      runGate(g, twT > 0.001 || zpT > 0.001, dt, srcs);
      moveTo(pa.frequency, fA, 400 + 1200 * p, 0.05, 8);
      moveTo(pb.frequency, fBb, 600 + 1800 * p, 0.05, 8);
      moveTo(twBp.frequency, fT, 800 + 2200 * p, 0.05, 25);
      moveTo(zipHp.frequency, fZ, 2000 + 4000 * p, 0.05, 40);
      moveTo(twGain.gain, gT, twT, 0.04, 0.008);
      moveTo(zipGain.gain, gZ, zpT, 0.04, 0.008);
      // collapse the twinkle onto a single held ~1600Hz sine = the cursor
      if (crossFwd(cx, p, 0.92, 0.05) && av > 0.03)
        resolve.triggerAttackRelease(1600, 0.15, T.now(), 0.3 * (0.5 + 0.5 * av));
    },
    stop() {
      gT.v = 0;
      gZ.v = 0;
      twGain.gain.rampTo(0, 0.1);
      zipGain.gain.rampTo(0, 0.1);
      if (g.on) {
        for (const s of srcs) s.stop();
        g.on = false;
      }
    },
  };
}

/**
 * Global page-riffle: fast flings / deep-jump momentum fan the pages. Threshold
 * hysteresis (arm > 0.45, re-arm < 0.38) keeps normal reading silent; sits
 * under every per-issue bed; symmetric on back-scrub. Tremolo = one pooled LFO
 * on a gain (depth 0.5 -- a page-fan flutter, never a strobe).
 */
function buildRiffle(T: ToneModule, sfx: Gain): Voice {
  const noise = new T.Noise("pink");
  const bp = new T.Filter(1600, "bandpass");
  const trem = new T.Gain(0); // LFO-driven flutter (base 0 + LFO = [0.5, 1])
  const master = new T.Gain(0); // |velocity| envelope
  const lfo = new T.LFO(10, 0.5, 1);
  noise.chain(bp, trem, master, sfx);
  lfo.connect(trem.gain);
  const g: Gate = { on: false, quiet: 0 };
  const srcs: Src[] = [noise, lfo];
  let armed = false;
  const gM = { v: 0 };
  const fC = { v: 1600 };
  const fR = { v: 10 };
  return {
    update(_t, dt, velocity) {
      const av = Math.abs(velocity);
      if (av > 0.45) armed = true;
      else if (av < 0.38) armed = false;
      const cav = Math.min(av, 1);
      const env = armed ? clamp01((av - 0.45) / 0.4) * 0.3 : 0;
      runGate(g, armed, dt, srcs);
      moveTo(bp.frequency, fC, 1600 + 1600 * cav, 0.08, 25);
      moveTo(lfo.frequency, fR, 10 + 8 * cav, 0.08, 0.2);
      moveTo(master.gain, gM, env, 0.05, 0.008);
    },
    stop() {
      gM.v = 0;
      armed = false;
      master.gain.rampTo(0, 0.1);
      if (g.on) {
        for (const s of srcs) s.stop();
        g.on = false;
      }
    },
  };
}

interface Rig {
  riser: Oscillator;
  riserLp: Filter;
  riserGain: Gain;
  whoosh: Noise;
  whooshBp: Filter;
  whooshGain: Gain;
  voices: Voice[];
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
  const voices: Voice[] = [
    buildCrash(T, sfx),
    buildPanelWipe(T, sfx),
    buildPortal(T, sfx),
    buildStamp(T, sfx),
    buildTear(T, sfx),
    buildFlip(T, sfx),
    buildInk(T, sfx),
    buildDotMatch(T, sfx),
    buildRiffle(T, sfx),
  ];
  return { riser, riserLp, riserGain, whoosh, whooshBp, whooshGain, voices };
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
  let bellW = 0;
  for (let i = 0; i < WHIPS.length; i++) {
    const w = WHIPS[i]!;
    if (t > w[0] && t < w[1]) {
      bellW = Math.sin(Math.PI * clamp01((t - w[0]) / (w[1] - w[0])));
      break;
    }
  }
  const whooshTarget = bellW * Math.min(Math.abs(velocity), 1) * 0.55;
  if (whooshTarget > 0.001) {
    if (!whooshOn) {
      rig.whoosh.start();
      whooshOn = true;
    }
    whooshQuiet = 0;
    moveTo(rig.whooshBp.frequency, fBp, 380 + 2600 * bellW, 0.05, 30);
  } else if (whooshOn) {
    whooshQuiet += dtSec;
    if (whooshQuiet > QUIET_STOP_S) {
      rig.whoosh.stop();
      whooshOn = false;
    }
  }
  moveTo(rig.whooshGain.gain, gW, whooshTarget, 0.04, 0.008);

  // 8 new gutter voices + the global page-riffle, each pure f(t[,velocity])
  for (const v of rig.voices) v.update(t, dtSec, velocity);
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
  for (const v of r.voices) v.stop();
}
