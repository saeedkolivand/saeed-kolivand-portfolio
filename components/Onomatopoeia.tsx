"use client";

import { Suspense, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Hud, OrthographicCamera, Text } from "@react-three/drei";
import { Vector3, type Camera, type Mesh } from "three";
import { wordPool, WORD_POOL_SIZE, WORD_LIFE } from "@/lib/onomatopoeia";
import { stepTime } from "@/lib/steppedClock";
import { clamp01 } from "@/lib/shots";

/**
 * Renders the lib/onomatopoeia pool as Bangers lettering in a screen-space
 * Hud scene. renderPriority 2 draws AFTER the composer (priority 1), so the
 * words stay post-exempt and pixel-crisp (S2.16). Pop-in/pop-out scale +
 * rotation envelopes sample stepped time (S2.8); the per-frame loop only
 * mutates pooled objects -- zero allocation.
 */

type TroikaText = Mesh & { text: string; color: string; sync: () => void };

const ndc = new Vector3(); // shared projection scratch

function WordSprites({ mainCamera }: { mainCamera: Camera }) {
  const size = useThree((s) => s.size); // Hud portal inherits root size
  const refs = useRef<(TroikaText | null)[]>([]);
  const gens = useRef<number[]>(new Array<number>(WORD_POOL_SIZE).fill(-1));

  useFrame(() => {
    const now = performance.now();
    const halfW = size.width * 0.5;
    const halfH = size.height * 0.5;
    for (let i = 0; i < WORD_POOL_SIZE; i++) {
      const mesh = refs.current[i];
      if (!mesh) continue;
      const slot = wordPool[i]!;
      if (!slot.active) {
        mesh.visible = false;
        continue;
      }
      const age = (now - slot.start) / 1000;
      if (age >= WORD_LIFE) {
        slot.active = false;
        mesh.visible = false;
        continue;
      }
      if (gens.current[i] !== slot.gen) {
        gens.current[i] = slot.gen;
        mesh.text = slot.word;
        mesh.color = slot.color;
        mesh.sync();
      }
      ndc.copy(slot.pos).project(mainCamera);
      if (ndc.z > 1 || ndc.z < -1) {
        mesh.visible = false; // behind the camera / out of depth range
        continue;
      }
      const sAge = stepTime(age, 12);
      const inP = clamp01(sAge / 0.14);
      const outP = clamp01((WORD_LIFE - sAge) / 0.18);
      const scale = inP * (1 + 0.4 * Math.sin(inP * Math.PI)) * outP;
      if (scale <= 0.001) {
        mesh.visible = false;
        continue;
      }
      mesh.visible = true;
      mesh.position.set(ndc.x * halfW, ndc.y * halfH, 0);
      mesh.scale.setScalar(scale);
      mesh.rotation.z = (slot.seed - 0.5) * 0.5 + 0.05 * Math.sin(sAge * 18);
    }
  });

  return (
    <Suspense fallback={null}>
      {wordPool.map((_, i) => (
        <Text
          key={i}
          ref={(el: unknown) => {
            refs.current[i] = el as TroikaText | null;
          }}
          font="/fonts/Bangers-Regular.ttf"
          fontSize={44}
          anchorX="center"
          anchorY="middle"
          outlineWidth={5}
          outlineColor="#14110E"
          color="#FFFFFF"
          visible={false}
        >
          {" "}
        </Text>
      ))}
    </Suspense>
  );
}

export default function Onomatopoeia() {
  const camera = useThree((s) => s.camera); // main scene camera (outside the Hud portal)
  return (
    <Hud renderPriority={2}>
      <OrthographicCamera makeDefault position={[0, 0, 100]} />
      <WordSprites mainCamera={camera} />
    </Hud>
  );
}
