import type {
  FeedbackDelay,
  Filter,
  FMSynth,
  Gain,
  MembraneSynth,
  MetalSynth,
  Noise,
  NoiseSynth,
  Oscillator,
  Synth,
} from "tone";
import { clamp01 } from "@/lib/shots";
import { useScrollStore } from "@/lib/scrollStore";
import { RANGES } from "@/issues/timeline";
import type { ToneModule } from "./types";
import { h01, hash, moveTo } from "./util";
import { fireMeowVoice } from "./ui";
// Read-only scene constants (all already exported). These are pure numbers /
// pure f(t) helpers -- importing them adds NO Tone at module scope and no new
// autoplay path (Tone stays lazy, handed in via scoreMoments' T argument).
import { KEYS_R } from "@/issues/02-desk/shots";
import { NEON_CASCADE_END, NEON_CASCADE_T } from "@/issues/03-neon/shots";
import { PRESS_PART_T } from "@/issues/05-press/shots";
import { STATION_X, trainSpeed, trainX } from "@/issues/07-screentone/shots";
import { ORBIT_START_T } from "@/issues/08-pop/shots";
import { FLOOD_T, inkAt } from "@/issues/09-sketchbook/shots";
import { UNFOLD_RANGE } from "@/issues/10-spread/shots";

/**
 * Wave C: the reactive "moments" layer -- a self-contained sibling of
 * transitions.ts. Two surfaces, both on the sfx bus (master Compressor ->
 * Limiter), mixed low, texture only:
 *
 *   scoreMoments(T, sfx, t, dtSec, velocity) -- one director call site per
 *     tick. Diegetic scene reactions re-homed off recipes.ts: each windows on
 *     imported scene constants, reconstructs global t, and fires through an
 *     OWN pooled synth kit built once. Scrub/deep-jump-safe crossings use the
 *     Edge helper (BeatRunner semantics: prime on first tick, fire forward
 *     cross, re-arm below trigger-hysteresis, NO catch-up burst). The pop-360
 *     whoosh/crowd bed is a continuous pure f(t) swell (no event arming).
 *
 *   beatMoment(id, flash) -- the setBeatSound handler. Returns true when a
 *     moment owns the hit (custom sound OR a deliberate silence), false to let
 *     the caller fall through to its default thump/chime. Reuses the same
 *     pooled kit -- no new synths. Gesture-gated for free: the kit only exists
 *     once scoreMoments has run under an enabled director.
 *
 * Determinism law: variation is Knuth hash(i)/h01(i) of integer indices only,
 * never Math.random. Param moves via moveTo (rampTo on real changes); shaped
 * one-shot sweeps via scheduled setValueAtTime/linearRampToValueAtTime. No
 * per-frame allocation in the update path.
 */

/* ------------------------------------------------------------------ Edge --- */
/**
 * Forward-crossing latch, scrub- and deep-jump-safe (BeatRunner pattern). The
 * first crossed() call only primes (arms iff below the threshold) so a jump
 * INTO the middle of a window replays nothing. Thereafter it fires once on a
 * forward cross and re-arms only after retreating past trigger - hysteresis.
 */
class Edge {
  private primed = false;
  private armed = true;
  crossed(x: number, at: number, hyst: number): boolean {
    if (!this.primed) {
      this.primed = true;
      this.armed = x < at;
      return false;
    }
    if (this.armed) {
      if (x >= at) {
        this.armed = false;
        return true;
      }
    } else if (x < at - hyst) {
      this.armed = true;
    }
    return false;
  }
  reset(): void {
    this.primed = false;
    this.armed = true;
  }
}

/* -------------------------------------------------- windows + note tables --- */
const CLACK_FRACS = [0.12, 0.3, 0.46, 0.62, 0.76, 0.9] as const;
const CLACK_HYST = 0.0008;
const PART_HYST = 0.003;
const STATION_HYST = 4; // world units (stations ~24 apart)
const INK_HYST = 0.02;
const STAR_HYST = 0.015;
const PAW_HYST = 0.008; // < pawprint spacing (0.3/9) so each step re-arms alone

const POP_RANGE = RANGES[8]!;
/** ORBIT_F is not exported by 08-pop; derive it from ORBIT_START_T. */
const ORBIT_F = (ORBIT_START_T - POP_RANGE[0]) / (POP_RANGE[1] - POP_RANGE[0]);
/** wash-flood onset expressed in sketch ink-u (== inkAt(FLOOD_T) == 0.65). */
const FLOOD_U = inkAt(FLOOD_T);

/** ascending pentatonic C5..A6, one shimmer per spread page (0..9). */
const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760] as const;

