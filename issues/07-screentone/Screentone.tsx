"use client";

import { Suspense, useLayoutEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { Color, Object3D, type Group, type InstancedMesh, type Mesh } from "three";
import IssueShell from "../_IssueShell";
import { ISSUES } from "../registry";
import CatModel, { HARLEY, type CatPalette } from "@/components/CatModel";
import { stepNoise, stepTime } from "@/lib/steppedClock";
import { useScrollStore } from "@/lib/scrollStore";
import { sayWord } from "@/lib/onomatopoeia";
import { content, issueCopy, lettering } from "@/lib/content";
import { issueCenter } from "../timeline";
import {
  STATION_X,
  swishOpacity,
  TRAIN_HALF,
  TRAIN_LURCH,
  trainDisplayX,
  trainSpeed,
} from "./shots";

/**
 * Issue 7 SCREENTONE (S0.3 range [0.576, 0.656], palette S0.4 row 7).
 * Manga B&W subway: one line crossing the page west to east, 8 station
 * spreads (content.timeline names + index-aligned stationCaptions), a 2-car
 * train with the spot-yellow stripe riding a pure-f(t) motion profile
 * (./shots.ts), instanced speed-line streaks while it runs, a floating
 * subway-map insert panel with a live position marker, and the edge-run
 * finale into the native page-flip gutter.
 *
 * World is AUTHORED grayscale (recipe mono 0) so the spot yellow survives:
 * train stripe, map line, station marks only. All copy is locked content --
 * never invented strings. Everything scroll-driven is pure f(t); stepped
 * idle life freezes under reduced motion; the train renders piecewise-still
 * (parked at the nearest station) under reduced motion (ruling, shots.md).
 */

// ---- palette: S0.4 row 7 + working-gray steps (Noir/Newsprint precedent) ----
const PAPER = "#101014";
const INK = "#E8E8E8";
const YELLOW = "#F6C243"; // spot: train stripe, map line, station marks
const FLOOR = "#131318";
const BALLAST = "#15151B";
const WALL = "#1B1B22";
const PIER = "#26262E";
const PANEL = "#222229"; // station wall panels
const PLATFORM = "#3A3A44";
const BENCH = "#4A4A54";
const RAIL = "#7E7E88";
const CAPTION = "#A9A9B4"; // softer working gray for captions
const BODY = "#C9C9D2"; // train body (light -- ink lines + dark windows pop)
const ROOF = "#9A9AA4";
const GLASS = "#0C0C10";
const UNDER = "#1A1A20";
const SHEET = "#DDDDE4"; // map insert sheet
const BANGERS = "/fonts/Bangers-Regular.ttf";

const NAMES = content.timeline;
const CAPTIONS = issueCopy.screentone.stationCaptions;
const [CX] = issueCenter(7);

// platform cameo: the Harley mascot, warmed for the dark screentone world
// (Neon precedent). Pure HARLEY.ink #A9743C sinks into the near-black paper,
// so the fur is pushed to a warm amber #D4892E; the tail tip takes the scene
// spot yellow. Teal collar + red tag identity marks stay (owner override
// 2026-07-04, supersedes the earlier spot-yellow-only ruling).
const CAT_PALETTE: CatPalette = { ...HARLEY, ink: "#D4892E", accent: YELLOW };
/** S0 bench sits past the parked train's nose so the cameo always reads. */
const CAT_BENCH_X = STATION_X[0]! + 9;

// ---- shared scratch (zero per-frame allocation) -----------------------------
const tmpO = new Object3D();
const tmpC = new Color();

const hash = (i: number, n: number) => {
  const x = Math.sin((i + 1) * n) * 43758.5453;
  return x - Math.floor(x);
};

/* --------------------------------------- static set, one instanced mesh ---- */
interface Slab {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  c: string;
}

const SLABS: Slab[] = [];
const slab = (x: number, y: number, z: number, sx: number, sy: number, sz: number, c: string) =>
  SLABS.push({ x, y, z, sx, sy, sz, c });

// ground, track bed, rails -- the world ENDS at the page edges (+/-146)
slab(0, -0.2, -2, 292, 0.4, 24, FLOOR);
slab(0, 0.02, 0, 292, 0.25, 3.6, BALLAST);
slab(0, 0.31, -0.9, 292, 0.18, 0.16, RAIL);
slab(0, 0.31, 0.9, 292, 0.18, 0.16, RAIL);
// ties
for (let x = -144; x <= 144; x += 4) slab(x, 0.16, 0, 2.6, 0.12, 0.6, PIER);
// tunnel back wall + piers between stations
slab(0, 4.5, -9.6, 292, 9.4, 0.5, WALL);
for (let x = -144; x <= 144; x += 12)
  if (STATION_X.every((s) => Math.abs(x - s) > 11.5)) slab(x, 4, -8.6, 1.1, 8, 0.9, PIER);
// the page edges: full-span paper-white voids where the world stops -- the
// train enters out of the west one and punches into the east one at the
// launch (the page-flip conceit)
slab(-146.2, 5.5, -2, 0.4, 15, 26, INK);
slab(146.2, 5.5, -2, 0.4, 15, 26, INK);
// station spreads: platform, wall panel, name/caption rule, bench
for (const sx of STATION_X) {
  slab(sx, 0.5, -4.4, 21, 1.0, 4.2, PLATFORM);
  slab(sx, 4.6, -7.2, 20, 5.2, 0.35, PANEL);
  slab(sx, 6.0, -6.99, 13, 0.12, 0.05, INK);
  slab(sx + 9, 1.15, -4.6, 2.6, 0.45, 1.0, BENCH);
}

function Slabs() {
  const inst = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const m = inst.current;
    if (!m) return;
    SLABS.forEach((b, i) => {
      tmpO.position.set(b.x, b.y, b.z);
      tmpO.rotation.set(0, 0, 0);
      tmpO.scale.set(b.sx, b.sy, b.sz);
      tmpO.updateMatrix();
      m.setMatrixAt(i, tmpO.matrix);
      m.setColorAt(i, tmpC.set(b.c)); // every instance -- unset renders WHITE
    });
    m.instanceMatrix.needsUpdate = true;
    m.instanceColor!.needsUpdate = true;
  }, []);

  return (
    <instancedMesh ref={inst} args={[undefined, undefined, SLABS.length]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#FFFFFF" />
    </instancedMesh>
  );
}

