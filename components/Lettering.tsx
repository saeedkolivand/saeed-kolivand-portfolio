"use client";

import { useEffect, useRef } from "react";
import { useScrollStore } from "@/lib/scrollStore";
import { fx } from "@/lib/fx";
import { lettering } from "@/lib/content";
import { RANGES } from "@/issues/timeline";
import { NOIR_SHOTS } from "@/issues/01-noir/shots";
import { clamp01 } from "@/lib/shots";

/**
 * S2.16 lettering layer -- a DOM overlay ABOVE the canvas, unconditionally
 * exempt from post: attract prompt (cover only), title-drop card (opacity =
 * scroll window, slam transform = beat via fx.title), noir captions (per
 * shot range in Issue 1). Everything is a pure function of t + fx channels,
 * read per rAF via getState() -- no hook selectors, no React state per
 * frame. Crisp single-layer type only: solid fills, zero-blur shadows
 * (comfort rule).
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

/** One caption window per noir shot when counts allow, else an even split of the issue range. */
const CAPTION_WINDOWS: [number, number][] =
  NOIR_SHOTS.length >= CAPTIONS.length
    ? CAPTIONS.map((_, i) => [NOIR_SHOTS[i]!.range[0], NOIR_SHOTS[i]!.range[1]])
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
  { top: "10vh", left: "7vw" },
  { top: "12vh", right: "7vw" },
  { bottom: "14vh", left: "10vw" },
] as const;

export default function Lettering() {
  const promptRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const capRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    let raf = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const { t, reducedMotion } = useScrollStore.getState();

      const prompt = promptRef.current;
      if (prompt) {
        const o = clamp01(1 - t / COVER_END);
        prompt.style.opacity = o.toFixed(3);
        prompt.style.visibility = o > 0.001 ? "visible" : "hidden";
        // centering + 2.4s breathe live HERE, not in a CSS class: the
        // .pj-breathe rule in globals.css never reached the element under
        // Turbopack, which left the prompt un-centered (barcode collision)
        const s = reducedMotion ? 1 : 1 + 0.05 * Math.sin(now * 0.00262);
        prompt.style.transform = "translateX(-50%) scale(" + s.toFixed(4) + ")";
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

      for (let i = 0; i < CAPTION_WINDOWS.length; i++) {
        const el = capRefs.current[i];
        if (!el) continue;
        const win = CAPTION_WINDOWS[i]!;
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

      {/* noir captions -- one per shot window in Issue 1 */}
      {CAPTIONS.map((caption, i) => (
        <div
          key={caption}
          ref={(el) => {
            capRefs.current[i] = el;
          }}
          className="absolute"
          style={{
            ...CAPTION_SPOTS[i % CAPTION_SPOTS.length],
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
          {caption}
        </div>
      ))}
    </div>
  );
}
