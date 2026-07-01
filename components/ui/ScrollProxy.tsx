"use client";
import { ReactLenis, useLenis } from "lenis/react";
import { useScrollStore } from "@/lib/scrollStore";
import { SCENE_COUNT } from "@/lib/spline";

// Writes normalized scroll progress into the store. Deriving t straight from Lenis
// (lenis.progress = scroll / limit) is all the camera needs — no GSAP ScrollTrigger
// proxy required until a scene wants local pinning.
function TWriter() {
  const setT = useScrollStore((s) => s.setT);
  useLenis((lenis) => setT(lenis.progress));
  return null;
}

export function ScrollProxy() {
  return (
    <ReactLenis root options={{ lerp: 0.1, smoothWheel: true }}>
      {/* Tall empty spacer provides the scroll range that maps to t ∈ [0,1]. */}
      <div style={{ height: `${SCENE_COUNT * 100}vh` }} aria-hidden />
      <TWriter />
    </ReactLenis>
  );
}
