"use client";
import { Canvas } from "@react-three/fiber";
import { Stars, Sparkles } from "@react-three/drei";
import { CameraRig } from "./CameraRig";
import { SceneManager } from "./SceneManager";
import { PerfHUD } from "./PerfHUD";

// The single persistent Canvas for the entire site. Mounted once; scenes never remount it.
export function Canvas3D() {
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
            starfield for parallax + near light-motes that stream past for a speed cue.
            Both animate on their own, independent of scroll. */}
        <Stars radius={300} depth={120} count={3500} factor={4} saturation={0} fade speed={0.6} />
        <Sparkles
          count={260}
          scale={[170, 90, 360]}
          position={[0, 0, -150]}
          size={3}
          speed={0.5}
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
