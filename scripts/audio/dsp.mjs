/**
 * Offline DSP primitives for the audio bake (scripts/bake-audio.mjs).
 *
 * Scope rule: this file generates SAMPLES. Everything downstream that ffmpeg
 * already does correctly -- filtering, convolution, mixing, resampling, EBU
 * R128 loudness, true-peak limiting, encoding -- is ffmpeg's job, not ours.
 * Hand-rolling BS.1770 would be a few hundred lines to reproduce something
 * `loudnorm` has done properly for a decade.
 *
 * There is no realtime budget here. A bake can afford 400-voice modal banks
 * and 100k-grain scatters that would be impossible at 60fps in a browser --
 * which is the entire reason the assets are baked rather than synthesized at
 * runtime.
 *
 * Determinism: no Math.random. Every random draw comes from a seeded PRNG so
 * a re-bake is byte-identical. Mirrors the runtime law in lib/audio/util.ts.
 */

import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// ---------------------------------------------------------------- randomness

/**
 * PCG32. Small, fast, and far better distributed than the Knuth hash the
 * runtime uses -- the runtime needs cheap per-frame hashing, a bake needs
 * millions of good draws for grain scatter.
 */
export function rng(seed) {
  let state = BigInt.asUintN(64, BigInt(seed) * 6364136223846793005n + 1442695040888963407n);
  const MUL = 6364136223846793005n;
  const INC = 1442695040888963407n;
  const next = () => {
    const old = state;
    state = BigInt.asUintN(64, old * MUL + INC);
    const xorshifted = Number(BigInt.asUintN(32, ((old >> 18n) ^ old) >> 27n));
    const rot = Number(old >> 59n);
    return ((xorshifted >>> rot) | (xorshifted << ((-rot) & 31))) >>> 0;
  };
  const f = () => next() / 4294967296;
  return {
    u32: next,
    /** uniform [0,1) */
    f,
    /** uniform [lo,hi) */
    range: (lo, hi) => lo + f() * (hi - lo),
    /** log-uniform [lo,hi) -- the right distribution for frequencies */
    logRange: (lo, hi) => lo * Math.pow(hi / lo, f()),
    /** standard normal, Box-Muller */
    normal: () => Math.sqrt(-2 * Math.log(1 - f())) * Math.cos(2 * Math.PI * f()),
    /** Pareto, for heavy-tailed inter-event gaps (fracture cascades) */
    pareto: (alpha) => Math.pow(1 - f(), -1 / alpha),
  };
}

// -------------------------------------------------------------------- buffers

export const buf = (n) => new Float32Array(n);
export const secs = (t, sr) => Math.max(1, Math.round(t * sr));

/** Add `src` into `dst` at sample offset `at`, scaled by `gain`. Clips at the end. */
export function mixInto(dst, src, at, gain = 1) {
  const start = Math.max(0, at | 0);
  const n = Math.min(src.length, dst.length - start);
  for (let i = 0; i < n; i++) dst[start + i] += src[i] * gain;
  return dst;
}

/** Peak-normalize in place to `peak` (linear). Returns the gain applied. */
export function normalize(b, peak = 0.99) {
  let m = 0;
  for (let i = 0; i < b.length; i++) {
    const a = Math.abs(b[i]);
    if (a > m) m = a;
  }
  if (m === 0) return 0;
  const g = peak / m;
  for (let i = 0; i < b.length; i++) b[i] *= g;
  return g;
}

/** Remove DC offset in place. Generative and granular sources both drift. */
export function dcRemove(b) {
  let sum = 0;
  for (let i = 0; i < b.length; i++) sum += b[i];
  const dc = sum / b.length;
  for (let i = 0; i < b.length; i++) b[i] -= dc;
  return b;
}

// ------------------------------------------------------------------ envelopes

/** exp decay to -60dB over t60 seconds, evaluated at sample i */
export const decayAt = (i, sr, t60) => Math.exp((-6.907755 * i) / (t60 * sr));

