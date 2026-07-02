"use client";

import { useEffect, useRef, useState } from "react";
import { ISSUES } from "@/issues/registry";
import { useScrollStore } from "@/lib/scrollStore";

/**
 * S2.5 -- keeps active +/- 1 issue sets mounted, the rest unmounted (R3F
 * disposes their GPU resources). Both gutter neighbors are always live.
 *
 * Deep jumps (deep link / scrollbar yank past the premount window): the
 * mounted window is centered on `anchor`, which follows `active` in the same
 * render pass for continuous scroll but on a jump lags one painted frame so
 * JumpCover's paper fill is on screen first. The target window's initial
 * (shader-compiling, main-thread-blocking) render then happens behind the
 * cover instead of showing as a raw cream blank (Phase 1 gate fix).
 */
export default function SceneManager() {
  const active = useScrollStore((s) => s.activeIssue);
  const [anchor, setAnchor] = useState(active);
  const jumped = Math.abs(active - anchor) > 1;
  // continuous scroll (also reduced motion): window follows with zero lag
  if (!jumped && active !== anchor) setAnchor(active);

  const covering = useRef(false);

  useEffect(() => {
    if (jumped) {
      // cover up (idempotent on re-jump: opacity is already 1, no strobe),
      // give it one frame to paint, then mount the target's window at once
      covering.current = true;
      useScrollStore.getState().setJumpCover(active);
      const raf = requestAnimationFrame(() => setAnchor(active));
      return () => cancelAnimationFrame(raf);
    }
    if (!covering.current) return;
    // anchor caught up (or the jump was aborted by scrolling back inside the
    // old window). R3F's frameloop rAF precedes callbacks queued here, so the
    // second tick below lands after the target's first blocking render --
    // only then reveal. A new jump before then cancels this via cleanup.
    covering.current = false;
    let r2 = 0;
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => useScrollStore.getState().setJumpCover(null));
    });
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
    };
  }, [jumped, active]);

  const mounted = [anchor - 1, anchor, anchor + 1].filter(
    (i) => i >= 0 && i < ISSUES.length,
  );
  return (
    <>
      {mounted.map((i) => {
        const issue = ISSUES[i]!;
        const IssueScene = issue.component;
        return <IssueScene key={issue.id} index={i} />;
      })}
    </>
  );
}
