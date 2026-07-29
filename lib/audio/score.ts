import type { Gain, ToneBufferSource } from "tone";
import { ISSUES } from "@/issues/registry";
import type { Buses } from "./buses";
import { sample } from "./bank";
import { AUDIO, type AudioName } from "./manifest";
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

/** Equal-power crossfade at the loop seam, so the cue never clicks or dips. */
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

  // Velocity nudges the drums only, and gently. A fast scroll should feel like
  // a fast-forward, not like the mix falling apart, and boosting everything
  // would just make scrubbing loud.
  const v = Math.min(1, Math.abs(velocity));
  return [other, bass * (1 + 0.05 * v), drums * (1 + 0.18 * v)];
}

/** Schedule one cycle of all three stems, locked together. */
function schedule(at: number): void {
  const T = mod;
  if (!T) return;
  for (const l of layers) {
    if (!l.buf) continue;
    const src = new T.ToneBufferSource(l.buf).connect(l.gain);
    src.start(at);
    // Equal-power seam. The outgoing copy is still running under this one for
    // XFADE_S, which is also why the encoder's priming padding never matters:
    // the file boundary is never heard.
    src.fadeIn = XFADE_S;
    src.fadeOut = XFADE_S;
    src.curve = "exponential";
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
    dur = AUDIO[LAYERS[0]!.slot].v[0]!.dur;
    nextAt = now + 0.1;
    schedule(nextAt);
    nextAt += dur - XFADE_S;
    running = true;
  }

  // One float compare per frame; scheduling happens once per cycle.
  if (now > nextAt - 0.5) {
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
