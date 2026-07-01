"use client";
import { Text, Line } from "@react-three/drei";
import { useLevelRoll } from "@/lib/useLevelRoll";

// ARCHITECTURE — the local-first AI-app architecture Saeed builds, as a boxes-and-edges diagram:
// UI → Local Core ↔ LLM providers, Core → Store (RAG/vectors). Hard-banking spot, so the group is
// levelled per-frame (useLevelRoll). Content edits inline.
const CYAN = "#8fd4ff";
const DIM = "#a9c6da";
const FAINT = "#6f97b5";

const ANCHOR: [number, number, number] = [0, 0.84, -15.98]; // camera look-target at the dwell (measured)
const BW = 8; // box width
const BH = 2.4; // box height

const rect = (w: number, h: number): [number, number, number][] => {
  const x = w / 2;
  const y = h / 2;
  return [
    [-x, -y, 0],
    [x, -y, 0],
    [x, y, 0],
    [-x, y, 0],
    [-x, -y, 0],
  ];
};

type Box = { title: string; lines: [string, string]; pos: [number, number] };
const BOXES: readonly Box[] = [
  { title: "UI", lines: ["React · Next", "Zustand · Tailwind"], pos: [-13, 1.8] },
  { title: "Local-First Core", lines: ["Tauri · Node", "Drizzle ORM"], pos: [0, 1.8] },
  { title: "LLM Providers", lines: ["OpenAI · Anthropic", "Gemini · Ollama"], pos: [13, 1.8] },
  { title: "Store", lines: ["SQLite", "LanceDB vectors"], pos: [0, -2.8] },
];

function DiagramBox({ title, lines, pos }: Box) {
  return (
    <group position={[pos[0], pos[1], 0]}>
      <Line points={rect(BW, BH)} color={CYAN} lineWidth={1.2} transparent opacity={0.5} toneMapped={false} />
      <Text position={[0, BH / 2 - 0.55, 0]} fontSize={0.46} color={CYAN} anchorX="center" anchorY="middle">
        {title}
      </Text>
      <Text position={[0, -0.05, 0]} fontSize={0.32} color={DIM} anchorX="center" anchorY="middle">
        {lines[0]}
      </Text>
      <Text position={[0, -0.6, 0]} fontSize={0.32} color={FAINT} anchorX="center" anchorY="middle">
        {lines[1]}
      </Text>
    </group>
  );
}

function Edge({ a, b, label, lp }: { a: [number, number]; b: [number, number]; label: string; lp: [number, number] }) {
  return (
    <>
      <Line points={[[a[0], a[1], 0], [b[0], b[1], 0]]} color={CYAN} lineWidth={1} transparent opacity={0.4} toneMapped={false} />
      <Text position={[lp[0], lp[1], 0]} fontSize={0.3} color={FAINT} anchorX="center" anchorY="middle">
        {label}
      </Text>
    </>
  );
}

export function ArchitectureScene() {
  const root = useLevelRoll();
  return (
    <group ref={root} position={ANCHOR}>
      <Text position={[0, 4.3, 0]} fontSize={0.9} color={CYAN} anchorX="center" anchorY="middle" letterSpacing={0.15} outlineWidth={0.03} outlineColor="#05060a">
        ARCHITECTURE
      </Text>
      {/* edges under the boxes */}
      <Edge a={[-9, 1.8]} b={[-4, 1.8]} label="REST · WS" lp={[-6.5, 2.35]} />
      <Edge a={[4, 1.8]} b={[9, 1.8]} label="stream" lp={[6.5, 2.35]} />
      <Edge a={[0, 0.6]} b={[0, -1.6]} label="RAG · vectors" lp={[2.7, -0.5]} />
      {BOXES.map((b) => (
        <DiagramBox key={b.title} {...b} />
      ))}
    </group>
  );
}
