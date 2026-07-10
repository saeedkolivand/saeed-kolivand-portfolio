"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { useScrollStore } from "@/lib/scrollStore";
import { fx } from "@/lib/fx";
import { lettering, printEdition } from "@/lib/content";
import { RANGES } from "@/issues/timeline";
import { NOIR_SHOTS } from "@/issues/01-noir/shots";
import { KEYS_R, MON_R } from "@/issues/02-desk/shots";
import { NEON_SHOTS } from "@/issues/03-neon/shots";
import { COSMOS_R, CHART_R } from "@/issues/10-spread/ranges";
import { clamp01 } from "@/lib/shots";

/**
 * S2.16 lettering layer -- a DOM overlay ABOVE the canvas, unconditionally
 * exempt from post: attract prompt + premise (cover only), title-drop card
 * (opacity = scroll window, slam transform = beat via fx.title), per-issue
 * title-card slugs (CARDS), and scene captions (CAPTION_DEFS). Everything is
 * a pure function of t + fx channels, read per rAF via getState() -- no hook
 * selectors, no React state per frame. Crisp single-layer type only: solid
 * fills, zero-blur shadows (comfort rule).
 */

const COVER_END = RANGES[0]![1];
const NOIR_RANGE = RANGES[1]!;
const DESK_START = RANGES[2]![0];

/**
 * Title-drop card scroll window (user ruling 2026-07-03: the card lives and
 * dies WITH SCROLL, never a timer): small lead-in before the noir->desk
 * gutter, the full showcase gutter, and a tail into desk's landing shot so
 * it stays readable at 2400vh pacing. 0.103 - 0.135 with the beat trigger
 * (noir end, 0.108) inside the fade-in.
 */
const TITLE_WINDOW: [number, number] = [NOIR_RANGE[1] - 0.005, DESK_START + 0.012];
const CAPTIONS = lettering.noirCaptions;

/**
 * Caption 1 (the opening street) holds past its shot by a small tail into
 * the whip gutter / early shot 2 -- captions are a DOM overlay exempt from
 * post, so nothing can smear them (user feedback 2026-07-03: the opening
 * must hold longer). Captions 2-3 keep their exact shot-range windows.
 */
const CAP1_TAIL = 0.004;

/** One caption window per noir shot when counts allow, else an even split of the issue range. */
const CAPTION_WINDOWS: [number, number][] =
  NOIR_SHOTS.length >= CAPTIONS.length
    ? CAPTIONS.map((_, i) => [
        NOIR_SHOTS[i]!.range[0],
        NOIR_SHOTS[i]!.range[1] + (i === 0 ? CAP1_TAIL : 0),
      ])
    : CAPTIONS.map((_, i) => {
        const w = (NOIR_RANGE[1] - NOIR_RANGE[0]) / CAPTIONS.length;
        return [NOIR_RANGE[0] + i * w, NOIR_RANGE[0] + (i + 1) * w];
      });

/**
 * fade in over the first 30% of a window, out over the last 30% (~40%
 * full-opacity plateau) -- pure f(t), opacity only (S2.16). Was 18%/18%;
 * slowed per user feedback 2026-07-02 (captions entered/exited too fast).
 */
function windowOpacity(t: number, a: number, b: number): number {
  const p = (t - a) / (b - a);
  if (p <= 0 || p >= 1) return 0;
  return Math.min(1, p / 0.3, (1 - p) / 0.3);
}

const INK = "#14110E";
const PAPER = "#F2EAD9";
const RED = "#E2574C";

/** alternate caption boxes across the frame, comic-page style */
const CAPTION_SPOTS = [
  { top: "10vh", left: "7vw" }, // 0 top-left
  { top: "12vh", right: "7vw" }, // 1 top-right
  { bottom: "14vh", left: "10vw" }, // 2 bottom-left
] as const;

type CaptionDef = { text: string; window: readonly [number, number]; spot: CSSProperties };

/**
 * All narration captions, declarative. Noir (Issue 1) keeps its per-shot
 * windows (CAPTION_WINDOWS, incl. the CAP1_TAIL hold on caption 1); Desk /
 * Neon / Spread add two apiece at authored windows. DOM overlay exempt from
 * post -- opacity is pure f(t) via windowOpacity, scrub-safe both directions.
 */
