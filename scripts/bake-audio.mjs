/**
 * Audio bake. Renders every slot, normalises it, encodes it, and emits
 * lib/audio/manifest.ts so the runtime slot table can never drift from the
 * files actually on disk.
 *
 *   npm run bake:audio                 bake everything
 *   npm run bake:audio -- --only=ui.key   one slot or one category
 *   npm run bake:audio -- --check      verify disk matches the manifest
 *   npm run bake:audio -- --report     per-slot sizes and durations
 *
 * NOT wired into `prebuild`, unlike bake-contributions.mjs. The outputs are
 * committed artifacts: `next build` and CI must never need ffmpeg, a GPU, or
 * any model. Baking is a manual, occasional authoring step.
 *
 * Determinism: every slot is a pure function of its seed, so a re-bake with an
 * unchanged recipe reproduces the same audio. Mirrors the runtime law in
 * lib/audio/util.ts (no Math.random anywhere).
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { rng, widen, writeWav } from "./audio/dsp.mjs";
import * as R from "./audio/recipes.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "audio");
const TMP = join(ROOT, "node_modules", ".cache", "bake-audio");
const MANIFEST = join(ROOT, "lib", "audio", "manifest.ts");
const SR = 48000;

/**
 * Per-category policy. `lufs` non-null means the material is long enough for
 * an integrated loudness measurement to mean anything and ffmpeg's loudnorm
 * does the work; one-shots are peak-normalised at render time instead, because
 * integrated loudness over 200 ms is a meaningless number, and a second
 * limiting pass would flatten the transients this whole rebuild exists to
 * create.
 */
const CATEGORIES = {
  ui: { bus: "ui", ch: 1, kbps: 128, lufs: null, gain: -7 },
  fol: { bus: "foley", ch: 1, kbps: 128, lufs: null, gain: -4 },
  imp: { bus: "hardfx", ch: 1, kbps: 128, lufs: null, gain: 0 },
  cin: { bus: "hardfx", ch: 1, kbps: 128, lufs: null, gain: -1 },
  amb: { bus: "ambience", ch: 2, kbps: 192, lufs: -31, gain: 0 },
  mus: { bus: "music", ch: 2, kbps: 192, lufs: -23, gain: 0 },
};

/**
 * The slot table. `make(seed, i)` returns mono Float32Array or [L, R].
 * `n` is the round-robin count; variation between round robins is a feature,
 * so they are normalised as a GROUP, never individually.
 */
const SLOTS = {
  "ui.key": {
    cat: "ui", n: 10, seed: 1000, send: -12,
    make: (s) => R.keyThock(SR, s),
  },
  "ui.key-space": {
    cat: "ui", n: 3, seed: 2000, send: -12,
    make: (s) => R.keySpace(SR, s),
  },
  "fol.paper-flip": {
    cat: "fol", n: 5, seed: 3000, send: -8,
    make: (s) => R.pageFlip(SR, s),
  },
  "cin.paper-tear": {
    cat: "cin", n: 4, seed: 4000, send: -6,
    make: (s) => R.paperTear(SR, s, 0.8),
  },
  "imp.press-slam": {
    cat: "imp", n: 2, seed: 5000, send: -5,
    make: (s) => R.impact(SR, s, { material: "steel", f0: 62, subF: 48, dur: 2.6, debris: 0.5 }),
  },
  "imp.title-drop": {
    cat: "imp", n: 2, seed: 6000, send: -6,
    make: (s) => R.impact(SR, s, { material: "concrete", f0: 110, subF: 55, dur: 1.8, debris: 0.25 }),
  },
  "imp.press-clank": {
    cat: "imp", n: 4, seed: 7000, send: -7,
    make: (s) => R.impact(SR, s, { material: "steel", f0: 210, subF: 70, dur: 0.9, debris: 0.2 }),
  },
  "amb.rain": {
    cat: "amb", n: 1, seed: 8000, send: -14,
    make: (s) => R.rain(SR, s, 10, 2400),
  },
  // widen() rather than duplicating the channel: a room tone with identical
  // L and R collapses to a point between your ears, which is the one thing a
  // room is not. Real width comes from each ear hearing different early
  // reflections.
  "amb.room-crt": {
    cat: "amb", n: 1, seed: 9000, send: -16,
    make: (s) => widen(R.roomTone(SR, s, 12, { mains: 50, flyback: 0.006 }), SR, rng(s ^ 0x1f), 14, 6),
  },
  "amb.room-desk": {
    cat: "amb", n: 1, seed: 9100, send: -15,
    make: (s) => widen(R.roomTone(SR, s, 12, { mains: 50, flyback: 0, floorDb: -44 }), SR, rng(s ^ 0x2e), 18, 7),
  },
};

// ------------------------------------------------------------------- helpers

const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a.startsWith("--" + name));
const only = (flag("only") || "").split("=")[1] || null;
const isCheck = args.includes("--check");
const isReport = args.includes("--report");

