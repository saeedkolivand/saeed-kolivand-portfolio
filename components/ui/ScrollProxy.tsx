"use client";
import { useEffect } from "react";
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
  const reducedMotion = useScrollStore((s) => s.reducedMotion);
  const setReducedMotion = useScrollStore((s) => s.setReducedMotion);

  // Honor the OS "reduce motion" setting: it drives the store flag that CameraRig and the
  // ambient decorations read, and it makes Lenis scroll instant (no smoothing).
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [setReducedMotion]);

  return (
    <ReactLenis root options={{ lerp: reducedMotion ? 1 : 0.1, smoothWheel: !reducedMotion }}>
      {/* Tall empty spacer provides the scroll range that maps to t ∈ [0,1]. */}
      <div style={{ height: `${SCENE_COUNT * 100}vh` }} aria-hidden />
      <TWriter />
    </ReactLenis>
  );
}
