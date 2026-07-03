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

## Phase 2 - Framework hardening -- DONE (2026-07-02)
- [x] Transition library complete: native panel-wipe/paper-tear/page-flip/
      stamp/dot-match/ink-flood (modes 5-10) + in-shader pre-print polish for
      crash-through/stamp (closes PR #22 ruling 3). Fallback map remainder:
      title-drop->whip (beat by design), panel-portal->panel-wipe (scene work)
- [x] printRecipe() one-object recipe API; RECIPES byte-identical rewrite
- [x] PopPool<T> generic pooled lettering/balloons (onomatopoeia migrated;
      Issue 8 balloons / Issue 11 panels build on it)
- [x] snapshots.retain/release/isRetained - snapshot pool requestable by any
      consumer; RT budget rules intact
- [x] registerJawDrop() declarative beat helper (hysteresis + flash budget
      centralized); title-drop + neon-cascade migrated
- [x] Scroll pacing: SPACER_VH=2400, WHEEL_MULTIPLIER=0.7 (docs-verified
      levers; ~0.48x t per wheel notch); user-tunable named constants
- [x] Deep-jump fix: JumpCover paper-dot screen, sync paint + double-rAF
      reveal; no cream blank, re-jump idempotent
- [x] CatModel extraction (pose x mode x palette x rig); cover + desk
      migrated constant-identical; noir cat deliberately left (dimensional
      prop, approved leap framing risk)
- [x] Live user fixes: noir shares 0.30/0.15/0.35/0.20 -> 0.35/0.23/0.22/0.20
      (wide->close travel +40%); caption fades 0.18 -> 0.30 in/out
- [x] Gate: 10/10 PASS (DevTools MCP, zero fix loops); gate proof: test issue
      = 1 component + 1 registry row + 1 recipe, then deleted. Advisory: 58ms
      one-off mount hitch t~0.172 (0.2% frames) - perf-profiler if it worsens
- Ships as PR: branch phase-2-framework-hardening

## Phase 3 - Issues 4-11, one commit each -- DONE (2026-07-03)
- [x] Wave 0: all Issue 4-11 copy seeded (issueCopy), GitHub contributions
      endpoint verified + baked (real data, deterministic starfield fallback)
- [x] Issue 4 Origin (gate 9/9 + drift-gutter fix), 5 Press (10/10),
      6 Newsprint (9/9 + pinned KRAKA-THOOM fix), 7 Screentone (10/10 after
      2-attempt settle-determinism fix loop: ScrollProxy velocity latch +
      PrintEffect boil-modulated Sobel radius), 8 Pop (10/10), 9 Sketchbook
      (10/10), 10 Spread (10/10 after SpreadCat palette fix), 11 Terminal
      (10/10 incl. full-journey console smoke)
- [x] User-directed mid-phase: CatModel v2 organic redesign -> Harley
      golden-tabby mascot (user's real cat); user-generated art integrated:
      noir window, origin kid + Cologne panels, newsprint Harley press
      photo, back-cover Harley walk-off; title card scroll-anchored;
      noir/scroll pacing follow-ups; real GitHub projects woven into content
- [x] Framework survived the letter of the Phase 2 gate: every issue landed
      as component + registry row() + printRecipe (+ its own shots.ts)
- [x] All gates via agent-browser CLI fallback (chrome-devtools MCP
      disconnected mid-phase): trace/FPS clauses self-reported per S0.6 -
      formal DevTools re-trace queued for the Phase 4 gate
- Queued to Phase 4: meowCount consumer (synth meow on cat click - counter
  is write-only app-wide); isolated ~60ms single-frame mount hitches
  (t~0.172 desk, back-cover beat) if they worsen on low tier
- Queued to Phase 5: diegetic canvas buttons (newsprint GITHUB/LIVE DEMO,
  press CTA is DOM already) need DOM/a11y exposure; terminal panels
  spawn partly off-frame at play camera (legible, polish)

## Phase 4 - Sound (all synthesized; Tone.js pre-approved) + polish

## Phase 5 - Print Edition + accessibility (do NOT skip)

## REQUIRED_INPUT still empty (never blocks)
blogUrl (blog command hidden), resumePdf (resume prints "out of stock" gag).
