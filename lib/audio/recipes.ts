import type { ToneAudioNode } from "tone";
import { audioRecipes, type AudioRecipe, type ToneModule } from "./types";
import { h01, hash, moveTo, Stepper } from "./util";

/**
 * Wave B: the 12 per-issue ambiences (audioRecipes slots, indexed like
 * issues/registry.ts). Imported for side effect by the director. Rules:
 * - Tone only via the T module handed to build() (never a static import)
 * - all timing/pattern variation hashes an integer step of T.now() -- no
 *   Math.random anywhere; patterns survive stop()/start() cleanly
 * - param moves via moveTo() (rampTo on real target changes only)
 * - one-shots via triggerAttackRelease at T.now()
 * - these are AMBIENCES: out gains sit far below the master ceiling
 * - 3-8 nodes per recipe; no allocations inside update()
 */

interface Built {
  out: ToneAudioNode;
  nodes: { dispose(): void }[];
  start?: () => void;
  stop?: () => void;
  update?: (tLocal: number, dtSec: number, velocity: number) => void;
}

function defineRecipe(build: (T: ToneModule) => Built): AudioRecipe {
  let b: Built | null = null;
  return {
    build(T) {
      b = build(T);
      return b.out;
    },
    start() {
      b?.start?.();
    },
    stop() {
      b?.stop?.();
    },
    update(tLocal, dtSec, velocity) {
      b?.update?.(tLocal, dtSec, velocity);
    },
    dispose() {
      if (!b) return;
      for (const n of b.nodes) n.dispose();
      b = null;
    },
  };
}

/* ---- 0 Cover: soft print-shop room tone, near-silent (ruling) ----------- */
audioRecipes[0] = defineRecipe((T) => {
  const noise = new T.Noise("brown");
  const lp = new T.Filter(260, "lowpass");
  const out = new T.Gain(0.05);
  noise.chain(lp, out);
  return {
    out,
    nodes: [noise, lp, out],
    start: () => noise.start(),
    stop: () => noise.stop(),
  };
});

/* ---- 1 Noir: vinyl crackle + distant brushed drums ----------------------- */
audioRecipes[1] = defineRecipe((T) => {
  const out = new T.Gain(0.2);
  const crackle = new T.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.03, sustain: 0 },
    volume: -14,
  });
  const crackleHp = new T.Filter(2000, "highpass");
  crackle.chain(crackleHp, out);
  const brush = new T.Noise("pink");
  const brushLp = new T.Filter(480, "lowpass");
  const swell = new T.Gain(0.1);
  brush.chain(brushLp, swell, out);
  // harmonic bed: two fat-saw sub voices through a shared lowpass that breathes
  // on the same hashed bar clock as the swell (moveTo; no per-frame alloc)
  const droneLp = new T.Filter(300, "lowpass");
  droneLp.connect(out);
  const droneA = new T.FatOscillator("A1", "sawtooth", 20);
  const droneB = new T.FatOscillator("E2", "sawtooth", 20);
  droneA.volume.value = -26;
  droneB.volume.value = -26;
  droneA.connect(droneLp);
  droneB.connect(droneLp);
  const ticks = new Stepper(9);
  const bars = new Stepper(0.6);
  const sw = { v: 0.1 };
  const dfc = { v: 300 };
  return {
    out,
    nodes: [crackle, crackleHp, brush, brushLp, swell, droneLp, droneA, droneB, out],
    start: () => {
      ticks.reset();
      bars.reset();
      brush.start();
      droneA.start();
      droneB.start();
    },
    stop: () => {
      brush.stop();
      droneA.stop();
      droneB.stop();
    },
    update: () => {
      const now = T.now();
      const s = ticks.tick(now);
      if (s >= 0 && h01(s * 3 + 1) < 0.24)
        crackle.triggerAttackRelease(0.02, now, 0.25 + 0.5 * h01(s * 7 + 2));
      const b = bars.tick(now);
      // slow brushed swells + a slow drone-filter breathe, both hashed per bar
      if (b >= 0) {
        moveTo(swell.gain, sw, hash(b) % 4 === 0 ? 0.08 : 0.35 + 0.35 * h01(b * 5 + 3), 1.1, 0.01);
        moveTo(droneLp.frequency, dfc, 220 + 220 * h01(b * 7 + 11), 2.5, 8);
      }
    },
  };
});

