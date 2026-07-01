"use client";
import { Canvas } from "@react-three/fiber";
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
        camera={{ fov: 60, near: 0.1, far: 1000, position: [0, 0, 5] }}
      >
        <color attach="background" args={["#05060a"]} />
        <fog attach="fog" args={["#05060a", 25, 140]} />
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 20, 10]} intensity={1.2} />
        <CameraRig />
        <SceneManager />
        <PerfHUD />
      </Canvas>
    </div>
  );
}
