"use client";

import { Suspense, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Hud, OrthographicCamera, Text } from "@react-three/drei";
import { Vector3, type Camera, type Mesh } from "three";
import { words } from "@/lib/onomatopoeia";
import { popScale } from "@/lib/pops";
import { stepTime } from "@/lib/steppedClock";

/**
 * Renders the lib/onomatopoeia PopPool as Bangers lettering in a
 * screen-space Hud scene. renderPriority 2 draws AFTER the composer
 * (priority 1), so the words stay post-exempt and pixel-crisp (S2.16).
 * Pop-in/pop-out scale + rotation envelopes sample stepped time (S2.8); the
 * per-frame loop only mutates pooled objects -- zero allocation.
 */

type TroikaText = Mesh & { text: string; color: string; sync: () => void };

const ndc = new Vector3(); // shared projection scratch

function WordSprites({ mainCamera }: { mainCamera: Camera }) {
  const size = useThree((s) => s.size); // Hud portal inherits root size
  const refs = useRef<(TroikaText | null)[]>([]);
  const gens = useRef<number[]>(new Array<number>(words.slots.length).fill(-1));

  useFrame(() => {
    const now = performance.now();
    const halfW = size.width * 0.5;
    const halfH = size.height * 0.5;
    for (let i = 0; i < words.slots.length; i++) {
      const mesh = refs.current[i];
      if (!mesh) continue;
      const slot = words.slots[i]!;
      if (!slot.active) {
        mesh.visible = false;
        continue;
      }
      const age = words.age(slot, now);
      if (!slot.active) {
        mesh.visible = false; // outlived words.life, retired by age()
        continue;
      }
      if (gens.current[i] !== slot.gen) {
        gens.current[i] = slot.gen;
        mesh.text = slot.data.word;
        mesh.color = slot.data.color;
        mesh.sync();
      }
      ndc.copy(slot.pos).project(mainCamera);
      if (ndc.z > 1 || ndc.z < -1) {
        mesh.visible = false; // behind the camera / out of depth range
        continue;
      }
      const scale = popScale(age, words.life);
      if (scale <= 0.001) {
        mesh.visible = false;
        continue;
      }
      mesh.visible = true;
      mesh.position.set(ndc.x * halfW, ndc.y * halfH, 0);
      mesh.scale.setScalar(scale);
      mesh.rotation.z = (slot.seed - 0.5) * 0.5 + 0.05 * Math.sin(stepTime(age, 12) * 18);
    }
  });

  return (
    <Suspense fallback={null}>
      {words.slots.map((_, i) => (
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