/* ---- 2 Desk: warm room tone + mechanical key switches -------------------- */
audioRecipes[2] = defineRecipe((T) => {
  const out = new T.Gain(0.16);
  const room = new T.Noise({ type: "brown", volume: -10 });
  const roomLp = new T.Filter(420, "lowpass");
  room.chain(roomLp, out);
  const key = new T.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.02, sustain: 0 },
    volume: -10,
  });
  const keyBp = new T.Filter(3400, "bandpass");
  key.chain(keyBp, out);
  const clock = new Stepper(9);
  return {
    out,
    nodes: [room, roomLp, key, keyBp, out],
    start: () => {
      clock.reset();
      room.start();
    },
    stop: () => room.stop(),
    update: () => {
      const now = T.now();
      const s = clock.tick(now);
      if (s < 0) return;
      // typing comes in hash-gated bursts (~2.7 s windows), not a metronome
      const typing = h01(Math.floor(s / 24) * 11 + 5) < 0.55;
      if (typing && h01(s * 13 + 1) < 0.55)
        key.triggerAttackRelease(0.012, now, 0.2 + 0.4 * h01(s + 3));
    },
  };
});

/* ---- 3 Neon: stuttering glitch synth (sound only) ------------------------ */
const NEON_NOTES = [110, 146.83, 220, 293.66, 440];
audioRecipes[3] = defineRecipe((T) => {
  const out = new T.Gain(0.13);
  const synth = new T.Synth({
    oscillator: { type: "fatsquare", count: 2, spread: 12 },
    envelope: { attack: 0.002, decay: 0.07, sustain: 0, release: 0.03 },
    volume: -12,
  });
  const lp = new T.Filter(2200, "lowpass");
  synth.chain(lp, out);
  // harmonic bed: fat-saw drone whose lowpass cutoff rides tLocal (same pure
  // f(t) idiom as the glitch filter above -- scrub-safe both directions)
  const droneLp = new T.Filter(200, "lowpass");
  droneLp.connect(out);
  const droneA = new T.FatOscillator("A1", "sawtooth", 18);
  const droneB = new T.FatOscillator("A2", "sawtooth", 18);
  droneA.volume.value = -24;
  droneB.volume.value = -24;
  droneA.connect(droneLp);
  droneB.connect(droneLp);
  const clock = new Stepper(8);
  const fc = { v: 2200 };
  const dfc = { v: 200 };
  return {
    out,
    nodes: [synth, lp, droneA, droneB, droneLp, out],
    start: () => {
      clock.reset();
      droneA.start();
      droneB.start();
    },
    stop: () => {
      droneA.stop();
      droneB.stop();
    },
    update: (tLocal) => {
      const now = T.now();
      // filter opens across the issue -- pure f(t), scrub-safe
      moveTo(lp.frequency, fc, 1600 + 1400 * tLocal, 0.12, 60);
      moveTo(droneLp.frequency, dfc, 200 + 900 * tLocal, 0.12, 20);
      const s = clock.tick(now);
      if (s < 0) return;
      if (h01((s >> 3) * 5 + 2) < 0.25) return; // glitch dropout bar
      if (h01(s * 7 + 1) >= 0.62) return; // per-step gate
      // pitch holds for 4 steps -> stutter feel on one note, then jumps
      const note = NEON_NOTES[hash(s >> 2) % NEON_NOTES.length]!;
      synth.triggerAttackRelease(note, 0.05, now, 0.35 + 0.3 * h01(s + 9));
    },
  };
});

