import type { Gain, ToneBufferSource } from "tone";
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
 * WALL-CLOCK LOCKED, GAIN-MIXED -- not scrubbed by t.
 *
 * Real music has rhythmic identity, and scrubbing it by scroll position sounds
 * like a turntable, not a score. So the cue runs on its own clock from the
 * moment audio is enabled, and only the LAYER GAINS are a function of t. That
 * is standard game vertical layering, and it is scrub-safe by construction:
 * the gains are pure f(t) while the clock is independent of scroll direction.
 *
 * The consequence, accepted deliberately: a hit at a given t lands wherever the
 * music happens to be. The visual frame wins and the music responds by ducking
 * (the director's sidechain already rides B.duckGain, which both bed buses pass
 * through). Stingers are separate one-shots, never part of the loop.
 *
 * The manifest's per-slot `send` is deliberately NOT read here: layers go
 * straight to B.in.music and reach the rooms through the bed send (SEND.bed),
 * as a bed should. Only oneshot.ts has a per-hit send.
 *
 * All three stems came from ONE ACE-Step cue split by Demucs, so they share key,
 * tempo and phase. They are therefore scheduled as a GROUP on a single clock --
 * if they ever drift apart the illusion collapses, so nothing here is allowed to
 * reschedule one layer independently.
 */

const LAYERS = [
  { slot: "mus.score-other" as AudioName, key: "other" },
  { slot: "mus.score-bass" as AudioName, key: "bass" },
  { slot: "mus.score-drums" as AudioName, key: "drums" },
] as const;

/**
 * Crossfade at the loop seam, so the cue never clicks. Tone's "exponential" is
 * an exponential-approach fade, not an equal-power cos/sin pair -- close
 * enough for two copies of the SAME correlated material, where equal-power
 * would actually over-sum.
 */
const XFADE_S = 2.5;
/** How fast a layer follows the arrangement. Slow: this is mixing, not gating. */
const RAMP_S = 1.2;

interface Layer {
  gain: Gain;
  state: { v: number };
  buf: AudioBuffer | null;
  a: ToneBufferSource | null;
  b: ToneBufferSource | null;
}

let mod: ToneModule | null = null;
let layers: Layer[] = [];
let dur = 0;
let nextAt = 0;
let useA = true;
let running = false;

/** Per-issue intensity, 1-5, straight from the registry's beat chart. */
const INTENSITY = ISSUES.map((i) => i.intensity);

export function buildScore(T: ToneModule, B: Buses): void {
  if (layers.length) return;
  mod = T;
  layers = LAYERS.map(() => ({
    gain: new T.Gain(0).connect(B.in.music),
    state: { v: 0 },
    buf: null,
    a: null,
    b: null,
  }));
}

/**
 * Arrangement law. Returns a gain per layer for the scroll position.
 *
 * Interpolated across gutters via roomBlend, which is already the project's
 * pure f(t) "where am I between two scenes" function -- so the arrangement
 * MORPHS between scenes instead of stepping at every boundary.
 */
export function arrangement(t: number, velocity: number): [number, number, number] {
  const { from, to, x } = roomBlend(t);
  const iFrom = INTENSITY[from] ?? 1;
  const iTo = INTENSITY[to] ?? 1;
  // 1..5 -> 0..1
  const raw = (iFrom + (iTo - iFrom) * x - 1) / 4;
  const i = Math.min(1, Math.max(0, raw));

  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
  // Harmonic bed: always present, but it drops well down in the quiet valleys
  // (origin and terminal are intensity 1) rather than sitting at a constant
  // level, so silence is a real dynamic rather than an absence.
  const other = 0.22 + 0.78 * i;
  // Bass enters second, drums last: the two things that make a cue feel driven.
  const bass = clamp01((i - 0.12) / 0.45);
  const drums = clamp01((i - 0.38) / 0.45);

  // Velocity nudges the driving layers, and gently -- drums most, bass a
  // quarter as much, the harmonic bed not at all. A fast scroll should feel
  // like a fast-forward, not like the mix falling apart, and boosting
  // everything would just make scrubbing loud.
  const v = Math.min(1, Math.abs(velocity));
  // Clamped: at intensity 5 with a fast scroll the boost would otherwise reach
  // 1.18 and be paid for by the limiter rather than heard.
  return [other, Math.min(1, bass * (1 + 0.05 * v)), Math.min(1, drums * (1 + 0.18 * v))];
}

/** Schedule one cycle of all three stems, locked together. */
function schedule(at: number): void {
  const T = mod;
  if (!T) return;
  for (const l of layers) {
    if (!l.buf) continue;
    // Fades MUST be constructor options. Tone reads fadeIn and curve inside
    // start() -> OneShotSource._startGain, so assigning them afterwards is a
    // no-op: the incoming copy would begin at full gain on a non-zero sample
    // and the outgoing one would hard-cut at its buffer end. Both click, and
    // two correlated copies would sum ~+3 dB across the overlap.
    //
    // The explicit duration is what schedules the fadeOut at all -- start(at)
    // with no duration never does.
    const src = new T.ToneBufferSource({
      url: l.buf,
      fadeIn: XFADE_S,
      fadeOut: XFADE_S,
      curve: "exponential",
      // Tone only runs its dispose-on-ended path when onended is not its
      // internal noOp, so this one line is what stops three sources (each with
      // an internal Gain) leaking per cycle. Same idiom as oneshot.ts.
      onended: () => {},
    }).connect(l.gain);
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
    //
    // dur is the GROUP duration. Using l.buf.duration here would be the one
    // way a re-bake could drift the layers apart, which this module forbids.
    src.start(at, 0, dur - XFADE_S);
    if (useA) l.a = src;
    else l.b = src;
  }
  useA = !useA;
}

export function updateScore(t: number, velocity: number, now: number): void {
  const T = mod;
  if (!T || !layers.length) return;

  // Lazily bind buffers; the bank loads in the background, so the score simply
  // starts once its stems have landed rather than blocking anything.
  if (!running) {
    let ready = true;
    for (let i = 0; i < LAYERS.length; i++) {
      const l = layers[i]!;
      if (!l.buf) l.buf = sample(LAYERS[i]!.slot, 0);
      if (!l.buf) ready = false;
    }
    if (!ready) return;
    // From the DECODED buffer: the AAC length is the declared duration plus
    // priming/padding. All three share it, so the group stays locked.
    dur = layers[0]!.buf!.duration;
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
    // several full-level copies of all three stems would fire at once.
    // Threshold is one crossfade, not one second: inside that window the late
    // seam is the cheaper artifact, while a restart crosses two out-of-phase
    // copies of the same cue and flams. Restarting is for the genuinely
    // backgrounded tab this branch exists for.
    if (nextAt < now - XFADE_S) {
      for (const l of layers) {
        for (const src of [l.a, l.b]) {
          try {
            src?.stop();
          } catch {
            // already stopped
          }
        }
      }
      nextAt = now + 0.1;
    }
    schedule(nextAt);
    nextAt += dur - XFADE_S;
  }

  const g = arrangement(t, velocity);
  for (let i = 0; i < layers.length; i++) {
    moveTo(layers[i]!.gain.gain, layers[i]!.state, g[i]!, RAMP_S, 0.02);
  }
}

export function stopScore(): void {
  for (const l of layers) {
    for (const src of [l.a, l.b]) {
      try {
        src?.stop();
      } catch {
        // already stopped
      }
    }
    l.a = null;
    l.b = null;
    l.state.v = 0;
  }
  running = false;
  useA = true;
}
