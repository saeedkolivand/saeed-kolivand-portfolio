"use client";

import type { RefObject } from "react";
import { BackSide, type Group } from "three";
import { toonRamp } from "@/lib/toon";

/**
 * CatModel -- the shared mascot (S1 through-line), extracted from the two
 * user-approved Phase 1 cats. Two builds under one API:
 *
 * - mode "flat": the flat-print 2D silhouette build (Cover style):
 *   overlapping connected shapes with tiny z offsets, viewed face-on inside
 *   a printed composition. pose "leaping" IS the approved cover cat
 *   (exact Phase 1 numbers).
 * - mode "toon": the dimensional lit-toon build (Desk style): ink volumes
 *   with paper rim hulls (inverted BackSide) so the cat reads from any
 *   angle and against dark surroundings. pose "sitting" IS the approved
 *   desk cat (exact Phase 1 numbers).
 *
 * Invariants carried from the Phase 1 user-directed fixes (DECISIONS.md
 * 2026-07-02): every leg/sock root sits INSIDE a body silhouette and the
 * tail pivot sits INSIDE the haunch, in every pose. Scene behavior
 * (breathe phase, pounce shadow, onomatopoeia, click meow) stays in the
 * scenes; parents animate head/paw/tail through the rig refs. Idle motion
 * a parent adds must sample stepTime (S2.8); scroll motion stays pure f(t).
 */

export type CatPose = "sitting" | "crouch" | "walking" | "leaping";
export type CatMode = "flat" | "toon";

export interface CatPalette {
  ink: string; // body
  paper: string; // socks, chest, muzzle, eye whites, whiskers, rim hulls
  collar: string; // collar band (identity mark, teal everywhere so far)
  tag: string; // collar tag + nose (identity mark, red everywhere so far)
  accent: string; // tail tip, toon eyes + inner ears (issue accent color)
}

export interface CatRig {
  head?: RefObject<Group | null>;
  paw?: RefObject<Group | null>; // toon build only (flat legs are static)
  tail?: RefObject<Group | null>;
}

interface CatModelProps {
  pose: CatPose;
  mode: CatMode;
  palette: CatPalette;
  rig?: CatRig;
}

type Vec3 = [number, number, number];

/* ----------------------------------------------------- flat-print build -- */

interface FlatPose {
  torso: [number, number]; // scale of the r 0.55 torso ellipse
  haunch: [number, number]; // xy of the r 0.4 hip circle
  head: { pos: Vec3; rot: number };
  legs: { pos: Vec3; rot: number; r: number; len: number }[];
  socks: { pos: Vec3; r: number }[]; // paper caps ON the capsule tips
  collar: { pos: Vec3; rot: number };
  tag: Vec3;
  tail: { pivot: Vec3; rot: number }; // pivot INSIDE the haunch
}

