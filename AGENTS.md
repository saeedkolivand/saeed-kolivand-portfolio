<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Portfolio — Agent Rules

> Canonical rules live in `CLAUDE.md` (this file defers to it) + `.claude/skills/portfolio-standards/SKILL.md`. This is the load-bearing subset.

Scroll-driven 3D portfolio: Next.js 16 / React 19 / react-three-fiber 9 / three r185 / TypeScript strict. One persistent `<Canvas>`, one spline, one scroll→`t` source of truth, only `activeIndex ± 1` scenes mounted.

- **PRs only, never push to `main`.** Before every PR run the review gate — `/pr-gate` (grumpy-reviewer + security-reviewer) or `/security-review`; BLOCKER/MAJOR/HIGH block, nits advisory.
- **Invariants:** one Canvas (dynamic `ssr:false`, never in a Server Component/root layout); mount budget ≤ 3; `t→u` remap monotonic + aligned (`WHIP < 1`, `u == t` at scene centers/boundaries); no per-frame allocations in `useFrame` (preallocate + `* delta`); honor `reducedMotion`; derive per-scene identity from `SCENE_COUNT`; dispose imperative THREE resources.
- **React Compiler + StrictMode are OFF** (r3f safety) — memoize deliberately.
- **TypeScript strict, zero `any`; never bypass ESLint.** `npx tsc --noEmit` green before any PR.
- **Code intelligence:** prefer `codegraph` (structural: `mcp__codegraph`) + `graphify` (semantic: `mcp__graphify`) over raw grep. After code changes: `graphify update .`.
- **Agents** under `.claude/agents/` route by touched area (see the table in `CLAUDE.md`); the main session orchestrates — agents can't call agents. Model tiering: Opus for reviewers + hardest camera/spline math, Sonnet for implementers, Haiku for QA.

Full operating contract: `CLAUDE.md`.
