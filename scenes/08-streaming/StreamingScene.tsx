"use client";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import type { Mesh } from "three";
import { useScrollStore } from "@/lib/scrollStore";
import { useLevelRoll } from "@/lib/useLevelRoll";

// STREAMING — an LLM "generating" a profile of Saeed: a prompt, then the response streams in token by
// token with a cursor, looping. Reinforces the streaming-generation skill. Sits on a hard-banking
// spline section, so the group is levelled per-frame (useLevelRoll). Content edits inline.
const CYAN = "#8fd4ff";
const DIM = "#cfe4f2";
const FAINT = "#6f97b5";

const ANCHOR: [number, number, number] = [0, 4.02, -15.49]; // camera look-target at the dwell (measured)
const LEFT = -11; // left margin for the terminal-style block
const RATE = 11; // tokens revealed per second
const HOLD = 24; // tokens-worth of pause at full before looping (~1.8s at RATE)

const PROMPT = "▸ describe: Saeed Kolivand";
const RESPONSE =
  "Senior Frontend Engineer building AI-native, local-first software — multi-LLM integration, RAG semantic search, agentic automation, and streaming generation. Clean front-end architecture, premium UI, 6+ years of React · Next · TypeScript.";
const WORDS = RESPONSE.split(" ");

type TextMesh = Mesh & { text: string; sync: () => void };

export function StreamingScene() {
  const root = useLevelRoll();
  const body = useRef<TextMesh>(null);
  const acc = useRef(0);
  const shown = useRef(-1);

  // Reveal the response token by token off a clock, imperatively (no React re-render / no allocation).
  useFrame((_, delta) => {
    if (!body.current) return;
    let count: number;
    if (useScrollStore.getState().reducedMotion) {
      count = WORDS.length; // no animation: show the whole response
    } else {
      acc.current += delta * RATE;
      if (acc.current > 1e7) acc.current = 0; // keep the float bounded
      count = Math.min(WORDS.length, Math.floor(acc.current % (WORDS.length + HOLD)));
    }
    if (count === shown.current) return;
    shown.current = count;
    body.current.text = WORDS.slice(0, count).join(" ") + (count < WORDS.length ? " ▋" : "");
    body.current.sync();
  });

  return (
    <group ref={root} position={ANCHOR}>
      <Text position={[LEFT, 3.4, 0]} fontSize={0.62} color={CYAN} anchorX="left" anchorY="middle" outlineWidth={0.02} outlineColor="#05060a">
        {PROMPT}
      </Text>
      <Text ref={body} position={[LEFT, 2.2, 0]} fontSize={0.72} color={DIM} anchorX="left" anchorY="top" maxWidth={22} textAlign="left" lineHeight={1.35}>
        {""}
      </Text>
      <Text position={[LEFT, -4, 0]} fontSize={0.36} color={FAINT} anchorX="left" anchorY="middle" letterSpacing={0.05}>
        streaming generation · token by token
      </Text>
    </group>
  );
}