const FLAT_POSES: Record<CatPose, FlatPose> = {
  // mid-pounce: the approved Cover hero cat, byte-for-byte
  leaping: {
    torso: [1.5, 0.82],
    haunch: [-0.6, -0.05],
    head: { pos: [0.85, 0.36, 0.003], rot: 0 },
    legs: [
      { pos: [0.88, -0.14, 0.0008], rot: -1.05, r: 0.08, len: 0.5 },
      { pos: [1.08, 0.06, 0.002], rot: -1.25, r: 0.08, len: 0.55 },
      { pos: [-0.68, -0.34, 0.0008], rot: -0.35, r: 0.085, len: 0.48 },
      { pos: [-0.86, -0.3, 0.002], rot: -0.75, r: 0.085, len: 0.55 },
    ],
    socks: [
      { pos: [1.42, 0.17, 0.004], r: 0.08 },
      { pos: [1.17, 0.01, 0.004], r: 0.075 },
    ],
    collar: { pos: [0.6, 0.05, 0.005], rot: -1.15 },
    tag: [0.68, -0.1, 0.006],
    tail: { pivot: [-0.9, 0.15, 0.001], rot: 0 },
  },
  // upright sit, front paws planted, tail curled around the base
  sitting: {
    torso: [1.0, 1.3],
    haunch: [-0.12, -0.55],
    head: { pos: [0.12, 0.78, 0.003], rot: 0 },
    legs: [
      { pos: [0.22, -0.52, 0.0008], rot: 0, r: 0.08, len: 0.5 },
      { pos: [0.4, -0.5, 0.002], rot: -0.08, r: 0.08, len: 0.48 },
      { pos: [-0.12, -0.82, 0.002], rot: 1.45, r: 0.085, len: 0.3 },
    ],
    socks: [
      { pos: [0.22, -0.85, 0.004], r: 0.08 },
      { pos: [0.38, -0.82, 0.004], r: 0.075 },
    ],
    collar: { pos: [0.12, 0.44, 0.005], rot: 0 },
    tag: [0.12, 0.3, 0.006],
    tail: { pivot: [-0.35, -0.62, 0.001], rot: 0.85 },
  },
  // low anticipation crouch, legs tucked, tail flat behind
  crouch: {
    torso: [1.7, 0.62],
    haunch: [-0.7, -0.02],
    head: { pos: [0.88, 0.12, 0.003], rot: -0.1 },
    legs: [
      { pos: [0.6, -0.22, 0.0008], rot: 1.35, r: 0.08, len: 0.42 },
      { pos: [-0.52, -0.24, 0.002], rot: 1.45, r: 0.085, len: 0.42 },
    ],
    socks: [{ pos: [0.86, -0.28, 0.004], r: 0.07 }],
    collar: { pos: [0.66, 0.08, 0.005], rot: -1.3 },
    tag: [0.72, -0.06, 0.006],
    tail: { pivot: [-0.95, 0.05, 0.001], rot: -0.85 },
  },
  // mid-stride walk, diagonal legs, question-mark tail
  walking: {
    torso: [1.55, 0.78],
    haunch: [-0.62, -0.06],
    head: { pos: [0.84, 0.32, 0.003], rot: 0 },
    legs: [
      { pos: [0.55, -0.42, 0.0008], rot: 0.3, r: 0.08, len: 0.46 },
      { pos: [0.3, -0.38, 0.002], rot: -0.35, r: 0.08, len: 0.46 },
      { pos: [-0.58, -0.42, 0.0008], rot: -0.3, r: 0.085, len: 0.46 },
      { pos: [-0.78, -0.36, 0.002], rot: 0.4, r: 0.085, len: 0.46 },
    ],
    socks: [
      { pos: [0.64, -0.71, 0.004], r: 0.08 },
      { pos: [0.19, -0.67, 0.004], r: 0.075 },
    ],
    collar: { pos: [0.58, 0.1, 0.005], rot: -1.2 },
    tag: [0.64, -0.04, 0.006],
    tail: { pivot: [-0.88, 0.1, 0.001], rot: 0.5 },
  },
};

