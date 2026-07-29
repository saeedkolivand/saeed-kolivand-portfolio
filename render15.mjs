import { readdirSync, copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { waitForComfy, runPrompt, outputsOf, download, aceStep15Graph } from "./scripts/audio/comfy.mjs";

const OUTDIR = "D:/ComfyUI/output/bake";
const RAW = "assets/audio-src/raw";
const TAGS = [
  "[Instrumental] lo-fi instrumental, sparse minimal trio, felt piano, upright double bass, brushed drum kit,",
  "close-miked piano with audible hammer attack, dry rim click, brushed snare with a sharp leading edge,",
  "fingertip noise on the bass strings, long silences between phrases, melancholy and hopeful,",
  "patient emotional build, dry room, minimal processing, clean defined high end,",
  "no pads, no synths, no strings, no guitar, no vocals",
].join(" ");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function queueIdle() {
  for (;;) {
    try {
      const q = await (await fetch("http://127.0.0.1:8188/queue")).json();
      if ((q.queue_running || []).length === 0 && (q.queue_pending || []).length === 0) return;
    } catch { /* keep waiting */ }
    await sleep(5000);
  }
}
const grab = (tag, dest) => {
  if (!existsSync(OUTDIR)) return null;
  const hit = readdirSync(OUTDIR).filter((f) => f.includes(tag) && f.endsWith(".flac")).sort().pop();
  if (!hit) return null;
  mkdirSync(RAW, { recursive: true });
  copyFileSync(join(OUTDIR, hit), join(RAW, dest));
  return hit;
};

await waitForComfy();
console.log("waiting for the in-flight SFT render to finish...");
await queueIdle();
const got = grab("ace15-sft", "cue15-sft.flac");
console.log(got ? `sft collected: ${got}` : "sft output not found; will render it");

if (!got) {
  const g = aceStep15Graph({ tags: TAGS, seconds: 120, seed: 330077, steps: 50, cfg: 7, bpm: 74, keyscale: "Bb major", model: "acestep_v1.5_xl_sft_bf16.safetensors", prefix: "bake/ace15-sft" });
  const e = await runPrompt(g, { timeoutMs: 2400000 });
  for (const o of outputsOf(e)) console.log("sft ->", await download(o, RAW, "cue15-sft"));
}

console.log("\nrendering turbo arm (8 steps)...");
const t0 = Date.now();
const gt = aceStep15Graph({ tags: TAGS, seconds: 120, seed: 330077, steps: 8, cfg: 1, bpm: 74, keyscale: "Bb major", model: "acestep_v1.5_xl_turbo_bf16.safetensors", prefix: "bake/ace15-turbo" });
const et = await runPrompt(gt, { timeoutMs: 2400000 });
console.log(`turbo rendered in ${Math.round((Date.now() - t0) / 1000)}s`);
for (const o of outputsOf(et)) console.log("turbo ->", await download(o, RAW, "cue15-turbo"));
console.log("DONE");