/* --------------------------------------------------------------- the kit --- */
interface Kit {
  // desk keycap clacks
  clackNoise: NoiseSynth;
  clackBp: Filter;
  clackThock: Synth;
  // neon ring zaps
  ringSyn: Synth;
  ringBp: Filter;
  ringDelay: FeedbackDelay;
  ringSnap: NoiseSynth;
  ringSnapHp: Filter;
  // press part-add thumps
  partMembrane: MembraneSynth;
  partReact: Synth;
  partTs: Synth;
  partTsBp: Filter;
  partRust: MetalSynth;
  partAiA: Synth;
  partAiB: Synth;
  // screentone far-off horn
  hornA: Synth;
  hornB: Synth;
  hornLp: Filter;
  hornDelay: FeedbackDelay;
  // pop 360 whoosh + crowd (continuous)
  popWhoosh: Noise;
  popWhooshBp: Filter;
  popWhooshGain: Gain;
  crowdA: Oscillator;
  crowdB: Oscillator;
  crowdC: Oscillator;
  crowdLp: Filter;
  crowdGain: Gain;
  hushNoise: Noise;
  hushLp: Filter;
  // sketch ink ticks + wash flood
  inkTick: NoiseSynth;
  inkTickHp: Filter;
  washNoise: NoiseSynth;
  washLp: Filter;
  washSine: Synth;
  // spread star-chart arp
  starBell: FMSynth;
  starDelay: FeedbackDelay;
  // kaching donation
  kachA: FMSynth;
  kachB: FMSynth;
  kachDrawer: NoiseSynth;
  kachDrawerBp: Filter;
  kachPop: NoiseSynth;
  kachPopLp: Filter;
  coin: Synth;
  // press die-slam
  stampMembrane: MembraneSynth;
  stampMetal: MetalSynth;
  stampPaper: NoiseSynth;
  stampPaperLp: Filter;
  // press clank KRUNCH
  clankNoise: NoiseSynth;
  clankBp: Filter;
  clankThock: Synth;
  // newsprint KRAKA-THOOM
  newsMembrane: MembraneSynth;
  newsBody: FMSynth;
  newsTele: NoiseSynth;
  newsTeleHp: Filter;
  // title drop stamp
  titleMembrane: MembraneSynth;
  titleClang: Synth;
  titleCrack: NoiseSynth;
  // screentone edge-run launch
  edgeMembrane: MembraneSynth;
  edgeScreech: Synth;
  edgeScreechBp: Filter;
  edgeWhoosh: NoiseSynth;
  edgeWhooshBp: Filter;
  edgeHorn: FMSynth;
  // cat interactions: desk soft-land + chirp, dot bat boop, sketch pad-steps.
  // The meow voice itself is shared from ui.ts (one FMSynth + one ME-OW
  // contour). All one-shots on the sfx bus (no continuous sources).
  landThud: MembraneSynth;
  landNoise: NoiseSynth;
  landLp: Filter;
  pawTick: NoiseSynth;
  pawLp: Filter;
  boopSyn: Synth;
}

