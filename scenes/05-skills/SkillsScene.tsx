"use client";
import { Text, Line } from "@react-three/drei";

// SKILLS — the three skill clusters from the CV as heading + plumb-list columns the camera flies
// between. Deliberately a different motif from ABOUT's radial hub (co-mounted neighbor) so the two
// read as distinct beats. Same screen-cyan. Edit skills inline.
const CYAN = "#8fd4ff";
const DIM = "#a9c6da";

const TOP = 5; // heading y
const LINE = 1.4; // line spacing
const SKILL0 = 3.1; // first skill y

// SKILLS' scroll region is narrow, so the whole cluster is pushed AHEAD to the camera's look-target
// (z ≈ -LOOK_AHEAD) — that lands it framed dead-centre during the scene's dwell instead of flying
// past at the origin. Kept compact in x so all three columns read together.
const AHEAD = -15; // ≈ CameraRig LOOK_AHEAD, so the dwell looks straight at it

// [title, x, skills] — three columns, tight enough to all sit in frame at the dwell.
const CLUSTERS: ReadonlyArray<readonly [string, number, readonly string[]]> = [
  ["AI & AGENTIC", -10.5, ["LLM Integration", "RAG · Vector Search", "Agentic Workflows", "Prompt Engineering", "Streaming Gen", "AI Coding Agents"]],
  ["FRONTEND", 0, ["React 19", "TypeScript", "Next.js", "TanStack Query", "Zustand · Redux-Saga", "Tailwind · MUI"]],
  ["ARCHITECTURE", 10.5, ["Monorepos · Turbo", "Node · SQLite", "REST · WebSocket", "Tauri Desktop", "Vitest · Jest", "CI/CD · GH Actions"]],
];

function Cluster({ title, x, skills }: { title: string; x: number; skills: readonly string[] }) {
  const bottom = SKILL0 - (skills.length - 1) * LINE - 0.9; // last skill y, plus foot padding
  return (
    <group position={[x, 0, 0]}>
      {/* accent plumb line, from just under the heading down past the last skill */}
      <Line points={[[0, TOP - 1, 0], [0, bottom, 0]]} color={CYAN} lineWidth={1} transparent opacity={0.35} toneMapped={false} />
      <Text position={[0, TOP, 0]} fontSize={1.05} color={CYAN} anchorX="center" anchorY="middle" outlineWidth={0.03} outlineColor="#05060a">
        {title}
      </Text>
      {skills.map((s, i) => (
        <Text key={i} position={[0, SKILL0 - i * LINE, 0]} fontSize={0.6} color={DIM} anchorX="center" anchorY="middle" outlineWidth={0.015} outlineColor="#05060a">
          {s}
        </Text>
      ))}
    </group>
  );
}

export function SkillsScene() {
  return (
    // Dropped in Y so the columns sit centred in frame (the camera looks below the scene origin
    // here) rather than crowding the top edge.
    <group position={[0, -5, AHEAD]}>
      {CLUSTERS.map(([title, x, skills]) => (
        <Cluster key={title} title={title} x={x} skills={skills} />
      ))}
    </group>
  );
}
