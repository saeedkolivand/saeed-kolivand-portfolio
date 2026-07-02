# PLAN.md - PANEL JUMP build state

Session protocol (S0.9): one phase per session. Kickoff every session with
/run-phase. State = SPEC.md + this file + DECISIONS.md + git log.

## Phase 0 - Engine + print pipeline skeleton -- DONE (2026-07-02)
- [x] Tooling: DevTools MCP + Context7 registered (live next session);
      CodeGraph + Graphify indexed; post-commit freshness hook
- [x] Agent infrastructure: 6 agents, 5 commands, 2 skills, CLAUDE.md (19 lines)
- [x] Hardening loop: kickoff research workflow (6 topics, 40 date-stamped
      rules with sources) baked into agent/skill files
- [x] Versions pinned (DECISIONS.md); Next 16 + React 19 + fiber 9.6 scaffold
- [x] Lenis -> ScrollTrigger -> t (Zustand); pointer + reduced-motion + quality
- [x] ShotDirector (pose lerp, snap-on-cut, deadbanded gutters, hysteresis,
      pointer parallax); 12 placeholder sets, 2 shots each, labeled, tinted
- [x] PostPipeline: one composer, PrintEffect (mono/halftone/ink-edge/paper/
      grain/vignette/impact) + TransitionEffect, per-issue recipe cross-fade
- [x] Transitions: hard cut (page blink), whip, dot-zoom + snapshot pool
- [x] useSteppedClock equivalent (stepTime/stepNoise); demo cube on 2s
- [x] Beat engine + demo impact beat (flash-budget guarded); intensity in registry
- [x] Gate: see DECISIONS.md 2026-07-02 (2 self-reported items -> re-trace
      with DevTools MCP at Phase 1 gate)

## Phase 1 - Vertical slice: Cover + Issues 1-3 fully real -- DONE (2026-07-02)
- [x] Cover: printed cover (masthead SAEED KOLIVAND, price gag, barcode),
      attract mode, parallax break, crash-through-cover transition
- [x] Noir: hatched B&W + dark-paper polarity fix, instanced rain, CMYK
      color window (zero-RT depth-reconstruction mask), 4 S0.8 shots,
      cat leap motivated cut
- [x] Title-drop beat (authored speed, re-arm verified) + whip smear
- [x] Desk: cat landing continuity, RT 3-panel composite (3->2 ladder),
      keycap CLACKs, dot-bat motivated dot-zoom
- [x] Neon: code city, krackle, power-on cascade (10-ring, scrub-safe) + beat
- [x] Lettering layer post-exempt (DOM + Hud pool), onomatopoeia pool (GC-clean)
- [x] Gate: all 12 checks PASS via DevTools MCP (1 fix loop);
      Phase 0 self-reported items re-traced closed; see DECISIONS 2026-07-02
- [x] Asset prompt queued: assets/prompts/noir-window-figure.md
- Ships as PR (new workflow): branch phase-1-vertical-slice

## Phase 2 - Framework hardening
Full transition library (page-flip, tear, panel-wipe, match-cut, stamp),
recipe API extraction, balloon/word pooling, snapshot pool generalization,
jaw-drop trigger helper. Gate: new issue = component + registry entry + recipe.
Also: scroll pacing pass (user 2026-07-02: one wheel scroll moves scenes too
fast) - grow the 1200vh ScrollProxy spacer and/or tune Lenis duration/
wheelMultiplier; pure t-space means zero scene re-authoring; user judges feel.
Also: SceneManager mount latency on discrete deep jumps (gate 2026-07-02:
~1s cream blank jumping straight into neon; continuous scrub unaffected by
active+/-1 premounts) - premount on large t deltas or cheap loading treatment.
Also: extract shared CatModel component (user 2026-07-02: no more
shapes-taped-together cats) from the approved cover/desk cats - organic
primitives, palette + pose + material-mode params - before Issues 4-11 reuse
the mascot.

## Phase 3 - Issues 4-11, one commit each (styled placeholders -> real)

## Phase 4 - Sound (all synthesized; Tone.js pre-approved) + polish

## Phase 5 - Print Edition + accessibility (do NOT skip)

## REQUIRED_INPUT still empty (never blocks)
blogUrl (blog command hidden), resumePdf (resume prints "out of stock" gag).
