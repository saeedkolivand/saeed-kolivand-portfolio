"use client";

import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import {
  Color,
  Object3D,
  type Group,
  type InstancedMesh,
  type ShaderMaterial,
} from "three";
import IssueShell from "../_IssueShell";
import { ISSUES } from "../registry";
import CatModel, { HARLEY, type CatPalette } from "@/components/CatModel";
import { pawprintMaterial, sketchMaterial, SKETCH_PALETTE } from "@/shaders/sketchMaterials";
import { stepTime } from "@/lib/steppedClock";
import { useScrollStore } from "@/lib/scrollStore";
import { sayWord } from "@/lib/onomatopoeia";
import { issueCopy, lettering } from "@/lib/content";
import { clamp01, lerp } from "@/lib/shots";
import { issueCenter } from "../timeline";
import { inkAt, SKETCH_SETTLE } from "./shots";

/**
 * Issue 9 SKETCHBOOK (S0.3 range [0.762, 0.838], palette S0.4 row 9).
 * One sketchbook page lying flat: the architecture chain Frontend -> API ->
 * Workers -> AI -> DB -> Search -> Desktop drawn as primitive diagram
 * machines joined by a dashed ink line, stick-figure robots pushing data
 * packets along it, Caveat annotations (locked issueCopy strings), a coffee
 * stain, a resting pencil, spiral binding. THE LOOK is the prebuilt
 * shaders/sketchMaterials.ts layer: every drawn mesh shares ONE
 * sketchMaterial whose uInk = inkAt(t) morphs pencil -> ink draw-on ->
 * held breath -> wash flood, pure f(t) both scroll directions. uTime is
 * stepped at 8 fps per the shader contract (the slow issue). One shared
 * uSweepSpan makes the flood read as a single print run crossing the page.
 * The cat pads across mid-scene leaving pawprint decals (one material
 * clone per print, uSeed staggered u .22-.52). Intensity 2 by design.
 */

// ---- palette: S0.4 row 9 + logged working tones (rulings in ./shots.md) ----
const PAPER = SKETCH_PALETTE.paper;
const GRAPHITE = SKETCH_PALETTE.graphite;
const INK = SKETCH_PALETTE.ink;
const WASH = SKETCH_PALETTE.wash;
const PAD = "#E9E1CF"; // page stack under the top sheet (paper working step)
const SEPIA = "#8C6F52"; // diluted coffee-stain tone (ruling, shots.md)
const CAVEAT = "/fonts/Caveat-Regular.ttf"; // S0.4 type table (shared drop)

const ANNOTS = issueCopy.sketchbook.annotations;
const [CX] = issueCenter(9);

/** chain node x positions: Frontend API Workers AI DB Search Desktop */
const NODE_X = [-27, -18, -9, 0, 9, 18, 27];
/** annotation anchors -- DB + Search share one snippet between them */
const ANNOT_X = [-27, -18, -9, 0, 13.5, 27];
/** dot(localPos, uSweepDir) bracket over every sketch mesh (set-local) */
const SWEEP_SPAN: [number, number] = [-30, 30];

// ---- shared scratch (zero per-frame allocation) -----------------------------
const tmpO = new Object3D();
const tmpC = new Color();

const hash = (i: number, n: number) => {
  const x = Math.sin((i + 1) * n) * 43758.5453;
  return x - Math.floor(x);
};

/* ------------------------------------------- static drawn set (instanced) --- */
interface Part {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  rx?: number;
  ry?: number;
  rz?: number;
}

const SLABS: Part[] = [];
const box = (
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  rx = 0,
  ry = 0,
  rz = 0,
) => SLABS.push({ x, y, z, sx, sy, sz, rx, ry, rz });

// chain: dashed ink line + chevron arrows into each next node
for (let x = -26; x <= 26; x += 1.5)
  if (NODE_X.every((nx) => Math.abs(x - nx) > 2.3)) box(x, 0.06, 0, 0.85, 0.1, 0.16);
