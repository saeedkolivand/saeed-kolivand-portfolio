# Saeed Kolivand Portfolio — Project Rules for AI Assistants

Single source of truth for AI assistants on this repo. Terse rules inline, detail behind pointers. On any conflict this file wins over agent prompts; `AGENTS.md` defers to it.

An interactive, scroll-driven 3D portfolio: one persistent react-three-fiber `<Canvas>` flies a single camera along a spline through a sequence of scenes. Ships to https://iamsaeed.dev.

---

## Auto-invoked skills (always on)

- **ponytail** — lazy-senior-dev default: the simplest/shortest solution that works (YAGNI, stdlib/native over deps, one line over fifty). Intensity `full`; `/ponytail lite|full|ultra`; off: `stop ponytail`.

---

## Stack

Next.js 16 (App Router, Turbopack) · React 19.2 · TypeScript 6 (strict + `noUncheckedIndexedAccess`) · react-three-fiber 9 · @react-three/drei 10 · three r185 · @react-three/postprocessing 3 · Zustand 5 · Lenis 1.3 · GSAP 3.15 · Tailwind v4 · ESLint 10. Package manager **npm**; Node ≥ 20.9.

- **React Compiler is OFF** (`reactCompiler: false`) — conflicts with r3f's mutation-heavy `useFrame`/ref patterns. Memoize deliberately.
- **React StrictMode is OFF** (`reactStrictMode: false`) — its dev double-mount churns the single WebGL context.

## Architecture

One `<Canvas>`, one spline, one scroll→`t` source of truth. Only current ±1 scene ever mounted.

```
app/         layout.tsx (metadata/fonts), page.tsx (Experience + ScrollProxy + UIOverlay), globals.css
components/   Experience.tsx (dynamic ssr:false wrapper) · Canvas3D.tsx (the Canvas) · CameraRig.tsx
             SceneManager.tsx (mount budget) · PerfHUD.tsx (dev) · ui/ (ScrollProxy, UIOverlay)
lib/         scrollStore.ts (zustand: t, activeIndex, quality, reducedMotion, audio) · spline.ts (curve, SCENE_COUNT)
scenes/      registry.ts (SceneDef contract) · _SceneShell.tsx · PlaceholderScene.tsx · 01..11 placeholders
```

Data flow: DOM scroll → Lenis → `setT(t)` → `activeIndex = floor(t*SCENE_COUNT)` → `CameraRig` reads `t` via `getState()` in `useFrame`, remaps to spline param `u`, lerps the camera. `SceneManager` mounts `activeIndex ± 1`.

## Invariants (do not break)

- **One persistent Canvas**, mounted once via `dynamic(() => import('./Canvas3D'), { ssr:false })`. Never remount it; never import three/R3F into a Server Component or the root layout.
- **Only `activeIndex ± 1` scenes mounted** — the core perf lever (`SceneManager`). ≤3 scene groups live.
- **`t`→`u` remap stays monotonic** (`du/dt = 1 + WHIP·cos(...)`, so `WHIP < 1`) and `u == t` at scene centers/boundaries so mounting stays aligned.
- **No per-frame allocations in `useFrame`** — preallocate into refs; write with `.copy`/`.lerp`/`getPointAt(u, target)`. All motion `* delta`.
- **Respect `reducedMotion`** (store flag wired to `prefers-reduced-motion`) on every autonomous animation.
- **Derive per-scene identity from `SCENE_COUNT`**, never a hardcoded `11`.
- **Dispose** imperative geometry/material/texture in a `useEffect` cleanup; JSX resources auto-dispose via `SceneShell`.

## Rules

0. **PRs only, never push to `main`.** Branch → commit → push → `gh pr create` → merge (squash).
1. **Before every PR, the review gate.** `/pr-gate` runs `grumpy-reviewer` + `security-reviewer` on the branch diff (or `/security-review` for the security pass alone). Resolve BLOCKER/MAJOR/HIGH before merging.
2. **TypeScript strict, zero `any`** in engine/scene code — `npx tsc --noEmit` must be green.
3. **Never bypass ESLint** (no `// eslint-disable`, no `@ts-ignore`) — fix the cause.
4. **Ask before adding any dependency** beyond the locked stack.
5. **Every real-asset slot is a labeled placeholder** + `// TODO(asset)`; swapping in a GLTF requires no architectural change.
6. **60 FPS desktop budget**, < 100 draw calls/scene; 2D fallback on low tier / reduced motion.

## Code intelligence: graphify + codegraph

Prefer these over raw grep/file-browsing for "where / what calls / impact / architecture".

- **codegraph** (structural, SQLite `.codegraph/`) — symbols, calls, imports, impact. MCP `mcp__codegraph`; CLI `codegraph callers|callees|impact|query`.
- **graphify** (semantic, `graphify-out/`) — meaning, rationale, cross-doc. MCP `mcp__graphify`; CLI `graphify query|path|explain`; broad nav `graphify-out/wiki/index.md`.
- Routing: structural → codegraph · semantic/rationale → graphify · grep only when neither answers.
- After code changes: `graphify update .` (AST-only, no API cost).

## Agent system

Specialized subagents under `.claude/agents/` (each with `model:` tiering + `mcp__graphify`/`mcp__codegraph`). Route by touched area; the **main session orchestrates** — agents can't call agents.

| Touched area | Agent |
|---|---|
| three.js/R3F: camera, spline, materials, shaders, lighting, drei | `r3f-graphics-engineer` (opus) |
| Lenis/GSAP/scrollStore, scroll→param remap, reduced-motion | `scroll-motion-engineer` |
| new/edited scenes, registry, mount budget | `scene-author` |
| Next.js app shell, config, DOM overlay, hydration | `nextjs-app-engineer` |
| 60fps budget, GC churn, leaks, quality tiers | `perf-profiler` |
| find / where / how / architecture (read-only) | `codebase-explorer` |
| lint + tsc + build + browser verification (read-only) | `qa-verifier` (haiku) |
| pre-PR code review + nitpicks (read-only) | `grumpy-reviewer` (opus) |
| pre-PR security review (read-only) | `security-reviewer` (opus) |

**Per-change flow:** author implements → `grumpy-reviewer` + `security-reviewer` audit (BLOCKER/MAJOR/HIGH block, nits advisory) → `qa-verifier` proves it builds/runs → commit → PR. **Model tiering:** Opus for reviewers + highest-risk camera/spline math; Sonnet for implementers; Haiku for mechanical QA.

Full review checklist + build conventions: **`.claude/skills/portfolio-standards/SKILL.md`**.

## Dev

`npm run dev` (Turbopack, :3000) · `npm run build` · `npx tsc --noEmit` · `npm run lint`.

Next.js 16 is newer than training data — read the relevant guide in `node_modules/next/dist/docs/` before app-router/config work (see `AGENTS.md`).
