# PANEL JUMP — A Comic-Book Portfolio (Build Spec, Comic-Verse Edition)

> **How to use this document (read first, Claude Code): AUTONOMOUS MODE.**
> This spec is designed for unattended end-to-end execution — the user will not answer questions mid-run. §0 is the operating manual; every ambiguity is resolved by a locked decision, a §0 table, or the nearest specced analog — **never by asking**.
> 0. Set up the free tooling in **Tooling** (Chrome DevTools MCP + Context7 MCP). All gates are machine-checked through them.
> 1. Read the whole document, then read §0 twice.
> 2. Write your plan to `PLAN.md`; append every ruling you make to `DECISIONS.md`. These files + git history are the state that carries across sessions.
> 3. Execute phases strictly in order. A gate passes when its machine checks pass — verify with screenshots/traces, iterate until green (max 5 attempts per failing check, then the degradation ladder, §0.6), then **proceed without approval**.
> 4. **Commit after every phase** and after every gate-relevant fix. One phase per commit scope.
> 5. Resolve and pin exact dependency versions at kickoff (§0.2); add nothing beyond the locked stack.
> 6. Raster images and sound files must **never block**: v1 is 100% procedural (§6, Phase 4). Queue optional upgrade prompts to `assets/prompts/` and keep moving.
> 7. At each gate append to `DECISIONS.md`: what was built, check results, FPS from a DevTools trace, flash/comfort audit result, and what's stubbed or degraded.
> 8. The hard stops in §0.7 are the ONLY reasons to halt and ask the user anything.

---

## Tooling Claude Code should use (all free — set up before Phase 0)

**Chrome DevTools MCP — required.** `claude mcp add chrome-devtools npx chrome-devtools-mcp@latest` (Node 20.19+). Used at every gate for: performance traces while scrolling (the 60 FPS check is measured, not asserted), CPU/network throttling to test the low tier, console with source-mapped stack traces for shader/WebGL errors, and **screenshots to verify each issue's art treatment actually reads as designed** — the accessibility tree is blind to `<canvas>`, so screenshots + console + traces are the feedback loop, never DOM snapshots.

**Context7 MCP — required.** Pull **version-specific** docs before writing against R3F (v9 / React 19), drei, current Three.js (postprocessing APIs shift between releases), GSAP + ScrollTrigger, or Lenis. This build leans hard on render targets, custom passes, and `onBeforeCompile` — exactly where stale training data hallucinates signatures.

Use **only one** browser MCP (Chrome DevTools). Do not add Playwright — its token-cheap accessibility snapshots are useless for a canvas.

**CodeGraph MCP + Graphify MCP — required (user-installed, already on this machine).** These are the project's structural memory and their use is mandatory, not advisory: §0.11 defines the binding rules, kickoff indexing, agent access, and freshness hooks. In short — precise structural questions go to CodeGraph, orientation and cross-document questions go to Graphify, and grep sweeps are a logged protocol violation whenever a graph query could answer.

**frontend-design skill — recommended**, applied to the DOM/UI layer (lettering, panels chrome, terminal, print edition) only.

**Project agent infrastructure — mandatory, self-built in Phase 0.** Claude Code creates its own subagents, slash commands, and skills for this project per §0.10, hardens them with internet research, and runs the whole build through them. The main session is a thin orchestrator; heavy context (spec sections, docs, screenshots) lives in agent contexts.

---

## 0. Autonomous execution protocol

### 0.1 Prime directive
Never ask, never stall, never silently skip. When something is ambiguous, resolve in this order: (1) a locked decision in §2, (2) a table in this section, (3) the nearest specced analog, (4) the simplest option that passes the gate. Log every ruling to `DECISIONS.md` with one line of reasoning. Questions to the user are a bug except under §0.7.

### 0.2 Version pinning at kickoff
Before Phase 0: resolve the current stable version of every locked dependency via Context7 / the npm registry, record the exact set in `DECISIONS.md`, and pin them in `package.json`. Never upgrade mid-project. If two locked libraries conflict at latest, pin the newest pair that co-installs and log it.

### 0.3 Global timeline (locked — total scroll length ≈ 1200vh)
Consecutive ranges deliberately do not touch: the space between one segment's end and the next one's start is that transition's **gutter** (§2.4) — dedicated scroll real-estate where the cut plays out and hysteresis lives. Standard gutters are 0.010 wide; the three showcase transitions (title drop, dot-zoom, page-flip) get 0.015.

| Segment | t range | Treatment | Intensity | Gutter after (width · transition) |
|---|---|---|---|---|
| Cover + attract | 0.000–0.030 | printed cover, parallax | 1 | 0.010 · crash-through-cover |
| Issue 1 · Noir | 0.040–0.108 | B&W hatched ink, one color window | 2 | 0.015 · title-drop beat + whip |
| Issue 2 · Desk | 0.123–0.210 | full-color halftone, warm | 2 | 0.015 · dot-zoom (cat-batted) |
| Issue 3 · Neon Ink | 0.225–0.305 | flat neon inks on black | 5 | 0.010 · panel-wipe |
| Issue 4 · Origin Page | 0.315–0.378 | floating panels, muted valley | 1 | 0.010 · panel-portal glide-through |
| Issue 5 · The Press | 0.388–0.478 | multi-style factory | 3 | 0.010 · stamp cut |
| Issue 6 · Newsprint | 0.488–0.566 | newspaper print | 3 | 0.010 · paper-tear |
| Issue 7 · Screentone | 0.576–0.656 | manga B&W + spot yellow | 4 | 0.015 · page-flip (world turn) |
| Issue 8 · Pop Print | 0.671–0.752 | oversaturated webcomic | 5 | 0.010 · whip |
| Issue 9 · Sketchbook | 0.762–0.838 | pencil→ink on paper | 2 | 0.010 · ink-flood to black |
| Issue 10 · The Spread | 0.848–0.930 | cosmic krackle + snapshots | 5 | 0.010 · dot-match (star → cursor) |
| Issue 11 · Letters Page | 0.940–1.000 | CRT × halftone terminal | 1 | — (back cover) |

