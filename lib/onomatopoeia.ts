import type { Vector3 } from "three";
import { PopPool } from "./pops";

/**
 * Pooled comic onomatopoeia (S5b) -- a PopPool of word sprites. Scenes call
 * sayWord() from useFrame/event code with a word list from
 * content.lettering.onomatopoeia; components/Onomatopoeia.tsx renders the
 * pool as crisp Hud lettering above the post pipeline (S2.16).
 */
export interface WordData {
  word: string;
  color: string;
}

export const words = new PopPool<WordData>(12, 0.9, () => ({
  word: "",
  color: "#FFFFFF",
}));

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
  const slot = words.spawn(worldPos, seed);
  slot.data.word = list[Math.floor(slot.seed * list.length) % list.length]!;
  slot.data.color = color;
}
