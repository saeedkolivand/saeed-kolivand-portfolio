"use client";
import { Canvas } from "@react-three/fiber";
import { Stars, Sparkles } from "@react-three/drei";
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

  return (
    <div className="fixed inset-0">
      <Canvas
        frameloop="always"
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
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
        <SceneManager />
        <PerfHUD />
      </Canvas>
    </div>
  );
}
