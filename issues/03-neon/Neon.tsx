"use client";

import { Suspense, useLayoutEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { Color, Object3D, type Group, type InstancedMesh, type MeshBasicMaterial } from "three";
import IssueShell from "../_IssueShell";
import { ISSUES } from "../registry";
import CatModel, { HARLEY, type CatPalette } from "@/components/CatModel";
import { toonRamp } from "@/lib/toon";
import { stepTime, stepNoise } from "@/lib/steppedClock";
import { useScrollStore } from "@/lib/scrollStore";
import { clamp01 } from "@/lib/shots";
import { lettering } from "@/lib/content";
import { NEON_CASCADE_T, NEON_CASCADE_END } from "./shots";

/**
 * Issue 3 NEON INK / CODE CITY (S0.3 range [0.225, 0.305], palette S0.4 row 3).
 * Black-paper world printed in flat saturated neon inks: code-block buildings
 * (facade stripes = syntax-highlighted code lines), roads as glowing ink
 * lines, krackle energy dots, neon signage from content.lettering.neonSigns.
 *
 * JAW-DROP: the power-on cascade. The city boots in a quantized radial wave
 * from the landing point -- pure f(t) through [NEON_CASCADE_T, NEON_CASCADE_END],
 * so scrubbing either direction is deterministic. The wave radius is stepped
 * into CASCADE_STEPS discrete rings (the "on 2s" block-by-block boot); color
 * uploads happen only when the step changes. S2.16: power-on is a single
 * dim->lit step per element, no oscillating emissives, no flicker loops; the
 * only flash is the beat-driven fx.impact pop, which is requestFlash()-gated
 * in lib/beats.ts.
 */

// ---- palette (S0.4 row 3 -- locked) ----------------------------------------
const PAPER = "#060608";
const INK = "#EDEDF2";
const SYNTAX = ["#00E5FF", "#FF3D9A", "#B7FF2E", "#FF9E1F", "#8A7DFF"];
const ROAD = "#00E5FF";

// dim multipliers (palette colors scaled toward black paper, S0.4 allows this)
const DIM_LINE = 0.12;
const DIM_ROAD = 0.08;

// ---- cascade ---------------------------------------------------------------
const LANDING_X = 0;
const LANDING_Z = 4;
const CASCADE_STEPS = 10;
const MAX_R = 58;

const cascadeRadius = (t: number) => {
  const p = clamp01((t - NEON_CASCADE_T) / (NEON_CASCADE_END - NEON_CASCADE_T));
  const step = Math.min(CASCADE_STEPS, Math.floor(p * (CASCADE_STEPS + 1)));
  return (step / CASCADE_STEPS) * MAX_R;
};

// ---- deterministic city layout (module scope, no window) --------------------
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface BlockData {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  ci: number;
  dist: number;
  preLit: boolean;
}
interface LineData {
  block: number;
  x: number;
  y: number;
  z: number;
  w: number;
  ci: number;
}
interface RoadData {
  x: number;
  z: number;
  horiz: boolean;
  dist: number;
}
interface SignData {
  text: string;
  x: number;
  y: number;
  z: number;
  size: number;
  color: string;
  dist: number;
  preLit: boolean;
}
interface KrackleData {
  x: number;
  y: number;
  z: number;
  s: number;
  ci: number;
  dist: number;
}

const GRID = 9;
// cells reserved for neon signage: "cell x,z" -> index into lettering.neonSigns
const SIGN_CELLS = new Map<string, number>([
  ["-2,1", 0], // REACT
  ["2,2", 1], // TYPESCRIPT
  ["-1,-1", 2], // JAVASCRIPT
  ["1,2", 3], // NEXT.JS
  ["-3,0", 4], // GRAPHQL
  ["3,1", 5], // NODE.JS
  ["0,-2", 6], // TAURI
  ["1,0", 7], // AI OPEN 24H (hero tower)
]);

function buildCity() {
  const r = mulberry32(20260702);
  const blocks: BlockData[] = [];
  const lines: LineData[] = [];
  const roads: RoadData[] = [];
  const signs: SignData[] = [];
  const krackle: KrackleData[] = [];

  for (let ix = -4; ix <= 4; ix++) {
    for (let iz = -4; iz <= 4; iz++) {
      // plaza corridor: dive/landing camera path stays clear
      if (ix === 0 && iz >= 0 && iz <= 2) continue;
      const hero = ix === 1 && iz === 0;
      const signIdx = SIGN_CELLS.get(`${ix},${iz}`);
      const x = ix * GRID;
      const z = iz * GRID;
      const w = hero ? 6 : 4.5 + r() * 1.8;
      const d = hero ? 6 : 4.5 + r() * 1.8;
      let h = hero ? 20 : 4 + r() * 12;
      if (signIdx !== undefined) h = Math.max(h, 9);
      const b: BlockData = {
        x,
        z,
        w,
        d,
        h,
        ci: Math.floor(r() * SYNTAX.length),
        dist: Math.hypot(x - LANDING_X, z - LANDING_Z),
        preLit: hero || (ix === -2 && iz === 1), // pilot lights: hero + REACT
      };
      const bi = blocks.length;
      blocks.push(b);

      // code lines on the +z facade: indented, varied width, syntax colors
      const n = Math.min(9, Math.floor(h / 1.1));
      for (let j = 0; j < n; j++) {
        const y = h - 1.0 - j * 1.05;
        if (y < 1.2) break;
        const lw = (w - 1.2) * (0.3 + r() * 0.55);
        const indent = r() < 0.35 ? 0.5 : 0;
        lines.push({
          block: bi,
          x: x - w / 2 + 0.5 + indent + lw / 2,
          y,
          z: z + d / 2 + 0.05,
          w: lw,
          ci: Math.floor(r() * SYNTAX.length),
        });
      }

      if (signIdx !== undefined) {
        signs.push({
          text: lettering.neonSigns[signIdx]!,
          x,
          y: h + 0.9,
          z: z + 0.2,
          size: hero ? 0.95 : 0.68,
          color: SYNTAX[signIdx % SYNTAX.length]!,
          dist: b.dist,
          preLit: b.preLit,
        });
      }
    }
  }

  // roads: glowing ink lines on the street grid, one segment per block span
  for (let k = -4; k <= 3; k++) {
    const c = 4.5 + k * GRID;
    for (let m = -4; m <= 4; m++) {
      const p = m * GRID;
      roads.push({ x: p, z: c, horiz: true, dist: Math.hypot(p - LANDING_X, c - LANDING_Z) });
      roads.push({ x: c, z: p, horiz: false, dist: Math.hypot(c - LANDING_X, p - LANDING_Z) });
    }
  }

  // krackle energy dots: plaza cluster + rooftop sparks
  for (let i = 0; i < 140; i++) {
    if (i < 30) {
      const x = (r() - 0.5) * 14;
      const z = LANDING_Z + (r() - 0.5) * 14;
      krackle.push({
        x,
        y: 0.4 + r() * 2,
        z,
        s: 0.08 + r() * 0.14,
        ci: Math.floor(r() * SYNTAX.length),
        dist: Math.hypot(x - LANDING_X, z - LANDING_Z),
      });
    } else {
      const b = blocks[Math.floor(r() * blocks.length)]!;
      const x = b.x + (r() - 0.5) * b.w * 1.6;
      const z = b.z + (r() - 0.5) * b.d * 1.6;
      krackle.push({
        x,
        y: b.h + 0.5 + r() * 2.5,
        z,
        s: 0.08 + r() * 0.14,
        ci: Math.floor(r() * SYNTAX.length),
        dist: Math.hypot(x - LANDING_X, z - LANDING_Z),
      });
    }
  }

  return { blocks, lines, roads, signs, krackle };
}

const CITY = buildCity();

// reusable temps -- zero per-frame allocation
const tmpO = new Object3D();
const tmpC = new Color();
const tmpC2 = new Color();
const DIM_BODY = new Color(PAPER).lerp(new Color(INK), 0.05);

// -- the cat (S1) + its rooftop keyboard, hero-tower roof props ---------------
// Scale ruling (user report 2026-07-03): both were gigantic relative to the
// city; at 0.45 the cat reads as an animal on a building, the keyboard as a
// deck it types on -- rooftop props consistent with the 4-20 wu blocks.
// Palette (user override 2026-07-03, supersedes the black-ink palette-law
// ruling): Harley golden tabby here too. Pure HARLEY.ink #A9743C sinks into
// the black world, so the body is warmed 50% toward the row-3 neon orange
// #FF9E1F -> #D4892E; tail tip takes the neon orange. HARLEY's cream paper
// keeps the rim hulls carving the silhouette out of the dark roof.
const CAT_SCALE = 0.45;
const CAT_PALETTE: CatPalette = {
  ...HARLEY,
  ink: "#D4892E",
  accent: SYNTAX[3]!,
};

const ROOF_KEY_COLS = 8;
const ROOF_KEY_ROWS = 3;
const ROOF_KEY_COUNT = ROOF_KEY_COLS * ROOF_KEY_ROWS;

function RoofKeyboard() {
  const inst = useRef<InstancedMesh>(null);
  const ramp = toonRamp();

  useLayoutEffect(() => {
    const m = inst.current;
    if (!m) return;
    for (let row = 0; row < ROOF_KEY_ROWS; row++) {
      for (let col = 0; col < ROOF_KEY_COLS; col++) {
        const i = row * ROOF_KEY_COLS + col;
        tmpO.position.set((col - (ROOF_KEY_COLS - 1) / 2) * 0.064, 0.045, (row - 1) * 0.064);
        tmpO.rotation.set(0, 0, 0);
        tmpO.scale.setScalar(1);
        tmpO.updateMatrix();
        m.setMatrixAt(i, tmpO.matrix);
        // every instance colored (unset instances render WHITE)
        tmpC.set((i * 31) % 89 < 22 ? SYNTAX[i % SYNTAX.length]! : INK);
        m.setColorAt(i, tmpC);
      }
    }
    m.instanceMatrix.needsUpdate = true;
    m.instanceColor!.needsUpdate = true;
  }, []);

  return (
    <group position={[6.27, 20.0, 2.58]} rotation={[0, -1.33, 0]}>
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[0.56, 0.04, 0.24]} />
        <meshToonMaterial color={DIM_BODY} gradientMap={ramp} />
      </mesh>
      <instancedMesh ref={inst} args={[undefined, undefined, ROOF_KEY_COUNT]}>
        <boxGeometry args={[0.05, 0.022, 0.05]} />
        <meshBasicMaterial color="#FFFFFF" />
      </instancedMesh>
    </group>
  );
}

