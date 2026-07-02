"use client";

import { useEffect, useRef } from "react";
import { useScrollStore } from "@/lib/scrollStore";
import { issueCopy } from "@/lib/content";
import { clamp01 } from "@/lib/shots";
import { scrollToT } from "./ScrollProxy";
import {
  PRESS_CTA_DROP,
  PRESS_CTA_IN,
  PRESS_CTA_OUT,
  PRESS_PROJECTS_T,
} from "@/issues/05-press/shots";

/**
 * Issue 5's diegetic CTA (S5b.5): the button the factory just manufactured
 * drops out of the scene and becomes this real DOM button. Presence is pure
 * f(t) (scrub-safe, reduced-motion safe); only the drop-in translation rides
 * the stamp beat's PRESS_CTA_DROP channel. Lives on the post-exempt DOM
 * layer (S2.16 -- crisp single-layer type, solid fills, zero-blur shadow).
 * Click: smooth-scroll to the Issue 6 newsprint front-page story.
 */

const PAPER = "#23272E";
const INK = "#E8E4DC";
const EDGE = "#14110E";

export default function PressCta() {
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const el = btn.current;
      if (!el) return;
      const { t } = useScrollStore.getState();
      const oIn = clamp01((t - PRESS_CTA_IN[0]) / (PRESS_CTA_IN[1] - PRESS_CTA_IN[0]));
      const oOut = 1 - clamp01((t - PRESS_CTA_OUT[0]) / (PRESS_CTA_OUT[1] - PRESS_CTA_OUT[0]));
      const o = Math.min(oIn, oOut);
      const on = o > 0.001;
      el.style.opacity = o.toFixed(3);
      el.style.visibility = on ? "visible" : "hidden";
      el.style.pointerEvents = on ? "auto" : "none";
      // drop-in from above the frame (beat channel; 0 = rested in place)
      el.style.transform = `translateX(-50%) translateY(${(-62 * PRESS_CTA_DROP.v).toFixed(2)}vh)`;
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <button
      ref={btn}
      type="button"
      onClick={() => scrollToT(PRESS_PROJECTS_T)}
      className="fixed left-1/2 z-30"
      style={{
        bottom: "9vh",
        opacity: 0,
        visibility: "hidden",
        pointerEvents: "none",
        transform: "translateX(-50%)",
        fontFamily: "var(--font-bangers)",
        fontSize: "clamp(20px, 3.2vh, 32px)",
        letterSpacing: "0.06em",
        padding: "0.5em 1.4em",
        background: INK,
        color: PAPER,
        border: `3px solid ${EDGE}`,
        borderRadius: "12px",
        boxShadow: `6px 6px 0 ${EDGE}`,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {issueCopy.press.cta}
    </button>
  );
}