/** Apply a short raised-cosine fade in/out, in place. Kills onset/offset clicks. */
export function fade(b, sr, inSec = 0.002, outSec = 0.01) {
  const ni = Math.min(secs(inSec, sr), b.length);
  const no = Math.min(secs(outSec, sr), b.length);
  for (let i = 0; i < ni; i++) b[i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / ni);
  for (let i = 0; i < no; i++) {
    const w = 0.5 - 0.5 * Math.cos((Math.PI * i) / no);
    b[b.length - 1 - i] *= w;
  }
  return b;
}

// ---------------------------------------------------------------------- noise

/** White noise, [-1,1]. */
export function white(n, r) {
  const b = buf(n);
  for (let i = 0; i < n; i++) b[i] = r.f() * 2 - 1;
  return b;
}

/** Pink noise (-3 dB/oct) via the Voss-McCartney / Paul Kellet filter. */
export function pink(n, r) {
  const b = buf(n);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < n; i++) {
    const w = r.f() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    b[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  return b;
}

/** Brown noise (-6 dB/oct), leaky-integrated white. */
export function brown(n, r) {
  const b = buf(n);
  let last = 0;
  for (let i = 0; i < n; i++) {
    last = (last + 0.02 * (r.f() * 2 - 1)) / 1.02;
    b[i] = last * 3.5;
  }
  return b;
}

// --------------------------------------------------------------------- filter

/**
 * RBJ biquad. Only needed where filtering happens INSIDE a synthesis loop
 * (per-grain colouring, per-mode excitation). Whole-buffer filtering is
 * ffmpeg's job.
 */
export function biquad(type, f0, Q, sr) {
  const w0 = (2 * Math.PI * f0) / sr;
  const c = Math.cos(w0);
  const s = Math.sin(w0);
  const alpha = s / (2 * Q);
  let b0, b1, b2, a0, a1, a2;
  if (type === "lowpass") {
    b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2;
    a0 = 1 + alpha; a1 = -2 * c; a2 = 1 - alpha;
  } else if (type === "highpass") {
    b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2;
    a0 = 1 + alpha; a1 = -2 * c; a2 = 1 - alpha;
  } else {
    // bandpass, constant 0 dB peak gain
    b0 = alpha; b1 = 0; b2 = -alpha;
    a0 = 1 + alpha; a1 = -2 * c; a2 = 1 - alpha;
  }
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

/** Apply biquad in place (direct form I). */
export function applyBiquad(b, k) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < b.length; i++) {
    const x = b[i];
    const y = k.b0 * x + k.b1 * x1 + k.b2 * x2 - k.a1 * y1 - k.a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    b[i] = y;
  }
  return b;
}

// ------------------------------------------------------------------ modal

/**
 * Modal synthesis: a struck object rings as a sum of exponentially decaying
 * sinusoids. Additive rather than a resonator bank -- exact, unconditionally
 * stable, and at bake time the cost does not matter.
 *
 * `modes`: [{ f, a, t60 }]. The INHARMONIC ratios between f values are what
 * make a material identifiable; see MATERIALS below.
 */
export function modal(n, sr, modes, r, jitterCents = 0, attackSec = 0.0006) {
  const out = buf(n);
  for (const m of modes) {
    const det = jitterCents ? Math.pow(2, (r.range(-jitterCents, jitterCents)) / 1200) : 1;
    const w = (2 * Math.PI * m.f * det) / sr;
    const d = Math.exp(-6.907755 / (m.t60 * sr));
    // Phase 0, deliberately. A random start phase means each partial begins at
    // a nonzero value -- a step discontinuity -- and the sum of those steps is
    // a broadband click that swamps the transient layer. It shows up on a
    // spectrogram as a full-height bar at every single onset, which is exactly
    // what "cheap synthesized impact" looks like. Starting at sin(0) lets each
    // partial rise from silence over its own first quarter cycle.
    let amp = m.a;
    for (let i = 0; i < n; i++) {
      out[i] += amp * Math.sin(w * i);
      amp *= d;
      if (amp < 1e-7) break;
    }
  }
  // Sub-millisecond attack. The strike's sharpness is the transient layer's
  // job; the body arriving a hair later is what real objects do anyway.
  const na = Math.min(secs(attackSec, sr), out.length);
  if (na > 1) for (let i = 0; i < na; i++) out[i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / na);
  return out;
}

