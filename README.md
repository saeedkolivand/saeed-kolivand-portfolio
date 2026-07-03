# Saeed Kolivand — Portfolio

**A scroll-driven portfolio that reads like a living comic book.**

### [iamsaeed.dev](https://iamsaeed.dev)

The portfolio of **Saeed Kolivand** — Senior Frontend Developer, Cologne. One
global scroll timeline, twelve comic "issues," a camera that behaves like a
film editor (holds, dollies, crash-zooms, and hard *cuts* between designed
shots), and a printed comic aesthetic throughout: halftone dots, ink edges,
line boil, stepped animation, paper texture.

The scroll wheel is the reader's thumb on the page corner.

---

## What's inside

- **Twelve issues, each a distinct print treatment** — noir ink, warm desk
  halftone, neon city, origin page, a skills factory, newsprint, a manga-tone
  subway, an oversaturated streaming pop print, a pencil-and-ink sketchbook, a
  cosmic double-page spread, and a CRT terminal letters page.
- **Designed transitions, not raw jumps** — every boundary is a cut with
  intent: dot-zoom, page-flip, paper-tear, whip, stamp slam, panel wipe,
  ink-flood, match-cut. All scrub-safe in both directions.
- **A synthesized soundscape** — twelve per-issue ambiences, eleven scored
  transitions, and dozens of reactions, all generated at runtime (no audio
  files). Gesture-gated, off by default. The halftone dots breathe with it.
- **The cat is the through-line** — Harley (a real, fluffy golden tabby) guides
  the journey scene to scene and hides in every issue.
- **The Print Edition** — for reduced-motion, mobile, and low-power devices, a
  genuinely designed *static* comic renders instead: same content, same
  lettering, zero WebGL, zero motion. First-class, not a fallback. This is also
  the accessible, crawlable copy — all text lives in the DOM.

## Accessibility

- `prefers-reduced-motion`, mobile, low tier, and no-WebGL all get the static
  **Print Edition** — no animation, no flashes, no WebGL context created.
- All content is real DOM text (SEO + screen readers); real `<a>` links; one
  `<h1>`, proper landmarks and heading order; a skip link; keyboard focus is
  never trapped under the canvas.
- WCAG: AA color contrast, flash safety per 2.3.1 (≤3 flashes/s, no strobe).

## Tech

Next.js 16 (App Router, static export) · React 19 · TypeScript (strict) ·
React Three Fiber + drei + `postprocessing` · Three.js (GLSL print shaders) ·
Tone.js (runtime-synthesized audio) · GSAP + ScrollTrigger · Lenis · Zustand ·
Tailwind CSS. One `<Canvas>`, one scroll `t`, one post-processing composer.

## Run it locally

```bash
npm install
npm run dev        # http://localhost:3000
```

Other scripts: `npm run build` (static export to `./out`) · `npm run typecheck`.

Try the Print Edition locally by enabling your OS "reduce motion" setting, or
append `?low` to the URL, or narrow the window below 820px.

> Open the browser console for a small easter egg. 🐈

## How it was built

This portfolio was built autonomously with **Claude Code**, one phase per session,
under a self-directed execution protocol — a roster of specialized subagents
(scene builder, shader engineer, gate auditor, performance profiler, docs
researcher, content scribe) coordinated by an orchestrator. The agent
definitions live in [`.claude/`](.claude/) if you're curious how the sausage
was made.

## Deployment

Deployed to **GitHub Pages** at the apex domain `iamsaeed.dev` via
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml): `next build`
produces a static `./out`, which is published on every push to `main`. No
server, no runtime fetches — the GitHub contribution chart is baked at build
time.

---

<sub>© Saeed Kolivand. Style borrows the generic technique vocabulary of comic
printing; no third-party characters, logos, or IP. Fonts are OFL
(Bangers, Caveat, JetBrains Mono).</sub>
