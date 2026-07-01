"use client";
import { Stats } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect } from "react";

// Dev-only diagnostics. FPS / frame-time / memory via drei's Stats (stats.js), plus a
// window handle (window.__three = { gl, scene, camera }) for inspecting the live scene
// graph, camera, and draw calls from the console. r3f-perf was dropped: its bundled
// roboto.woff.mjs breaks Turbopack chunk generation, and drei's Stats needs no extra dep.
export function PerfHUD() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as unknown as { __three?: unknown }).__three = { gl, scene, camera };
  }, [gl, scene, camera]);

  if (process.env.NODE_ENV === "production") return null;
  return <Stats />;
}
