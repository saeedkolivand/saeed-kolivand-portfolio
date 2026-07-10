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
  Panner,
  Synth,
} from "tone";
import { clamp01 } from "@/lib/shots";
import { useScrollStore } from "@/lib/scrollStore";
import { RANGES } from "@/issues/timeline";
import type { ToneModule } from "./types";
import { h01, hash, moveTo } from "./util";
import { fireMeowVoice } from "./ui";
import { logFire } from "./debug";
// Read-only scene constants (all already exported). These are pure numbers /
// pure f(t) helpers -- importing them adds NO Tone at module scope and no new
// autoplay path (Tone stays lazy, handed in via scoreMoments' T argument).
import { NOIR_SHOTS } from "@/issues/01-noir/shots";
import { KEYS_R, PANELS_R } from "@/issues/02-desk/shots";
import { NEON_CASCADE_END, NEON_CASCADE_T } from "@/issues/03-neon/shots";
import { ORIGIN_CAT_HOP, ORIGIN_CAT_WALK } from "@/issues/04-origin/shots";
import { PRESS_CTA_IN, PRESS_PART_T } from "@/issues/05-press/shots";
import { STATION_X, trainDisplayX, trainSpeed, trainX } from "@/issues/07-screentone/shots";
import { ORBIT_START_T } from "@/issues/08-pop/shots";
import { FLOOD_T, inkAt } from "@/issues/09-sketchbook/shots";
import { UNFOLD_RANGE } from "@/issues/10-spread/shots";
import { CAT_WALK_RANGE } from "@/issues/11-terminal/shots";

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

/* ------------------------------------------------------------- VoiceGate --- */
/** Strictly-increasing start-time gate for one mono voice. at() returns the
 * admissible start (bumped past the voice's busy window if needed). One fast
 * scrub or a single frame crossing several Edge thresholds of one bank would
 * otherwise start the same synth twice at the same/inverted time -> Tone's
 * "Start time must be strictly greater than previous start time" RangeError,
 * which the director catch turns into a global audio disable. */