function ffmpeg(argv) {
  try {
    return execFileSync("ffmpeg", ["-y", "-v", "error", ...argv], { encoding: "utf8" });
  } catch (e) {
    throw new Error("ffmpeg failed: " + (e.stderr || e.message));
  }
}

/** Decoded duration in seconds, straight from the encoded file. */
function probeDur(path) {
  const out = execFileSync("ffprobe", [
    "-v", "error", "-show_entries", "format=duration",
    "-of", "default=nw=1:nk=1", path,
  ], { encoding: "utf8" });
  return Math.round(parseFloat(out.trim()) * 10000) / 10000;
}

const ascii = (s) => {
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) > 127) {
      throw new Error(`non-ASCII at index ${i} (${JSON.stringify(s.slice(i - 20, i + 20))}) -- Turbopack rope bug`);
    }
  }
  return s;
};

// ---------------------------------------------------------------------- bake

function bakeSlot(id, spec) {
  const cat = CATEGORIES[spec.cat];
  if (!cat) throw new Error(`slot ${id}: unknown category ${spec.cat}`);
  const [, base] = id.split(".");
  const dir = join(OUT, spec.cat);
  mkdirSync(dir, { recursive: true });
  mkdirSync(TMP, { recursive: true });

  // 1. Render every round robin first, so the group can be normalised together.
  const rendered = [];
  let groupPeak = 0;
  for (let i = 0; i < spec.n; i++) {
    const sig = spec.make(spec.seed + i, i);
    const chans = Array.isArray(sig) ? sig : [sig];
    for (const c of chans) for (let j = 0; j < c.length; j++) {
      const a = Math.abs(c[j]);
      if (a > groupPeak) groupPeak = a;
    }
    rendered.push(chans);
  }

  // Group normalisation. Level variation BETWEEN round robins is the point --
  // normalising each file to its own peak flattens it and is the classic way
  // to make a sample set sound dead.
  const g = groupPeak > 0 ? 0.97 / groupPeak : 1;

  const variants = [];
  for (let i = 0; i < spec.n; i++) {
    const chans = rendered[i];
    for (const c of chans) for (let j = 0; j < c.length; j++) c[j] *= g;

    const vv = String(i).padStart(2, "0");
    const wav = join(TMP, `${spec.cat}-${base}_${vv}.wav`);
    const m4a = join(dir, `${base}_${vv}.m4a`);
    // Force the declared channel count: a mono category must not ship stereo.
    writeWav(wav, cat.ch === 2 && chans.length === 1 ? [chans[0], chans[0]] : chans.slice(0, cat.ch), SR);

    const filters = [];
    if (cat.lufs !== null) filters.push(`loudnorm=I=${cat.lufs}:TP=-1.5:LRA=11`);
    ffmpeg([
      "-i", wav,
      ...(filters.length ? ["-af", filters.join(",")] : []),
      "-c:a", "aac", "-b:a", `${cat.kbps}k`, "-ac", String(cat.ch), m4a,
    ]);
    rmSync(wav, { force: true });

    variants.push({
      path: `/audio/${spec.cat}/${base}_${vv}.m4a`,
      bytes: statSync(m4a).size,
      dur: probeDur(m4a),
    });
  }
  return { cat: spec.cat, bus: cat.bus, ch: cat.ch, gain: cat.gain, send: spec.send, v: variants };
}

function emitManifest(baked) {
  const lines = [];
  lines.push("/**");
  lines.push(" * GENERATED by scripts/bake-audio.mjs -- do not edit by hand.");
  lines.push(" *");
  lines.push(" * AUDIO is a literal object on purpose: `keyof typeof AUDIO` then gives the");
  lines.push(" * exact slot-name union, so a misspelled name in a call site is a compile");
  lines.push(" * error rather than a hit that silently never plays. Do NOT add an index");
  lines.push(" * signature to it -- that would erase the union and the guarantee with it.");
  lines.push(" */");
  lines.push("");
  lines.push('export type AudioBus = "music" | "ambience" | "foley" | "hardfx" | "ui" | "sub";');
  lines.push("");
  lines.push("export interface AudioVariant {");
  lines.push("  /** public path, already cache-busted by the build */");
  lines.push("  readonly path: string;");
  lines.push("  readonly bytes: number;");
  lines.push("  /** decoded duration in seconds */");
  lines.push("  readonly dur: number;");
  lines.push("}");
  lines.push("");
  lines.push("export interface AudioSlot {");
  lines.push("  readonly cat: string;");
  lines.push("  readonly bus: AudioBus;");
  lines.push("  readonly ch: 1 | 2;");
  lines.push("  /** suggested playback gain in dB; loudness is already matched per category */");
  lines.push("  readonly gain: number;");
  lines.push("  /** suggested room send in dB relative to gain */");
  lines.push("  readonly send: number;");
  lines.push("  readonly v: readonly AudioVariant[];");
  lines.push("}");
  lines.push("");
  lines.push("export const AUDIO = {");
  for (const id of Object.keys(baked).sort()) {
    const s = baked[id];
    lines.push(`  ${JSON.stringify(id)}: {`);
    lines.push(`    cat: ${JSON.stringify(s.cat)}, bus: ${JSON.stringify(s.bus)}, ch: ${s.ch},`);
    lines.push(`    gain: ${s.gain}, send: ${s.send},`);
    lines.push("    v: [");
    for (const v of s.v) {
      lines.push(`      { path: ${JSON.stringify(v.path)}, bytes: ${v.bytes}, dur: ${v.dur} },`);
    }
    lines.push("    ],");
    lines.push("  },");
  }
  lines.push("} as const;");
  lines.push("");
  lines.push("export type AudioName = keyof typeof AUDIO;");
  lines.push("");
  const total = Object.values(baked).reduce(
    (a, s) => a + s.v.reduce((b, v) => b + v.bytes, 0), 0);
  const files = Object.values(baked).reduce((a, s) => a + s.v.length, 0);
  lines.push(`/** ${files} files, ${total} bytes total on disk */`);
  lines.push(`export const AUDIO_BYTES = ${total};`);
  lines.push("");
  writeFileSync(MANIFEST, ascii(lines.join("\n")));
  return { total, files };
}

