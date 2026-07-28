import type { Convolver, Freeverb, Gain, Reverb } from "tone";
import { RANGES } from "@/issues/timeline";
import { useScrollStore } from "@/lib/scrollStore";
import { clamp01 } from "@/lib/shots";
import { canRenderIR, renderIR, type RoomSpec } from "./ir";
import type { Buses } from "./buses";
import { moveTo } from "./util";

/**
 * Per-scene acoustic rooms. Replaces the single shared
 * Reverb({decay: 2.2}) that every sound on the site fed at gain 0.18 -- which
 * meant a rooftop, a subway tunnel and a sketchbook desk were all the same
 * small room, and is one of the largest single reasons the mix read flat.
 *
 * Two convolvers crossfade across each gutter so the space MORPHS with the
 * scene instead of switching.
 *
 * SLOT ASSIGNMENT IS BY PARITY -- even issue to slot A, odd to slot B. Any
 * gutter joins consecutive issues, which always differ in parity, so the two
 * rooms are guaranteed to land in different slots and no gutter ever needs a
 * mid-crossfade reassignment. That holds in both scroll directions, which is
 * what makes the whole thing scrub-safe: the gain TARGETS are a pure function
 * of t with no latches, and which buffer lives in which slot is a pure
 * function of the issue index. The AUDIBLE gain lags its target by the ramp,
 * so it is not itself f(t) -- fine here, because no visual reads it.
 */

