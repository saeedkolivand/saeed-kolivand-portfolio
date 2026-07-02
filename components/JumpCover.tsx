"use client";

import { useEffect, useRef } from "react";
import { ISSUES } from "@/issues/registry";
import { useScrollStore } from "@/lib/scrollStore";

/**
 * Paper-color halftone-dot fill that hides the mount/compile stall when a
 * deep jump lands past SceneManager's premount window (deep link, scrollbar
 * yank). Shown/hidden by direct style mutation inside a store subscription:
 * the show is synchronous with setJumpCover, so the fill is painted before
 * the heavy scene commit regardless of React scheduling. Static opaque fill,
 * instant show, short opacity-only fade out -- S2.16 safe (no channel
 * separation, ghosting, or blur), and the fade is skipped under reduced
 * motion. Scroll behavior itself is untouched.
 */
export default function JumpCover() {
  const el = useRef<HTMLDivElement>(null);

  useEffect(
    () =>
      useScrollStore.subscribe((s, prev) => {
        const div = el.current;
        if (!div || s.jumpCover === prev.jumpCover) return;
        if (s.jumpCover !== null) {
          const r = ISSUES[s.jumpCover]!.recipe;
          div.style.backgroundColor = r.bg;
          // ink-tone dot screen (#RRGGBBAA, ~12% alpha) in the print language
          div.style.backgroundImage = `radial-gradient(circle, ${r.ink}1f 1.5px, transparent 1.6px)`;
          div.style.transition = "none";
          div.style.opacity = "1";
        } else {
          div.style.transition = s.reducedMotion ? "none" : "opacity 0.25s ease-out";
          div.style.opacity = "0";
        }
      }),
    [],
  );

  return (
    <div
      ref={el}
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 30, // above the canvas and Lettering (z-20)
        opacity: 0,
        pointerEvents: "none",
        backgroundSize: "9px 9px",
      }}
    />
  );
}