The ranges + gutters chain exactly to 1.000. The registry derives each gutter from consecutive ranges; beat triggers fire at gutter entry; hysteresis bands and internal shot ranges derive from these numbers. Do not re-balance them.

### 0.4 Palettes & type (locked — do not invent colors; ±10% lightness allowed for toon steps)
| Issue | Paper/bg | Ink | Accents |
|---|---|---|---|
| Cover | #F2EAD9 | #201D18 | #E2574C, #2BB3A3 |
| 1 Noir | #0E0E10 | #F5F1E8 | window only: #FFB347, #FF4FA3, #39D0D8 |
| 2 Desk | #F6EFE3 | #1C1B1A | #F5A623, #2BB3A3, #E2574C |
| 3 Neon Ink | #060608 | #EDEDF2 | #00E5FF, #FF3D9A, #B7FF2E, #FF9E1F, #8A7DFF |
| 4 Origin | #EDE7DB | #2A2722 | #7C93B2, #C97B5A |
| 5 Press | #23272E | #E8E4DC | React #4FC3F7, TS #3B82C4, Rust #D9772F, AI #9D6BFF |
| 6 Newsprint | #EAE3D2 | #221F1A | spot red #C63D2F |
| 7 Screentone | #101014 | #E8E8E8 | spot yellow #F6C243 |
| 8 Pop Print | #1B0F2E | #F4EFFF | #FF3D81, #29E0FF, #FFD32E |
| 9 Sketchbook | #F7F2E7 | graphite #5A564E → ink #232019 | wash #6FA8DC |
| 10 Spread | #05060D | #EAF2FF | #FFD166, #7C5CFF, contribution green #39D353 |
| 11 Terminal | #0B0F0C | #33FF66 | amber #FFB000 |

Type (Google Fonts, OFL): display lettering **Bangers**; handwriting **Caveat**; mono **JetBrains Mono**; body **a system stack**. If a font fails to load twice, fall back to the system stack and log it.

### 0.5 Content pack — seed `lib/content.ts` with exactly this; never ask for content
```ts
export const content = {
  name: "Saeed Kolivand",
  role: "Senior Frontend Developer",
  tagline: "Frontend engineer building AI-powered tools.",
  location: "Germany",
  stack: ["React","TypeScript","Next.js","Rust","Tauri","Node.js","GraphQL","AI"],
  timeline: ["Started Programming","University","First Job","Moved to Germany",
             "Senior Frontend Engineer","Open Source","AI Job Hunter","Streaming"],
  flagship: {
    title: "AI Job Hunter",
    blurb: "Local-first desktop app: covers 16 job boards, writes the cover letters, does everything but hit submit.",
    features: ["AI agents","Resume & cover-letter generation","Semantic search",
               "Local AI (Ollama)","Rust backend","React frontend"],
  },
  streaming: { platforms: ["Twitch","YouTube"], tools: ["OBS","Stream Deck"] },
  terminalCommands: ["about","projects","experience","skills","contact",
                     "resume","github","linkedin","blog"],
} as const;

// REQUIRED_INPUT — filled and URL-verified; empty fields hide their affordance, log, continue:
export const links = {
  githubUrl: "https://github.com/saeedkolivand",   // bakes the contribution star chart
  linkedinUrl: "https://www.linkedin.com/in/saeedkolivand/",
  liveDemoUrl: "https://aijobhunter.app",
  email: "saeedkolivand1997@gmail.com",  // render assembled at runtime (anti-scrape), never as plain text in HTML
  blogUrl: "",       // optional — `blog` command hidden until set
  resumePdf: "",     // path in /public; empty ⇒ `resume` prints an "out of stock" gag page
};
```
Contribution chart: if `githubUrl` is set, fetch the public contribution data **once at build time** (the public profile's contribution SVG needs no token; GitHub's GraphQL does — prefer the former) and bake JSON; if empty or the fetch fails, generate a procedural starfield in the same grid rhythm. Never fetch at runtime, never block on it.

### 0.6 Degradation ladders (apply in order after 5 failed fix attempts; log each rung)
- **Perf < 60 FPS (trace):** halve instanced particle counts → live RT panels 3→2→snapshots-only → dpr 2→1.5 → disable grain pass → boil rate 12→8 fps → halftone to cheap threshold variant. Stop at the first rung that passes.
- **Shader fails to compile:** swap in the flat fallback recipe (toon + edge only) for that issue; queue the shader for one retry in the next session.
- **A gate check still fails after the ladder:** mark it **degraded-pass** with justification in `DECISIONS.md`, continue, and list it prominently in `REPORT.md`. Wedging is worse than degrading.
- **Chrome DevTools MCP unusable after 3 documented fixes:** continue using r3f-perf numbers + Next build checks; flag all affected gates as self-reported in `REPORT.md`.

### 0.7 Hard stops — the only reasons to halt
Unrecoverable environment failure only: npm registry unreachable, git repo corrupt, disk full. Everything else is a ladder or a logged ruling.

### 0.8 Shot authoring procedure (Issues 4–11)
Before coding an issue, write `issues/XX-*/shots.md` in this exact format (Issue 1 shown as the canonical example), then build, screenshot every shot via DevTools, check §5b.4 + §2.16, iterate ≤3 per shot, log:
| # | kind | lens | share of issue | framing |
|---|---|---|---|---|
| 1 | hold | 24mm | 0.30 | low dutch from street; window upper-third; FG railing, MG rain, BG facade |
| 2 | whip | 28mm | 0.15 | vertical whip up the facade; speed lines |
| 3 | dolly | 50mm | 0.35 | slow push to window; cat silhouette enters frame-left on rooftop FG |
| 4 | crash | 85→35mm | 0.20 | crash to window; cat leaps frame-right at p≈0.8 — motivated cut |