class VoiceGate {
  private free = 0;
  at(now: number, busy: number): number {
    const a = now <= this.free ? this.free + 0.008 : now;
    this.free = a + busy;
    return a;
  }
  reset(): void {
    this.free = 0;
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
const NOIR_PAW_HYST = 0.02; // < noir stride spacing (1/9) so each step re-arms

// screentone station machine: DWELL stations get brake/chime/depart; the two
// PASS stations get the horn + a dedicated pass-whoosh (indices from KNOTS).
const DWELL_STATIONS = [0, 1, 2, 4, 6, 7] as const;
const PASS_STATIONS = [3, 5] as const;
const R7 = RANGES[7]!;

// desk panel-drop pops: 3 comic panels land across PANELS_R with a note step.
const PANEL_FRACS = [0.1, 0.42, 0.74] as const;
const PANEL_NOTES = ["C3", "D3", "E3"] as const;

const POP_RANGE = RANGES[8]!;
/**
 * ORBIT_F is not exported by 08-pop; derive it from ORBIT_START_T. Computed
 * lazily (NOT at module scope): spawnChat now calls sfxMoment, so moments and
 * 08-pop/shots form an import cycle -- reading ORBIT_START_T at module scope
 * could hit its TDZ if 08-pop/shots is the cycle entry. At first tick both
 * modules are fully evaluated.
 */
let orbitF = -1;
const orbitFrac = () =>
  orbitF < 0 ? (orbitF = (ORBIT_START_T - POP_RANGE[0]) / (POP_RANGE[1] - POP_RANGE[0])) : orbitF;
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
  // screentone station machine (brake / PA chime / door beep / pass-whoosh),
  // all placed on screen by trainPan while the train is in the issue window
  trainPan: Panner;
  brakeSqueal: Synth;
  brakeBp: Filter;
  brakeHiss: NoiseSynth;
  brakeHissHp: Filter;
  chimeSyn: Synth;
  departSyn: Synth;
  passWhoosh: NoiseSynth;
  passWhooshBp: Filter;
  // neon sign-ignition buzz (FM crackle + a reused ring snap)
  signBuzz: FMSynth;
  // pop chat-balloon bloops, panned per balloon
  chatBloop: Synth;
  chatPan: Panner;
  // spread page-riffle whoosh, alternating L/R with the fan-out
  pageWhoosh: NoiseSynth;
  pageWhooshBp: Filter;
  spreadPan: Panner;
  // terminal resume paper-flutter
  flutter: NoiseSynth;
  flutterBp: Filter;
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
  // paw steps route through catPan (default center); the terminal walk-off
  // ramps it stage-right per step. Every firePaw sets the pan, so no other
  // scene inherits a stale offset.
  catPan: Panner;
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

  // -- screentone station machine, all through trainPan (screen placement)
  const trainPan = new T.Panner(0);
  trainPan.connect(sfx);
  // brake squeal: descending fatsaw through a tight bandpass + an air hiss
  const brakeBp = new T.Filter({ frequency: 2400, type: "bandpass", Q: 4 });
  brakeBp.connect(trainPan);
  const brakeSqueal = new T.Synth({
    oscillator: { type: "fatsawtooth", count: 3, spread: 20 },
    envelope: { attack: 0.02, decay: 0.5, sustain: 0.3, release: 0.15 },
    volume: -22,
  });
  brakeSqueal.connect(brakeBp);
  const brakeHissHp = new T.Filter(3500, "highpass");
  brakeHissHp.connect(trainPan);
  const brakeHiss = new T.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.02, decay: 0.25, sustain: 0.1, release: 0.15 },
    volume: -20,
  });
  brakeHiss.connect(brakeHissHp);
  // PA ding-dong chime (rides the global hall reverb on the sfx bus)
  const chimeSyn = new T.Synth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.005, decay: 0.35, sustain: 0, release: 0.3 },
    volume: -20,
  });
  chimeSyn.connect(trainPan);
  // door double-beep on departure
  const departSyn = new T.Synth({
    oscillator: { type: "square" },
    envelope: { attack: 0.002, decay: 0.06, sustain: 0, release: 0.03 },
    volume: -22,
  });
  departSyn.connect(trainPan);
  // pass-whoosh: pink noise through a falling bandpass (train blows past)
  const passWhooshBp = new T.Filter({ frequency: 2400, type: "bandpass", Q: 1.2 });
  passWhooshBp.connect(trainPan);
  const passWhoosh = new T.NoiseSynth({
    noise: { type: "pink" },
    envelope: { attack: 0.02, decay: 0.4, sustain: 0.2, release: 0.15 },
    volume: -16,
  });
  passWhoosh.connect(passWhooshBp);

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

  // -- neon sign-ignition buzz (FM crackle; the snap reuses ringSnap above)
  const signBuzz = new T.FMSynth({
    harmonicity: 1,
    modulationIndex: 20,
    envelope: { attack: 0.005, decay: 0.18, sustain: 0, release: 0.08 },
    volume: -20,
  });
  signBuzz.connect(sfx);

  // -- pop chat-balloon bloops (rising sine, panned per balloon)
  const chatPan = new T.Panner(0);
  chatPan.connect(sfx);
  const chatBloop = new T.Synth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.05 },
    volume: -18,
  });
  chatBloop.connect(chatPan);

  // -- spread page-riffle whoosh (rising bandpass, alternating L/R fan-out)
  const spreadPan = new T.Panner(0);
  spreadPan.connect(sfx);
  const pageWhooshBp = new T.Filter(500, "bandpass");
  pageWhooshBp.connect(spreadPan);
  const pageWhoosh = new T.NoiseSynth({
    noise: { type: "pink" },
    envelope: { attack: 0.02, decay: 0.28, sustain: 0 },
    volume: -20,
  });
  pageWhoosh.connect(pageWhooshBp);

  // -- terminal resume paper-flutter (pink noise, stepped-down bandpass)
  const flutterBp = new T.Filter(1600, "bandpass");
  flutterBp.connect(sfx);
  const flutter = new T.NoiseSynth({
    noise: { type: "pink" },
    envelope: { attack: 0.002, decay: 0.05, sustain: 0 },
    volume: -22,
  });
  flutter.connect(flutterBp);

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

  // -- paw-step tick (walk pad-steps): very short brown-noise pad, quiet.
  // Routed through catPan so the terminal walk-off can pan steps stage-right;
  // every firePaw sets the pan (default 0) so other scenes stay centered.
  const catPan = new T.Panner(0);
  catPan.connect(sfx);
  const pawLp = new T.Filter(700, "lowpass");
  const pawTick = new T.NoiseSynth({
    noise: { type: "brown" },
    envelope: { attack: 0.001, decay: 0.02, sustain: 0 },
    volume: -26,
  });
  pawTick.chain(pawLp, catPan);

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
    trainPan, brakeSqueal, brakeBp, brakeHiss, brakeHissHp, chimeSyn, departSyn, passWhoosh, passWhooshBp,
    signBuzz,
    chatBloop, chatPan,
    pageWhoosh, pageWhooshBp, spreadPan,
    flutter, flutterBp,
    popWhoosh, popWhooshBp, popWhooshGain, crowdA, crowdB, crowdC, crowdLp, crowdGain, hushNoise, hushLp,
    inkTick, inkTickHp, washNoise, washLp, washSine,
    starBell, starDelay,
    kachA, kachB, kachDrawer, kachDrawerBp, kachPop, kachPopLp, coin,
    stampMembrane, stampMetal, stampPaper, stampPaperLp,
    clankNoise, clankBp, clankThock,
    newsMembrane, newsBody, newsTele, newsTeleHp,
    titleMembrane, titleClang, titleCrack,
    edgeMembrane, edgeScreech, edgeScreechBp, edgeWhoosh, edgeWhooshBp, edgeHorn,
    landThud, landNoise, landLp, pawTick, pawLp, catPan, boopSyn,
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
const panelEdges = Array.from({ length: 3 }, () => new Edge()); // desk panel drops
const brakeEdges = Array.from({ length: 6 }, () => new Edge()); // screentone DWELL
const chimeEdges = Array.from({ length: 6 }, () => new Edge());
const departEdges = Array.from({ length: 6 }, () => new Edge());
const passEdges = Array.from({ length: 2 }, () => new Edge()); // screentone PASS
const ctaEdge = new Edge(); // press CTA plop
const pawEdgesNoir = Array.from({ length: 9 }, () => new Edge()); // noir parapet
const pawEdgesOrigin = Array.from({ length: 6 }, () => new Edge()); // origin margin
const hopEdgeOrigin = new Edge();
const catWalkEdges = Array.from({ length: 8 }, () => new Edge()); // terminal exit
const catHopEdge = new Edge();
const allEdges: Edge[] = [
  ...clackEdges,
  ...partEdges,
  ...stationEdges,
  ...inkEdges,
  washEdge,
  ...starEdges,
  ...pawEdges,
  ...panelEdges,
  ...brakeEdges,
  ...chimeEdges,
  ...departEdges,
  ...passEdges,
  ctaEdge,
  ...pawEdgesNoir,
  ...pawEdgesOrigin,
  hopEdgeOrigin,
  ...catWalkEdges,
  catHopEdge,
];

