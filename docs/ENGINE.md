# Engine notes

The deep end of [the portfolio](../README.md). Everything here follows from the
five constraints in the README: the engine is a pure function of scroll position
`t`, deterministic, and identical frame-for-frame whichever way you arrived.

[Gutters and intensity](#gutters-and-intensity) ·
[Transitions](#transitions) ·
[Post pipeline](#post-pipeline) ·
[Scene lifecycle](#scene-lifecycle) ·
[Scroll](#scroll) ·
[Stepped time](#stepped-time) ·
[Audio](#audio)

---

## Gutters and intensity

A new issue is one component file (component + `printRecipe()` + shot list +
optional `registerJawDrop`) plus one row in [`issues/registry.ts`](../issues/registry.ts).
Nothing in the engine changes.

| # | Issue | `t` range | Exit gutter | Intensity |
|---|---|---|---|---|
| 0 | Cover | 0.000 – 0.030 | `crash-through` | 1 |
| 1 | Noir | 0.040 – 0.108 | `title-drop` | 2 |
| 2 | Desk | 0.123 – 0.210 | `dot-zoom` | 2 |
| 3 | Neon Ink | 0.225 – 0.305 | `panel-wipe` | 5 |
| 4 | Origin Page | 0.315 – 0.378 | `panel-portal` | 1 |
| 5 | The Press | 0.388 – 0.478 | `stamp` | 3 |
| 6 | Newsprint | 0.488 – 0.566 | `paper-tear` | 3 |
| 7 | Screentone | 0.576 – 0.656 | `page-flip` | 4 |
| 8 | Pop Print | 0.671 – 0.752 | `whip` | 5 |
| 9 | Sketchbook | 0.762 – 0.838 | `ink-flood` | 2 |
| 10 | The Spread | 0.848 – 0.930 | `dot-match` | 5 |
| 11 | Letters Page | 0.940 – 1.000 | `cut` | 1 |

`intensity` (1-5) is the beat chart. It is not a comment — the adaptive score
reads it directly to decide how loud and how bright the music is.

---

## Transitions

Thirteen authored `TransitionKind`s map to eleven native `TransitionMode`s. Two mappings stay collapsed by design: `title-drop -> whip` (the slam is an authored-time beat, the gutter only carries the whip) and `panel-portal -> panel-wipe` (a portal fly-through is camera work, not a post op). `drift` is a continuity gutter — the post pass renders nothing and the camera carries straight through; a shot may only declare it when its end pose is authored equal to the next shot's from pose.

- `deadbandedP` freezes gutter progress just inside each edge (`min(0.002, width * 0.25)`), so parking the scroll exactly on a boundary cannot strobe the effect on and off.
- `cutPoint` makes snapshot-driven transitions cut at `p = 0` — the camera films the incoming issue for the entire gutter while the outgoing issue exists only as a captured frame. Cut, whip and ink-flood jump at the gutter midpoint, where the full-frame cover hides the pose change.

## Post pipeline

[`components/PostPipeline.tsx`](../components/PostPipeline.tsx) builds one `EffectComposer` (`RenderPass`, `NormalPass`, one merged `EffectPass` containing `PrintEffect` + `TransitionEffect`) at `HalfFloatType`, and takes the frame with a numeric `useFrame` priority of `1`, which disables R3F's automatic render.

**Those two effects must stay merged.** `postprocessing` sorts merged effects by attribute with `CONVOLUTION` outranking `DEPTH`, so the transition composites first and the print pass prints the result. `PrintEffect`'s fragment reads a `pjtCovered` GLSL global that `TransitionEffect` declares — split them into two passes and it does not degrade, it fails to compile. Without that coverage gate the incoming issue's ink line drew as a wireframe over every snapshot gutter and doubled every displaced edge.

Other things worth reading in [`shaders/`](../shaders):

- **Word-art ink exemption.** troika SDF lettering writes neither depth nor normals, so geometry standing behind a word inks straight over its glyphs. Each frame the pipeline walks the scene, finds the largest troika block above 5% of viewport area, projects it to a screen-space parallelogram and hands the shader a rect the ink line skips. Scored on *pure projected area*, never area × opacity — otherwise a fading word crosses the threshold mid-fade and pops the exemption on in a single frame. Opacity rides `uWordEdge` instead, so the exemption itself fades. Its depth test is the deliberate inverse of the color-window test: a word has no depth of its own, so the exemption applies only where the depth buffer sits *behind* the word plane, and anything in front of the lettering keeps its line.
- **Two world-space color rects** (the noir color window and a per-frame mascot spot) are reconstructed per pixel from the depth buffer through one shared `uInvViewProjection` multiply — a selective-color effect that normally costs a render target here costs zero.
- **Dark-paper polarity** is derived in-shader from `uPaper` luminance rather than being a recipe field, so halftone and crosshatch coverage tracks brightness on light-ink-on-dark-paper issues while recipe cross-fades between polarities stay smooth.
- **Line boil** jitters the Sobel *offset* only, at a fixed one-texel radius. Jittering the radius too rescaled the edge threshold globally on every step, flipping near-threshold regions between fully inked and clean and flickering ~30% of frames at rest. The fixed radius is the old modulation's mean, so line weight is unchanged.

An issue's entire print look is one `printRecipe()` object of 14 knobs ([`lib/recipes.ts`](../lib/recipes.ts)), only `paper` and `ink` required; the pipeline lerps every uniform toward the filmed issue's recipe over roughly 0.2 s.

## Scene lifecycle

[`components/SceneManager.tsx`](../components/SceneManager.tsx) keeps the active issue plus its two neighbours mounted and wraps **each in its own Suspense boundary** — a set suspending without a local boundary reaches R3F's root, unmounts the DOM canvas and permanently kills the frame loop. On a deep jump (deep link, scrollbar yank) the mounted window lags one painted frame on purpose, so a paper-fill cover is on screen before the target issue's shader-compiling, main-thread-blocking first render.

[`lib/snapshots.ts`](../lib/snapshots.ts) is an LRU pool of at most 4 `FramebufferTexture` copies, captured only in a shot's tail (`shotP > 0.85`) and only when the next gutter needs one or a consumer has explicitly retained that issue. They are CPU-side framebuffer copies, not render targets, so the pipeline's render-target budget is untouched.

## Scroll

Lenis -> one ScrollTrigger -> normalized `t` in a Zustand store. Base spacer 2400vh, wheel multiplier 0.7. `progressToT` is a monotone piecewise-linear remap that doubles scroll distance inside `t ∈ [0.028, 0.082]` (the crash-through entry and noir facade whip), and the spacer grows by exactly that amount so every region outside the window keeps its px-per-`t` feel and every `t`-space authoring number elsewhere is untouched. `tToProgress` is its exact inverse, so programmatic jumps land on precisely `t`.

## Stepped time

[`lib/steppedClock.ts`](../lib/steppedClock.ts) quantizes world and prop animation to 12 fps (8 on the low tier) — comic "animation on 2s" — while camera and scroll stay smooth, and supplies a matching deterministic per-step noise for line boil and hand-drawn wobble.

## The Print Edition switch

- **The switch is two-way and preserves scroll position.** `measurePrintT()` reads which print section is at the viewport top *synchronously, before* the layout collapses, and converts it to a global `t` through that issue's authored range; `scrollToT()` restores it. Going the other way scrolls the matching print section into view. A coarse-pointer resize/orientationchange listener *grants* (never revokes) the experience, so a rotated portrait tablet is not stuck in the reader.
- The "watch the animated version" offer is deliberately **not** shown on narrow viewports — a 390 px audit found copy cropped on both sides in 8 of 12 scenes and no subject framed at all in the desk issue. It is offered to reduced-motion users and as the undo for a manual switch. It withdraws itself if the WebGL probe actually fails, so the button is never dead.

---

## Audio

**This is a hybrid system, not pure synthesis.** The repo ships 36 committed `.m4a` files across six categories in `public/audio/` (`AUDIO_BYTES = 4388056` in [`lib/audio/manifest.ts`](../lib/audio/manifest.ts)), and Tone.js 15 is still the runtime engine for everything else — twelve per-issue ambience beds, eleven scored gutter voices, the diegetic scene moments, the six-bus mix, sample playback, and the convolution rooms.

Twelve slots ship as files, and **every one of them is generated**: the score, the press slam and clank, the title drop, the spread unfold, the paper tear, the page flip, the cat, three room beds and the terminal keystrokes. Round robins are normalised as a group, never individually, so variation between variants survives. The score alone is 2,997,702 of the 4,388,056 bytes — about 68% of the payload. The three ambience beds are baked and shipped ahead of their call sites; the manifest is generated from the bake, not from usage.

### The effects

Every sampled effect is a Stable Audio 3 render, declared in [`assets/audio-src/sfx.json`](../assets/audio-src/sfx.json) — prompt, seed, round-robin count and trim length per slot — and produced by `node scripts/render-audio.mjs`. That file is the input, not a description of one: `bake-audio.mjs` reads `n` and `seed` straight out of it and finds the renders by convention, so the slot table cannot describe a different bake than the renderer produced.

This replaced a hand-written offline DSP layer — modal impact banks, filtered-noise page flips, a granular tear. They were good, and they were unmistakably synthetic: a modal bank gives you a plausible ring, but never the fibrous, uneven mess a real sheet of paper makes.

**One-shots have to be trimmed, and that is not cosmetic.** The model's minimum render is 1 s, and a diffusion model asked for one second of keystroke returns one second of *room* with a keystroke somewhere in it. Untrimmed, every hit would fire late by however much silence the model left, the one-shot pool would hold voices busy for the full render, and each variant would carry a second of encoded nothing. The bake trims both ends at −50 dBFS — not at zero, since the renders have a real noise floor — keeps 5 ms of pre-roll so the attack survives, and fades the cut edge over 30 ms. Ambience beds are never trimmed: their quiet parts *are* the room, and the bed player loops them.

**Harley meows for herself.** `fol.meow` is four real meows; the FMSynth contour that used to be the cat is now the fallback voice for the frames before the bank lands and for the low tier. Same contract as every other hit: `hit()` returns `false` and the call site falls through.

### The score

One 120 s stereo cue, generated locally with **Stable Audio 3 Medium (distilled)** through ComfyUI — seed 740074, 8 steps, cfg 1, `lcm`/`simple`, a sparse felt-piano/upright-bass/brushed-kit trio at 74 bpm. The distilled checkpoint fixes those sampler settings rather than offering them, and at cfg 1 the negative branch is never evaluated, so all steering lives in the positive prose. Full provenance is committed at [`assets/audio-src/score.json`](../assets/audio-src/score.json) so a regeneration is reproducible rather than a fishing trip: `node scripts/render-score.mjs` re-renders it from that file.

**The cue ships whole — no stem separation.** An earlier version split it into `drums`/`bass`/`other` with Demucs and mixed them as vertical layers; a source separator's idea of "bass" in a felt-piano trio is mostly piano left hand, and the runtime was paying three times the decoded memory for that bleed. One file, one clock, and the balance the model actually mastered.

At runtime ([`lib/audio/score.ts`](../lib/audio/score.ts)) the cue is **wall-clock locked and gain-mixed**, not scrubbed. Real music has rhythmic identity, and scrubbing it by scroll position sounds like a turntable. So the clock runs independently and only the gain and the lowpass cutoff are `f(t, velocity)` — scrub-safe by construction, since both are pure functions of `t`. `arrangement()` maps each issue's `intensity` (1-5) onto both, interpolated across gutters by `roomBlend`, the project's existing pure `f(t)` "where am I between two scenes" function: in the quiet valleys the score sits at 0.28 gain under a 900 Hz lowpass, so it reads as distant and dark rather than merely turned down, and it opens to full level and 18 kHz at intensity 5. Velocity opens the filter rather than raising the level — a fast scroll should feel like a fast-forward, not like the mix falling apart. The accepted consequence: a hit at a given `t` lands wherever the music happens to be. The visual frame wins and the music ducks.

### The runtime graph

[`lib/audio/buses.ts`](../lib/audio/buses.ts) routes **music, ambience, foley, hardfx, ui and sub** through separate compressors into one `EQ3 -> Compressor -> Limiter` master. `ui` and `sub` get no room send at all — interface sound has to stay legible when the room is a subway tunnel, and reverberating a sub only smears it.

A metering-only `pulseBus` sums both bed buses **pre-duck** and connects to nothing downstream. It drives `fx.audioPulse` -> `uAudioPulse` -> the halftone dot-scale breathe, so a sidechain duck or a hit-stop can never move a visual. At `uAudioPulse == 0` the dot radius factor is exactly `1.0`, keeping the silent path bit-identical.

**Rooms are still fully runtime-generated.** Twelve per-scene impulse responses are rendered client-side in an `OfflineAudioContext` from a reviewable parameter table ([`lib/audio/ir.ts`](../lib/audio/ir.ts), [`lib/audio/rooms.ts`](../lib/audio/rooms.ts)) — decay, pre-delay, three-band decay multipliers, early-reflection taps, stereo width, seed. Zero IR bytes ship — and shipping them would be actively worse than merely bigger, because lossy pre-echo *inside* an impulse response smears the attack of every sound convolved with it. Two convolvers crossfade across each gutter so the space morphs with the scene instead of switching.

**Hit-stop** is exactly three beats — `press-stamp` (depth 1), `spread-unfold` (0.9), `title-drop` (0.85) — and the table's header in [`lib/audio/director.ts`](../lib/audio/director.ts) forbids a fourth without one leaving. It rides `duckGain`, which carries only the beds and the score, while the hardfx room send is tapped pre-duck: the world falls away and the impact's reverb rings on into the hole.

**Fallback is the contract.** `hit(name, opts)` ([`lib/audio/oneshot.ts`](../lib/audio/oneshot.ts)) returns `false` when it cannot play — buffer not landed, slot missing, voice stolen, min-gap refused — and every call site uses that return value to fall through to its existing synth voice. `loadBank` is fire-and-forget with four concurrent `force-cache` fetches; a cold bank or a dead network is inaudible rather than silent. The score (~69 MB decoded) is skipped entirely on the low tier.

Audio is **off by default and gesture-gated**: `enableAudio()` must be called synchronously from a click, and Tone.js is lazy-imported there so it never rides the initial bundle. [`components/SoundInvite.tsx`](../components/SoundInvite.tsx) is a one-time cover card that arms audio inside the user's own click; it is the only use of `localStorage` in the repo (key `sk.sound-invite`, read inside an effect).

### Re-baking

Re-baking is a manual authoring step: `npm run bake:audio` ([`scripts/bake-audio.mjs`](../scripts/bake-audio.mjs)) renders every slot, normalises it per category, encodes to AAC and **generates `lib/audio/manifest.ts`**. It needs ffmpeg and ffprobe on PATH and is deliberately **not** wired into `prebuild` — the outputs are committed artifacts, so CI never needs ffmpeg, a GPU, or a model. The manifest is emitted as a literal object so `keyof typeof AUDIO` gives the exact slot-name union: a misspelled slot is a compile error, not a hit that silently never plays.