for (let i = 1; i < 7; i++) {
  const ax = NODE_X[i]! - 3.1;
  box(ax, 0.07, 0.24, 0.7, 0.09, 0.12, 0, -0.55);
  box(ax, 0.07, -0.24, 0.7, 0.09, 0.12, 0, 0.55);
}
// Frontend: a monitor (code-line dashes proud of the screen face)
box(-27, 0.15, 0, 2.2, 0.3, 1.4);
box(-27, 0.55, 0, 0.3, 0.7, 0.3);
box(-27, 1.85, 0, 2.8, 1.9, 0.28);
box(-27.5, 2.25, 0.19, 1.1, 0.09, 0.05);
box(-27.1, 1.95, 0.19, 1.7, 0.09, 0.05);
box(-27.6, 1.65, 0.19, 0.9, 0.09, 0.05);
// API: the gate (posts, lintel, lamp)
box(-19.3, 1.3, 0, 0.45, 2.6, 0.45);
box(-16.7, 1.3, 0, 0.45, 2.6, 0.45);
box(-18, 2.75, 0, 3.6, 0.5, 0.55);
box(-18, 3.2, 0, 0.4, 0.4, 0.4);
// Workers: the bench (gears live in CYLS)
box(-9, 0.45, 0.3, 3.0, 0.9, 1.2);
// AI: robot head, antenna, eyes
box(0, 1.7, 0, 2.0, 1.7, 1.5);
box(0, 2.95, 0, 0.09, 1.0, 0.09);
box(0, 3.5, 0, 0.26, 0.26, 0.26);
box(-0.45, 1.85, 0.78, 0.32, 0.32, 0.1);
box(0.45, 1.85, 0.78, 0.32, 0.32, 0.1);
// Search: magnifier handle (lens disc lives in CYLS)
box(19.1, 0.8, 0.6, 1.7, 0.24, 0.24, 0, 0.25, -0.7);
// Desktop: tower + monitor + stand
box(28.2, 1.3, -0.3, 1.3, 2.6, 1.1);
box(26.2, 1.7, 0.3, 2.3, 1.6, 0.24);
box(26.2, 0.6, 0.3, 0.25, 0.6, 0.25);
box(26.2, 0.2, 0.3, 1.2, 0.15, 0.8);

const CYLS: Part[] = [];
const cyl = (x: number, y: number, z: number, sx: number, sy: number, sz: number, rx = 0) =>
  CYLS.push({ x, y, z, sx, sy, sz, rx });
// Workers: two meshing gears on the bench + a small idler above
cyl(-10.1, 1.75, -0.1, 1.7, 0.3, 1.7, Math.PI / 2);
cyl(-8.35, 1.75, -0.1, 1.3, 0.3, 1.3, Math.PI / 2);
cyl(-9.2, 2.75, 0.15, 0.9, 0.3, 0.9, Math.PI / 2);
// DB: the classic cylinder stack
cyl(9, 0.55, 0, 2.6, 0.75, 2.6);
cyl(9, 1.35, 0, 2.6, 0.75, 2.6);
cyl(9, 2.15, 0, 2.6, 0.75, 2.6);
// Search: tilted lens disc
cyl(17.6, 1.9, 0.2, 2.6, 0.16, 2.6, 1.35);

function setParts(m: InstancedMesh, parts: Part[]) {
  parts.forEach((p, i) => {
    tmpO.position.set(p.x, p.y, p.z);
    tmpO.rotation.set(p.rx ?? 0, p.ry ?? 0, p.rz ?? 0);
    tmpO.scale.set(p.sx, p.sy, p.sz);
    tmpO.updateMatrix();
    m.setMatrixAt(i, tmpO.matrix);
  });
  m.instanceMatrix.needsUpdate = true;
}

