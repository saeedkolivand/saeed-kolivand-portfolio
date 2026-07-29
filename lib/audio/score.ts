import type { Filter, Gain, ToneBufferSource } from "tone";
import { ISSUES } from "@/issues/registry";
import type { Buses } from "./buses";
import { sample } from "./bank";
import type { AudioName } from "./manifest";
import { roomBlend } from "./rooms";
import { moveTo } from "./util";
import type { ToneModule } from "./types";

/**
 * The adaptive score. There was no music on this site at all before this.
 *
 * ONE CUE, MIXED AS THE MODEL BALANCED IT. This used to be three Demucs stems
 * gain-mixed as vertical layers; it is now the single Stable Audio 3 render,
 * shipped whole. The instruments are not separated -- so the arrangement moves
 * the cue's LEVEL and its BRIGHTNESS instead of muting parts of it, which is
 * the same dynamic reached from the other side: a quiet scene gets a distant,
 * dark, receded score rather than a mix with its drummer removed.
 *
 * WALL-CLOCK LOCKED, GAIN-MIXED -- not scrubbed by t.
 *
 * Real music has rhythmic identity, and scrubbing it by scroll position sounds
 * like a turntable, not a score. So the cue runs on its own clock from the
 * moment audio is enabled, and only the GAIN and CUTOFF are a function of t.
 * That is scrub-safe by construction: both are pure f(t) while the clock is
 * independent of scroll direction.
 *
 * The consequence, accepted deliberately: a hit at a given t lands wherever the
 * music happens to be. The visual frame wins and the music responds by ducking
 * (the director's sidechain already rides B.duckGain, which the bed passes
 * through). Stingers are separate one-shots, never part of the loop.
 *
 * The manifest's per-slot `send` is deliberately NOT read here: the cue goes
 * straight to B.in.music and reaches the rooms through the bed send (SEND.bed),
 * as a bed should. Only oneshot.ts has a per-hit send.
 */

const SLOT = "mus.score" as AudioName;

/**
 * Crossfade at the loop seam, so the cue never clicks. Tone's "exponential" is
 * an exponential-approach fade, not an equal-power cos/sin pair -- close
 * enough for two copies of the SAME correlated material, where equal-power
 * would actually over-sum.
 */
const XFADE_S = 2.5;
/** How fast the score follows the arrangement. Slow: this is mixing, not gating. */
const RAMP_S = 1.2;
/** Cutoff at intensity 0 and 1. Swept geometrically -- pitch, not hertz. */
const CUT_LO = 900;
const CUT_HI = 18000;

let mod: ToneModule | null = null;
let gain: Gain | null = null;
let filter: Filter | null = null;
const gainState = { v: 0 };
const cutState = { v: 0 };
let buf: AudioBuffer | null = null;
let a: ToneBufferSource | null = null;
let b: ToneBufferSource | null = null;
let dur = 0;
let nextAt = 0;
let useA = true;
let running = false;

/** Per-issue intensity, 1-5, straight from the registry's beat chart. */
const INTENSITY = ISSUES.map((i) => i.intensity);

export function buildScore(T: ToneModule, B: Buses): void {
  if (gain) return;
  mod = T;
  // -12 dB/oct, not -24. The cue is the only music on the site, so the filter
  // has to darken it without sounding like a DJ filter sweep.
  filter = new T.Filter({ type: "lowpass", frequency: CUT_HI, rolloff: -12 });
  gain = new T.Gain(0).connect(B.in.music);
  filter.connect(gain);
}

/**
 * Arrangement law. Returns [gain, cutoff Hz] for the scroll position.
 *
 * Interpolated across gutters via roomBlend, which is already the project's
 * pure f(t) "where am I between two scenes" function -- so the arrangement
 * MORPHS between scenes instead of stepping at every boundary.
 */
export function arrangement(t: number, velocity: number): [number, number] {
  const { from, to, x } = roomBlend(t);
  const iFrom = INTENSITY[from] ?? 1;
  const iTo = INTENSITY[to] ?? 1;
  // 1..5 -> 0..1
  const raw = (iFrom + (iTo - iFrom) * x - 1) / 4;
  const i = Math.min(1, Math.max(0, raw));

  // Never off, but well down in the quiet valleys (cover, origin and terminal
  // are intensity 1) rather than sitting at a constant level, so silence is a
  // real dynamic rather than an absence.
  const g = 0.28 + 0.72 * i;
  // GEOMETRIC, not linear: an octave is a ratio, so a linear sweep would spend
  // most of its travel in the top two octaves where nobody hears it move.
  const cut = CUT_LO * Math.pow(CUT_HI / CUT_LO, i);

  // Velocity opens the filter rather than raising the level -- a fast scroll
  // should feel like a fast-forward, not like the mix falling apart, and
  // boosting gain would just make scrubbing loud. Clamped at the top so
  // intensity 5 plus a fast scroll cannot ask for more than the cue has.
  const v = Math.min(1, Math.abs(velocity));
  return [Math.min(1, g * (1 + 0.05 * v)), Math.min(CUT_HI, cut * (1 + 0.35 * v))];
}