/* ------------------------------------------ station marks + lettering ------ */
function StationMarks() {
  const inst = useRef<InstancedMesh>(null);
  const pulse = useRef<Mesh>(null);

  useLayoutEffect(() => {
    const m = inst.current;
    if (!m) return;
    STATION_X.forEach((sx, i) => {
      tmpO.position.set(sx - 8.5, 6.7, -6.95);
      tmpO.rotation.set(Math.PI / 2, 0, 0);
      tmpO.scale.set(1, 1, 1);
      tmpO.updateMatrix();
      m.setMatrixAt(i, tmpO.matrix);
      m.setColorAt(i, tmpC.set(YELLOW)); // spot yellow: station marks
    });
    m.instanceMatrix.needsUpdate = true;
    m.instanceColor!.needsUpdate = true;
  }, []);

  useFrame(({ clock }) => {
    // the last stop is lit (stationCaptions[7]): stepped pulse behind its mark
    const { quality, reducedMotion } = useScrollStore.getState();
    const st = reducedMotion ? 0 : stepTime(clock.elapsedTime, quality === "low" ? 8 : 12);
    pulse.current?.scale.setScalar(1 + 0.14 * (0.5 + 0.5 * Math.sin(st * 9)));
  });

  return (
    <group>
      <instancedMesh ref={inst} args={[undefined, undefined, STATION_X.length]} frustumCulled={false}>
        <cylinderGeometry args={[0.62, 0.62, 0.18, 24]} />
        <meshBasicMaterial color="#FFFFFF" />
      </instancedMesh>
      <mesh ref={pulse} position={[STATION_X[7]! - 8.5, 6.7, -7.02]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.95, 0.95, 0.08, 24]} />
        <meshBasicMaterial color={YELLOW} />
      </mesh>
    </group>
  );
}

function StationSpreads() {
  return (
    <Suspense fallback={null}>
      {STATION_X.map((sx, i) => (
        <group key={i} position={[sx, 0, -6.98]}>
          <Text
            position={[0.8, 6.7, 0]}
            font={BANGERS}
            fontSize={0.85}
            color={INK}
            anchorX="center"
            anchorY="middle"
            maxWidth={17}
          >
            {NAMES[i]!}
          </Text>
          <Text
            position={[0, 5.35, 0]}
            font={BANGERS}
            fontSize={0.42}
            color={CAPTION}
            anchorX="center"
            anchorY="middle"
            maxWidth={16}
            textAlign="center"
            lineHeight={1.2}
          >
            {CAPTIONS[i]!}
          </Text>
        </group>
      ))}
    </Suspense>
  );
}

