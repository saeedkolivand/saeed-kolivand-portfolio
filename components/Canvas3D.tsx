"use client";
import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Stars, Sparkles } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from "@react-three/postprocessing";
import { Vector2 } from "three";
import { CameraRig } from "./CameraRig";
import { SceneManager } from "./SceneManager";
import { PerfHUD } from "./PerfHUD";
import { useScrollStore } from "@/lib/scrollStore";

// The single persistent Canvas for the entire site. Mounted once; scenes never remount it.
export function Canvas3D() {
  // Scale ambient decoration by GPU tier and honor reduced motion.
  const lowTier = useScrollStore((s) => s.quality === "low");
  const reducedMotion = useScrollStore((s) => s.reducedMotion);
  const starCount = lowTier ? 1200 : 3500;
  const sparkleCount = lowTier || reducedMotion ? 120 : 260;
  const motion = reducedMotion ? 0 : 1;
  // Wet-lens chromatic split; memoized so the Vector2 isn't reallocated each render.
  const caOffset = useMemo(() => new Vector2(0.0006, 0.0006), []);

  return (
    <div className="fixed inset-0">
      <Canvas
        frameloop="always"
        // The EffectComposer owns the render target + AA (its `multisampling`), so context MSAA
        // never reaches the composited image — disable it and don't pay for an unused MSAA buffer.
        dpr={lowTier ? [1, 1.5] : [1, 2]}
        gl={{ antialias: false, powerPreference: "high-performance" }}
        camera={{ fov: 62, near: 0.1, far: 1000, position: [0, 0, 5] }}
      >
        <color attach="background" args={["#05060a"]} />
        <fog attach="fog" args={["#05060a", 60, 400]} />
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 20, 10]} intensity={1.2} />

        {/* Ambient depth + motion so the flight never reads as an empty void. Distant
            starfield for parallax (radius exceeds the spline's far end so it never empties)
            + near light-motes that stream past for a speed cue. */}
        <Stars radius={360} depth={120} count={starCount} factor={4} saturation={0} fade speed={0.6 * motion} />
        <Sparkles
          count={sparkleCount}
          scale={[170, 90, 360]}
          position={[0, 0, -150]}
          size={3}
          speed={0.5 * motion}
          opacity={0.7}
          color="#8fd4ff"
        />

        <CameraRig />
        {/* Scene texture loading is caught by a per-scene <Suspense> inside SceneManager, so a
            loading scene never blanks its neighbors. */}
        <SceneManager />
        <PerfHUD />

        {/* Selective bloom is the scene's whole look — only emissives above threshold (the one
            warm window, cyan accents) flare; the matte city + rain stay crisp. Global pass, so
            it also gently lifts the placeholder scenes' emissive cores. Cheaper on low tier. */}
        <EffectComposer multisampling={lowTier ? 0 : 4}>
          <Bloom luminanceThreshold={0.6} intensity={lowTier ? 0.45 : 0.7} radius={0.6} mipmapBlur />
          <Vignette offset={0.28} darkness={0.7} />
          <ChromaticAberration offset={caOffset} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
