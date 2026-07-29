# Saeed Kolivand - Portfolio

## Read it: [iamsaeed.dev](https://iamsaeed.dev/)

A scroll-driven portfolio built as a comic book. One global scroll position `t` in `[0,1]` drives twelve "issues" (scenes) inside a single React Three Fiber canvas, filmed by an authored shot list and printed through custom GLSL — halftone, ink line, crosshatch, paper. A fully designed static **Print Edition** renders instead for reduced-motion, narrow viewports, and no-WebGL.

The comic framing is not decoration; it is where the hard constraints come from. Comics are read at the reader's pace, in both directions, with no "playhead" — so the engine has to be a pure function of scroll position, deterministic, and identical frame-for-frame whichever way you arrived. Everything below follows from that.

[The constraints](#the-constraints) ·
[The twelve issues](#the-twelve-issues) ·
[Engine notes](#engine-notes) ·
[Audio](#audio) ·
[Degradation ladder](#degradation-ladder) ·
[Print Edition](#accessibility-and-the-print-edition) ·
[Tech](#tech) ·
[Run it](#run-it) ·
[Deployment](#deployment)

---

## The constraints

**1. Everything visible is `f(t)`.** You can scrub backwards through the entire run and get exactly the frames you saw on the way down. That is the whole design: `evaluateTimeline(t)` ([`lib/shots.ts`](lib/shots.ts)) is a binary search over a precompiled, gap-free segment list returning camera pose, shot progress and transition state for any `t` with zero frame history. Two things are deliberately outside it, and only two:

- **Authored-time beats** ([`lib/beats.ts`](lib/beats.ts)) fire when `t` crosses a trigger — idempotent by id (HMR/StrictMode safe), re-armed with hysteresis (default `0.006`) once `t` retreats, skipped entirely under reduced motion. Travel stays `f(t)`; only the slam is timed. The split is enforced: on the title drop, the card's *visibility* is a pure scroll window in [`components/Lettering.tsx`](components/Lettering.tsx), so an unfired beat (deep jump, reduced motion) still shows the card resting — the beat only owns the oversized impact frame.
- **The music clock** (below), which is wall-clock locked with `f(t)` layer gains.

**2. No `Math.random` on any scroll-driven path.** Every jitter, variant pick and noise draw is a seeded hash. [`lib/onomatopoeia.ts`](lib/onomatopoeia.ts) uses an FNV-style string hash after the `Math.random` default "burned two issues' scrub-determinism gates". [`lib/audio/util.ts`](lib/audio/util.ts) ships *two* hashes and documents why: the Knuth multiplicative hash is linear in `n`, so over consecutive indices it produces a sawtooth (autocorrelation 0.98 at lag 144) — fill an audio buffer with it and you get a near-ultrasonic whistle, not noise. Dense indices get a murmur3 avalanche mixer instead. [`scripts/audio/dsp.mjs`](scripts/audio/dsp.mjs) restates the same rule for the offline bake, so a re-bake with an unchanged recipe reproduces the same bytes.

**3. Rest frames must be bit-identical.** [`components/PostPipeline.tsx`](components/PostPipeline.tsx) snaps the asymptotically-decaying velocity to hard `0` below `1e-3`; [`components/ScrollProxy.tsx`](components/ScrollProxy.tsx) zeroes the store velocity after a 200 ms quiet window, because ScrollTrigger's `getVelocity` otherwise latches its last fling value forever at rest.

**4. Three flashes per rolling second, centrally.** [`lib/flashBudget.ts`](lib/flashBudget.ts) is twelve lines — a timestamp array capped at 3/second per WCAG 2.3.1. Every impact frame in the project is granted through it, enforced inside `registerJawDrop` ([`lib/beats.ts`](lib/beats.ts)) rather than trusted to each scene.

**5. One canvas, one composer, one pass.** Built once, never rebuilt; per-issue looks are uniform cross-fades.

---

## The twelve issues

[`issues/registry.ts`](issues/registry.ts) — ranges and gutters chain exactly to `1.000` ([`issues/timeline.ts`](issues/timeline.ts)). A new issue is one component file (component + `printRecipe()` + shot list + optional `registerJawDrop`) plus one row here. Nothing in the engine changes.

| # | Issue | `t` range | On the page | Exit gutter | Intensity |
|---|---|---|---|---|---|
| 0 | Cover | 0.000 – 0.030 | Four art layers, nearly coplanar, separating in z as the camera crash-dollies into the page | `crash-through` | 1 |
| 1 | Noir | 0.040 – 0.108 | Black-and-white hatched-ink street; instanced rain on stepped time; exactly one window prints in full color | `title-drop` | 2 |
| 2 | Desk | 0.123 – 0.210 | Warm full-color halftone workspace, keys under the lamp, a live three-panel composite | `dot-zoom` | 2 |
| 3 | Neon Ink | 0.225 – 0.305 | Black paper in flat neon inks — code-block buildings with syntax-highlighted facades, booting in a quantized cascade | `panel-wipe` | 5 |
| 4 | Origin Page | 0.315 – 0.378 | One comic page in a paper void: seven story beats, kid to senior; the camera glides *through* the last panel | `panel-portal` | 1 |
| 5 | The Press | 0.388 – 0.478 | A dark factory hall where the skills come off the conveyor, plate by plate | `stamp` | 3 |
| 6 | Newsprint | 0.488 – 0.566 | You walk *inside* the front page: column rules underfoot, standing headline sheets, a commit-graph ticker | `paper-tear` | 3 |
| 7 | Screentone | 0.576 – 0.656 | Manga screentone subway — one line crossing the page west to east, station by station | `page-flip` | 4 |
| 8 | Pop Print | 0.671 – 0.752 | Oversaturated webcomic streaming stage, live and on air | `whip` | 5 |
| 9 | Sketchbook | 0.762 – 0.838 | One sketchbook page lying flat: the architecture by hand, pencil to ink draw-on to wash flood | `ink-flood` | 2 |
| 10 | The Spread | 0.848 – 0.930 | Near-black cosmos with the real GitHub contribution grid as a literal star chart, then the whole run unfolds as a double-page spread | `dot-match` | 5 |
| 11 | Letters Page | 0.940 – 1.000 | The back cover: a CRT terminal that takes real keyboard input, plus clickable command cards | `cut` | 1 |

There is a cat. Harley is a real, fluffy golden tabby, and she is the through-line — she walks you scene to scene and hides in every issue ([`components/CatModel.tsx`](components/CatModel.tsx)).

`intensity` (1-5) is the beat chart. It is not a comment — the adaptive score reads it directly to decide which musical layers are audible.

---

## Engine notes

### Transitions

Thirteen authored `TransitionKind`s map to eleven native `TransitionMode`s. Two mappings stay collapsed by design: `title-drop -> whip` (the slam is an authored-time beat, the gutter only carries the whip) and `panel-portal -> panel-wipe` (a portal fly-through is camera work, not a post op). `drift` is a continuity gutter — the post pass renders nothing and the camera carries straight through; a shot may only declare it when its end pose is authored equal to the next shot's from pose.

- `deadbandedP` freezes gutter progress just inside each edge (`min(0.002, width * 0.25)`), so parking the scroll exactly on a boundary cannot strobe the effect on and off.
- `cutPoint` makes snapshot-driven transitions cut at `p = 0` — the camera films the incoming issue for the entire gutter while the outgoing issue exists only as a captured frame. Cut, whip and ink-flood jump at the gutter midpoint, where the full-frame cover hides the pose change.

### Post pipeline

[`components/PostPipeline.tsx`](components/PostPipeline.tsx) builds one `EffectComposer` (`RenderPass`, `NormalPass`, one merged `EffectPass` containing `PrintEffect` + `TransitionEffect`) at `HalfFloatType`, and takes the frame with a numeric `useFrame` priority of `1`, which disables R3F's automatic render.

**Those two effects must stay merged.** `postprocessing` sorts merged effects by attribute with `CONVOLUTION` outranking `DEPTH`, so the transition composites first and the print pass prints the result. `PrintEffect`'s fragment reads a `pjtCovered` GLSL global that `TransitionEffect` declares — split them into two passes and it does not degrade, it fails to compile. Without that coverage gate the incoming issue's ink line drew as a wireframe over every snapshot gutter and doubled every displaced edge.

Other things worth reading in [`shaders/`](shaders):

- **Word-art ink exemption.** troika SDF lettering writes neither depth nor normals, so geometry standing behind a word inks straight over its glyphs. Each frame the pipeline walks the scene, finds the largest troika block above 5% of viewport area, projects it to a screen-space parallelogram and hands the shader a rect the ink line skips. Scored on *pure projected area*, never area × opacity — otherwise a fading word crosses the threshold mid-fade and pops the exemption on in a single frame. Opacity rides `uWordEdge` instead, so the exemption itself fades. Its depth test is the deliberate inverse of the color-window test: a word has no depth of its own, so the exemption applies only where the depth buffer sits *behind* the word plane, and anything in front of the lettering keeps its line.
- **Two world-space color rects** (the noir color window and a per-frame mascot spot) are reconstructed per pixel from the depth buffer through one shared `uInvViewProjection` multiply — a selective-color effect that normally costs a render target here costs zero.
- **Dark-paper polarity** is derived in-shader from `uPaper` luminance rather than being a recipe field, so halftone and crosshatch coverage tracks brightness on light-ink-on-dark-paper issues while recipe cross-fades between polarities stay smooth.
- **Line boil** jitters the Sobel *offset* only, at a fixed one-texel radius. Jittering the radius too rescaled the edge threshold globally on every step, flipping near-threshold regions between fully inked and clean and flickering ~30% of frames at rest. The fixed radius is the old modulation's mean, so line weight is unchanged.

An issue's entire print look is one `printRecipe()` object of 14 knobs ([`lib/recipes.ts`](lib/recipes.ts)), only `paper` and `ink` required; the pipeline lerps every uniform toward the filmed issue's recipe over roughly 0.2 s.

### Scene lifecycle

[`components/SceneManager.tsx`](components/SceneManager.tsx) keeps the active issue plus its two neighbours mounted and wraps **each in its own Suspense boundary** — a set suspending without a local boundary reaches R3F's root, unmounts the DOM canvas and permanently kills the frame loop. On a deep jump (deep link, scrollbar yank) the mounted window lags one painted frame on purpose, so a paper-fill cover is on screen before the target issue's shader-compiling, main-thread-blocking first render.

[`lib/snapshots.ts`](lib/snapshots.ts) is an LRU pool of at most 4 `FramebufferTexture` copies, captured only in a shot's tail (`shotP > 0.85`) and only when the next gutter needs one or a consumer has explicitly retained that issue. They are CPU-side framebuffer copies, not render targets, so the pipeline's render-target budget is untouched.

### Scroll

Lenis -> one ScrollTrigger -> normalized `t` in a Zustand store. Base spacer 2400vh, wheel multiplier 0.7. `progressToT` is a monotone piecewise-linear remap that doubles scroll distance inside `t ∈ [0.028, 0.082]` (the crash-through entry and noir facade whip), and the spacer grows by exactly that amount so every region outside the window keeps its px-per-`t` feel and every `t`-space authoring number elsewhere is untouched. `tToProgress` is its exact inverse, so programmatic jumps land on precisely `t`.

### Stepped time

[`lib/steppedClock.ts`](lib/steppedClock.ts) quantizes world and prop animation to 12 fps (8 on the low tier) — comic "animation on 2s" — while camera and scroll stay smooth, and supplies a matching deterministic per-step noise for line boil and hand-drawn wobble.

---

## Audio

**This is a hybrid system, not pure synthesis.** The repo ships 34 committed `.m4a` files across six categories in `public/audio/` (`AUDIO_BYTES = 8142428` in [`lib/audio/manifest.ts`](lib/audio/manifest.ts)), and Tone.js 15 is still the runtime engine for everything else — twelve per-issue ambience beds, eleven scored gutter voices, the diegetic scene moments, the six-bus mix, sample playback, and the convolution rooms.

Thirteen slots ship as files: the three score stems, the press slam and clank, the title drop, the spread unfold, the paper tear, the page flip, three room beds and the terminal keystrokes. Round robins are normalised as a group, never individually, so variation between variants survives. The three score stems alone are 6,994,907 of the 8,142,428 bytes — about 86% of the payload. The three ambience beds are baked and shipped ahead of their call sites; the manifest is generated from the bake, not from usage.

### The score

One 120 s cue, generated locally with **ACE-Step v1 (3.5B, Apache-2.0)** through ComfyUI — seed 424242, 60 steps, cfg 5, 90 bpm, D minor, instrumental — then split into `drums` / `bass` / `other` by **Demucs**. The full provenance is committed at [`assets/audio-src/score.json`](assets/audio-src/score.json) so a regeneration is reproducible rather than a fishing trip. Generating one cue and splitting it is what guarantees the three layers share key, tempo and phase; four separate cues would not line up.

At runtime ([`lib/audio/score.ts`](lib/audio/score.ts)) the cue is **wall-clock locked and gain-mixed**, not scrubbed. Real music has rhythmic identity, and scrubbing it by scroll position sounds like a turntable. So the clock runs independently and only the layer gains are `f(t, velocity)` — standard game vertical layering, scrub-safe by construction. `arrangement()` maps each issue's `intensity` (1-5) to gains, interpolated across gutters by `roomBlend`, the project's existing pure `f(t)` "where am I between two scenes" function: the harmonic bed is always present but drops in the quiet valleys, bass enters second, drums last. The accepted consequence: a hit at a given `t` lands wherever the music happens to be. The visual frame wins and the music ducks.

### The runtime graph

[`lib/audio/buses.ts`](lib/audio/buses.ts) routes **music, ambience, foley, hardfx, ui and sub** through separate compressors into one `EQ3 -> Compressor -> Limiter` master. `ui` and `sub` get no room send at all — interface sound has to stay legible when the room is a subway tunnel, and reverberating a sub only smears it.

A metering-only `pulseBus` sums both bed buses **pre-duck** and connects to nothing downstream. It drives `fx.audioPulse` -> `uAudioPulse` -> the halftone dot-scale breathe, so a sidechain duck or a hit-stop can never move a visual. At `uAudioPulse == 0` the dot radius factor is exactly `1.0`, keeping the silent path bit-identical.

**Rooms are still fully runtime-generated.** Twelve per-scene impulse responses are rendered client-side in an `OfflineAudioContext` from a reviewable parameter table ([`lib/audio/ir.ts`](lib/audio/ir.ts), [`lib/audio/rooms.ts`](lib/audio/rooms.ts)) — decay, pre-delay, three-band decay multipliers, early-reflection taps, stereo width, seed. Zero IR bytes ship — and shipping them would be actively worse than merely bigger, because lossy pre-echo *inside* an impulse response smears the attack of every sound convolved with it. Two convolvers crossfade across each gutter so the space morphs with the scene instead of switching.

**Hit-stop** is exactly three beats — `press-stamp` (depth 1), `spread-unfold` (0.9), `title-drop` (0.85) — and the table's header in [`lib/audio/director.ts`](lib/audio/director.ts) forbids a fourth without one leaving. It rides `duckGain`, which carries only the beds and the score, while the hardfx room send is tapped pre-duck: the world falls away and the impact's reverb rings on into the hole.

**Fallback is the contract.** `hit(name, opts)` ([`lib/audio/oneshot.ts`](lib/audio/oneshot.ts)) returns `false` when it cannot play — buffer not landed, slot missing, voice stolen, min-gap refused — and every call site uses that return value to fall through to its existing synth voice. `loadBank` is fire-and-forget with four concurrent `force-cache` fetches; a cold bank or a dead network is inaudible rather than silent. The score (~69 MB decoded) is skipped entirely on the low tier.

Audio is **off by default and gesture-gated**: `enableAudio()` must be called synchronously from a click, and Tone.js is lazy-imported there so it never rides the initial bundle. [`components/SoundInvite.tsx`](components/SoundInvite.tsx) is a one-time cover card that arms audio inside the user's own click; it is the only use of `localStorage` in the repo (key `sk.sound-invite`, read inside an effect).

Re-baking is a manual authoring step: `npm run bake:audio` ([`scripts/bake-audio.mjs`](scripts/bake-audio.mjs)) renders every slot, normalises it per category, encodes to AAC and **generates `lib/audio/manifest.ts`**. It needs ffmpeg and ffprobe on PATH and is deliberately **not** wired into `prebuild` — the outputs are committed artifacts, so CI never needs ffmpeg, a GPU, or a model. The manifest is emitted as a literal object so `keyof typeof AUDIO` gives the exact slot-name union: a misspelled slot is a compile error, not a hit that silently never plays.

---

## Degradation ladder

[`lib/device.ts`](lib/device.ts) is the single place that decides who gets 3D and at which tier. `ExperienceGate` is its only caller.

```text
fine pointer   ->  width >= 820
coarse pointer ->  min(innerWidth, innerHeight) >= 500  AND  innerWidth >= 700
```

Coarse devices split on the **short side**, not width: an iPhone 16 Pro Max is 956 CSS px wide in landscape, so a width test at 820 admits every current iPhone above the mini — at ~430 px of height and an aspect ratio where projected word-art area shrinks 0.74× against the desktop baseline, dropping blocks under the ink-exemption threshold. A phone's short side can never exceed its portrait width (440 at most); a tablet's clears 660 even after browser chrome. The 700 px width floor is there because the short side alone cuts through the iPad Split View pane range (507, 570, 678 px), all far narrower than these compositions were authored for. UA sniffing is not an option: iPadOS Safari defaults to "Request Desktop Website" and reports itself as macOS. `innerWidth/innerHeight` rather than `screen.*` specifically so Split View panes shrink.

Tablets run the full experience at the **low tier**, which is a real ladder rather than a label: dpr `[1,2] -> [1,1.5]`, stepped animation 12 -> 8 fps, reduced instance counts across [`issues/`](issues), halved audio voice partitions, and no music score.

`?low` forces the low tier **without** switching to Print — a flag that dumped you into the Print Edition could never be used to measure the tier it names.

---

## Accessibility and the Print Edition

The Print Edition ([`components/PrintEdition.tsx`](components/PrintEdition.tsx)) is a genuinely designed static comic, not a stub. It is **server-rendered on both paths** and stays in the accessibility tree behind the canvas rather than being hidden.

- One `<h1>` (the masthead), one `<h2>` per issue, a skip link, a labelled `<nav>`, real `<a>` links, `alt` on every image. All content is real DOM text — the same copy the 3D scenes letter.
- Focusing any link inside it while 3D is up tears the entire interactive stack down, so keyboard focus is never trapped under the canvas. The sound controls sit **before** it in DOM order precisely because anything after it would be unreachable by keyboard.
- **The switch is two-way and preserves scroll position.** `measurePrintT()` reads which print section is at the viewport top *synchronously, before* the layout collapses, and converts it to a global `t` through that issue's authored range; `scrollToT()` restores it. Going the other way scrolls the matching print section into view. A coarse-pointer resize/orientationchange listener *grants* (never revokes) the experience, so a rotated portrait tablet is not stuck in the reader.
- The "watch the animated version" offer is deliberately **not** shown on narrow viewports — a 390 px audit found copy cropped on both sides in 8 of 12 scenes and no subject framed at all in the desk issue. It is offered to reduced-motion users and as the undo for a manual switch. It withdraws itself if the WebGL probe actually fails, so the button is never dead.
- Reduced motion means zero motion. [`components/PrintEdition.module.css`](components/PrintEdition.module.css) gates its only two animations (a 0.5 s root fade-in and a 2 px hover translate) behind `@media (prefers-reduced-motion: no-preference)`, so reduced-motion readers get a completely static page. Phone and no-WebGL readers who have not set the OS flag do see that small amount.
- Flash safety is enforced in code, not by convention: 3 flashes per rolling second, WCAG 2.3.1, granted centrally (see above).

---

## Tech

Next.js 16 (App Router, `output: "export"`) · React 19 · TypeScript 6 (strict) · React Three Fiber 9 + drei · `postprocessing` 6 · Three.js 0.185 with hand-written GLSL · Tone.js 15 (synthesis, sample playback, convolution) · GSAP + ScrollTrigger · Lenis · Zustand · Tailwind CSS 4.

Offline audio toolchain (not required to build or run): ffmpeg/ffprobe, ComfyUI + ACE-Step v1, Demucs.

Fonts are loaded twice on purpose: `next/font/google` for DOM text, and self-hosted TTFs in `public/fonts/` for troika SDF lettering inside the canvas.

---

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

| Script | What it does |
|---|---|
| `npm run dev` | Next dev server |
| `npm run build` | Runs `prebuild` ([`scripts/bake-contributions.mjs`](scripts/bake-contributions.mjs)) then `next build`; static export to `./out` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run bake:audio` | Re-bake `public/audio/` and regenerate `lib/audio/manifest.ts` (needs ffmpeg + ffprobe) |

**There are no tests and no linter.** The only checks are `npm run typecheck` and `next build`; CI runs the build.

Requires Node >= 20.9.

To see the Print Edition locally, enable your OS "reduce motion" setting or narrow the window below 820 px. `?low` forces the low quality tier without switching to print. `?debug` adds the perf HUD ([`components/PerfHUD.tsx`](components/PerfHUD.tsx)).

One caveat if you edit source: files under `app/`, `components/`, `lib/`, `issues/` and `shaders/` stay **pure ASCII**. A Turbopack bug on multi-byte characters in merged source maps kills the Next 16 build.

> Open the browser console for a small easter egg.

---

## Deployment

GitHub Pages at the apex domain `iamsaeed.dev` via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml): `npm run build` produces a static `./out`, published on every push to `main`. `configure-pages` runs deliberately *without* `static_site_generator: next`, which would force a `basePath` meant for project subpaths and break every asset URL at a domain root.

No server and no third-party runtime fetches — the GitHub contribution grid is baked to `public/data/contributions.json` at build time over a pinned 365-day window, and falls back to a deterministic procedural starfield on any failure so the script can never fail the build. The page does fetch its own static audio assets, on demand, only after you enable sound.

---

## How it was built

Built with **Claude Code**: an orchestrator coordinating six specialised subagents — scene builder, shader engineer, gate auditor, performance profiler, docs researcher, content scribe. Their definitions are committed in [`.claude/agents/`](.claude/agents/).

---

<sub>© Saeed Kolivand. Style borrows the generic technique vocabulary of comic printing; no third-party characters, logos, or IP. Fonts are OFL (Bangers, Caveat, JetBrains Mono). The soundtrack is machine-generated with ACE-Step v1 (Apache-2.0); model, seed and generation parameters are committed at `assets/audio-src/score.json`. Harley is real and was not consulted.</sub>