/* ---- 4 Origin: muted valley -- low wind + sparse music box (ruling) ------ */
const BOX_NOTES = ["C6", "E6", "G6", "A6", "D6"];
audioRecipes[4] = defineRecipe((T) => {
  const out = new T.Gain(0.07);
  const wind = new T.Noise("pink");
  const windLp = new T.Filter(220, "lowpass");
  wind.chain(windLp, out);
  const gust = new T.LFO(0.07, 130, 330);
  gust.connect(windLp.frequency);
  const box = new T.Synth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.002, decay: 0.5, sustain: 0, release: 0.6 },
    volume: -10,
  });
  const shimmer = new T.FeedbackDelay(0.45, 0.35);
  shimmer.wet.value = 0.3;
  box.chain(shimmer, out);
  const clock = new Stepper(0.7);
  return {
    out,
    nodes: [wind, windLp, gust, box, shimmer, out],
    start: () => {
      clock.reset();
      wind.start();
      gust.start();
    },
    stop: () => {
      wind.stop();
      gust.stop();
    },
    update: () => {
      const now = T.now();
      const s = clock.tick(now);
      if (s >= 0 && h01(s * 5 + 1) < 0.42)
        box.triggerAttackRelease(BOX_NOTES[hash(s) % BOX_NOTES.length]!, 0.4, now, 0.25);
    },
  };
});

/* ---- 5 Press: rhythmic press thumps + steam puffs (ruling) --------------- */
audioRecipes[5] = defineRecipe((T) => {
  const out = new T.Gain(0.25);
  const thump = new T.MembraneSynth({
    pitchDecay: 0.06,
    octaves: 3.5,
    envelope: { attack: 0.002, decay: 0.3, sustain: 0, release: 0.08 },
    volume: -8,
  });
  thump.connect(out);
  const steam = new T.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.05, decay: 0.3, sustain: 0 },
    volume: -16,
  });
  const steamBp = new T.Filter(1400, "bandpass");
  steam.chain(steamBp, out);
  const clock = new Stepper(2.2);
  return {
    out,
    nodes: [thump, steam, steamBp, out],
    start: () => clock.reset(),
    stop: () => {
      /* one-shots only */
    },
    update: () => {
      const now = T.now();
      const s = clock.tick(now);
      if (s < 0) return;
      // dum-DUM-dum-rest press cycle; steam vents on a longer period
      if (s % 4 !== 3)
        thump.triggerAttackRelease("F1", 0.12, now, (s % 4 === 0 ? 0.85 : 0.4) + 0.1 * h01(s));
      if (s % 8 === 5) steam.triggerAttackRelease(0.25, now, 0.5 + 0.3 * h01(s * 3 + 1));
    },
  };
});

/* ---- 6 Newsprint: paper rustle + teletype click bursts ------------------- */
audioRecipes[6] = defineRecipe((T) => {
  const out = new T.Gain(0.18);
  const rustle = new T.NoiseSynth({
    noise: { type: "pink" },
    envelope: { attack: 0.06, decay: 0.22, sustain: 0 },
    volume: -14,
  });
  const rustleBp = new T.Filter(1900, "bandpass");
  rustle.chain(rustleBp, out);
  const tele = new T.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.012, sustain: 0 },
    volume: -10,
  });
  const teleHp = new T.Filter(3200, "highpass");
  tele.chain(teleHp, out);
  const clock = new Stepper(13);
  return {
    out,
    nodes: [rustle, rustleBp, tele, teleHp, out],
    start: () => clock.reset(),
    stop: () => {
      /* one-shots only */
    },
    update: () => {
      const now = T.now();
      const s = clock.tick(now);
      if (s < 0) return;
      // teletype: ~1.5 s hash-gated burst windows of rapid clicks
      const burst = h01(Math.floor(s / 20) * 7 + 3) < 0.45;
      if (burst && h01(s * 11 + 4) < 0.8) tele.triggerAttackRelease(0.01, now, 0.25 + 0.3 * h01(s + 6));
      if (hash(s) % 41 === 13) rustle.triggerAttackRelease(0.18, now, 0.4 + 0.3 * h01(s * 5 + 2));
    },
  };
});