function StaticSketch({ mat }: { mat: ShaderMaterial }) {
  const boxes = useRef<InstancedMesh>(null);
  const cyls = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    if (boxes.current) setParts(boxes.current, SLABS);
    if (cyls.current) setParts(cyls.current, CYLS);
  }, []);

  return (
    <group>
      <instancedMesh
        ref={boxes}
        args={[undefined, undefined, SLABS.length]}
        material={mat}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      <instancedMesh
        ref={cyls}
        args={[undefined, undefined, CYLS.length]}
        material={mat}
        frustumCulled={false}
      >
        <cylinderGeometry args={[0.5, 0.5, 1, 14]} />
      </instancedMesh>
    </group>
  );
}

/* -------------------------------------------------- the resting pencil ------ */
// Own 2-instance mesh (matrices in set-local space so the shared flood front
// crosses it at its true page position); the group carries the jaw-drop
// settle nudge (SKETCH_SETTLE, authored-time via the beat engine).
const PENCIL: Part[] = [
  { x: -8, y: 0.33, z: 15, sx: 6, sy: 0.5, sz: 0.5, ry: -0.12 },
  { x: -4.62, y: 0.33, z: 15.4, sx: 0.9, sy: 0.36, sz: 0.36, ry: -0.12 },
];

function Pencil({ mat }: { mat: ShaderMaterial }) {
  const grp = useRef<Group>(null);
  const inst = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    if (inst.current) setParts(inst.current, PENCIL);
  }, []);

  useFrame(() => {
    const g = grp.current;
    if (!g) return;
    const v = SKETCH_SETTLE.v; // authored-time settle (0 idle)
    g.position.y = 0.09 * v;
    g.rotation.x = -0.05 * v;
  });

  return (
    <group ref={grp}>
      <instancedMesh
        ref={inst}
        args={[undefined, undefined, PENCIL.length]}
        material={mat}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
    </group>
  );
}

/* ------------------------------------- stick-figure robots + data packets --- */
// 4 robots (2 on low tier), each pushing one packet along its chain segment
// on 8 fps stepped time (idle life -- parked under reduced motion). 7 box
// instances per robot: torso, head, 2 arms, 2 legs, packet. The sketch
// material hatches each instance in page space and the shared flood front
// sweeps them with the rest of the print run.
const ROBOT_N = 4;
const PARTS_PER = 7;
const SEGS = [0, 2, 3, 5]; // patrolled chain segments (node i -> i+1)