/* --------------------------------------------------------- the train ------- */
// 2 cars, all parts one instanced mesh (static matrices; only the parent
// group moves per frame). Car centers +/-3.95, nose at +TRAIN_HALF.
const CAR_X = [-3.95, 3.95];
const TRAIN_SLABS: Slab[] = [];
{
  const ts = (x: number, y: number, z: number, sx: number, sy: number, sz: number, c: string) =>
    TRAIN_SLABS.push({ x, y, z, sx, sy, sz, c });
  for (const cx of CAR_X) {
    ts(cx, 1.9, 0, 7.4, 2.2, 2.4, BODY);
    ts(cx, 3.12, 0, 7.0, 0.25, 2.2, ROOF);
    ts(cx, 0.72, 0, 7.2, 0.5, 2.0, UNDER);
    ts(cx, 1.28, 0, 7.4, 0.34, 2.52, YELLOW); // spot yellow: the stripe
    for (const wx of [-2.55, -0.85, 0.85, 2.55]) ts(cx + wx, 2.35, 0, 1.15, 0.9, 2.56, GLASS);
    for (const dx of [-1.75, 1.75]) ts(cx + dx, 1.65, 0, 0.95, 1.7, 2.46, ROOF);
  }
  ts(TRAIN_HALF - 0.1, 1.9, 0, 0.3, 2.2, 2.4, ROOF); // nose plate
  ts(TRAIN_HALF - 0.03, 2.5, 0, 0.2, 0.7, 1.8, GLASS); // windshield
}
const AXLE_X = CAR_X.flatMap((cx) => [cx - 2.5, cx + 2.5]);

function Train() {
  const grp = useRef<Group>(null);
  const parts = useRef<InstancedMesh>(null);
  const axles = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const p = parts.current;
    if (p) {
      TRAIN_SLABS.forEach((b, i) => {
        tmpO.position.set(b.x, b.y, b.z);
        tmpO.rotation.set(0, 0, 0);
        tmpO.scale.set(b.sx, b.sy, b.sz);
        tmpO.updateMatrix();
        p.setMatrixAt(i, tmpO.matrix);
        p.setColorAt(i, tmpC.set(b.c));
      });
      p.instanceMatrix.needsUpdate = true;
      p.instanceColor!.needsUpdate = true;
    }
    const a = axles.current;
    if (a) {
      AXLE_X.forEach((x, i) => {
        tmpO.position.set(x, 0.45, 0);
        tmpO.rotation.set(Math.PI / 2, 0, 0);
        tmpO.scale.set(1, 1, 1);
        tmpO.updateMatrix();
        a.setMatrixAt(i, tmpO.matrix);
        a.setColorAt(i, tmpC.set("#141419"));
      });
      a.instanceMatrix.needsUpdate = true;
      a.instanceColor!.needsUpdate = true;
    }
  }, []);

  useFrame(({ clock }) => {
    const g = grp.current;
    if (!g) return;
    const { t, quality, reducedMotion } = useScrollStore.getState();
    g.position.x = trainDisplayX(t, reducedMotion); // pure f(t), scrub-safe
    const sp = reducedMotion ? 0 : trainSpeed(t);
    const st = reducedMotion ? 0 : stepTime(clock.elapsedTime, quality === "low" ? 8 : 12);
    g.position.y = 0.05 * sp * Math.sin(st * 11); // running sway, on 2s
    const l = TRAIN_LURCH.v; // authored-time launch lurch (beat engine)
    g.scale.set(1 + 0.07 * l, 1 - 0.05 * l, 1);
  });

  return (
    <group ref={grp}>
      <instancedMesh
        ref={parts}
        args={[undefined, undefined, TRAIN_SLABS.length]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#FFFFFF" />
      </instancedMesh>
      <instancedMesh ref={axles} args={[undefined, undefined, AXLE_X.length]} frustumCulled={false}>
        <cylinderGeometry args={[0.48, 0.48, 2.5, 16]} />
        <meshBasicMaterial color="#FFFFFF" />
      </instancedMesh>
    </group>
  );
}

