import { AUDIO, type AudioName } from "./manifest";
import type { ToneModule } from "./types";

/**
 * Sample bank: fetch, decode, keep.
 *
 * Deliberately loads the WHOLE manifest on first enable rather than windowing
 * per scene. The engine plan called for a lazy `activeIssue +/- 1` window with
 * eviction, and that is the right shape once the beds land -- twelve stereo
 * ambience loops is where decoded memory starts to matter. Today the entire
 * manifest is ~1.1 MB encoded, so windowing would be scheduling machinery, a
 * cache-miss path and an eviction policy in service of a problem that does not
 * exist. The decoded-byte accounting below is here so the moment it does start
 * to matter is measurable rather than guessed at.
 *
 * Nothing here blocks: a hit whose buffer has not arrived returns false and the
 * caller falls through to its synth path, so the site is audible from the first
 * frame after enable and quietly gets better as buffers land.
 *
 * Failure is isolated. A dead network degrades to the synth soundscape with one
 * warning; it must never reach the director's rAF catch, which disables all
 * audio site-wide.
 */

/** Concurrent fetches. Enough to saturate a connection, few enough to be polite. */
const CONCURRENCY = 4;

const buffers = new Map<string, AudioBuffer>();
const failed = new Set<string>();
let started = false;
let warned = false;
let decoded = 0;

const key = (name: string, variant: number) => `${name}:${variant}`;

function warn(e: unknown): void {
  if (warned) return;
  warned = true;
  // Its OWN warn latch, not the director's -- a missing asset must not consume
  // the one warning slot reserved for an engine failure.
  console.warn("[audio] sample bank degraded, falling back to synthesis:", e);
}

/**
 * Every (slot, variant) pair in the manifest, flattened.
 * UI first: it is the smallest category and the first thing a visitor hears,
 * since enabling sound plays a toggle chime.
 */
function loadOrder(): { name: string; variant: number; path: string }[] {
  const out: { name: string; variant: number; path: string }[] = [];
  const entries = Object.entries(AUDIO) as [string, (typeof AUDIO)[AudioName]][];
  const rank = (cat: string) => (cat === "ui" ? 0 : cat === "fol" ? 1 : cat === "imp" ? 2 : 3);
  entries.sort((a, b) => rank(a[1].cat) - rank(b[1].cat));
  for (const [name, slot] of entries) {
    slot.v.forEach((v, i) => out.push({ name, variant: i, path: v.path }));
  }
  return out;
}

/** Idempotent; safe to call on every enable. */
export function loadBank(T: ToneModule): void {
  if (started) return;
  started = true;

  const queue = loadOrder();
  let next = 0;

  const worker = async (): Promise<void> => {
    for (;;) {
      const item = queue[next++];
      if (!item) return;
      const k = key(item.name, item.variant);
      if (buffers.has(k) || failed.has(k)) continue;
      try {
        const res = await fetch(item.path, { cache: "force-cache" });
        if (!res.ok) throw new Error(`${res.status} ${item.path}`);
        const buf = await T.getContext().decodeAudioData(await res.arrayBuffer());
        buffers.set(k, buf);
        // decodeAudioData resamples to the context rate, so decoded size is
        // independent of the source bitrate -- only duration and channel count
        // move this number.
        decoded += 4 * buf.numberOfChannels * buf.length;
      } catch (e) {
        failed.add(k);
        warn(e);
      }
    }
  };

  // Fire and forget, with its own catch. Started OUTSIDE the rAF so a rejection
  // can never surface inside the director's frame-loop try block.
  void Promise.all(Array.from({ length: CONCURRENCY }, worker)).catch(warn);
}

/** The decoded buffer, or null if it has not arrived or will not. */
export function sample(name: AudioName, variant: number): AudioBuffer | null {
  return buffers.get(key(name, variant)) ?? null;
}

/** Decoded bytes resident. The number to watch when beds land. */
export function bankBytes(): number {
  return decoded;
}

export function bankStats(): { ready: number; failed: number; total: number } {
  return { ready: buffers.size, failed: failed.size, total: loadOrder().length };
}