function buildKit(T: ToneModule, sfx: Gain): Kit {
  // -- desk keycap clacks
  const clackNoise = new T.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.018, sustain: 0 },
    volume: -12,
  });
  const clackBp = new T.Filter(3400, "bandpass");
  clackNoise.chain(clackBp, sfx);
  const clackThock = new T.Synth({
    oscillator: { type: "triangle" },
    envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 },
    volume: -14,
  });
  clackThock.connect(sfx);

  // -- neon ring zaps
  const ringSyn = new T.Synth({
    oscillator: { type: "square" },
    envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 },
    volume: -16,
  });
  const ringBp = new T.Filter(1500, "bandpass");
  const ringDelay = new T.FeedbackDelay(0.03, 0.15);
  ringDelay.wet.value = 0.25;
  ringSyn.chain(ringBp, ringDelay, sfx);
  const ringSnap = new T.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.015, sustain: 0 },
    volume: -18,
  });
  const ringSnapHp = new T.Filter(4000, "highpass");
  ringSnap.chain(ringSnapHp, sfx);

  // -- press part-add thumps
  const partMembrane = new T.MembraneSynth({
    pitchDecay: 0.05,
    octaves: 4,
    envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.08 },
    volume: -8,
  });
  partMembrane.connect(sfx);
  const partReact = new T.Synth({
    oscillator: { type: "triangle" },
    envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.03 },
    volume: -14,
  });
  partReact.connect(sfx);
  const partTs = new T.Synth({
    oscillator: { type: "fatsquare", count: 2, spread: 10 },
    envelope: { attack: 0.001, decay: 0.09, sustain: 0, release: 0.03 },
    volume: -16,
  });
  const partTsBp = new T.Filter(900, "bandpass");
  partTs.chain(partTsBp, sfx);
  const partRust = new T.MetalSynth({
    harmonicity: 3.1,
    resonance: 300,
    modulationIndex: 16,
    octaves: 1.2,
    envelope: { attack: 0.001, decay: 0.1, release: 0.05 },
    volume: -20,
  });
  partRust.connect(sfx);
  const partAiA = new T.Synth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.002, decay: 0.16, sustain: 0, release: 0.06 },
    volume: -16,
  });
  partAiA.connect(sfx);
  const partAiB = new T.Synth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.002, decay: 0.16, sustain: 0, release: 0.06 },
    volume: -18,
  });
  partAiB.connect(sfx);

  // -- screentone far-off horn (two detuned voices a fifth apart)
  const hornDelay = new T.FeedbackDelay(0.3, 0.3);
  hornDelay.wet.value = 0.25;
  const hornLp = new T.Filter(500, "lowpass");
  hornLp.connect(hornDelay);
  hornDelay.connect(sfx);
  const hornEnv = { attack: 0.08, decay: 0.4, sustain: 0.2, release: 0.5 };
  const hornA = new T.Synth({ oscillator: { type: "fatsine", count: 2, spread: 12 }, envelope: hornEnv, volume: -20 });
  const hornB = new T.Synth({ oscillator: { type: "fattriangle", count: 2, spread: 14 }, envelope: hornEnv, volume: -22 });
  hornA.connect(hornLp);
  hornB.connect(hornLp);

  // -- pop 360 whoosh + crowd (continuous, started on demand)
  const popWhooshGain = new T.Gain(0);
  const popWhooshBp = new T.Filter(300, "bandpass");
  const popWhoosh = new T.Noise({ type: "pink", volume: -18 });
  popWhoosh.chain(popWhooshBp, popWhooshGain, sfx);
  const crowdGain = new T.Gain(0);
  const crowdLp = new T.Filter(600, "lowpass");
  crowdLp.connect(crowdGain);
  crowdGain.connect(sfx);
  const crowdA = new T.Oscillator({ frequency: 110, type: "sawtooth", volume: -18 });
  const crowdB = new T.Oscillator({ frequency: 165, type: "sawtooth", volume: -20 });
  const crowdC = new T.Oscillator({ frequency: 220, type: "sawtooth", volume: -22 });
  crowdA.connect(crowdLp);
  crowdB.connect(crowdLp);
  crowdC.connect(crowdLp);
  const hushLp = new T.Filter(1200, "lowpass");
  const hushNoise = new T.Noise({ type: "white", volume: -26 });
  hushNoise.chain(hushLp, crowdGain);

  // -- sketch ink ticks + wash flood
  const inkTick = new T.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.01, sustain: 0 },
    volume: -16,
  });
  const inkTickHp = new T.Filter(3800, "highpass");
  inkTick.chain(inkTickHp, sfx);
  const washNoise = new T.NoiseSynth({
    noise: { type: "pink" },
    envelope: { attack: 0.3, decay: 0.4, sustain: 0 },
    volume: -18,
  });
  const washLp = new T.Filter(400, "lowpass");
  washNoise.chain(washLp, sfx);
  const washSine = new T.Synth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.02, decay: 0.5, sustain: 0, release: 0.3 },
    volume: -18,
  });
  washSine.connect(sfx);

  // -- spread star-chart arp (also reused by origin-portal)
  const starDelay = new T.FeedbackDelay(0.28, 0.4);
  starDelay.wet.value = 0.35;
  starDelay.connect(sfx);
  const starBell = new T.FMSynth({
    harmonicity: 2,
    modulationIndex: 3,
    oscillator: { type: "sine" },
    modulation: { type: "triangle" },
    envelope: { attack: 0.005, decay: 0.5, sustain: 0, release: 0.6 },
    modulationEnvelope: { attack: 0.005, decay: 0.4, sustain: 0, release: 0.4 },
    volume: -18,
  });
  starBell.connect(starDelay);

  // -- kaching donation (kachPop reused by sketch-print-run + back-cover)
  const kachEnv = { attack: 0.001, decay: 0.35, sustain: 0, release: 0.2 };
  const kachA = new T.FMSynth({ harmonicity: 5.1, modulationIndex: 28, envelope: kachEnv, volume: -12 });
  const kachB = new T.FMSynth({ harmonicity: 5.1, modulationIndex: 28, envelope: kachEnv, volume: -13 });
  kachA.connect(sfx);
  kachB.connect(sfx);
  const kachDrawer = new T.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.07, sustain: 0 },
    volume: -20,
  });
  const kachDrawerBp = new T.Filter(2200, "bandpass");
  kachDrawer.chain(kachDrawerBp, sfx);
  const kachPop = new T.NoiseSynth({
    noise: { type: "pink" },
    envelope: { attack: 0.05, decay: 0.4, sustain: 0 },
    volume: -22,
  });
  const kachPopLp = new T.Filter(800, "lowpass");
  kachPop.chain(kachPopLp, sfx);
  const coin = new T.Synth({
    oscillator: { type: "triangle" },
    envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.03 },
    volume: -18,
  });
  coin.connect(sfx);

  // -- press die-slam (stampMembrane reused by terminal-back-cover)
  const stampMembrane = new T.MembraneSynth({
    pitchDecay: 0.05,
    octaves: 4,
    envelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.1 },
    volume: -6,
  });
  stampMembrane.connect(sfx);
  const stampMetal = new T.MetalSynth({
    harmonicity: 3.2,
    resonance: 400,
    modulationIndex: 20,
    octaves: 1.4,
    envelope: { attack: 0.001, decay: 0.12, release: 0.05 },
    volume: -16,
  });
  stampMetal.connect(sfx);
  const stampPaper = new T.NoiseSynth({
    noise: { type: "pink" },
    envelope: { attack: 0.001, decay: 0.12, sustain: 0 },
    volume: -16,
  });
  const stampPaperLp = new T.Filter(1200, "lowpass");
  stampPaper.chain(stampPaperLp, sfx);

  // -- press clank KRUNCH
  const clankNoise = new T.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.12, sustain: 0 },
    volume: -10,
  });
  const clankBp = new T.Filter({ frequency: 600, type: "bandpass", Q: 3 });
  clankNoise.chain(clankBp, sfx);
  const clankThock = new T.Synth({
    oscillator: { type: "square" },
    envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.04 },
    volume: -12,
  });
  clankThock.connect(sfx);

  // -- newsprint KRAKA-THOOM (no bright transient by design; bright world)
  const newsMembrane = new T.MembraneSynth({
    pitchDecay: 0.1,
    octaves: 4,
    envelope: { attack: 0.002, decay: 0.6, sustain: 0, release: 0.1 },
    volume: -7,
  });
  newsMembrane.connect(sfx);
  const newsBody = new T.FMSynth({
    harmonicity: 1.5,
    modulationIndex: 6,
    envelope: { attack: 0.002, decay: 0.25, sustain: 0, release: 0.1 },
    volume: -12,
  });
  newsBody.connect(sfx);
  const newsTele = new T.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.01, sustain: 0 },
    volume: -14,
  });
  const newsTeleHp = new T.Filter(3200, "highpass");
  newsTele.chain(newsTeleHp, sfx);

  // -- title drop stamp
  const titleMembrane = new T.MembraneSynth({
    pitchDecay: 0.06,
    octaves: 5,
    envelope: { attack: 0.001, decay: 0.45, sustain: 0, release: 0.1 },
    volume: -6,
  });
  titleMembrane.connect(sfx);
  const titleClang = new T.Synth({
    oscillator: { type: "fatsquare", count: 2, spread: 12 },
    envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.05 },
    volume: -16,
  });
  titleClang.connect(sfx);
  const titleCrack = new T.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.03, sustain: 0 },
    volume: -14,
  });
  titleCrack.connect(sfx);

  // -- screentone edge-run launch (edgeWhoosh reused by pop-orbit-360)
  const edgeMembrane = new T.MembraneSynth({
    pitchDecay: 0.04,
    octaves: 3,
    envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.04 },
    volume: -10,
  });
  edgeMembrane.connect(sfx);
  const edgeScreech = new T.Synth({
    oscillator: { type: "fatsawtooth", count: 3, spread: 18 },
    envelope: { attack: 0.01, decay: 0.3, sustain: 0, release: 0.05 },
    volume: -20,
  });
  const edgeScreechBp = new T.Filter({ frequency: 1200, type: "bandpass", Q: 2 });
  edgeScreech.chain(edgeScreechBp, sfx);
  const edgeWhoosh = new T.NoiseSynth({
    noise: { type: "pink" },
    envelope: { attack: 0.05, decay: 0.3, sustain: 0 },
    volume: -16,
  });
  const edgeWhooshBp = new T.Filter(400, "bandpass");
  edgeWhoosh.chain(edgeWhooshBp, sfx);
  const edgeHorn = new T.FMSynth({
    harmonicity: 1.5,
    modulationIndex: 8,
    envelope: { attack: 0.02, decay: 0.3, sustain: 0, release: 0.1 },
    volume: -16,
  });
  edgeHorn.connect(sfx);

  // -- cat meow: no local synth -- moments fires ui.ts's shared meow voice
  // (fireMeowVoice), so a single FMSynth + ME-OW contour serves click + sfx.

  // -- cat soft-land on the desk: rounder/softer than the beat thump (2 octaves,
  // brown-noise scuff through a lowpass) = a "fwump", not a boom.
  const landThud = new T.MembraneSynth({
    pitchDecay: 0.06,
    octaves: 2,
    envelope: { attack: 0.002, decay: 0.22, sustain: 0, release: 0.1 },
    volume: -9,
  });
  landThud.connect(sfx);
  const landLp = new T.Filter(500, "lowpass");
  const landNoise = new T.NoiseSynth({
    noise: { type: "brown" },
    envelope: { attack: 0.001, decay: 0.08, sustain: 0 },
    volume: -16,
  });
  landNoise.chain(landLp, sfx);

  // -- paw-step tick (sketch walk pad-steps): very short brown-noise pad, quiet.
  const pawLp = new T.Filter(700, "lowpass");
  const pawTick = new T.NoiseSynth({
    noise: { type: "brown" },
    envelope: { attack: 0.001, decay: 0.02, sustain: 0 },
    volume: -26,
  });
  pawTick.chain(pawLp, sfx);

  // -- playful "boop" (cat bats the halftone dot): short triangle blip.
  const boopSyn = new T.Synth({
    oscillator: { type: "triangle" },
    envelope: { attack: 0.004, decay: 0.12, sustain: 0, release: 0.05 },
    volume: -15,
  });
  boopSyn.connect(sfx);

  return {
    clackNoise, clackBp, clackThock,
    ringSyn, ringBp, ringDelay, ringSnap, ringSnapHp,
    partMembrane, partReact, partTs, partTsBp, partRust, partAiA, partAiB,
    hornA, hornB, hornLp, hornDelay,
    popWhoosh, popWhooshBp, popWhooshGain, crowdA, crowdB, crowdC, crowdLp, crowdGain, hushNoise, hushLp,
    inkTick, inkTickHp, washNoise, washLp, washSine,
    starBell, starDelay,
    kachA, kachB, kachDrawer, kachDrawerBp, kachPop, kachPopLp, coin,
    stampMembrane, stampMetal, stampPaper, stampPaperLp,
    clankNoise, clankBp, clankThock,
    newsMembrane, newsBody, newsTele, newsTeleHp,
    titleMembrane, titleClang, titleCrack,
    edgeMembrane, edgeScreech, edgeScreechBp, edgeWhoosh, edgeWhooshBp, edgeHorn,
    landThud, landNoise, landLp, pawTick, pawLp, boopSyn,
  };
}