/** Schedule one cycle of the cue. */
function schedule(at: number): void {
  const T = mod;
  if (!T || !buf || !filter) return;
  // Fades MUST be constructor options. Tone reads fadeIn and curve inside
  // start() -> OneShotSource._startGain, so assigning them afterwards is a
  // no-op: the incoming copy would begin at full gain on a non-zero sample
  // and the outgoing one would hard-cut at its buffer end. Both click, and
  // two correlated copies would sum ~+3 dB across the overlap.
  //
  // The explicit duration is what schedules the fadeOut at all -- start(at)
  // with no duration never does.
  const src = new T.ToneBufferSource({
    url: buf,
    fadeIn: XFADE_S,
    fadeOut: XFADE_S,
    curve: "exponential",
    // Tone only runs its dispose-on-ended path when onended is not its
    // internal noOp, so this one line is what stops a source (each with an
    // internal Gain) leaking per cycle. Same idiom as oneshot.ts.
    onended: () => {},
  }).connect(filter);
  // duration = dur - XFADE_S, NOT buf.duration.
  //
  // start(t, 0, d) schedules stop(t + d), and _stopGain ramps down STARTING
  // at that instant (targetRampTo takes it as the ramp's start). With
  // d = buf.duration the whole fade-out window sits past the last sample and
  // ramps silence: the outgoing copy would still hard-cut at full gain while
  // the incoming one was already at 1.0, summing correlated material to
  // ~+6 dB and then stepping back down. Stopping one fade early puts the
  // ramp over real tail, across exactly the window the incoming copy fades
  // in over -- and Tone keeps the node playing through fadeOut, so nothing
  // is truncated. This is also what makes the AAC priming padding harmless
  // rather than merely claimed to be.
  src.start(at, 0, dur - XFADE_S);
  if (useA) a = src;
  else b = src;
  useA = !useA;
}

export function updateScore(t: number, velocity: number, now: number): void {
  const T = mod;
  if (!T || !gain || !filter) return;

  // Lazily bind the buffer; the bank loads in the background, so the score
  // simply starts once the cue has landed rather than blocking anything.
  if (!running) {
    if (!buf) buf = sample(SLOT, 0);
    if (!buf) return;
    // From the DECODED buffer: the AAC length is the declared duration plus
    // priming/padding.
    dur = buf.duration;
    nextAt = now + 0.1;
    schedule(nextAt);
    nextAt += dur - XFADE_S;
    running = true;
  }

  // One float compare per frame; scheduling happens once per cycle.
  if (now > nextAt - 0.5) {
    // RESYNC, do not catch up. T.now() is the audio clock and keeps running
    // while the tab is hidden; nextAt only advances on an rAF tick, which does
    // not. Returning after a few minutes backgrounded would otherwise schedule
    // one past-dated cycle per frame -- Tone clamps those to currentTime, so
    // several full-level copies of the cue would fire at once.
    // Threshold is one crossfade, not one second: inside that window the late
    // seam is the cheaper artifact, while a restart crosses two out-of-phase
    // copies of the same cue and flams. Restarting is for the genuinely
    // backgrounded tab this branch exists for.
    if (nextAt < now - XFADE_S) {
      for (const src of [a, b]) {
        try {
          src?.stop();
        } catch {
          // already stopped
        }
      }
      nextAt = now + 0.1;
    }
    schedule(nextAt);
    nextAt += dur - XFADE_S;
  }

  const [g, cut] = arrangement(t, velocity);
  moveTo(gain.gain, gainState, g, RAMP_S, 0.02);
  // eps in HERTZ here, not gain units -- 40 Hz is inaudible at any point on
  // the sweep and keeps this to a few rampTo calls per scene rather than one
  // per frame.
  moveTo(filter.frequency, cutState, cut, RAMP_S, 40);
}

export function stopScore(): void {
  for (const src of [a, b]) {
    try {
      src?.stop();
    } catch {
      // already stopped
    }
  }
  a = null;
  b = null;
  gainState.v = 0;
  cutState.v = 0;
  running = false;
  useA = true;
}