/** Read the committed manifest back without importing TypeScript. */
function readManifestPaths() {
  if (!existsSync(MANIFEST)) return [];
  const src = readFileSync(MANIFEST, "utf8");
  return [...src.matchAll(/path: "([^"]+)", bytes: (\d+)/g)]
    .map((m) => ({ path: m[1], bytes: Number(m[2]) }));
}

// ---------------------------------------------------------------------- main

if (isCheck) {
  const rows = readManifestPaths();
  if (!rows.length) {
    console.error("[bake-audio] no manifest to check");
    process.exit(1);
  }
  let bad = 0;
  for (const r of rows) {
    const p = join(ROOT, "public", r.path.replace(/^\/audio/, "audio"));
    if (!existsSync(p)) {
      console.error(`  MISSING  ${r.path}`);
      bad++;
    } else if (statSync(p).size !== r.bytes) {
      console.error(`  SIZE     ${r.path} (manifest ${r.bytes}, disk ${statSync(p).size})`);
      bad++;
    }
  }
  console.log(bad ? `[bake-audio] ${bad}/${rows.length} FAILED` : `[bake-audio] ${rows.length} files OK`);
  process.exit(bad ? 1 : 0);
}

const picked = Object.keys(SLOTS).filter(
  (id) => !only || id === only || id.startsWith(only + ".") || SLOTS[id].cat === only);
if (!picked.length) {
  console.error(`[bake-audio] --only=${only} matched nothing`);
  process.exit(1);
}

const baked = {};
for (const id of picked) {
  process.stdout.write(`  ${id} ... `);
  baked[id] = bakeSlot(id, SLOTS[id]);
  const b = baked[id].v.reduce((a, v) => a + v.bytes, 0);
  console.log(`${baked[id].v.length} variants, ${(b / 1024).toFixed(0)} KB`);
}

// A partial bake still re-states every other slot from the existing manifest,
// so --only can never leave the manifest describing a subset of the truth.
if (only) {
  for (const id of Object.keys(SLOTS)) {
    if (baked[id]) continue;
    const dir = join(OUT, SLOTS[id].cat);
    const [, base] = id.split(".");
    const cat = CATEGORIES[SLOTS[id].cat];
    const v = [];
    for (let i = 0; i < SLOTS[id].n; i++) {
      const vv = String(i).padStart(2, "0");
      const p = join(dir, `${base}_${vv}.m4a`);
      if (!existsSync(p)) continue;
      v.push({ path: `/audio/${SLOTS[id].cat}/${base}_${vv}.m4a`, bytes: statSync(p).size, dur: probeDur(p) });
    }
    if (v.length) baked[id] = { cat: SLOTS[id].cat, bus: cat.bus, ch: cat.ch, gain: cat.gain, send: SLOTS[id].send, v };
  }
}

const { total, files } = emitManifest(baked);
console.log(`[bake-audio] ${files} files, ${(total / 1024).toFixed(0)} KB -> lib/audio/manifest.ts`);

if (isReport) {
  console.log("");
  for (const id of Object.keys(baked).sort()) {
    const s = baked[id];
    const b = s.v.reduce((a, v) => a + v.bytes, 0);
    const d = s.v.reduce((a, v) => a + v.dur, 0);
    console.log(
      `  ${id.padEnd(20)} ${String(s.v.length).padStart(2)}v  ` +
      `${d.toFixed(2).padStart(7)}s  ${(b / 1024).toFixed(0).padStart(5)} KB  ${s.bus}`);
  }
}