function Robots({ mat }: { mat: ShaderMaterial }) {
  const inst = useRef<InstancedMesh>(null);

  useFrame(({ clock }) => {
    const m = inst.current;
    if (!m) return;
    const { quality, reducedMotion } = useScrollStore.getState();
    const n = quality === "low" ? 2 : ROBOT_N;
    m.count = n * PARTS_PER;
    // parked at a deterministic phase under reduced motion (robots still)
    const st = reducedMotion ? 977.13 : stepTime(clock.elapsedTime, 8);
    let idx = 0;
    const put = (
      x: number,
      y: number,
      z: number,
      sx: number,
      sy: number,
      sz: number,
      rz: number,
    ) => {
      tmpO.position.set(x, y, z);
      tmpO.rotation.set(0, 0, rz);
      tmpO.scale.set(sx, sy, sz);
      tmpO.updateMatrix();
      m.setMatrixAt(idx++, tmpO.matrix);
    };
    for (let j = 0; j < n; j++) {
      const seg = SEGS[j]!;
      const x0 = NODE_X[seg]! + 2.6;
      const x1 = NODE_X[seg + 1]! - 3.4;
      const cyc = st * 0.05 + j * 0.37;
      const rx = x0 + (x1 - x0) * (cyc - Math.floor(cyc));
      const sc = 0.85 + 0.3 * hash(j, 4.7);
      const swing = reducedMotion ? 0 : ((Math.floor(st * 8) + j) % 2 === 0 ? 1 : -1) * 0.3;
      // torso leaning into the push, head, both arms to the packet
      put(rx + 0.05 * sc, 1.15 * sc, 0, 0.18 * sc, 0.72 * sc, 0.18 * sc, -0.16 - 0.06 * swing);
      put(rx + 0.3 * sc, 1.68 * sc, 0, 0.3 * sc, 0.26 * sc, 0.26 * sc, 0);
      put(rx + 0.46 * sc, 1.02 * sc, 0.14 * sc, 0.56 * sc, 0.075 * sc, 0.075 * sc, -0.62);
      put(rx + 0.46 * sc, 1.02 * sc, -0.14 * sc, 0.56 * sc, 0.075 * sc, 0.075 * sc, -0.62);
      // legs: alternating stepped walk swing
      put(rx - 0.1 * sc + 0.07 * swing, 0.42 * sc, 0.1 * sc, 0.09 * sc, 0.84 * sc, 0.09 * sc, swing * 0.5);
      put(rx - 0.1 * sc - 0.07 * swing, 0.42 * sc, -0.1 * sc, 0.09 * sc, 0.84 * sc, 0.09 * sc, -swing * 0.5);
      // the data packet, riding the drawn line
      put(rx + (0.72 + 0.31 * sc), 0.32, 0, 0.62, 0.62, 0.62, 0);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={inst}
      args={[undefined, undefined, ROBOT_N * PARTS_PER]}
      material={mat}
      frustumCulled={false}
    >
      <boxGeometry args={[1, 1, 1]} />
    </instancedMesh>
  );
}

/* ------------------------------------------- handwritten annotations -------- */
// Locked issueCopy.sketchbook.annotations in Caveat, lying on the paper south
// of the chain, tilted up toward the low tracking camera. Reveal is a short
// pure-f(t) opacity ramp staggered along the chain, following the inking.
type TextHandle = Object3D & { fillOpacity: number };

function Annotations() {
  const refs = useRef<(TextHandle | null)[]>([]);

  useFrame(() => {
    const u = inkAt(useScrollStore.getState().t);
    refs.current.forEach((h, i) => {
      if (h) h.fillOpacity = clamp01((u - (0.16 + i * 0.075)) / 0.05);
    });
  });

  return (
    <Suspense fallback={null}>
      <group>
        {ANNOTS.map((line, i) => (
          <Text
            key={line}
            ref={(o: unknown) => {
              refs.current[i] = o as TextHandle | null;
            }}
            position={[ANNOT_X[i]!, 0.85, 3.9]}
            rotation={[-Math.PI / 2 + 0.4, 0, 0]}
            font={CAVEAT}
            fontSize={0.75}
            color={INK}
            fillOpacity={0}
            anchorX="center"
            anchorY="middle"
            maxWidth={7}
            textAlign="center"
            lineHeight={1.05}
          >
            {line}
          </Text>
        ))}
      </group>
    </Suspense>
  );
}

/* ---------------------------------------------- the cat + ink pawprints ----- */
// Guide moment (S5b.1): the cat pads across the page as pure f(uInk) over
// u .20-.50, leaving one pawprint clone per step (uSeed just behind the
// walk). Identity marks print in the wash (palette law, ruling shots.md).
const CAT_A: [number, number] = [-20, 8.5];
const CAT_B: [number, number] = [8, 5.2];
const PRINT_N = 10;
// path direction + unit perpendicular (for alternating left/right paws)
const PDX = CAT_B[0] - CAT_A[0];
const PDZ = CAT_B[1] - CAT_A[1];
const PLEN = Math.hypot(PDX, PDZ);
const PERP: [number, number] = [-PDZ / PLEN, PDX / PLEN];

// Harley body (golden tabby default, user directive 2026-07-03): the cat is
// the one colored thing walking through the graphite sketch world. Wash
// collar/tag + graphite tail tip keep the palette-law marks (shots.md ruling).
const CAT_PALETTE: CatPalette = {
  ...HARLEY,
  collar: WASH,
  tag: WASH,
  accent: GRAPHITE,
};

const pathPos = (w: number): [number, number] => [
  lerp(CAT_A[0], CAT_B[0], w),
  lerp(CAT_A[1], CAT_B[1], w),
];

function Pawprints() {
  const base = useMemo(() => pawprintMaterial(), []);
  const mats = useMemo(
    () =>
      Array.from({ length: PRINT_N }, (_, k) => {
        const m = base.clone();
        // appears just after the cat passes: cat is at fraction w when
        // u = .2 + .3w; print k sits at fraction k/(N-1)
        m.uniforms.uSeed!.value = 0.22 + (0.3 * k) / (PRINT_N - 1);
        return m;
      }),
    [base],
  );

  // dispose contract: one clone per print + the base (no textures/RTs)
  useEffect(
    () => () => {
      mats.forEach((m) => m.dispose());
      base.dispose();
    },
    [mats, base],
  );

  useFrame(() => {
    const u = inkAt(useScrollStore.getState().t);
    for (const m of mats) m.uniforms.uInk!.value = u;
  });

  return (
    <group>
      {mats.map((m, k) => {
        const f = k / (PRINT_N - 1);
        const [px, pz] = pathPos(f);
        const side = (k % 2 === 0 ? 1 : -1) * 0.35;
        return (
          <mesh
            key={k}
            material={m}
            // y-offset above the paper dodges z-fighting (shader note);
            // tiny per-print stagger keeps decals off each other too
            position={[px + PERP[0] * side, 0.03 + 0.0006 * k, pz + PERP[1] * side]}
            rotation={[-Math.PI / 2, 0, 0.12 + (hash(k, 7.3) - 0.5) * 0.24]}
            scale={0.75}
          >
            <planeGeometry args={[1, 1]} />
          </mesh>
        );
      })}
    </group>
  );
}

function PageCat() {
  const walkG = useRef<Group>(null);
  const sitG = useRef<Group>(null);
  const walkTail = useRef<Group>(null);
  const sitTail = useRef<Group>(null);

  useFrame(({ clock }) => {
    const { t, quality, reducedMotion } = useScrollStore.getState();
    const u = inkAt(t);
    const st = reducedMotion ? 0 : stepTime(clock.elapsedTime, quality === "low" ? 8 : 12);
    const walking = !reducedMotion && u > 0.2 && u < 0.5;
    // reduced motion: piecewise-STILL (train precedent) -- parked at path
    // start before the crossing midpoint, at the end after it
    const w = reducedMotion ? (u < 0.35 ? 0 : 1) : clamp01((u - 0.2) / 0.3);
    const [x, z] = pathPos(w);
    if (walkG.current) {
      walkG.current.visible = walking;
      walkG.current.position.set(x, 0.12 + 0.07 * Math.abs(Math.sin(st * 7)), z);
    }
    if (sitG.current) {
      sitG.current.visible = !walking;
      sitG.current.position.set(x, 0.12, z);
    }
    const flick = 0.85 + Math.sin(st * 1.6) * 0.14;
    if (walkTail.current) walkTail.current.rotation.z = flick;
    if (sitTail.current) sitTail.current.rotation.z = flick;
  });

  const meow = (x: number, z: number) => {
    useScrollStore.getState().meow();
    sayWord(lettering.onomatopoeia.cat, [CX + x, 3.4, z], undefined, INK);
  };

  return (
    <Suspense fallback={null}>
      <group
        ref={walkG}
        visible={false}
        scale={0.9}
        onClick={(e) => {
          e.stopPropagation();
          meow(walkG.current?.position.x ?? 0, walkG.current?.position.z ?? 0);
        }}
      >
        <CatModel mode="flat" pose="walking" palette={CAT_PALETTE} rig={{ tail: walkTail }} />
      </group>
      <group
        ref={sitG}
        scale={0.9}
        onClick={(e) => {
          e.stopPropagation();
          meow(sitG.current?.position.x ?? 0, sitG.current?.position.z ?? 0);
        }}
      >
        <CatModel mode="flat" pose="sitting" palette={CAT_PALETTE} rig={{ tail: sitTail }} />
      </group>
    </Suspense>
  );
}

/* ------------------------------------------------------- page dressing ------ */
// Coffee stain: flat transparent decal trio in the logged sepia working tone
// -- single AA edge each, zero blur (S2.16; ruling in shots.md).
function CoffeeStain() {
  return (
    <group position={[3.5, 0, 12.5]}>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0.3]} scale={[2.7, 2.0, 1]}>
        <circleGeometry args={[1, 40]} />
        <meshBasicMaterial color={SEPIA} transparent opacity={0.16} depthWrite={false} />
      </mesh>
      <mesh position={[0.5, 0.035, 0.4]} rotation={[-Math.PI / 2, 0, -0.2]} scale={[1.7, 1.3, 1]}>
        <circleGeometry args={[1, 40]} />
        <meshBasicMaterial color={SEPIA} transparent opacity={0.1} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0.3]} scale={[2.9, 2.15, 1]}>
        <ringGeometry args={[0.88, 1, 48]} />
        <meshBasicMaterial color={SEPIA} transparent opacity={0.3} depthWrite={false} />
      </mesh>
    </group>
  );
}