const ROOMS: readonly RoomSpec[] = [
  // 0 cover: small print shop, paper-damped
  { id: "cover", decay: 0.9, preDelay: 0.011, bandDecay: [1, 0.9, 0.6], width: 0.75, seed: 101,
    taps: [[0.006, 0.5, -0.3], [0.011, 0.42, 0.35], [0.018, 0.33, -0.5], [0.026, 0.28, 0.2],
           [0.034, 0.22, 0.55], [0.045, 0.16, -0.15]] },
  // 1 noir: wet street canyon, long low tail, a slapback off the far facade
  { id: "noir", decay: 1.8, preDelay: 0.03, bandDecay: [1.2, 1, 0.5], width: 0.95, seed: 211,
    taps: [[0.014, 0.44, -0.6], [0.028, 0.36, 0.5], [0.047, 0.3, -0.35], [0.062, 0.34, 0.7],
           [0.081, 0.22, -0.7], [0.098, 0.18, 0.25], [0.115, 0.14, -0.2], [0.13, 0.1, 0.6]] },
  // 2 desk: tight dry office, carpet and books, dense early reflections
  { id: "desk", decay: 0.5, preDelay: 0.006, bandDecay: [1, 0.9, 0.8], width: 0.55, seed: 307,
    taps: [[0.003, 0.55, -0.25], [0.006, 0.48, 0.3], [0.009, 0.42, -0.4], [0.012, 0.38, 0.15],
           [0.015, 0.32, 0.45], [0.018, 0.28, -0.2], [0.022, 0.22, 0.35]] },
  // 3 neon: city canyon, very long and dark
  { id: "neon", decay: 2.4, preDelay: 0.045, bandDecay: [1.3, 1, 0.4], width: 1, seed: 419,
    taps: [[0.02, 0.4, -0.75], [0.036, 0.36, 0.7], [0.055, 0.3, -0.55], [0.072, 0.26, 0.6],
           [0.09, 0.2, -0.4], [0.108, 0.16, 0.45], [0.125, 0.12, -0.3], [0.142, 0.1, 0.2]] },
  // 4 origin: open valley, sparse and long. Few surfaces, far away.
  { id: "origin", decay: 2.8, preDelay: 0.06, bandDecay: [1.4, 1, 0.35], width: 0.9, seed: 523,
    taps: [[0.04, 0.26, -0.5], [0.078, 0.2, 0.55], [0.12, 0.14, -0.3], [0.165, 0.1, 0.35],
           [0.19, 0.07, -0.15]] },
  // 5 press: concrete factory hall, bright slap, flutter between parallel walls
  { id: "press", decay: 2.2, preDelay: 0.025, bandDecay: [1, 1.1, 0.7], width: 0.9, seed: 631,
    taps: [[0.012, 0.5, -0.45], [0.024, 0.44, 0.4], [0.041, 0.38, -0.6], [0.058, 0.34, 0.55],
           [0.074, 0.28, -0.3], [0.088, 0.3, 0.65], [0.104, 0.22, -0.5], [0.12, 0.18, 0.3],
           [0.14, 0.14, -0.2], [0.16, 0.1, 0.45]] },
  // 6 newsprint: open-plan newsroom, ceiling tiles
  { id: "newsprint", decay: 1.1, preDelay: 0.012, bandDecay: [1, 1, 0.7], width: 0.7, seed: 743,
    taps: [[0.005, 0.5, -0.3], [0.011, 0.44, 0.35], [0.018, 0.36, -0.45], [0.026, 0.3, 0.25],
           [0.034, 0.24, 0.5], [0.043, 0.18, -0.2], [0.055, 0.12, 0.15]] },
  // 7 screentone: tiled subway, strong flutter
  { id: "screentone", decay: 2, preDelay: 0.02, bandDecay: [1.1, 1.2, 0.5], width: 0.85, seed: 857,
    taps: [[0.009, 0.5, -0.5], [0.019, 0.46, 0.45], [0.031, 0.42, -0.55], [0.044, 0.38, 0.5],
           [0.058, 0.32, -0.4], [0.073, 0.28, 0.4], [0.089, 0.22, -0.3], [0.106, 0.18, 0.3],
           [0.118, 0.14, -0.2], [0.13, 0.1, 0.25]] },
  // 8 pop: bright treated studio, live but small
  { id: "pop", decay: 1.4, preDelay: 0.018, bandDecay: [1, 1, 0.8], width: 0.8, seed: 967,
    taps: [[0.006, 0.52, -0.35], [0.012, 0.46, 0.4], [0.019, 0.4, -0.5], [0.027, 0.34, 0.3],
           [0.035, 0.28, 0.55], [0.044, 0.22, -0.25], [0.054, 0.18, 0.2], [0.066, 0.12, -0.4]] },
  // 9 sketch: near-anechoic, paper close to the face
  { id: "sketch", decay: 0.35, preDelay: 0.004, bandDecay: [1, 0.9, 0.9], width: 0.35, seed: 1069,
    taps: [[0.002, 0.5, -0.15], [0.004, 0.42, 0.2], [0.006, 0.34, -0.25], [0.009, 0.26, 0.1]] },
  // 10 spread: cosmos. ZERO early reflections, deliberately. Early reflections
  // are what tell the ear a wall exists; without them plus a long pre-delay
  // this reads as "no room, infinite space" rather than "very big room".
  { id: "spread", decay: 3.2, preDelay: 0.07, bandDecay: [1.5, 1, 0.3], width: 1, seed: 1171,
    taps: [] },
  // 11 terminal: small CRT room with a hard desk reflection
  { id: "terminal", decay: 0.7, preDelay: 0.008, bandDecay: [1, 0.9, 0.8], width: 0.5, seed: 1283,
    taps: [[0.002, 0.55, -0.2], [0.005, 0.46, 0.25], [0.009, 0.38, -0.35], [0.014, 0.3, 0.2],
           [0.02, 0.24, 0.4], [0.027, 0.18, -0.15]] },
];

/**
 * Longest tail we will render; convolver cost scales with IR length. Equal to
 * the longest room in the table, so the clamp is a guard rail against a future
 * edit rather than something that currently bites.
 */
const MAX_DECAY = 3.2;
/** Crossfade ramp for a room slot's gain. */
const FADE_S = 0.12;
/**
 * How long a slot's target must have been zero before it is safe to touch.
 * Must exceed FADE_S: assigning Convolver.buffer rebuilds the FFT partition
 * table synchronously, so doing it while the gain is still ramping down is
 * audible as a click.
 */
const SILENT_MS = 220;
/** Further wait before the convolver input is disconnected entirely. */
const QUIET_STOP_MS = 300;

