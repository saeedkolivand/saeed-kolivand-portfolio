"use client";

import { Suspense, useLayoutEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import {
  Color,
  Matrix4,
  Object3D,
  Quaternion,
  type Group,
  type InstancedMesh,
  type Mesh,
  type MeshBasicMaterial,
} from "three";
import IssueShell from "../_IssueShell";
import { ISSUES } from "../registry";
import CatModel, { HARLEY, type CatPalette } from "@/components/CatModel";
import { stepTime } from "@/lib/steppedClock";
import { useScrollStore } from "@/lib/scrollStore";
import { CAT_VOICE, sayWord } from "@/lib/onomatopoeia";
import { popScale } from "@/lib/pops";
import { content, issueCopy } from "@/lib/content";
import {
  chatPool,
  CYAN,
  DON_KICK,
  donationOpacity,
  INK,
  ORBIT_KICK,
  PAPER,
  PINK,
  spawnChat,
  spinAngle,
  YELLOW,
} from "./shots";

/**
 * Issue 8 POP PRINT (S0.3 range [0.671, 0.752], palette S0.4 row 8).
 * Oversaturated webcomic streaming stage: an OPEN island set (the 360 sees
 * it from every side), 3D speech balloons popping with locked chat lines
 * (chatPool, lib/pops.ts), a procedural emote rain billboarded on 12fps
 * steps, the pulsing two-faced ON AIR sign, the donation alert + giant
 * KA-CHING! beat, and the jaw-drop: spinAngle(t) whip-orbits the WHOLE WORLD
 * 360 under a butter-smooth crane (ruling in shots.md). Everything
 * scroll-driven is pure f(t); ambient life samples stepped time and freezes
 * under reduced motion; pops become fades (rulings in shots.md).
 */

// ---- working purples (S0.4 row 8 steps; rationale in shots.md) --------------
const DESK = "#38255C";
const RUG = "#241239";
const GEAR = "#3A2A57";
const DARK = "#140A24";
const SCREEN = "#123B4F";
const BANGERS = "/fonts/Bangers-Regular.ttf";

const PLATFORMS = content.streaming.platforms;
const TOOLS = content.streaming.tools;

type TText = Mesh & {
  text: string;
  sync: () => void;
  fillOpacity: number;
  outlineOpacity: number;
};

// ---- shared scratch (zero per-frame allocation) -----------------------------
const tmpO = new Object3D();
const tmpM = new Matrix4();
const tmpC = new Color();
const tmpQ = new Quaternion();
const tmpQ2 = new Quaternion();

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
  rz?: number;
}

const SLABS: Slab[] = [];
const slab = (
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  c: string,
  rz = 0,
) => SLABS.push({ x, y, z, sx, sy, sz, c, rz });

// desk + legs
slab(0, 2.3, 0, 7.5, 0.35, 3, DESK);
for (const lx of [-3.4, 3.4])
  for (const lz of [-1.2, 1.2]) slab(lx, 1.06, lz, 0.28, 2.12, 0.28, DARK);
// wide main monitor: bezel, glass, cyan title bar, a 2-pane code editor
// (center divider + two columns of ink/cyan/yellow code lines)
slab(0.4, 4.05, -0.7, 4.6, 2.3, 0.2, DARK);
slab(0.4, 4.05, -0.56, 4.25, 1.95, 0.05, SCREEN);
slab(0.4, 4.85, -0.53, 4.0, 0.24, 0.04, CYAN);
slab(0.4, 3.9, -0.53, 0.08, 1.55, 0.04, DARK);
// left pane
slab(-0.6, 4.35, -0.53, 1.3, 0.1, 0.04, CYAN);
slab(-0.75, 4.15, -0.53, 1.0, 0.1, 0.04, INK);
slab(-0.55, 3.95, -0.53, 1.4, 0.1, 0.04, YELLOW);
slab(-0.8, 3.75, -0.53, 0.9, 0.1, 0.04, INK);
// right pane
slab(1.5, 4.35, -0.53, 1.3, 0.1, 0.04, YELLOW);
slab(1.35, 4.15, -0.53, 1.0, 0.1, 0.04, CYAN);
slab(1.55, 3.95, -0.53, 1.4, 0.1, 0.04, INK);
slab(1.35, 3.75, -0.53, 0.9, 0.1, 0.04, CYAN);
// monitor stand
slab(0.4, 2.75, -0.75, 0.5, 0.55, 0.3, DARK);
slab(0.4, 2.51, -0.7, 1.3, 0.08, 0.9, DARK);
// monitor BACK detail + cable drop (the 360 films the set from behind)
slab(0.4, 4.6, -0.83, 3.0, 0.16, 0.06, CYAN);
slab(-0.4, 3.7, -0.83, 0.9, 0.7, 0.06, PINK);
slab(0.9, 3.1, -0.9, 0.1, 1.3, 0.1, YELLOW, 0.25);
// PC tower + accent stripes (both faces -- the 360)
slab(-3.1, 1.15, 0.2, 1.3, 2.3, 2.4, RUG);
slab(-3.1, 1.75, 1.42, 0.85, 0.12, 0.06, CYAN);
slab(-3.1, 1.45, 1.42, 0.85, 0.12, 0.06, PINK);
slab(-3.1, 1.75, -1.02, 0.85, 0.12, 0.06, PINK);
slab(-3.1, 1.45, -1.02, 0.85, 0.12, 0.06, CYAN);
// keyboard + Stream Deck prop (6 accent buttons)
slab(0.2, 2.55, 0.85, 2.3, 0.14, 0.8, GEAR);
slab(2.4, 2.56, 0.55, 1.05, 0.16, 0.8, DARK);
for (let i = 0; i < 6; i++)
  slab(
    2.1 + 0.3 * (i % 3),
    2.67,
    0.4 + 0.3 * Math.floor(i / 3),
    0.22,
    0.05,
    0.22,
    [PINK, CYAN, YELLOW][i % 3]!,
  );
