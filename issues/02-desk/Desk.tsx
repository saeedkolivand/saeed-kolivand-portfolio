"use client";

import { useLayoutEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { PerspectiveCamera, RenderTexture } from "@react-three/drei";
import { BackSide, Color, Matrix4, Vector3, type Group, type InstancedMesh, type Mesh } from "three";
import { toonRamp } from "@/lib/toon";
import { stepTime } from "@/lib/steppedClock";
import { useScrollStore } from "@/lib/scrollStore";
import { sayWord } from "@/lib/onomatopoeia";
import { lettering } from "@/lib/content";
import { clamp01, easeInOut, lerp } from "@/lib/shots";
import { issueCenter } from "../timeline";
import { KEYS_R, LAND_R, MON_R, PANELS_R } from "./shots";

/**
 * Issue 2 - Desk: warm full-color halftone world (S0.4 row 2).
 * Everything scroll-driven is pure f(t) read via getState() in useFrame;
 * idle motion (tail flick, RGB strip, cursor) samples stepTime (S2.8).
 * Jaw-drop: live 3-panel RT composite, mounted only inside its t window
 * (3 live RTs high tier, 2 on low - the keyboard panel goes flat).
 */

const PAPER = "#F6EFE3";
const INK = "#1C1B1A";
const ORANGE = "#F5A623";
const TEAL = "#2BB3A3";
const RED = "#E2574C";
const WOOD = "#D9A967";

const CENTER = issueCenter(2);
const CX = CENTER[0];

// -- shared scratch (zero per-frame allocation) ------------------------------
const MAT = new Matrix4();
const COL = new Color();

const crossed = (last: number, now: number, trig: number) =>
  (last < trig && now >= trig) || (last > trig && now <= trig);

// -- onomatopoeia pools (from content.ts; single-word slices stay pooled) ----
const CAT_WORDS = lettering.onomatopoeia.cat as readonly string[];
const KEYCAP_WORDS = lettering.onomatopoeia.keycaps;
const THUMP = CAT_WORDS.filter((w) => w === "THUMP");
const PADD = CAT_WORDS.filter((w) => w === "PADD");
const THUMP_T = LAND_R[0] + 0.35 * (LAND_R[1] - LAND_R[0]);
const THUMP_POS = new Vector3(CX - 2.7, 1.1, 0.9);
const BAT_T = MON_R[0] + 0.86 * (MON_R[1] - MON_R[0]);
const BAT_POS = new Vector3(CX - 0.45, 1.85, -0.05);

// -- keyboard grid -----------------------------------------------------------
const KEY_COLS = 13;
const KEY_ROWS = 5;
const KEY_COUNT = KEY_COLS * KEY_ROWS;
const KB_X = 0.3;
const KB_Z = 1.1;
const KEY_Y = 0.16;
const keyX = (col: number) => KB_X + (col - (KEY_COLS - 1) / 2) * 0.2;
const keyZ = (row: number) => KB_Z + (row - (KEY_ROWS - 1) / 2) * 0.19;

/** CLACK triggers along the shot-2 track (camera moves -x -> +x). */
const CLACK_ROWS = [2, 1, 3, 2, 1, 2] as const;
const CLACKS = [0.12, 0.3, 0.46, 0.62, 0.76, 0.9].map((p, j) => {
  const col = Math.round(lerp(1, KEY_COLS - 2, p));
  const row = CLACK_ROWS[j]!;
  return {
    t: KEYS_R[0] + p * (KEYS_R[1] - KEYS_R[0]),
    idx: row * KEY_COLS + col,
    pos: new Vector3(CX + keyX(col), 0.5, keyZ(row)),
    seed: j * 0.161 + 0.05,
  };
});
const KEY_TRIG = new Map(CLACKS.map((c) => [c.idx, c.t]));
const DIP_HALF = 0.0012; // t half-width of a key dip envelope

function KeyboardUnit({ say }: { say: boolean }) {
  const inst = useRef<InstancedMesh>(null);
  const lastT = useRef<number | null>(null);
  const ramp = toonRamp();

  useLayoutEffect(() => {
    const m = inst.current;
    if (!m) return;
    for (let i = 0; i < KEY_COUNT; i++) {
      const accent = (i * 37) % 97 < 12;
      COL.set(accent ? [ORANGE, TEAL, RED][i % 3]! : INK);
      m.setColorAt(i, COL);
    }
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, []);

  useFrame(() => {
    const m = inst.current;
    if (!m) return;
    const { t, reducedMotion } = useScrollStore.getState();
    for (let row = 0; row < KEY_ROWS; row++) {
      for (let col = 0; col < KEY_COLS; col++) {
        const idx = row * KEY_COLS + col;
        const trig = KEY_TRIG.get(idx);
        let dip = 0;
        if (trig !== undefined) {
          const b = Math.max(0, 1 - Math.abs(t - trig) / DIP_HALF);
          dip = b * b * (3 - 2 * b) * 0.06;
        }
        MAT.makeTranslation(keyX(col), KEY_Y - dip, keyZ(row));
        m.setMatrixAt(idx, MAT);
      }
    }
    m.instanceMatrix.needsUpdate = true;
    if (say) {
      const last = lastT.current;
      lastT.current = t;
      if (last !== null && !reducedMotion) {
        for (const c of CLACKS) {
          if (crossed(last, t, c.t)) sayWord(KEYCAP_WORDS, c.pos, c.seed, ORANGE);
        }
      }
    }
  });

  return (
    <group>
      <mesh position={[KB_X, 0.06, KB_Z]}>
        <boxGeometry args={[3.0, 0.12, 1.15]} />
        <meshToonMaterial color="#E7DECE" gradientMap={ramp} />
      </mesh>
      <instancedMesh ref={inst} args={[undefined, undefined, KEY_COUNT]}>
        <boxGeometry args={[0.16, 0.09, 0.15]} />
        <meshToonMaterial color="#FFFFFF" gradientMap={ramp} />
      </instancedMesh>
    </group>
  );
}

// -- RGB strip along the desk's back edge, hue-cycled on stepped time --------
const STRIP_N = 24;

function LightStrip() {
  const inst = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const m = inst.current;
    if (!m) return;
    for (let i = 0; i < STRIP_N; i++) {
      MAT.makeTranslation(-4.4 + i * (8.8 / (STRIP_N - 1)), 0.08, -2.35);
      m.setMatrixAt(i, MAT);
      COL.setHSL(i / STRIP_N, 0.8, 0.6);
      m.setColorAt(i, COL);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, []);

  useFrame(({ clock }) => {
    const m = inst.current;
    if (!m) return;
    const s = stepTime(clock.elapsedTime, 12);
    for (let i = 0; i < STRIP_N; i++) {
      COL.setHSL((i / STRIP_N + s * 0.12) % 1, 0.8, 0.6);
      m.setColorAt(i, COL);
    }
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={inst} args={[undefined, undefined, STRIP_N]}>
      <boxGeometry args={[0.3, 0.09, 0.09]} />
      <meshBasicMaterial color="#FFFFFF" />
    </instancedMesh>
  );
}

// -- monitor screen content (reused live on the desk AND inside RT panel 3) --
const frac = (x: number) => x - Math.floor(x);
const CODE_COLORS = [TEAL, ORANGE, RED, "#EDE6D6"] as const;
const CODE_ROWS = Array.from({ length: 12 }, (_, i) => ({
  indent: (i % 4) * 0.18,
  w: 0.5 + frac(Math.sin((i + 1) * 12.9898) * 43758.5453) * 1.5,
  color: CODE_COLORS[i % 4]!,
}));

function ScreenContent() {
  const cursor = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (cursor.current) cursor.current.visible = Math.floor(clock.elapsedTime * 2) % 2 === 0;
  });
  return (
    <group>
      <mesh>
        <planeGeometry args={[3.2, 1.8]} />
        <meshBasicMaterial color="#232020" />
      </mesh>
      {CODE_ROWS.map((r, i) => (
        <mesh key={i} position={[-1.45 + r.indent + r.w / 2, 0.72 - i * 0.125, 0.005]}>
          <planeGeometry args={[r.w, 0.055]} />
          <meshBasicMaterial color={r.color} />
        </mesh>
      ))}
      <mesh ref={cursor} position={[-1.2, 0.72 - 12 * 0.125, 0.006]}>
        <planeGeometry args={[0.05, 0.09]} />
        <meshBasicMaterial color={PAPER} />
      </mesh>
    </group>
  );
}

// -- the cat (through-line, S5b.1) -------------------------------------------
// Enters frame-left (Noir exits frame-right), lands with a THUMP, loafs,
// then sits by the monitor for shot 4 and bats the halftone dot. All
// positions pure f(t); tail flick samples 12 fps stepped time.
const MON_SWITCH = PANELS_R[1] + 0.002; // reposition hidden inside the whip gutter

function DeskCat({ say = false }: { say?: boolean }) {
  const grp = useRef<Group>(null);
  const head = useRef<Group>(null);
  const tail = useRef<Group>(null);
  const paw = useRef<Group>(null);
  const lines = useRef<Group>(null);
  const lastT = useRef<number | null>(null);
  const ramp = toonRamp();

  useFrame(({ clock }) => {
    const g = grp.current;
    if (!g || !head.current || !tail.current || !paw.current || !lines.current) return;
    const { t, reducedMotion } = useScrollStore.getState();
    const s = stepTime(clock.elapsedTime, 12);
    let flick = Math.sin(s * 2.2) * 0.35;
    let wrap = 0;
    let pawSwing = 0;
    let arc = 0;
    // scrub-safe defaults (shot 4 overrides them; scrolling back restores)
    head.current.rotation.z = 0;
    paw.current.position.set(0.5, 0.42, 0.16);

    if (t < MON_SWITCH) {
      const p1 = clamp01((t - LAND_R[0]) / (LAND_R[1] - LAND_R[0]));
      if (p1 < 0.35) {
        // airborne arc in from frame-left (upper), stretched
        const a = p1 / 0.35;
        g.position.set(lerp(-6.4, -2.7, a), 3.1 * (1 - a) * (1 - a), 0.9);
        g.rotation.set(0, 0, lerp(0.4, -0.05, a));
        g.scale.set(1.12, 0.9, 1);
        head.current.position.set(0.5, 0.62, 0);
      } else {
        // land (squash) then curl into a loaf
        const q = clamp01((p1 - 0.35) / 0.15);
        const squash = Math.sin(Math.PI * q);
        const c = easeInOut(clamp01((p1 - 0.5) / 0.5));
        g.position.set(-2.7, 0, 0.9);
        g.rotation.set(0, 0, 0);
        g.scale.set(1 + 0.18 * squash, 1 - 0.28 * squash - 0.12 * c, 1);
        head.current.position.set(lerp(0.5, 0.42, c), lerp(0.62, 0.46, c), 0);
        wrap = 1.4 * c;
        flick *= 1 - 0.6 * c; // calmer tail once loafed
      }
    } else {
      // shot 4: perched frame-right between camera and monitor (FG depth
      // plane), gazing up at the bobbing dot. Rears up (wind-up), whips the
      // paw at p4 ~ 0.86 -- contact matches the DotBat launch -- then
      // settles. All envelopes pure f(p4), scrub-safe.
      const p4 = clamp01((t - MON_R[0]) / (MON_R[1] - MON_R[0]));
      const rear = easeInOut(clamp01((p4 - 0.7) / 0.15));
      const strike = easeInOut(clamp01((p4 - 0.845) / 0.035));
      const settle = easeInOut(clamp01((p4 - 0.93) / 0.07));
      const up = rear * (1 - 0.45 * settle);
      const pop = Math.sin(Math.PI * clamp01((p4 - 0.845) / 0.05)); // one-beat scale pop, no flash
      g.position.set(-1.35, 0.3 * up, -0.5);
      g.rotation.set(0, -0.3, 0.3 * up);
      g.scale.setScalar(1 + 0.09 * pop);
      head.current.position.set(0.5, 0.74, 0);
      head.current.rotation.z = 0.15 * up + 0.06 * Math.sin(s * 2.4); // tracks the dot bob
      paw.current.position.set(lerp(0.5, 0.82, strike), lerp(0.42, 0.6, strike), 0.16);
      pawSwing = -0.7 * rear + 2.6 * strike * (1 - 0.55 * settle);
      flick += 0.9 * up;
      wrap = 0.35;
      arc = Math.sin(Math.PI * clamp01((p4 - 0.85) / 0.06));
    }

    tail.current.rotation.set(flick, wrap, 0.9);
    paw.current.rotation.set(0, 0, pawSwing);
    lines.current.scale.setScalar(Math.max(arc, 1e-4));

    if (say) {
      const last = lastT.current;
      lastT.current = t;
      if (last !== null && !reducedMotion) {
        if (crossed(last, t, THUMP_T)) sayWord(THUMP.length ? THUMP : CAT_WORDS, THUMP_POS, 0, "#FFFFFF");
        if (crossed(last, t, BAT_T)) sayWord(PADD.length ? PADD : CAT_WORDS, BAT_POS, 0, TEAL);
      }
    }
  });

  return (
    <group ref={grp}>
      {/* body + paper rim outline (inverted hull) so ink reads against the
          ink monitor bezel and dark screen, not just the wood */}
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[0.95, 0.5, 0.48]} />
        <meshToonMaterial color={INK} gradientMap={ramp} />
      </mesh>
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[1.01, 0.56, 0.54]} />
        <meshBasicMaterial color={PAPER} side={BackSide} />
      </mesh>
      {/* chest patch */}
      <mesh position={[0.44, 0.26, 0]}>
        <boxGeometry args={[0.08, 0.26, 0.2]} />
        <meshToonMaterial color={PAPER} gradientMap={ramp} />
      </mesh>
      {/* collar + tag */}
      <mesh position={[0.42, 0.5, 0]}>
        <boxGeometry args={[0.12, 0.07, 0.4]} />
        <meshToonMaterial color={TEAL} gradientMap={ramp} />
      </mesh>
      <mesh position={[0.48, 0.43, 0]}>
        <boxGeometry args={[0.05, 0.08, 0.08]} />
        <meshToonMaterial color={RED} gradientMap={ramp} />
      </mesh>
      <group ref={head} position={[0.5, 0.62, 0]}>
        <mesh>
          <boxGeometry args={[0.44, 0.42, 0.42]} />
          <meshToonMaterial color={INK} gradientMap={ramp} />
        </mesh>
        <mesh>
          <boxGeometry args={[0.5, 0.48, 0.48]} />
          <meshBasicMaterial color={PAPER} side={BackSide} />
        </mesh>
        {/* ears + orange inner ears */}
        <mesh position={[0.08, 0.28, 0.12]} rotation={[0, 0, 0.25]}>
          <coneGeometry args={[0.09, 0.22, 4]} />
          <meshToonMaterial color={INK} gradientMap={ramp} />
        </mesh>
        <mesh position={[0.08, 0.28, -0.12]} rotation={[0, 0, -0.25]}>
          <coneGeometry args={[0.09, 0.22, 4]} />
          <meshToonMaterial color={INK} gradientMap={ramp} />
        </mesh>
        <mesh position={[0.1, 0.27, 0.12]} rotation={[0, 0, 0.25]}>
          <coneGeometry args={[0.05, 0.14, 4]} />
          <meshBasicMaterial color={ORANGE} />
        </mesh>
        <mesh position={[0.1, 0.27, -0.12]} rotation={[0, 0, -0.25]}>
          <coneGeometry args={[0.05, 0.14, 4]} />
          <meshBasicMaterial color={ORANGE} />
        </mesh>
        {/* eyes: flat orange + ink pupils (comic cat stare) */}
        <mesh position={[0.225, 0.06, 0.11]}>
          <boxGeometry args={[0.035, 0.11, 0.1]} />
          <meshBasicMaterial color={ORANGE} />
        </mesh>
        <mesh position={[0.225, 0.06, -0.11]}>
          <boxGeometry args={[0.035, 0.11, 0.1]} />
          <meshBasicMaterial color={ORANGE} />
        </mesh>
        <mesh position={[0.235, 0.04, 0.11]}>
          <boxGeometry args={[0.03, 0.06, 0.035]} />
          <meshBasicMaterial color={INK} />
        </mesh>
        <mesh position={[0.235, 0.04, -0.11]}>
          <boxGeometry args={[0.03, 0.06, 0.035]} />
          <meshBasicMaterial color={INK} />
        </mesh>
        {/* paper muzzle + red nose */}
        <mesh position={[0.225, -0.12, 0]}>
          <boxGeometry args={[0.05, 0.13, 0.15]} />
          <meshToonMaterial color={PAPER} gradientMap={ramp} />
        </mesh>
        <mesh position={[0.245, -0.05, 0]}>
          <boxGeometry args={[0.03, 0.04, 0.05]} />
          <meshBasicMaterial color={RED} />
        </mesh>
      </group>
      <group ref={paw} position={[0.5, 0.42, 0.16]}>
        <mesh position={[0, -0.18, 0]}>
          <cylinderGeometry args={[0.055, 0.06, 0.36, 8]} />
          <meshToonMaterial color={INK} gradientMap={ramp} />
        </mesh>
        {/* paper sock on the batting paw */}
        <mesh position={[0, -0.33, 0]}>
          <cylinderGeometry args={[0.06, 0.065, 0.1, 8]} />
          <meshToonMaterial color={PAPER} gradientMap={ramp} />
        </mesh>
      </group>
      <group ref={tail} position={[-0.48, 0.4, 0]}>
        <mesh position={[-0.18, 0.18, 0]} rotation={[0, 0, 0.9]}>
          <cylinderGeometry args={[0.05, 0.07, 0.55, 8]} />
          <meshToonMaterial color={INK} gradientMap={ramp} />
        </mesh>
        <mesh position={[-0.37, 0.34, 0]} rotation={[0, 0, 0.9]}>
          <cylinderGeometry args={[0.042, 0.05, 0.16, 8]} />
          <meshToonMaterial color={ORANGE} gradientMap={ramp} />
        </mesh>
      </group>
      {/* bat motion lines: speed-line fan at the strike arc, scale = f(p4) */}
      <group ref={lines} position={[1.32, 0.95, 0.2]} scale={0.0001}>
        <mesh position={[0, 0.12, 0]} rotation={[0, 0, 0.5]}>
          <boxGeometry args={[0.3, 0.028, 0.01]} />
          <meshBasicMaterial color={ORANGE} />
        </mesh>
        <mesh position={[0.06, 0, 0]} rotation={[0, 0, 0.05]}>
          <boxGeometry args={[0.34, 0.028, 0.01]} />
          <meshBasicMaterial color={ORANGE} />
        </mesh>
        <mesh position={[0, -0.12, 0]} rotation={[0, 0, -0.4]}>
          <boxGeometry args={[0.3, 0.028, 0.01]} />
          <meshBasicMaterial color={ORANGE} />
        </mesh>
      </group>
    </group>
  );
}

