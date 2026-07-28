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
 * Stable Audio Open 1.0 -- text to audio, up to 47 s.
 * Used for the long textural material code synthesis is worst at: rain wash,
 * city hum, crowd babble, machinery, steam, and the TAIL of impacts.
 *
 * Node ids verified against comfy_extras/nodes_audio.py in ComfyUI 0.28.0.
 */
export function stableAudioGraph({ prompt, negative = "", seconds = 20, seed, steps = 60, cfg = 5.5 }) {
  return {
    "1": {
      class_type: "CheckpointLoaderSimple",
      inputs: { ckpt_name: "stable_audio_open_1.0.safetensors" },
    },
    "2": {
      class_type: "CLIPLoader",
      inputs: { clip_name: "t5_base.safetensors", type: "stable_audio" },
    },
    "3": { class_type: "CLIPTextEncode", inputs: { text: prompt, clip: ["2", 0] } },
    "4": { class_type: "CLIPTextEncode", inputs: { text: negative, clip: ["2", 0] } },
    "5": { class_type: "EmptyLatentAudio", inputs: { seconds, batch_size: 1 } },
    "6": {
      class_type: "KSampler",
      inputs: {
        seed, steps, cfg, sampler_name: "dpmpp_3m_sde_gpu", scheduler: "exponential",
        denoise: 1, model: ["1", 0], positive: ["3", 0], negative: ["4", 0], latent_image: ["5", 0],
      },
    },
    "7": { class_type: "VAEDecodeAudio", inputs: { samples: ["6", 0], vae: ["1", 2] } },
    "8": { class_type: "SaveAudio", inputs: { audio: ["7", 0], filename_prefix: "bake/sao" } },
  };
}

/**
 * ACE-Step v1 3.5B -- the musical score.
 *
 * NOTE ON TEMPO: the v1 text encoder (TextEncodeAceStepAudio) takes only
 * tags/lyrics -- it has no bpm input. That belongs to
 * TextEncodeAceStepAudio1.5, which needs the 1.5 checkpoint we are not using.
 * So tempo is requested in the TAGS string ("84 bpm") and is a strong hint,
 * not a lock. Cues intended to layer must therefore be verified against each
 * other after generation rather than assumed to line up -- which is exactly
 * why the score plan generates ONE cue and splits it into stems, instead of
 * generating several and hoping they agree.
 */
export function aceStepGraph({ tags, lyrics = "", seconds = 90, seed, steps = 50, cfg = 5 }) {
  return {
    "1": {
      class_type: "CheckpointLoaderSimple",
      inputs: { ckpt_name: "ace_step_v1_3.5b.safetensors" },
    },
    "2": {
      class_type: "TextEncodeAceStepAudio",
      inputs: { clip: ["1", 1], tags, lyrics, lyrics_strength: 1 },
    },
    "3": {
      class_type: "TextEncodeAceStepAudio",
      inputs: { clip: ["1", 1], tags: "", lyrics: "", lyrics_strength: 1 },
    },
    "4": { class_type: "EmptyAceStepLatentAudio", inputs: { seconds, batch_size: 1 } },
    "5": {
      class_type: "KSampler",
      inputs: {
        seed, steps, cfg, sampler_name: "euler", scheduler: "simple", denoise: 1,
        model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0],
      },
    },
    "6": { class_type: "VAEDecodeAudio", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    "7": { class_type: "SaveAudio", inputs: { audio: ["6", 0], filename_prefix: "bake/ace" } },
  };
}
