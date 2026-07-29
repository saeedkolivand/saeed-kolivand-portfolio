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
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "audio");
const TMP = join(ROOT, "node_modules", ".cache", "bake-audio");
const MANIFEST = join(ROOT, "lib", "audio", "manifest.ts");
const SR = 48000;

/**
 * Prompts, round-robin counts and seeds for every generated slot. Read rather
 * than duplicated: `n` and `seed` live in assets/audio-src/sfx.json, so the
 * slot table below cannot describe a different bake than the renderer produced.
 */
const SFX = JSON.parse(readFileSync(join(ROOT, "assets", "audio-src", "sfx.json"), "utf8"));

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
  // STEREO, and cheaper than the mono stems it replaces: one 120 s stereo cue
  // decodes to ~46 MB of Float32 PCM against the three mono stems' ~69 MB, and
  // ships one file instead of three. Stable Audio 3 renders stereo natively, so
  // folding it down would be throwing away width the model already placed.
  mus: { bus: "music", ch: 2, kbps: 192, lufs: -23, gain: 0, loop: true },
};

/**
 * The slot table. Every slot is now GENERATED -- the offline DSP recipes are
 * gone, and with them the only reason this file held signal-processing
 * parameters. What is left per slot is what the RUNTIME needs and the renderer
 * does not: which bus family it belongs to and how much room send it wants.
 *
 * The round-robin count and seed come from assets/audio-src/sfx.json, so there
 * is exactly one place that decides how many keystrokes exist.
 *
 * Files are found by convention, not configuration:
 *   assets/audio-src/raw/sfx/<slot id>_<vv>.flac
 * which is precisely what scripts/render-audio.mjs writes.
 */
const SLOTS = {
  // NO ui.key-space. The terminal accepts /[a-z0-9-]/ only, so a space is never
  // typed and the slot was shipping three variants nothing could ever reach.
  // Commands are single words; adding the space to the filter would put one in
  // the buffer and stop every command matching.
  "ui.key": { cat: "ui", send: -12 },
  "fol.paper-flip": { cat: "fol", send: -8 },
  // The cat. Sampled meows, with ui.ts's FMSynth kept as the fallback voice for
  // the frames before the bank lands -- the same contract every other hit has.
  "fol.meow": { cat: "fol", send: -9 },
  "cin.paper-tear": { cat: "cin", send: -6 },
  "imp.press-slam": { cat: "imp", send: -5 },
  "imp.title-drop": { cat: "imp", send: -6 },
  "imp.press-clank": { cat: "imp", send: -7 },
  // The site's biggest jaw-drop. cin, not imp: this is a 2.4 s cue with its own
  // fan and tail, not a hit, and it wants the cinematic bus level.
  "cin.spread-unfold": { cat: "cin", send: -5 },
  "amb.rain": { cat: "amb", send: -14 },
  "amb.room-crt": { cat: "amb", send: -16 },
  "amb.room-desk": { cat: "amb", send: -15 },
  // The score. ONE Stable Audio 3 cue, shipped whole -- no stem split. The
  // instruments stay mixed as the model balanced them, which is also the only
  // balance that was ever mastered; a source separator's idea of "bass" in a
  // felt-piano trio is mostly piano left hand.
  //
  // `send` is inert here: score.ts connects the cue to the music bus and it
  // reaches the rooms through the bed send, as a bed should. The value is kept
  // only so every slot in the manifest has the same shape.
  "mus.score": { cat: "mus", send: -14, file: "assets/audio-src/raw/score-main.flac" },
};

/** Round robins, from the render manifest. The score is the one hand-placed file. */
const countOf = (id) => SFX.slots[id]?.n ?? 1;
const rawOf = (id, i) =>
  SLOTS[id].file ?? join("assets", "audio-src", "raw", "sfx", `${id}_${String(i).padStart(2, "0")}.flac`);

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
function measureLoudness(wav, targetI) {
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
  return { base, m: JSON.parse(j[j.length - 1]) };
}

function loudnormPass(wav, targetI) {
  const { base, m } = measureLoudness(wav, targetI);
  return `${base}:measured_I=${m.input_i}:measured_TP=${m.input_tp}` +
    `:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}` +
    `:offset=${m.target_offset}:linear=true`;
}

/**
 * Decode any file ffmpeg can read into planar Float32 channels. This is the
 * bridge for the GENERATED half of the pipeline -- ComfyUI renders come in as
 * files, code recipes come in as arrays, and bakeSlot treats them identically
 * from here on.
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

/**
 * Planar Float32 channels -> a 32-bit float WAV, the interchange format between
 * the read/trim stage and ffmpeg.
 *
 * Writes the 16-byte PCM-style `fmt ` chunk rather than the 18-byte one with
 * `cbSize` plus a `fact` chunk that WAVE_FORMAT_IEEE_FLOAT strictly wants.
 * ffmpeg accepts it and ffmpeg is the ONLY consumer -- if that ever stops being
 * true, this needs the full extensible header.
 */
