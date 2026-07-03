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

## 2026-07-02 - Phase 1

- Phase 1 rulings batch: (1) CodeGraph DOES ship an MCP server (codegraph
  install, v1.2.0) - registered via project .mcp.json (codegraph serve --mcp)
  + .claude/settings.json permission/hook, 2026-07-02; pending user approval,
  live next session; CLI via Bash remains the in-session path. Graphify
  re-checked: no MCP server subcommand exists - CLI/skill ruling stands.
  Adding mcp__codegraph__* to issue-builder/shader-engineer/perf-profiler
  allowlists was DENIED by the permission classifier (self-modification) -
  queued for user-approved edit. (2) TransitionEffect is now the pass's
  single CONVOLUTION effect (whip directional smear, 8 dithered taps along
  uWhipDir; crash-through mode 4); taps are pre-print, re-graded via
  uSmearMono. (3) Color window = world-space rect via per-pixel depth
  reconstruction (shaders/colorWindow.ts channel), zero RTs; mask-texture
  option rejected to protect the RT budget of 3. (4) Crash-through chromatic
  punch dropped - S2.16 bans channel separation; zoom punch is single-layer
  resample. Missing cover snapshot falls back to flat cover-paper fragments
  (same pattern as dot-zoom). (5) Timeline numbers moved to leaf
  issues/timeline.ts (registry re-exports) so per-issue shots.ts import
  ranges without an import cycle; plumbing touched SceneManager/ShotDirector/
  fx/globals.css as required glue. (6) Neon recipe grain 0.06->0.03, paperTex
  0.1->0.05: 10Hz grain flicker on max-contrast black edged toward strobe
  (S2.16 tune). Reasoning: each is the simplest option that passes its gate
  check under the locked S2/S5/S2.16 rules, logged per S0.1.
- CORRECTION to (1), user-caught: Graphify DOES ship an MCP server - it is a
  separate binary `graphify-mcp` (python -m graphify.serve, stdio/http), not
  a `graphify` subcommand, which is why the --help sweep missed it. Registered
  in .mcp.json pointed at graphify-out/graph.json (mirrors the working
  ai-job-hunter-assistant-app config); pending user approval alongside
  codegraph, live next session. CLI remains the in-session path. S0.11 agent
  allowlist additions (mcp__graphify__* -> issue-builder) still queued behind
  the same classifier denial as codegraph's.
- User authorization 2026-07-02: the classifier-blocked edits were explicitly
  approved and applied - mcp__codegraph__* added to issue-builder/
  shader-engineer/perf-profiler tools, mcp__graphify__* to issue-builder,
  both wildcards to .claude/settings.json permissions.allow. S0.11 agent
  access is now fully wired (live once the user approves both .mcp.json
  servers).
- Workflow change (user directive, overrides S0.9 "commit per phase" to
  main): every phase now lands as a phase branch + PR, reviewed on demand by
  .github/workflows/claude-review.yml (clone of ai-job-hunter lane A1:
  owner-only "@claude review" comment trigger, TAG mode, opus, PANEL JUMP
  contract baked into --append-system-prompt). Inert until the
  CLAUDE_CODE_OAUTH_TOKEN secret is set (claude setup-token). CLAUDE.md rules
  line updated accordingly.
- Wave 3 scene rulings (issue-builders, 2026-07-02): Cover is ONE compiled
  shot (drift-then-crash ease) instead of hold+crash - compileSegments
  hardcodes intra-issue gutters to whip, and whip smear over static readable
  cover lettering breaks S2.16; cover lettering deliberately INSIDE the post
  pipeline (spec-intended print look). Noir: shot-4 target racks cat->window
  ease-in-cubic so the p~0.8 leap crosses frame (pose data only); rain dashes
  + window glow are unlit meshBasicMaterial (flat ink, toon reserved for lit
  surfaces); three 0.003 intra whip gutters carved from RANGES[1], S0.8
  shares apply to the remaining span. Desk: THUMP/PADD words filtered from
  the cat onomatopoeia pool instead of new content.ts entries (content-scribe
  owns that file); RT PanelWall mounts/unmounts at whip cutPoints +/- margin
  so render-target warm-up is never on-screen; low quality tier drops
  keyboard RT (3->2 live RTs). Neon: beats.ts imports NEON_CASCADE_T from
  issues/03-neon/shots.ts (single source of truth for the cascade trigger,
  no cycle); cascade quantized to 10 radial rings as the "block-by-block on
  2s" reading (scroll-space steps, not clock time). Package renamed
  panel-jump -> saeed-kolivand-portfolio (user directive: match repo name);
  lockfile regenerated, no dependency versions changed (S0.2 intact).

