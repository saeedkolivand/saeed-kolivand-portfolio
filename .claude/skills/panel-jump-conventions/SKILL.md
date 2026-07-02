---
name: panel-jump-conventions
description: PANEL JUMP locked decisions - the S2 engine contract, S0.3 timeline, S5 transition specs, S5b cinematic rules, S2.16 comfort rule. Load before building or modifying any scene, shot, transition, or shader in this project.
---

# PANEL JUMP conventions (locked - do not re-litigate)

## Engine contract (SPEC.md S2)
- ONE persistent Canvas, frameloop="always", dpr [1,2] (low tier [1,1.5]).
- Lenis -> one ScrollTrigger -> normalized t in lib/scrollStore. Everything
  scroll-driven is a pure function of t (users scroll backwards).
- ShotDirector owns the camera: ordered Shot list (issues/registry.ts),
  pose lerp inside a shot, designed transition at boundaries, hard snap
  across cuts, pointer parallax only inside hold/dolly shots.
- Gutters: consecutive ranges never touch; the space between IS the
  transition's scroll real-estate (0.010 standard, 0.015 showcase). Local
  p = deadbanded progress through the gutter drives the transition shader.
- Scenes are isolated sets 200 world units apart (issueCenter(i)), active
  +/-1 mounted by SceneManager. Own lights per set, no shared fog.
- ONE EffectComposer (PostPipeline): RenderPass -> NormalPass -> EffectPass
  (PrintEffect + TransitionEffect merged). Issues swap PrintRecipe uniforms
  (lib/recipes.ts) with a ~0.2s cross-fade - never rebuild passes.
- Materials: MeshToonMaterial + lib/toon.ts toonRamp(). No PBR, no env maps,
  max one realtime shadow light per issue.
- Stepped time: props/characters sample stepTime(elapsed, 12) (8 on low
  tier); camera and scroll always run smooth. This contrast is the signature.
- Beats (authored-time, 0.4-1.5s GSAP timelines) fire on t-crossings via
  lib/beats.ts BeatRunner: idempotent, hysteresis re-arm, skipped under
  reduced motion, flashes gated by lib/flashBudget requestFlash().
- Render targets: max 3 live, half-res; everything else uses lib/snapshots.

## Timeline (S0.3 - chains exactly to 1.000, do not re-balance)
Ranges live in issues/registry.ts ISSUES. Standard gutter 0.010; showcase
0.015 after Noir (title-drop), Desk (dot-zoom), Screentone (page-flip).

## Transitions (S5)
dot-zoom, page-flip, paper-tear, whip, stamp cut, panel-wipe, match-cut.
Phase 0 has cut/whip/dot-zoom real; TRANSITION_FALLBACK in lib/shots.ts maps
the rest to analogs until Phases 1-2 implement them. Transitions run on the
outgoing snapshot + incoming live frame, driven by scrub-safe p.

## Cinematic rules (S5b) - gated per issue
1. Cuts are motivated (the cat is the through-line; screen-direction
   continuity). 2. Beat chart: intensity 1-5 per issue, no two adjacent
   issues equal, at least two full valleys. 3. Title drop after Issue 1.
4. Lens language: establish -> detail -> reveal; every shot passes: one
   focal point, three depth planes, readable at 200px, intentional focal
   placement, lettering pixel-crisp. 5. Diegetic interactivity garnish.

## Comfort rule (S2.16 - absolute, overrides any reference art)
Zero chromatic aberration, zero RGB/CMYK channel separation or
misregistration, no double-exposure ghosting, no blur on readable content -
anywhere, including transitions. Lettering renders as a crisp single layer
exempt from post. The comic feel comes from halftone, ink edges, flat color,
stepped motion, paper - never doubled edges.

## IP guardrail (S1)
Technique vocabulary only (halftone, cel shading, ink outlines, line boil,
speed lines, krackle). Zero Marvel/Sony/Spider-Man anything. Fonts OFL only.
The recurring original character is the cat - hidden in every issue.

## Project-specific verified facts (2026-07-02)
- Non-ASCII bytes in source files crash Turbopack source-map generation
  ("failed to convert rope into string") - source stays ASCII; test display
  strings before shipping them.
- r3f-perf is banned (its dist embeds a binary WOFF in an .mjs - same bug).
  PerfHUD is a local rAF meter.
- Velocity for boil/speed-lines derives from per-frame t deltas in
  PostPipeline, NOT ScrollTrigger.getVelocity (stale after scroll settles).
