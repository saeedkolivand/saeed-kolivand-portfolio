"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Minimal FPS meter, only with ?debug. Gates are trace-verified via Chrome
 * DevTools; this is the on-screen sanity number.
 * ponytail: replaced r3f-perf -- its dist embeds a binary WOFF inside an
 * .mjs, which crashes Turbopack source-map generation. rAF ticks in lockstep
 * with the Canvas frameloop, so this measures real render cadence.
 */
export default function PerfHUD() {
  const [on, setOn] = useState(false);
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOn(new URLSearchParams(location.search).has("debug"));
  }, []);

  useEffect(() => {
    if (!on) return;
    let raf = 0;
    let frames = 0;
    let last = performance.now();
    const loop = () => {
      frames++;
      const now = performance.now();
      if (now - last >= 500) {
        if (el.current) el.current.textContent = `${Math.round((frames * 1000) / (now - last))} fps`;
        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [on]);

  return on ? (
    <div
      ref={el}
      className="fixed left-2 top-2 z-50 rounded bg-black/70 px-2 py-1 font-mono text-xs text-lime-300"
    />
  ) : null;
}
