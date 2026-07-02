"use client";

import { Suspense, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { Color, type Group, type Mesh } from "three";
import IssueShell from "./_IssueShell";
import { ISSUES } from "./registry";
import { toonRamp } from "@/lib/toon";
import { stepTime } from "@/lib/steppedClock";
import { useScrollStore } from "@/lib/scrollStore";

/**
 * Phase 0 placeholder set: a distinctly tinted box room, its name in
 * lettering, accent props, a S2.8 demo cube spinning on 2s while the
 * camera stays smooth, and the hidden cat (S1 -- one in every issue).
 */
export default function PlaceholderIssue({ index }: { index: number }) {
  const issue = ISSUES[index]!;
  const cube = useRef<Mesh>(null);
  const cat = useRef<Group>(null);
  const ramp = toonRamp();

  const wall = useMemo(
    () => new Color(issue.recipe.paper).lerp(new Color(issue.recipe.bg), 0.5).multiplyScalar(0.82),
    [issue],
  );
  const accent = (i: number) => issue.accents[i % issue.accents.length]!;

  useFrame(({ clock }) => {
    const s = stepTime(clock.elapsedTime, 12);
    if (cube.current) {
      cube.current.rotation.y = s * 0.9;
      cube.current.rotation.x = Math.sin(s * 0.7) * 0.3;
    }
    if (cat.current) cat.current.rotation.z = Math.sin(s * 2.1) * 0.12; // tail-ish idle
  });

  return (
    <IssueShell index={index} issue={issue}>
      {/* room */}
      <mesh>
        <boxGeometry args={[18, 10, 18]} />
        <meshToonMaterial color={wall} gradientMap={ramp} side={1} />
      </mesh>
      <mesh position={[0, -1.99, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[18, 18]} />
        <meshToonMaterial color={issue.recipe.paper} gradientMap={ramp} />
      </mesh>

      {/* stepped-time demo cube (S2.8) */}
      <mesh ref={cube} position={[0, 1, 0]}>
        <boxGeometry args={[1.6, 1.6, 1.6]} />
        <meshToonMaterial color={accent(0)} gradientMap={ramp} />
      </mesh>

      {/* accent props so each recipe reads differently */}
      <mesh position={[-3.2, -0.9, -2]}>
        <sphereGeometry args={[1.1, 24, 16]} />
        <meshToonMaterial color={accent(1)} gradientMap={ramp} />
      </mesh>
      <mesh position={[3.4, -0.5, -3]} rotation={[0, 0.6, 0.1]}>
        <cylinderGeometry args={[0.7, 0.7, 3, 20]} />
        <meshToonMaterial color={accent(index % 2 === 0 ? 0 : 1)} gradientMap={ramp} />
      </mesh>

      {/* label */}
      <Suspense fallback={null}>
        <Text
          font="/fonts/Bangers-Regular.ttf"
          fontSize={1.15}
          position={[0, 3.4, -6.5]}
          color={issue.recipe.ink}
          anchorX="center"
          anchorY="middle"
        >
          {issue.title}
        </Text>
      </Suspense>

      {/* the cat -- hidden in a corner, clickable (MEOW counter, S5b.5) */}
      <group
        ref={cat}
        position={[6.8, -1.55, 5.6]}
        rotation={[0, -2.3, 0]}
        onClick={(e) => {
          e.stopPropagation();
          useScrollStore.getState().meow();
        }}
      >
        <mesh position={[0, 0.25, 0]}>
          <boxGeometry args={[0.9, 0.5, 0.45]} />
          <meshToonMaterial color={issue.recipe.ink} gradientMap={ramp} />
        </mesh>
        <mesh position={[0.45, 0.62, 0]}>
          <boxGeometry args={[0.42, 0.4, 0.4]} />
          <meshToonMaterial color={issue.recipe.ink} gradientMap={ramp} />
        </mesh>
        <mesh position={[0.55, 0.88, 0.1]} rotation={[0, 0, 0.3]}>
          <coneGeometry args={[0.09, 0.22, 4]} />
          <meshToonMaterial color={issue.recipe.ink} gradientMap={ramp} />
        </mesh>
        <mesh position={[0.35, 0.88, -0.1]} rotation={[0, 0, -0.2]}>
          <coneGeometry args={[0.09, 0.22, 4]} />
          <meshToonMaterial color={issue.recipe.ink} gradientMap={ramp} />
        </mesh>
        <mesh position={[-0.55, 0.45, 0]} rotation={[0, 0, 1.1]}>
          <cylinderGeometry args={[0.05, 0.07, 0.7, 8]} />
          <meshToonMaterial color={issue.recipe.ink} gradientMap={ramp} />
        </mesh>
      </group>
    </IssueShell>
  );
}
