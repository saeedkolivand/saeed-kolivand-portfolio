/**
 * Minimal ComfyUI API client for the audio bake.
 *
 * Queues an API-format workflow, waits for it, and returns the rendered files.
 * Deliberately tiny: this only ever needs to POST /prompt, poll /history and
 * GET /view, and a dependency for that would be three functions of wrapper
 * around fetch.
 *
 * Only used by the manual authoring step. Nothing at build or run time touches
 * this -- `next build` and CI never need ComfyUI, a GPU, or any model.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const HOST = process.env.COMFY_HOST || "http://127.0.0.1:8188";

export async function comfyUp(timeoutMs = 1000) {
  try {
    const c = AbortSignal.timeout(timeoutMs);
    const r = await fetch(`${HOST}/system_stats`, { signal: c });
    return r.ok;
  } catch {
    return false;
  }
}

/** Block until the server answers, so a cold start does not look like a failure. */
export async function waitForComfy(maxMs = 300000) {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    if (await comfyUp(2000)) return true;
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error(`ComfyUI did not come up at ${HOST} within ${maxMs}ms`);
}

/**
 * Queue one API-format graph. Resolves to the history entry once it finishes.
 * Polls rather than using the websocket: a bake queues a few dozen prompts over
 * several minutes, so a 1 s poll is free and there is no reconnect logic to get
 * wrong.
 */
export async function runPrompt(graph, { pollMs = 1000, timeoutMs = 900000 } = {}) {
  const res = await fetch(`${HOST}/prompt`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: graph }),
  });
  if (!res.ok) {
    throw new Error(`queue failed ${res.status}: ${(await res.text()).slice(0, 600)}`);
  }
  const { prompt_id: id } = await res.json();

  const started = Date.now();
  for (;;) {
    if (Date.now() - started > timeoutMs) throw new Error(`prompt ${id} timed out`);
    await new Promise((r) => setTimeout(r, pollMs));
    const h = await fetch(`${HOST}/history/${id}`);
    if (!h.ok) continue;
    const body = await h.json();
    const entry = body[id];
    if (!entry) continue;
    const st = entry.status || {};
    // ComfyUI writes a history entry while a prompt is STILL EXECUTING, with
    // completed:false. Only status_str === "error" is terminal; treating
    // completed:false as failure aborts healthy long renders.
    if (st.status_str === "error") {
      const msg = JSON.stringify(st.messages || st).slice(0, 900);
      throw new Error(`prompt ${id} failed: ${msg}`);
    }
    if (st.completed === true) return entry;
  }
}

/** Every audio file a finished prompt produced, in node order. */
export function outputsOf(entry) {
  const files = [];
  for (const nodeId of Object.keys(entry.outputs || {})) {
    for (const a of entry.outputs[nodeId].audio || []) files.push(a);
  }
  return files;
}

export async function download(file, destDir, name) {
  mkdirSync(destDir, { recursive: true });
  const q = new URLSearchParams({
    filename: file.filename,
    subfolder: file.subfolder || "",
    type: file.type || "output",
  });
  const r = await fetch(`${HOST}/view?${q}`);
  if (!r.ok) throw new Error(`download failed ${r.status} for ${file.filename}`);
  const dest = join(destDir, name || file.filename);
  writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
  return dest;
}

// ------------------------------------------------------------------ graphs

/**
 * Stable Audio 3 Medium (distilled) -- every generated asset in the project:
 * the score cue, the one-shots and the ambience beds.
 *
 * All-in-one checkpoint (DiT + 256-channel VAE) plus ONE external text encoder,
 * t5gemma. No stem model, no planner LM, no split files: this is the whole
 * score pipeline now.
 *
 * DISTILLED, so the sampler settings are not free parameters -- cfg 1 and 8
 * steps on lcm/simple, straight off the shipped ComfyUI template
 * (comfyui_workflow_templates_json/audio_stable_audio_3_medium.json). At cfg 1
 * the negative branch is not evaluated at all, which is why `negative` defaults
 * to empty and steering happens entirely in the positive prose.
 *
 * PROMPT SHAPE: SA3 wants one flowing English sentence -- style, lead
 * instruments, supporting layers, percussion, mood, then "BPM: n. Length: n
 * seconds" -- not ACE's bracketed tag list. bpm and length are prose here and
 * therefore hints again, but nothing needs to phase-lock against anything, so
 * a few bpm of drift costs nothing.
 *
 * DURATION: EmptyLatentAudio is hardcoded to SA1's shape (64 ch, 2048
 * downscale). That is correct and deliberate -- comfy.sample
 * .fix_empty_latent_channels rewrites an all-zero latent to the loaded model's
 * latent_format, so the 4096-ratio, 256-channel SA3 latent is derived from the
 * same node. `seconds` is honoured; the ceiling is the seconds_total
 * conditioner's max_val of 384.
 */
export function stableAudio3Graph({
  prompt, negative = "", seconds = 120, seed, steps = 8, cfg = 1,
  model = "stable_audio_3_medium.safetensors", prefix = "bake/sa3",
}) {
  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: model } },
    "2": {
      class_type: "CLIPLoader",
      inputs: { clip_name: "t5gemma_b_b_ul2.safetensors", type: "stable_audio" },
    },
    "3": { class_type: "CLIPTextEncode", inputs: { text: prompt, clip: ["2", 0] } },
    "4": { class_type: "CLIPTextEncode", inputs: { text: negative, clip: ["2", 0] } },
    "5": { class_type: "EmptyLatentAudio", inputs: { seconds, batch_size: 1 } },
    "6": {
      class_type: "KSampler",
      inputs: {
        seed, steps, cfg, sampler_name: "lcm", scheduler: "simple", denoise: 1,
        model: ["1", 0], positive: ["3", 0], negative: ["4", 0], latent_image: ["5", 0],
      },
    },
    "7": { class_type: "VAEDecodeAudio", inputs: { samples: ["6", 0], vae: ["1", 2] } },
    "8": { class_type: "SaveAudio", inputs: { audio: ["7", 0], filename_prefix: prefix } },
  };
}
