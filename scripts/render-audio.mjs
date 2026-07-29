/**
 * Render every generated asset on Stable Audio 3 Medium (distilled) through
 * ComfyUI: the score cue and all 11 sample slots.
 *
 *   node scripts/render-audio.mjs                 everything
 *   node scripts/render-audio.mjs --only=score    just the music cue
 *   node scripts/render-audio.mjs --only=ui.key   one slot, all round robins
 *   node scripts/render-audio.mjs --only=amb      one category
 *   node scripts/render-audio.mjs --seed=1        override the seed (audition)
 *
 * Then: npm run bake:audio
 *
 * Manual authoring step only. `next build` and CI never touch this -- the baked
 * .m4a files under public/audio are the committed artifacts, generated from
 * these raw renders, which stay gitignored.
 *
 * assets/audio-src/score.json and sfx.json ARE the input, not documentation of
 * one. Anything that changes the audio (prompt, seed, seconds, round-robin
 * count) is edited there, so the committed provenance can never describe a
 * render nobody can reproduce.
 *
 * Renders are SKIPPED when the output file already exists, so re-running after
 * an interrupted batch costs nothing. --force re-rolls anyway.
 */

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { download, outputsOf, runPrompt, stableAudio3Graph, waitForComfy } from "./audio/comfy.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "assets", "audio-src");
const RAW = join(SRC, "raw");
const RAW_SFX = join(RAW, "sfx");

const args = process.argv.slice(2);
const flag = (name) => {
  const a = args.find((x) => x === "--" + name || x.startsWith("--" + name + "="));
  if (!a) return null;
  const v = a.includes("=") ? a.slice(a.indexOf("=") + 1) : args[args.indexOf(a) + 1];
  if (!v || v.startsWith("--")) throw new Error(`--${name} needs a value`);
  return v;
};
const only = flag("only");
const force = args.includes("--force");
const seedOverride = flag("seed") === null ? null : Number(flag("seed"));

const score = JSON.parse(readFileSync(join(SRC, "score.json"), "utf8"));
const sfx = JSON.parse(readFileSync(join(SRC, "sfx.json"), "utf8"));

/**
 * The whole render list, flattened to one job per FILE. Round robins are
 * seed + i on the same prompt: variation between takes is the point, and it is
 * also the only thing that keeps ten keystrokes from being ten copies.
 */
const jobs = [];
const cue = score.cues[0];
jobs.push({
  id: "score",
  dir: RAW,
  name: `score-${cue.id}.flac`,
  seconds: cue.seconds,
  seed: cue.seed,
  steps: cue.steps,
  cfg: cue.cfg,
  prompt: cue.prompt,
});
for (const [id, s] of Object.entries(sfx.slots)) {
  for (let i = 0; i < s.n; i++) {
    jobs.push({
      id,
      dir: RAW_SFX,
      name: `${id}_${String(i).padStart(2, "0")}.flac`,
      seconds: s.seconds,
      // seed + i, NOT a hash: the seeds stay readable in the render log and a
      // single bad take can be re-rolled by hand without moving the others.
      seed: s.seed + i,
      steps: 8,
      cfg: 1,
      prompt: s.prompt,
    });
  }
}

// Matches the slot id exactly, or the category prefix -- same rule as
// bake-audio's --only, so the two flags mean the same thing.
const picked = jobs.filter((j) => !only || j.id === only || j.id.startsWith(only + "."));
if (!picked.length) {
  console.error(`[render-audio] --only=${only} matched nothing`);
  process.exit(1);
}

mkdirSync(RAW_SFX, { recursive: true });
await waitForComfy();
console.log(`[render-audio] ${sfx.model}, ${picked.length} render(s)`);

for (const j of picked) {
  const dest = join(j.dir, j.name);
  if (!force && existsSync(dest)) {
    console.log(`  ${j.name} ... exists, skipped`);
    continue;
  }
  const seed = seedOverride ?? j.seed;
  process.stdout.write(`  ${j.name} ... ${j.seconds}s seed ${seed} `);
  // 30 min: a cold start loads an 8.8 GB checkpoint plus the text encoder
  // before the first step runs, and the poll only sees the prompt as finished.
  const entry = await runPrompt(
    stableAudio3Graph({
      prompt: j.prompt, seconds: j.seconds, seed, steps: j.steps, cfg: j.cfg,
    }),
    { timeoutMs: 1800000 },
  );
  const files = outputsOf(entry);
  if (!files.length) throw new Error(`no audio came back for ${j.name}`);
  await download(files[0], j.dir, j.name);
  console.log("ok");
}
