"use client";
import { Text, Line } from "@react-three/drei";

// OPEN SOURCE — the four projects as a 2x2 grid of wireframe cards (name · tech · blurb · repo). Its
// scene centre sits at a hard ~25° camera bank, so the grid is anchored to the camera's measured
// look-target pose at the dwell (ANCHOR) and counter-rolled (ROLL) — otherwise it flies past tilted
// and half-off-frame. Measured off the spline+whip+bank at the scene centre. Content edits inline.
const CYAN = "#8fd4ff";
const DIM = "#a9c6da";
const FAINT = "#6f97b5";
const ANCHOR: [number, number, number] = [0, 1.98, -15.88]; // camera look-target, scene-local
const ROLL = 0.4452; // camera roll at the dwell — counter-rotate to level the cards

const CARD_W = 9.8;
const CARD_H = 6.2;

// closed rectangle outline in the XY plane
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

type Project = { name: string; tech: string; desc: string; repo: string; pos: [number, number] };
const PROJECTS: readonly Project[] = [
  { name: "AI Job Hunter", tech: "Tauri · React 19 · TypeScript", desc: "Local-first AI job-hunting desktop app. Multi-LLM, RAG job matching, streaming resume / cover-letter, ATS scoring, agentic Autopilot.", repo: "↗ /ai-job-hunter-app", pos: [-5.5, 3.6] },
  { name: "AI Engineering Hub", tech: "React · TanStack · REST + WebSocket", desc: "Local-first ops platform unifying AI-coding-tool metrics. Real-time API, dimensional analytics, Stream Deck plugin.", repo: "↗ /ai-engineering-hub", pos: [5.5, 3.6] },
  { name: "Claude Usage", tech: "Stream Deck · TypeScript · Node", desc: "Live Claude usage & limits. OAuth usage API, JSONL transcript parsing, dynamic SVG keys, OS keychain.", repo: "↗ /claude-usage-streamdeck-plugin", pos: [-5.5, -3.6] },
  { name: "Token Savings", tech: "Stream Deck · TypeScript · Node", desc: "Tracks AI-coding token savings. Measured-vs-estimated accounting, multi-project aggregation, SVG dashboards.", repo: "↗ /tokensaver-streamdeck-plugin", pos: [5.5, -3.6] },
];

function Card({ name, tech, desc, repo, pos }: Project) {
  return (
    <group position={[pos[0], pos[1], 0]}>
      <Line points={rect(CARD_W, CARD_H)} color={CYAN} lineWidth={1} transparent opacity={0.4} toneMapped={false} />
      <Text position={[0, CARD_H / 2 - 0.95, 0]} fontSize={0.62} color={CYAN} anchorX="center" anchorY="middle" outlineWidth={0.02} outlineColor="#05060a">
        {name}
      </Text>
      <Text position={[0, CARD_H / 2 - 1.7, 0]} fontSize={0.34} color={FAINT} anchorX="center" anchorY="middle" letterSpacing={0.03}>
        {tech}
      </Text>
      <Text position={[0, 0.1, 0]} fontSize={0.38} color={DIM} maxWidth={CARD_W - 1.2} textAlign="center" anchorX="center" anchorY="middle" lineHeight={1.28}>
        {desc}
      </Text>
      <Text position={[0, -CARD_H / 2 + 0.7, 0]} fontSize={0.36} color={FAINT} anchorX="center" anchorY="middle">
        {repo}
      </Text>
    </group>
  );
}

export function OpenSourceScene() {
  return (
    <group position={ANCHOR} rotation={[0, 0, ROLL]}>
      {PROJECTS.map((p) => (
        <Card key={p.name} {...p} />
      ))}
    </group>
  );
}
