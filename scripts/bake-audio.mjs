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
 * Prerequisites: ffmpeg AND ffprobe on PATH. Neither is needed to build or run
 * the site -- only to re-bake.
 *
 * NOT wired into `prebuild`, unlike bake-contributions.mjs. The outputs are
 * committed artifacts: `next build` and CI must never need ffmpeg, a GPU, or
 * any model. Baking is a manual, occasional authoring step.
 *
 * Determinism: every slot is a pure function of its seed, so a re-bake with an
 * unchanged recipe reproduces the same audio. Mirrors the runtime law in
 * lib/audio/util.ts (no Math.random anywhere).
 */

import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
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
  ui: { bus: "ui", ch: 1, kbps: 128, lufs: null, gain: -7, loop: false },
  fol: { bus: "foley", ch: 1, kbps: 128, lufs: null, gain: -4, loop: false },
  imp: { bus: "hardfx", ch: 1, kbps: 128, lufs: null, gain: 0, loop: false },
  cin: { bus: "hardfx", ch: 1, kbps: 128, lufs: null, gain: -1, loop: false },
  amb: { bus: "ambience", ch: 2, kbps: 192, lufs: -31, gain: 0, loop: true },
  // MONO. Three 120 s stereo stems decode to ~138 MB of Float32 PCM and are
  // held for the session; mono halves that. Vertical layers rarely need
  // per-stem width anyway -- the room send supplies it.
  mus: { bus: "music", ch: 1, kbps: 160, lufs: -23, gain: 0, loop: true },
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
  // The score. One ACE-Step cue split by Demucs, so the three layers share key,
  // tempo and phase by construction. vocals is dropped: the cue is instrumental
  // and that stem came out at -42 dBFS.
  "mus.score-bass": {
    group: "score",
    cat: "mus", n: 1, seed: 20000, send: -18,
    file: "assets/audio-src/raw/score-bass.wav",
  },
  "mus.score-drums": {
    group: "score",
    cat: "mus", n: 1, seed: 20100, send: -16,
    file: "assets/audio-src/raw/score-drums.wav",
  },
  "mus.score-other": {
    group: "score",
    cat: "mus", n: 1, seed: 20200, send: -13,
    file: "assets/audio-src/raw/score-other.wav",
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

/**
 * Accepts both `--only=x` and `--only x`, matches the flag name EXACTLY (a
 * prefix match would let a future `--only-check` satisfy `--only`), and exits
 * rather than falling back to null -- the previous version silently promoted
 * `--only ui.key` into a full multi-minute bake of every slot.
 */
function value(name) {
  const eq = args.find((a) => a === "--" + name || a.startsWith("--" + name + "="));
  if (!eq) return null;
  const v = eq.includes("=") ? eq.slice(eq.indexOf("=") + 1) : args[args.indexOf(eq) + 1];
  if (!v || v.startsWith("--")) {
    console.error(`[bake-audio] --${name} needs a value, e.g. --${name}=ui.key`);
    process.exit(1);
  }
  return v;
}

const only = value("only");
const isCheck = args.includes("--check");
const isReport = args.includes("--report");

/**
 * Two-pass loudnorm. Single-pass is a DYNAMIC gated normaliser, not a static
 * gain: on a 10-12 s looping bed it audibly pumps, and its result depends on
 * where the measurement window lands, which also makes a re-bake
 * non-reproducible and breaks --check. Measuring first and then applying a
 * fixed correction gives a deterministic, static gain.
 */
function loudnormPass(wav, targetI) {
  const base = `loudnorm=I=${targetI}:TP=-1.5:LRA=11`;
  // ffmpeg prints the measurement JSON to STDERR, not stdout, and exits 0 --
  // so this has to read stderr explicitly rather than rely on a thrown error.
  const res = spawnSync(
    "ffmpeg",
    ["-v", "info", "-i", wav, "-af", `${base}:print_format=json`, "-f", "null", "-"],
    { encoding: "utf8" },
  );
  const text = (res.stderr || "") + (res.stdout || "");
  const j = text.match(/\{[\s\S]*?\}/g);
  if (!j || !j.length) throw new Error("loudnorm measurement failed: " + text.slice(-500));
  const m = JSON.parse(j[j.length - 1]);
  return `${base}:measured_I=${m.input_i}:measured_TP=${m.input_tp}` +
    `:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}` +
    `:offset=${m.target_offset}:linear=true`;
}

/**
 * Decode any file ffmpeg can read into planar Float32 channels. This is the
 * bridge for the GENERATED half of the pipeline -- ComfyUI renders and Demucs
 * stems come in as files, code recipes come in as arrays, and bakeSlot treats
 * them identically from here on.
 */
function readAudio(path, ch) {
  const raw = execFileSync(
    "ffmpeg",
    ["-v", "error", "-i", path, "-f", "f32le", "-ar", String(SR), "-ac", String(ch), "-"],
    { encoding: "buffer", maxBuffer: 1 << 30 },
  );
  // Copy when the Buffer is not 4-aligned: the Float32Array view requires it,
  // and Node only happens to hand back offset-0 buffers at these sizes.
  const aligned = raw.byteOffset % 4 === 0 ? raw : Buffer.from(raw);
  const inter = new Float32Array(
    aligned.buffer, aligned.byteOffset, Math.floor(aligned.length / 4));
  const n = Math.floor(inter.length / ch);
  const out = Array.from({ length: ch }, () => new Float32Array(n));
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) out[c][i] = inter[i * ch + c];
  return out;
}

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

