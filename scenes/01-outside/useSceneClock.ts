"use client";
import { useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type { ShaderMaterial } from "three";
import { useScrollStore } from "@/lib/scrollStore";

// Drives a shader material's `uTime` uniform from a per-material accumulator that advances only
// while reduced motion is off. Every OUTSIDE shader uses this hook, so they all share the same
// clock value (identical delta + gate each frame) and freeze together into a calm static frame
// for prefers-reduced-motion. Ref access happens in-frame only — never reads a ref during render
// nor mutates a memoized value, so it satisfies the react-hooks rules (unlike a shared uTime
// object threaded through props).
export function useUniformClock(matRef: RefObject<ShaderMaterial | null>) {
  const t = useRef(0);
  useFrame((_, delta) => {
    if (!useScrollStore.getState().reducedMotion) t.current += Math.min(delta, 0.05);
    const m = matRef.current;
    if (!m) return;
    const u = m.uniforms.uTime;
    if (u) u.value = t.current;
  });
}