// Per-voice monotonic start-time gates: one per mono voice that a bank loop or
// shared usage can start more than once per tick. Every fire* below routes its
// synth start(s) through the matching gate so a multi-cross frame staggers the
// starts instead of throwing (params/filters are not gated -- only synth starts).
const clackGate = new VoiceGate(); // desk clackNoise/clackThock pair (+ panel clack)
const partGate = new VoiceGate(); // press part-add voices
const hornGate = new VoiceGate(); // screentone hornA + hornB
const inkGate = new VoiceGate(); // sketch ink ticks + noir wet-splash tick
const starGate = new VoiceGate(); // spread starBell + pageWhoosh
const brakeGate = new VoiceGate(); // screentone brakeSqueal + brakeHiss
const chimeGate = new VoiceGate(); // screentone PA chime
const departGate = new VoiceGate(); // screentone door beep
const passGate = new VoiceGate(); // screentone pass-whoosh
const pawGate = new VoiceGate(); // cat pawTick (every pad-step bank)
const landGate = new VoiceGate(); // landThud + landNoise (land/hop/panel/resumeDrop)
const kachGate = new VoiceGate(); // kachPop (cta plop + resumeDrop share it)
const boopGate = new VoiceGate(); // boopSyn (boop + cta plop)
const chatGate = new VoiceGate(); // pop chatBloop
const signGate = new VoiceGate(); // neon signBuzz
const flutterGate = new VoiceGate(); // terminal resume flutter
const ringGate = new VoiceGate(); // neon ringSyn (fireRing primary voice)
const washGate = new VoiceGate(); // sketch washNoise + washSine flood
const edgeGate = new VoiceGate(); // edgeWhoosh shared: leap + edge-run + orbit-360
const stampGate = new VoiceGate(); // stampMembrane shared: press-stamp + terminal-back-cover
const ringSnapGate = new VoiceGate(); // ringSnap shared: fireRing + fireSignBuzz (same cascade frame)
const gates: VoiceGate[] = [
  clackGate, partGate, hornGate, inkGate, starGate, brakeGate, chimeGate,
  departGate, passGate, pawGate, landGate, kachGate, boopGate, chatGate,
  signGate, flutterGate, ringGate, washGate, edgeGate, stampGate, ringSnapGate,
];

// deep-jump guard: a t delta this large is a teleport (print<->3D toggle,
// JumpCover nav, scrollbar drag), not a scroll -- without it every crossed Edge
// fires, serialized by the VoiceGates into seconds of machine-gun sound. NaN =
// unprimed (first tick after enable / reset). See the top of scoreMoments.
let lastScoreT = NaN;

// neon cascade: step-increment latch (own priming; scrub-back re-arms silent)
let neonPrimed = false;
let neonLast = -1;

// pop 360 continuous bed
let popOn = false;
let popQuiet = 0;
const gWhoosh = { v: 0 };
const gCrowd = { v: 0 };
const fWhooshC = { v: 300 };

// screentone train panner (only ramped while t is inside the issue window)
const gTrainPan = { v: 0 };

/* --------------------------------------------- score-reaction one-shots --- */
function fireClack(k: Kit, now: number, i: number): void {
  logFire("clack");
  now = clackGate.at(now, 0.1);
  k.clackNoise.triggerAttackRelease(0.018, now, 0.6 + 0.2 * h01(i * 7 + 1));
  const f = 180 + ((hash(i * 5 + 2) % 61) - 30); // 180 +/- 30 Hz, hashed
  k.clackThock.triggerAttackRelease(f, 0.04, now, 0.7 + 0.2 * h01(i + 3));
}