/* ---- 7 Screentone: subway rail rhythm, tempo-locked to the boil grid ----- */
/**
 * The shader line boil steps at 10 Hz: components/PostPipeline.tsx drives
 * uBoilJitter/uStepSeed with stepNoise(elapsed, 10, *). The rail clock runs
 * on the same 10 Hz grid so every wheel hit lands exactly on a boil step;
 * the ka-thunk pair sits on adjacent steps every 8 steps (0.8 s bogie period).
 */
const RAIL_HZ = 10;
audioRecipes[7] = defineRecipe((T) => {
  const out = new T.Gain(0.22);
  const wheel = new T.MembraneSynth({
    pitchDecay: 0.03,
    octaves: 2.5,
    envelope: { attack: 0.001, decay: 0.16, sustain: 0, release: 0.05 },
    volume: -8,
  });
  wheel.connect(out);
  const rail = new T.Noise({ type: "brown", volume: -20 });
  const railBp = new T.Filter(320, "bandpass");
  rail.chain(railBp, out);
  const clock = new Stepper(RAIL_HZ);
  return {
    out,
    nodes: [wheel, rail, railBp, out],
    start: () => {
      clock.reset();
      rail.start();
    },
    stop: () => rail.stop(),
    update: () => {
      const now = T.now();
      const s = clock.tick(now);
      if (s < 0) return;
      const pos = s % 8;
      if (pos === 0) wheel.triggerAttackRelease("D2", 0.05, now, 0.3 + 0.1 * h01(s)); // ka
      else if (pos === 1) wheel.triggerAttackRelease("A1", 0.1, now, 0.7 + 0.15 * h01(s + 4)); // thunk
    },
  };
});

/* ---- 8 Pop: bright chiptune arp + sparse chat blips ----------------------- */
const POP_NOTES = [261.63, 329.63, 392, 523.25, 659.25];
const POP_PAT = [0, 2, 1, 3, 2, 4, 3, 1];
audioRecipes[8] = defineRecipe((T) => {
  const out = new T.Gain(0.13);
  const arp = new T.Synth({
    oscillator: { type: "fatsquare", count: 2, spread: 10 },
    envelope: { attack: 0.002, decay: 0.09, sustain: 0, release: 0.04 },
    volume: -14,
  });
  arp.connect(out);
  const blip = new T.Synth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.03 },
    volume: -14,
  });
  blip.connect(out);
  const clock = new Stepper(7.5);
  return {
    out,
    nodes: [arp, blip, out],
    start: () => clock.reset(),
    stop: () => {
      /* one-shots only */
    },
    update: () => {
      const now = T.now();
      const s = clock.tick(now);
      if (s < 0) return;
      // fixed 8-step arp figure; whole 16-step phrases occasionally rest
      if (h01((s >> 4) * 9 + 2) < 0.85)
        arp.triggerAttackRelease(POP_NOTES[POP_PAT[s % 8]!]!, 0.06, now, 0.5);
      if (hash(s) % 29 === 11)
        blip.triggerAttackRelease(h01(s + 4) < 0.5 ? 987.77 : 1318.51, 0.05, now, 0.4);
    },
  };
});

/* ---- 9 Sketchbook: pencil scratch riding |velocity| ----------------------- */
audioRecipes[9] = defineRecipe((T) => {
  const out = new T.Gain(0.3);
  const scratch = new T.Noise("white");
  const hp = new T.Filter(3800, "highpass");
  const g = new T.Gain(0);
  scratch.chain(hp, g, out);
  const gs = { v: 0 };
  const fs = { v: 3800 };
  return {
    out,
    nodes: [scratch, hp, g, out],
    start: () => scratch.start(),
    stop: () => scratch.stop(),
    update: (_tLocal, _dtSec, velocity) => {
      // graphite only speaks when the reader draws the page: gain ~ |v|^2
      const a = Math.min(1, Math.abs(velocity) * 1.5);
      moveTo(g.gain, gs, a * a, 0.06, 0.01);
      moveTo(hp.frequency, fs, 3200 + 2200 * a, 0.08, 120);
    },
  };
});

