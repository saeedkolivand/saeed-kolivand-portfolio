import type { Gain, MembraneSynth, Meter, Synth } from "tone";
import { useScrollStore } from "@/lib/scrollStore";
import { fx } from "@/lib/fx";
import { setBeatSound } from "@/lib/beats";
import { clamp01 } from "@/lib/shots";
import { RANGES } from "@/issues/timeline";
import { audioRecipes, type AudioRecipe, type ToneModule } from "./types";
import { buildBuses, type Buses } from "./buses";
import { buildRooms, updateRooms } from "./rooms";
import { loadBank } from "./bank";
import { buildOneshot, stopOneshots } from "./oneshot";
import { buildScore, updateScore, stopScore } from "./score";
import { scoreTransitions, stopTransitions } from "./transitions";
import { scoreMoments, beatMoment, stopMoments } from "./moments";
import { wireUi, uiSound } from "./ui";
import "./recipes"; // Wave B: fills the audioRecipes slots (side effect)

/**
 * Audio director -- plain module singleton, React-free (lib/fx.ts pattern).
 * OFF by default; enableAudio() must be called synchronously from a user
 * gesture handler (Tone.start() unlock). Tone.js is lazy-imported here on
 * first enable so it never rides the server/initial bundle. Every Tone call
 * is wrapped: failure degrades to silence with a single console.warn.
 *
 * The mix graph lives in buses.ts (six named buses -> one master chain) and
 * the per-scene convolution rooms in rooms.ts. This file owns lifecycle and
 * the frame loop only.
 *
 * Beat sounds ride lib/beats.ts setBeatSound, which only fires from
 * BeatRunner crossings -- reduced motion already suppresses those, so the
 * sounds inherit the suppression for free.
 */

interface Master {
  T: ToneModule;
  B: Buses;
  /** the single fade node; enable ramps it to 1, disable to 0 */
  out: Gain;
  duckGain: Gain;
  meter: Meter;
  thump: MembraneSynth;
  chime: Synth;
}

interface Channel {
  recipe: AudioRecipe;
  gain: Gain;
  started: boolean;
  lastG: number;
}

/**
 * CUT-SCENE HIT-STOP: the world drops out for a beat, then swells back.
 *
 * The most cinematic move available and the one that dies fastest if overused,
 * so it is exactly three beats -- the slab slam, the spread unfolding, and the
 * title landing -- and nothing else may join without one leaving.
 *
 * Value is depth 0..1, where 1 is near-silence.
 */
const HITSTOP: Readonly<Record<string, number>> = {
  "press-stamp": 1,
  "spread-unfold": 0.9,
  "title-drop": 0.85,
};

/**
 * Let the transient land at full level before the floor goes. Cutting the bed
 * ON the hit robs the hit of the thing it is hitting; cutting it 70 ms later
 * is what reads as the world falling away from underneath it.
 */
const STOP_LEAD = 0.07;
const STOP_FALL = 0.035;
const STOP_HOLD = 0.3;
const STOP_SWELL = 0.75;
/** One complete gesture, and therefore the minimum spacing between two. */
const STOP_TOTAL = STOP_LEAD + STOP_FALL + STOP_HOLD + STOP_SWELL;

/**
 * Depth when the authored cue did NOT play -- cold bank, MIN_GAP dedupe, or a
 * failed voice claim. The whole justification for the hit-stop is that the hit
 * and its room tail ring on into the hole; with only the synth fallback in
 * there, taking 96% of the mix out buys silence rather than exposure.
 */
const STOP_SYNTH_SCALE = 0.45;

const CROSSFADE_S = 0.15;
/** t distance past an issue's range over which its bed fades to silence */
const FALLOFF = 0.02;

