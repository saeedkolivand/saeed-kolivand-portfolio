"use client";

import { Suspense, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import type { Group, Mesh } from "three";
import IssueShell from "../_IssueShell";
import { ISSUES } from "../registry";
import { RANGES } from "../timeline";
import { toonRamp } from "@/lib/toon";
import { stepTime } from "@/lib/steppedClock";
import { useScrollStore } from "@/lib/scrollStore";
import { lettering } from "@/lib/content";
import { clamp01, easeOutCubic } from "@/lib/shots";

/**
 * Issue #0 -- the COVER (S7 Phase 1). The loading screen IS Issue #1's
 * printed comic cover: at t=0 four art layers sit almost coplanar so the
 * whole thing reads as a flat print; as t moves 0->0.030 the layers
 * separate in z (pure f(t)) while the camera crash-dollies in, feeding the
 * crash-through tear in the 0.030-0.040 gutter. Attract mode (before
 * scroll) breathes the layers and flicks the cat tail on 12fps stepTime;
 * the DOM attract prompt lives in components/Lettering.tsx -- not here.
 *
 * All copy comes from lettering.cover (lib/content.ts). In-scene cover
 * type is drei Text INSIDE the post pipeline deliberately: the print
 * treatment IS the cover look (crisp solid fills only, S2.16).
 */

// S0.4 Cover palette row
const PAPER = "#F2EAD9";
const INK = "#201D18";
const RED = "#E2574C";
const TEAL = "#2BB3A3";

const BANGERS = "/fonts/Bangers-Regular.ttf";
const COVER_END = RANGES[0]![1];

// Masthead splits into a small kicker line + a big main line so long names
// ("SAEED KOLIVAND", 14 chars) never clip or collide with the price box.
// Sizes derive from string length -- content.ts can change without relayout.
const MAST_WORDS = lettering.cover.masthead.split(" ");
const MAST_KICKER = MAST_WORDS.length > 1 ? MAST_WORDS[0]! : "";
const MAST_MAIN =
  MAST_WORDS.length > 1 ? MAST_WORDS.slice(1).join(" ") : lettering.cover.masthead;
const MAST_MAIN_SIZE = Math.min(1.18, 9.4 / Math.max(MAST_MAIN.length, 1));
const MAST_KICKER_SIZE = Math.min(0.56, 4.2 / Math.max(MAST_KICKER.length, 1));

// z at full separation (wu) + tiny coplanar base so t=0 never z-fights
const LAYER = {
  art: { base: 0.015, depth: 0.55 },
  hero: { base: 0.03, depth: 1.3 },
  letter: { base: 0.05, depth: 2.1 },
} as const;

const RAY_COUNT = 16;

export default function Cover({ index }: { index: number }) {
  const issue = ISSUES[index]!;
  const ramp = toonRamp();
  const art = useRef<Group>(null);
  const hero = useRef<Group>(null);
  const letter = useRef<Group>(null);
  const tail = useRef<Group>(null);
  const shadow = useRef<Mesh>(null);

  // barcode bars derived deterministically from the GitHub handle
  const barcode = useMemo(() => {
    const bars: { x: number; w: number }[] = [];
    let x = 0;
    for (const ch of lettering.cover.barcode) {
      const c = ch.charCodeAt(0);
      const w1 = 0.022 + (c % 3) * 0.012;
      bars.push({ x, w: w1 });
      x += w1 + 0.016;
      const w2 = 0.022 + ((c >> 3) % 3) * 0.012;
      bars.push({ x, w: w2 });
      x += w2 + 0.024;
    }
    return { bars, width: x - 0.024 };
  }, []);

  useFrame(({ clock }) => {
    const { t, reducedMotion } = useScrollStore.getState();
    // depth separation: pure f(t), fully open by the end of the cover range
    const sep = easeOutCubic(clamp01(t / COVER_END));
    // attract breathing fades out as the print gains real depth
    const breathe = reducedMotion ? 0 : 1 - sep;
    const el = clock.elapsedTime;
    // breathe term stays >= 0: a raw sine dips layers BEHIND the opaque
    // paper board (z < 0) and flat shapes vanish for half of every cycle.
    // ONE shared phase for all layers: with per-layer phases the art sine
    // can overtake the hero sine and the burst disc plane rises INTO the
    // cat's intra-group z span, slicing the cat (flat torso/head circles
    // hide behind the disc while capsule legs / torus tail bulge through).
    // Shared phase + amplitudes that grow with the layer keep
    // art < hero < letter invariant for every t and every breath.
    const z = (l: { base: number; depth: number }, amp: number) =>
      l.base + l.depth * sep + breathe * amp * (0.5 + 0.5 * Math.sin(el * 0.85));
    if (art.current) art.current.position.z = z(LAYER.art, 0.05);
    if (hero.current) hero.current.position.z = z(LAYER.hero, 0.09);
    if (letter.current) letter.current.position.z = z(LAYER.letter, 0.13);
    if (shadow.current) {
      // pounce shadow shrinks away as the print separates (stays attached
      // to the composition -- no orphaned ink blob during the crash push)
      const k = 1 - sep;
      shadow.current.scale.set(1.3 * k + 0.001, 0.22 * k + 0.001, 1);
    }
    if (tail.current) {
      const s = stepTime(el, 12); // S2.8 -- 12fps tail flick, camera stays smooth
      tail.current.rotation.z = reducedMotion
        ? 0
        : Math.sin(s * 2.6) * 0.28 + Math.sin(s * 0.6) * 0.1;
    }
  });

  return (
    <IssueShell index={index} issue={issue}>
      {/* ink void behind the floating print */}
      <mesh position={[0, 1, -8]}>
        <planeGeometry args={[70, 70]} />
        <meshToonMaterial color={INK} gradientMap={ramp} />
      </mesh>

      {/* the cover, centered at y=1 (camera in shots.ts frames this) */}
      <group position={[0, 1, 0]}>
        {/* L0 paper board + printed trim frame (stays flat, receives the tear) */}
        <mesh>
          <planeGeometry args={[6.4, 9.6]} />
          <meshToonMaterial color={PAPER} gradientMap={ramp} />
        </mesh>
        <mesh position={[0, 4.73, 0.008]}>
          <planeGeometry args={[6.4, 0.14]} />
          <meshToonMaterial color={INK} gradientMap={ramp} />
        </mesh>
        <mesh position={[0, -4.73, 0.008]}>
          <planeGeometry args={[6.4, 0.14]} />
          <meshToonMaterial color={INK} gradientMap={ramp} />
        </mesh>
        <mesh position={[-3.13, 0, 0.008]}>
          <planeGeometry args={[0.14, 9.6]} />
          <meshToonMaterial color={INK} gradientMap={ramp} />
        </mesh>
        <mesh position={[3.13, 0, 0.008]}>
          <planeGeometry args={[0.14, 9.6]} />
          <meshToonMaterial color={INK} gradientMap={ramp} />
        </mesh>

        {/* L1 -- background art: comic sunburst. Teal core disc, tapered red
            wedge rays (alternating long/short, bases tucked under the disc),
            thin paper ring so it reads as printed energy, not a solid ball */}
        <group ref={art}>
          {Array.from({ length: RAY_COUNT }, (_, i) => {
            const a = (i / RAY_COUNT) * Math.PI * 2 + 0.13;
            const long = i % 2 === 0;
            const r = long ? 2.35 : 2.3;
            return (
              <mesh
                key={i}
                position={[Math.cos(a) * r, -0.4 + Math.sin(a) * r, -0.004]}
                rotation={[0, 0, a]}
                scale={[long ? 0.65 : 0.5, long ? 0.42 : 0.34, 1]}
              >
                <circleGeometry args={[1, 3]} />
                <meshToonMaterial color={RED} gradientMap={ramp} />
              </mesh>
            );
          })}
          <mesh position={[0, -0.4, 0]}>
            <circleGeometry args={[2.55, 48]} />
            <meshToonMaterial color={TEAL} gradientMap={ramp} />
          </mesh>
          <mesh position={[0, -0.4, 0.002]}>
            <ringGeometry args={[2.28, 2.36, 64]} />
            <meshToonMaterial color={PAPER} gradientMap={ramp} />
          </mesh>
        </group>

        {/* L2 -- hero art: the cat, mid-pounce toward the masthead (S1
            through-line; clickable meow, S5b.5). Flat-print silhouette:
            overlapping ink shapes stay connected, paper face details, teal
            collar + red tag (identity marks shared with the Desk cat),
            torus-arc tail that flicks on stepped time. */}
        <group
          ref={hero}
          position={[0, -0.75, 0.03]}
          onClick={(e) => {
            e.stopPropagation();
            useScrollStore.getState().meow();
          }}
        >
          {/* pounce shadow -- rides the SAME layer as the cat (never
              spatially detaches under parallax); just behind the body ink
              yet always in front of the burst (hero-art base gap 0.015).
              Shrinks with separation, pure f(t). */}
          <mesh ref={shadow} position={[-0.15, -1.3, -0.008]} scale={[1.3, 0.22, 1]}>
            <circleGeometry args={[1, 32]} />
            <meshToonMaterial color={INK} gradientMap={ramp} />
          </mesh>
          <group scale={1.3} rotation={[0, 0, 0.42]}>
            {/* torso ellipse + haunch keep every limb rooted in one silhouette */}
            <mesh scale={[1.5, 0.82, 1]}>
              <circleGeometry args={[0.55, 40]} />
              <meshToonMaterial color={INK} gradientMap={ramp} />
            </mesh>
            <mesh position={[-0.6, -0.05, 0.0005]}>
              <circleGeometry args={[0.4, 40]} />
              <meshToonMaterial color={INK} gradientMap={ramp} />
            </mesh>

            {/* front legs stretched at the masthead (rounded caps = paws).
                Shoulder ends must land INSIDE the torso ellipse (rx 0.825,
                ry 0.451) so the limbs stay rooted in the silhouette. */}
            <mesh position={[0.88, -0.14, 0.0008]} rotation={[0, 0, -1.05]}>
              <capsuleGeometry args={[0.08, 0.5, 4, 10]} />
              <meshToonMaterial color={INK} gradientMap={ramp} />
            </mesh>
            <mesh position={[1.08, 0.06, 0.002]} rotation={[0, 0, -1.25]}>
              <capsuleGeometry args={[0.08, 0.55, 4, 10]} />
              <meshToonMaterial color={INK} gradientMap={ramp} />
            </mesh>
            {/* paper socks sit ON the capsule tips (Desk cat identity echo) */}
            <mesh position={[1.42, 0.17, 0.004]}>
              <circleGeometry args={[0.08, 16]} />
              <meshToonMaterial color={PAPER} gradientMap={ramp} />
            </mesh>
            <mesh position={[1.17, 0.01, 0.004]}>
              <circleGeometry args={[0.075, 16]} />
              <meshToonMaterial color={PAPER} gradientMap={ramp} />
            </mesh>

            {/* hind legs trailing the pounce */}
            <mesh position={[-0.68, -0.34, 0.0008]} rotation={[0, 0, -0.35]}>
              <capsuleGeometry args={[0.085, 0.48, 4, 10]} />
              <meshToonMaterial color={INK} gradientMap={ramp} />
            </mesh>
            <mesh position={[-0.86, -0.3, 0.002]} rotation={[0, 0, -0.75]}>
              <capsuleGeometry args={[0.085, 0.55, 4, 10]} />
              <meshToonMaterial color={INK} gradientMap={ramp} />
            </mesh>

            {/* head overlaps the torso front -- ears are 3-gon circles */}
            <group position={[0.85, 0.36, 0.003]}>
              <mesh>
                <circleGeometry args={[0.37, 40]} />
                <meshToonMaterial color={INK} gradientMap={ramp} />
              </mesh>
              <mesh position={[-0.17, 0.36, 0]} rotation={[0, 0, Math.PI / 2 + 0.15]}>
                <circleGeometry args={[0.16, 3]} />
                <meshToonMaterial color={INK} gradientMap={ramp} />
              </mesh>
              <mesh position={[0.17, 0.37, 0]} rotation={[0, 0, Math.PI / 2 - 0.15]}>
                <circleGeometry args={[0.16, 3]} />
                <meshToonMaterial color={INK} gradientMap={ramp} />
              </mesh>
              {/* eyes: paper almonds + ink pupils -- reads at 200px */}
              <mesh position={[-0.13, 0.02, 0.002]} scale={[0.8, 1.15, 1]}>
                <circleGeometry args={[0.085, 20]} />
                <meshToonMaterial color={PAPER} gradientMap={ramp} />
              </mesh>
              <mesh position={[0.15, 0.04, 0.002]} scale={[0.8, 1.15, 1]}>
                <circleGeometry args={[0.085, 20]} />
                <meshToonMaterial color={PAPER} gradientMap={ramp} />
              </mesh>
              <mesh position={[-0.12, 0.01, 0.004]}>
                <circleGeometry args={[0.035, 12]} />
                <meshToonMaterial color={INK} gradientMap={ramp} />
              </mesh>
              <mesh position={[0.16, 0.03, 0.004]}>
                <circleGeometry args={[0.035, 12]} />
                <meshToonMaterial color={INK} gradientMap={ramp} />
              </mesh>
              {/* red 3-gon nose, point down */}
              <mesh position={[0.02, -0.13, 0.002]} rotation={[0, 0, -Math.PI / 2]}>
                <circleGeometry args={[0.055, 3]} />
                <meshToonMaterial color={RED} gradientMap={ramp} />
              </mesh>
              {/* whiskers -- thin paper strokes */}
              <mesh position={[-0.31, -0.09, 0.002]} rotation={[0, 0, 0.12]}>
                <planeGeometry args={[0.26, 0.018]} />
                <meshToonMaterial color={PAPER} gradientMap={ramp} />
              </mesh>
              <mesh position={[-0.32, -0.16, 0.002]} rotation={[0, 0, -0.06]}>
                <planeGeometry args={[0.24, 0.018]} />
                <meshToonMaterial color={PAPER} gradientMap={ramp} />
              </mesh>
              <mesh position={[0.34, -0.07, 0.002]} rotation={[0, 0, -0.12]}>
                <planeGeometry args={[0.26, 0.018]} />
                <meshToonMaterial color={PAPER} gradientMap={ramp} />
              </mesh>
              <mesh position={[0.35, -0.14, 0.002]} rotation={[0, 0, 0.06]}>
                <planeGeometry args={[0.24, 0.018]} />
                <meshToonMaterial color={PAPER} gradientMap={ramp} />
              </mesh>
            </group>

            {/* teal collar band across the neck + red tag */}
            <mesh position={[0.6, 0.05, 0.005]} rotation={[0, 0, -1.15]}>
              <planeGeometry args={[0.46, 0.1]} />
              <meshToonMaterial color={TEAL} gradientMap={ramp} />
            </mesh>
            <mesh position={[0.68, -0.1, 0.006]}>
              <circleGeometry args={[0.06, 12]} />
              <meshToonMaterial color={RED} gradientMap={ramp} />
            </mesh>

            {/* tail -- torus arc pivoting at its base, flicked on stepped
                time. The arc's base end sits AT the group origin, so the
                pivot must be INSIDE the haunch circle (center -0.6,-0.05
                r 0.4) or the flick reads as a detached floating arc. */}
            <group ref={tail} position={[-0.9, 0.15, 0.001]}>
              <mesh position={[-0.42, 0, 0]}>
                <torusGeometry args={[0.42, 0.07, 8, 24, 2.05]} />
                <meshToonMaterial color={INK} gradientMap={ramp} />
              </mesh>
              <mesh position={[-0.614, 0.373, 0.002]}>
                <circleGeometry args={[0.075, 12]} />
                <meshToonMaterial color={RED} gradientMap={ramp} />
              </mesh>
            </group>

            {/* speed dashes trailing the pounce (technique vocabulary, S1) */}
            <mesh position={[-1.8, -0.55, 0.001]}>
              <planeGeometry args={[0.8, 0.06]} />
              <meshToonMaterial color={RED} gradientMap={ramp} />
            </mesh>
            <mesh position={[-2.0, -0.2, 0.001]}>
              <planeGeometry args={[0.6, 0.05]} />
              <meshToonMaterial color={RED} gradientMap={ramp} />
            </mesh>
            <mesh position={[-1.7, -0.9, 0.001]}>
              <planeGeometry args={[0.5, 0.045]} />
              <meshToonMaterial color={RED} gradientMap={ramp} />
            </mesh>
          </group>
        </group>

        {/* L3 -- lettering plate: masthead, issue line, price box, blurb, barcode */}
        <group ref={letter}>
          <Suspense fallback={null}>
            {/* two-line masthead: small kicker centered above the big main
                line -- both clear of the price box in the top-left corner */}
            {MAST_KICKER !== "" && (
              <Text
                font={BANGERS}
                fontSize={MAST_KICKER_SIZE}
                letterSpacing={0.3}
                position={[0, 4.14, 0]}
                color={INK}
                anchorX="center"
                anchorY="middle"
              >
                {MAST_KICKER}
              </Text>
            )}
            {/* main line with a solid offset print shadow (crisp, zero blur) */}
            <Text
              font={BANGERS}
              fontSize={MAST_MAIN_SIZE}
              letterSpacing={0.02}
              position={[0.06, 3.08, -0.006]}
              color={RED}
              anchorX="center"
              anchorY="middle"
            >
              {MAST_MAIN}
            </Text>
            <Text
              font={BANGERS}
              fontSize={MAST_MAIN_SIZE}
              letterSpacing={0.02}
              position={[0, 3.14, 0]}
              color={INK}
              anchorX="center"
              anchorY="middle"
            >
              {MAST_MAIN}
            </Text>
            <Text
              font={BANGERS}
              fontSize={0.26}
              letterSpacing={0.08}
              position={[0, 2.4, 0]}
              color={INK}
              anchorX="center"
              anchorY="middle"
            >
              {lettering.cover.issueLine}
            </Text>

            {/* price-box gag, top-left corner -- beside the kicker, fully
                above the main masthead line (no overlap) */}
            <group position={[-2.42, 4.14, 0.012]}>
              <mesh>
                <planeGeometry args={[1.4, 0.94]} />
                <meshToonMaterial color={INK} gradientMap={ramp} />
              </mesh>
              <mesh position={[0, 0, 0.003]}>
                <planeGeometry args={[1.3, 0.84]} />
                <meshToonMaterial color={PAPER} gradientMap={ramp} />
              </mesh>
              <Text
                font={BANGERS}
                fontSize={0.2}
                maxWidth={1.15}
                textAlign="center"
                lineHeight={1.1}
                position={[0, 0, 0.006]}
                color={INK}
                anchorX="center"
                anchorY="middle"
              >
                {lettering.cover.priceBox}
              </Text>
            </group>

            {/* blurb banner */}
            <group position={[0, -2.95, 0]}>
              <mesh>
                <planeGeometry args={[6.08, 1.14]} />
                <meshToonMaterial color={INK} gradientMap={ramp} />
              </mesh>
              <mesh position={[0, 0, 0.003]}>
                <planeGeometry args={[6.0, 1.06]} />
                <meshToonMaterial color={RED} gradientMap={ramp} />
              </mesh>
              <Text
                font={BANGERS}
                fontSize={0.27}
                maxWidth={5.6}
                textAlign="center"
                lineHeight={1.15}
                position={[0, 0, 0.006]}
                color={PAPER}
                anchorX="center"
                anchorY="middle"
              >
                {lettering.cover.blurb}
              </Text>
            </group>

            {/* barcode = GitHub handle, bottom-right */}
            <group position={[1.95, -4.02, 0.01]}>
              <mesh>
                <planeGeometry args={[1.88, 1.08]} />
                <meshToonMaterial color={INK} gradientMap={ramp} />
              </mesh>
              <mesh position={[0, 0, 0.003]}>
                <planeGeometry args={[1.8, 1.0]} />
                <meshToonMaterial color={PAPER} gradientMap={ramp} />
              </mesh>
              {barcode.bars.map((b, i) => (
                <mesh
                  key={i}
                  position={[-barcode.width / 2 + b.x + b.w / 2, 0.14, 0.006]}
                  scale={[b.w, 0.52, 1]}
                >
                  <planeGeometry />
                  <meshToonMaterial color={INK} gradientMap={ramp} />
                </mesh>
              ))}
              <Text
                font={BANGERS}
                fontSize={0.15}
                letterSpacing={0.12}
                position={[0, -0.32, 0.006]}
                color={INK}
                anchorX="center"
                anchorY="middle"
              >
                {lettering.cover.barcode}
              </Text>
            </group>
          </Suspense>
        </group>
      </group>
    </IssueShell>
  );
}