const CAPTION_DEFS: CaptionDef[] = [
  ...CAPTIONS.map((text, i) => ({
    text,
    window: CAPTION_WINDOWS[i]!,
    spot: CAPTION_SPOTS[i % CAPTION_SPOTS.length]!,
  })),
  { text: lettering.sceneCaptions.desk[0], window: KEYS_R, spot: CAPTION_SPOTS[1]! },
  { text: lettering.sceneCaptions.desk[1], window: MON_R, spot: CAPTION_SPOTS[0]! },
  // Neon captions derive from NEON_SHOTS ranges. 03-neon/shots.ts is pure data
  // (no gsap / registerJawDrop / snapshot side effects), so it is import-safe in
  // this DOM layer. neon0 holds to the end of shot 1; neon1 spans shot 2 exactly.
  { text: lettering.sceneCaptions.neon[0], window: [0.232, NEON_SHOTS[0]!.range[1]], spot: CAPTION_SPOTS[1]! },
  { text: lettering.sceneCaptions.neon[1], window: NEON_SHOTS[1]!.range, spot: CAPTION_SPOTS[0]! },
  // Spread captions reuse the shot windows from issues/10-spread/ranges.ts --
  // PURE data shared with SPREAD_SHOTS[0]/[1], so the numbers cannot diverge.
  // ./shots.ts itself has module side effects (gsap / registerJawDrop /
  // snapshots) and stays banned from this DOM layer.
  { text: lettering.sceneCaptions.spread[0], window: COSMOS_R, spot: CAPTION_SPOTS[2]! },
  { text: lettering.sceneCaptions.spread[1], window: CHART_R, spot: CAPTION_SPOTS[0]! },
];

type CardDef = { issue: number; title: string; kicker: string; window: [number, number] };

/**
 * Per-issue title-card slugs (Issues 1..11; the Cover gets none). Default is
 * a short 0.016 slug at each issue's range start; Issue 2 is nudged into the
 * gap after the title-drop (TITLE_WINDOW ends 0.135). Titles + kickers come
 * from printEdition.sectionTitles (index-aligned, Cover at 0 -> slice(1)).
 */
const CARDS: CardDef[] = printEdition.sectionTitles.slice(1).map((s, idx) => {
  const issue = idx + 1;
  const start = RANGES[issue]![0];
  const win: [number, number] = issue === 2 ? [0.137, 0.15] : [start, start + 0.016];
  return { issue, title: s.title, kicker: s.kicker, window: win };
});