interface Slot {
  /** replaced wholesale on every swap; see the normalize note in updateRooms */
  conv: Convolver;
  gain: Gain;
  /** issue whose IR is currently loaded, -1 when empty */
  issue: number;
  /** last target gain written; 0 means "fading out or already silent" */
  committed: number;
  /**
   * Timestamp the target first hit 0, or 0 while audible. The buffer swap and
   * the input disconnect both wait on this rather than on `committed`, because
   * `committed` is the TARGET and the gain is still ramping for FADE_S after
   * it reaches zero.
   */
  zeroSince: number;
  moveState: { v: number };
  connected: boolean;
}

let slots: [Slot, Slot] | null = null;
let cache: Map<number, AudioBuffer> | null = null;
let pending: Set<number> | null = null;
let fallback: Reverb | null = null;
let algo: Freeverb | null = null;
let algoGain: Gain | null = null;
const algoState = { v: 0 };
let B: Buses | null = null;
let disabled = false;

/**
 * Which rooms are audible at t, and how far between them.
 * Pure f(t) with no latches, so scrubbing back walks the identical curve.
 */
export function roomBlend(t: number): { from: number; to: number; x: number } {
  for (let i = 0; i < RANGES.length; i++) {
    const r = RANGES[i]!;
    if (t <= r[1]) {
      if (t >= r[0] || i === 0) return { from: i, to: i, x: 0 };
      // in the gutter between i-1 and i
      const prev = RANGES[i - 1]!;
      const span = r[0] - prev[1];
      const x = span > 1e-6 ? clamp01((t - prev[1]) / span) : 1;
      // smoothstep so the morph has no corner at either end
      return { from: i - 1, to: i, x: x * x * (3 - 2 * x) };
    }
  }
  return { from: RANGES.length - 1, to: RANGES.length - 1, x: 0 };
}

export function buildRooms(buses: Buses): void {
  B = buses;
  disabled = false;
  cache = new Map();
  pending = new Set();
  const T = buses.T;

  if (!canRenderIR()) {
    useFallback();
    return;
  }

  const mk = (): Slot => {
    // normalize FALSE: level is controlled by the fixed-L2 normalise in ir.ts,
    // which is the one that actually holds the wet level constant as decay
    // changes. (Fixed RMS does not -- output power goes as sum(h^2) = n*rms^2.)
    const conv = new T.Convolver({ normalize: false });
    const gain = new T.Gain(0).connect(buses.out);
    conv.connect(gain);
    return {
      conv, gain, issue: -1, committed: 0,
      // Stamped at build rather than left 0: on frame 1 there is no ramp to
      // wait out, and a 0 here makes the FIRST room stall SILENT_MS for nothing.
      zeroSince: 1, moveState: { v: 0 }, connected: false,
    };
  };
  slots = [mk(), mk()];
}

/** Zero and detach both slots. Safe to call twice; never throws. */
function silenceSlots(): void {
  if (!slots || !B) return;
  for (const slot of slots) {
    try {
      slot.gain.gain.rampTo(0, FADE_S);
      slot.moveState.v = 0;
      slot.committed = 0;
      slot.zeroSince = 0;
      slot.issue = -1;
      if (slot.connected) {
        B.roomIn.disconnect(slot.conv);
        slot.connected = false;
      }
    } catch {
      // best effort; this runs on an already-failing path
    }
  }
}

/**
 * Rung A2's reverb. Freeverb is comb + allpass -- genuinely algorithmic, with
 * NO ConvolverNode.
 *
 * Tone.Reverb would be the wrong node here: it generates a decaying-noise IR
 * with Tone.Offline and feeds a ConvolverNode, so it IS convolution. Since
 * convolver cost scales with IR length and Reverb is fixed at 2.2 s, routing
 * A2 through it would cost MORE than A1 in the seven rooms whose decay is
 * under 2.2 s -- a ladder rung that increases cost on most of the timeline,
 * which is the one shape a degradation ladder must not have.
 */
function buildAlgorithmic(): void {
  if (!B || algo) return;
  const T = B.T;
  algo = new T.Freeverb({ roomSize: 0.7, dampening: 3000 });
  algoGain = new T.Gain(0).connect(B.out);
  B.roomIn.connect(algo);
  algo.connect(algoGain);
}