let master: Master | null = null;
let channels: (Channel | null)[] = [];
let enabled = false;
let pending = false;
let wired = false;
let session = 0;
let raf = 0;
let lastNow = 0;
let warned = false;
// monotonic guard for the shared thump/chime one-shots: next Tone time they are
// free to schedule. A deep jump can resolve two beat crossings in one frame, so
// two hits arrive at the same `now` -- Tone throws if starts invert on a synth.
let beatFree = 0;
/** The 48 kHz context, kept so a failed enable cannot build a second one. */
let pinnedCtx: AudioContext | null = null;
/**
 * Next Tone time a hit-stop may be scheduled -- the runtime budget.
 *
 * "Exactly three beats" is an AUTHORING limit and does not bound how often one
 * of the three fires. BeatRunner re-arms as soon as t retreats one hysteresis
 * below the trigger (~145 px at the base spacer), and each hitStop() cancels
 * and re-schedules from scratch, so a trackpad wiggle across the stamp faster
 * than one envelope would pin the beds and the score at 4% indefinitely --
 * silently, because hit() self-limits through MIN_GAP_S while the duck does
 * not. Every other authored impact here is budgeted (requestFlash, beatFree,
 * VoiceGate, MIN_GAP_S); this is the deepest of them and had nothing.
 *
 * It also bounds the sidechain: an unscored beat landing mid-swell would
 * otherwise cancel it and ramp the bed UP to 0.55, which is the authored
 * gesture in reverse.
 */
let stopFree = 0;

function warn(e: unknown): void {
  if (warned) return;
  warned = true;
  console.warn("[audio] degraded to silent:", e);
}