export default function Neon({ index }: { index: number }) {
  const issue = ISSUES[index]!;
  const ramp = toonRamp();

  const bodyRef = useRef<InstancedMesh>(null);
  const lineRef = useRef<InstancedMesh>(null);
  const roadRef = useRef<InstancedMesh>(null);
  const krackleRef = useRef<InstancedMesh>(null);
  const signRefs = useRef<(Group | null)[]>([]);
  const padMat = useRef<MeshBasicMaterial>(null);
  const cat = useRef<Group>(null);
  const lastRadius = useRef(-1);

  const applyRadius = (radius: number) => {
    const body = bodyRef.current;
    const line = lineRef.current;
    const road = roadRef.current;
    if (!body || !line || !road) return;
    CITY.blocks.forEach((b, i) => {
      const on = b.preLit || b.dist <= radius;
      tmpC.copy(DIM_BODY);
      if (on) tmpC.lerp(tmpC2.set(SYNTAX[b.ci]!), 0.16);
      body.setColorAt(i, tmpC);
    });
    body.instanceColor!.needsUpdate = true;
    CITY.lines.forEach((l, i) => {
      const b = CITY.blocks[l.block]!;
      const on = b.preLit || b.dist <= radius;
      tmpC.set(SYNTAX[l.ci]!);
      if (!on) tmpC.multiplyScalar(DIM_LINE);
      line.setColorAt(i, tmpC);
    });
    line.instanceColor!.needsUpdate = true;
    // roads ignite outward slightly ahead of the blocks
    CITY.roads.forEach((seg, i) => {
      tmpC.set(ROAD);
      if (!(seg.dist <= radius * 1.15)) tmpC.multiplyScalar(DIM_ROAD);
      road.setColorAt(i, tmpC);
    });
    road.instanceColor!.needsUpdate = true;
    if (padMat.current) {
      padMat.current.color.set(ROAD);
      if (radius <= 0) padMat.current.color.multiplyScalar(DIM_LINE);
    }
  };

  // static matrices + full initial color pass (unset instances render WHITE)
  useLayoutEffect(() => {
    const body = bodyRef.current!;
    const line = lineRef.current!;
    const road = roadRef.current!;
    CITY.blocks.forEach((b, i) => {
      tmpO.position.set(b.x, b.h / 2, b.z);
      tmpO.rotation.set(0, 0, 0);
      tmpO.scale.set(b.w, b.h, b.d);
      tmpO.updateMatrix();
      body.setMatrixAt(i, tmpO.matrix);
    });
    body.instanceMatrix.needsUpdate = true;
    CITY.lines.forEach((l, i) => {
      tmpO.position.set(l.x, l.y, l.z);
      tmpO.rotation.set(0, 0, 0);
      tmpO.scale.set(l.w, 0.16, 0.06);
      tmpO.updateMatrix();
      line.setMatrixAt(i, tmpO.matrix);
    });
    line.instanceMatrix.needsUpdate = true;
    CITY.roads.forEach((seg, i) => {
      tmpO.position.set(seg.x, 0.03, seg.z);
      tmpO.rotation.set(0, 0, 0);
      tmpO.scale.set(seg.horiz ? 8.4 : 0.35, 0.06, seg.horiz ? 0.35 : 8.4);
      tmpO.updateMatrix();
      road.setMatrixAt(i, tmpO.matrix);
    });
    road.instanceMatrix.needsUpdate = true;
    // krackle colors set once here; matrices are rebuilt per frame
    const kr = krackleRef.current!;
    CITY.krackle.forEach((k, i) => kr.setColorAt(i, tmpC.set(SYNTAX[k.ci]!)));
    kr.instanceColor!.needsUpdate = true;

    const radius = cascadeRadius(useScrollStore.getState().t);
    lastRadius.current = radius;
    applyRadius(radius);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame(({ clock }) => {
    const { t, quality } = useScrollStore.getState();
    const radius = cascadeRadius(t);

    // color uploads only on wave-step change -- scrub-safe both directions
    if (radius !== lastRadius.current) {
      lastRadius.current = radius;
      applyRadius(radius);
    }

    // signs pop on when the wave reaches them (visibility step, no fade)
    CITY.signs.forEach((s, i) => {
      const g = signRefs.current[i];
      if (g) g.visible = s.preLit || s.dist <= radius;
    });

    // krackle: stepped-time jitter (ambient loop, S2.8), gated by the wave
    const fps = quality === "low" ? 8 : 12;
    const kr = krackleRef.current;
    if (kr) {
      const el = clock.elapsedTime;
      CITY.krackle.forEach((k, i) => {
        const on = k.dist <= radius;
        if (on) {
          const n1 = stepNoise(el, fps, i);
          const n2 = stepNoise(el, fps, i + 311);
          const n3 = stepNoise(el, fps, i + 977);
          tmpO.position.set(k.x + n1 * 0.45, k.y + n2 * 0.45, k.z + n3 * 0.45);
          tmpO.rotation.set(n1 * 3, n2 * 3, 0);
          tmpO.scale.setScalar(k.s * (0.7 + 0.3 * Math.abs(n3)));
        } else {
          tmpO.position.set(k.x, k.y, k.z);
          tmpO.rotation.set(0, 0, 0);
          tmpO.scale.setScalar(0);
        }
        tmpO.updateMatrix();
        kr.setMatrixAt(i, tmpO.matrix);
      });
      kr.instanceMatrix.needsUpdate = true;
    }

    // cat tail idle on 2s (same ambient pattern as the demo cube)
    if (cat.current) cat.current.rotation.z = Math.sin(stepTime(clock.elapsedTime, fps) * 2.1) * 0.1;
  });

  return (
    <IssueShell index={index} issue={issue}>
      {/* black paper ground */}
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[120, 120]} />
        <meshToonMaterial color={PAPER} gradientMap={ramp} />
      </mesh>

      {/* code-block buildings (toon bodies, per-instance boot tint) */}
      <instancedMesh ref={bodyRef} args={[undefined, undefined, CITY.blocks.length]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshToonMaterial color="#FFFFFF" gradientMap={ramp} />
      </instancedMesh>

      {/* facade code lines -- flat neon ink, unlit */}
      <instancedMesh ref={lineRef} args={[undefined, undefined, CITY.lines.length]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#FFFFFF" />
      </instancedMesh>

      {/* roads as glowing ink lines */}
      <instancedMesh ref={roadRef} args={[undefined, undefined, CITY.roads.length]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#FFFFFF" />
      </instancedMesh>

      {/* krackle energy dots */}
      <instancedMesh ref={krackleRef} args={[undefined, undefined, CITY.krackle.length]} frustumCulled={false}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color="#FFFFFF" />
      </instancedMesh>

      {/* landing pad ring at the cascade origin */}
      <mesh position={[LANDING_X, 0.02, LANDING_Z]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.4, 1.8, 48]} />
        <meshBasicMaterial ref={padMat} color={ROAD} />
      </mesh>

      {/* neon signage: dead plate always visible, lettering pops with the wave */}
      <Suspense fallback={null}>
        {CITY.signs.map((s, i) => (
          <group key={s.text} position={[s.x, s.y, s.z]}>
            <mesh position={[0, 0, -0.06]}>
              <boxGeometry args={[s.text.length * s.size * 0.62 + 0.6, s.size + 0.7, 0.08]} />
              <meshToonMaterial color={DIM_BODY} gradientMap={ramp} />
            </mesh>
            <group
              ref={(el) => {
                signRefs.current[i] = el;
              }}
              visible={s.preLit}
            >
              <Text
                font="/fonts/Bangers-Regular.ttf"
                fontSize={s.size}
                color={s.color}
                anchorX="center"
                anchorY="middle"
              >
                {s.text}
              </Text>
            </group>
          </group>
        ))}
      </Suspense>

      {/* the cat (S1) -- shared mascot (components/CatModel v2), perched on
          the hero tower roof at prop scale, facing its keyboard toward the
          plaza; clickable meow */}
      <group
        ref={cat}
        position={[6.8, 20.0, 2.45]}
        rotation={[0, -2.9, 0]}
        scale={CAT_SCALE}
        onClick={(e) => {
          e.stopPropagation();
          useScrollStore.getState().meow();
        }}
      >
        <CatModel mode="toon" pose="sitting" palette={CAT_PALETTE} />
      </group>
      <RoofKeyboard />
    </IssueShell>
  );
}
