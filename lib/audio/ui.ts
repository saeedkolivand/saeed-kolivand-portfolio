import type { Filter, FMSynth, Gain, MembraneSynth, Noise, NoiseSynth, Synth } from "tone";
import { useScrollStore } from "@/lib/scrollStore";
import type { ToneModule } from "./types";
import { hash } from "./util";

/**
 * Wave B: UI / diegetic one-shots (event-driven, NOT f(t)). Every trigger
 * here is a genuine user event -- a raycast/DOM click, a keystroke, or a
 * store change (meowCount, jumpCover) -- so none are scrub-fired: there is no
 * BeatRunner hysteresis window to arm, only per-event idempotence (the store
 * subs guard s === prev). All variation is a Knuth hash of an integer index
 * (util hash); no Math.random anywhere. All output rides the sfx bus the
 * director hands us (Compressor -> Limiter master chain), mixed low.
 *
 * GESTURE GATE: the director calls wireUi(T, sfx) only after enableAudio()
 * has unlocked the AudioContext. Until then `mod` is null and every uiSound /
 * meow / catPurr call is a no-op, so scene handlers that fire pre-enable
 * create zero AudioContext and zero output. Post-disable the master out gain
 * is ramped to 0 by the director, so any late trigger is silent. Synths are
 * pooled: built once, lazily, on the first real trigger; never per event.
 */

export type UiKind =
  | "cmdOk"
  | "cmdErr"
  | "linkPress"
  | "ctaPress"
  | "openTab"
  | "key"
  | "keyBack"
  | "keyEsc"
  | "toggleOn"
  | "toggleOff";

interface Mod {
  T: ToneModule;
  sfx: Gain;
}

interface Pool {
  uiBeep: Synth;
  uiBuzz: FMSynth;
  uiBuzzLp: Filter;
  uiTick: Synth;
  uiThud: MembraneSynth;
  uiNoise: NoiseSynth;
  uiNoiseBp: Filter;
  swishNoise: Noise;
  swishBp: Filter;
  swishGain: Gain;
  meowSynth: FMSynth;
}

let mod: Mod | null = null;
let pool: Pool | null = null;
let subscribed = false;

/** Build the pooled synths once (lazy, on first real trigger). */
function ensure(): Pool | null {
  const m = mod;
  if (!m) return null;
  if (pool) return pool;
  const { T, sfx } = m;

  const uiBeep = new T.Synth({
    oscillator: { type: "triangle" },
    envelope: { attack: 0.002, decay: 0.06, sustain: 0, release: 0.05 },
    volume: -15,
  }).connect(sfx);

  const uiBuzz = new T.FMSynth({
    harmonicity: 1,
    modulationIndex: 12,
    envelope: { attack: 0.002, decay: 0.14, sustain: 0, release: 0.02 },
    volume: -14,
  });
  const uiBuzzLp = new T.Filter(800, "lowpass");
  uiBuzz.chain(uiBuzzLp, sfx);

  const uiTick = new T.Synth({
    oscillator: { type: "square" },
    envelope: { attack: 0.001, decay: 0.012, sustain: 0, release: 0.008 },
    volume: -20,
  }).connect(sfx);

  const uiThud = new T.MembraneSynth({
    pitchDecay: 0.05,
    octaves: 4,
    envelope: { attack: 0.002, decay: 0.2, sustain: 0, release: 0.08 },
    volume: -10,
  }).connect(sfx);

  const uiNoise = new T.NoiseSynth({
    noise: { type: "pink" },
    envelope: { attack: 0.001, decay: 0.03, sustain: 0 },
    volume: -12,
  });
  const uiNoiseBp = new T.Filter(1200, "bandpass");
  uiNoise.chain(uiNoiseBp, sfx);

  // swish: one continuous noise gated by its own gain envelope (no per-event
  // source alloc; two swishes never realistically overlap, and a fresh
  // cancelScheduledValues re-arms cleanly if they do).
  const swishNoise = new T.Noise({ type: "pink", volume: -14 });
  const swishBp = new T.Filter(600, "bandpass");
  const swishGain = new T.Gain(0);
  swishNoise.chain(swishBp, swishGain, sfx);
  swishNoise.start();

  const meowSynth = new T.FMSynth({
    harmonicity: 1.5,
    modulationIndex: 4,
    envelope: { attack: 0.03, decay: 0.2, sustain: 0.5, release: 0.12 },
    modulationEnvelope: { attack: 0.05, decay: 0.2, sustain: 0.3, release: 0.1 },
    volume: -12,
  }).connect(sfx);

  pool = {
    uiBeep,
    uiBuzz,
    uiBuzzLp,
    uiTick,
    uiThud,
    uiNoise,
    uiNoiseBp,
    swishNoise,
    swishBp,
    swishGain,
    meowSynth,
  };
  return pool;
}