### Phase 1 gate result (Chrome DevTools MCP, formal - no self-reported items)
- Attempt 1: 10 PASS / 1 DEGRADED / 1 FAIL. Root cause of both failures:
  noir dark-paper tonal wash (halftone/hatch mapped darkness->ink assuming
  light paper; near-black subjects bleached to pale ink #F5F1E8).
- Fix loop attempt 1 of 5 (3 parallel agents) + re-audit: ALL 12 CHECKS PASS,
  no regressions. Highlights: slice 0-0.31 seamless both directions at
  steady 60 FPS (worst frame 16.9ms); dot-zoom scrub-deterministic; title
  drop authored ~1.1s velocity-independent with verified hysteresis re-arm;
  3 live RTs at 59-60 FPS (single 33ms first-mount hitch, absent on repeat);
  flash budget 2 gated impacts; onomatopoeia pool 0 frames >20ms over 5s of
  CLACK oscillation; console clean. Phase 0 self-reported items (FPS trace,
  beat timing) formally re-traced and closed: both PASS.
- Fix rulings: (1) PrintEffect derives dark-paper polarity from uPaper
  luminance in-shader (no recipe field; cross-fades smoothly; screentone/
  press/pop/spread/terminal inherit correct polarity for free). (2) Noir
  leap k-window 0.72-1.0 with flatter arc + shot-4 from-target moved to the
  crouch spot (second latent cause: crouch dropped out of frame at p .75-.8);
  "leaps at p~0.8" still canonically true. (3) Desk cat restaged at monitor
  with full character pass; S6 asset prompt NOT queued (procedural reads as
  deliberate). (4) Noir window figure = backlit dev silhouette; S6 upgrade
  prompt queued at assets/prompts/noir-window-figure.md -> target
  public/images/noir-window-figure.png (user generates at leisure).
- User-directed post-gate, pre-commit (screenshot-verified): cover masthead
  PANEL JUMP -> SAEED KOLIVAND (hero-titled cover; codename stays internal);
  cover cat rebuilt as connected flat-print silhouette matching the Desk cat
  identity; burst restyled as 16-wedge sunburst; masthead auto-splits
  kicker/main clear of the price box. Root bugs found in the process:
  (a) attract breathe sine drove layer z negative, sinking art behind the
  opaque paper board half of every cycle; (b) .pj-breathe CSS never applied
  under Turbopack - breathe now rAF-driven, dead CSS rule deleted;
  (c) per-layer breathe phases could invert layer z-order, slicing the cat
  across the burst plane - single shared breathe phase with monotone
  amplitudes, z-order invariant for all t; shadow joined the cat group; tail
  pivot + leg roots moved inside body silhouettes (fix rounds: 2 of 3 S0.8
  framing iterations used).
- Queued to Phase 2 in PLAN.md: scroll pacing pass (user: too fast per
  wheel), deep-jump mount blank (~1s into neon), shared CatModel extraction.
- PR #22 Claude review (advisory-only, no blocking findings; all engine
  invariants verified). Notes adopted as standing rulings: (1) S5b.2
  "no adjacent equal intensity" - noir(2)/desk(2) adjacency is CORRECT: the
  title-drop beat (intensity 5) is the authored separating peak between
  them; future gates must treat gutter beats as intensity rows, not flag
  this pair. (2) flashBudget counts requestFlash() calls, not individual
  inversions - a granted beat may emit 2 inverts (~0.16s apart); fine at
  current cadence, re-audit if beats ever cluster within 1s. (3) Crash-
  through briefly shows the incoming issue pre-print (inputBuffer sample);
  cosmetic, settle resolves - candidate polish in Phase 2 transition
  library. (4) Neon diegetic drei-Text signs are environmental art, not
  "readable lettering" under S2.16 - whip smear may touch them; avoid
  centering a sign in frame at a whip gutter when authoring future shots.

## 2026-07-02 - Phase 2 (framework hardening)

- Transition library complete: TransitionEffect modes panel-wipe=5,
  paper-tear=6, page-flip=7, stamp=8, dot-match=9, ink-flood=10; all pure
  f(uP), single-layer, zero new RTs; TransitionEffect remains the pass's
  single CONVOLUTION effect. New uniforms uSmearHalftone/uSmearScale/
  uSmearPaper feed pjtPrint(), an in-shader mono+halftone+paper approximation
  of PrintEffect applied to displaced taps - closes PR #22 ruling 3
  (crash-through pre-print flash) at zero cost; stamp uses the same handoff.