### 0.9 Session protocol & final report
One phase per session (fresh context beats compaction on a build this size). Kickoff prompt, verbatim, every session: *"Read SPEC.md, PLAN.md, DECISIONS.md and the git log. Execute the next incomplete phase under the Autonomous Execution Protocol (§0). Do not ask me anything; §0.7 hard stops only."* — installed as `/run-phase` in Phase 0, so from then on each session is just that one command. Pre-allowlist permissions for the project directory so the run is genuinely unattended. After Phase 5, write `REPORT.md`: every gate result, all degraded-passes, the queued `assets/prompts/` upgrade list, empty REQUIRED_INPUT fields, and a 10-item taste-pass checklist for the user's single post-run review.

### 0.10 Project agent infrastructure (build in Phase 0, before any feature code)

Claude Code builds and uses its own delegation system: `.claude/agents/`, `.claude/commands/`, `.claude/skills/`, and a `CLAUDE.md` orchestrator. The main session coordinates, integrates, and commits — it does not build, audit, or research in its own context.

**Model routing (locked):** reasoning-heavy agents run `model: fable` (Fable 5); everything else runs `model: opus`. At kickoff, verify the `fable` alias is available to this account (via `/agents` or a trivial test invocation); if it isn't, set those agents to `opus` with `effort: high` and log the substitution in `DECISIONS.md`.

**Agent roster** (least-privilege `tools:` allowlists; description fields written trigger-rich — "MUST BE USED for…" — so auto-delegation fires):
| Agent | Model | Job | Returns (bounded) |
|---|---|---|---|
| issue-builder | **fable** | build/modify a scene, camera system, or engine module per its spec section | files changed + self-check, ≤20 lines |
| shader-engineer | **fable** | all GLSL: passes, transitions, `onBeforeCompile`, comfort-rule compliance | compile status + uniform docs, ≤20 lines |
| gate-auditor | opus | run gates via Chrome DevTools MCP: screenshots, traces, console; checks §5b.4, §2.16, flash budget | pass/fail table ONLY — screenshots never leave its context |
| perf-profiler | opus | traces + owns the §0.6 degradation ladder | rung applied + before/after FPS |
| docs-researcher | opus | Context7 + web verification of any API before it's coded against; `memory: project` so findings compound | ≤15-line date-stamped notes with source URLs |
| content-scribe | opus | `content.ts`, Print Edition copy, terminal text | diffs only |

**Slash commands** (`.claude/commands/`): `/run-phase` (the §0.9 kickoff, formalized), `/gate` (invoke gate-auditor for the current phase), `/shot-review <issue>` (per-shot screenshot audit against §5b.4), `/decision "<text>"` (append to DECISIONS.md), `/integrate-assets` (scan `assets/prompts/` for delivered images, swap in, verify).

**Skills** (`.claude/skills/`): `panel-jump-conventions` (§2 locked decisions, §5 transition specs, §5b rules, comfort rule) preloaded into issue-builder and shader-engineer via their `skills:` frontmatter field; `gate-audit` (checklist procedures + how to drive DevTools MCP for traces/screenshots) preloaded into gate-auditor.

**Hardening loop (the research requirement):** every agent and skill is drafted, then hardened — docs-researcher verifies each embedded technical claim against current sources (Context7 for R3F v9 / drei / three / GSAP / Lenis APIs; web search for Claude Code frontmatter syntax and known integration gotchas like Lenis + ScrollTrigger ordering) and the findings are baked back into the agent/skill files as **date-stamped rules** ("verified 2026-07: …"). Re-verify once per phase for any API the phase touches. Optionally run skill-creator evals on the two skills.

**CLAUDE.md — the orchestrator contract.** It is prepended to the main session AND to every custom subagent, so every line is paid for many times over: hard cap **60 lines**, routing table only, no prose duplication of the spec. Seed it with exactly this shape:
```md
# PANEL JUMP — Orchestrator
You coordinate. You never build, audit, or research in this context — delegate, integrate the bounded report, commit.

State: SPEC.md (§0 is law) · PLAN.md · DECISIONS.md (append-only) · git log
Load into main context ONLY §0 + the current phase section; agents read their own spec sections.

Route (delegate, don't do):
- scene / camera / engine work → issue-builder
- any GLSL, post pass, transition → shader-engineer
- any gate, screenshot, trace, checklist → gate-auditor (pass/fail table only; never pull screenshots here)
- FPS below target → perf-profiler (owns the §0.6 ladder)
- any API uncertainty → docs-researcher BEFORE coding against it
- copy / content.ts / Print Edition → content-scribe
- where is X / who calls X / what breaks if X changes → codegraph MCP, never grep sweeps
- how does the engine fit together / orient a new session → graphify query

Rules: bounded agent reports (≤20 lines); never ask the user (§0.7 only); log rulings with /decision; commit per phase.
```

**Token-efficiency rules (binding):** screenshots and traces are consumed inside gate-auditor/perf-profiler and summarized — raw images never enter the main context; agents return their declared bounded format or the result is rejected once and re-requested; the main thread never re-reads the full spec after Phase 0; parallelize independent issue builds across subagents where phases allow; and no multi-file grep/Read sweep is permitted when a §0.11 graph query can answer the question.

### 0.11 User-installed graph MCPs — CodeGraph + Graphify (use is mandatory)

Both servers are installed and configured on this machine. Bypassing them for grep loops is a protocol violation.

**Division of labor:**
- **CodeGraph** (tree-sitter AST knowledge graph; tools like `codegraph_search`, `codegraph_context`) answers every **precise structural question**: where a symbol is defined/used, call chains, import relationships, blast radius of a change, dead-code checks. It MUST be queried before modifying any existing module and before any refactor.
- **Graphify** (multi-modal knowledge graph over code + docs) answers **orientation and cross-document questions**: how the engine fits together, which modules implement a concept, how spec relates to code. Build its graph over the repo **including `SPEC.md`, `PLAN.md`, `DECISIONS.md`, and `docs/`**, so every fresh session orients through graph queries instead of re-reading those files into context. Query it at the start of each session and each new issue.
- Raw grep/Glob/multi-file Read is allowed only for literal string hunts the graphs cannot answer (e.g., a magic number inside a shader); each exception is one logged line in `DECISIONS.md`.

