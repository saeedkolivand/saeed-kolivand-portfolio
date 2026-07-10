import type { Vector3 } from "three";
import { lettering } from "./content";
import { PopPool } from "./pops";

/**
 * Vocal-only cat words (S0.5: derive, don't re-type). THUMP/PADD are physical
 * landing/step sounds Desk uses deliberately; a click is a vocal response, so
 * the click sites fire from CAT_VOICE, never the full onomatopoeia.cat pool.
 */
export const CAT_VOICE = lettering.onomatopoeia.cat.filter(
  (w) => w !== "THUMP" && w !== "PADD",
);

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

/** Deterministic [0,1) hash of a string (FNV-ish), for scrub-stable seeds. */
function strSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = ((h ^ s.charCodeAt(i)) * 16777619) >>> 0;
  return (h % 4096) / 4096;
}

/**
 * Fire a comic word at a world position. Round-robin over the pool -- the
 * oldest slot is recycled, nothing is allocated.
 *
 * The default seed is DETERMINISTIC (ruling 2026-07-03): derived from the
 * word list's content hash, so identical scrubs produce identical words and
 * jitter -- the Math.random default burned two issues' scrub-determinism
 * gates. Callers that pass an explicit seed are unchanged; callers that want
 * variety must derive their own deterministic seed (e.g. from stepped time
 * or an event coordinate), never Math.random on a scrub path.
 */
export function sayWord(
  list: readonly string[],
  worldPos: Vector3 | readonly [number, number, number],
  seed?: number,
  color = "#FFFFFF",
): void {
  if (list.length === 0) return;
  const slot = words.spawn(worldPos, seed ?? strSeed(list.join("|")));
  slot.data.word = list[Math.floor(slot.seed * list.length) % list.length]!;
  slot.data.color = color;
}
