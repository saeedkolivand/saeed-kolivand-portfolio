"use client";
import { Text, Line } from "@react-three/drei";
import { useLevelRoll } from "@/lib/useLevelRoll";

// TIMELINE — the career as a horizontal spine of dated milestones (oldest → newest, labels
// alternating above/below), with education + languages beneath. This spline section banks HARD and
// FAST (±34° across the region), so the group is levelled per-frame by useLevelRoll — a static
// counter-roll would only level one instant. Content edits inline.
const CYAN = "#8fd4ff";
const DIM = "#a9c6da";
const FAINT = "#6f97b5";

// Look-target position at the dwell (measured off spline+whip); re-measure if the spline or scene
// WEIGHTS (registry) change. Roll is handled dynamically by useLevelRoll, not here.
const ANCHOR: [number, number, number] = [0, 7.71, -14.02];

const SPINE = 15; // half-length of the horizontal spine line

type Job = { company: string; role: string; dates: string; x: number; above: boolean };
const JOBS: readonly Job[] = [
  { company: "Rechubplatform", role: "Frontend Developer", dates: "Jul 2018 – Jul 2020", x: -12, above: true },
  { company: "VASL", role: "Frontend Developer", dates: "Aug 2020 – Nov 2021", x: -4, above: false },
  { company: "Authin", role: "Frontend Developer", dates: "Dec 2021 – Nov 2022", x: 4, above: true },
  { company: "ACTINEO GmbH", role: "Senior Frontend Developer", dates: "Dec 2022 – Nov 2025", x: 12, above: false },
];

function Milestone({ company, role, dates, x, above }: Job) {
  const s = above ? 1 : -1; // stack the label block above or below the spine
  return (
    <group position={[x, 0, 0]}>
      <mesh>
        <icosahedronGeometry args={[0.28, 0]} />
        <meshBasicMaterial color={CYAN} toneMapped={false} />
      </mesh>
      <Line points={[[0, s * 0.35, 0], [0, s * 1.15, 0]]} color={CYAN} lineWidth={1} transparent opacity={0.4} toneMapped={false} />
      <Text position={[0, s * 2.85, 0]} fontSize={0.55} color={CYAN} anchorX="center" anchorY="middle" outlineWidth={0.02} outlineColor="#05060a">
        {company}
      </Text>
      <Text position={[0, s * 2.1, 0]} fontSize={0.4} color={DIM} anchorX="center" anchorY="middle">
        {role}
      </Text>
      <Text position={[0, s * 1.45, 0]} fontSize={0.36} color={FAINT} anchorX="center" anchorY="middle">
        {dates}
      </Text>
    </group>
  );
}

export function TimelineScene() {
  const root = useLevelRoll();
  return (
    <group ref={root} position={ANCHOR}>
      <Text position={[0, 4.6, 0]} fontSize={1} color={CYAN} anchorX="center" anchorY="middle" outlineWidth={0.03} outlineColor="#05060a" letterSpacing={0.15}>
        EXPERIENCE
      </Text>
      <Line points={[[-SPINE, 0, 0], [SPINE, 0, 0]]} color={CYAN} lineWidth={1.5} transparent opacity={0.5} toneMapped={false} />
      {JOBS.map((j) => (
        <Milestone key={j.company} {...j} />
      ))}
      <Text position={[0, -4, 0]} fontSize={0.42} color={DIM} anchorX="center" anchorY="middle">
        B.Sc. Computer Software Technology · Islamic Azad University · 2019 – 2021
      </Text>
      <Text position={[0, -4.8, 0]} fontSize={0.4} color={FAINT} anchorX="center" anchorY="middle" letterSpacing={0.08}>
        German · English · Persian
      </Text>
    </group>
  );
}