/** Idempotent; call synchronously inside the user gesture (click) handler. */
export function enableAudio(): void {
  if (enabled || pending) return;
  pending = true;
  const mySession = ++session;
  // optimistic mirror (reverted on failure) so the toggle flips instantly
  useScrollStore.getState().setAudioOn(true);
  void (async () => {
    const T = master ? master.T : await import("tone");
    // PIN THE CONTEXT TO 48 kHz, the rate everything here is authored at.
    //
    // Without this Tone takes the DEVICE rate, and a 96 kHz interface is not
    // exotic -- measured on the reporter's machine: sampleRate 96000. That is
    // not a free upgrade, it doubles every cost in this engine:
    //
    //   - Runtime IRs are sized from the context rate (ir.ts), so the longest
    //     room goes 314k -> 628k samples convolved, and convolution cost rises
    //     faster than linearly. Two convolvers are live across every gutter.
    //   - decodeAudioData resamples to the context rate, so the score's decoded
    //     footprint goes 46 MB -> 92 MB. 46 MB is the figure bank.ts states as
    //     measured, for the one stereo cue the score now is.
    //   - Every asset is baked at 48 kHz, so the device rate also forced a
    //     resample of material that would otherwise decode 1:1.
    //
    // Nothing in the material justifies the rate: the recipes are band-limited
    // well below 20 kHz and the IRs lower still. The browser resamples our
    // output to the device in its own stage, which is cheap and outside our
    // graph. If a browser refuses the rate we fall back to its default rather
    // than losing audio entirely.
    if (!master && !pinnedCtx) {
      try {
        // A NATIVE context, wrapped. Tone's own ContextOptions has no
        // sampleRate field -- the rate can only be requested of the real
        // AudioContext constructor. Prefixed fallback for the same reason
        // ir.ts carries one.
        const Ctor: typeof AudioContext =
          typeof AudioContext !== "undefined"
            ? AudioContext
            : (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        // CACHED. setContext does not dispose the old context, and `master` is
        // not assigned until the end of this block -- so without this a failed
        // enable would build a new AudioContext on every retry until the
        // browser refuses to make more.
        pinnedCtx = new Ctor({ sampleRate: 48000, latencyHint: "interactive" });
        T.setContext(new T.Context(pinnedCtx));
      } catch {
        // A browser may reject an explicit rate, or expose neither constructor.
        // Device rate it is; everything still works, just more expensively.
        pinnedCtx = null;
      }
    }
    await T.start(); // unlock -- initiated from the gesture's task
    // Say whether the pin actually took. Not every browser THROWS on an
    // unsupported rate -- some quietly hand back a different one, and then
    // every figure in the comment above silently stops being true. This is the
    // only signal a reporter on another browser can read back to us.
    const got = T.getContext().sampleRate;
    if (got !== 48000) console.warn(`[audio] context at ${got} Hz, wanted 48000`);
    if (session !== mySession) return; // disabled mid-flight
    // Tone's DEFAULT lookAhead, restored -- but NOT as the fix for the
    // cross-browser distortion, because it is not the cause of it.
    //
    // This was 0.02. Every default-time ramp resolves through
    // now() = currentTime + lookAhead, and Tone's setter also drops
    // updateInterval to 0.01, so the loop ran twice as often with a fifth of
    // the margin. A late ramp steps by slope x lateness: sparse clicks while
    // scrolling, silent at rest because moveTo dead-bands. A real defect, worth
    // removing on its own.
    //
    // What it is NOT is a source of CONTINUOUS distortion -- a main-thread
    // scheduling number cannot make the render thread miss its deadline. That
    // is DSP cost, which the 48 kHz pin above is the actual fix for.
    //
    // This does widen the gap between a beat's visual flash and its sound, from
    // 20 ms to 100 ms, and that is a real cost being accepted rather than
    // solved. The fix is to defer the FLASH by lookAhead in the beat runner --
    // moving the visual, which has no deadline, rather than the audio, which
    // does. Doing it the other way round is what produced the finding above.
    T.getContext().lookAhead = 0.1;
    if (!master) master = buildMaster(T);
    wire();
    master.out.gain.rampTo(1, 0.1);
    uiSound("toggleOn"); // first thing the user hears (package C)
    enabled = true;
    pending = false;
    lastNow = performance.now();
    beatFree = 0; // reset the one-shot gate on every (re-)enable
    stopFree = 0;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  })().catch((e) => {
    pending = false;
    enabled = false;
    useScrollStore.getState().setAudioOn(false);
    warn(e);
  });
}

/** Ramp to silence, stop sources, KEEP instances for cheap re-enable. */
export function disableAudio(): void {
  session++;
  useScrollStore.getState().setAudioOn(false);
  if (!enabled && !pending) return;
  enabled = false;
  pending = false;
  cancelAnimationFrame(raf);
  fx.audioPulse = 0; // written once here so it never sticks
  const m = master;
  if (!m) return;
  try {
    uiSound("toggleOff"); // print-press chime while the master still rings (package C)
    m.out.gain.rampTo(0, 0.2);
    setTimeout(() => {
      if (enabled) return; // re-enabled during the fade
      for (const ch of channels) {
        if (!ch || !ch.started) continue;
        try {
          ch.recipe.stop();
        } catch (e) {
          warn(e);
        }
        ch.started = false;
      }
      try {
        stopTransitions();
        stopMoments();
        stopOneshots();
        stopScore();
      } catch (e) {
        warn(e);
      }
    }, 250);
  } catch (e) {
    warn(e);
  }
}

function buildMaster(T: ToneModule): Master {
  const B = buildBuses(T);
  buildRooms(B);
  // Sample layer. loadBank is fire-and-forget: every hit() falls through to
  // its synth voice until the buffer lands, so nothing waits on the network.
  const low = useScrollStore.getState().quality === "low";
  buildOneshot(T, B, low);
  buildScore(T, B);
  // The score is ~46 MB decoded; the low tier does without it rather than
  // risk a tab eviction on hardware already carrying the WebGL scene.
  loadBank(T, low);

  const thump = new T.MembraneSynth({
    pitchDecay: 0.08,
    octaves: 5,
    envelope: { attack: 0.002, decay: 0.4, sustain: 0, release: 0.1 },
    volume: -6,
  }).connect(B.in.hardfx);
  const chime = new T.Synth({
    oscillator: { type: "fattriangle", count: 3, spread: 14 },
    envelope: { attack: 0.02, decay: 0.25, sustain: 0, release: 0.3 },
    volume: -18,
  }).connect(B.in.ui);

  channels = audioRecipes.map(() => null);
  return { T, B, out: B.out, duckGain: B.duckGain, meter: B.meter, thump, chime };
}

/** One-time subscriptions (survive disable; guarded by `enabled`). */
function wire(): void {
  if (wired) return;
  const m0 = master;
  if (!m0) return;
  wired = true;
  // beat one-shots: package B (moments) claims scored beats first; anything it
  // does not own falls through to the sub-thump (flash>0) / soft chime (flash 0)
  // default. All on the sfx bus.
  setBeatSound((id, flash) => {
    const m = master;
    if (!enabled || !m) return;
    try {
      // T.now(), NOT immediate(). beatMoment resolves its own times through
      // T.now() (moments.ts), so an immediate() here puts the two halves of a
      // single beat a full lookAhead apart -- and that inverts the hit-stop.
      // STOP_LEAD exists to drop the bed 70 ms AFTER the transient; with the
      // hook on immediate() and the cue on now(), the drop landed 30 ms BEFORE
      // it and the bed was 86% collapsed by the time the hit arrived. You would
      // hear the world vanish and then the impact fall into the hole instead of
      // punching it.
      const now = m.T.now();
      const stop = HITSTOP[id];
      // beatMoment FIRST, then the stop, then its early return: the moment is
      // what knows whether the authored cue actually played, and the stop's
      // depth depends on that. Scheduling the stop above the call would have to
      // guess.
      const played = beatMoment(id, flash);
      if (stop !== undefined && now >= stopFree) {
        stopFree = now + STOP_TOTAL;
        hitStop(m, now, played === "sample" ? stop : stop * STOP_SYNTH_SCALE);
      }
      if (played) return; // moment owns the hit (sound or silence)
      // monotonic gate: two beats can resolve in one frame on a deep jump, so
      // stagger the second start past the first. Consumed only for default hits
      // (below the beatMoment return, so moment-owned beats never advance it).
      const a = now <= beatFree ? beatFree + 0.008 : now;
      beatFree = a + 0.35;
      // sidechain duck: a strong director thump dips the bed, then recovers.
      // BELOW the beatMoment return, so moment-owned beats (some deliberately
      // silent, e.g. neon cascade) never duck. Rides duckGain (not music.gain)
      // so the meter/visual pulse stays clean. Event-driven (fires on a beat
      // crossing) -- zero per-frame alloc; inherits the beat hook's gates.
      // Based at `now`, NOT the gated `a`: params have no strict-time constraint,
      // and cancel-from-now + setValueAtTime(g.value, now) is click-free. Only the
      // thump/chime SYNTH triggers below take `a` (starts must be strictly
      // increasing). Rebasing the ramps onto `a` popped when a is bumped ahead.
      if (stop === undefined && now >= stopFree && flash > 0.25) {
        const g = m.duckGain.gain;
        g.cancelScheduledValues(now);
        g.setValueAtTime(g.value, now);
        g.linearRampToValueAtTime(0.55, now + 0.03);
        g.linearRampToValueAtTime(1, now + 0.53);
      }
      if (flash > 0) m.thump.triggerAttackRelease("A1", 0.3, a, 0.4 + 0.6 * Math.min(flash, 1));
      else m.chime.triggerAttackRelease("D6", 0.2, a, 0.7);
    } catch (e) {
      warn(e);
    }
  });
  // package C (ui) installs the meow-variety + jump-land subscriptions on the
  // sfx bus; both inherit the gesture gate (mod set here, post-enable).
  wireUi(m0.T, m0.B.in.ui);
}

/**
 * The hit-stop automation. Rides duckGain, which carries ONLY the beds and the
 * score -- so the hit itself and its room tail ring on into the hole, because
 * the hardfx room send is tapped pre-duck while the bed's send is post-duck.
 * That asymmetry is the entire effect: the world goes, the impact's reverb
 * stays, and for a third of a second you are listening to one sound in a very
 * large room.
 *
 * It also inherits the sidechain's contract for free: fx.audioPulse is metered
 * pre-duck, so a hit-stop cannot move a visual.
 */
function hitStop(m: Master, now: number, depth: number): void {
  const g = m.duckGain.gain;
  const floor = 1 - 0.96 * depth;
  const drop = now + STOP_LEAD;
  g.cancelScheduledValues(now);
  g.setValueAtTime(g.value, now);
  g.setValueAtTime(g.value, drop);
  g.linearRampToValueAtTime(floor, drop + STOP_FALL);
  g.setValueAtTime(floor, drop + STOP_FALL + STOP_HOLD);
  g.linearRampToValueAtTime(1, drop + STOP_FALL + STOP_HOLD + STOP_SWELL);
}

/** 1 inside the issue's range, linear falloff to 0 across FALLOFF outside. */
function proximity(t: number, i: number): number {
  const r = RANGES[i];
  if (!r) return 0;
  const d = t < r[0] ? r[0] - t : t > r[1] ? t - r[1] : 0;
  return Math.max(0, 1 - d / FALLOFF);
}

/** rampTo only on real target moves -- per-frame automation writes are banned. */
function setGain(ch: Channel, target: number): void {
  const moved = Math.abs(target - ch.lastG);
  if (moved === 0) return;
  if (moved < 0.02 && target > 0 && target < 1) return;
  ch.lastG = target;
  ch.gain.gain.rampTo(target, CROSSFADE_S);
}

function loop(now: number): void {
  raf = requestAnimationFrame(loop);
  const m = master;
  if (!enabled || !m) return;
  const dt = Math.min((now - lastNow) / 1000, 0.1);
  lastNow = now;
  try {
    const { t, velocity, activeIssue } = useScrollStore.getState();
    for (let i = 0; i < audioRecipes.length; i++) {
      const recipe = audioRecipes[i];
      if (!recipe) continue;
      let ch = channels[i] ?? null;
      if (Math.abs(i - activeIssue) <= 1) {
        if (!ch) {
          // lazy build on first entry into the active window
          const gain = new m.T.Gain(0).connect(m.B.in.music);
          recipe.build(m.T).connect(gain);
          ch = { recipe, gain, started: false, lastG: 0 };
          channels[i] = ch;
        }
        if (!ch.started) {
          recipe.start();
          ch.started = true;
        }
        const r = RANGES[i]!;
        recipe.update(clamp01((t - r[0]) / (r[1] - r[0])), dt, velocity);
        setGain(ch, proximity(t, i));
      } else if (ch && ch.started) {
        // a full issue away: bed already at 0 gain, hard stop is silent
        setGain(ch, 0);
        ch.recipe.stop();
        ch.started = false;
      }
    }
    // scored transitions: pure f(t, velocity) on the sfx bus (single call site)
    scoreTransitions(m.T, m.B.in.hardfx, t, dt, velocity);
    // scene reactions (package B): diegetic moments, single call site
    scoreMoments(m.T, m.B.in.foley, t, dt, velocity);
    // per-scene room morph: pure f(t), crossfaded across each gutter
    updateRooms(t, now);
    // adaptive score: wall-clock loop, gain and cutoff as f(t, velocity)
    updateScore(t, velocity, m.T.now());
    // music-bus envelope for the halftone breathe (consumers scale it down)
    const v = m.meter.getValue();
    fx.audioPulse = Math.min(1, Math.max(0, typeof v === "number" ? v : (v[0] ?? 0)));
  } catch (e) {
    warn(e);
    disableAudio();
  }
}