/**
 * Mode frequency ratios by material. These ratios ARE the material -- get them
 * wrong and every impact sounds like the same generic thud, which is precisely
 * the failure mode of the current runtime synthesis.
 *
 * Steel/glass are strongly inharmonic; wood is damped and dense; a clamped-free
 * steel tine (music box) has the widest spacing of all, its second partial
 * sitting more than two octaves above the fundamental.
 */
export const MATERIALS = {
  steel: { ratios: [1, 1.74, 2.61, 3.88, 5.2, 7.1, 8.9, 11.3], t60: 1.6, damp: 0.62 },
  aluminium: { ratios: [1, 2.11, 3.42, 5.09, 6.98, 9.2], t60: 1.1, damp: 0.66 },
  glass: { ratios: [1, 2.32, 4.25, 6.63, 9.38, 12.4], t60: 0.9, damp: 0.7 },
  wood: { ratios: [1, 1.61, 2.29, 3.11, 4.02], t60: 0.22, damp: 0.42 },
  ceramic: { ratios: [1, 2.05, 3.37, 4.9, 6.8], t60: 0.55, damp: 0.6 },
  // clamped-free bar: (beta_n L)^2 with beta L = 1.8751, 4.6941, 7.8548, 10.9955
  tine: { ratios: [1, 6.267, 17.55, 34.39, 56.84], t60: 2.4, damp: 0.35 },
  concrete: { ratios: [1, 1.42, 1.88, 2.31, 2.9], t60: 0.16, damp: 0.3 },
};

/**
 * Build a mode list for a material at fundamental f0.
 * Higher modes decay faster (`damp`), which is what real objects do and what
 * makes a strike read as an object rather than a chord.
 */
export function modesFor(material, f0, count = 0, gain = 1) {
  const m = MATERIALS[material];
  if (!m) throw new Error("unknown material: " + material);
  const ratios = count ? m.ratios.slice(0, count) : m.ratios;
  return ratios.map((ratio, i) => ({
    f: f0 * ratio,
    a: (gain * Math.pow(0.72, i)) / ratios.length,
    t60: m.t60 * Math.pow(m.damp, i),
  }));
}

// --------------------------------------------------------------------- grains

/**
 * Granular scatter: place short events on a timeline. This is how rain,
 * crowds, paper tears, pencil friction and debris are built -- thousands of
 * discrete events, not one filtered noise band. The difference between those
 * two approaches is most of the difference between "cheap" and "real".
 *
 * `rateAt(u)` returns events per second at normalized position u in [0,1);
 * `emit(r, u)` returns a Float32Array for one event.
 */
export function scatter(n, sr, rateAt, emit, r) {
  const out = buf(n);
  let t = 0;
  let guard = 0;
  while (t < n && guard++ < 2_000_000) {
    const u = t / n;
    const rate = Math.max(0.01, rateAt(u));
    // Poisson process: exponentially distributed gaps. A fixed grid would
    // buzz at the grid frequency, which is the classic granular giveaway.
    t += Math.max(1, Math.round((-Math.log(1 - r.f()) / rate) * sr));
    if (t >= n) break;
    mixInto(out, emit(r, u), t, 1);
  }
  return out;
}

// ------------------------------------------------------------------------ wav

/**
 * 32-bit float WAV. Float because every consumer here is ffmpeg, and staying
 * in float to the last step means no intermediate quantization and no chance
 * of a clip before `loudnorm` has had its say.
 */
export function writeWav(path, channels, sr) {
  const ch = channels.length;
  const n = channels[0].length;
  const dataBytes = n * ch * 4;
  const b = Buffer.alloc(44 + dataBytes);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + dataBytes, 4);
  b.write("WAVE", 8);
  b.write("fmt ", 12);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(3, 20); // IEEE float
  b.writeUInt16LE(ch, 22);
  b.writeUInt32LE(sr, 24);
  b.writeUInt32LE(sr * ch * 4, 28);
  b.writeUInt16LE(ch * 4, 32);
  b.writeUInt16LE(32, 34);
  b.write("data", 36);
  b.writeUInt32LE(dataBytes, 40);
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      b.writeFloatLE(channels[c][i], o);
      o += 4;
    }
  }
  writeFileSync(path, b);
  return path;
}