/* ---------------------------------------------------------- module state --- */
let kit: Kit | null = null;
let TM: ToneModule | null = null;
// True only while the director is enabled (scoreMoments runs each tick). sfx
// one-shots gate on this so a scene handler firing pre-enable / post-disable
// (kit + TM survive disable for cheap re-enable) stays silent.
let momentsActive = false;

const clackEdges = Array.from({ length: 6 }, () => new Edge());
const partEdges = Array.from({ length: 4 }, () => new Edge());
const stationEdges = Array.from({ length: 8 }, () => new Edge());
const inkEdges = Array.from({ length: 6 }, () => new Edge());
const washEdge = new Edge();
const starEdges = Array.from({ length: 10 }, () => new Edge());
const pawEdges = Array.from({ length: 10 }, () => new Edge()); // sketch pad-steps
const allEdges: Edge[] = [
  ...clackEdges,
  ...partEdges,
  ...stationEdges,
  ...inkEdges,
  washEdge,
  ...starEdges,
  ...pawEdges,
];

// neon cascade: step-increment latch (own priming; scrub-back re-arms silent)
let neonPrimed = false;
let neonLast = -1;

// pop 360 continuous bed
let popOn = false;
let popQuiet = 0;
const gWhoosh = { v: 0 };
const gCrowd = { v: 0 };
const fWhooshC = { v: 300 };

