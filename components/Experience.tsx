"use client";

import { Canvas } from "@react-three/fiber";
import ShotDirector from "./ShotDirector";
import SceneManager from "./SceneManager";
import PostPipeline from "./PostPipeline";
import Onomatopoeia from "./Onomatopoeia";
import PerfHUD from "./PerfHUD";
import { useScrollStore } from "@/lib/scrollStore";

/**
 * S2.1 -- one persistent Canvas, mounted once, frameloop always (line boil
 * and idle motion need it). dpr clamped [1,2], [1,1.5] on the low tier.
 */
export default function Experience() {
  const quality = useScrollStore((s) => s.quality);
  return (
    <div className="stage" aria-hidden>
      <Canvas
        frameloop="always"
        // The stage is sized in dvh, so the mobile toolbar collapsing resizes
        // the canvas mid-scroll and reallocates every live render target.
        // Debounced so one toolbar animation costs one reallocation at the end
        // rather than one per frame of it.
        resize={{ debounce: 200 }}
        dpr={quality === "high" ? [1, 2] : [1, 1.5]}
        gl={{ antialias: false, stencil: false, depth: true, powerPreference: "high-performance" }}
        camera={{ fov: 45, near: 0.1, far: 400, position: [0, 2, 10] }}
      >
        <ShotDirector />
        <SceneManager />
        <PostPipeline />
        {/* post-exempt comic words, drawn after the composer (S2.16) */}
        <Onomatopoeia />
      </Canvas>
      <PerfHUD />
    </div>
  );
}