// Spiral binding along the north page edge (a real object, not a drawing:
// plain graphite, no sketch morph).
const RING_N = 16;

function Binding() {
  const inst = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const m = inst.current;
    if (!m) return;
    for (let i = 0; i < RING_N; i++) {
      tmpO.position.set(-36 + i * 4.8, 0.1, -19.9);
      tmpO.rotation.set(0, Math.PI / 2, 0);
      tmpO.scale.set(1, 1, 1);
      tmpO.updateMatrix();
      m.setMatrixAt(i, tmpO.matrix);
      m.setColorAt(i, tmpC.set(GRAPHITE)); // every instance -- unset renders WHITE
    }
    m.instanceMatrix.needsUpdate = true;
    m.instanceColor!.needsUpdate = true;
  }, []);

  return (
    <instancedMesh ref={inst} args={[undefined, undefined, RING_N]} frustumCulled={false}>
      <torusGeometry args={[0.55, 0.09, 8, 18]} />
      <meshBasicMaterial color="#FFFFFF" />
    </instancedMesh>
  );
}

function Page() {
  return (
    <group>
      <mesh position={[0, -0.25, 0]}>
        <boxGeometry args={[78, 0.5, 40]} />
        <meshBasicMaterial color={PAPER} />
      </mesh>
      <mesh position={[0, -0.62, 0]}>
        <boxGeometry args={[80, 0.7, 42]} />
        <meshBasicMaterial color={PAD} />
      </mesh>
    </group>
  );
}