function fireRing(k: Kit, now: number, ring: number): void {
  logFire("ring");
  // step latch advances to `step` in one assignment (fires once per tick), but a
  // scrub oscillating across the cascade could re-arm within the 0.05 release --
  // gate so ringSyn/ringSnap never re-attack before a pending release.
  now = ringGate.at(now, 0.3);
  const note = 196 * Math.pow(2, ring / 12); // climb the cascade
  k.ringBp.frequency.rampTo(1500 + 1700 * (ring / 10), 0.02, now);
  let vel = 0.4 + 0.3 * h01(ring * 3 + 1);
  if (ring === 10) vel = Math.min(1, vel * 2); // hero tower +6 dB
  k.ringSyn.triggerAttackRelease(note, 0.05, now, vel);
  // ringSnap is shared with fireSignBuzz in the same cascade frame -> own gate
  if (ring % 2 === 1) k.ringSnap.triggerAttackRelease(0.015, ringSnapGate.at(now, 0.15), 0.4);
}

function firePart(k: Kit, now: number, i: number): void {
  logFire("part");
  now = partGate.at(now, 0.2);
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
  logFire("horn");
  now = hornGate.at(now, 0.6);
  k.hornA.triggerAttackRelease(155, 0.6, now, 0.7);
  k.hornB.triggerAttackRelease(233, 0.6, now, 0.6);
}

function fireInk(k: Kit, now: number, i: number): void {
  logFire("ink");
  now = inkGate.at(now, 0.05);
  k.inkTick.triggerAttackRelease(0.01, now, 0.4 + 0.3 * h01(i * 9 + 1));
}

function fireWash(k: Kit, now: number): void {
  logFire("wash");
  now = washGate.at(now, 0.4); // washNoise/washSine hold 0.5s; guard re-fire across FLOOD_U
  k.washLp.frequency.cancelScheduledValues(now);
  k.washLp.frequency.setValueAtTime(400, now);
  k.washLp.frequency.linearRampToValueAtTime(2000, now + 0.3);
  k.washNoise.triggerAttackRelease(0.5, now, 0.5);
  k.washSine.triggerAttackRelease(110, 0.5, now, 0.4);
}

function fireStar(k: Kit, now: number, page: number): void {
  logFire("star");
  now = starGate.at(now, 0.3);
  k.starBell.triggerAttackRelease(PENTA[page]!, 0.5, now, 0.4 + 0.2 * h01(page + 1));
  // page-riffle whoosh: rising bandpass, alternating L/R widening (the fan-out)
  k.spreadPan.pan.rampTo((page % 2 ? 1 : -1) * (0.25 + 0.045 * page), 0.01, now);
  k.pageWhooshBp.frequency.cancelScheduledValues(now);
  k.pageWhooshBp.frequency.setValueAtTime(500, now);
  k.pageWhooshBp.frequency.linearRampToValueAtTime(1400, now + 0.25);
  k.pageWhoosh.triggerAttackRelease(0.28, now, 0.4 + 0.2 * h01(page));
}

/* --- screentone station machine (all voices routed through trainPan) ------- */
function fireBrake(k: Kit, now: number): void {
  logFire("brake");
  now = brakeGate.at(now, 0.55);
  k.brakeSqueal.triggerAttack(1400, now, 0.5);
  k.brakeSqueal.frequency.rampTo(600, 0.5, now); // descending metal squeal
  k.brakeSqueal.triggerRelease(now + 0.5);
  k.brakeHiss.triggerAttackRelease(0.2, now + 0.35, 0.5); // air-brake release
}

function fireChime(k: Kit, now: number, i: number): void {
  logFire("chime");
  now = chimeGate.at(now, 0.3);
  const detune = Math.pow(2, ((hash(i) % 3) - 1) / 12); // +/- 1 semitone
  k.chimeSyn.triggerAttackRelease(659.25 * detune, 0.35, now, 0.6); // E5 ding
  k.chimeSyn.triggerAttackRelease(523.25 * detune, 0.4, now + 0.28, 0.6); // C5 dong
}

function fireDepart(k: Kit, now: number): void {
  logFire("depart");
  now = departGate.at(now, 0.2);
  k.departSyn.triggerAttackRelease(783.99, 0.05, now, 0.35); // G5 door beep
  k.departSyn.triggerAttackRelease(783.99, 0.05, now + 0.09, 0.35);
}

function firePass(k: Kit, now: number, sp: number): void {
  logFire("pass");
  now = passGate.at(now, 0.5);
  k.passWhooshBp.frequency.cancelScheduledValues(now);
  k.passWhooshBp.frequency.setValueAtTime(2400, now);
  k.passWhooshBp.frequency.linearRampToValueAtTime(500, now + 0.45); // falling = passing
  k.passWhoosh.triggerAttackRelease(0.45, now, 0.5 + 0.3 * sp);
}