/* ---- 10 Spread: airy FM pads, slow, wide (FeedbackDelay space) ------------ */
const SPREAD_CHORDS: readonly [number, number][] = [
  [130.81, 196],
  [146.83, 220],
  [98, 164.81],
  [123.47, 185],
];
const SPREAD_RATE = 0.12; // chord change ~every 8.3 s
audioRecipes[10] = defineRecipe((T) => {
  const out = new T.Gain(0.18);
  const space = new T.FeedbackDelay(0.6, 0.45);
  space.wet.value = 0.35;
  space.connect(out);
  const panL = new T.Panner(-0.5).connect(space);
  const panR = new T.Panner(0.5).connect(space);
  const padA = new T.FMSynth({
    harmonicity: 2,
    modulationIndex: 2.2,
    envelope: { attack: 2.5, decay: 1.5, sustain: 0.6, release: 3.5 },
    modulationEnvelope: { attack: 3, decay: 1, sustain: 0.4, release: 3 },
    volume: -16,
  }).connect(panL);
  const padB = new T.FMSynth({
    harmonicity: 1.5,
    modulationIndex: 1.8,
    envelope: { attack: 3, decay: 1.5, sustain: 0.5, release: 4 },
    modulationEnvelope: { attack: 2.5, decay: 1, sustain: 0.5, release: 3 },
    volume: -16,
  }).connect(panR);
  const clock = new Stepper(SPREAD_RATE);
  const fire = (s: number, now: number): void => {
    const c = SPREAD_CHORDS[hash(s) % SPREAD_CHORDS.length]!;
    padA.triggerAttackRelease(c[0], 6.5, now, 0.45);
    padB.triggerAttackRelease(c[1], 6.5, now + 0.4, 0.4);
  };
  return {
    out,
    nodes: [space, panL, panR, padA, padB, out],
    start: () => {
      clock.reset();
      // fire the current chord immediately -- the clock period is far too
      // long to wait for its first edge (still deterministic: hash of step)
      const now = T.now();
      fire(Math.floor(now * SPREAD_RATE), now);
    },
    stop: () => {
      /* long releases decay on their own */
    },
    update: () => {
      const now = T.now();
      const s = clock.tick(now);
      if (s >= 0) fire(s, now);
    },
  };
});

/* ---- 11 Terminal: mains hum + sparse terminal beeps ----------------------- */
audioRecipes[11] = defineRecipe((T) => {
  const out = new T.Gain(0.09);
  const hum = new T.Oscillator({ frequency: 50, type: "sine", volume: -10 });
  const hum2 = new T.Oscillator({ frequency: 100, type: "sine", volume: -24 });
  hum.connect(out);
  hum2.connect(out);
  const beep = new T.Synth({
    oscillator: { type: "fatsquare", count: 2, spread: 8 },
    envelope: { attack: 0.002, decay: 0.07, sustain: 0, release: 0.02 },
    volume: -14,
  });
  beep.connect(out);
  const clock = new Stepper(0.55);
  return {
    out,
    nodes: [hum, hum2, beep, out],
    start: () => {
      clock.reset();
      hum.start();
      hum2.start();
    },
    stop: () => {
      hum.stop();
      hum2.stop();
    },
    update: () => {
      const now = T.now();
      const s = clock.tick(now);
      if (s >= 0 && h01(s * 3 + 1) < 0.38)
        beep.triggerAttackRelease(hash(s) % 3 === 0 ? 1318.51 : 880, 0.06, now, 0.5);
    },
  };
});
