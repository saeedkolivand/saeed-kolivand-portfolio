/**
 * Wave B shared audio helpers. Determinism law: no Math.random anywhere --
 * all pattern variation hashes an integer step index derived from T.now(),
 * so patterns survive stop()/start() and are identical across sessions.
 */

/** Knuth multiplicative hash -> uint32 (same constant as the meow hash). */
export const hash = (n: number): number => Math.imul(n, 2654435761) >>> 0;

/** Deterministic 0..1 from an integer. */
export const h01 = (n: number): number => hash(n) / 4294967296;

/**
 * Avalanche mixer (murmur3 finalizer), for when the index is DENSE.
 *
 * `hash` above is Knuth multiplicative -- Math.imul(n, K) -- which is LINEAR in
 * n, so hash(n + 1) - hash(n) is a CONSTANT. Over the step indices it was
 * written for (a Stepper tick every ~100 ms) that is invisible and perfectly
 * fine. Over CONSECUTIVE indices it is not noise at all: measured over
 * i, i+1, i+2, h01 produces only TWO distinct successive deltas -- a sawtooth
 * -- with autocorrelation 0.98 at lag 144 and a dominant spectral bin at
 * 0.38 * rate. Filling an audio buffer with it yields a near-ultrasonic
 * whistle, not noise.
 *
 * Use noise01 for anything that walks a buffer; keep h01 for step indices.
 */
export function mix32(n: number): number {
  let x = n | 0;
  x = Math.imul(x ^ (x >>> 16), 2246822507);
  x = Math.imul(x ^ (x >>> 13), 3266489909);
  x ^= x >>> 16;
  return x >>> 0;
}

/** Deterministic 0..1 that stays white over consecutive indices. */
export const noise01 = (n: number): number => mix32(n) / 4294967296;

/** Structural type for anything with rampTo (Tone Param / Signal). */
export interface RampTarget {
  rampTo(value: number, rampTime: number): unknown;
}

/**
 * rampTo only on real target moves -- per-frame automation writes are banned
 * (Wave A rule). `s.v` caches the last committed target; a hard 0 always
 * commits so fades never strand a residual.
 */
export function moveTo(
  p: RampTarget,
  s: { v: number },
  target: number,
  time = 0.08,
  eps = 0.015,
): void {
  if (target === s.v) return;
  if (Math.abs(target - s.v) < eps && target > 0) return;
  s.v = target;
  p.rampTo(target, time);
}

/**
 * Integer step clock over T.now(). tick() returns the step index when the
 * clock advances, else -1. The first tick after reset() only primes (no
 * burst of catch-up hits when an issue re-enters the active window).
 */
export class Stepper {
  private last = -1;
  constructor(private readonly rate: number) {}
  tick(now: number): number {
    const s = Math.floor(now * this.rate);
    if (s === this.last) return -1;
    const primed = this.last !== -1;
    this.last = s;
    return primed ? s : -1;
  }
  reset(): void {
    this.last = -1;
  }
}