**Kickoff (Phase 0, before feature code):** verify both servers respond; build the CodeGraph index and the Graphify graph; enumerate both tool surfaces (exact tool names evolve between versions — never assume, list them) and record in `DECISIONS.md`; wire the CLAUDE.md routes and agent allowlists below.

**Freshness (binding):** refresh both after every phase commit — incremental (`graphify update .`; CodeGraph reindex/watcher) — via a git post-commit hook or as the final step of each phase. A stale graph is worse than none; if freshness can't be confirmed, refresh before querying.

**Agent access:** since a `tools:` allowlist excludes MCP tools unless listed, add `mcp__codegraph__*` to issue-builder, shader-engineer, and perf-profiler, and `mcp__graphify__*` to issue-builder. gate-auditor and content-scribe get neither — they work on rendered output and copy.

**Failure ladder:** if a server won't respond after 3 documented fix attempts, continue with the grep fallback, flag every affected gate in `REPORT.md`, and retry the server at the next session start. Never a hard stop.

---

## 1. Objective & constraints

**Objective:** a single-page, scroll-driven portfolio that reads as a living comic book. One global scroll timeline; the camera behaves like a **film editor**, not a drone — holds, dollies, crash-zooms, and **cuts** between designed shots. Every scene ("issue") has a visibly different print treatment from the one before. Every issue contains at least one designed jaw-drop moment. Nothing on screen is ever fully static: lines boil, dots breathe, balloons pop.

**Design law replacing the old "never cut" rule:** *cuts are native here.* The comic conceit is what makes hard angle changes feel intentional instead of broken. But cuts are **designed transitions** (dot-zoom, page-flip, paper tear, whip + speed lines, stamp slam, panel wipe) — never a raw unstyled jump.

**IP guardrail (hard rule):** the style borrows the *technique vocabulary* of comic printing and modern comic-book animation — halftone/Ben-Day dots, cel shading, ink outlines, line boil, animation on 2s, impact frames, speed lines, panel grammar, Kirby-krackle-style energy dots. These are generic, decades-old techniques. **Zero Marvel/Sony/Spider-Man IP:** no characters, costumes, masks, logos, web imagery, "thwip," poses, or recognizable shots from any film. All fonts OFL/Google Fonts (e.g., Bangers for display lettering, Caveat for handwriting, a mono for terminal). The recurring original character is **the cat** — hidden somewhere in every single issue (reader Easter-egg hunt). This rule applies equally to any image-generation prompts written for the user under the pipeline in §6.

**Non-goals for v1:** photoreal anything (the style forbids it — a feature); all 11 issues at full fidelity (v1 ships the Cover + Issues 1–3 fully realized, rest as styled placeholder sets); CMS/backend.

**Tech stack (locked):** Next.js (App Router), React 19, TypeScript strict, React Three Fiber, `@react-three/drei`, `@react-three/postprocessing` (+ raw `postprocessing` passes where needed), Three.js, GSAP + ScrollTrigger, Lenis, Zustand, TailwindCSS, GLSL. `framer-motion` for DOM UI only. Ask before adding anything else.

---

## 2. Locked technical decisions

1. **One persistent `<Canvas>`**, mounted once. `frameloop="always"` (line boil + idle motion require it). `dpr` clamped `[1,2]`, `[1,1.5]` low tier.
2. **Scroll model unchanged:** Lenis → one ScrollTrigger → normalized `t ∈ [0,1]` in a Zustand store. Everything downstream is a **pure function of `t`** — mandatory for scrub-safety (users scroll backwards).
3. **ShotDirector replaces the global spline.** An ordered shot list; each shot:
   ```ts
   interface Shot {
     id: string;
     issue: string;                    // which scene-set it films
     range: [number, number];          // slice of global t
     kind: 'hold' | 'dolly' | 'orbit' | 'crash' | 'whip' | 'spline';
     from: Pose; to?: Pose;            // or a local mini-CatmullRom for 'spline'
     ease?: EaseFn;
     fovFrom?: number; fovTo?: number; // crash-zooms are FOV + dolly together
     outTransition: TransitionSpec;    // how we leave this shot (see 5)
   }
   ```
   Within a shot, interpolate pose (+ small lerp smoothing). At boundaries, execute the transition. Each issue gets **3–6 shots** — that's the "lots of camera angles."