/* --------------------------------------------- score-reaction one-shots --- */
function fireClack(k: Kit, now: number, i: number): void {
  k.clackNoise.triggerAttackRelease(0.018, now, 0.6 + 0.2 * h01(i * 7 + 1));
  const f = 180 + ((hash(i * 5 + 2) % 61) - 30); // 180 +/- 30 Hz, hashed
  k.clackThock.triggerAttackRelease(f, 0.04, now, 0.7 + 0.2 * h01(i + 3));
}

function fireRing(k: Kit, now: number, ring: number): void {
  const note = 196 * Math.pow(2, ring / 12); // climb the cascade
  k.ringBp.frequency.rampTo(1500 + 1700 * (ring / 10), 0.02, now);
  let vel = 0.4 + 0.3 * h01(ring * 3 + 1);
  if (ring === 10) vel = Math.min(1, vel * 2); // hero tower +6 dB
  k.ringSyn.triggerAttackRelease(note, 0.05, now, vel);
  if (ring % 2 === 1) k.ringSnap.triggerAttackRelease(0.015, now, 0.4);
}

function firePart(k: Kit, now: number, i: number): void {
  k.partMembrane.triggerAttackRelease("F1", 0.12, now, 0.9);
  if (i === 0) k.partReact.triggerAttackRelease(660, 0.08, now, 0.6);
  else if (i === 1) k.partTs.triggerAttackRelease(440, 0.09, now, 0.6);
  else if (i === 2) k.partRust.triggerAttackRelease(0.1, now, 0.6);
  else {
    k.partAiA.triggerAttackRelease(523.25, 0.12, now, 0.4);
    k.partAiB.triggerAttackRelease(783.99, 0.12, now, 0.4);
  }
}

function fireHorn(k: Kit, now: number): void {
  k.hornA.triggerAttackRelease(155, 0.6, now, 0.7);
  k.hornB.triggerAttackRelease(233, 0.6, now, 0.6);
}

