import type { ToneAudioNode } from "tone";
import { useScrollStore } from "@/lib/scrollStore";
import { RANGES } from "@/issues/timeline";
import { trainDisplayX, trainSpeed, trainX } from "@/issues/07-screentone/shots";
import { audioRecipes, type AudioRecipe, type ToneModule } from "./types";
import { logFire } from "./debug";
import { h01, hash, moveTo, Stepper } from "./util";

/** local clamp (pure; avoids a lib/shots import at module scope) */
const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

/**
 * Wave B: the 12 per-issue ambiences (audioRecipes slots, indexed like
 * issues/registry.ts). Imported for side effect by the director. Rules:
 * - Tone only via the T module handed to build() (never a static import)
 * - all timing/pattern variation hashes an integer step of T.now() -- no
 *   Math.random anywhere; patterns survive stop()/start() cleanly
 * - param moves via moveTo() (rampTo on real target changes only)
 * - one-shots via triggerAttackRelease at T.now()
 * - these are AMBIENCES: out gains sit far below the master ceiling
 * - node-count norm (WS-A 2026-07-10): the base ambience is 3-8 nodes, but the
 *   motion-coupled beds run richer (Screentone ~13, Press 18) -- physics that
 *   follows the visible action needs the extra sources; still no allocations
 *   inside update() (all caches/synths preallocated in build()).
 * - discrete fires added by the WS-A pass call logFire(name) for the audit tap;
 *   continuous gain/param moves do NOT log.
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
  // attract breathe: the room tone swells gently on a 0.1 Hz LFO (0.7-1)
  const breatheGain = new T.Gain(0.85);
  const breatheLfo = new T.LFO(0.1, 0.7, 1);
  breatheLfo.connect(breatheGain.gain);
  const out = new T.Gain(0.05);
  noise.chain(lp, breatheGain, out);
  // crash riser: white-noise sweep that climbs with |velocity| across the
  // 3% cover range and hands off to the 0->1 crash gutter at t=0.03 (tLocal 1)
  // -- moments/transitions own the impact itself; this only fills the run-up.
  const riseNoise = new T.Noise("white");
  const riseBp = new T.Filter({ frequency: 600, type: "bandpass", Q: 1.5 });
  const riseGain = new T.Gain(0);
  riseNoise.chain(riseBp, riseGain, out);
  const rg = { v: 0 };
  const rf = { v: 600 };
  return {
    out,
    nodes: [noise, lp, breatheGain, breatheLfo, riseNoise, riseBp, riseGain, out],
    start: () => {
      noise.start();
      breatheLfo.start();
      riseNoise.start();
    },
    stop: () => {
      noise.stop();
      breatheLfo.stop();
      riseNoise.stop();
    },
    update: (tLocal, _dtSec, velocity) => {
      const a = Math.min(1, Math.abs(velocity) * 1.5);
      moveTo(riseGain.gain, rg, tLocal * tLocal * a * 0.35, 0.08, 0.01);
      moveTo(riseBp.frequency, rf, 600 + 2400 * tLocal, 0.1, 40);
    },
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
  // rain patter bed: band-limited pink hiss, ~-28 dBFS floor (visual rain is
  // NOT reduced-motion gated -- an f(t) downpour, so this bed is unconditional)
  const rain = new T.Noise({ type: "pink", volume: -22 });
  const rainHp = new T.Filter(1800, "highpass");
  const rainLp = new T.Filter(5200, "lowpass");
  const rainGain = new T.Gain(0.5);
  rain.chain(rainHp, rainLp, rainGain, out);
  // individual droplets on the tick clock: sharp filtered ticks with a hashed
  // bandpass sweep so no two land alike
  const droplet = new T.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.008, sustain: 0 },
    volume: -16,
  });
  const dropBp = new T.Filter({ frequency: 3000, type: "bandpass", Q: 3 });
  droplet.chain(dropBp, out);
  // distant thunder: sub-rumble swelled on rare bars (0 -> 0.35 -> 0 over 2.5s)
  const thunder = new T.Noise("brown");
  const thunderLp = new T.Filter(120, "lowpass");
  const thunderGain = new T.Gain(0);
  thunder.chain(thunderLp, thunderGain, out);
  const ticks = new Stepper(9);
  const bars = new Stepper(0.6);
  const sw = { v: 0.1 };
  const dfc = { v: 300 };
  return {
    out,
    nodes: [
      crackle, crackleHp, brush, brushLp, swell, droneLp, droneA, droneB,
      rain, rainHp, rainLp, rainGain, droplet, dropBp, thunder, thunderLp, thunderGain, out,
    ],
    start: () => {
      ticks.reset();
      bars.reset();
      brush.start();
      droneA.start();
      droneB.start();
      rain.start();
      thunder.start();
    },
    stop: () => {
      brush.stop();
      droneA.stop();
      droneB.stop();
      rain.stop();
      thunder.stop();
    },
    update: () => {
      const now = T.now();
      const s = ticks.tick(now);
      if (s >= 0 && h01(s * 3 + 1) < 0.24)
        crackle.triggerAttackRelease(0.02, now, 0.25 + 0.5 * h01(s * 7 + 2));
      // droplets ride the same tick grid but their own hash gate
      if (s >= 0 && h01(s * 17 + 4) < 0.7) {
        dropBp.frequency.rampTo(2600 + 1600 * h01(s * 23 + 6), 0.02);
        droplet.triggerAttackRelease(0.01, now, 0.15 + 0.35 * h01(s * 19 + 5));
        logFire("droplet");
      }
      const b = bars.tick(now);
      // slow brushed swells + a slow drone-filter breathe, both hashed per bar
      if (b >= 0) {
        moveTo(swell.gain, sw, hash(b) % 4 === 0 ? 0.08 : 0.35 + 0.35 * h01(b * 5 + 3), 1.1, 0.01);
        moveTo(droneLp.frequency, dfc, 220 + 220 * h01(b * 7 + 11), 2.5, 8);
        // rare thunder swell: schedule an up-then-down envelope on the sub gain
        if (hash(b * 13 + 7) % 9 === 3) {
          const g = thunderGain.gain;
          g.cancelScheduledValues(now);
          g.setValueAtTime(0, now);
          g.linearRampToValueAtTime(0.35, now + 0.7);
          g.linearRampToValueAtTime(0, now + 2.5);
          logFire("thunder");
        }
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
  // monitor-grow whoosh: airy sweep as the screen zooms up in the closing hold
  // (MON_R = [S+0.073, E] -> tLocal ~0.84..1.0; source: 02-desk/shots.ts MON_R).
  // Velocity-coupled so a parked scrub stays near-silent.
  const monNoise = new T.Noise("pink");
  const monBp = new T.Filter({ frequency: 500, type: "bandpass", Q: 1 });
  const monGain = new T.Gain(0);
  monNoise.chain(monBp, monGain, out);
  const mg = { v: 0 };
  const mf = { v: 500 };
  const clock = new Stepper(9);
  return {
    out,
    nodes: [room, roomLp, key, keyBp, monNoise, monBp, monGain, out],
    start: () => {
      clock.reset();
      room.start();
      monNoise.start();
    },
    stop: () => {
      room.stop();
      monNoise.stop();
    },
    update: (tLocal, _dtSec, velocity) => {
      const now = T.now();
      const p = clamp01((tLocal - 0.84) / 0.14);
      const vk = 0.25 + 0.75 * Math.min(1, Math.abs(velocity) * 1.5);
      moveTo(monGain.gain, mg, Math.sin(Math.PI * Math.min(p, 0.95)) * vk * 0.3, 0.08, 0.01);
      moveTo(monBp.frequency, mf, 500 + 1800 * p, 0.1, 40);
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
  // free-fall wind + crash doppler: dive p over the establish, crash q over the
  // tower zoom (source: 03-neon/shots.ts neon-dive [0,0.32], neon-crash
  // [0.395,0.595]). Velocity-coupled so a static scrub does not roar.
  const wind = new T.Noise("white");
  const windBp = new T.Filter({ frequency: 700, type: "bandpass", Q: 1 });
  const windGain = new T.Gain(0);
  wind.chain(windBp, windGain, out);
  // post-cascade city hum: mains-ish drone that fills in once the grid lights
  // (source: 03-neon/shots.ts cascade window at(0.67)..at(0.901) -> span 0.23)
  const humSaw = new T.Oscillator({ frequency: 60, type: "sawtooth", volume: -30 });
  const humSine = new T.Oscillator({ frequency: 120, type: "sine", volume: -34 });
  const humLp = new T.Filter(300, "lowpass");
  const humGain = new T.Gain(0);
  humSaw.connect(humLp);
  humSine.connect(humLp);
  humLp.chain(humGain, out);
  const clock = new Stepper(8);
  const fc = { v: 2200 };
  const dfc = { v: 200 };
  const wg = { v: 0 };
  const wf = { v: 700 };
  const hg = { v: 0 };
  return {
    out,
    nodes: [synth, lp, droneA, droneB, droneLp, wind, windBp, windGain, humSaw, humSine, humLp, humGain, out],
    start: () => {
      clock.reset();
      droneA.start();
      droneB.start();
      wind.start();
      humSaw.start();
      humSine.start();
    },
    stop: () => {
      droneA.stop();
      droneB.stop();
      wind.stop();
      humSaw.stop();
      humSine.stop();
    },
    update: (tLocal, _dtSec, velocity) => {
      const now = T.now();
      // filter opens across the issue -- pure f(t), scrub-safe
      moveTo(lp.frequency, fc, 1600 + 1400 * tLocal, 0.12, 60);
      moveTo(droneLp.frequency, dfc, 200 + 900 * tLocal, 0.12, 20);
      const p = clamp01(tLocal / 0.32);
      const q = clamp01((tLocal - 0.395) / 0.2);
      const vk = Math.min(0.4 + 0.6 * Math.abs(velocity), 1);
      moveTo(windGain.gain, wg, (p * p * (1 - q) + Math.sin(Math.PI * q)) * vk * 0.35, 0.09, 0.01);
      moveTo(windBp.frequency, wf, 700 + 2600 * Math.max(p, q), 0.1, 60);
      moveTo(humGain.gain, hg, clamp01((tLocal - 0.67) / 0.23) * 0.5, 0.2, 0.01);
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
  // conveyor rumble: sub belt bed, ~-30 dBFS, wow'd by a slow LFO (0.35-0.5)
  const belt = new T.Noise({ type: "brown", volume: -24 });
  const beltLp = new T.Filter(140, "lowpass");
  const beltGain = new T.Gain(0.5);
  belt.chain(beltLp, beltGain, out);
  const beltLfo = new T.LFO(0.4, 0.35, 0.5);
  beltLfo.connect(beltGain.gain);
  // roller squeak: sparse high triangle chirps on the press clock
  const squeak = new T.Synth({
    oscillator: { type: "triangle" },
    envelope: { attack: 0.002, decay: 0.08, sustain: 0, release: 0.05 },
    volume: -30,
  });
  const squeakHp = new T.Filter(2100, "highpass");
  squeak.chain(squeakHp, out);
  // plotter whir: filtered saw over the TS trace window with a 9 Hz amp flutter
  // (source: 05-press/shots.ts PRESS_TRACE_RANGE at(0.235)..at(0.365))
  const whir = new T.Oscillator({ frequency: 1100, type: "sawtooth", volume: -26 });
  const whirBp = new T.Filter({ frequency: 1500, type: "bandpass", Q: 2 });
  const flutterGain = new T.Gain(1);
  const whirGain = new T.Gain(0);
  whir.chain(whirBp, flutterGain, whirGain, out);
  const flutterLfo = new T.LFO(9, 0.55, 1);
  flutterLfo.connect(flutterGain.gain);
  // React energy swell over the establish (source: PRESS_ENERGY_RANGE [0,0.08])
  const react = new T.Oscillator({ frequency: 220, type: "sine", volume: -20 });
  const reactGain = new T.Gain(0);
  react.chain(reactGain, out);
  // AI shimmer: one long FM bell latched on entry to the constellation bay
  // (source: PRESS_PULSE_RANGE at(0.675)..at(0.775) -> tLocal [0.675,0.775])
  const aiFm = new T.FMSynth({
    harmonicity: 3,
    modulationIndex: 4,
    envelope: { attack: 0.4, decay: 1, sustain: 0.3, release: 1.5 },
    modulationEnvelope: { attack: 0.6, decay: 0.8, sustain: 0.4, release: 1.2 },
    volume: -26,
  });
  aiFm.connect(out);
  const clock = new Stepper(2.2);
  const wg = { v: 0 };
  const wf = { v: 1100 };
  const rg = { v: 0 };
  const rf = { v: 220 };
  let aiArmed = true;
  return {
    out,
    nodes: [
      thump, steam, steamBp, belt, beltLp, beltGain, beltLfo, squeak, squeakHp,
      whir, whirBp, flutterGain, whirGain, flutterLfo, react, reactGain, aiFm, out,
    ],
    start: () => {
      clock.reset();
      aiArmed = true;
      belt.start();
      beltLfo.start();
      whir.start();
      flutterLfo.start();
      react.start();
    },
    stop: () => {
      belt.stop();
      beltLfo.stop();
      whir.stop();
      flutterLfo.stop();
      react.stop();
    },
    update: (tLocal) => {
      const now = T.now();
      // plotter whir: triangular envelope across the trace window, freq climbs
      const wp = clamp01((tLocal - 0.235) / 0.13);
      const tri = 1 - Math.abs(2 * wp - 1);
      moveTo(whirGain.gain, wg, tri * 0.4, 0.09, 0.01);
      moveTo(whir.frequency, wf, 1100 + 900 * wp, 0.1, 30);
      // React energy swell: sine glides 220->440 as the establish energizes
      const rp = clamp01(tLocal / 0.08);
      moveTo(reactGain.gain, rg, rp * 0.35, 0.09, 0.01);
      moveTo(react.frequency, rf, 220 + 220 * rp, 0.12, 6);
      // AI shimmer: fire once on window entry, re-arm when clear before the band
      const ap = clamp01((tLocal - 0.675) / 0.1);
      if (ap > 0.05 && aiArmed) {
        aiFm.triggerAttackRelease(1046.5, 2.5, now, 0.5);
        logFire("aiShimmer");
        aiArmed = false;
      }
      if (ap < 0.01) aiArmed = true;
      const s = clock.tick(now);
      if (s < 0) return;
      // dum-DUM-dum-rest press cycle; steam vents on a longer period
      if (s % 4 !== 3)
        thump.triggerAttackRelease("F1", 0.12, now, (s % 4 === 0 ? 0.85 : 0.4) + 0.1 * h01(s));
      if (s % 8 === 5) steam.triggerAttackRelease(0.25, now, 0.5 + 0.3 * h01(s * 3 + 1));
      // roller squeak: hashed sparse chirp, ~1900 Hz
      if (hash(s * 11 + 5) % 13 === 4) {
        squeak.triggerAttackRelease(1800 + 200 * h01(s * 13 + 2), 0.06, now, 0.4);
        logFire("rollerSqueak");
      }
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
  // ink-flood wash: low pink swell + a 110 Hz sub as the front page floods to
  // color (source: 06-newsprint/shots.ts NEWS_FLOOD_RANGE at(0.6)..at(0.82)).
  // The KRAKA-THOOM beat lands on the crest.
  const flood = new T.Noise("pink");
  const floodLp = new T.Filter(600, "lowpass");
  const floodSine = new T.Oscillator({ frequency: 110, type: "sine", volume: -18 });
  const floodGain = new T.Gain(0);
  flood.chain(floodLp, floodGain, out);
  floodSine.connect(floodGain);
  // teletype re-quantized to 12 Hz to match the visual crawl (12 fps steps)
  const clock = new Stepper(12);
  const fg = { v: 0 };
  const ff = { v: 600 };
  return {
    out,
    nodes: [rustle, rustleBp, tele, teleHp, flood, floodLp, floodSine, floodGain, out],
    start: () => {
      clock.reset();
      flood.start();
      floodSine.start();
    },
    stop: () => {
      flood.stop();
      floodSine.stop();
    },
    update: (tLocal) => {
      const now = T.now();
      // wash gain: pow(p,1.6) up the flood, then settle to a 0.12 residual bed
      const fp = clamp01((tLocal - 0.6) / 0.22);
      moveTo(floodGain.gain, fg, fp >= 1 ? 0.12 : Math.pow(fp, 1.6) * 0.4, 0.15, 0.01);
      moveTo(floodLp.frequency, ff, 600 + 1600 * fp, 0.12, 30);
      const s = clock.tick(now);
      if (s < 0) return;
      // teletype: ~1.5 s hash-gated burst windows of rapid clicks; the clacks
      // crescendo when the ticker band fills the frame (tri peak at tLocal 0.43)
      const tvk = 0.4 + 0.6 * Math.max(0, 1 - Math.abs(tLocal - 0.43) / 0.15);
      const burst = h01(Math.floor(s / 20) * 7 + 3) < 0.45;
      if (burst && h01(s * 11 + 4) < 0.8)
        tele.triggerAttackRelease(0.01, now, (0.25 + 0.3 * h01(s + 6)) * tvk);
      if (hash(s) % 41 === 13) rustle.triggerAttackRelease(0.18, now, 0.4 + 0.3 * h01(s * 5 + 2));
    },
  };
});

/* ---- 7 Screentone: motion-coupled subway bed (REBUILD, WS-A template) ----- */
/**
 * Rebuilt 2026-07-10: the old fixed 10 Hz ka-thunk ignored the train profile
 * (it clacked at dwells). This bed is now a pure function of the train's own
 * motion. Reconstruct global t from tLocal + RANGES[7], mirror Screentone.tsx:
 *   sp = reducedMotion ? 0 : trainSpeed(t)   (0 = parked at a station)
 * Everything routes through trainBus -> panner (pan tracks trainDisplayX) so
 * the whole vehicle swings across the stereo field with the visible car; the
 * platform room tone sits OUTSIDE the bus (the station never moves). At dwells
 * -- and under reduced motion (a parked train, correct) -- sp is 0, so rumble /
 * whine / clacks all fall silent and only the platform breathes.
 * ~13 nodes (motion physics needs the sources; see the file-header node note).
 */