4. **Gutters + hysteresis:** consecutive segments do NOT share a boundary point — between every two sits a **gutter**, a dedicated slice of `t` that the transition owns outright (0.010 standard, 0.015 for the three showcase transitions; exact numbers in §0.3 — the comic's own word for the space between panels where the cut happens). Local progress `p = (t − gutterStart) / gutterWidth` drives the transition shader — pure, deterministic, scrub-safe both directions. A ±0.002 deadband just inside each gutter edge prevents strobing when hovering near it. Both neighboring issues are live during a gutter (already guaranteed by the active ± 1 rule).
5. **Scenes are isolated sets, not a corridor.** Because cuts are allowed, each issue lives in its own world-space set (own group, own lighting, own fog). `SceneManager` keeps **active ± 1** mounted, disposes the rest. This is simpler and cheaper than the old corridor and enables radically different environments.
6. **One shared post pipeline, per-issue "print recipes."** A single `EffectComposer` built once with all passes present but flag-gated: toon-grade → **edge/ink pass** (single fullscreen Sobel on normals+depth — one uniform ink line for the whole frame, far cheaper than per-object outlines) → **halftone pass** (custom: one perfectly-registered dot screen, dot size driven by luminance, tinted by the underlying color — per-channel CMYK screens and any channel offset are banned per §2.16) → grain + **paper texture** multiply overlay → vignette. Issues don't rebuild the composer; they swap a `PrintRecipe` (uniforms + enable flags) with a short cross-fade at cuts.
7. **Materials:** `MeshToonMaterial` with 2–3 step gradient maps + flat color palettes per issue. No PBR, no environment maps, max one realtime shadow light per issue (most issues fake shadows with painted-on darker tones).
8. **Stepped time ("on 2s") utility:** `useSteppedClock(fps)` returns time quantized to 1/8s or 1/12s. Hero/character/prop animation samples stepped time; **camera and scroll always run smooth 60**. This contrast (smooth lens, stepped world) is the signature feel.
9. **Line boil:** outline/edge jitter driven by quantized noise at 8–12 fps (tiny UV offset in the edge pass). Also: **scroll velocity is a global uniform** — fast scrolling increases boil amplitude and fades in radial speed lines. The page physically reacts to how hard you scroll.
10. **Panels = render targets, strictly budgeted.** Live comic-panel composites render secondary views into `WebGLRenderTarget`s at **half resolution, max 3 live RTs at once**, composited on quads with gutters/borders/tilt. Everything else uses **snapshots**.
11. **Snapshot system:** when the camera leaves an issue for the last time in a scroll direction, copy the final frame into a pooled texture. Snapshots power the paper-tear/page-flip transitions and the Issue-10 double-page spread — recap of the whole journey at near-zero cost.
12. **Onomatopoeia system:** pooled SDF text sprites / drei `Text` with GSAP squash-and-stretch pop-ins, always on stepped time, auto-despawn. Custom dev-flavored words ("SHIP IT!", "MERGE!", "CLACK", "60FPS!", "COMPILE!"), never franchise-associated ones. Optional Easter egg: one Persian onomatopoeia (e.g., «بوم!») in the streaming issue.
13. **Flash safety (non-negotiable):** impact frames and glitches are capped — no more than 3 general flashes per second, no full-screen high-contrast strobing (WCAG 2.3.1). A `flashBudget` guard in the transition system enforces it. Reduced-motion users never see cuts, glitches, or flashes at all (§8).
14. **Two motion classes — travel vs beats.** *Travel* is scrubbed: pure `f(t)`, reversible, as specced. *Beats* are short (0.4–1.5s) authored-time sequences (GSAP timelines at fixed duration) that fire when `t` crosses a trigger and play at their own speed regardless of scroll velocity — impact frames, the CMYK slam, the title drop, the ink-flood. Beats are idempotent, re-arm when scrubbed back past their trigger (with hysteresis), and are skipped entirely under reduced motion. This is what makes moments *hit* for slow scrollers without sacrificing scrub-safety.
15. **Pointer parallax ("mouse look"):** inside any hold/dolly shot, the pointer nudges the camera ±1.5–2.5° (eased) — cutscene head-tracking. Disabled during beats, transitions, and reduced motion. Touch: subtle gyro optional, off by default.
16. **Visual comfort (non-negotiable):** the anaglyph-style "offset print" look is **banned** — zero chromatic aberration, zero RGB/CMYK channel separation or misregistration, no double-exposure ghosting, no blur on readable content — anywhere, ever, including transitions and recipes. All lettering, onomatopoeia, captions, and UI text render as a **crisp single layer exempt from every post pass** (composited after the pipeline). The comic feel comes from halftone, ink edges, flat color, stepped motion, and paper — never from doubled edges. If a reference technique produces ghosting or fringing, it does not enter this build.

---

## 3. Architecture

```
app/
  layout.tsx / page.tsx        # <Experience/> + <ScrollProxy/> + <UIOverlay/>
components/
  Experience.tsx               # single Canvas, ShotDirector, SceneManager, PostPipeline
  ShotDirector.tsx             # evaluates shot list from t; owns cuts + hysteresis
  PostPipeline.tsx             # one composer; applyRecipe(PrintRecipe)
  TransitionLayer.tsx          # fullscreen quad running transition shaders on snapshots
  PanelCompositor.tsx          # budgeted RT panels
  Onomatopoeia.tsx             # pooled word-pop system
  PerfHUD.tsx
  ui/                          # DOM: lettering, captions, terminal, print edition
issues/
  registry.ts                  # ordered issues: { id, range, recipe, shots[], component }
  _IssueShell.tsx              # set isolation, palette, dispose-on-unmount, snapshot hook
  00-Cover/  01-Noir/  02-Desk/  03-NeonInk/ ...  10-Spread/  11-LettersPage/
lib/
  scrollStore.ts               # t, activeIssue, scrollVelocity, quality, reducedMotion, audio
  shots.ts                     # Shot/Pose/TransitionSpec types + evaluators
  recipes.ts                   # PrintRecipe per issue
  steppedClock.ts / snapshots.ts / content.ts (single content source for 3D + print edition)
shaders/
  halftone.frag  inkEdge.frag  dotZoom.frag  pageFlip.frag  paperTear.frag
  stampCut.frag  powerOn.frag  speedLines.frag  screentone.frag  sketchHatch.frag
```

**Issue contract:** an issue owns its set, declares its `PrintRecipe`, its shots, its **intensity rating (1–5)** for the beat chart (§5b), its beats, its jaw-drop trigger `t`, and its cat placement (cameo or guide moment). It animates idle life on stepped time, reads `t` for scroll-relative motion, and fires authored-time beats (§2.14) from trigger crossings.

---

## 4. Performance budget & strategy

Target **60 FPS desktop** (DevTools trace at every gate, not just the HUD), 30 FPS floor mid-tier, print-edition fallback on mobile/low.

Where this style is cheap — exploit it: toon materials (no PBR/IBL), flat palettes, painted shadows, low-poly everything, one edge pass instead of per-object outlines, stepped animation halves perceived motion cost. Where it's expensive — cap it: **RT panels (≤3 live, half-res)**, post chain (one composer, recipes toggle passes; heavy passes like glitch enabled only during their transition window), text sprites pooled, `InstancedMesh` for anything repeated (rain dashes, krackle dots, crowd sprites, city blocks), dispose on unmount, snapshots instead of live views wherever the content doesn't need to move.

If a designed moment can't hold 60, **fake it comic-style**: a moment can be a 12 fps stepped sequence (cheaper AND more on-style), a snapshot with a shader, or a 2D lettering overlay. The medium gives you permission.

---

## 5. Transition library (the cuts ARE the show)

Each is a fullscreen shader on the outgoing snapshot + incoming live frame, driven by scrub-safe local `p`:
- **dot-zoom** — halftone dot frequency collapses until one dot swallows the frame; the dot's interior is the next shot. (Signature transition; used Desk → Misprint city.)
- **page-flip** — cylindrical page-curl of the whole viewport, paper backside texture, next issue underneath.
- **paper-tear** — alpha tear with fibered edge; newsprint issue exit.
- **whip** — 2–4 frame directional blur + radial speed lines + tiny camera roll; for intra-issue angle changes.
- **stamp cut** — the next shot slams down onto the page like a rubber stamp: quick scale-squash, one flash-safe impact frame, radial lines, a pressed-paper shadow ring. All the punch of a slam with zero channel ghosting (§2.16).
- **panel-wipe** — gutter bars sweep in, next shot enters as a panel that grows to full bleed.
- **match-cut** — pose-matched hard cut (e.g., mug circle → subway tunnel circle). At least two match-cuts in the full journey; they're the cheapest jaw-drop that exists.

## 5b. Cinematic direction — what makes it a cutscene instead of a slideshow

Five rules that govern every issue. The per-issue gate in Phase 3 checks all of them.

**1. Motivated cuts — the cat is the through-line, not just an Easter egg.** In film, a cut is motivated by action or eyeline; unmotivated cuts read as a slideshow. The cat is the journey's silent guide: it exits frame right in one shot and enters frame left in the next (screen-direction continuity), its eyeline motivates whip-pans, its leaps motivate the biggest transitions. Concretely: the rooftop silhouette in Issue 1 leaps toward the glowing window → Issue 2 opens on the *same cat* landing and curling up on the desk. It bats a halftone dot to trigger the dot-zoom, rides the subway, pads across the sketchbook leaving ink pawprints, drifts through the spread, and finally sits on the terminal. Cameos stay hidden-object fun; *guide moments* stitch the anthology into one story.

**2. A beat chart — peaks need valleys.** Wall-to-wall fortissimo flattens into noise; surprise requires baseline. The journey follows an authored intensity curve (each issue tagged 1–5 in the registry): noir cold-open (2) → **title drop** (5) → desk warmth (2) → city power-on (5) → origin page as a deliberate quiet valley (1) → factory (3) → newsprint (3) → subway build (4) → streaming 360 (5) → sketchbook self-inking as the held-breath beat (2) → spread climax (5) → terminal denouement (1). At least two full valleys are mandatory. Gate check: no two adjacent issues at equal intensity.

**3. Title drop.** Game/film grammar: cold open first, title after. Following the noir window reveal, the visitor's name slams in as a full-frame comic title card — an authored-time beat with a sub-thump — then whips into Issue 2. This removes the masthead burden from Issue 4, which becomes the quiet valley + panel-portal it wants to be.

**4. Lens language + composition gate.** Every shot's Pose includes focal intent: wide 20–28mm for dives and establishes, 35–50mm normal, 85–135mm compression for intimacy (desk details, the cat). Default shot order per issue: establish → detail → reveal. Screen direction stays consistent through the journey and is broken exactly once, deliberately, on the Issue 3 landing. Composition checklist every shot must pass in its gate screenshot (verified via Chrome DevTools MCP): one clear focal point; three depth planes — foreground / midground / background (flat shots rejected); readable as a 200px thumbnail; focal point placed intentionally (thirds, or dead-center punch); all visible lettering pixel-crisp with zero fringing (§2.16). *This checklist is how "is every element positioned accurately" gets answered — positioning is proven in screenshots at each gate, never assumed.*

**5. Diegetic interactivity — game-feel garnish.** Pointer parallax inside shots (§2.15). Hoverable desk objects pop balloon labels. Clicking the cat anywhere yields a "MEOW!" word-pop with a hidden counter. The factory's assembly line manufactures one actual UI button end to end — stamped, dropped into frame, and becoming the real, clickable **"See projects"** CTA (diegetic UI). Konami code flips every onomatopoeia to Persian. The cover has an idle **attract mode**: breathing parallax, tail flick, "scroll to open" — the first five seconds are a designed shot, not a loading state.

---

## 6. Asset strategy — the style IS the asset plan

Cel shading + ink edge + halftone makes primitives read as finished art. Build everything from low-poly primitives/extrusions with flat palette colors; the cat is ~10 primitives and will look *good*. GLTF/Draco/KTX2 loaders stay pre-wired but v1 needs **no sourced models**. 2D elements (lettering, balloons, paper, tears) are shader/DOM work, not assets. The only "art" to author is palettes + gradient maps per issue (`recipes.ts`) and a paper texture (procedural noise is fine).

**Raster images never block (procedural-first, upgrade queue).** v1 ships with **zero required raster assets**: the cover art (primitives + lettering + halftone), paper grain (shader noise), emote sprites (SDF shapes), newsprint "photo plates" (halftone-processed procedural renders), and the coffee stain (SVG blob) all have procedural stand-ins that read as intentional style. When a moment would genuinely be better with real artwork, do **not** stall, ask, or wait — ship the procedural version AND queue an upgrade:
1. Write a complete, self-contained generation prompt to `assets/prompts/<asset-name>.md`: subject and composition; the owning issue's exact palette hexes from `recipes.ts`; style tokens in the **technique vocabulary** ("flat cel shading, bold uniform ink outlines, halftone dot shading, paper grain"); exact resolution and aspect; transparent background / tileable / power-of-two if required; and a short "avoid" list (gradients, photorealism, soft shadows, any chromatic-aberration or offset-print ghosting).
2. In the same message, tell the user the **target path** (`public/textures/…` or `public/images/…`) and format (PNG with alpha, or a KTX2-compressible source).
3. Later, entirely at the user's leisure, they generate the image and drop the file at that path; the **next session** detects it, swaps it in, and verifies it in situ with a Chrome DevTools MCP screenshot (does it sit in the recipe's palette? does the halftone pass fight it?). The run never waits for this.
Prompts are bound by the same IP rule as the rest of the build (§1): describe **original** subjects through generic technique vocabulary — never franchise characters, logos, or "in the style of <specific film/artist>" phrasing. If a requested asset can only be specified by naming third-party IP, say so plainly and propose an original substitute that fills the same slot (the cat mascot exists for exactly this). As a practical bonus, technique-token prompts also produce more consistent results across image models than style-mimicry prompts do.