// mic boom arm (dynamic capsule + glowing CYAN ring live in Props, on the end)
slab(-1.5, 2.95, 0.9, 0.12, 1.3, 0.12, DARK, 0.35);
slab(-2.15, 3.75, 0.82, 0.12, 1.2, 0.12, DARK, 1.15);
// the empty chair, pushed aside to the far left-back quadrant, out of every
// shot's sight line (iterations 1-2, loop log in shots.md) -- the cat is
// running the stream
slab(-7.4, 1.7, -0.6, 1.7, 0.25, 1.5, DARK);
slab(-7.4, 3.0, 0.1, 1.6, 2.4, 0.3, DESK);
slab(-7.4, 3.6, 0.27, 1.0, 0.18, 0.05, PINK);
slab(-7.4, 3.2, 0.27, 1.0, 0.18, 0.05, PINK);
slab(-7.4, 0.9, -0.6, 0.18, 1.4, 0.18, DARK);
slab(-7.4, 0.25, -0.6, 1.3, 0.12, 1.3, DARK);
// ON AIR truss: two poles + crossbar
slab(-6.3, 3.15, -2.8, 0.22, 6.3, 0.22, GEAR);
slab(-3.5, 3.15, -2.8, 0.22, 6.3, 0.22, GEAR);
slab(-4.9, 6.35, -2.8, 3.2, 0.2, 0.2, GEAR);
// ring light pole
slab(-4.2, 2.15, 1.4, 0.14, 4.3, 0.14, GEAR);

/* ---- real streamer setup (WS-D): monitors, softboxes, decks -------------- */
// 2 studio monitors on foam pads + stand posts, flanking the main monitor;
// fronts carry woofer/tweeter circles (Props), backs carry accent slabs for
// the 360
for (const [mx, mz, bc] of [
  [-2.6, -0.55, PINK],
  [3.2, -0.5, YELLOW],
] as const) {
  slab(mx, 2.53, mz, 1.15, 0.1, 0.85, GEAR); // foam pad
  slab(mx, 2.95, mz, 0.35, 0.9, 0.35, DARK); // stand post
  slab(mx, 4.2, mz, 1.1, 1.6, 0.9, DARK); // cabinet
  slab(mx, 4.5, mz - 0.48, 0.7, 0.12, 0.06, CYAN); // back port stripe
  slab(mx, 3.9, mz - 0.48, 0.5, 0.5, 0.06, bc); // back panel accent
}
// 2 softboxes hung from the ON AIR truss: DARK cabinet, bright INK diffusion
// panel, dark egg-crate grid (3x3 = 4 slabs), GEAR back brace for the orbit
for (const sx of [-5.5, -4.3] as const) {
  slab(sx, 5.7, -2.62, 1.4, 1.0, 0.25, DARK);
  slab(sx, 5.7, -2.49, 1.25, 0.85, 0.02, INK);
  slab(sx - 0.21, 5.7, -2.46, 0.03, 0.85, 0.02, PAPER);
  slab(sx + 0.21, 5.7, -2.46, 0.03, 0.85, 0.02, PAPER);
  slab(sx, 5.84, -2.46, 1.25, 0.03, 0.02, PAPER);
  slab(sx, 5.56, -2.46, 1.25, 0.03, 0.02, PAPER);
  slab(sx, 5.7, -2.75, 0.5, 0.14, 0.05, GEAR);
}
// Stream Deck Plus: dark deck + cyan touch strip (4 dials in Props)
slab(2.55, 2.55, 1.15, 1.05, 0.14, 0.48, DARK);
slab(2.55, 2.63, 1.08, 0.85, 0.03, 0.14, CYAN);
// Scarlett audio interface: pink body + yellow gain halo (2 knobs in Props)
slab(-1.7, 2.65, 1.15, 0.9, 0.35, 0.45, PINK);
slab(-1.95, 2.83, 1.0, 0.16, 0.02, 0.16, YELLOW);
// monitor controller: dark body (big knurled knob in Props)
slab(1.6, 2.6, 1.2, 0.5, 0.28, 0.44, DARK);
// keyboard keycap deck (subtle) + 2 pink accent keys (Esc/Enter nod)
slab(0.2, 2.63, 0.85, 2.0, 0.02, 0.66, PAPER);
slab(-0.72, 2.65, 0.55, 0.14, 0.02, 0.14, PINK);
slab(1.05, 2.65, 1.05, 0.18, 0.02, 0.16, PINK);
// LED backglow slabs low behind the desk (the purple wall wash)
slab(0, 1.2, -2.0, 6.5, 0.5, 0.1, PINK);
slab(0, 0.55, -2.0, 6.5, 0.3, 0.1, CYAN);

