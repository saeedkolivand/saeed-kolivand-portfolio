import { noise01 } from "./util";

/**
 * Impulse response generation. Zero bytes ship: every room is rendered in an
 * OfflineAudioContext on the client, in a few milliseconds, from parameters
 * that stay reviewable as a table in rooms.ts.
 *
 * Encoding IRs as files would be actively worse, not just bigger: lossy codecs
 * introduce pre-echo, and pre-echo INSIDE an impulse response smears the attack
 * of every single sound convolved with it.
 *
 * Determinism: the noise is drawn from a seeded avalanche mixer, so a room is
 * byte-identical across sessions and machines. No Math.random (engine law).
 */

export interface RoomSpec {
  id: string;
  /** tail length in seconds */
  decay: number;
  /** direct-to-reverberant gap in seconds */
  preDelay: number;
  /** decay multipliers for low / mid / high, relative to `decay` */
  bandDecay: readonly [number, number, number];
  /** early reflections as [timeSec, gain, pan]; sparse early, dense late */
  taps: readonly (readonly [number, number, number])[];
  /** 0..1 left/right decorrelation */
  width: number;
  seed: number;
}

/** Crossover points for the three decay bands. */
const LOW_HZ = 300;
const MID_HZ = 1600;
const HIGH_HZ = 4000;

/**
 * A tail is not one noise burst with one envelope. Real rooms absorb high
 * frequencies fastest (air plus soft surfaces), so the top of the spectrum has
 * to die well before the bottom -- that difference is most of what makes a
 * space read as a specific place rather than generic mush.
 */
export async function renderIR(spec: RoomSpec, sampleRate: number): Promise<AudioBuffer> {
  const len = Math.max(1, Math.ceil((spec.preDelay + spec.decay) * sampleRate));
  const ctx = new OfflineAudioContext(2, len, sampleRate);

  // Deterministic stereo noise. Left and right draw from disjoint streams so
  // width is a tunable rather than an accident -- and at width 0 they collapse
  // to the same signal, which is correct for a narrow space like a tunnel.
  const noise = ctx.createBuffer(2, len, sampleRate);
  const rShift = Math.round(spec.width * 1e6);
  for (let c = 0; c < 2; c++) {
    const data = noise.getChannelData(c);
    const base = spec.seed + (c === 1 ? rShift : 0);
    // noise01, NOT h01: h01 is linear in its argument, so over consecutive
    // sample indices it degenerates into a sawtooth near 0.38 * rate -- a
    // whistle rather than a tail. See the note in util.ts.
    for (let i = 0; i < len; i++) data[i] = noise01(base + i) * 2 - 1;
  }

  const src = ctx.createBufferSource();
  src.buffer = noise;

  // Density ramp: early reflections are sparse and late reverb is Gaussian.
  // Gating the noise sparsely at the start and densely later is what stops a
  // decaying-noise IR sounding like a burst of static.
  const dense = ctx.createGain();
  const rampLen = Math.min(len, Math.ceil(0.08 * sampleRate));
  const densityCurve = new Float32Array(64);
  for (let i = 0; i < densityCurve.length; i++) {
    densityCurve[i] = 0.25 + 0.75 * Math.pow(i / (densityCurve.length - 1), 0.6);
  }
  dense.gain.setValueCurveAtTime(densityCurve, 0, rampLen / sampleRate);
  src.connect(dense);

  const preDelayNode = ctx.createDelay(Math.max(0.001, spec.preDelay + 0.001));
  preDelayNode.delayTime.value = spec.preDelay;
  dense.connect(preDelayNode);

  // Three parallel bands, each with its own exponential decay.
  const bands: [BiquadFilterType, number, number][] = [
    ["lowpass", LOW_HZ, spec.bandDecay[0]],
    ["bandpass", MID_HZ, spec.bandDecay[1]],
    ["highpass", HIGH_HZ, spec.bandDecay[2]],
  ];
  for (const [type, freq, mult] of bands) {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = type === "bandpass" ? 0.7 : 0.5;
    const g = ctx.createGain();
    const t60 = Math.max(0.02, spec.decay * mult);
    const steps = 128;
    const curve = new Float32Array(steps);
    for (let i = 0; i < steps; i++) {
      curve[i] = Math.exp((-6.907755 * (i / (steps - 1)) * spec.decay) / t60);
    }
    g.gain.setValueCurveAtTime(curve, 0, spec.decay);
    preDelayNode.connect(f);
    f.connect(g);
    g.connect(ctx.destination);
  }

  // Early reflections. These are what tell the ear a wall exists, and their
  // absence is exactly why a pure decaying-noise tail reads as "no room" --
  // which is why the cosmos room below deliberately ships zero taps.
  for (const [time, tapGain, pan] of spec.taps) {
    const tap = ctx.createBufferSource();
    tap.buffer = noise;
    const g = ctx.createGain();
    g.gain.value = 0;
    const at = spec.preDelay + time;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(tapGain, at + 0.0006);
    g.gain.linearRampToValueAtTime(0, at + 0.012);
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    tap.connect(g);
    g.connect(p);
    p.connect(ctx.destination);
    tap.start(0);
  }

  src.start(0);
  const rendered = await ctx.startRendering();

  // Fixed-RMS normalise. Convolvers run with normalize = false so RoomSpec
  // controls level explicitly; without this, changing a room's decay would
  // also change how loud the whole scene is.
  let sum = 0;
  let n = 0;
  for (let c = 0; c < rendered.numberOfChannels; c++) {
    const d = rendered.getChannelData(c);
    for (let i = 0; i < d.length; i++) {
      const v = d[i]!;
      sum += v * v;
      n++;
    }
  }
  const rms = Math.sqrt(sum / Math.max(1, n));
  if (rms > 1e-9) {
    const g = 0.06 / rms;
    for (let c = 0; c < rendered.numberOfChannels; c++) {
      const d = rendered.getChannelData(c);
      for (let i = 0; i < d.length; i++) d[i] = d[i]! * g;
    }
  }
  return rendered;
}

/** Feature check -- Safari private modes and old engines have surprised us before. */
export function canRenderIR(): boolean {
  return typeof OfflineAudioContext !== "undefined";
}