// -- floating halftone dot + bat trajectory (motivates the dot-zoom out) -----
function DotBat() {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const { t } = useScrollStore.getState();
    g.visible = t > PANELS_R[1];
    if (!g.visible) return;
    const p4 = clamp01((t - MON_R[0]) / (MON_R[1] - MON_R[0]));
    const s = stepTime(clock.elapsedTime, 12);
    const v = clamp01((p4 - 0.86) / 0.13);
    const e = 1 - (1 - v) * (1 - v);
    const bob = 0.09 * Math.sin(s * 2.4) * (1 - v);
    g.position.set(lerp(-0.6, 0.2, e), lerp(1.3, 1.4, e) + bob, lerp(-0.15, -1.35, e));
    g.scale.setScalar(lerp(1, 0.45, e));
  });
  return (
    <group ref={ref}>
      <mesh position={[0, 0, -0.005]}>
        <circleGeometry args={[0.19, 24]} />
        <meshBasicMaterial color={INK} />
      </mesh>
      <mesh>
        <circleGeometry args={[0.16, 24]} />
        <meshBasicMaterial color={ORANGE} />
      </mesh>
    </group>
  );
}

// -- jaw-drop: live 3-panel composite (S0.6: max 3 live RTs, half-res) -------
// Wall floats at y=8 so no desk shot frustum ever clips it. Mounted only
// inside its t window; on low tier the keyboard panel drops to a flat quad
// (3 -> 2 live RTs; the snapshot rung is engine-side ladder work).
const WALL_Y = 8;
const WALL_Z = 2.9;
const PANEL_W = 1.4;
const PANEL_H = 2.3;
const PANEL_X = [-1.55, 0, 1.55] as const;
const RT_W = 288;
const RT_H = 448;