/* --- other scene one-shots -------------------------------------------------- */
function firePanel(k: Kit, now: number, i: number): void {
  logFire("panel");
  // two shared voices: gate each in its own family (clack pair / land pair).
  k.clackNoise.triggerAttackRelease(0.018, clackGate.at(now, 0.1), 0.5);
  k.landThud.triggerAttackRelease(PANEL_NOTES[i]!, 0.16, landGate.at(now, 0.2), 0.4);
}

function firePlop(k: Kit, now: number): void {
  logFire("plop");
  // kachPop shares kachGate with resumeDrop; boopSyn shares boopGate with boop.
  const kp = kachGate.at(now, 0.3);
  k.kachPopLp.frequency.rampTo(600, 0.02, kp);
  k.kachPop.triggerAttackRelease(0.4, kp, 0.4);
  const bp = boopGate.at(now, 0.25);
  k.boopSyn.triggerAttack(300, bp, 0.5);
  k.boopSyn.frequency.rampTo(240, 0.08, bp + 0.01);
  k.boopSyn.triggerRelease(bp + 0.14);
}

function fireHop(k: Kit, now: number): void {
  logFire("hop");
  now = landGate.at(now, 0.2);
  k.landThud.triggerAttackRelease("C3", 0.16, now, 0.3);
}

function fireSignBuzz(k: Kit, now: number, seed: number): void {
  logFire("signBuzz");
  now = signGate.at(now, 0.2);
  const freq = 55 * Math.pow(2, 3 + (hash(seed) % 12) / 12);
  k.signBuzz.triggerAttackRelease(freq, 0.18, now, 0.5);
  k.ringSnap.triggerAttackRelease(0.015, ringSnapGate.at(now, 0.15), 0.3); // ignition snap (shared voice -> gated)
}

function fireChatPop(k: Kit, now: number, seed: number): void {
  logFire("chatPop");
  now = chatGate.at(now, 0.15);
  k.chatPan.pan.rampTo((h01(seed * 7 + 2) - 0.5) * 1.1, 0.01, now);
  const base = 520 + 240 * h01(seed + 3);
  k.chatBloop.triggerAttack(base, now, 0.5);
  k.chatBloop.frequency.rampTo(base * 1.35, 0.05, now); // rising = appearing
  k.chatBloop.triggerRelease(now + 0.12);
}

function fireResumeDrop(k: Kit, now: number): void {
  logFire("resumeDrop");
  now = flutterGate.at(now, 0.4); // the 3-tap flutter sequence rides this base
  k.flutterBp.frequency.cancelScheduledValues(now);
  k.flutterBp.frequency.setValueAtTime(1600, now);
  k.flutter.triggerAttackRelease(0.05, now, 0.5);
  k.flutterBp.frequency.setValueAtTime(1200, now + 0.12);
  k.flutter.triggerAttackRelease(0.05, now + 0.12, 0.45);
  k.flutterBp.frequency.setValueAtTime(900, now + 0.26);
  k.flutter.triggerAttackRelease(0.05, now + 0.26, 0.4);
  // fwump: the sheet settles onto the desk snapshot -- landThud + kachPop are
  // shared, so gate each in its own family (not just the flutter base).
  const fwump = landGate.at(now + 0.5, 0.2);
  k.landThud.triggerAttackRelease("C2", 0.16, fwump, 0.35);
  const pop = kachGate.at(now + 0.5, 0.3);
  k.kachPopLp.frequency.setValueAtTime(400, pop);
  k.kachPop.triggerAttackRelease(0.4, pop, 0.4);
}

/** 3 hash-varied base pitches so repeat meows never sound identical; fires the
 * ui.ts shared voice (one FMSynth + one ME-OW contour, no duplicate synth). */
const MEOW_BASE = [496, 560, 448] as const;
function fireMeow(now: number, i: number): void {
  logFire("meow");
  const base = MEOW_BASE[hash(i * 7 + 1) % 3]!;
  fireMeowVoice(now, base, 1.4 + 0.12 * h01(i + 5));
}

function fireLand(k: Kit, now: number): void {
  logFire("land");
  now = landGate.at(now, 0.2);
  k.landThud.triggerAttackRelease("C2", 0.16, now, 0.75);
  k.landNoise.triggerAttackRelease(0.08, now, 0.6);
}

/** vel + pan default to the quiet self-hashed pad centered; the terminal
 * walk-off passes a per-step velocity ramp + a widening stage-right pan. */
function firePaw(k: Kit, now: number, i: number, vel = 0.4 + 0.2 * h01(i + 2), pan = 0): void {
  logFire("paw");
  now = pawGate.at(now, 0.05);
  k.catPan.pan.rampTo(pan, 0.02, now);
  k.pawLp.frequency.rampTo(600 + (hash(i * 5 + 3) % 240), 0.005, now);
  k.pawTick.triggerAttackRelease(0.02, now, vel);
}