function Slabs() {
  const inst = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const m = inst.current;
    if (!m) return;
    SLABS.forEach((b, i) => {
      tmpO.position.set(b.x, b.y, b.z);
      tmpO.rotation.set(0, 0, b.rz ?? 0);
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

/* ---------------------------- rug + ring light (non-box primitives) -------- */
function Props() {
  return (
    <group>
      <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[11.0, 11.0, 0.08, 48]} />
        <meshBasicMaterial color={PINK} />
      </mesh>
      <mesh position={[0, -0.05, 0]}>
        <cylinderGeometry args={[10.4, 10.4, 0.12, 48]} />
        <meshBasicMaterial color={RUG} />
      </mesh>
      <mesh position={[-4.2, 4.4, 1.4]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.9, 0.9, 0.1, 24]} />
        <meshBasicMaterial color={YELLOW} />
      </mesh>
      <mesh position={[-4.2, 4.4, 1.4]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.62, 0.62, 0.14, 24]} />
        <meshBasicMaterial color={DARK} />
      </mesh>
      {/* studio monitor woofers (DARK ring + RUG cone) + CYAN tweeters --
          the Shot-3 front-face read; backs carry accent slabs for the 360 */}
      {(
        [
          // cabinets sit at z -0.55 / -0.50 with depth 0.9, so their front faces
          // are at -0.10 / -0.05. Each driver's back (mz - 0.03) rests 0.03 proud
          // of that face (the stacked-cylinder standoff), not the old 0.07 float.
          [-2.6, -0.04],
          [3.2, 0.01],
        ] as const
      ).map(([mx, mz]) => (
        <group key={mx}>
          <mesh position={[mx, 3.95, mz]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.32, 0.32, 0.06, 24]} />
            <meshBasicMaterial color={DARK} />
          </mesh>
          <mesh position={[mx, 3.95, mz + 0.03]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.06, 0.2, 0.12, 20]} />
            <meshBasicMaterial color={RUG} />
          </mesh>
          <mesh position={[mx, 4.62, mz]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.12, 0.12, 0.06, 16]} />
            <meshBasicMaterial color={CYAN} />
          </mesh>
        </group>
      ))}
      {/* Stream Deck Plus dials */}
      {[2.2, 2.42, 2.65, 2.88].map((kx) => (
        <mesh key={kx} position={[kx, 2.65, 1.3]}>
          <cylinderGeometry args={[0.06, 0.06, 0.07, 16]} />
          <meshBasicMaterial color={GEAR} />
        </mesh>
      ))}
      {/* Scarlett gain knobs */}
      {[-1.95, -1.5].map((kx) => (
        <mesh key={kx} position={[kx, 2.88, 1.0]}>
          <cylinderGeometry args={[0.09, 0.09, 0.12, 16]} />
          <meshBasicMaterial color={GEAR} />
        </mesh>
      ))}
      {/* monitor-controller big knurled knob (echoes the Desk-scene knob) */}
      <mesh position={[1.6, 2.85, 1.2]}>
        <cylinderGeometry args={[0.18, 0.18, 0.16, 24]} />
        <meshBasicMaterial color={GEAR} />
      </mesh>
      {/* dynamic mic capsule + glowing ring on the boom end (real ring is
          green; CYAN is the palette-legal glow) */}
      <mesh position={[-2.75, 4.0, 0.78]} rotation={[0, 0, -0.35]}>
        <cylinderGeometry args={[0.14, 0.14, 0.55, 20]} />
        <meshBasicMaterial color={DARK} />
      </mesh>
      <mesh position={[-2.84, 3.77, 0.78]} rotation={[0, 0, -0.35]}>
        <cylinderGeometry args={[0.17, 0.17, 0.1, 24]} />
        <meshBasicMaterial color={CYAN} />
      </mesh>
    </group>
  );
}