const SCREENTONE_RANGE = RANGES[7]!;
audioRecipes[7] = defineRecipe((T) => {
  const [S7, E7] = SCREENTONE_RANGE;
  const W7 = E7 - S7;
  const out = new T.Gain(0.22);
  // the moving vehicle bus: everything train-borne pans with the car
  const trainBus = new T.Gain(1);
  const panner = new T.Panner(0);
  trainBus.chain(panner, out);
  // rail rumble (re-homed from the old fixed clacks' noise/filter): the loudest
  // new element, ~-18 dBFS at cruise, dead silent at dwells (gain = sp*sp*0.9)
  const rail = new T.Noise({ type: "brown", volume: -20 });
  const railBp = new T.Filter({ frequency: 320, type: "bandpass", Q: 1 });
  const rumbleGain = new T.Gain(0);
  rail.chain(railBp, rumbleGain, trainBus);
  // wheel clacks (re-homed membrane): distance-locked to rail joints, NOT time
  const wheel = new T.MembraneSynth({
    pitchDecay: 0.03,
    octaves: 2.5,
    envelope: { attack: 0.001, decay: 0.16, sustain: 0, release: 0.05 },
    volume: -8,
  });
  wheel.connect(trainBus);
  // traction whine: filtered saw whose pitch + level ride sp -- makes accel and
  // decel audible (the whole reason for the rebuild)
  const whine = new T.Oscillator({ frequency: 80, type: "sawtooth", volume: -30 });
  const whineLp = new T.Filter(600, "lowpass");
  const whineGain = new T.Gain(0);
  whine.chain(whineLp, whineGain, trainBus);
  // platform room tone: OUTSIDE the bus (the station is fixed); loudest when
  // the train is stopped so the platform "breathes" at dwells / reduced motion
  const platform = new T.Noise("pink");
  const platformLp = new T.Filter(400, "lowpass");
  const stationGain = new T.Gain(0);
  platform.chain(platformLp, stationGain, out);
  const panC = { v: 0 };
  const rumbleG = { v: 0 };
  const railF = { v: 320 };
  const whineF = { v: 80 };
  const whineG = { v: 0 };
  const stationG = { v: 0 };
  let lastJoint = NaN;
  // monotonic guard for the mono wheel voice: next Tone time it is free to
  // schedule. Tone throws if two starts arrive out of order on one synth.
  let wheelFree = 0;
  return {
    out,
    nodes: [
      out, trainBus, panner, rail, railBp, rumbleGain, wheel, whine, whineLp,
      whineGain, platform, platformLp, stationGain,
    ],
    start: () => {
      lastJoint = NaN;
      wheelFree = 0;
      rail.start();
      whine.start();
      platform.start();
    },
    stop: () => {
      rail.stop();
      whine.stop();
      platform.stop();
    },
    update: (tLocal) => {
      const now = T.now();
      const { reducedMotion } = useScrollStore.getState();
      const t = S7 + tLocal * W7; // reconstruct global t
      const sp = reducedMotion ? 0 : trainSpeed(t);
      // pan the vehicle bus to the visible car (parked position under RM)
      const pan = Math.max(-0.85, Math.min(0.85, trainDisplayX(t, reducedMotion) / 105));
      moveTo(panner.pan, panC, pan, 0.1, 0.01);
      // continuous motion beds
      moveTo(rumbleGain.gain, rumbleG, sp * sp * 0.9, 0.09, 0.01);
      moveTo(railBp.frequency, railF, 260 + 240 * sp, 0.1, 12);
      moveTo(whineGain.gain, whineG, sp * 0.5, 0.09, 0.01);
      moveTo(whine.frequency, whineF, 80 + 520 * sp, 0.1, 20);
      moveTo(stationGain.gain, stationG, (1 - sp) * 0.28, 0.15, 0.01);
      // wheel clacks locked to rail joints (every 6 set-units); one pair per
      // joint crossing, no catch-up on deep jumps (compare to last joint only)
      const j = Math.floor(trainX(t) / 6);
      if (j !== lastJoint) {
        const primed = !Number.isNaN(lastJoint);
        lastJoint = j;
        if (primed && sp > 0.05) {
          const delay = Math.min(0.09, 0.05 / Math.max(sp, 0.2));
          // schedule both hits at or after wheelFree so starts never invert on
          // the mono voice; if the scheduler has backed up past +0.04 s the
          // pair is inaudibly late -- drop it rather than crash the director.
          const a = Math.max(now, wheelFree);
          if (a <= now + 0.04) {
            const b = a + delay;
            wheel.triggerAttackRelease("D2", 0.05, a, 0.12 + 0.3 * sp);
            wheel.triggerAttackRelease("A1", 0.1, b, 0.25 + 0.45 * sp);
            wheelFree = b + 0.01;
            logFire("clack");
          }
        }
      }
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
  // emote sparkle owns its OWN mono voice: its octave-up hit can never collide
  // with the chat blip on one synth at the same Tone time (was a strict-time
  // crash that the director caught by disabling ALL audio).
  const sparkle = new T.Synth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.03 },
    volume: -20,
  });
  sparkle.connect(out);
  // ON AIR hum: a soft 100 Hz sine pulsing on a 0.9 Hz LFO to match the sign
  const onAir = new T.Oscillator({ frequency: 100, type: "sine", volume: -32 });
  const onAirGain = new T.Gain(0.7);
  onAir.connect(onAirGain);
  onAirGain.connect(out);
  const onAirLfo = new T.LFO(0.9, 0.4, 1);
  onAirLfo.connect(onAirGain.gain);
  const clock = new Stepper(7.5);
  return {
    out,
    nodes: [arp, blip, sparkle, onAir, onAirGain, onAirLfo, out],
    start: () => {
      clock.reset();
      onAir.start();
      onAirLfo.start();
    },
    stop: () => {
      onAir.stop();
      onAirLfo.stop();
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
      // emote sparkle: the chat blip an octave up, sparse hash gate
      if (hash(s * 3 + 8) % 11 === 2) {
        sparkle.triggerAttackRelease((h01(s + 8) < 0.5 ? 987.77 : 1318.51) * 2, 0.05, now, 0.25);
        logFire("sparkle");
      }
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
  // the little robot's trundle: soft filtered thuds, only while the reader
  // draws (|vel| > 0.05). NOTHING else here -- this valley stays quiet.
  const trundle = new T.NoiseSynth({
    noise: { type: "brown" },
    envelope: { attack: 0.001, decay: 0.015, sustain: 0 },
    volume: -32,
  });
  const trundleBp = new T.Filter({ frequency: 900, type: "bandpass", Q: 1 });
  trundle.chain(trundleBp, out);
  const trundleClock = new Stepper(4);
  const gs = { v: 0 };
  const fs = { v: 3800 };
  return {
    out,
    nodes: [scratch, hp, g, trundle, trundleBp, out],
    start: () => {
      trundleClock.reset();
      scratch.start();
    },
    stop: () => scratch.stop(),
    update: (_tLocal, _dtSec, velocity) => {
      // graphite only speaks when the reader draws the page: gain ~ |v|^2
      const a = Math.min(1, Math.abs(velocity) * 1.5);
      moveTo(g.gain, gs, a * a, 0.06, 0.01);
      moveTo(hp.frequency, fs, 3200 + 2200 * a, 0.08, 120);
      const s = trundleClock.tick(T.now());
      if (s >= 0 && h01(s * 5 + 9) < 0.5 && Math.abs(velocity) > 0.05) {
        trundle.triggerAttackRelease(0.02, T.now(), 0.2);
        logFire("trundle");
      }
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
  // cat drift: a faint airy whisper following the cat across the arc, peaking
  // mid-drift (source: 10-spread/shots.ts CAT_DRIFT at(0.52)..at(0.7)). By
  // design barely-there -- the pads own the room.
  const drift = new T.Noise("pink");
  const driftBp = new T.Filter({ frequency: 350, type: "bandpass", Q: 0.7 });
  const driftGain = new T.Gain(0);
  drift.chain(driftBp, driftGain, out);
  const dg = { v: 0 };
  const clock = new Stepper(SPREAD_RATE);
  const fire = (s: number, now: number): void => {
    const c = SPREAD_CHORDS[hash(s) % SPREAD_CHORDS.length]!;
    padA.triggerAttackRelease(c[0], 6.5, now, 0.45);
    padB.triggerAttackRelease(c[1], 6.5, now + 0.4, 0.4);
  };
  return {
    out,
    nodes: [space, panL, panR, padA, padB, drift, driftBp, driftGain, out],
    start: () => {
      clock.reset();
      drift.start();
      // fire the current chord immediately -- the clock period is far too
      // long to wait for its first edge (still deterministic: hash of step)
      const now = T.now();
      fire(Math.floor(now * SPREAD_RATE), now);
    },
    stop: () => {
      drift.stop();
    },
    update: (tLocal) => {
      const now = T.now();
      moveTo(driftGain.gain, dg, Math.sin(Math.PI * clamp01((tLocal - 0.52) / 0.18)) * 0.12, 0.12, 0.01);
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
