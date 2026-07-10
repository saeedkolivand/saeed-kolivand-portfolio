import type { EQ3, Filter, Gain, MembraneSynth, Meter, Reverb, Synth } from "tone";
import { useScrollStore } from "@/lib/scrollStore";
import { fx } from "@/lib/fx";
import { setBeatSound } from "@/lib/beats";
import { clamp01 } from "@/lib/shots";
import { RANGES } from "@/issues/timeline";
import { audioRecipes, type AudioRecipe, type ToneModule } from "./types";
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
 * Chain: per-issue crossfade gains -> music bus \
 *                                                out gain -> EQ3(high -3) ->
 *        one-shots (thump/chime/meow) -> sfx bus /  Compressor -> Limiter(-1)
 *        -> destination (ceiling -9 dB). Both buses also SEND to a shared
 *        highpass -> Reverb whose return sums back into out (dry paths intact).
 *
 * Beat sounds ride lib/beats.ts setBeatSound, which only fires from
 * BeatRunner crossings -- reduced motion already suppresses those, so the
 * sounds inherit the suppression for free.
 */

interface Master {
  T: ToneModule;
  out: Gain;
  eq: EQ3;
  verbSend: Gain;
  verbHp: Filter;
  verb: Reverb;
  music: Gain;
  duckGain: Gain;
  sfx: Gain;
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
    await T.start(); // unlock -- initiated from the gesture's task
    if (session !== mySession) return; // disabled mid-flight
    // default lookAhead (100ms) makes beat hits lag their visual flash
    T.getContext().lookAhead = 0.02;
    if (!master) master = buildMaster(T);
    wire();
    master.out.gain.rampTo(1, 0.1);
    uiSound("toggleOn"); // first thing the user hears (package C)
    enabled = true;
    pending = false;
    lastNow = performance.now();
    beatFree = 0; // reset the one-shot gate on every (re-)enable
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
      } catch (e) {
        warn(e);
      }
    }, 250);
  } catch (e) {
    warn(e);
  }
}

function buildMaster(T: ToneModule): Master {
  const eq = new T.EQ3({ low: 0, mid: 0, high: -3 }); // head: tame brittle square highs
  const comp = new T.Compressor({ threshold: -18, ratio: 3 });
  const limiter = new T.Limiter(-1);
  const out = new T.Gain(0);
  out.chain(eq, comp, limiter, T.getDestination());
  T.getDestination().volume.value = -9; // master ceiling

  // duckGain sits between music and out so the sidechain duck rides HERE, not
  // on music.gain: the meter taps music PRE-duck, so ducking never pumps
  // fx.audioPulse (the halftone-breathe shader) -- a duck must not move a visual.
  const duckGain = new T.Gain(1).connect(out);
  const music = new T.Gain(1).connect(duckGain);
  const sfx = new T.Gain(1).connect(out);
  const meter = new T.Meter({ smoothing: 0.9, normalRange: true });
  music.connect(meter); // pre-duck tap: visual meter stays clean

  // Shared reverb SEND (not insert): both buses also feed a common send whose
  // return sums back into `out`; the dry music/sfx -> out paths are untouched.
  // Music feeds the send POST-duck (from duckGain) so the reverb tail ducks
  // with the bed; sfx feeds it dry. Send gain rides at 0 until the async IR
  // generates, then eases to 0.18; if generation fails we warn and stay fully
  // dry (mix unaffected either way).
  const verbSend = new T.Gain(0);
  duckGain.connect(verbSend);
  sfx.connect(verbSend);
  const verbHp = new T.Filter(250, "highpass");
  const verb = new T.Reverb({ decay: 2.2, preDelay: 0.02, wet: 1 });
  verbSend.chain(verbHp, verb, out);
  void verb.ready.then(() => verbSend.gain.rampTo(0.18, 0.5)).catch(warn);

  const thump = new T.MembraneSynth({
    pitchDecay: 0.08,
    octaves: 5,
    envelope: { attack: 0.002, decay: 0.4, sustain: 0, release: 0.1 },
    volume: -6,
  }).connect(sfx);
  const chime = new T.Synth({
    oscillator: { type: "fattriangle", count: 3, spread: 14 },
    envelope: { attack: 0.02, decay: 0.25, sustain: 0, release: 0.3 },
    volume: -18,
  }).connect(sfx);
  channels = audioRecipes.map(() => null);
  return { T, out, eq, verbSend, verbHp, verb, music, duckGain, sfx, meter, thump, chime };
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
      const now = m.T.now();
      if (beatMoment(id, flash)) return; // moment owns the hit (sound or silence)
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
      if (flash > 0.25) {
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
  wireUi(m0.T, m0.sfx);
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
          const gain = new m.T.Gain(0).connect(m.music);
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
    scoreTransitions(m.T, m.sfx, t, dt, velocity);
    // scene reactions (package B): diegetic moments, single call site
    scoreMoments(m.T, m.sfx, t, dt, velocity);
    // music-bus envelope for the halftone breathe (consumers scale it down)
    const v = m.meter.getValue();
    fx.audioPulse = Math.min(1, Math.max(0, typeof v === "number" ? v : (v[0] ?? 0)));
  } catch (e) {
    warn(e);
    disableAudio();
  }
}