function fireInk(k: Kit, now: number, i: number): void {
  k.inkTick.triggerAttackRelease(0.01, now, 0.4 + 0.3 * h01(i * 9 + 1));
}

function fireWash(k: Kit, now: number): void {
  k.washLp.frequency.cancelScheduledValues(now);
  k.washLp.frequency.setValueAtTime(400, now);
  k.washLp.frequency.linearRampToValueAtTime(2000, now + 0.3);
  k.washNoise.triggerAttackRelease(0.5, now, 0.5);
  k.washSine.triggerAttackRelease(110, 0.5, now, 0.4);
}

function fireStar(k: Kit, now: number, page: number): void {
  k.starBell.triggerAttackRelease(PENTA[page]!, 0.5, now, 0.4 + 0.2 * h01(page + 1));
}

/** 3 hash-varied base pitches so repeat meows never sound identical; fires the
 * ui.ts shared voice (one FMSynth + one ME-OW contour, no duplicate synth). */
const MEOW_BASE = [496, 560, 448] as const;
function fireMeow(now: number, i: number): void {
  const base = MEOW_BASE[hash(i * 7 + 1) % 3]!;
  fireMeowVoice(now, base, 1.4 + 0.12 * h01(i + 5));
}

function fireLand(k: Kit, now: number): void {
  k.landThud.triggerAttackRelease("C2", 0.16, now, 0.75);
  k.landNoise.triggerAttackRelease(0.08, now, 0.6);
}

function firePaw(k: Kit, now: number, i: number): void {
  k.pawLp.frequency.rampTo(600 + (hash(i * 5 + 3) % 240), 0.005, now);
  k.pawTick.triggerAttackRelease(0.02, now, 0.4 + 0.2 * h01(i + 2));
}

function fireBoop(k: Kit, now: number): void {
  const s = k.boopSyn;
  s.triggerAttack(520, now, 0.7);
  s.frequency.rampTo(360, 0.07, now + 0.01); // quick down = "boop"
  s.frequency.rampTo(420, 0.05, now + 0.09); // tiny lift, playful
  s.triggerRelease(now + 0.14);
}

/* --------------------------------------------------------- scoreMoments --- */
/** Called once per director rAF tick while audio is enabled. */
export function scoreMoments(
  T: ToneModule,
  sfx: Gain,
  t: number,
  dtSec: number,
  velocity: number,
): void {
  void velocity; // reactions are pure f(t); velocity is unused here by design
  const k = kit ?? (kit = buildKit(T, sfx));
  if (!TM) TM = T;
  momentsActive = true; // scoreMoments only runs while the director is enabled
  const now = T.now();
  const { reducedMotion } = useScrollStore.getState();

  // -- desk keycap clacks (issue 2): 6 CLACKs on the visible keycap dips
  const kw = KEYS_R[1] - KEYS_R[0];
  for (let i = 0; i < 6; i++) {
    if (clackEdges[i]!.crossed(t, KEYS_R[0] + CLACK_FRACS[i]! * kw, CLACK_HYST)) fireClack(k, now, i);
  }

  // -- neon ring zaps (issue 3): same 0..10 quantization as the visual boot.
  // step -1 below the cascade so ring 0 (the boom) is a real forward increment.
  const step =
    t < NEON_CASCADE_T
      ? -1
      : Math.min(10, Math.floor(clamp01((t - NEON_CASCADE_T) / (NEON_CASCADE_END - NEON_CASCADE_T)) * 11));
  if (!neonPrimed) {
    neonPrimed = true;
    neonLast = step;
  } else if (step > neonLast) {
    fireRing(k, now, step); // fire the newly reached ring only -- no burst
    neonLast = step;
  } else if (step < neonLast) {
    neonLast = step; // scrub-back re-arms silently
  }

  // -- press part-add thumps (issue 5): 4 departments welding on
  for (let i = 0; i < 4; i++) {
    if (partEdges[i]!.crossed(t, PRESS_PART_T[i]!, PART_HYST)) firePart(k, now, i);
  }

  // -- screentone far-off horn (issue 7): arrival at each station, moving only
  const tx = trainX(t);
  for (let i = 0; i < 8; i++) {
    if (stationEdges[i]!.crossed(tx, STATION_X[i]!, STATION_HYST) && trainSpeed(t) > 0.2) fireHorn(k, now);
  }

  // -- pop 360 whoosh + crowd (issue 8): continuous, pure f(t) both directions
  const tLocal8 = clamp01((t - POP_RANGE[0]) / (POP_RANGE[1] - POP_RANGE[0]));
  const pp = clamp01((tLocal8 - ORBIT_F) / (1 - ORBIT_F));
  const spd = Math.min(1, 6 * pp * (1 - pp)); // d/dp easeInOut, peaks mid-spin
  const swell = Math.sin(Math.PI * pp);
  const popActive = pp > 0.0001 && pp < 0.9999 && (spd > 0.002 || swell > 0.002);
  if (popActive) {
    if (!popOn) {
      k.popWhoosh.start();
      k.crowdA.start();
      k.crowdB.start();
      k.crowdC.start();
      k.hushNoise.start();
      popOn = true;
    }
    popQuiet = 0;
    moveTo(k.popWhooshBp.frequency, fWhooshC, 300 + 900 * swell, 0.05, 20);
  } else if (popOn) {
    popQuiet += dtSec;
    if (popQuiet > 0.3) {
      k.popWhoosh.stop();
      k.crowdA.stop();
      k.crowdB.stop();
      k.crowdC.stop();
      k.hushNoise.stop();
      popOn = false;
    }
  }
  moveTo(k.popWhooshGain.gain, gWhoosh, popActive ? spd : 0, 0.05, 0.01);
  moveTo(k.crowdGain.gain, gCrowd, popActive ? swell * 0.7 : 0, 0.06, 0.01);

  // -- sketch ink ticks + wash flood (issue 9)
  const u9 = inkAt(t);
  for (let i = 0; i < 6; i++) {
    if (inkEdges[i]!.crossed(u9, 0.16 + i * 0.075, INK_HYST)) fireInk(k, now, i);
  }
  if (washEdge.crossed(u9, FLOOD_U, INK_HYST)) fireWash(k, now);

  // -- sketch cat pad-steps (issue 9): one soft pad per visible pawprint decal
  // (pawprint uSeed = 0.22 + 0.3*k/9 in Sketchbook.tsx); scrub-safe both ways.
  // Parked under reduced motion (the sketch cat is stopped, so no footsteps).
  if (!reducedMotion) {
    for (let i = 0; i < 10; i++) {
      if (pawEdges[i]!.crossed(u9, 0.22 + (0.3 * i) / 9, PAW_HYST)) firePaw(k, now, i);
    }
  }

  // -- spread star-chart arp (issue 10): one shimmer per page reveal, stops at 10
  const u10 = clamp01((t - UNFOLD_RANGE[0]) / (UNFOLD_RANGE[1] - UNFOLD_RANGE[0]));
  for (let i = 0; i < 10; i++) {
    if (starEdges[i]!.crossed(u10, i * 0.055, STAR_HYST)) fireStar(k, now, i);
  }
}