function useFallback(): void {
  if (!B || fallback) return;
  // Exactly the shipped behaviour: one shared algorithmic reverb. The worst
  // case for the whole room system is "we are back where we started".
  const T = B.T;
  fallback = new T.Reverb({ decay: 2.2, preDelay: 0.02, wet: 1 });
  const ret = new T.Gain(0).connect(B.out);
  B.roomIn.connect(fallback);
  fallback.connect(ret);
  void fallback.ready.then(() => ret.gain.rampTo(0.18, 0.5)).catch(() => {});
}

function ensureIR(issue: number, sampleRate: number): void {
  if (!cache || !pending || disabled) return;
  if (cache.has(issue) || pending.has(issue)) return;
  const spec = ROOMS[issue];
  if (!spec) return;
  pending.add(issue);
  // Promise chain started OUTSIDE the rAF, with its own catch, so a rendering
  // failure can never reach the director's frame-loop try/catch and trip the
  // global disable.
  void renderIR({ ...spec, decay: Math.min(spec.decay, MAX_DECAY) }, sampleRate)
    .then((buf) => {
      cache?.set(issue, buf);
      pending?.delete(issue);
    })
    .catch(() => {
      pending?.delete(issue);
      // Tear the rooms DOWN before latching, or `disabled` short-circuits
      // updateRooms on every later frame and leaves whatever was audible on
      // this frame convolving forever -- welding one scene's room onto every
      // scene that follows, with the fallback reverb layered on top. Failures
      // have to degrade to the fallback, not to a frozen wrong room.
      silenceSlots();
      disabled = true;
      useFallback();
    });
}

/**
 * Per-frame. Pure f(t) for the gains; the only stateful part is which buffer
 * sits in which slot, and parity makes that a pure function of issue index too.
 */