---

## 7. Build phases

### Phase 0 — Engine + print pipeline skeleton (no final art)
- **First:** scaffold the agent infrastructure per §0.10 — agents, commands, skills, CLAUDE.md — then run the hardening loop on them before any feature code. In the same step, verify and index both graph MCPs per §0.11, record their tool surfaces in `DECISIONS.md`, and install the post-commit freshness hook. All subsequent Phase 0 work goes through the roster.
- Scaffold; Canvas; Lenis → `t`; Zustand; PerfHUD.
- **ShotDirector** with hysteresis; 11 placeholder issue-sets, each a distinctly tinted box room with **2 shots** and labeled name.
- **PostPipeline** with recipe swapping: toon grade + ink edge + halftone + paper working end-to-end; each placeholder issue gets a visibly different recipe (one B&W, one heavy halftone, one neon-on-black…).
- Three core transitions working on placeholders: hard cut, **whip**, **dot-zoom**. Snapshot system capturing on issue exit.
- `useSteppedClock`; a demo cube spinning on 2s while the camera stays smooth.
- **Beat engine** (§2.14): trigger / re-arm / hysteresis, with one demo beat (a flash-safe impact frame) firing identically for fast and slow scrollers. Pointer parallax (§2.15) live inside placeholder shots. `intensity` field wired through the registry.
- **Gate:** scrubbing forward AND backward through all 11 sets produces deterministic designed cuts, zero strobe at boundaries; recipes visibly differ per set; the demo beat plays at authored speed regardless of scroll velocity and re-arms correctly on reverse; DevTools trace shows 60 FPS; flash guard active; the agent roster answers `/gate` and `/run-phase`, every agent file carries at least one date-stamped verified rule, and CLAUDE.md is ≤60 lines; both graph MCPs answer a test query and the freshness hook fires on commit; TS strict clean.

