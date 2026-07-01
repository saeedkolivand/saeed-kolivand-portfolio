"use client";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text, Line } from "@react-three/drei";
import type { Mesh } from "three";
import { useScrollStore } from "@/lib/scrollStore";
import { useLevelRoll } from "@/lib/useLevelRoll";

// TERMINAL — the closer: a terminal-style contact card (prompt + links + a "let's build" CTA) with a
// blinking cursor. Hard-banking spot, so the group is levelled per-frame (useLevelRoll). Content
// edits inline (TODO(asset): confirm the LinkedIn handle).
const CYAN = "#8fd4ff";
const DIM = "#c2dcec";
const MINT = "#8ef0c8"; // CTA accent
const FAINT = "#6f97b5";

// Look-target at the dwell, measured off spline+whip; re-measure if the spline, scene WEIGHTS
// (registry), or CameraRig bank change. Roll is handled by useLevelRoll, not here.
const ANCHOR: [number, number, number] = [0, 3.41, -15.63];

const CONTACTS: readonly string[] = [
  "saeedkolivand1997@gmail.com",
  "github.com/saeedkolivand",
  "linkedin.com/in/saeedkolivand",
];

const RULE_PTS: [number, number, number][] = [
  [-8, 2.8, 0],
  [8, 2.8, 0],
]; // separator under the prompt — hoisted so drei builds the Line geometry once

export function TerminalScene() {
  const root = useLevelRoll();
  const cursor = useRef<Mesh>(null);

  // Blink the prompt cursor; hold it steady (visible) under reduced motion.
  useFrame((state) => {
    if (!cursor.current) return;
    cursor.current.visible = useScrollStore.getState().reducedMotion || Math.sin(state.clock.elapsedTime * 3.4) > 0;
  });

  return (
    <group ref={root} position={ANCHOR}>
      <Text position={[0, 3.5, 0]} fontSize={0.55} color={CYAN} anchorX="center" anchorY="middle" letterSpacing={0.05}>
        saeed@dev ~ %  contact
      </Text>
      {/* x hand-tuned to the right edge of the centered prompt above; re-measure if that text changes */}
      <mesh ref={cursor} position={[3.4, 3.42, 0]}>
        <planeGeometry args={[0.32, 0.62]} />
        <meshBasicMaterial color={CYAN} toneMapped={false} />
      </mesh>

      <Line points={RULE_PTS} color={CYAN} lineWidth={1} transparent opacity={0.3} toneMapped={false} />

      {CONTACTS.map((c, i) => (
        <Text key={c} position={[0, 1.9 - i * 0.9, 0]} fontSize={0.62} color={DIM} anchorX="center" anchorY="middle">
          {c}
        </Text>
      ))}
      <Text position={[0, -1, 0]} fontSize={0.5} color={FAINT} anchorX="center" anchorY="middle">
        Köln, Deutschland
      </Text>

      <Text position={[0, -2.5, 0]} fontSize={0.85} color={MINT} anchorX="center" anchorY="middle" outlineWidth={0.02} outlineColor="#05060a" letterSpacing={0.03}>
        ▸ let&apos;s build something
      </Text>
      <Text position={[0, -3.6, 0]} fontSize={0.42} color={FAINT} anchorX="center" anchorY="middle">
        open to Senior Frontend · AI &amp; Agentic roles
      </Text>
    </group>
  );
}
