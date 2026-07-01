"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { Color, type Mesh } from "three";

// TODO(asset): replace with the real scene geometry / GLTF. Deliberately a labeled
// wireframe cage + glowing core so it reads as an obvious placeholder, but each region
// gets its own hue and idle life so the journey is varied instead of identical boxes.
export function PlaceholderScene({
  label,
  position,
  index,
}: {
  label: string;
  position: [number, number, number];
  index: number;
}) {
  const cage = useRef<Mesh>(null);
  const core = useRef<Mesh>(null);

  // Hue sweeps across the journey so each region is visually distinct.
  const color = useMemo(
    () => new Color().setHSL((index / 11) * 0.75 + 0.05, 0.7, 0.6),
    [index],
  );

  // Idle motion, independent of scroll, so a scene still feels alive when paused.
  useFrame((state, delta) => {
    if (cage.current) cage.current.rotation.y += delta * 0.2;
    if (core.current) {
      core.current.rotation.x += delta * 0.5;
      core.current.rotation.y -= delta * 0.35;
      const s = 1 + Math.sin(state.clock.elapsedTime * 1.4 + index) * 0.15;
      core.current.scale.setScalar(s);
    }
  });

  return (
    <group position={position}>
      <mesh ref={cage}>
        <boxGeometry args={[6, 6, 6]} />
        <meshBasicMaterial wireframe color={color} />
      </mesh>
      <mesh ref={core}>
        <icosahedronGeometry args={[1.5, 0]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.7}
          roughness={0.35}
          metalness={0.4}
        />
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