/* ----------------------------------------------------------- the set ------- */
export default function Sketchbook({ index }: { index: number }) {
  const issue = ISSUES[index]!;

  // ONE sketch material shared by every drawn mesh: same uInk scrub, same
  // stepped boil, same sweep -- the flood reads as one print run.
  const sketch = useMemo(() => sketchMaterial(), []);
  useEffect(() => () => sketch.dispose(), [sketch]);

  useLayoutEffect(() => {
    sketch.uniforms.uSweepSpan!.value.set(SWEEP_SPAN[0], SWEEP_SPAN[1]);
    sketch.uniforms.uHatchScale!.value = 6.5;
    sketch.uniforms.uLightDir!.value.set(4, 8, 6).normalize(); // IssueShell key
  }, [sketch]);

  useFrame(({ clock }) => {
    const { t, reducedMotion } = useScrollStore.getState();
    sketch.uniforms.uInk!.value = inkAt(t); // master scrub, pure f(t)
    // stepped 8 fps boil per the shader contract; 0 freezes it (reduced)
    sketch.uniforms.uTime!.value = reducedMotion ? 0 : stepTime(clock.elapsedTime, 8);
  });

  return (
    <IssueShell index={index} issue={issue}>
      <Page />
      <Binding />
      <CoffeeStain />
      <StaticSketch mat={sketch} />
      <Pencil mat={sketch} />
      <Robots mat={sketch} />
      <Annotations />
      <Pawprints />
      <PageCat />
    </IssueShell>
  );
}