/** Fire the shared swish: sweep the bandpass startF -> endF over dur, auto-stop. */
function swish(p: Pool, m: Mod, startF: number, endF: number, dur: number): void {
  const now = m.T.now();
  const g = p.swishGain.gain;
  g.cancelScheduledValues(now);
  g.setValueAtTime(0, now);
  g.linearRampToValueAtTime(1, now + 0.02);
  g.linearRampToValueAtTime(0, now + dur);
  const f = p.swishBp.frequency;
  f.cancelScheduledValues(now);
  f.setValueAtTime(startF, now);
  f.exponentialRampToValueAtTime(endF, now + dur);
}

/** Event-driven UI one-shots from scene handlers / the director. */
export function uiSound(kind: UiKind, seed = 0): void {
  const m = mod;
  if (!m) return;
  const p = ensure();
  if (!p) return;
  const now = m.T.now();
  switch (kind) {
    case "cmdOk": {
      // two-note retro ACK; per-command pitch identity within +/- 100 cents
      const f0 = 660 * Math.pow(2, ((seed % 201) - 100) / 1200);
      p.uiBeep.triggerAttackRelease(f0, 0.045, now, 0.7);
      p.uiBeep.triggerAttackRelease(f0 * 1.5, 0.05, now + 0.05, 0.7);
      break;
    }
    case "cmdErr": {
      // gritty descending bzzt through the fixed 800 Hz lowpass
      p.uiBuzz.triggerAttack(200, now, 0.9);
      p.uiBuzz.frequency.rampTo(150, 0.13, now);
      p.uiBuzz.triggerRelease(now + 0.14);
      break;
    }
    case "linkPress": {
      // ka-chunk (thud) + paper snap (noise) + page opening (rising beeps)
      p.uiThud.triggerAttackRelease("A1", 0.08, now, 0.8);
      p.uiNoise.triggerAttackRelease(0.03, now, 0.5);
      p.uiBeep.triggerAttackRelease(700, 0.05, now, 0.7);
      p.uiBeep.triggerAttackRelease(1050, 0.05, now + 0.055, 0.7);
      break;
    }
    case "ctaPress": {
      // heavier manufactured press + a downward swish hinting the scroll
      p.uiThud.triggerAttackRelease("F1", 0.1, now, 0.9);
      p.uiNoise.triggerAttackRelease(0.03, now, 0.5);
      swish(p, m, 1100, 450, 0.18);
      break;
    }
    case "openTab": {
      // bright rising open blip + a hair of tab detent; per-row pitch step
      const top = 1320 * (1 + 0.03 * seed);
      p.uiBeep.triggerAttack(880, now, 0.7);
      p.uiBeep.frequency.rampTo(top, 0.07, now);
      p.uiBeep.triggerRelease(now + 0.08);
      p.uiThud.triggerAttackRelease("C2", 0.05, now, 0.55);
      break;
    }
    case "key": {
      // organic mechanical click; deterministic per-position jitter
      p.uiTick.triggerAttackRelease(1400 + (hash(seed) % 120), 0.008, now, 0.6);
      break;
    }
    case "keyBack": {
      p.uiTick.triggerAttackRelease(900, 0.01, now, 0.4);
      break;
    }
    case "keyEsc": {
      // three quick descending ticks = "cleared"
      p.uiTick.triggerAttackRelease(1200, 0.008, now, 0.5);
      p.uiTick.triggerAttackRelease(900, 0.008, now + 0.03, 0.5);
      p.uiTick.triggerAttackRelease(650, 0.008, now + 0.06, 0.5);
      break;
    }
    case "toggleOn": {
      // D5 -> A5 print-press chime; first thing the user hears
      p.uiBeep.triggerAttackRelease(587.33, 0.05, now, 0.75);
      p.uiBeep.triggerAttackRelease(880, 0.05, now + 0.05, 0.75);
      break;
    }
    case "toggleOff": {
      // A5 -> D5 descending, softer
      p.uiBeep.triggerAttackRelease(880, 0.05, now, 0.55);
      p.uiBeep.triggerAttackRelease(587.33, 0.05, now + 0.05, 0.55);
      break;
    }
  }
}