export function updateRooms(t: number, now: number): void {
  if (!B || !slots || disabled) return;
  const T = B.T;
  const blend = roomBlend(t);
  const { from, to } = blend;

  // S0.6 audio rung A1: below the full tier the room stops morphing and hard
  // swaps at the gutter midpoint, so only ONE convolver is ever audible. That
  // halves the convolution cost at exactly the moment it would otherwise
  // double, and a gutter is the one place a hard room change is masked anyway.
  const tier = useScrollStore.getState().audioTier;

  // Rung A2: no convolution at all. Detach both slots and hand over to Freeverb.
  //
  // REVERSIBLE, unlike the render-failure path: tier is re-read every frame, so
  // a perf probe that drops to A2 and recovers gets its rooms back. That is why
  // this does NOT set `disabled`, which means "IR rendering is broken" and is
  // permanent by design.
  if (tier <= 0) {
    if (!algo) buildAlgorithmic();
    if (algoGain) moveTo(algoGain.gain, algoState, 0.18, 0.3, 0.01);
    silenceSlots();
    return;
  }
  if (algoGain && algoState.v !== 0) moveTo(algoGain.gain, algoState, 0, 0.3, 0.01);

  const x = tier >= 2 ? blend.x : blend.x < 0.5 ? 0 : 1;

  const sr = T.getContext().sampleRate;
  ensureIR(from, sr);
  if (to !== from) ensureIR(to, sr);
  // Prefetch neighbours while settled INSIDE a scene. renderIR is async, but its
  // noise fill and normalise passes run on the main thread, and firing them on
  // the first frame of a gutter puts a few hundred thousand ops exactly where
  // the frame budget is tightest and a dropped frame is most visible.
  if (to === from) {
    if (from + 1 < ROOMS.length) ensureIR(from + 1, sr);
    if (from - 1 >= 0) ensureIR(from - 1, sr);
  }

  const gFrom = Math.cos((x * Math.PI) / 2);
  const gTo = Math.sin((x * Math.PI) / 2);

  for (let s = 0; s < 2; s++) {
    const slot = slots[s]!;
    // parity: even issues live in slot 0, odd in slot 1
    let want = from % 2 === s ? from : to % 2 === s ? to : -1;
    const target = want === -1 ? 0 : want === from ? gFrom : gTo;

    // PRELOAD. While settled inside a scene the opposite-parity slot is idle,
    // and the next room has exactly that parity -- so its buffer can be loaded
    // during a settled frame instead of on the gutter's first frame. Prefetching
    // the RENDER alone was not enough: the swap itself rebuilds the FFT
    // partition table synchronously, which is the expensive half, and the
    // fresh-Convolver requirement made it slightly more expensive still.
    // Silent target, so this never affects what is audible at any t.
    if (want === -1 && to === from) {
      const next = from + 1;
      if (next < ROOMS.length && next % 2 === s) want = next;
    }

    // Silent means the TARGET has been zero long enough for the ramp to have
    // finished, not merely that the target is zero this frame.
    const silent = slot.committed === 0 && slot.zeroSince !== 0 && now - slot.zeroSince > SILENT_MS;

    if (want !== -1 && slot.issue !== want && silent) {
      const buf = cache?.get(want);
      if (buf) {
        try {
          // A FRESH Convolver per swap, deliberately. Reassigning .buffer on an
          // existing one CANNOT work.
          //
          // Tone's `set buffer` REPLACES its internal ConvolverNode whenever the
          // old one already had a buffer, and a fresh ConvolverNode defaults
          // normalize = true. Per the Web Audio spec, normalize is only read
          // WHEN the buffer is assigned -- so setting it afterwards is a no-op
          // until the next swap, and setting it beforehand is discarded along
          // with the node Tone throws away. The one reachable ordering is a
          // virgin Convolver: its constructor applies normalize to a node that
          // has no buffer yet, and that first assignment does not trigger the
          // replace. Without this, every room after the first is equal-power
          // normalised, undoing the fixed-L2 level control in ir.ts.
          // DO NOT merge these two statements into
          // `new T.Convolver({ buffer, normalize: false })`. Whether that still
          // honours normalize depends on whether Tone's constructor applies it
          // before or after its own `if (this._buffer.loaded) this.buffer = ...`
          // branch. Keeping them separate makes the virgin-node requirement
          // explicit and independent of that ordering.
          const fresh = new T.Convolver({ normalize: false });
          fresh.buffer = new T.ToneAudioBuffer(buf);
          if (slot.connected) {
            B.roomIn.disconnect(slot.conv);
            slot.connected = false;
          }
          slot.conv.dispose();
          slot.conv = fresh;
          fresh.connect(slot.gain);
          slot.issue = want;
        } catch {
          // A rejected buffer must not reach the director's rAF catch, which
          // would disable all audio site-wide. Leave the slot silent; the next
          // frame retries.
          slot.issue = -1;
        }
      }
    }

    const ready = slot.issue === want && want !== -1;
    // `target` is already 0 for a preload (want !== from and !== to), so a
    // preloaded slot loads its buffer and stays silent.
    const g = ready ? target : 0;
    moveTo(slot.gain.gain, slot.moveState, g, FADE_S, 0.01);
    slot.committed = g;
    if (g > 0) slot.zeroSince = 0;
    else if (slot.zeroSince === 0) slot.zeroSince = now;

    // A ConvolverNode runs its FFT whenever its input is connected, regardless
    // of downstream gain, so an idle slot is disconnected rather than merely
    // turned down. Steady state is one convolver running; only gutters pay two.
    if (g > 0) {
      if (!slot.connected) {
        B.roomIn.connect(slot.conv);
        slot.connected = true;
      }
    } else if (slot.connected && slot.zeroSince !== 0 && now - slot.zeroSince > QUIET_STOP_MS) {
      B.roomIn.disconnect(slot.conv);
      slot.connected = false;
    }
  }
}

/** No call sites yet: nothing tears the audio engine down mid-session. */
export function disposeRooms(): void {
  if (slots) {
    for (const s of slots) {
      try {
        if (s.connected) B?.roomIn.disconnect(s.conv);
        s.conv.dispose();
        s.gain.dispose();
      } catch {
        // teardown is best-effort; never throw out of dispose
      }
    }
  }
  slots = null;
  cache = null;
  pending = null;
  fallback = null;
  algo = null;
  algoGain = null;
  algoState.v = 0;
  B = null;
  disabled = false;
}

export { ROOMS };