/**
 * Decorrelate a mono buffer into a stereo pair by running each side through a
 * different sparse early-reflection pattern. Real stereo width comes from the
 * two ears hearing different reflections, NOT from panning one source, which
 * is why the current runtime beds sound like they are inside your head.
 */
export function selfCheck() {
  const ok = (name, cond) => {
    if (!cond) throw new Error("dsp selfCheck FAILED: " + name);
    console.log("  ok  " + name);
  };
  const sr = 48000;

  const a = rng(12345);
  const b = rng(12345);
  ok("prng is deterministic", a.f() === b.f() && a.f() === b.f());
  ok("prng differs on another seed", rng(9).f() !== rng(10).f());

  const w = white(20000, rng(1));
  let mean = 0;
  for (const v of w) mean += v;
  ok("white noise is centred", Math.abs(mean / w.length) < 0.02);

  // pink must carry more low-band energy than white; crude but it catches a
  // broken filter, which is the only failure worth testing for here.
  const energy = (x, lo, hi) => {
    const c = Float32Array.from(x);
    applyBiquad(c, biquad("bandpass", Math.sqrt(lo * hi), 0.7, sr));
    let e = 0;
    for (const v of c) e += v * v;
    return e;
  };
  const p = pink(48000, rng(2));
  const wn = white(48000, rng(2));
  const tilt = (x) => energy(x, 80, 200) / Math.max(1e-9, energy(x, 4000, 10000));
  ok("pink is tilted below white", tilt(p) > tilt(wn) * 4);

  const t60 = 0.5;
  const m = modal(sr, sr, [{ f: 440, a: 1, t60 }], rng(3));
  const peakIn = (from, to) => {
    let mx = 0;
    for (let i = from; i < to; i++) mx = Math.max(mx, Math.abs(m[i]));
    return mx;
  };
  const early = peakIn(0, 480);
  const atT60 = peakIn(secs(t60, sr) - 480, secs(t60, sr));
  const ratio = early / atT60;
  // -60 dB is 1000x; allow a wide band since we are peak-picking short windows
  ok("modal decays ~60dB over t60", ratio > 300 && ratio < 4000);

  const steel = modesFor("steel", 200);
  ok("modal ratios are inharmonic", Math.abs(steel[1].f / steel[0].f - 1.74) < 1e-6);
  ok("higher modes decay faster", steel[3].t60 < steel[0].t60);

  const sc = scatter(sr, sr, () => 100, () => Float32Array.of(1), rng(4));
  let hits = 0;
  for (const v of sc) if (v !== 0) hits++;
  ok("scatter density tracks rate", hits > 60 && hits < 150);

  const d = buf(100);
  for (let i = 0; i < 100; i++) d[i] = 0.5;
  dcRemove(d);
  ok("dc removal centres a constant", Math.abs(d[0]) < 1e-6);

  const nb = buf(10);
  nb[5] = 0.25;
  ok("normalize hits target peak", (normalize(nb, 0.9), Math.abs(nb[5] - 0.9) < 1e-6));

  const [L, R] = widen(white(4800, rng(5)), sr, rng(6));
  let diff = 0;
  for (let i = 0; i < L.length; i++) diff += Math.abs(L[i] - R[i]);
  ok("widen decorrelates the channels", diff / L.length > 0.01);

  console.log("dsp selfCheck passed");
}

export function widen(mono, sr, r, spreadMs = 22, taps = 7) {
  const L = Float32Array.from(mono);
  const R = Float32Array.from(mono);
  for (const [side, seedShift] of [[L, 0], [R, 1]]) {
    for (let i = 0; i < taps; i++) {
      const d = secs(r.range(0.0008, spreadMs / 1000), sr);
      const g = r.range(0.12, 0.34) * (i % 2 === 0 ? 1 : -1) * (seedShift ? 0.9 : 1);
      for (let j = side.length - 1; j >= d; j--) side[j] += mono[j - d] * g;
    }
  }
  return [L, R];
}

// Runnable check: `node scripts/audio/dsp.mjs`
// argv[1] is undefined under `node -e`, where this module is only ever imported.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) selfCheck();