/* ------------------- ON AIR sign (diegetic, two-faced for the orbit) ------- */
function OnAirSign() {
  const pulse = useRef<Group>(null);

  useFrame(({ clock }) => {
    // ~0.5Hz stepped scale pulse -- no luminance strobe (S2.16)
    const { quality, reducedMotion } = useScrollStore.getState();
    const st = reducedMotion ? 0 : stepTime(clock.elapsedTime, quality === "low" ? 8 : 12);
    pulse.current?.scale.setScalar(1 + 0.05 * Math.sin(st * 3));
  });

  return (
    <group ref={pulse} position={[-4.9, 7.35, -2.8]}>
      <mesh>
        <boxGeometry args={[3.9, 1.7, 0.5]} />
        <meshBasicMaterial color={PINK} />
      </mesh>
      <mesh>
        <boxGeometry args={[3.5, 1.3, 0.56]} />
        <meshBasicMaterial color={DARK} />
      </mesh>
      <Suspense fallback={null}>
        <Text
          position={[0, 0, 0.32]}
          font={BANGERS}
          fontSize={0.85}
          color={YELLOW}
          anchorX="center"
          anchorY="middle"
        >
          ON AIR
        </Text>
        <Text
          position={[0, 0, -0.32]}
          rotation={[0, Math.PI, 0]}
          font={BANGERS}
          fontSize={0.85}
          color={YELLOW}
          anchorX="center"
          anchorY="middle"
        >
          ON AIR
        </Text>
      </Suspense>
    </group>
  );
}

/* -------- platform placards + gear labels (locked content.streaming) ------- */
function Signage() {
  return (
    <Suspense fallback={null}>
      {PLATFORMS.map((p, i) => (
        <group key={p} position={[i === 0 ? -6.35 : -3.45, 6.28, -2.6]}>
          <mesh>
            <boxGeometry args={[2.1, 0.68, 0.14]} />
            <meshBasicMaterial color={i === 0 ? PINK : CYAN} />
          </mesh>
          <Text
            position={[0, 0, 0.1]}
            font={BANGERS}
            fontSize={0.34}
            color={PAPER}
            anchorX="center"
            anchorY="middle"
          >
            {p}
          </Text>
        </group>
      ))}
      <Text
        position={[-0.75, 4.85, -0.5]}
        font={BANGERS}
        fontSize={0.2}
        color={PAPER}
        anchorX="center"
        anchorY="middle"
      >
        {TOOLS[0]!}
      </Text>
      <Text
        position={[2.4, 2.38, 1.53]}
        font={BANGERS}
        fontSize={0.2}
        color={CYAN}
        anchorX="center"
        anchorY="middle"
      >
        {TOOLS[1]!}
      </Text>
    </Suspense>
  );
}

/* -------------------- emote rain (instanced, procedural, no textures) ------ */
// Three face variants composed of flat circle/quad instances. Matrices and
// billboard facing update ONLY on 12fps step boundaries (8 low) -- the field
// animates on 2s by construction and visibly lags the butter lens (S2.8).
interface EmotePart {
  quad: boolean;
  x: number;
  y: number;
  sx: number;
  sy: number;
  rot: number;
  c: string;
}

const part = (
  quad: boolean,
  x: number,
  y: number,
  sx: number,
  sy: number,
  rot: number,
  c: string,
): EmotePart => ({ quad, x, y, sx, sy, rot, c });

const V_POG: EmotePart[] = [
  part(false, 0, 0, 1, 1, 0, YELLOW),
  part(false, -0.2, 0.15, 0.3, 0.34, 0, PAPER),
  part(false, 0.2, 0.15, 0.3, 0.34, 0, PAPER),
  part(false, 0, -0.2, 0.34, 0.42, 0, PAPER),
];
const V_LAUGH: EmotePart[] = [
  part(false, 0, 0, 1, 1, 0, CYAN),
  part(true, -0.2, 0.17, 0.34, 0.09, 0.45, PAPER),
  part(true, 0.2, 0.17, 0.34, 0.09, -0.45, PAPER),
  part(true, 0, -0.16, 0.55, 0.24, 0, PAPER),
];
const V_HEART: EmotePart[] = [
  part(false, -0.155, 0.14, 0.62, 0.62, 0, PINK),
  part(false, 0.155, 0.14, 0.62, 0.62, 0, PINK),
  part(true, 0, -0.14, 0.62, 0.62, Math.PI / 4, PINK),
];
const VARIANTS = [V_POG, V_LAUGH, V_HEART];

