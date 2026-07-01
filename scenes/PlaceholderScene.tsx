"use client";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import type { Mesh } from "three";

// TODO(asset): replace with the real scene geometry / GLTF. Deliberately a labeled
// wireframe so it can never be mistaken for finished art.
export function PlaceholderScene({
  label,
  position,
}: {
  label: string;
  position: [number, number, number];
}) {
  const ref = useRef<Mesh>(null);

  // Idle motion, independent of scroll, so a scene still feels alive when paused.
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.3;
  });

  return (
    <group position={position}>
      <mesh ref={ref}>
        <boxGeometry args={[6, 6, 6]} />
        <meshBasicMaterial wireframe color="#38bdf8" />
      </mesh>
      <Text
        position={[0, 4.6, 0]}
        fontSize={1.1}
        color="#e2e8f0"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.03}
        outlineColor="#05060a"
      >
        {label}
      </Text>
    </group>
  );
}
