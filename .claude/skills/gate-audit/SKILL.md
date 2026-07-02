---
name: gate-audit
description: Procedures for auditing PANEL JUMP phase gates - driving the browser to exact t positions, screenshots, FPS measurement, scrub-determinism checks, flash and comfort audits. Load when running /gate or /shot-review.
---

# Gate audit procedures

## Driving the page
Dev server: `npm run dev` (http://localhost:3000). The scene is canvas-only:
DOM/accessibility snapshots see nothing - use screenshots, console, traces.

Scroll to a global t:
`window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * T)`
then wait ~2s for Lenis to settle before screenshotting. t ranges per issue
are in issues/registry.ts (S0.3). Mid-shot samples avoid intra-issue whip
gutters: use t = start + 0.2*(end-start), not the middle of the range.

## Tools
Preferred: Chrome DevTools MCP (performance traces, CPU/network throttling,
console with stack traces, screenshots). Fallback (logged 2026-07-02):
agent-browser CLI - `agent-browser open <url>`, `eval "<js>"`,
`screenshot <path>`, `console`. Screenshots stay in the audit context;
report only pass/fail + evidence lines.

## FPS
DevTools MCP: record a trace while scrolling a segment; read the FPS track.
Fallback rAF sampler (~2-4s, scroll during it):
`new Promise(res => { let f=0; const t0=performance.now(); const loop=()=>{f++; performance.now()-t0<2000 ? requestAnimationFrame(loop) : res(Math.round(f/2));}; requestAnimationFrame(loop); })`
Low tier: CPU-throttle 4x (DevTools) and re-measure.

## Scrub determinism
Pick a gutter-interior t. Approach it from below (scroll to t-0.03, then t)
and from above (t+0.03, then t); screenshot both after settle. The frames
must match (same transition state, same dots/lines). Repeat for one standard
and one showcase gutter.

## Beat check
Park just before the trigger t, cross it with a small scroll step, and
screenshot within 150ms; the beat must also NOT re-fire when crossing again
without first retreating past trigger - hysteresis.

## Comfort + flash (S2.16, S2.13)
Zoom a lettering screenshot to 100%: zero color fringing, zero doubled
edges. During the most transition-dense segment, confirm no more than 3
full-frame flashes in any rolling second (frame-by-frame trace screenshots
or the flashBudget console counter if exposed).

## Report
One pass/fail table row per gate check with a one-line evidence note.
Numbers, not adjectives. Screenshots never leave the audit context.