const EMOTE_N = 24;
const EMOTE_N_LOW = 12;

interface EmoteDef {
  a: number;
  r: number;
  v: number;
  s: number;
  y0: number;
  ph: number;
}

// inner radius 6.8 clears the ON AIR sign + desk sight lines (iteration 1)
const EMOTES: EmoteDef[] = Array.from({ length: EMOTE_N }, (_, i) => ({
  a: 2 * Math.PI * hash(i, 1.7),
  r: 6.8 + 3.6 * hash(i, 2.9),
  v: 0.5 + 0.55 * hash(i, 4.1),
  s: 0.75 + 0.55 * hash(i, 6.3),
  y0: 9.5 * hash(i, 8.8),
  ph: 6.28 * hash(i, 9.9),
}));
const EMOTE_MATS = EMOTES.map(() => new Matrix4());

// flat part lists, emote-ordered (low tier trims by instance count)
interface PartRef {
  e: number;
  local: Matrix4;
  c: string;
}
const CIRCLE_PARTS: PartRef[] = [];
const QUAD_PARTS: PartRef[] = [];
{
  const o = new Object3D();
  EMOTES.forEach((_, e) => {
    VARIANTS[e % VARIANTS.length]!.forEach((p, k) => {
      o.position.set(p.x, p.y, 0.012 * (k + 1));
      o.rotation.set(0, 0, p.rot);
      o.scale.set(p.sx, p.sy, 1);
      o.updateMatrix();
      const local = new Matrix4().copy(o.matrix);
      (p.quad ? QUAD_PARTS : CIRCLE_PARTS).push({ e, local, c: p.c });
    });
  });
}