export default function Lettering() {
  const promptRef = useRef<HTMLDivElement>(null);
  const premiseRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const capRefs = useRef<(HTMLDivElement | null)[]>([]);
  const slugRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    let raf = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const { t, reducedMotion } = useScrollStore.getState();

      // cover-segment window shared by the attract prompt (bottom) and the
      // premise chip (top) -- both fade in/out with the cover, opacity only.
      const coverO = clamp01(1 - t / COVER_END);
      const coverVis = coverO > 0.001 ? "visible" : "hidden";

      const prompt = promptRef.current;
      if (prompt) {
        prompt.style.opacity = coverO.toFixed(3);
        prompt.style.visibility = coverVis;
        // centering + 2.4s breathe live HERE, not in a CSS class: the
        // .pj-breathe rule in globals.css never reached the element under
        // Turbopack, which left the prompt un-centered (barcode collision)
        const s = reducedMotion ? 1 : 1 + 0.05 * Math.sin(now * 0.00262);
        prompt.style.transform = "translateX(-50%) scale(" + s.toFixed(4) + ")";
      }

      const premise = premiseRef.current;
      if (premise) {
        premise.style.opacity = coverO.toFixed(3);
        premise.style.visibility = coverVis;
      }

      const card = cardRef.current;
      if (card) {
        // opacity: pure f(t) window -- scrub-safe both directions, parks at
        // full opacity anywhere on the plateau, deep jumps land it resting
        const o = windowOpacity(t, TITLE_WINDOW[0], TITLE_WINDOW[1]);
        card.style.opacity = o.toFixed(3);
        // transform: beat-only slam energy (fx.title 1 -> 0, back.out dips
        // slightly negative for the settle). Unfired beat / reduced motion
        // = fx.title 0 = scale 1 exactly (Press CTA pure-f(t) precedent).
        card.style.transform = `scale(${Math.max(1 + 1.6 * fx.title, 0.05).toFixed(4)})`;
        card.style.visibility = o > 0.001 ? "visible" : "hidden";
      }

      for (let i = 0; i < CAPTION_DEFS.length; i++) {
        const el = capRefs.current[i];
        if (!el) continue;
        const win = CAPTION_DEFS[i]!.window;
        const o = windowOpacity(t, win[0], win[1]);
        el.style.opacity = o.toFixed(3);
        el.style.visibility = o > 0.001 ? "visible" : "hidden";
      }

      for (let i = 0; i < CARDS.length; i++) {
        const el = slugRefs.current[i];
        if (!el) continue;
        const win = CARDS[i]!.window;
        const o = windowOpacity(t, win[0], win[1]);
        el.style.opacity = o.toFixed(3);
        el.style.visibility = o > 0.001 ? "visible" : "hidden";
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-20 select-none" aria-hidden>
      {/* premise chip -- cover segment only, top-center ABOVE the cover art.
          Solid INK chip (legible over anything), opacity via the shared
          cover window in the rAF loop (no breathe/transform). */}
      <div
        ref={premiseRef}
        className="absolute left-1/2"
        style={{
          top: "2.5vh",
          transform: "translateX(-50%)",
          textAlign: "center",
          opacity: 0,
          visibility: "hidden",
        }}
      >
        <div
          style={{
            display: "inline-block",
            fontFamily: "var(--font-caveat)",
            fontSize: "clamp(15px, 2.2vh, 22px)",
            lineHeight: 1.2,
            color: PAPER,
            background: INK,
            boxShadow: `3px 3px 0 ${RED}`,
            padding: "0.1em 0.7em",
            maxWidth: "min(90vw, 60ch)",
          }}
        >
          {lettering.cover.premise}
        </div>
      </div>

      {/* attract prompt -- cover segment only, breathing (rAF-driven,
          reduced-motion aware). Bottom-center in the ink-void band BELOW the
          cover art (attract camera leaves ~8vh of void), clear of barcode. */}
      <div ref={promptRef} className="absolute bottom-[2.2vh] left-1/2" style={{ opacity: 0 }}>
        <div
          style={{
            fontFamily: "var(--font-bangers)",
            fontSize: "clamp(16px, 3.2vh, 30px)",
            letterSpacing: "0.08em",
            color: PAPER,
            textShadow: `2px 2px 0 ${RED}`,
            whiteSpace: "nowrap",
          }}
        >
          {lettering.cover.attractPrompt}
        </div>
      </div>

      {/* title-drop card -- opacity is the TITLE_WINDOW scroll window;
          the title-drop beat only plays the slam transform via fx.title */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div ref={cardRef} style={{ opacity: 0, visibility: "hidden", textAlign: "center" }}>
          <div
            style={{
              fontFamily: "var(--font-bangers)",
              fontSize: "clamp(52px, 11vw, 160px)",
              lineHeight: 1,
              letterSpacing: "0.02em",
              color: PAPER,
              WebkitTextStroke: `3px ${INK}`,
              textShadow: `8px 8px 0 ${INK}`,
            }}
          >
            {lettering.titleDrop.name}
          </div>
          <div
            style={{
              fontFamily: "var(--font-caveat)",
              fontSize: "clamp(20px, 2.8vw, 38px)",
              marginTop: "1.2vh",
              color: PAPER,
              textShadow: `2px 2px 0 ${INK}, -2px 2px 0 ${INK}, 2px -2px 0 ${INK}, -2px -2px 0 ${INK}`,
            }}
          >
            {lettering.titleDrop.sub}
          </div>
        </div>
      </div>

      {/* per-issue title-card slugs -- small top-center slug per issue
          (Issues 1..11), opacity via its CARDS window. Solid fills, hard
          shadow, no blur, no animated transform (S2.16). */}
      {CARDS.map((card, i) => (
        <div
          key={card.issue}
          ref={(el) => {
            slugRefs.current[i] = el;
          }}
          style={{
            position: "absolute",
            top: "6vh",
            left: "50%",
            transform: "translateX(-50%)",
            opacity: 0,
            visibility: "hidden",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-bangers)",
              fontSize: "clamp(18px, 2.6vw, 32px)",
              letterSpacing: "0.06em",
              color: PAPER,
              background: INK,
              border: `3px solid ${INK}`,
              boxShadow: `4px 4px 0 ${RED}`,
              padding: "0.2em 0.7em",
              whiteSpace: "nowrap",
            }}
          >
            {`ISSUE ${card.issue} - ${card.title.toUpperCase()}`}
          </div>
          <div
            style={{
              display: "inline-block",
              fontFamily: "var(--font-caveat)",
              fontSize: "clamp(14px, 1.6vw, 22px)",
              color: INK,
              background: PAPER,
              padding: "0.05em 0.6em",
              marginTop: "0.4vh",
            }}
          >
            {card.kicker}
          </div>
        </div>
      ))}

      {/* scene captions -- one box per CAPTION_DEFS entry, opacity via its
          window; reuses the caption box styling + spots. */}
      {CAPTION_DEFS.map((def, i) => (
        <div
          key={def.text}
          ref={(el) => {
            capRefs.current[i] = el;
          }}
          className="absolute"
          style={{
            ...def.spot,
            opacity: 0,
            visibility: "hidden",
            maxWidth: "min(46ch, 60vw)",
            padding: "0.5em 0.9em",
            background: PAPER,
            border: `3px solid ${INK}`,
            boxShadow: `5px 5px 0 ${INK}`,
            fontFamily: "var(--font-caveat)",
            fontSize: "clamp(17px, 2.2vw, 28px)",
            lineHeight: 1.25,
            color: INK,
          }}
        >
          {def.text}
        </div>
      ))}
    </div>
  );
}
