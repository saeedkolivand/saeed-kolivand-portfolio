// Bakes the GitHub contribution grid to public/data/contributions.json at
// BUILD TIME (SPEC 0.5). Never fetched at runtime. On ANY failure it falls
// back to a deterministic procedural starfield -- this script never fails
// the build.
//
// Endpoint verified 2026-07-02:
// .claude/agent-memory/docs-researcher/github-contributions-endpoint.md

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const USER = "saeedkolivand";
// Pinned window for deterministic builds: last full 365 days ending 2026-06-30.
const FROM = "2025-07-01";
const TO = "2026-06-30";
const WEEKS = 53;
const DAYS = 7;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const OUT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "data",
  "contributions.json"
);

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

// 53x7 grid of dates, columns Sun-Sat, last column contains TO.
// 53 * 7 = 371 >= 365 + max 6 days of Saturday padding, so the pinned
// window is always fully covered; padding cells get level 0.
function buildGrid(levelFor) {
  const end = new Date(TO + "T00:00:00Z");
  end.setUTCDate(end.getUTCDate() + (6 - end.getUTCDay()));
  const cursor = new Date(end);
  cursor.setUTCDate(cursor.getUTCDate() - (WEEKS * DAYS - 1));
  const weeks = [];
  for (let w = 0; w < WEEKS; w++) {
    const week = [];
    for (let d = 0; d < DAYS; d++) {
      const key = isoDate(cursor);
      week.push({ d: key, l: levelFor(key) });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

async function fetchLevels() {
  const url = `https://github.com/users/${USER}/contributions?from=${FROM}&to=${TO}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const levels = new Map();
  for (const m of html.matchAll(
    /data-date="(\d{4}-\d{2}-\d{2})"[^>]*data-level="(\d)"/g
  )) {
    levels.set(m[1], Number(m[2]));
  }
  if (levels.size === 0) throw new Error("zero day cells parsed");
  if ([...levels.values()].every((l) => l === 0))
    throw new Error("all levels zero");
  return levels;
}

// Seeded PRNG (mulberry32) -- fallback must be build-deterministic.
function mulberry32(seed) {
  return function () {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Sparse starfield distribution: mostly dark sky, scattered bright stars.
function starLevel(r) {
  if (r < 0.68) return 0;
  if (r < 0.85) return 1;
  if (r < 0.94) return 2;
  if (r < 0.985) return 3;
  return 4;
}

async function main() {
  if (fs.existsSync(OUT) && Date.now() - fs.statSync(OUT).mtimeMs < MAX_AGE_MS) {
    console.log("[bake-contributions] fresh, skipping");
    return;
  }
  let source = "github";
  let weeks;
  try {
    const levels = await fetchLevels();
    weeks = buildGrid((d) => levels.get(d) ?? 0);
  } catch (err) {
    console.warn(
      `[bake-contributions] fetch failed (${err.message}); using procedural starfield`
    );
    source = "procedural";
    const rng = mulberry32(0x53504144);
    weeks = buildGrid(() => starLevel(rng()));
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(
    OUT,
    JSON.stringify({ source, from: FROM, to: TO, weeks }) + "\n"
  );
  console.log(
    `[bake-contributions] wrote ${source} grid: ${weeks.length} weeks x ${DAYS} days`
  );
}

main().catch((err) => {
  // Absolute rule: this script never breaks the build.
  console.warn(`[bake-contributions] unexpected failure, skipped: ${err.message}`);
});