### Phase 1 — Vertical slice: Cover → Issue 1 → Issue 2 → Issue 3, fully real
Proves the whole thesis: three maximally different treatments + the signature transitions + panels + onomatopoeia.
- **Cover:** the loading screen is Issue #1's comic cover (masthead lettering, price-box gag, barcode = GitHub handle). Before any scroll, the **attract mode** idles: breathing parallax, tail flick, "scroll to open." First scroll: cover art gains depth, then **crash-zoom through the cover into the live noir world**. Doubles as the audio-consent gesture.
- **Issue 1 — Noir (Outside):** pure black-and-white hatched ink world; rain = instanced white dashes; ONE window rendered in full CMYK color — the only color in the universe. Shots: low dutch street hold → whip tilt up the facade → crash to window. Jaw-drop: the colored window. Final shot: the cat silhouette **leaps toward the window** — the motivated cut out.
- **Title drop (beat):** the name slams in as a full-frame comic title card with a sub-thump, then whips into Issue 2 (§5b.3).
- **Issue 2 — Full-Color Halftone (Desk):** opens on the *same cat* landing from the leap and curling up on the desk (screen-direction continuity). Warm palette, halftone shadows, RGB strip cycling on stepped time, 12 fps tail flick, keycaps popping "CLACK" as the camera tracks over them. **Jaw-drop:** the frame splits into a live **3-panel composite** (keyboard macro / cat / monitor) via budgeted RTs, then the monitor panel grows to full bleed.
- **Transition:** the cat bats a floating halftone dot — the **dot-zoom** into the monitor (motivated).
- **Issue 3 — Neon Ink (Code City):** black-paper world printed in flat, saturated neon inks — razor-crisp bold outlines, syntax-highlight palette, krackle-style energy dots (instanced), code-block buildings, roads as glowing ink lines. This issue proves the comfort rule (§2.16) at maximum contrast: high energy, zero ghosting. Shots: free-fall dive → crash-zoom past a building → dutch landing. **Jaw-drop:** the **power-on cascade** — the city boots in a radial wave from the landing point, block by block on 2s, roads igniting outward with a sub-thump and a stamp-cut punch.
- **Gate:** the slice plays as one seamless piece both scroll directions; three treatments are unmistakably different in screenshots; every shot passes the §5b.4 composition checklist in its screenshot; both major cuts are motivated (cat leap, cat dot-bat); the title-drop beat hits at authored speed even for slow scrollers; 60 FPS trace through the RT-panel moment; flash budget respected; onomatopoeia pooled (no GC churn in trace).

### Phase 2 — Framework hardening
Extract: `PrintRecipe` API, transition library (§5 complete incl. page-flip, tear, panel-wipe, match-cut), balloon/word pooling, snapshot pool, per-issue jaw-drop trigger helper. **Gate:** a new issue = one component + one registry entry + one recipe.

