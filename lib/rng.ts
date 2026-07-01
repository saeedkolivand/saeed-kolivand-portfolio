// Seeded PRNG (mulberry32). Scene instance / particle layouts are built from a fixed seed so
// each scene is identical every time it mounts — no reshuffle when it leaves and re-enters the
// ±1 mount window (Math.random would jitter the layout on every remount). Shared across scenes.
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