function FlatCat({ def, p, rig }: { def: FlatPose; p: CatPalette; rig?: CatRig }) {
  const ramp = toonRamp();
  return (
    <group>
      {/* torso ellipse + haunch keep every limb rooted in one silhouette */}
      <mesh scale={[def.torso[0], def.torso[1], 1]}>
        <circleGeometry args={[0.55, 40]} />
        <meshToonMaterial color={p.ink} gradientMap={ramp} />
      </mesh>
      <mesh position={[def.haunch[0], def.haunch[1], 0.0005]}>
        <circleGeometry args={[0.4, 40]} />
        <meshToonMaterial color={p.ink} gradientMap={ramp} />
      </mesh>

      {/* legs: rounded capsules (caps = paws); root ends stay INSIDE the
          torso/haunch silhouette in every pose (Phase 1 invariant) */}
      {def.legs.map((l, i) => (
        <mesh key={i} position={l.pos} rotation={[0, 0, l.rot]}>
          <capsuleGeometry args={[l.r, l.len, 4, 10]} />
          <meshToonMaterial color={p.ink} gradientMap={ramp} />
        </mesh>
      ))}
      {/* paper socks sit ON the capsule tips (Desk cat identity echo) */}
      {def.socks.map((s, i) => (
        <mesh key={i} position={s.pos}>
          <circleGeometry args={[s.r, 16]} />
          <meshToonMaterial color={p.paper} gradientMap={ramp} />
        </mesh>
      ))}

      {/* head overlaps the torso -- ears are 3-gon circles */}
      <group ref={rig?.head} position={def.head.pos} rotation={[0, 0, def.head.rot]}>
        <mesh>
          <circleGeometry args={[0.37, 40]} />
          <meshToonMaterial color={p.ink} gradientMap={ramp} />
        </mesh>
        <mesh position={[-0.17, 0.36, 0]} rotation={[0, 0, Math.PI / 2 + 0.15]}>
          <circleGeometry args={[0.16, 3]} />
          <meshToonMaterial color={p.ink} gradientMap={ramp} />
        </mesh>
        <mesh position={[0.17, 0.37, 0]} rotation={[0, 0, Math.PI / 2 - 0.15]}>
          <circleGeometry args={[0.16, 3]} />
          <meshToonMaterial color={p.ink} gradientMap={ramp} />
        </mesh>
        {/* eyes: paper almonds + ink pupils -- reads at 200px */}
        <mesh position={[-0.13, 0.02, 0.002]} scale={[0.8, 1.15, 1]}>
          <circleGeometry args={[0.085, 20]} />
          <meshToonMaterial color={p.paper} gradientMap={ramp} />
        </mesh>
        <mesh position={[0.15, 0.04, 0.002]} scale={[0.8, 1.15, 1]}>
          <circleGeometry args={[0.085, 20]} />
          <meshToonMaterial color={p.paper} gradientMap={ramp} />
        </mesh>
        <mesh position={[-0.12, 0.01, 0.004]}>
          <circleGeometry args={[0.035, 12]} />
          <meshToonMaterial color={p.ink} gradientMap={ramp} />
        </mesh>
        <mesh position={[0.16, 0.03, 0.004]}>
          <circleGeometry args={[0.035, 12]} />
          <meshToonMaterial color={p.ink} gradientMap={ramp} />
        </mesh>
        {/* 3-gon nose, point down */}
        <mesh position={[0.02, -0.13, 0.002]} rotation={[0, 0, -Math.PI / 2]}>
          <circleGeometry args={[0.055, 3]} />
          <meshToonMaterial color={p.tag} gradientMap={ramp} />
        </mesh>
        {/* whiskers -- thin paper strokes */}
        <mesh position={[-0.31, -0.09, 0.002]} rotation={[0, 0, 0.12]}>
          <planeGeometry args={[0.26, 0.018]} />
          <meshToonMaterial color={p.paper} gradientMap={ramp} />
        </mesh>
        <mesh position={[-0.32, -0.16, 0.002]} rotation={[0, 0, -0.06]}>
          <planeGeometry args={[0.24, 0.018]} />
          <meshToonMaterial color={p.paper} gradientMap={ramp} />
        </mesh>
        <mesh position={[0.34, -0.07, 0.002]} rotation={[0, 0, -0.12]}>
          <planeGeometry args={[0.26, 0.018]} />
          <meshToonMaterial color={p.paper} gradientMap={ramp} />
        </mesh>
        <mesh position={[0.35, -0.14, 0.002]} rotation={[0, 0, 0.06]}>
          <planeGeometry args={[0.24, 0.018]} />
          <meshToonMaterial color={p.paper} gradientMap={ramp} />
        </mesh>
      </group>

      {/* collar band across the neck + tag */}
      <mesh position={def.collar.pos} rotation={[0, 0, def.collar.rot]}>
        <planeGeometry args={[0.46, 0.1]} />
        <meshToonMaterial color={p.collar} gradientMap={ramp} />
      </mesh>
      <mesh position={def.tag}>
        <circleGeometry args={[0.06, 12]} />
        <meshToonMaterial color={p.tag} gradientMap={ramp} />
      </mesh>

      {/* tail -- torus arc pivoting at its base end; the pivot sits INSIDE
          the haunch circle in every pose or a flick reads as a detached
          floating arc (Phase 1 invariant). Parents flick rotation.z. */}
      <group ref={rig?.tail} position={def.tail.pivot} rotation={[0, 0, def.tail.rot]}>
        <mesh position={[-0.42, 0, 0]}>
          <torusGeometry args={[0.42, 0.07, 8, 24, 2.05]} />
          <meshToonMaterial color={p.ink} gradientMap={ramp} />
        </mesh>
        <mesh position={[-0.614, 0.373, 0.002]}>
          <circleGeometry args={[0.075, 12]} />
          <meshToonMaterial color={p.accent} gradientMap={ramp} />
        </mesh>
      </group>
    </group>
  );
}