const backOut = (x: number) => {
  const c1 = 1.70158;
  const y = x - 1;
  return 1 + (c1 + 1) * y * y * y + c1 * y * y;
};

const FG_DOTS = [
  { x: -2.3, y: 1.1, z: 2.2, r: 0.1, color: ORANGE },
  { x: 1.9, y: -0.8, z: 2.6, r: 0.07, color: TEAL },
  { x: 2.6, y: 1.4, z: 1.8, r: 0.12, color: ORANGE },
  { x: -1.6, y: -1.3, z: 2.4, r: 0.08, color: RED },
  { x: 0.4, y: 1.7, z: 2.9, r: 0.06, color: TEAL },
];

function PanelWall({ low }: { low: boolean }) {
  const p0 = useRef<Group>(null);
  const p1 = useRef<Group>(null);
  const p2 = useRef<Group>(null);

  useFrame(() => {
    const { t } = useScrollStore.getState();
    const p = clamp01((t - PANELS_R[0]) / (PANELS_R[1] - PANELS_R[0]));
    const groups = [p0.current, p1.current, p2.current];
    for (let i = 0; i < 3; i++) {
      const g = groups[i];
      if (!g) continue;
      const si = clamp01((p - (0.04 + i * 0.07)) / 0.1);
      const pop = Math.max(backOut(si), 0.001);
      if (i < 2) {
        g.scale.set(pop, pop, 1);
      } else {
        // monitor panel grows to full bleed (content is horizontal code
        // bars, so the x-stretch reads as longer lines, not distortion)
        const gr = easeInOut(clamp01((p - 0.72) / 0.26));
        g.position.set(lerp(PANEL_X[2], 0, gr), 0, WALL_Z + 0.4 * gr);
        g.scale.set(pop * lerp(1, 5.0, gr), pop * lerp(1, 1.45, gr), 1);
      }
    }
  });

  return (
    <group position={[0, WALL_Y, 0]}>
      {/* paper backdrop: hides the desk set behind the composite */}
      <mesh position={[0, 0, WALL_Z - 0.5]}>
        <planeGeometry args={[20, 9]} />
        <meshBasicMaterial color={PAPER} />
      </mesh>
      {/* FG floating halftone dots: depth plane + foreshadow the dot exit */}
      {FG_DOTS.map((d, i) => (
        <mesh key={i} position={[d.x, d.y, WALL_Z + d.z]}>
          <circleGeometry args={[d.r, 20]} />
          <meshBasicMaterial color={d.color} />
        </mesh>
      ))}

      {/* panel 1: keyboard macro (live RT on high tier, flat on low) */}
      <group ref={p0} position={[PANEL_X[0], 0, WALL_Z]}>
        <mesh position={[0, 0, -0.012]}>
          <planeGeometry args={[PANEL_W + 0.1, PANEL_H + 0.1]} />
          <meshBasicMaterial color={INK} />
        </mesh>
        {low ? (
          <group>
            <mesh>
              <planeGeometry args={[PANEL_W, PANEL_H]} />
              <meshBasicMaterial color={PAPER} />
            </mesh>
            {Array.from({ length: 12 }, (_, i) => (
              <mesh key={i} position={[-0.42 + (i % 3) * 0.42, 0.66 - Math.floor(i / 3) * 0.44, 0.004]}>
                <planeGeometry args={[0.3, 0.3]} />
                <meshBasicMaterial color={i === 4 ? ORANGE : INK} />
              </mesh>
            ))}
          </group>
        ) : (
          <mesh>
            <planeGeometry args={[PANEL_W, PANEL_H]} />
            <meshBasicMaterial>
              <RenderTexture attach="map" width={RT_W} height={RT_H}>
                <color attach="background" args={[PAPER]} />
                <ambientLight intensity={0.9} color={PAPER} />
                <directionalLight position={[2, 4, 3]} intensity={1.4} />
                <PerspectiveCamera
                  makeDefault
                  position={[1.6, 1.1, 2.6]}
                  fov={35}
                  onUpdate={(c) => c.lookAt(KB_X, 0.12, KB_Z)}
                />
                <KeyboardUnit say={false} />
              </RenderTexture>
            </meshBasicMaterial>
          </mesh>
        )}
      </group>

      {/* panel 2: the cat, live (same pure-f(t) loaf as the main set) */}
      <group ref={p1} position={[PANEL_X[1], 0, WALL_Z]}>
        <mesh position={[0, 0, -0.012]}>
          <planeGeometry args={[PANEL_W + 0.1, PANEL_H + 0.1]} />
          <meshBasicMaterial color={INK} />
        </mesh>
        <mesh>
          <planeGeometry args={[PANEL_W, PANEL_H]} />
          <meshBasicMaterial>
            <RenderTexture attach="map" width={RT_W} height={RT_H}>
              <color attach="background" args={["#F0E3C8"]} />
              <ambientLight intensity={0.9} color={PAPER} />
              <directionalLight position={[3, 5, 4]} intensity={1.5} />
              <PerspectiveCamera
                makeDefault
                position={[-0.8, 1.2, 3.0]}
                fov={38}
                onUpdate={(c) => c.lookAt(-2.7, 0.35, 0.9)}
              />
              <DeskCat />
            </RenderTexture>
          </meshBasicMaterial>
        </mesh>
      </group>

      {/* panel 3: the monitor -- grows to full bleed at p > 0.72 */}
      <group ref={p2} position={[PANEL_X[2], 0, WALL_Z]}>
        <mesh position={[0, 0, -0.012]}>
          <planeGeometry args={[PANEL_W + 0.1, PANEL_H + 0.1]} />
          <meshBasicMaterial color={INK} />
        </mesh>
        <mesh>
          <planeGeometry args={[PANEL_W, PANEL_H]} />
          <meshBasicMaterial>
            <RenderTexture attach="map" width={RT_W} height={RT_H}>
              <color attach="background" args={["#232020"]} />
              <PerspectiveCamera
                makeDefault
                position={[0, 0, 2.1]}
                fov={52}
                onUpdate={(c) => c.lookAt(0, 0, 0)}
              />
              <ScreenContent />
            </RenderTexture>
          </meshBasicMaterial>
        </mesh>
      </group>
    </group>
  );
}