function writeWav(path, channels, sr) {
  const ch = channels.length;
  const n = channels[0].length;
  for (const c of channels) {
    if (c.length !== n) throw new Error(`writeWav: channel length mismatch (${c.length} vs ${n})`);
  }
  const dataBytes = n * ch * 4;
  const b = Buffer.alloc(44 + dataBytes);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + dataBytes, 4);
  b.write("WAVE", 8);
  b.write("fmt ", 12);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(3, 20); // IEEE float
  b.writeUInt16LE(ch, 22);
  b.writeUInt32LE(sr, 24);
  b.writeUInt32LE(sr * ch * 4, 28);
  b.writeUInt16LE(ch * 4, 32);
  b.writeUInt16LE(32, 34);
  b.write("data", 36);
  b.writeUInt32LE(dataBytes, 40);
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      b.writeFloatLE(channels[c][i], o);
      o += 4;
    }
  }
  writeFileSync(path, b);
  return path;
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
 * Trim a rendered one-shot down to the sound itself.
 *
 * This exists because the model cannot render a 200 ms hit: EmptyLatentAudio's
 * floor is 1 s, and a diffusion model asked for one second of keystroke returns
 * one second of ROOM with a keystroke somewhere in it. Shipped untrimmed, every
 * hit would fire late by however much silence the model felt like leaving, the
 * one-shot pool would hold slots busy for the full render, and the AAC would
 * carry a second of encoded nothing per variant.
 *
 * -50 dBFS, not zero: the renders have a real noise floor, so a
 * first-nonzero-sample scan finds sample 0 every time and trims nothing.
 *
 * The 5 ms pre-roll matters more than it looks -- cutting exactly at the
 * threshold crossing removes the very start of the attack, which is the part
 * that makes a transient read as an impact rather than a blip.
 */
function trimOneShot(chans, maxS) {
  const THRESH = 0.00316; // -50 dBFS
  const PRE = Math.round(0.005 * SR);
  const FADE = Math.round(0.03 * SR);
  const n = chans[0].length;
  const peakAt = (i) => {
    let a = 0;
    for (const c of chans) a = Math.max(a, Math.abs(c[i]));
    return a;
  };

  let start = 0;
  while (start < n && peakAt(start) <= THRESH) start++;
  // A render that never crosses the threshold is a failed render, not a slot
  // with an empty sample -- leave it whole so --report shows the full duration
  // and it is obvious something needs re-rolling.
  if (start >= n) return chans;
  start = Math.max(0, start - PRE);

  let end = n;
  while (end > start && peakAt(end - 1) <= THRESH) end--;
  end = Math.min(n, end + FADE, start + Math.round(maxS * SR));

  const out = chans.map((c) => c.slice(start, end));
  // Fade the cut edge. maxS can land the end mid-tail, and a hard cut there is
  // a step discontinuity -- the exact click this project already measured once.
  const fade = Math.min(FADE, out[0].length);
  for (const c of out) {
    for (let i = 0; i < fade; i++) c[c.length - 1 - i] *= i / fade;
  }
  return out;
}

function bakeSlot(id, spec) {
  const cat = CATEGORIES[spec.cat];
  if (!cat) throw new Error(`slot ${id}: unknown category ${spec.cat}`);
  const [, base] = id.split(".");
  const dir = join(OUT, spec.cat);
  const n = countOf(id);
  const maxS = SFX.slots[id]?.maxS ?? null;
  mkdirSync(dir, { recursive: true });
  mkdirSync(TMP, { recursive: true });

  // 1. Read every round robin first, so the group can be normalised together.
  const rendered = [];
  let groupPeak = 0;
  for (let i = 0; i < n; i++) {
    const raw = readAudio(join(ROOT, rawOf(id, i)), cat.ch);
    // Beds are never trimmed: their quiet parts ARE the room, and a bed player
    // loops them, so a trimmed edge would be an audible seam every cycle.
    const chans = maxS === null ? raw : trimOneShot(raw, maxS);
    for (const c of chans) for (let j = 0; j < c.length; j++) {
      const a = Math.abs(c[j]);
      if (a > groupPeak) groupPeak = a;
    }
    rendered.push(chans);
  }

  // Group normalisation. Level variation BETWEEN round robins is the point --
  // normalising each file to its own peak flattens it and is the classic way
  // to make a sample set sound dead. So the peak is measured across every
  // variant and one gain is applied to all of them.
  const g = groupPeak > 0 ? 0.97 / groupPeak : 1;

  const variants = [];
  for (let i = 0; i < n; i++) {
    const chans = rendered[i];
    for (const c of chans) for (let j = 0; j < c.length; j++) c[j] *= g;

    const vv = String(i).padStart(2, "0");
    const wav = join(TMP, `${spec.cat}-${base}_${vv}.wav`);
    const m4a = join(dir, `${base}_${vv}.m4a`);
    // Force the declared channel count: a mono category must not ship stereo.
    writeWav(wav, cat.ch === 2 && chans.length === 1 ? [chans[0], chans[0]] : chans.slice(0, cat.ch), SR);

    const af = cat.lufs === null ? [] : ["-af", loudnormPass(wav, cat.lufs)];
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
    for (let i = 0; i < countOf(id); i++) {
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