/** Cat contours: 4 deterministic families selected by hash(count). */
export function meow(count: number): void {
  const m = mod;
  if (!m) return;
  const p = ensure();
  if (!p) return;
  const h = hash(count);
  const fam = (h >>> 16) % 4;
  if (fam === 3) {
    catPurr();
    return;
  }
  const now = m.T.now();
  const s = p.meowSynth;
  const base = 480 + (h % 200);
  s.harmonicity.value = 1.3 + fam * 0.13;
  if (fam === 2) {
    // CHIRP: single short pop, low modIndex, no dip
    s.modulationIndex.value = 2;
    s.triggerAttackRelease(600 + (h % 120), 0.16, now, 0.8);
    return;
  }
  s.modulationIndex.value = 4;
  s.triggerAttack(base, now, 0.8);
  if (fam === 1) {
    // QUESTION: end freq ramps up, tail rises a touch more
    const top = base * 1.4;
    s.frequency.rampTo(top, 0.24, now + 0.02);
    s.frequency.rampTo(top * 1.06, 0.08, now + 0.26);
    s.triggerRelease(now + 0.36);
  } else {
    // 0 ME-OW: dip up to the peak then back down
    s.frequency.rampTo(base * 1.32, 0.1, now + 0.02);
    s.frequency.rampTo(base * 0.82, 0.2, now + 0.14);
    s.triggerRelease(now + 0.38);
  }
}

/** TRILL / PURR contour -- the purr flavor without hover (meow family 3). */
export function catPurr(): void {
  const m = mod;
  if (!m) return;
  const p = ensure();
  if (!p) return;
  const now = m.T.now();
  const s = p.meowSynth;
  const base = 300;
  s.harmonicity.value = 1.6;
  s.modulationIndex.value = 4;
  s.modulationIndex.rampTo(8, 0.3, now);
  s.triggerAttack(base, now, 0.7);
  // two fast +/- 8% wobbles at ~18 Hz, then settle
  s.frequency.rampTo(base * 1.08, 0.028, now);
  s.frequency.rampTo(base * 0.92, 0.028, now + 0.028);
  s.frequency.rampTo(base * 1.08, 0.028, now + 0.056);
  s.frequency.rampTo(base * 0.92, 0.028, now + 0.084);
  s.frequency.rampTo(base, 0.16, now + 0.112);
  s.triggerRelease(now + 0.42);
}

/**
 * Director hands us (T, sfx) here, once, post-enable. Owns the meow-variety
 * and jump-land store subscriptions (director drops its inline meow closure).
 * Subscriptions attach once and survive disable; they inherit the gesture
 * gate because meow / uiSound / swish all early-return while `mod` is null,
 * and are silent post-disable via the director's out-gain ramp.
 */
export function wireUi(T: ToneModule, sfx: Gain): void {
  mod = { T, sfx };
  if (subscribed) return;
  subscribed = true;

  // meow-variety: every cat onClick already bumps meowCount
  useScrollStore.subscribe((s, prev) => {
    if (s.meowCount === prev.meowCount) return;
    meow(s.meowCount);
  });

  // jump-land: null -> N page-flip whoosh; N -> null soft landing. Guarded so
  // it is idempotent per transition and deep-jump safe.
  useScrollStore.subscribe((s, prev) => {
    if (s.jumpCover === prev.jumpCover) return;
    const m = mod;
    if (!m) return;
    if (prev.jumpCover === null && s.jumpCover !== null) {
      const p = ensure();
      if (p) swish(p, m, 300, 1800, 0.18);
    } else if (prev.jumpCover !== null && s.jumpCover === null) {
      const p = ensure();
      if (p) p.uiThud.triggerAttackRelease("C2", 0.12, m.T.now(), 0.7);
    }
  });
}