- Fallback map remainder (reasoning logged in lib/shots.ts): title-drop->whip
  (the slam is an authored-time BEAT per S5b.3; the gutter only carries the
  whip) and panel-portal->panel-wipe (portal fly-through is scene/camera work,
  not a post op; nearest native analog for the Issue 4 exit). cutPoint now
  derives from usesSnapshot(): snapshot modes film incoming at p=0; cut/whip/
  ink-flood jump at 0.5 (ink-flood full-cover window p .375-.625 hides it).
- Scroll pacing (user 2026-07-02: too fast per wheel): docs-researcher
  verified Lenis 1.3.25 - lerp (default .1) and duration are mutually
  exclusive (lerp wins), neither changes distance-per-notch; spacer growth is
  the primary lever and survives reduced-motion. Applied SPACER_VH=2400 +
  WHEEL_MULTIPLIER=0.7 (named constants in ScrollProxy.tsx for feel-tuning);
  gate measured 0.478x t per notch vs the 1200vh baseline.
- Deep-jump blank fix: SceneManager premount window centers on an anchor
  state; on |active-anchor|>1 the new JumpCover paints an opaque target-paper
  + ink-dot screen synchronously (zustand subscribe, pre-React-commit), the
  target trio mounts one rAF later, reveal after a double-rAF so the first
  compile frame lands under the cover; opacity-only .25s fade, instant under
  reduced motion, mid-fade re-jump idempotent (S2.16 clean).
- CatModel extraction: components/CatModel.tsx, params pose (sitting/crouch/
  walking/leaping) x mode (flat/toon) x palette x optional rig refs; cover +
  desk cats migrated with every numeric constant preserved (silhouette
  equivalence re-verified visually at the gate). Noir's leaping cat NOT
  migrated: it is a dimensional prop rotated ry 0->1.35 (a flat build
  vanishes edge-on) and its proportions were NDC-verified against the
  approved shot-4 leap framing - left byte-untouched. Unused pose presets are
  authored-but-unused until Issues 4-11.
- Framework APIs: printRecipe({paper, ink, ...overrides}) with
  RECIPE_DEFAULTS (RECIPES rewritten byte-identical); PopPool<T> + popScale()
  zero-alloc pop pool (onomatopoeia migrated, Issue 8 balloons / Issue 11
  panels build on it); snapshots.retain/release/isRetained (tail-capture +
  evict-proof, snapshots are not RTs so the RT budget is untouched);
  registerJawDrop({id, t, flash?, animate?, hysteresis?}) with central
  hysteresis (default .006) + requestFlash budget - title-drop and
  neon-cascade migrated onto it with identical envelopes; registry row()
  makes an issue entry self-contained (component + recipe + shots).
- Live user fixes during the phase: noir shot shares 0.30/0.15/0.35/0.20 ->
  0.35/0.23/0.22/0.20, share taken from the static dolly dwell only; shot-4
  t-range bit-identical (leap invariants untouched); wide->close travel
  +40% t. Noir caption fades 0.18 -> 0.30 in/out (~40% plateau), pure f(t).

### Phase 2 gate result (Chrome DevTools MCP, formal)
- 10/10 PASS, zero fix loops: console clean full scrub; all 7 new/polished
  transitions styled + scrub-deterministic both directions; S2.16 comfort
  (no chromatic split, no strobe, lettering crisp); CatModel silhouettes read
  as the approved characters; JumpCover verified incl. mid-fade re-jump;
  pacing 0.478x per notch; noir shot-4 leap + caption plateaus verified;
  title-drop hysteresis re-arm (fireCount=2) + neon cascade fire; perf median
  2.1ms / p95 2.5ms / 99.8% frames under 16.7ms; flash budget sole-path
  verified (2 gated jaw-drops per full scrub).
- Gate proof of the Phase 2 criterion: throwaway test issue rendered with
  full print treatment + panel-wipe entry from exactly ONE component file +
  ONE registry row + ONE printRecipe(), then deleted completely.
- Advisory (non-blocking): reproducible single-frame ~58ms scene-mount hitch
  at t~0.172 during fast desk-region scrubbing (0.2% of frames, warm-pass
  confirmed one-off) - hand to perf-profiler if it worsens on the low tier.

## 2026-07-03 - Phase 3 (Issues 4-11)

- Per-issue cycle protocol: staged authoring (scene files only, registry
  row held) pipelined behind the previous issue's gate; registry go-signal
  after each commit keeps every "one commit each" build-clean. Zero
  registry conflicts across 8 issues.
