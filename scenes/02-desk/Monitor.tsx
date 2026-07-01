"use client";
import { COLOR, LAYOUT } from "./config";
import { useAssetTexture } from "@/lib/useAssetTexture";

// The monitor: dark bezel + a code-editor screen (real editor screenshot, emissive, faces +Z
// toward the incoming camera), plus a cool light spill onto the room. The screen is the hero the
// camera dives into for the ENTER MONITOR scene.
export function Monitor() {
  const screen = useAssetTexture("/textures/code-editor.png");

  const [mx, my, mz] = LAYOUT.monitor.pos;
  const [sw, sh] = LAYOUT.monitor.screen;
  const b = LAYOUT.monitor.bezel;

  return (
    <group position={[mx, my, mz]}>
      {/* Bezel + screen sit directly on the desk (no stand — it'd be buried under the slab).
          TODO(asset): swap the bezel for a real monitor GLTF; the screen plane + texture stay. */}
      <mesh position={[0, 0, -0.15]}>
        <boxGeometry args={[sw + b * 2, sh + b * 2, 0.4]} />
        <meshStandardMaterial color={COLOR.bezel} roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0, 0.07]}>
        <planeGeometry args={[sw, sh]} />
        <meshBasicMaterial map={screen} toneMapped={false} />
      </mesh>

      {/* Cool light the screen casts into the dark room (warm lamp is the counterweight). */}
      <pointLight position={[0, 0, 3]} color={COLOR.screenCool} intensity={LAYOUT.screenLight.intensity} distance={LAYOUT.screenLight.distance} decay={2} />
    </group>
  );
}