function EmoteField() {
  const wrap = useRef<Group>(null);
  const circles = useRef<InstancedMesh>(null);
  const quads = useRef<InstancedMesh>(null);
  const camera = useThree((s) => s.camera);
  const lastStep = useRef(-1);

  useLayoutEffect(() => {
    for (const [mesh, parts] of [
      [circles.current, CIRCLE_PARTS],
      [quads.current, QUAD_PARTS],
    ] as const) {
      if (!mesh) continue;
      parts.forEach((p, i) => mesh.setColorAt(i, tmpC.set(p.c)));
      mesh.instanceColor!.needsUpdate = true;
    }
  }, []);

  useFrame(({ clock }) => {
    const c = circles.current;
    const q = quads.current;
    const w = wrap.current;
    if (!c || !q || !w) return;
    const { quality, reducedMotion } = useScrollStore.getState();
    const fps = quality === "low" ? 8 : 12;
    const n = quality === "low" ? EMOTE_N_LOW : EMOTE_N;
    const el = clock.elapsedTime;
    const stp = Math.floor(el * fps);
    if (stp === lastStep.current) return; // whole field holds between steps
    lastStep.current = stp;
    // stepped billboard: sample the smooth camera only on step boundaries;
    // local = inverse(parent world rotation, incl. the 360 spin) * camera
    w.getWorldQuaternion(tmpQ2);
    tmpQ.copy(tmpQ2).invert().multiply(camera.quaternion);
    const st = reducedMotion ? 0 : stepTime(el, fps);
    for (let e = 0; e < n; e++) {
      const d = EMOTES[e]!;
      tmpO.position.set(
        Math.cos(d.a) * d.r + 0.35 * Math.sin(st * 0.8 + d.ph),
        0.4 + ((d.y0 + d.v * st) % 9.5),
        Math.sin(d.a) * d.r + 0.35 * Math.cos(st * 0.7 + d.ph),
      );
      tmpO.quaternion.copy(tmpQ);
      tmpO.scale.setScalar(d.s);
      tmpO.updateMatrix();
      EMOTE_MATS[e]!.copy(tmpO.matrix);
    }
    for (const [mesh, parts] of [
      [c, CIRCLE_PARTS],
      [q, QUAD_PARTS],
    ] as const) {
      let i = 0;
      for (const p of parts) {
        if (p.e >= n) break; // emote-ordered: tail belongs to trimmed emotes
        tmpM.multiplyMatrices(EMOTE_MATS[p.e]!, p.local);
        mesh.setMatrixAt(i++, tmpM);
      }
      mesh.count = i;
      mesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group ref={wrap}>
      <instancedMesh
        ref={circles}
        args={[undefined, undefined, CIRCLE_PARTS.length]}
        frustumCulled={false}
      >
        <circleGeometry args={[0.5, 24]} />
        <meshBasicMaterial color="#FFFFFF" />
      </instancedMesh>
      <instancedMesh
        ref={quads}
        args={[undefined, undefined, QUAD_PARTS.length]}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#FFFFFF" />
      </instancedMesh>
    </group>
  );
}

/* ----------------- perimeter diamond garnish (FG plane in the 360) --------- */
const DIA_N = 10;
const DIA_N_LOW = 6;
const DIAS = Array.from({ length: DIA_N }, (_, i) => ({
  a: (i / DIA_N) * 2 * Math.PI + 0.4 * hash(i, 3.7),
  r: 10.9 + 1.1 * hash(i, 5.9),
  y: 2.2 + 5.4 * hash(i, 7.3),
  s: 0.55 + 0.65 * hash(i, 9.7),
  sp: (hash(i, 11.3) - 0.5) * 1.6,
  ph: 6.28 * hash(i, 13.1),
}));

function DiamondRing() {
  const inst = useRef<InstancedMesh>(null);
  const lastStep = useRef(-1);

  useLayoutEffect(() => {
    const m = inst.current;
    if (!m) return;
    DIAS.forEach((_, i) => m.setColorAt(i, tmpC.set([PINK, CYAN, YELLOW][i % 3]!)));
    m.instanceColor!.needsUpdate = true;
  }, []);

  useFrame(({ clock }) => {
    const m = inst.current;
    if (!m) return;
    const { quality, reducedMotion } = useScrollStore.getState();
    const fps = quality === "low" ? 8 : 12;
    const n = quality === "low" ? DIA_N_LOW : DIA_N;
    const el = clock.elapsedTime;
    const stp = Math.floor(el * fps);
    if (stp === lastStep.current) return;
    lastStep.current = stp;
    const st = reducedMotion ? 0 : stepTime(el, fps);
    for (let i = 0; i < n; i++) {
      const d = DIAS[i]!;
      tmpO.position.set(
        Math.cos(d.a) * d.r,
        d.y + 0.35 * Math.sin(st * 0.9 + d.ph),
        Math.sin(d.a) * d.r,
      );
      tmpO.rotation.set(0, d.a + Math.PI / 2, Math.PI / 4 + st * d.sp);
      tmpO.scale.set(d.s, d.s, 0.12);
      tmpO.updateMatrix();
      m.setMatrixAt(i, tmpO.matrix);
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={inst} args={[undefined, undefined, DIA_N]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#FFFFFF" />
    </instancedMesh>
  );
}

/* --------------- chat balloons (chatPool renderer + ambient cadence) ------- */
const B_N = chatPool.slots.length;

function ChatBalloons() {
  const camera = useThree((s) => s.camera);
  const wrap = useRef<Group>(null);
  const groups = useRef<(Group | null)[]>([]);
  const texts = useRef<(TText | null)[]>([]);
  const mats = useRef<(MeshBasicMaterial | null)[]>([]); // 3 per slot: body, halo, tail
  const gens = useRef<number[]>(new Array<number>(B_N).fill(-1));
  const lastStep = useRef(-1);
  const lastSpawn = useRef(-1);
  const bill = useRef(new Quaternion());

  useFrame(({ clock }) => {
    const { quality, reducedMotion } = useScrollStore.getState();
    const fps = quality === "low" ? 8 : 12;
    const el = clock.elapsedTime;
    // ambient pop cadence: one locked chat line per interval (intensity 5)
    const ivl = quality === "low" ? 0.8 : 0.5;
    const sp = Math.floor(el / ivl);
    if (sp !== lastSpawn.current) {
      lastSpawn.current = sp;
      spawnChat(hash(sp, 9.13));
    }
    // stepped billboard facing, shared by all balloons (S2.8 contrast)
    const stp = Math.floor(el * fps);
    if (stp !== lastStep.current && wrap.current) {
      lastStep.current = stp;
      wrap.current.getWorldQuaternion(tmpQ2);
      bill.current.copy(tmpQ2).invert().multiply(camera.quaternion);
    }
    const now = performance.now();
    for (let i = 0; i < B_N; i++) {
      const g = groups.current[i];
      if (!g) continue;
      const slot = chatPool.slots[i]!;
      if (!slot.active) {
        g.visible = false;
        continue;
      }
      const age = chatPool.age(slot, now);
      if (!slot.active) {
        g.visible = false; // outlived life, retired by age()
        continue;
      }
      if (gens.current[i] !== slot.gen) {
        gens.current[i] = slot.gen;
        const txt = texts.current[i];
        if (txt) {
          txt.text = slot.data.line;
          txt.sync();
        }
        mats.current[i * 3 + 1]?.color.set(slot.data.accent);
      }
      // pops become fades under reduced motion (ruling in shots.md)
      const s = reducedMotion ? 0.95 : popScale(age, chatPool.life, fps, 0.18, 0.3, 0.35);
      if (s <= 0.001) {
        g.visible = false;
        continue;
      }
      const alpha = reducedMotion
        ? Math.max(0, Math.min(1, age / 0.35, (chatPool.life - age) / 0.45))
        : 1;
      g.visible = true;
      g.position.copy(slot.pos);
      if (!reducedMotion) g.position.y += 0.35 * stepTime(age, fps); // stepped rise
      g.quaternion.copy(bill.current);
      g.rotateZ(
        (slot.seed - 0.5) * 0.22 +
          (reducedMotion ? 0 : 0.04 * Math.sin(stepTime(age, fps) * 7)),
      );
      g.scale.setScalar(s);
      for (let k = 0; k < 3; k++) {
        const m = mats.current[i * 3 + k];
        if (m) m.opacity = alpha;
      }
      const txt = texts.current[i];
      if (txt) txt.fillOpacity = alpha;
    }
  });

  return (
    <group ref={wrap}>
      <Suspense fallback={null}>
        {chatPool.slots.map((_, i) => (
          <group
            key={i}
            ref={(el) => {
              groups.current[i] = el;
            }}
            visible={false}
          >
            {/* accent halo rim behind the body */}
            <mesh position={[0, 0, -0.16]} scale={[2.55, 1.24, 0.6]}>
              <sphereGeometry args={[1, 20, 14]} />
              <meshBasicMaterial
                ref={(m) => {
                  mats.current[i * 3 + 1] = m;
                }}
                color={PINK}
                transparent
              />
            </mesh>
            <mesh scale={[2.35, 1.06, 0.6]}>
              <sphereGeometry args={[1, 20, 14]} />
              <meshBasicMaterial
                ref={(m) => {
                  mats.current[i * 3] = m;
                }}
                color={INK}
                transparent
              />
            </mesh>
            <mesh position={[-0.95, -1.0, 0.05]} rotation={[0, 0, 2.55]}>
              <coneGeometry args={[0.26, 0.95, 6]} />
              <meshBasicMaterial
                ref={(m) => {
                  mats.current[i * 3 + 2] = m;
                }}
                color={INK}
                transparent
              />
            </mesh>
            <Text
              ref={(el: unknown) => {
                texts.current[i] = el as TText | null;
              }}
              position={[0, 0, 0.68]}
              font={BANGERS}
              fontSize={0.42}
              color={PAPER}
              anchorX="center"
              anchorY="middle"
              maxWidth={3.9}
              textAlign="center"
              lineHeight={1.05}
            >
              {" "}
            </Text>
          </group>
        ))}
      </Suspense>
    </group>
  );
}

/* ------- donation alert panel (pure f(t) window + beat slam energy) -------- */
// Visibility = donationOpacity(t) window (title-card ruling 2026-07-03):
// scrub-safe, deep jumps land it resting visible at scale exactly 1. The
// beat contributes only the DON_KICK slam + its budgeted flash.
function DonationAlert() {
  const g = useRef<Group>(null);
  const mats = useRef<(MeshBasicMaterial | null)[]>([]);
  const txt = useRef<TText | null>(null);

  useFrame(() => {
    const gg = g.current;
    if (!gg) return;
    const o = donationOpacity(useScrollStore.getState().t);
    gg.visible = o > 0.001;
    if (!gg.visible) return;
    gg.scale.setScalar(1 + 0.4 * DON_KICK.v);
    for (const m of mats.current) if (m) m.opacity = o;
    if (txt.current) txt.current.fillOpacity = o;
  });

  return (
    <group ref={g} position={[0.4, 5.35, 1.4]} visible={false}>
      <mesh position={[0, 0, -0.12]}>
        <boxGeometry args={[7.9, 2.1, 0.18]} />
        <meshBasicMaterial
          ref={(m) => {
            mats.current[0] = m;
          }}
          color={YELLOW}
          transparent
        />
      </mesh>
      <mesh>
        <boxGeometry args={[7.5, 1.7, 0.2]} />
        <meshBasicMaterial
          ref={(m) => {
            mats.current[1] = m;
          }}
          color={PINK}
          transparent
        />
      </mesh>
      <Suspense fallback={null}>
        <Text
          ref={(el: unknown) => {
            txt.current = el as TText | null;
          }}
          position={[0, 0, 0.14]}
          font={BANGERS}
          fontSize={0.4}
          color={PAPER}
          anchorX="center"
          anchorY="middle"
          maxWidth={7}
          textAlign="center"
          lineHeight={1.1}
        >
          {issueCopy.popPrint.donationAlert}
        </Text>
      </Suspense>
    </group>
  );
}

/* ------------- the giant donation word (same f(t) window) ------------------ */
// Rests BELOW the alert, in front of the desk, so the two read together on
// the shared plateau (the old pooled pop covered the alert copy -- loop log
// in shots.md). Ambient wobble samples stepped time; freezes under reduced
// motion. No pool, no lifetime, no Math.random.
function DonationBoom() {
  const txt = useRef<TText | null>(null);

  useFrame(({ clock }) => {
    const m = txt.current;
    if (!m) return;
    const { t, quality, reducedMotion } = useScrollStore.getState();
    const o = donationOpacity(t);
    m.visible = o > 0.001;
    if (!m.visible) return;
    m.fillOpacity = o;
    m.outlineOpacity = o;
    m.scale.setScalar(1 + 0.5 * DON_KICK.v);
    const st = reducedMotion ? 0 : stepTime(clock.elapsedTime, quality === "low" ? 8 : 12);
    m.rotation.z = -0.06 + 0.05 * Math.sin(st * 1.4);
  });

  return (
    <Suspense fallback={null}>
      <Text
        ref={(el: unknown) => {
          txt.current = el as TText | null;
        }}
        position={[0.3, 3.9, 2.8]}
        font={BANGERS}
        fontSize={1.65}
        color={YELLOW}
        outlineWidth={0.18}
        outlineColor={PAPER}
        anchorX="center"
        anchorY="middle"
        visible={false}
      >
        {issueCopy.popPrint.donationBoom}
      </Text>
    </Suspense>
  );
}

/* ------------------- the streamer: toon cat on the desk -------------------- */
// Toon (dimensional) build: a flat cat vanishes edge-on during the 360.
// Harley body (golden tabby default, user directive 2026-07-03): the fur
// gold separates from the dark panels even better than the old gear-purple
// lift (iteration 1). Row-8 kin identity marks stay (cyan collar, pink tag,
// yellow tail tip -- collar/tag/accent are approved stylization).
const CAT_PALETTE: CatPalette = {
  ...HARLEY,
  collar: CYAN,
  tag: PINK,
  accent: YELLOW,
};

function DeskCat() {
  const tail = useRef<Group>(null);

  useFrame(({ clock }) => {
    const { quality, reducedMotion } = useScrollStore.getState();
    const st = reducedMotion ? 0 : stepTime(clock.elapsedTime, quality === "low" ? 8 : 12);
    if (tail.current) tail.current.rotation.z = 0.85 + Math.sin(st * 1.6) * 0.14;
  });

  return (
    <group
      // perched on the PC tower: clear silhouette against the paper, never
      // lost in front of the dark screen; three-quarter turn toward the
      // front cameras so the profile reads (iterations 1-2, shots.md log).
      // Seated on the desk top over the tower: surface y 2.475 (desk slab
      // 2.3 + 0.35/2) + 0.025 paw-contact allowance -- sitting-pose leg tips
      // land at local y ~ 0, socks kiss the surface (user fix round 2: the
      // cat floated at y 2.85)
      position={[-3.0, 2.5, 0.35]}
      rotation={[0, 0.6, 0]}
      scale={0.75}
      onClick={(e) => {
        e.stopPropagation();
        useScrollStore.getState().meow();
        sayWord(
          CAT_VOICE,
          [e.point.x, e.point.y + 1.1, e.point.z],
          undefined,
          INK,
        );
      }}
    >
      <CatModel mode="toon" pose="sitting" palette={CAT_PALETTE} rig={{ tail }} />
    </group>
  );
}

/* ----------------------------------------------------------- the set ------ */
export default function Pop({ index }: { index: number }) {
  const issue = ISSUES[index]!;
  const spin = useRef<Group>(null);

  useFrame(() => {
    const g = spin.current;
    if (!g) return;
    const { t, reducedMotion } = useScrollStore.getState();
    g.rotation.y = spinAngle(t, reducedMotion); // THE 360 -- pure f(t)
    const k = ORBIT_KICK.v; // authored-time squash kick (beat engine)
    g.scale.set(1 + 0.035 * k, 1 - 0.05 * k, 1 + 0.035 * k);
  });

  return (
    <IssueShell index={index} issue={issue}>
      <group ref={spin}>
        <Slabs />
        <Props />
        <OnAirSign />
        <Signage />
        <EmoteField />
        <DiamondRing />
        <ChatBalloons />
        <DonationAlert />
        <DonationBoom />
        <Suspense fallback={null}>
          <DeskCat />
        </Suspense>
      </group>
    </IssueShell>
  );
}
