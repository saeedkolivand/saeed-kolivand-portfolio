import { Vector3 } from "three";
import { clamp01 } from "./shots";
import { stepTime } from "./steppedClock";

/**
 * Generic fixed-size pop pool (Phase 2 extraction of the S5b onomatopoeia
 * pool) -- zero per-frame and zero per-spawn allocation. One pool per effect
 * kind: onomatopoeia words today (lib/onomatopoeia.ts), Issue 8 3D speech
 * balloons and Issue 11 floating panels later.
 *
 * Contract: spawners call pool.spawn() from useFrame/event code and mutate
 * the returned slot's `data` in place; renderers iterate `pool.slots`, skip
 * inactive ones, and re-sync expensive state (glyphs, textures) only when
 * `gen` changes. Readable lettering renderers stay on a post-exempt layer
 * (DOM overlay or Hud renderPriority 2) per S2.16 -- the pool itself is
 * layer-agnostic.
 */
export interface PopSlot<T> {
  active: boolean;
  /** bumped on (re)spawn so renderers know to re-sync expensive state */
  gen: number;
  /** world-space anchor */
  pos: Vector3;
  /** performance.now() at spawn (ms) */
  start: number;
  /** 0..1 jitter/pick seed */
  seed: number;
  /** payload -- allocated once at pool construction, mutated on spawn */
  data: T;
}

export class PopPool<T> {
  readonly slots: PopSlot<T>[];
  private cursor = 0;

  constructor(
    size: number,
    /** authored pop envelope length, seconds */
    readonly life: number,
    makeData: () => T,
  ) {
    this.slots = Array.from({ length: size }, () => ({
      active: false,
      gen: 0,
      pos: new Vector3(),
      start: 0,
      seed: 0,
      data: makeData(),
    }));
  }

  /**
   * Recycle the round-robin oldest slot at a world position and return it so
   * the caller can fill slot.data. Never allocates.
   */
  spawn(
    worldPos: Vector3 | readonly [number, number, number],
    seed: number = Math.random(),
  ): PopSlot<T> {
    const slot = this.slots[this.cursor]!;
    this.cursor = (this.cursor + 1) % this.slots.length;
    if (worldPos instanceof Vector3) slot.pos.copy(worldPos);
    else slot.pos.set(worldPos[0], worldPos[1], worldPos[2]);
    slot.seed = seed - Math.floor(seed); // wrap into [0,1)
    slot.start = performance.now();
    slot.gen++;
    slot.active = true;
    return slot;
  }

  /** Age in seconds; retires the slot once it outlives the pool's life. */
  age(slot: PopSlot<T>, nowMs: number): number {
    const a = (nowMs - slot.start) / 1000;
    if (a >= this.life) slot.active = false;
    return a;
  }
}

/**
 * The shared squash-and-stretch pop envelope on stepped time (S2.8): pop-in
 * with overshoot over `attack` seconds, pop-out over `release`. Returns a
 * scale factor; <= ~0 means the slot is invisible this frame.
 */
export function popScale(
  ageSec: number,
  life: number,
  fps = 12,
  attack = 0.14,
  release = 0.18,
  overshoot = 0.4,
): number {
  const a = stepTime(ageSec, fps);
  const inP = clamp01(a / attack);
  const outP = clamp01((life - a) / release);
  return inP * (1 + overshoot * Math.sin(inP * Math.PI)) * outP;
}