/**
 * Shared gain for a stem group, measured on the SUM of its members.
 *
 * The three score stems come from ONE cue, so their sum IS that cue. Baking
 * them as independent slots would peak-normalise and loudnorm each one against
 * itself -- and a sparse, transient-heavy drums stem measures far quieter than
 * a pad-heavy one, so that lifts drums by many dB relative to where the model
 * put it. Splitting one cue buys shared key, tempo, phase AND BALANCE; per-stem
 * normalisation keeps the first three and throws the fourth away, so the
 * arrangement's all-1.0 peak would no longer reconstruct the original mix.
 */
const groupGains = new Map();

function groupGain(group, members, cat) {
  const cached = groupGains.get(group);
  if (cached !== undefined) return cached;
  let peak = 0;
  let sum = null;
  for (const spec of members) {
    const chans = readAudio(spec.file, cat.ch);
    if (!sum) sum = chans.map((c) => new Float32Array(c.length));
    for (let c = 0; c < chans.length; c++) {
      const src = chans[c];
      const dst = sum[c];
      for (let i = 0; i < src.length && i < dst.length; i++) dst[i] += src[i];
    }
  }
  if (sum) for (const c of sum) for (let i = 0; i < c.length; i++) peak = Math.max(peak, Math.abs(c[i]));
  const g = peak > 0 ? 0.97 / peak : 1;
  groupGains.set(group, g);
  return g;
}

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
    const sig = spec.file ? readAudio(spec.file, cat.ch) : spec.make(spec.seed + i, i);
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
  //
  // A `group` widens that from round robins to SIBLING SLOTS: stems split from
  // one cue must keep their relative balance, so one gain measured on their sum
  // is applied to all of them.
  const g = spec.group
    ? groupGain(spec.group, Object.values(SLOTS).filter((x) => x.group === spec.group), cat)
    : groupPeak > 0
      ? 0.97 / groupPeak
      : 1;

  const variants = [];
  for (let i = 0; i < spec.n; i++) {
    const chans = rendered[i];
    for (const c of chans) for (let j = 0; j < c.length; j++) c[j] *= g;

    const vv = String(i).padStart(2, "0");
    const wav = join(TMP, `${spec.cat}-${base}_${vv}.wav`);
    const m4a = join(dir, `${base}_${vv}.m4a`);
    // Force the declared channel count: a mono category must not ship stereo.
    writeWav(wav, cat.ch === 2 && chans.length === 1 ? [chans[0], chans[0]] : chans.slice(0, cat.ch), SR);

    // Grouped slots skip loudnorm entirely: it measures per file, which is the
    // exact rebalancing the group gain exists to prevent.
    const af =
      cat.lufs === null || spec.group ? [] : ["-af", loudnormPass(wav, cat.lufs)];
    ffmpeg(["-i", wav, ...af, "-c:a", "aac", "-b:a", `${cat.kbps}k`, "-ac", String(cat.ch), m4a]);
    rmSync(wav, { force: true });

    const blob = readFileSync(m4a);
    variants.push({
      path: `/audio/${spec.cat}/${base}_${vv}.m4a`,
      bytes: blob.length,
      dur: probeDur(m4a),
      sha: createHash("sha256").update(blob).digest("hex").slice(0, 16),
    });
  }
  return { cat: spec.cat, bus: cat.bus, ch: cat.ch, gain: cat.gain, send: spec.send, loop: cat.loop, v: variants };
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
  lines.push("  readonly path: string;");
  lines.push("  readonly bytes: number;");
  lines.push("  /** decoded duration in seconds */");
  lines.push("  readonly dur: number;");
  lines.push("  /** first 16 hex of the encoded file's sha256; --check verifies it */");
  lines.push("  readonly sha: string;");
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
  lines.push("  /** true for beds the runtime loops through its crossfading bed player */");
  lines.push("  readonly loop: boolean;");
  lines.push("  readonly v: readonly AudioVariant[];");
  lines.push("}");
  lines.push("");
  lines.push("export const AUDIO = {");
  for (const id of Object.keys(baked).sort()) {
    const s = baked[id];
    lines.push(`  ${JSON.stringify(id)}: {`);
    lines.push(`    cat: ${JSON.stringify(s.cat)}, bus: ${JSON.stringify(s.bus)}, ch: ${s.ch},`);
    lines.push(`    gain: ${s.gain}, send: ${s.send}, loop: ${s.loop},`);
    lines.push("    v: [");
    for (const v of s.v) {
      lines.push(
        `      { path: ${JSON.stringify(v.path)}, bytes: ${v.bytes}, ` +
        `dur: ${v.dur}, sha: ${JSON.stringify(v.sha)} },`);
    }
    lines.push("    ],");
    lines.push("  },");
  }
  // `satisfies` keeps the literal key union that AudioName depends on while
  // still checking the emitter's output against AudioSlot -- without it, a
  // drifting emitter would produce a manifest tsc never looks at.
  lines.push("} as const satisfies Record<string, AudioSlot>;");
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
  return [...src.matchAll(/path: "([^"]+)", bytes: (\d+), dur: [\d.]+, sha: "([0-9a-f]+)"/g)]
    .map((m) => ({ path: m[1], bytes: Number(m[2]), sha: m[3] }));
}