/* ----------------------------------------------------------- beatMoment --- */
/**
 * setBeatSound handler. Returns true when a moment owns the hit (a custom
 * sound OR a deliberate silence), false to fall through to the caller's
 * default thump/chime. Silent until scoreMoments has built the kit under an
 * enabled director -- the gesture gate is inherited.
 */
export function beatMoment(id: string, flash: number): boolean {
  const T = TM;
  const k = kit;
  if (!T || !k) return false;
  const now = T.now();
  const v = Math.min(Math.max(flash, 0), 1);

  switch (id) {
    case "pop-donation": {
      const vel = 0.5 + 0.5 * v;
      k.kachA.triggerAttackRelease("E6", 0.35, now, vel);
      k.kachB.triggerAttackRelease("G#6", 0.35, now + 0.06, vel);
      k.kachDrawer.triggerAttackRelease(0.07, now, 0.5);
      k.kachPopLp.frequency.rampTo(800, 0.02, now);
      k.kachPop.triggerAttackRelease(0.4, now, 0.5);
      k.coin.triggerAttackRelease("B6", 0.05, now + 0.12, 0.4);
      k.coin.triggerAttackRelease("D7", 0.05, now + 0.18, 0.4);
      k.coin.triggerAttackRelease("G7", 0.05, now + 0.24, 0.4);
      return true;
    }
    case "press-stamp": {
      k.stampMembrane.triggerAttackRelease("G0", 0.5, now, v);
      k.stampMetal.triggerAttackRelease(0.12, now, 0.8 * v);
      k.stampPaperLp.frequency.rampTo(1200, 0.02, now);
      k.stampPaper.triggerAttackRelease(0.12, now, 0.6);
      k.stampMetal.triggerAttackRelease(0.1, now + 0.07, 0.4); // rebound tick
      return true;
    }
    case "press-clank": {
      k.clankNoise.triggerAttackRelease(0.12, now, 0.7);
      k.clankThock.triggerAttackRelease(90, 0.15, now, 0.7);
      return true;
    }
    case "newsprint-flood": {
      k.newsMembrane.triggerAttackRelease("E1", 0.6, now, 0.6);
      k.newsBody.triggerAttackRelease(55, 0.4, now, 0.5);
      const seed = 101;
      const count = 8 + Math.floor(h01(seed) * 5); // 8..12 teletype clicks
      let ti = now + 0.02;
      let gap = 0.05;
      for (let i = 0; i < count; i++) {
        k.newsTele.triggerAttackRelease(0.01, ti, 0.3 + 0.25 * h01(seed + i * 3));
        gap = gap * 0.82 + 0.003 * h01(seed * 7 + i); // accelerating + jitter
        ti += Math.max(gap, 0.012);
      }
      return true;
    }
    case "title-drop": {
      k.titleMembrane.triggerAttackRelease("A1", 0.3, now, v);
      k.titleClang.triggerAttackRelease(660, 0.12, now, 0.5 * v);
      k.titleCrack.triggerAttackRelease(0.03, now, 0.5 * v);
      return true;
    }
    case "screentone-edge-run": {
      let ti = now; // accelerating wheel clatter 8 -> 16 Hz
      const hits = 7;
      for (let i = 0; i < hits; i++) {
        k.edgeMembrane.triggerAttackRelease("A1", 0.08, ti, (0.5 + 0.2 * h01(i + 1)) * v);
        ti += 1 / (8 + 8 * (i / (hits - 1)));
      }
      k.edgeScreech.triggerAttackRelease(300, 0.3, now, 0.5 * v); // wheel screech
      k.edgeScreech.frequency.rampTo(700, 0.28, now + 0.01);
      k.edgeWhooshBp.frequency.cancelScheduledValues(now); // rising doppler
      k.edgeWhooshBp.frequency.setValueAtTime(400, now);
      k.edgeWhooshBp.frequency.linearRampToValueAtTime(3000, now + 0.3);
      k.edgeWhoosh.triggerAttackRelease(0.35, now, 0.6 * v);
      k.edgeHorn.triggerAttackRelease(110, 0.3, now, 0.5 * v); // low horn
      return true;
    }
    case "origin-portal": {
      k.starBell.triggerAttackRelease(440, 0.9, now, 0.35); // airy pad into the tail
      return true;
    }
    case "sketch-print-run": {
      k.kachPopLp.frequency.rampTo(500, 0.02, now);
      k.kachPop.triggerAttackRelease(0.4, now, 0.35); // near-silent roller finish
      return true;
    }
    case "terminal-back-cover": {
      k.stampMembrane.triggerAttackRelease("C2", 0.3, now, 0.4); // soft book close
      k.kachPopLp.frequency.rampTo(300, 0.02, now);
      k.kachPop.triggerAttackRelease(0.3, now, 0.4); // "fwump"
      return true;
    }
    case "pop-orbit-360": {
      k.edgeWhooshBp.frequency.cancelScheduledValues(now); // doppler swoop 500->2500->500
      k.edgeWhooshBp.frequency.setValueAtTime(500, now);
      k.edgeWhooshBp.frequency.linearRampToValueAtTime(2500, now + 0.25);
      k.edgeWhooshBp.frequency.linearRampToValueAtTime(500, now + 0.5);
      k.edgeWhoosh.triggerAttackRelease(0.5, now, 0.6);
      return true;
    }
    case "neon-cascade":
      return true; // rings own the audio -- deliberate silence (visual flash stays)
    default:
      return false; // unrouted: caller plays its default thump/chime
  }
}

