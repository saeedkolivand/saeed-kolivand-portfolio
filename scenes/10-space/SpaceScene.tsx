"use client";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, Group, Mesh } from "three";
import { useScrollStore } from "@/lib/scrollStore";

// SPACE — a quiet atmospheric breather between the ARCHITECTURE diagram and the TERMINAL closer: a
// glowing star with slow, tilted orbital rings. Radially symmetric, so no leveling needed — just the
// look-target anchor. All idle motion (spin + core pulse) is gated on reduced motion.
const CYAN = "#8fd4ff";
const PALE = "#bfe6ff";
const ANCHOR: [number, number, number] = [0, 1.93, -15.88]; // look-target at the dwell (measured)

export function SpaceScene() {
  const rings = useRef<Group>(null);
  const core = useRef<Mesh>(null);

  useFrame((state, delta) => {
    if (useScrollStore.getState().reducedMotion) return;
    if (rings.current) {
      rings.current.rotation.y += delta * 0.09;
      rings.current.rotation.x += delta * 0.035;
    }
    if (core.current) core.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 0.8) * 0.12);
  });

  return (
    <group position={ANCHOR}>
      {/* glowing star core + soft halo (additive → blooms rather than occludes) */}
      <mesh ref={core}>
        <sphereGeometry args={[1.4, 32, 32]} />
        <meshBasicMaterial color={PALE} toneMapped={false} />
      </mesh>
      <mesh scale={2.6}>
        <sphereGeometry args={[1.4, 24, 24]} />
        <meshBasicMaterial color={CYAN} transparent opacity={0.08} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>

      {/* slow, tilted orbital rings */}
      <group ref={rings}>
        <mesh rotation={[Math.PI / 2.2, 0, 0]}>
          <torusGeometry args={[5, 0.03, 10, 96]} />
          <meshBasicMaterial color={CYAN} transparent opacity={0.35} toneMapped={false} />
        </mesh>
        <mesh rotation={[Math.PI / 2.6, 0.6, 0.3]}>
          <torusGeometry args={[6.6, 0.025, 10, 96]} />
          <meshBasicMaterial color={CYAN} transparent opacity={0.24} toneMapped={false} />
        </mesh>
        <mesh rotation={[Math.PI / 1.8, -0.5, 0.2]}>
          <torusGeometry args={[8.2, 0.02, 10, 96]} />
          <meshBasicMaterial color={PALE} transparent opacity={0.16} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}