/* ---------------------------------- speed lines (authored scene art) ------- */
// Instanced streaks around the running train: length/visibility = f(trainSpeed),
// stepped y-jitter. OFF at dwells (< 0.1) and under reduced motion. These are
// geometry -- never blur, never near lettering (S2.16).
const LINE_N = 44;
const LINE_N_LOW = 22;
const LINES = Array.from({ length: LINE_N }, (_, i) => ({
  ox: -26 + 52 * hash(i, 3.17),
  oy: 0.5 + 3.6 * hash(i, 7.91),
  oz: hash(i, 5.23) < 0.7 ? 1.8 + 2.8 * hash(i, 9.4) : -(1.8 + 1.6 * hash(i, 2.6)),
  len: 0.7 + 0.6 * hash(i, 4.4),
}));

function SpeedLines() {
  const inst = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const m = inst.current;
    if (!m) return;
    for (let i = 0; i < LINE_N; i++) m.setColorAt(i, tmpC.set(i % 3 === 0 ? "#B9B9C2" : INK));
    m.instanceColor!.needsUpdate = true;
  }, []);

  useFrame(({ clock }) => {
    const m = inst.current;
    if (!m) return;
    const { t, quality, reducedMotion } = useScrollStore.getState();
    const sp = trainSpeed(t);
    if (reducedMotion || sp < 0.1) {
      m.visible = false;
      return;
    }
    m.visible = true;
    const n = quality === "low" ? LINE_N_LOW : LINE_N;
    m.count = n;
    const tx = trainDisplayX(t, false);
    const el = clock.elapsedTime;
    for (let i = 0; i < n; i++) {
      const L = LINES[i]!;
      tmpO.position.set(tx + L.ox, L.oy + 0.12 * stepNoise(el, 12, i), L.oz);
      tmpO.rotation.set(0, 0, 0);
      tmpO.scale.set((3 + 10 * sp) * L.len, 0.06, 0.06);
      tmpO.updateMatrix();
      m.setMatrixAt(i, tmpO.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={inst} args={[undefined, undefined, LINE_N]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#FFFFFF" />
    </instancedMesh>
  );
}

/* ------------------------------- the subway-map insert panel (2D inset) ---- */
// Floats proud of the tunnel wall (S5b insert-panel grammar). Spot-yellow
// line, light station dots, dark live marker riding pure f(trainX). Labels
// are the locked content.timeline names -- the two drive-past stations get
// their read here. No title: zero invented strings.
const MAP_W = 11.6;
const MAP_STEP = MAP_W / 7;
const mapU = (x: number) => (x - STATION_X[0]!) / (STATION_X[7]! - STATION_X[0]!);

function MapInsert() {
  const dots = useRef<InstancedMesh>(null);
  const marker = useRef<Mesh>(null);

  useLayoutEffect(() => {
    const m = dots.current;
    if (!m) return;
    for (let i = 0; i < 8; i++) {
      tmpO.position.set(-MAP_W / 2 + i * MAP_STEP, -0.55, 0.18);
      tmpO.rotation.set(Math.PI / 2, 0, 0);
      tmpO.scale.set(1, 1, 1);
      tmpO.updateMatrix();
      m.setMatrixAt(i, tmpO.matrix);
      m.setColorAt(i, tmpC.set(INK));
    }
    m.instanceMatrix.needsUpdate = true;
    m.instanceColor!.needsUpdate = true;
  }, []);

  useFrame(() => {
    const { t, reducedMotion } = useScrollStore.getState();
    const u = Math.min(Math.max(mapU(trainDisplayX(t, reducedMotion)), 0), 1);
    if (marker.current) marker.current.position.x = -MAP_W / 2 + MAP_W * u;
  });

  return (
    <group position={[-8, 6.2, -6.3]}>
      {/* ink frame + sheet */}
      <mesh position={[0, 0, -0.06]}>
        <boxGeometry args={[15.4, 6.1, 0.18]} />
        <meshBasicMaterial color={PAPER} />
      </mesh>
      <mesh>
        <boxGeometry args={[14.9, 5.6, 0.22]} />
        <meshBasicMaterial color={SHEET} />
      </mesh>
      {/* spot yellow: the map line */}
      <mesh position={[0, -0.55, 0.14]}>
        <boxGeometry args={[MAP_W + 0.6, 0.3, 0.06]} />
        <meshBasicMaterial color={YELLOW} />
      </mesh>
      <instancedMesh ref={dots} args={[undefined, undefined, 8]} frustumCulled={false}>
        <cylinderGeometry args={[0.3, 0.3, 0.1, 16]} />
        <meshBasicMaterial color="#FFFFFF" />
      </instancedMesh>
      {/* the live position marker (dark, rides the yellow line) */}
      <mesh ref={marker} position={[-MAP_W / 2, -0.55, 0.24]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.48, 0.48, 0.1, 20]} />
        <meshBasicMaterial color={PAPER} />
      </mesh>
      <Suspense fallback={null}>
        {NAMES.map((name, i) => (
          <Text
            key={name}
            position={[-MAP_W / 2 + i * MAP_STEP, i % 2 === 0 ? 0.05 : -1.15, 0.18]}
            font={BANGERS}
            fontSize={0.42}
            color={PAPER}
            anchorX="center"
            anchorY={i % 2 === 0 ? "bottom" : "top"}
            maxWidth={3.1}
            textAlign="center"
            lineHeight={1.05}
          >
            {name}
          </Text>
        ))}
      </Suspense>
    </group>
  );
}

/* ------------------- edge-run word: resting f(t) scroll window ------------- */
// Visibility = swishOpacity(t) (standing rule 2026-07-03, Pop DONATION_WINDOW
// pattern): scrub-safe both directions, deep jumps land it resting at scale
// exactly 1, fully faded before the page-flip gutter. The edge-run beat
// contributes only the TRAIN_LURCH slam + its budgeted flash; reduced motion
// = window only (lurch stays 0, wobble frozen). Locked whip-pool entry
// (whip[2] = the word the old seed 0.37 pop emitted) -- never invented.
const SWISH_WORD = lettering.onomatopoeia.whip[2]!; // SWISH

type TText = Mesh & { fillOpacity: number; outlineOpacity: number };

function SwishWord() {
  const txt = useRef<TText | null>(null);

  useFrame(({ clock }) => {
    const m = txt.current;
    if (!m) return;
    const { t, quality, reducedMotion } = useScrollStore.getState();
    const o = swishOpacity(t);
    m.visible = o > 0.001;
    if (!m.visible) return;
    m.fillOpacity = o;
    m.outlineOpacity = o;
    m.scale.setScalar(1 + 0.45 * TRAIN_LURCH.v);
    const st = reducedMotion ? 0 : stepTime(clock.elapsedTime, quality === "low" ? 8 : 12);
    m.rotation.z = -0.04 + 0.04 * Math.sin(st * 1.5);
  });

  return (
    <Suspense fallback={null}>
      <Text
        ref={(el: unknown) => {
          txt.current = el as TText | null;
        }}
        // above the last-stop dwell, west of the launch point; yawed toward
        // the eastward-looking finale camera (shot 5 views mostly along +x)
        position={[78, 5.2, 2]}
        rotation={[0, -1.25, 0]}
        font={BANGERS}
        fontSize={1.4}
        color={YELLOW}
        outlineWidth={0.12}
        outlineColor={PAPER}
        anchorX="center"
        anchorY="middle"
        visible={false}
      >
        {SWISH_WORD}
      </Text>
    </Suspense>
  );
}

/* ------------------------------------------- platform cameo: the cat ------- */
function PlatformCat() {
  const tail = useRef<Group>(null);

  useFrame(({ clock }) => {
    const { quality, reducedMotion } = useScrollStore.getState();
    const st = reducedMotion ? 0 : stepTime(clock.elapsedTime, quality === "low" ? 8 : 12);
    if (tail.current) tail.current.rotation.z = 0.85 + Math.sin(st * 1.6) * 0.14;
  });

  return (
    <group
      position={[CAT_BENCH_X, 2.28, -4.05]}
      scale={1}
      onClick={(e) => {
        e.stopPropagation();
        useScrollStore.getState().meow();
        sayWord(lettering.onomatopoeia.cat, [CX + CAT_BENCH_X, 4.2, -2], undefined, INK);
      }}
    >
      <CatModel mode="flat" pose="sitting" palette={CAT_PALETTE} rig={{ tail }} />
    </group>
  );
}

/* ----------------------------------------------------------- the set ------ */
export default function Screentone({ index }: { index: number }) {
  const issue = ISSUES[index]!;

  return (
    <IssueShell index={index} issue={issue}>
      <Slabs />
      <StationMarks />
      <StationSpreads />
      <Train />
      <SpeedLines />
      <MapInsert />
      <SwishWord />
      <Suspense fallback={null}>
        <PlatformCat />
      </Suspense>
    </IssueShell>
  );
}
