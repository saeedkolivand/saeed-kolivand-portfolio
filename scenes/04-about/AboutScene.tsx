"use client";
import { Text, Line } from "@react-three/drei";

// ABOUT — an identity constellation the camera flies through after the monitor dive: a glowing hub
// (name + role) wired to satellite nodes (the stack this site is built on), in the screen's cyan so
// it reads as still being "inside the machine". Everything's a labeled node so it's easy to edit.
const CYAN = "#8fd4ff";

const NAME = "SAEED KOLIVAND";
const ROLE = "Senior Frontend Developer";
const SUB = "AI & Agentic Systems  ·  Köln, DE";
const HUB: [number, number, number] = [0, 1.5, 0];

// [label, position, labelDy] — the facets that define the work, spread in the XY plane (slight z
// for depth). labelDy places the label above (+) or below (−) the node, off the wire.
const NODES: ReadonlyArray<readonly [string, [number, number, number], number]> = [
  ["AI & Agentic", [-10.5, 1.5, 1.5], 0.95],
  ["Multi-LLM", [-9, -4.5, -1.5], -1.1],
  ["6+ Years", [-3.5, -8, 1.5], -1.1],
  ["React · Next", [5, -7, -1.5], -1.1],
  ["TypeScript", [10.5, -1, 1.5], 0.95],
];

function Node({ position, label, labelDy }: { position: [number, number, number]; label: string; labelDy: number }) {
  return (
    <group position={position}>
      <mesh>
        <icosahedronGeometry args={[0.35, 0]} />
        <meshBasicMaterial color={CYAN} toneMapped={false} />
      </mesh>
      <Text position={[0, labelDy, 0]} fontSize={0.62} color="#cfe8ff" anchorX="center" anchorY="middle" outlineWidth={0.02} outlineColor="#05060a">
        {label}
      </Text>
    </group>
  );
}

export function AboutScene() {
  return (
    <group>
      {/* wires from the hub to each satellite */}
      {NODES.map(([, p], i) => (
        <Line key={`w${i}`} points={[HUB, p]} color={CYAN} lineWidth={1} transparent opacity={0.45} toneMapped={false} />
      ))}

      {/* hub core + name + role */}
      <mesh position={HUB}>
        <icosahedronGeometry args={[0.6, 1]} />
        <meshBasicMaterial color={CYAN} toneMapped={false} />
      </mesh>
      <Text position={[0, 4.9, 0]} fontSize={1.9} color="#eaf6ff" anchorX="center" anchorY="middle" outlineWidth={0.04} outlineColor="#05060a">
        {NAME}
      </Text>
      <Text position={[0, 3.5, 0]} fontSize={0.78} color={CYAN} anchorX="center" anchorY="middle" letterSpacing={0.12}>
        {ROLE}
      </Text>
      <Text position={[0, 2.7, 0]} fontSize={0.5} color="#9fb4c8" anchorX="center" anchorY="middle" letterSpacing={0.06}>
        {SUB}
      </Text>

      {NODES.map(([label, p, dy], i) => (
        <Node key={`n${i}`} position={p} label={label} labelDy={dy} />
      ))}
    </group>
  );
}
