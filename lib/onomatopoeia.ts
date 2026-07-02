import { Vector3 } from "three";

/**
 * Pooled comic onomatopoeia (S5b) -- fixed-size slot pool, zero per-frame
 * allocation. Scenes call sayWord() from useFrame/event code with a word
 * list from content.lettering.onomatopoeia; components/Onomatopoeia.tsx
 * renders the pool as crisp Hud lettering above the post pipeline (S2.16).
 */

export const WORD_POOL_SIZE = 12;
/** authored pop envelope length, seconds */
export const WORD_LIFE = 0.9;

export interface WordSlot {
  active: boolean;
  /** bumped on (re)spawn so the renderer knows to re-sync glyphs */
  gen: number;
  word: string;
  color: string;
  /** world-space anchor, projected to screen each frame */
  pos: Vector3;
  /** performance.now() at spawn (ms) */
  start: number;
  /** 0..1, drives word pick + rotation jitter */
  seed: number;
}

export const wordPool: WordSlot[] = Array.from({ length: WORD_POOL_SIZE }, () => ({
  active: false,
  gen: 0,
  word: "",
  color: "#FFFFFF",
  pos: new Vector3(),
  start: 0,
  seed: 0,
}));

let cursor = 0;

/**
 * Fire a comic word at a world position. Round-robin over the pool -- the
 * oldest slot is recycled, nothing is allocated.
 */
export function sayWord(
  list: readonly string[],
  worldPos: Vector3 | readonly [number, number, number],
  seed: number = Math.random(),
  color = "#FFFFFF",
): void {
  if (list.length === 0) return;
  const slot = wordPool[cursor]!;
  cursor = (cursor + 1) % WORD_POOL_SIZE;
  const s = seed - Math.floor(seed); // wrap into [0,1)
  slot.word = list[Math.floor(s * list.length) % list.length]!;
  slot.color = color;
  if (worldPos instanceof Vector3) slot.pos.copy(worldPos);
  else slot.pos.set(worldPos[0], worldPos[1], worldPos[2]);
  slot.seed = s;
  slot.start = performance.now();
  slot.gen++;
  slot.active = true;
}
