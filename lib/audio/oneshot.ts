import type { Gain, Panner, ToneAudioNode, ToneBufferSource } from "tone";
import type { Buses, BusName } from "./buses";
import { AUDIO, type AudioName } from "./manifest";
import { sample } from "./bank";
import { hash, h01 } from "./util";
import type { ToneModule } from "./types";

/**
 * The one-shot player. One entry point, `hit(name, opts)`.
 *
 * Returns FALSE when it cannot play -- buffer not loaded, slot missing, voice
 * stolen, min-gap refused. That return value is the contract: every call site
 * uses it to fall through to its existing synth voice, so a cold bank or a dead
 * network is inaudible rather than silent.
 *
 * A note on why this deletes a whole class of crash: the single largest failure
 * mode in this engine is non-monotonic synth start times. `VoiceGate` is
 * copy-pasted in three files, plus `wheelFree` and `beatFree`, all guarding
 * against Tone throwing a RangeError that the director's catch turns into a
 * GLOBAL audio disable. A fresh ToneBufferSource has no such constraint -- two
 * hits at the same timestamp are simply two sources. Everything migrated onto
 * this path stops needing a gate.
 */

export interface HitOpts {
  /** deterministic variant + jitter; the SAME seed always gives the same hit */
  seed?: number;
  bus?: BusName;
  /** linear multiplier on the slot's authored gain */
  gain?: number;
  pan?: number;
  /** extra playbackRate multiplier, for doppler */
  rate?: number;
  /** room send override, linear */
  send?: number;
  /** explicit Tone time; defaults to now */
  at?: number;
}

interface Slot {
  gain: Gain;
  panner: Panner;
  send: Gain;
  src: ToneBufferSource | null;
  busy: boolean;
  /** Tone time this slot frees up */
  endsAt: number;
  prio: number;
}

/**
 * Partitioned so a paw-storm can never starve a slam. Sized for the busiest
 * plausible frame rather than the worst imaginable one; over cap, the mixer
 * drops rather than mudding, which is what a real mix does.
 */
const PARTITIONS: Record<string, number> = { foley: 10, hardfx: 6, ui: 4, sub: 4 };
const PARTITION_LOW: Record<string, number> = { foley: 5, hardfx: 3, ui: 2, sub: 2 };

/** Priority by category: what survives when a partition is full. */
const PRIO: Record<string, number> = { ui: 3, imp: 3, cin: 2, amb: 1, mus: 1, fol: 0 };

const pools = new Map<string, Slot[]>();
let mod: ToneModule | null = null;
let B: Buses | null = null;
/** Per-slot last fire time, so a repeated trigger cannot machine-gun. */
const lastFire = new Map<string, number>();

const MIN_GAP_S = 0.02;

export function buildOneshot(T: ToneModule, buses: Buses, low: boolean): void {
  mod = T;
  B = buses;
  pools.clear();
  const sizes = low ? PARTITION_LOW : PARTITIONS;
  for (const [busName, count] of Object.entries(sizes)) {
    const dest = buses.in[busName as BusName];
    const slots: Slot[] = [];
    for (let i = 0; i < count; i++) {
      // Built ONCE. A hit allocates exactly one ToneBufferSource -- unavoidable,
      // since AudioBufferSourceNode is single-use by spec -- and mutates pooled
      // params. Nothing else allocates, and nothing allocates on a frame where
      // nothing fires.
      const send = new T.Gain(0).connect(buses.roomIn);
      const panner = new T.Panner(0).connect(dest);
      panner.connect(send);
      const gain = new T.Gain(1).connect(panner);
      slots.push({ gain, panner, send, src: null, busy: false, endsAt: 0, prio: -1 });
    }
    pools.set(busName, slots);
  }
}

function claim(busName: string, prio: number, now: number): Slot | null {
  const slots = pools.get(busName);
  if (!slots) return null;
  let victim: Slot | null = null;
  for (const s of slots) {
    if (!s.busy || s.endsAt <= now) {
      s.busy = false;
      return s;
    }
    // steal the lowest priority, tie-broken on whichever finishes soonest
    if (!victim || s.prio < victim.prio || (s.prio === victim.prio && s.endsAt < victim.endsAt)) {
      victim = s;
    }
  }
  if (!victim || victim.prio > prio) return null; // drop, do not mud
  return victim;
}

export function hit(name: AudioName, o: HitOpts = {}): boolean {
  const T = mod;
  if (!T || !B) return false;
  const slot = AUDIO[name];
  if (!slot) return false;

  const seed = o.seed ?? 0;
  const h = hash(seed);
  // Deterministic round robin. No Math.random anywhere (engine law), so the
  // same scroll position always produces the same hit -- which is what keeps
  // scrubbing reproducible.
  const variant = slot.v.length > 0 ? h % slot.v.length : 0;
  const buf = sample(name, variant);
  if (!buf) return false;

  const now = o.at ?? T.now();
  const gapKey = `${name}`;
  const last = lastFire.get(gapKey) ?? -1;
  if (now - last < MIN_GAP_S) return false;

  const busName = o.bus ?? slot.bus;
  const s = claim(busName, PRIO[slot.cat] ?? 1, now);
  if (!s) return false;

  // Jitter, both hashed. Gain jitter is always DOWNWARD so a hit can never
  // exceed its authored level and blow the loudness budget the bake set.
  const rate = (1 + (h01(seed * 7 + 1) - 0.5) * 0.05) * (o.rate ?? 1);
  const jitter = 1 - h01(seed * 13 + 3) * 0.2;
  const level = Math.pow(10, slot.gain / 20) * jitter * (o.gain ?? 1);
  const send = o.send ?? Math.pow(10, slot.send / 20);

  try {
    s.gain.gain.setValueAtTime(level, now);
    s.panner.pan.setValueAtTime(o.pan ?? 0, now);
    s.send.gain.setValueAtTime(send, now);

    const src = new T.ToneBufferSource(buf).connect(s.gain);
    src.playbackRate.value = rate;
    src.start(now);
    s.src = src;
    s.busy = true;
    s.prio = PRIO[slot.cat] ?? 1;
    s.endsAt = now + slot.v[variant]!.dur / rate;
    lastFire.set(gapKey, now);
    // Tone disposes the source on ended; releasing the slot here keeps the pool
    // honest even if that callback is late.
    src.onended = () => {
      s.busy = false;
      s.src = null;
    };
    return true;
  } catch {
    // Never throw toward the director's rAF catch, which would disable all
    // audio site-wide. A failed hit is just a hit that did not happen.
    s.busy = false;
    return false;
  }
}

/** Stop everything and free the pool's sources. Used on disable. */
export function stopOneshots(): void {
  for (const slots of pools.values()) {
    for (const s of slots) {
      try {
        s.src?.stop();
      } catch {
        // already stopped
      }
      s.src = null;
      s.busy = false;
    }
  }
  lastFire.clear();
}

/** Bus input for anything that wants to route around the pool. */
export function busOf(name: BusName): ToneAudioNode | null {
  return B ? B.in[name] : null;
}