// -- the set ------------------------------------------------------------------
// Mount window: composite live only while shot 3 films (whip cutPoints at
// t=0.168 in / t=0.194 out; margins keep RT warm-up off-screen).
const PANELS_ON = PANELS_R[0] - 0.0035;
const PANELS_OFF = PANELS_R[1] + 0.002;

export default function Desk({ index }: { index: number }) {
  const ramp = toonRamp();
  const panelsOn = useScrollStore((s) => s.t > PANELS_ON && s.t < PANELS_OFF);
  const low = useScrollStore((s) => s.quality === "low");

  return (
    <group name="issue-desk" position={issueCenter(index)}>
      <ambientLight intensity={0.85} color={PAPER} />
      <directionalLight position={[5, 9, 6]} intensity={1.5} color="#FFF6E8" />

      {/* room */}
      <mesh position={[0, -2.8, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[26, 16]} />
        <meshToonMaterial color="#E7DECE" gradientMap={ramp} />
      </mesh>
      <mesh position={[0, 2, -2.6]}>
        <planeGeometry args={[26, 16]} />
        <meshToonMaterial color="#EFE4CF" gradientMap={ramp} />
      </mesh>
      {/* wall posters (BG depth plane for the landing shot) */}
      <mesh position={[-3.6, 3.1, -2.55]}>
        <planeGeometry args={[1.4, 1.9]} />
        <meshToonMaterial color={TEAL} gradientMap={ramp} />
      </mesh>
      <mesh position={[3.9, 3.4, -2.55]} rotation={[0, 0, -0.04]}>
        <planeGeometry args={[1.2, 1.6]} />
        <meshToonMaterial color={ORANGE} gradientMap={ramp} />
      </mesh>

      {/* desk */}
      <mesh position={[0, -0.18, 0]}>
        <boxGeometry args={[11, 0.35, 5.2]} />
        <meshToonMaterial color={WOOD} gradientMap={ramp} />
      </mesh>
      <mesh position={[-5.0, -1.6, 0]}>
        <boxGeometry args={[0.4, 2.6, 4.8]} />
        <meshToonMaterial color={WOOD} gradientMap={ramp} />
      </mesh>
      <mesh position={[5.0, -1.6, 0]}>
        <boxGeometry args={[0.4, 2.6, 4.8]} />
        <meshToonMaterial color={WOOD} gradientMap={ramp} />
      </mesh>

      {/* monitor + live screen */}
      <group position={[0.2, 1.35, -1.5]}>
        <mesh>
          <boxGeometry args={[3.6, 2.14, 0.14]} />
          <meshToonMaterial color={INK} gradientMap={ramp} />
        </mesh>
        <group position={[0, 0, 0.08]}>
          <ScreenContent />
        </group>
      </group>
      <mesh position={[0.2, 0.35, -1.5]}>
        <boxGeometry args={[0.35, 0.55, 0.3]} />
        <meshToonMaterial color={INK} gradientMap={ramp} />
      </mesh>
      <mesh position={[0.2, 0.03, -1.5]}>
        <boxGeometry args={[1.2, 0.06, 0.7]} />
        <meshToonMaterial color={INK} gradientMap={ramp} />
      </mesh>

      {/* props: mug FG-left, paper stack, lamp frame-right */}
      <mesh position={[-4.1, 0.34, 2.0]}>
        <cylinderGeometry args={[0.22, 0.2, 0.5, 16]} />
        <meshToonMaterial color={RED} gradientMap={ramp} />
      </mesh>
      <mesh position={[-4.3, 0.08, 0.1]} rotation={[0, 0.12, 0]}>
        <boxGeometry args={[0.9, 0.16, 1.2]} />
        <meshToonMaterial color={PAPER} gradientMap={ramp} />
      </mesh>
      <mesh position={[4.2, 0.05, -1.7]}>
        <cylinderGeometry args={[0.28, 0.32, 0.1, 16]} />
        <meshToonMaterial color={TEAL} gradientMap={ramp} />
      </mesh>
      <mesh position={[4.05, 0.8, -1.7]} rotation={[0, 0, 0.35]}>
        <boxGeometry args={[0.08, 1.5, 0.08]} />
        <meshToonMaterial color={TEAL} gradientMap={ramp} />
      </mesh>
      <mesh position={[3.7, 1.55, -1.6]} rotation={[0, 0, 1.2]}>
        <coneGeometry args={[0.28, 0.5, 16]} />
        <meshToonMaterial color={ORANGE} gradientMap={ramp} />
      </mesh>

      <KeyboardUnit say />
      <LightStrip />
      <DeskCat say />
      <DotBat />
      {panelsOn && <PanelWall low={low} />}
    </group>
  );
}