/* ------------------------------------------------------ lit-toon build -- */

interface ToonPose {
  scale: Vec3; // pose transform on the whole rig (sitting = identity)
  rot: number;
  head: Vec3; // default group positions -- rig-ref parents override per frame
  paw: Vec3;
}

const TOON_POSES: Record<CatPose, ToonPose> = {
  // neutral perch/loaf rig: the approved Desk cat, byte-for-byte (identity
  // pose transform; the Desk scene animates land/loaf/rear via rig refs)
  sitting: { scale: [1, 1, 1], rot: 0, head: [0.5, 0.62, 0], paw: [0.5, 0.42, 0.16] },
  crouch: { scale: [1.06, 0.78, 1], rot: 0, head: [0.54, 0.5, 0], paw: [0.52, 0.34, 0.16] },
  walking: { scale: [1.04, 0.96, 1], rot: -0.04, head: [0.56, 0.6, 0], paw: [0.64, 0.4, 0.16] },
  // stretched airborne attitude (echoes the Desk entrance squash-stretch)
  leaping: { scale: [1.12, 0.9, 1], rot: 0.2, head: [0.6, 0.68, 0], paw: [0.68, 0.52, 0.16] },
};

function ToonCat({ def, p, rig }: { def: ToonPose; p: CatPalette; rig?: CatRig }) {
  const ramp = toonRamp();
  return (
    <group scale={def.scale} rotation={[0, 0, def.rot]}>
      {/* body + paper rim outline (inverted hull) so ink reads against
          dark set pieces, not just light ones */}
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[0.95, 0.5, 0.48]} />
        <meshToonMaterial color={p.ink} gradientMap={ramp} />
      </mesh>
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[1.01, 0.56, 0.54]} />
        <meshBasicMaterial color={p.paper} side={BackSide} />
      </mesh>
      {/* chest patch */}
      <mesh position={[0.44, 0.26, 0]}>
        <boxGeometry args={[0.08, 0.26, 0.2]} />
        <meshToonMaterial color={p.paper} gradientMap={ramp} />
      </mesh>
      {/* collar + tag */}
      <mesh position={[0.42, 0.5, 0]}>
        <boxGeometry args={[0.12, 0.07, 0.4]} />
        <meshToonMaterial color={p.collar} gradientMap={ramp} />
      </mesh>
      <mesh position={[0.48, 0.43, 0]}>
        <boxGeometry args={[0.05, 0.08, 0.08]} />
        <meshToonMaterial color={p.tag} gradientMap={ramp} />
      </mesh>
      <group ref={rig?.head} position={def.head}>
        <mesh>
          <boxGeometry args={[0.44, 0.42, 0.42]} />
          <meshToonMaterial color={p.ink} gradientMap={ramp} />
        </mesh>
        <mesh>
          <boxGeometry args={[0.5, 0.48, 0.48]} />
          <meshBasicMaterial color={p.paper} side={BackSide} />
        </mesh>
        {/* ears + accent inner ears */}
        <mesh position={[0.08, 0.28, 0.12]} rotation={[0, 0, 0.25]}>
          <coneGeometry args={[0.09, 0.22, 4]} />
          <meshToonMaterial color={p.ink} gradientMap={ramp} />
        </mesh>
        <mesh position={[0.08, 0.28, -0.12]} rotation={[0, 0, -0.25]}>
          <coneGeometry args={[0.09, 0.22, 4]} />
          <meshToonMaterial color={p.ink} gradientMap={ramp} />
        </mesh>
        <mesh position={[0.1, 0.27, 0.12]} rotation={[0, 0, 0.25]}>
          <coneGeometry args={[0.05, 0.14, 4]} />
          <meshBasicMaterial color={p.accent} />
        </mesh>
        <mesh position={[0.1, 0.27, -0.12]} rotation={[0, 0, -0.25]}>
          <coneGeometry args={[0.05, 0.14, 4]} />
          <meshBasicMaterial color={p.accent} />
        </mesh>
        {/* eyes: flat accent + ink pupils (comic cat stare) */}
        <mesh position={[0.225, 0.06, 0.11]}>
          <boxGeometry args={[0.035, 0.11, 0.1]} />
          <meshBasicMaterial color={p.accent} />
        </mesh>
        <mesh position={[0.225, 0.06, -0.11]}>
          <boxGeometry args={[0.035, 0.11, 0.1]} />
          <meshBasicMaterial color={p.accent} />
        </mesh>
        <mesh position={[0.235, 0.04, 0.11]}>
          <boxGeometry args={[0.03, 0.06, 0.035]} />
          <meshBasicMaterial color={p.ink} />
        </mesh>
        <mesh position={[0.235, 0.04, -0.11]}>
          <boxGeometry args={[0.03, 0.06, 0.035]} />
          <meshBasicMaterial color={p.ink} />
        </mesh>
        {/* paper muzzle + nose */}
        <mesh position={[0.225, -0.12, 0]}>
          <boxGeometry args={[0.05, 0.13, 0.15]} />
          <meshToonMaterial color={p.paper} gradientMap={ramp} />
        </mesh>
        <mesh position={[0.245, -0.05, 0]}>
          <boxGeometry args={[0.03, 0.04, 0.05]} />
          <meshBasicMaterial color={p.tag} />
        </mesh>
      </group>
      <group ref={rig?.paw} position={def.paw}>
        <mesh position={[0, -0.18, 0]}>
          <cylinderGeometry args={[0.055, 0.06, 0.36, 8]} />
          <meshToonMaterial color={p.ink} gradientMap={ramp} />
        </mesh>
        {/* paper sock on the batting paw */}
        <mesh position={[0, -0.33, 0]}>
          <cylinderGeometry args={[0.06, 0.065, 0.1, 8]} />
          <meshToonMaterial color={p.paper} gradientMap={ramp} />
        </mesh>
      </group>
      <group ref={rig?.tail} position={[-0.48, 0.4, 0]} rotation={[0, 0, 0.9]}>
        <mesh position={[-0.18, 0.18, 0]} rotation={[0, 0, 0.9]}>
          <cylinderGeometry args={[0.05, 0.07, 0.55, 8]} />
          <meshToonMaterial color={p.ink} gradientMap={ramp} />
        </mesh>
        <mesh position={[-0.37, 0.34, 0]} rotation={[0, 0, 0.9]}>
          <cylinderGeometry args={[0.042, 0.05, 0.16, 8]} />
          <meshToonMaterial color={p.accent} gradientMap={ramp} />
        </mesh>
      </group>
    </group>
  );
}

/* -------------------------------------------------------------- export -- */

export default function CatModel({ pose, mode, palette, rig }: CatModelProps) {
  return mode === "flat" ? (
    <FlatCat def={FLAT_POSES[pose]} p={palette} rig={rig} />
  ) : (
    <ToonCat def={TOON_POSES[pose]} p={palette} rig={rig} />
  );
}