/* ------------------------------------------------------------ sfxMoment --- */
/** Scene-facing one-shot names (scenes pass these as string literals). */
export type SfxName = "meow" | "softLand" | "boop" | "pad";

/**
 * Scene-local one-shot trigger. Scenes call this at the exact crossings that
 * already fire sayWord (both scroll directions -- reverse-scrub hits are fine)
 * so onomatopoeia and sound stay paired. No-op unless the director is enabled
 * (momentsActive) AND scoreMoments has built the kit (gesture gate inherited,
 * like beatMoment); try/catch-wrapped so any Tone failure degrades to silence.
 * Scenes import ONLY this -- never Tone (moments.ts imports Tone as types only).
 */
export function sfxMoment(name: SfxName, seed = 0): void {
  const T = TM;
  const k = kit;
  if (!momentsActive || !T || !k) return;
  try {
    const now = T.now();
    switch (name) {
      case "meow":
        fireMeow(now, seed);
        break;
      case "softLand": // desk-touch thud PLUS a cat chirp ~80ms later
        fireLand(k, now);
        fireMeow(now + 0.08, seed + 17);
        break;
      case "boop":
        fireBoop(k, now);
        break;
      case "pad":
        firePaw(k, now, seed);
        break;
      default:
        break;
    }
  } catch (e) {
    void e; // silent degrade (matches director/ui wiring)
  }
}

/* ----------------------------------------------------------- stopMoments --- */
/** Disable path: silence + stop continuous sources, re-prime all latches. */
export function stopMoments(): void {
  for (const e of allEdges) e.reset();
  neonPrimed = false;
  neonLast = -1;
  momentsActive = false; // sfxMoment goes silent until the director re-enables
  const k = kit;
  if (!k) return;
  gWhoosh.v = 0;
  gCrowd.v = 0;
  k.popWhooshGain.gain.rampTo(0, 0.1);
  k.crowdGain.gain.rampTo(0, 0.1);
  if (popOn) {
    k.popWhoosh.stop();
    k.crowdA.stop();
    k.crowdB.stop();
    k.crowdC.stop();
    k.hushNoise.stop();
    popOn = false;
  }
}
