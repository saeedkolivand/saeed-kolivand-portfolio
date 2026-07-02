# DECISIONS.md (append-only)

## 2026-07-02 - Kickoff + Phase 0

### Version pinning (S0.2)
Resolved from the npm registry and pinned exact:
next 16.2.10, react/react-dom 19.2.7, three 0.185.1, @react-three/fiber 9.6.1,
@react-three/drei 10.7.7, @react-three/postprocessing 3.0.4, postprocessing
6.39.2, gsap 3.15.0, @gsap/react 2.1.2, lenis 1.3.25, zustand 5.0.14,
framer-motion 12.42.2, tailwindcss 4.3.2, typescript 6.0.3 (user-set; I had
pinned 5.9.3, an external edit bumped it - kept, builds clean),
@types/three 0.185.0. All co-install cleanly.

### Tooling (S0 step 0, S0.11)
- Chrome DevTools MCP + Context7 MCP were NOT preinstalled; added both via
  `claude mcp add` to local config. MCP servers register for FUTURE sessions;
  this session's gates used the agent-browser CLI (screenshots, eval, console,
  rAF FPS sampler) as the S0.6 fallback -> Phase 0 gate marked self-reported
  where it says so below; re-verify with DevTools traces in the next session.
- CodeGraph and Graphify exist as CLIs on this machine, not as registered MCP
  servers. Ruling: CLI use satisfies S0.11 (same engine as the MCP tools -
  codegraph query/explore/node, graphify query/path/explain). Tool surfaces
  recorded: `codegraph init|index|sync|status|query|explore|node|files`;
  `graphify update|query|path|explain|diagnose`. Agents get them via Bash in
  their allowlists instead of mcp__codegraph__* (no server to point at).
- Both graphs built at kickoff: codegraph index OK; graphify 190 nodes /
  254 edges / 13 communities. Post-commit freshness hook installed
  (.git/hooks/post-commit, backgrounds `graphify update .` + `codegraph sync .`).

### Rulings
- Model routing: `fable` alias verified available (this session runs on
  claude-fable-5) -> issue-builder + shader-engineer set to fable, rest opus.
- GLSL lives in shaders/*.ts as template literals inside postprocessing
  Effect subclasses (no .frag loader config needed; the spec's shaders/ dir
  is kept, extension differs). Reasoning: zero build config, same isolation.
- Phase 0 transitions: cut/whip/dot-zoom implemented. TRANSITION_FALLBACK
  (lib/shots.ts) maps unbuilt S5 kinds to the nearest analog: crash-through/
  title-drop->whip; panel-wipe/panel-portal/stamp/paper-tear/page-flip/
  ink-flood/dot-match->cut (page-blink variant). Swapped in Phases 1-2.
- Whip = radial speed lines + settle streaks, NO directional smear yet:
  a smear samples the input buffer at neighbor texels and would make
  TransitionEffect the pass's single allowed CONVOLUTION effect; deferred to
  Phase 1 where it's designed in properly.
- Intra-issue shot boundaries also get gutters (0.08 x issue width) with whip
  - a raw pose jump is a banned unstyled cut (S1). Deadband auto-shrinks to
  width/4 on narrow gutters.
- Dot-zoom camera cut point p=0: the incoming issue is filmed for the whole
  gutter; the outgoing issue exists as its collapsing snapshot overlay.
  Snapshot is refreshed each frame while in the last 15% of a shot that exits
  through dot-zoom. If a scrub jumps past the tail (deep link, scrollbar
  yank), the overlay falls back to paper-color dots - designed, logged, cheap.
- Placeholder issues: ONE parameterized PlaceholderIssue component x 12
  registry entries (distinct tint, palette props, label, stepped cube, hidden
  clickable cat) instead of 12 files. Satisfies the S7 Phase 0 letter; real
  per-issue components arrive in Phases 1/3.
- Demo beat: impact-frame double pop at t=0.108 (title-drop gutter entry),
  GSAP timeline on fx.impact, requestFlash()-guarded, hysteresis 0.006.
- Scene background lerps toward the filmed issue's paper color (sets are
  boxed rooms; bg only shows during cuts).
- Velocity for boil/speed-lines is derived from per-frame t deltas in
  PostPipeline (smoothed, fast-attack/slow-decay), NOT ScrollTrigger
  getVelocity: that value goes stale after the last scroll event and left
  speed lines painted permanently (found via screenshot audit).

### Bugs found and fixed during the gate loop
- Turbopack build failure: "failed to convert rope into string / invalid
  utf-8" during merged-module source-map generation. Root causes: (1) my
  source files contained multi-byte chars (S, +/-, arrows in comments) - all
  source is now pure ASCII, enforced as a project rule; (2) r3f-perf's dist
  embeds a raw WOFF binary inside roboto.woff.mjs - dependency REMOVED,
  PerfHUD reimplemented as a ~15-line rAF FPS meter (?debug).
  turbopackScopeHoisting:false workaround tested and then reverted -
  unnecessary once both root causes were gone.
- tsconfig: next build rewrote jsx to react-jsx and added .next/dev/types
  include (Next 16 standard behavior; kept).

### Phase 0 gate result (self-reported via agent-browser; re-trace next session)
- Build: next build clean; tsc --noEmit clean (TS strict + noUncheckedIndexedAccess). PASS
- Console: no THREE/WebGL/shader errors (one benign THREE.Clock deprecation
  warning from fiber internals). PASS
- Recipes visibly differ per set: cover (warm halftone) / noir (B&W, dark) /
  desk (warm color dots) / neon (flat neon on black) / newsprint (coarse
  dots, spot red) / terminal (green ink) verified in screenshots. PASS
- Designed cuts while scrubbing: whip (intra + title-drop gutter) and
  dot-zoom (desk->neon) render; page-blink cut for fallback kinds. PASS
- Scrub determinism both directions: dot-zoom gutter at t=0.2175 approached
  from 0.165 and from 0.26 renders the identical dot frame. PASS
- Zero strobe at boundaries: deadband p-clamp in place; no flicker observed
  hovering near gutter edges. PASS (self-reported)
- FPS: rAF sampler 481 idle / 480 while scrolling cover->neon including
  transitions (uncapped headless-style Chromium; 60 target has ~8x headroom).
  PASS (self-reported - DevTools trace pending next session)
- Beat at authored speed + re-arm: BeatRunner code path verified + whip gutter
  screenshot at crossing; direct impact-frame capture is timing-dependent -
  DEGRADED-PASS (self-reported); formal check next session per gate-audit skill.
- Flash guard active (requestFlash gates the only flash source). PASS
- Agent roster + /run-phase + /gate + skills + CLAUDE.md (19 lines <= 60):
  present; every agent file carries date-stamped verified rules from the
  kickoff research workflow (6 topics, 40 rules, all with source URLs). PASS
- Graph MCPs: both CLIs answer queries; freshness hook installed. PASS
  (MCP-server registration adapted to CLI - see Tooling ruling.)

### Known deviations queued for Phase 1
- In-scene drei Text is affected by the post pipeline (S2.16 wants lettering
  exempt) - placeholder labels only; Phase 1 letters via a post-pipeline-
  exempt layer (drei Hud or DOM).
- Whip line coverage is aggressive at max intensity; tune when the real
  title-drop beat is authored.
- Cover is a generic placeholder room; Phase 1 builds the real cover +
  attract mode.