/** Every .m4a actually on disk under public/audio, as /audio/... paths. */
function filesOnDisk() {
  const found = [];
  if (!existsSync(OUT)) return found;
  for (const cat of readdirSync(OUT)) {
    const dir = join(OUT, cat);
    if (!statSync(dir).isDirectory()) continue;
    for (const f of readdirSync(dir)) {
      if (f.endsWith(".m4a")) found.push(`/audio/${cat}/${f}`);
    }
  }
  return found;
}

// ---------------------------------------------------------------------- main

if (isCheck) {
  const rows = readManifestPaths();
  if (!rows.length) {
    console.error("[bake-audio] no manifest to check");
    process.exit(1);
  }
  let bad = 0;
  const known = new Set();
  for (const r of rows) {
    known.add(r.path);
    const p = join(ROOT, "public", r.path.replace(/^\/audio/, "audio"));
    if (!existsSync(p)) {
      console.error(`  MISSING  ${r.path}`);
      bad++;
      continue;
    }
    // Hash, not size. A same-length re-encode or an in-place byte substitution
    // both pass a size check while shipping audio the manifest does not
    // describe.
    const blob = readFileSync(p);
    const sha = createHash("sha256").update(blob).digest("hex").slice(0, 16);
    if (blob.length !== r.bytes || sha !== r.sha) {
      console.error(`  CONTENT  ${r.path} (manifest ${r.sha}/${r.bytes}, disk ${sha}/${blob.length})`);
      bad++;
    }
  }
  // Orphans ship too. Dropping a slot from 10 variants to 8 leaves the last two
  // files in public/ where nothing references them and no size check sees them.
  for (const f of filesOnDisk()) {
    if (!known.has(f)) {
      console.error(`  ORPHAN   ${f} (on disk, not in the manifest)`);
      bad++;
    }
  }
  console.log(bad ? `[bake-audio] ${bad} problem(s) across ${rows.length} manifest entries` : `[bake-audio] ${rows.length} files OK, no orphans`);
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
      const blob = readFileSync(p);
      v.push({
        path: `/audio/${SLOTS[id].cat}/${base}_${vv}.m4a`,
        bytes: blob.length,
        dur: probeDur(p),
        sha: createHash("sha256").update(blob).digest("hex").slice(0, 16),
      });
    }
    if (v.length) {
      baked[id] = {
        cat: SLOTS[id].cat, bus: cat.bus, ch: cat.ch,
        gain: cat.gain, send: SLOTS[id].send, loop: cat.loop, v,
      };
    }
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
