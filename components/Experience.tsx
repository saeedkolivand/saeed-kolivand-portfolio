"use client";

import { Suspense } from "react";
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
    <div className="fixed inset-0" aria-hidden>
      <Canvas
        frameloop="always"
        dpr={quality === "high" ? [1, 2] : [1, 1.5]}
        gl={{ antialias: false, stencil: false, depth: true, powerPreference: "high-performance" }}
        camera={{ fov: 45, near: 0.1, far: 400, position: [0, 2, 10] }}
      >
        <ShotDirector />
        {/* Scene loads (troika fonts, art textures) MUST suspend inside the
            Canvas. Without a boundary here, a set that mounts while an asset
            is still loading suspends R3F's own <Block/>, which makes the DOM
            <Canvas> throw: React then destroys its effects, R3F runs
            unmountComponentAtNode (internal.active = false, root dropped from
            the render loop) and the canvas freezes on its last frame -- flat
            paper at every t -- with the scene graph, camera and composer all
            still intact. Verified against the installed r3f v9 source
            (canvas.tsx Block/throw + unmountComponentAtNode) 2026-07-28. */}
        <Suspense fallback={null}>
          <SceneManager />
        </Suspense>
        <PostPipeline />
        {/* post-exempt comic words, drawn after the composer (S2.16) */}
        <Onomatopoeia />
      </Canvas>
      <PerfHUD />
    </div>
  );
}