- Determinism rulings (three catches, one root fix): sayWord default seed
  was Math.random - Issues 6 and 7 both shipped nondeterministic beat words
  before the default became an FNV word-hash (lib/onomatopoeia.ts); rule:
  NO Math.random on any scrub-fired path, fixed or t-derived seeds only.
- Issue 7 gate check-4 fix chain (2 attempts): camera/shot layer exonerated
  bit-exactly (pose already pure f(t), no hysteresis in ShotDirector);
  real defects were (a) store velocity latching its last sign at rest
  (ScrollProxy: hard 0 after 200ms quiet), (b) PrintEffect ink-edge Sobel
  radius modulated by uBoilJitter, re-rolling the edge detector every boil
  step (radius pinned 1 texel, boil position-only; PostPipeline velocity
  residual snaps below 1e-3). Settled whip-gutter variance 26-33% -> 0.2-0.5%.
- Origin quiet-valley ruling: "drift" transition kind added (renders
  nothing; legal ONLY with continuity-authored poses per S1) - origin
  shots 1-3 are C1-continuous; full-frame whips banned inside intensity-1.
- Title-drop card is a scroll-anchored opacity window (t 0.103-0.135, 30%
  edge fades), never a timer; the beat contributes only the slam transform
  + gated flash; deep jumps + reduced motion show it resting (user
  directive 2026-07-03).
- Fallback map is EMPTY of accidental fallbacks; remaining by-design:
  title-drop->whip (beat), panel-portal->panel-wipe (scene work).
- Harley batch (user directives): CatModel v2 organic shapes (approved
  reference) + default palette = Harley, the user's real cat (fur #A9743C,
  cream ruff/socks, amber eyes, pink nose, 3 toon stripe caps); palette-law
  scenes unaffected (noir silhouette, neon ink, screentone spot-yellow);
  Issue 10 SpreadCat is HARLEY pulled toward the row-10 gold accent
  (#D9A44F fur, gold tail tip) - full brown read muddy on #05060D.
  User-generated art integrated via shared ArtPanel (sRGB, UV-trim,
  dispose): noir window pane, origin kid + Cologne panels, newsprint
  Harley halftone press photo (+ in-scene cutline "HARLEY. EDITOR-AT-
  LARGE. UNPAID." - corner slip, full-width strip lost the name behind FG
  sheets), back-cover phosphor Harley walk-off (baked CRT-card border
  KEPT as diegetic; trimming beheaded the tail). Persian donation word
  replaced by ASCII "KA-CHING!" (user directive to content-scribe).
- Issue 10 reduced motion: the unfold degrades to a gentle cross-fade -
  pages hold their final laid-out spread poses and fade in with the same
  staggered pure-f(t) driver (opacity only); ambient twinkle/drift freezes;
  the flash beat is skipped centrally by BeatRunner.
- SPREAD_RECIPE deviates from RECIPES[10] on grain .03 / paperTex .05 /
  boil .4: high-frequency flicker on a near-black world edges toward
  strobe (S2.16), same reasoning as the Neon Ink ruling of 2026-07-02.
- Terminal rulings: hidden response keys (blog-until-set, harley easter
  egg) answer when TYPED but get no card - VISIBLE_COMMANDS gates
  affordance only; unknownCommand prints + stepped flinch (words are the
  accessible path; flinch skipped under reduced motion); snapshot pool
  end-state is 10 permanently retained keys (LRU applies to unretained
  only - documented Origin/Spread design).
- Real projects (user-provided 2026-07-03) in content: projects export +
  newsprint ticker/secondary headline + terminal projects response
  (ai-engineering-hub, claude-usage-streamdeck-plugin,
  tokensaver-streamdeck-plugin, vocal-remover + flagship).

### Phase 3 gate results (agent-browser CLI fallback - chrome-devtools MCP
### disconnected mid-phase; trace/FPS clauses self-reported per S0.6;
### formal DevTools re-trace queued for the Phase 4 gate)
- Issue 4: 9/9 (advisory quiet-valley whip fixed pre-commit). Issue 5:
  10/10. Issue 6: 9/9 (random beat word pinned pre-commit; canvas-button
  a11y queued to Phase 5). Issue 7: 9/10 -> settle-determinism fix chain
  -> closed. Issue 8: 10/10. Issue 9: 10/10. Issue 10: 9/10 -> SpreadCat
  palette fix -> closed. Issue 11: 10/10 incl. full-journey 0->1 console
  smoke on a fresh server.
- Every issue: shots.md first (S0.8), <=3 iterations per shot, motivated
  entrances/exits, one designed jaw-drop, cat placed, disposes clean,
  reduced-motion + low-tier paths verified, zero new live RTs anywhere.