### Phase 3 — Remaining issues, one commit each
Each must pass the same per-issue gate: *visibly distinct treatment from its neighbors (screenshot check), intensity contrasts with both neighbors per the beat chart (§5b.2), ≥3 shots each passing the composition checklist (§5b.4), entrances/exits motivated (cat or action continuity), one designed jaw-drop, cat placed (cameo or guide), 60 FPS trace, disposes clean.*
- **Issue 4 — Origin Page (About):** a comic PAGE floating in 3D — panels are quads showing live minis (RT-budgeted) or snapshots; the camera *drifts* between panels, slowly — this is the journey's first **quiet valley** (intensity 1). The name already dropped after Issue 1, so this page carries the story beats, not the masthead; tech icons orbit with squash-and-stretch on 2s. The jaw-drop stays gentle by design: the camera glides **through** a panel's surface — panel as portal (that IS the transition out).
- **Issue 5 — The Press (Skills factory):** departments in different micro-styles — React: cel-shaded blue energy core; TypeScript: blueprint lineart circuits; Rust: heavy-ink industrial, orange sparks, "CLANK"; AI: krackle neural constellation. Panel-wipe cuts between departments, but the through-line is **one component**: the camera follows a single UI button being manufactured across every department. Jaw-drop: the final stamp lands with an impact frame + radial lines — and the button drops out of the scene into the frame as the real, clickable **"See projects"** CTA (diegetic UI, §5b.5).
- **Issue 6 — Newsprint (Open Source):** off-white paper world, black halftone "photos," headline type ("LOCAL DEV SHIPS AGAIN"), commit graph as a stock ticker. **AI Job Hunter is the front-page story** — its framed panel floods into full color as the camera approaches (GitHub + demo buttons live in that panel). Exit: **paper-tear**.
- **Issue 7 — Screentone (Timeline subway):** manga-flavored B&W screentone, heavy speed lines while the train runs, stations as milestone spreads (started programming → university → first job → moved to Germany → senior FE → open source → AI Job Hunter → streaming). Low wheel-level shots, through-window tracking, overhead map insert panel. Exit jaw-drop: the train hits the edge of the page and the **whole world page-flips**.
- **Issue 8 — Pop Print (Streaming):** oversaturated webcomic palette, 3D speech balloons popping with chat, flat emote sprites billboarding at 12 fps, "ON AIR" sign, donation alert spawns a giant word pop (the Persian «بوم!» Easter egg lives here). **Jaw-drop:** a full 360° whip-orbit where the *camera* is butter-60 while the *entire world* animates on 2s — the smooth-lens/stepped-world contrast at maximum.
- **Issue 9 — Sketchbook (Architecture):** pencil-hatch shader on paper, handwritten annotations (Caveat), a coffee-stain, stick-figure robots pushing data packets along the Frontend→API→Workers→AI→DB→Search→Desktop chain; the cat pads across the paper mid-scene leaving ink pawprints. **Jaw-drop:** the sketch **inks itself** — stroke-reveal draw-on, then flat color floods in like a print run finishing. Deliberately the journey's *held-breath* beat: slow, near-silent, intensity 2. (This issue is deliberately your doodle aesthetic.)
- **Issue 10 — The Spread (Space):** near-black cosmos, krackle starfields, your real GitHub contribution grid baked at build time as a literal star chart, abstract constellations. **The jaw-drop of the whole site:** the frame unfolds into a **double-page spread** — every previous issue floats in space as a comic page built from its live snapshot; the whole scrolled journey visible at once.
- **Issue 11 — Letters Page (Terminal):** CRT-scanline × halftone hybrid; `hello visitor_`; commands (about, projects, experience, skills, contact, resume, github, linkedin, blog) pop floating panels with squash-and-stretch — no navigation. Typing `resume` prints a paper sheet that drops onto the Issue-2 desk (snapshot callback). Ends on a back cover: "NEXT ISSUE: ???", cat walking off-panel, barcode gag.

### Phase 4 — Sound + polish
Audio is half of cutscene feel, and it mirrors the visual rule: **each issue gets its own audio treatment**, as distinct as its print recipe — noir: vinyl crackle + distant brushed drums; desk: room tone + mechanical switches; neon city: stuttering glitch synth (sound only — the visuals stay crisp per §2.16); newsprint: paper rustle + teletype; subway: rail rhythm the screentone flicker syncs to; streaming: bright chiptune-pop with chat pops; sketchbook: pencil scratch over near-silence; space: airy pads; terminal: hum + beeps. **Everything is synthesized at runtime** (raw Web Audio, or Tone.js — a pre-approved dependency addition for this phase only: filtered noise for rain/rustle/crackle, FM/AM synthesis for pads and chiptune, envelopes for clicks and thumps). **No audio files are required, fetched, or awaited.** Transitions are scored: riser into the dot-zoom, whoosh on whips, sub-thump on impact frames and the title drop (all within the flash/loudness budget). When audio is on, halftone dot scale breathes subtly with the music. Everything gesture-gated, off by default, degrades silently. Global color-script pass so adjacent issues harmonize while contrasting. **Gate:** audio never autoplays; every beat has a synced sound; trace still 60.

### Phase 5 — Print Edition + accessibility (do NOT skip)
- `prefers-reduced-motion` and mobile/low tier get **The Print Edition**: a genuinely designed static comic page version — CSS panels, same lettering, same content from `content.ts`, gentle fades only, zero WebGL, zero cuts/flashes. First-class, not a consolation.
- All text content lives in the DOM (selectable, SEO, screen-reader), never only in textures. Flash audit with DevTools trace + manual pass (WCAG 2.3.1).
- **Gate:** throttled-mobile profile and reduced-motion both deliver a complete, fast, beautiful comic.

---

## 8. Definition of done (v1)

Desktop: Cover + Issues 1–3 fully realized, Issues 4–11 as styled placeholder sets with working shots/recipes/transitions (labeled). Every boundary is a designed transition; scrub-safe both directions; 60 FPS by trace; flash budget enforced; each realized issue visibly distinct in side-by-side screenshots with one jaw-drop and one cat placement. The beat chart is enforced (no two adjacent issues at equal intensity; two full valleys present); every realized shot passes the composition checklist; all major cuts are motivated. Print Edition complete. TS strict, no `any` in engine/issue code. One Canvas, one `t`, one composer, ≤3 live RTs, active ± 1 issues mounted. No third-party IP anywhere; fonts OFL. The run ends with `REPORT.md` (§0.9): every gate result, all degraded-passes, the queued asset-upgrade prompts, any empty REQUIRED_INPUT fields, and the taste-pass checklist — the user's total involvement is one upfront content form and one post-run taste pass, with nothing required mid-run. The `.claude/` infrastructure (agent roster, commands, both skills, the ≤60-line CLAUDE.md orchestrator) is committed, and every agent's embedded technical claims carry a research-verification date. Both graph MCPs are wired, indexed, and fresh at the final commit, with any grep-fallback periods flagged in `REPORT.md`.

---

## Appendix — Creative north star (reference, not tasks)

The feeling to hit: *someone printed a comic about a developer's world and the ink came alive.* The camera is confident — it holds when something deserves a look, then cuts hard when the story turns. Difference is the rhythm: mono→color, flat→deep, smooth→stepped, quiet→pop. Surprise lives in transitions and in scale changes (macro keycap → city dive → double-page cosmos). The cat is the thread. The scroll wheel is the reader's thumb on the page corner.
