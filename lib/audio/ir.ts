import { mix32, noise01 } from "./util";

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
 * identical across sessions ON A GIVEN MACHINE. Not byte-identical ACROSS
 * machines -- BiquadFilterNode and setValueCurveAtTime are implementation-
 * defined, and sampleRate is 44.1k or 48k by device. Do not hash this output
 * in a gate. No Math.random either way (engine law).
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
  const Ctor =
    typeof OfflineAudioContext !== "undefined"
      ? OfflineAudioContext
      : (globalThis as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext })
          .webkitOfflineAudioContext;
  const ctx = new Ctor(2, len, sampleRate);

  // Deterministic stereo noise.
  //
  // Stream starts are SCATTERED through the 2^32 space rather than spaced by
  // the seed value. Seeds ~100 apart against IRs of 17k-157k samples would make
  // every room a window onto the same sequence at a ~100-sample lag -- and
  // since both convolvers share roomIn, a gutter crossfade would then sum two
  // near-identical noise realisations ~2 ms apart and comb-filter, at exactly
  // the moment the crossfade exists to serve.
  const noise = ctx.createBuffer(2, len, sampleRate);
  const shared = mix32(spec.seed * 2);
  const indep = mix32(spec.seed * 2 + 1);
  const left = noise.getChannelData(0);
  const right = noise.getChannelData(1);
  for (let i = 0; i < len; i++) {
    const a = noise01(shared + i) * 2 - 1;
    const b = noise01(indep + i) * 2 - 1;
    left[i] = a;
    // width interpolates between the two streams rather than merely offsetting
    // one, so it is the continuous 0..1 knob the table treats it as: 0 is a
    // mono point source, 1 is fully decorrelated.
    right[i] = a * (1 - spec.width) + b * spec.width;
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
    // Starts at preDelay, not 0: the signal does not arrive until then, and
    // running the envelope on the wall clock would shorten the effective tail
    // to decay - preDelay and leave a step where the buffer ends.
    g.gain.setValueCurveAtTime(curve, spec.preDelay, spec.decay);
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

  // Normalise to a fixed L2 NORM, not a fixed RMS.
  //
  // For a stationary input, convolution output power is proportional to
  // sum(h[i]^2), and sum(h^2) = n * rms^2 -- so pinning RMS leaves the wet
  // level scaling with sqrt(IR length). Across this table that is sqrt(3.27 /
  // 0.354) = 3.04, nearly +10 dB more wet on the cosmos room than on the
  // sketchbook, purely from the decay difference. Pinning sum(h^2) instead is
  // what actually holds the send level constant as decay changes.
  let energy = 0;
  for (let c = 0; c < rendered.numberOfChannels; c++) {
    const d = rendered.getChannelData(c);
    for (let i = 0; i < d.length; i++) {
      const v = d[i]!;
      energy += v * v;
    }
  }
  if (energy > 1e-12) {
    const g = 18 / Math.sqrt(energy);
    for (let c = 0; c < rendered.numberOfChannels; c++) {
      const d = rendered.getChannelData(c);
      for (let i = 0; i < d.length; i++) d[i] = d[i]! * g;
    }
  }
  return rendered;
}

/** Feature check. Safari shipped this prefixed for years, hence the fallback. */
export function canRenderIR(): boolean {
  return (
    typeof OfflineAudioContext !== "undefined" ||
    typeof (globalThis as { webkitOfflineAudioContext?: unknown }).webkitOfflineAudioContext !==
      "undefined"
  );
}