function fireBoop(k: Kit, now: number): void {
  logFire("boop");
  now = boopGate.at(now, 0.25);
  const s = k.boopSyn;
  s.triggerAttack(520, now, 0.7);
  s.frequency.rampTo(360, 0.07, now + 0.01); // quick down = "boop"
  s.frequency.rampTo(420, 0.05, now + 0.09); // tiny lift, playful
  s.frequency.rampTo(900, 0.06, now + 0.15); // bat contact -> dot flight up
  s.triggerRelease(now + 0.24);
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
  const k = kit ?? (kit = buildKit(T, sfx));
  if (!TM) TM = T;
  momentsActive = true; // scoreMoments only runs while the director is enabled
  const now = T.now();
  const { reducedMotion } = useScrollStore.getState();
  // anti catch-up (systemic): any large t jump -- print<->3D toggle, JumpCover
  // nav, scrollbar drag -- would otherwise fire EVERY Edge it crossed, the
  // VoiceGates serializing them into a machine-gun volley. On such a jump reset
  // every latch and skip this tick's fires entirely; the edges re-prime silently
  // next tick (BeatRunner deep-jump semantics), so no source can catch-up burst.
  if (!Number.isNaN(lastScoreT) && Math.abs(t - lastScoreT) > 0.03) {
    for (const e of allEdges) e.reset();
    neonPrimed = false;
    neonLast = -1;
    lastScoreT = t;
    return;
  }
  lastScoreT = t;
  // anti-machine-gun: motion-narrating banks with >4 latches also gate on speed
  // so a fling riffles past silent instead of stuttering (global rule).
  const slow = Math.abs(velocity) < 0.5;

  // -- desk keycap clacks (issue 2): 6 CLACKs on the visible keycap dips
  const kw = KEYS_R[1] - KEYS_R[0];
  for (let i = 0; i < 6; i++) {
    if (clackEdges[i]!.crossed(t, KEYS_R[0] + CLACK_FRACS[i]! * kw, CLACK_HYST)) fireClack(k, now, i);
  }

  // -- desk panel-drop pops (issue 2): 3 comic panels land, each a clack + thud
  const panelW = PANELS_R[1] - PANELS_R[0];
  for (let i = 0; i < 3; i++) {
    if (panelEdges[i]!.crossed(t, PANELS_R[0] + PANEL_FRACS[i]! * panelW, CLACK_HYST)) firePanel(k, now, i);
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

  // -- noir cat pad-steps (issue 1): wet ink steps down the parapet (shot 3),
  // motion-narrating -> reduced-motion + fling suppressed. crossed() runs every
  // tick (brake/depart pattern) so latches never freeze during a fast scroll and
  // volley when velocity drops; only the FIRE gates on !reducedMotion && slow.
  // step 0 threshold floored at 0.02: p3 is clamp01'd, so an Edge primed at 0
  // never crosses upward (same fix as spread star[0]).
  const noirR = NOIR_SHOTS[2]!.range;
  const p3 = clamp01((t - noirR[0]) / (noirR[1] - noirR[0]));
  for (let i = 0; i < 9; i++) {
    if (pawEdgesNoir[i]!.crossed(p3, Math.max(i / 9, 0.02), NOIR_PAW_HYST) && !reducedMotion && slow) {
      // wet splash under the paw -- same inkTick voice as fireInk, so gate it
      // (two parapet steps in one frame would else double-start inkTick).
      k.inkTick.triggerAttackRelease(0.01, inkGate.at(now, 0.05), 0.15);
      firePaw(k, now, i);
    }
  }

  // -- press part-add thumps (issue 5): 4 departments welding on
  for (let i = 0; i < 4; i++) {
    if (partEdges[i]!.crossed(t, PRESS_PART_T[i]!, PART_HYST)) firePart(k, now, i);
  }

  // -- press CTA plop (issue 5): the DOM button drops into frame after the stamp
  if (ctaEdge.crossed(t, PRESS_CTA_IN[0]!, PART_HYST)) firePlop(k, now);

  // -- screentone station machine (issue 7): PASS stops (3,5) keep the far-off
  // horn + a dedicated pass-whoosh; DWELL stops get brake squeal -> PA chime ->
  // door beep. trainPan places every station sound where the train is on screen.
  const tx = trainX(t);
  const sp = trainSpeed(t);
  if (t > R7[0] - 0.02 && t < R7[1] + 0.02) {
    const target = Math.max(-0.85, Math.min(0.85, trainDisplayX(t, reducedMotion) / 105));
    moveTo(k.trainPan.pan, gTrainPan, target, 0.05, 0.01);
  }
  // horn re-gated to PASS stations only (was all 8; DWELL horns would stack on
  // the brake/chime/depart banks below).
  for (let i = 0; i < 8; i++) {
    if (stationEdges[i]!.crossed(tx, STATION_X[i]!, STATION_HYST) && sp > 0.2 && (i === 3 || i === 5) && !reducedMotion)
      fireHorn(k, now);
  }
  for (let j = 0; j < 6; j++) {
    const stx = STATION_X[DWELL_STATIONS[j]!]!;
    // PA chime is an event marker: fires under reduced motion and at any speed.
    if (chimeEdges[j]!.crossed(tx, stx - 0.5, STATION_HYST)) fireChime(k, now, j);
    if (brakeEdges[j]!.crossed(tx, stx - 6, STATION_HYST) && !reducedMotion && slow) fireBrake(k, now);
    if (departEdges[j]!.crossed(tx, stx + 2, STATION_HYST) && !reducedMotion && slow) fireDepart(k, now);
  }
  for (let j = 0; j < 2; j++) {
    if (passEdges[j]!.crossed(tx, STATION_X[PASS_STATIONS[j]!]!, STATION_HYST) && !reducedMotion && slow)
      firePass(k, now, sp);
  }

  // -- pop 360 whoosh + crowd (issue 8): continuous, pure f(t) both directions
  const tLocal8 = clamp01((t - POP_RANGE[0]) / (POP_RANGE[1] - POP_RANGE[0]));
  const of = orbitFrac();
  const pp = clamp01((tLocal8 - of) / (1 - of));
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
    // page 0 needs a positive threshold: clamp01 floors u10 at 0, so an Edge
    // primed AT 0 never crosses upward (only 9 of 10 pages would sound).
    if (starEdges[i]!.crossed(u10, Math.max(i * 0.055, 0.02), STAR_HYST)) fireStar(k, now, i);
  }

  // -- origin cat margin-walk + portal hop (issue 4): quiet guide steps, then a
  // soft land as it perches on the portal frame. Motion-narrating -> gated.
  // crossed() runs every tick (brake/depart pattern); only the FIRE gates on
  // !reducedMotion && slow. Per-bank hysteresis = half this bank's own step
  // spacing (ow/6): the shared PAW_HYST is ~4x this dense bank's spacing.
  const ow = ORIGIN_CAT_WALK[1] - ORIGIN_CAT_WALK[0];
  const originPawHyst = ow / 12;
  for (let i = 0; i < 6; i++) {
    if (pawEdgesOrigin[i]!.crossed(t, ORIGIN_CAT_WALK[0] + (i / 6) * ow, originPawHyst) && !reducedMotion && slow)
      firePaw(k, now, i, 0.25);
  }
  if (hopEdgeOrigin.crossed(t, ORIGIN_CAT_HOP[1]!, CLACK_HYST) && !reducedMotion && slow) fireHop(k, now);

  // -- terminal cat walk-off (issue 11): a hop off the tower, then 8 steps that
  // pan stage-right and fade as the guide exits. Motion-narrating -> gated.
  // crossed() runs every tick (brake/depart pattern); only the FIRE gates on
  // !reducedMotion && slow. Per-bank hysteresis = half this bank's own step
  // spacing (cw/8): the shared PAW_HYST is ~2x this dense bank's spacing.
  const cw = CAT_WALK_RANGE[1] - CAT_WALK_RANGE[0];
  const termPawHyst = cw / 16;
  if (catHopEdge.crossed(t, CAT_WALK_RANGE[0] + 0.06 * cw, CLACK_HYST) && !reducedMotion && slow) fireHop(k, now);
  for (let i = 0; i < 8; i++) {
    if (catWalkEdges[i]!.crossed(t, CAT_WALK_RANGE[0] + (i / 8) * cw, termPawHyst) && !reducedMotion && slow)
      firePaw(k, now, i, 0.35 - 0.03 * i, 0.1 + 0.08 * i);
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
      // kachPop is shared with firePlop/fireResumeDrop + 2 other beat cases
      const kp = kachGate.at(now, 0.3);
      k.kachPopLp.frequency.rampTo(800, 0.02, kp);
      k.kachPop.triggerAttackRelease(0.4, kp, 0.5);
      k.coin.triggerAttackRelease("B6", 0.05, now + 0.12, 0.4);
      k.coin.triggerAttackRelease("D7", 0.05, now + 0.18, 0.4);
      k.coin.triggerAttackRelease("G7", 0.05, now + 0.24, 0.4);
      return true;
    }
    case "press-stamp": {
      // stampMembrane is shared with terminal-back-cover -> gate its start
      k.stampMembrane.triggerAttackRelease("G0", 0.5, stampGate.at(now, 0.5), v);
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
      // edgeWhoosh is shared with leap + orbit-360; gate the whole sequence on
      // one strictly-increasing base (busy spans the ~0.63s clatter tail + margin)
      // so a deep-jump multi-fire staggers instead of double-starting the voice.
      const base = edgeGate.at(now, 1.2);
      let ti = base; // accelerating wheel clatter 8 -> 16 Hz
      const hits = 7;
      for (let i = 0; i < hits; i++) {
        k.edgeMembrane.triggerAttackRelease("A1", 0.08, ti, (0.5 + 0.2 * h01(i + 1)) * v);
        ti += 1 / (8 + 8 * (i / (hits - 1)));
      }
      k.edgeScreech.triggerAttackRelease(300, 0.3, base, 0.5 * v); // wheel screech
      k.edgeScreech.frequency.rampTo(700, 0.28, base + 0.01);
      k.edgeWhooshBp.frequency.cancelScheduledValues(base); // rising doppler
      k.edgeWhooshBp.frequency.setValueAtTime(400, base);
      k.edgeWhooshBp.frequency.linearRampToValueAtTime(3000, base + 0.3);
      k.edgeWhoosh.triggerAttackRelease(0.35, base, 0.6 * v);
      k.edgeHorn.triggerAttackRelease(110, 0.3, base, 0.5 * v); // low horn
      return true;
    }
    case "origin-portal": {
      // starBell is shared with fireStar (issue 10) -> gate the start
      k.starBell.triggerAttackRelease(440, 0.9, starGate.at(now, 0.9), 0.35); // airy pad into the tail
      return true;
    }
    case "sketch-print-run": {
      const kp = kachGate.at(now, 0.3); // kachPop shared across cases + helpers
      k.kachPopLp.frequency.rampTo(500, 0.02, kp);
      k.kachPop.triggerAttackRelease(0.4, kp, 0.35); // near-silent roller finish
      return true;
    }
    case "terminal-back-cover": {
      // stampMembrane + kachPop both shared -> gate each in its own family
      k.stampMembrane.triggerAttackRelease("C2", 0.3, stampGate.at(now, 0.5), 0.4); // soft book close
      const kp = kachGate.at(now, 0.3);
      k.kachPopLp.frequency.rampTo(300, 0.02, kp);
      k.kachPop.triggerAttackRelease(0.3, kp, 0.4); // "fwump"
      return true;
    }
    case "pop-orbit-360": {
      const base = edgeGate.at(now, 0.6); // shares edgeWhoosh w/ edge-run + leap
      k.edgeWhooshBp.frequency.cancelScheduledValues(base); // doppler swoop 500->2500->500
      k.edgeWhooshBp.frequency.setValueAtTime(500, base);
      k.edgeWhooshBp.frequency.linearRampToValueAtTime(2500, base + 0.25);
      k.edgeWhooshBp.frequency.linearRampToValueAtTime(500, base + 0.5);
      k.edgeWhoosh.triggerAttackRelease(0.5, base, 0.6);
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
export type SfxName =
  | "meow"
  | "softLand"
  | "boop"
  | "pad"
  | "chatPop"
  | "signBuzz"
  | "resumeDrop"
  | "leap";

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
      case "chatPop": {
        // one hook covers ambient cadence + the orbit volley; gate centrally so
        // balloons popping while Pop is mounted at +/-1 stay silent.
        const st = useScrollStore.getState();
        if (st.reducedMotion || st.t < POP_RANGE[0] - 0.005 || st.t > POP_RANGE[1] + 0.005) break;
        fireChatPop(k, now, seed);
        break;
      }
      case "signBuzz": // neon sign ignition (event marker; fires under RM)
        fireSignBuzz(k, now, seed);
        break;
      case "resumeDrop": // terminal resume sheet flutter + fwump
        // scene pins the sheet statically under RM -> no flutter (matches chatPop)
        if (!useScrollStore.getState().reducedMotion) fireResumeDrop(k, now);
        break;
      case "leap": {
        // cat launch: rising doppler swoop (shares the edge-run whoosh voice).
        // Scene windows never overlap, but a deep jump can cross leap + an
        // edge-run/orbit beat in one frame -> gate the shared mono whoosh.
        logFire("leap");
        const base = edgeGate.at(now, 0.4);
        k.edgeWhooshBp.frequency.cancelScheduledValues(base);
        k.edgeWhooshBp.frequency.setValueAtTime(500, base);
        k.edgeWhooshBp.frequency.linearRampToValueAtTime(2200, base + 0.3);
        k.edgeWhoosh.triggerAttackRelease(0.3, base, 0.5);
        break;
      }
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
  for (const g of gates) g.reset();
  neonPrimed = false;
  neonLast = -1;
  lastScoreT = NaN; // next enable re-primes the deep-jump guard from scratch
  momentsActive = false; // sfxMoment goes silent until the director re-enables
  const k = kit;
  if (!k) return;
  gWhoosh.v = 0;
  gCrowd.v = 0;
  gTrainPan.v = 0;
  k.popWhooshGain.gain.rampTo(0, 0.1);
  k.crowdGain.gain.rampTo(0, 0.1);
  // re-center the panners so a re-enable in another scene starts clean
  k.trainPan.pan.rampTo(0, 0.1);
  k.chatPan.pan.rampTo(0, 0.1);
  k.spreadPan.pan.rampTo(0, 0.1);
  k.catPan.pan.rampTo(0, 0.1);
  if (popOn) {
    k.popWhoosh.stop();
    k.crowdA.stop();
    k.crowdB.stop();
    k.crowdC.stop();
    k.hushNoise.stop();
    popOn = false;
  }
}
