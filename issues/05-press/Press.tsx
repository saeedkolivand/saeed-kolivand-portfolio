"use client";

import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import {
  Color,
  Object3D,
  type Group,
  type InstancedMesh,
  type Mesh,
  type ShaderMaterial,
} from "three";
import IssueShell from "../_IssueShell";
import { ISSUES } from "../registry";
import CatModel, { type CatPalette } from "@/components/CatModel";
import { toonRamp } from "@/lib/toon";
import { stepTime } from "@/lib/steppedClock";
import { useScrollStore } from "@/lib/scrollStore";
import { clamp01, lerp } from "@/lib/shots";
import { issueCopy } from "@/lib/content";
import {
  PRESS_PALETTE,
  pressAiMaterial,
  pressReactMaterial,
  pressRustMaterial,
  pressTypescriptMaterial,
} from "@/shaders/pressMaterials";
import {
  PRESS_BAY_X,
  PRESS_BELT_TOP,
  PRESS_CTA_IN,
  PRESS_ENERGY_RANGE,
  PRESS_PART_T,
  PRESS_PULSE_RANGE,
  PRESS_SPARK,
  PRESS_STAMP_POP,
  PRESS_STAMP_T,
  PRESS_STAMP_X,
  PRESS_TRACE_RANGE,
  pressButtonX,
} from "./shots";

/**
 * Issue 5 THE PRESS (S0.3 range [0.388, 0.478], palette S0.4 row 5).
 * A dark factory: one conveyor, four department bays in four micro-styles
 * (the prebuilt ShaderMaterials in shaders/pressMaterials.ts), and the
 * S5b.5 through-line -- ONE UI button manufactured end to end. Department
 * labels + captions come from issueCopy.press (never invented strings).
 *
 * JAW-DROP: the final stamp (registerJawDrop in ./shots.ts -- impact frame
 * + radial burst); the button then drops out of the scene as the real DOM
 * "See projects" CTA (components/PressCta.tsx, post-exempt layer).
 *
 * Scroll state is pure f(t); idle machinery runs on stepped 2s (frozen
 * under reduced motion); authored-time envelopes arrive via the beat
 * channels exported from ./shots.ts. The four ShaderMaterials are created
 * here and disposed explicitly on unmount.
 */

// ---- palette (S0.4 row 5 -- locked; +/-10% lightness for steps) -------------
const PAPER = PRESS_PALETTE.paper; // #23272E
const INK = PRESS_PALETTE.ink; // #E8E4DC
const STEEL = "#2B303A"; // paper +8%
const DARK = "#1B1F25"; // paper -8%
const FLOOR = "#20242B"; // paper -4%
const INK_HI = "#F2EFE7"; // ink +4% (button cap face)
const BANGERS = "/fonts/Bangers-Regular.ttf";

const DEPTS = issueCopy.press.departments;
const CTA = issueCopy.press.cta;
const ACCENT = [
  PRESS_PALETTE.react,
  PRESS_PALETTE.ts,
  PRESS_PALETTE.rust,
  PRESS_PALETTE.ai,
] as const;

// mascot identity marks (CatModel contract): teal collar, red tag
const CAT_PALETTE: CatPalette = {
  ink: DARK,
  paper: INK,
  collar: "#2BB3A3",
  tag: "#E2574C",
  accent: PRESS_PALETTE.rust,
};

// ---- shared scratch (zero per-frame allocation) -----------------------------
const tmpO = new Object3D();
const tmpC = new Color();

const hash = (i: number, n: number) => {
  const x = Math.sin((i + 1) * n) * 43758.5453;
  return x - Math.floor(x);
};

const ramp01 = (t: number, r: [number, number]) => clamp01((t - r[0]) / (r[1] - r[0]));

interface DeptMats {
  react: ShaderMaterial;
  ts: ShaderMaterial;
  rust: ShaderMaterial;
  ai: ShaderMaterial;
}

// ---- lettering (single-layer troika SDF, S2.16) -----------------------------
function Plaque({ x, y, z, text }: { x: number; y: number; z: number; text: string }) {
  return (
    <group position={[x, y, z]}>
      <mesh>
        <planeGeometry args={[4.6, 1.15]} />
        <meshBasicMaterial color={DARK} />
      </mesh>
      <mesh position={[0, 0, 0.01]}>
        <planeGeometry args={[4.44, 1.0]} />
        <meshBasicMaterial color={INK} />
      </mesh>
      <Text
        position={[0, 0, 0.02]}
        font={BANGERS}
        fontSize={0.26}
        color={PAPER}
        anchorX="center"
        anchorY="middle"
        maxWidth={4.2}
        textAlign="center"
        lineHeight={1.1}
      >
        {text}
      </Text>
    </group>
  );
}

// ---- static instanced set dressing: FG hooks + BG pipes + wall trims --------
// hooks hang at bay BOUNDARIES so they never cross a dept label (S5b.4)
const HOOKS = [-26, -13, 0, 13, 26, 31.5].map((x, i) => ({
  x,
  y: 5.0 + hash(i, 5.77) * 1.4,
}));
const PIPES = [6.4, 7.5, 8.4];

function Dressing() {
  const hooks = useRef<InstancedMesh>(null);
  const pipes = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const h = hooks.current;
    if (h) {
      HOOKS.forEach((k, i) => {
        tmpO.position.set(k.x, k.y, 4.8);
        tmpO.rotation.set(0, 0, 0);
        tmpO.scale.set(1, 1, 1);
        tmpO.updateMatrix();
        h.setMatrixAt(i, tmpO.matrix);
        h.setColorAt(i, tmpC.set(DARK));
      });
      h.instanceMatrix.needsUpdate = true;
      h.instanceColor!.needsUpdate = true;
    }
    const p = pipes.current;
    if (p) {
      PIPES.forEach((y, i) => {
        tmpO.position.set(3, y, -9.5 - i * 0.8);
        tmpO.rotation.set(0, 0, 0);
        tmpO.scale.set(1, 1, 1);
        tmpO.updateMatrix();
        p.setMatrixAt(i, tmpO.matrix);
        p.setColorAt(i, tmpC.set(i % 2 ? STEEL : DARK));
      });
      p.instanceMatrix.needsUpdate = true;
      p.instanceColor!.needsUpdate = true;
    }
  }, []);

  return (
    <group>
      <instancedMesh ref={hooks} args={[undefined, undefined, HOOKS.length]} frustumCulled={false}>
        <boxGeometry args={[0.16, 2.4, 0.16]} />
        <meshBasicMaterial color="#FFFFFF" />
      </instancedMesh>
      <instancedMesh ref={pipes} args={[undefined, undefined, PIPES.length]} frustumCulled={false}>
        <boxGeometry args={[62, 0.4, 0.4]} />
        <meshBasicMaterial color="#FFFFFF" />
      </instancedMesh>
    </group>
  );
}

// ---- conveyor: bed + rollers spinning on 2s ---------------------------------
const ROLLERS = Array.from({ length: 26 }, (_, i) => -24 + i * 2);

function Conveyor() {
  const inst = useRef<InstancedMesh>(null);
  const grad = toonRamp();

  useLayoutEffect(() => {
    const m = inst.current;
    if (!m) return;
    ROLLERS.forEach((_, i) => m.setColorAt(i, tmpC.set(i % 2 ? STEEL : DARK)));
    m.instanceColor!.needsUpdate = true;
  }, []);

  useFrame(({ clock }) => {
    const m = inst.current;
    if (!m) return;
    const { quality, reducedMotion } = useScrollStore.getState();
    const fps = quality === "low" ? 8 : 12;
    const st = reducedMotion ? 0 : stepTime(clock.elapsedTime, fps);
    for (let i = 0; i < ROLLERS.length; i++) {
      tmpO.position.set(ROLLERS[i]!, 0.34, 0);
      tmpO.rotation.set(st * 2.4 + i * 0.7, 0, 0);
      tmpO.scale.set(1, 1, 1);
      tmpO.updateMatrix();
      m.setMatrixAt(i, tmpO.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {/* plinth + bed + belt surface */}
      <mesh position={[1, 0.15, 0]}>
        <boxGeometry args={[58, 0.3, 2.0]} />
        <meshToonMaterial color={DARK} gradientMap={grad} />
      </mesh>
      <mesh position={[1, 0.62, 0]}>
        <boxGeometry args={[58, 0.35, 3.0]} />
        <meshToonMaterial color={STEEL} gradientMap={grad} />
      </mesh>
      <mesh position={[1, 0.845, 0]}>
        <boxGeometry args={[58, 0.12, 2.6]} />
        <meshBasicMaterial color={FLOOR} />
      </mesh>
      <instancedMesh ref={inst} args={[undefined, undefined, ROLLERS.length]} frustumCulled={false}>
        <boxGeometry args={[0.28, 0.28, 3.4]} />
        <meshToonMaterial color="#FFFFFF" gradientMap={grad} />
      </instancedMesh>
    </group>
  );
}

// ---- dept 1: REACT -- cel-blue energy arch + orbiting cells ------------------
const CELLS = Array.from({ length: 8 }, (_, i) => ({
  phase: (i / 8) * Math.PI * 2,
  r: 3.0 + hash(i, 3.31) * 0.5,
  s: 0.34 + hash(i, 8.17) * 0.16,
}));

function ReactRig({ mat }: { mat: ShaderMaterial }) {
  const inst = useRef<InstancedMesh>(null);
  const bx = PRESS_BAY_X[0];

  useFrame(({ clock }) => {
    const m = inst.current;
    if (!m) return;
    const { quality, reducedMotion } = useScrollStore.getState();
    const fps = quality === "low" ? 8 : 12;
    const st = reducedMotion ? 0 : stepTime(clock.elapsedTime, fps);
    for (let i = 0; i < CELLS.length; i++) {
      const c = CELLS[i]!;
      const a = c.phase + st * 0.4;
      tmpO.position.set(bx + Math.cos(a) * c.r, 2.6 + Math.sin(a * 1.3) * 1.1, Math.sin(a) * 1.6);
      tmpO.rotation.set(st + i, st * 0.8 + i * 2, 0);
      tmpO.scale.setScalar(c.s);
      tmpO.updateMatrix();
      m.setMatrixAt(i, tmpO.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {/* arch straddling the belt */}
      <mesh position={[bx - 1.9, 1.8, 0]} material={mat}>
        <boxGeometry args={[1.2, 3.6, 1.6]} />
      </mesh>
      <mesh position={[bx + 1.9, 1.8, 0]} material={mat}>
        <boxGeometry args={[1.2, 3.6, 1.6]} />
      </mesh>
      <mesh position={[bx, 3.9, 0]} material={mat}>
        <boxGeometry args={[5.0, 1.2, 1.8]} />
      </mesh>
      <instancedMesh
        ref={inst}
        args={[undefined, undefined, CELLS.length]}
        material={mat}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
    </group>
  );
}

// ---- dept 2: TYPESCRIPT -- blueprint pylons + scanner beam -------------------
function TsRig({ mat }: { mat: ShaderMaterial }) {
  const bx = PRESS_BAY_X[1];
  return (
    <group>
      <mesh position={[bx - 3, 2.1, 0]} material={mat}>
        <boxGeometry args={[1.0, 4.2, 1.0]} />
      </mesh>
      <mesh position={[bx + 3, 2.1, 0]} material={mat}>
        <boxGeometry args={[1.0, 4.2, 1.0]} />
      </mesh>
      <mesh position={[bx, 3.6, 0]} material={mat}>
        <boxGeometry args={[7.4, 0.55, 0.55]} />
      </mesh>
    </group>
  );
}

// ---- dept 3: RUST -- heavy press, piston pounding on 2s ----------------------
function RustRig({ mat }: { mat: ShaderMaterial }) {
  const piston = useRef<Group>(null);
  const bx = PRESS_BAY_X[2];

  useFrame(({ clock }) => {
    const g = piston.current;
    if (!g) return;
    const { quality, reducedMotion } = useScrollStore.getState();
    const fps = quality === "low" ? 8 : 12;
    const st = reducedMotion ? 0 : stepTime(clock.elapsedTime, fps);
    g.position.y = 3.5 - 1.5 * Math.abs(Math.sin(st * 1.5 + 1));
  });

  return (
    <group>
      <mesh position={[bx - 2.4, 1.9, 0]} material={mat}>
        <boxGeometry args={[1.4, 3.8, 3.2]} />
      </mesh>
      <mesh position={[bx + 2.4, 1.9, 0]} material={mat}>
        <boxGeometry args={[1.4, 3.8, 3.2]} />
      </mesh>
      <mesh position={[bx, 4.2, 0]} material={mat}>
        <boxGeometry args={[6.2, 1.4, 2.8]} />
      </mesh>
      <group ref={piston}>
        <mesh position={[bx, 0.9, 0]} material={mat}>
          <boxGeometry args={[1.1, 1.8, 1.1]} />
        </mesh>
        <mesh position={[bx, -0.35, 0]} material={mat}>
          <boxGeometry args={[2.4, 0.9, 2.6]} />
        </mesh>
      </group>
      {/* dept identity accents (basic color, S0.4 rust): furnace glow plate
          behind the piston + hazard strips on the flanks -- the heavy-ink
          material stays untouched, orange carries the department read */}
      <mesh position={[bx, 1.9, -1.9]}>
        <boxGeometry args={[4.2, 2.4, 0.25]} />
        <meshBasicMaterial color={ACCENT[2]} />
      </mesh>
      <mesh position={[bx - 2.4, 1.0, 1.62]}>
        <boxGeometry args={[1.0, 0.22, 0.05]} />
        <meshBasicMaterial color={ACCENT[2]} />
      </mesh>
      <mesh position={[bx + 2.4, 1.0, 1.62]}>
        <boxGeometry args={[1.0, 0.22, 0.05]} />
        <meshBasicMaterial color={ACCENT[2]} />
      </mesh>
    </group>
  );
}

// ---- dept 4: AI -- drifting krackle node cells -------------------------------
const NODES = Array.from({ length: 16 }, (_, i) => ({
  x: (hash(i, 12.9898) - 0.5) * 8,
  y: 2.2 + hash(i, 78.233) * 3.4,
  z: -4.5 + hash(i, 37.719) * 5.5,
  s: 0.4 + hash(i, 9.151) * 0.35,
}));

function AiRig({ mat }: { mat: ShaderMaterial }) {
  const inst = useRef<InstancedMesh>(null);
  const bx = PRESS_BAY_X[3];

  useFrame(({ clock }) => {
    const m = inst.current;
    if (!m) return;
    const { quality, reducedMotion } = useScrollStore.getState();
    const fps = quality === "low" ? 8 : 12;
    const st = reducedMotion ? 0 : stepTime(clock.elapsedTime, fps);
    for (let i = 0; i < NODES.length; i++) {
      const n = NODES[i]!;
      tmpO.position.set(
        bx + n.x + 0.3 * Math.sin(st * 0.5 + i * 2.1),
        n.y + 0.25 * Math.cos(st * 0.4 + i * 1.3),
        n.z,
      );
      tmpO.rotation.set(st * 0.3 + i, st * 0.45 + i * 2, 0);
      tmpO.scale.setScalar(n.s);
      tmpO.updateMatrix();
      m.setMatrixAt(i, tmpO.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={inst}
      args={[undefined, undefined, NODES.length]}
      material={mat}
      frustumCulled={false}
    >
      <boxGeometry args={[1, 1, 1]} />
    </instancedMesh>
  );
}

// ---- stamp station: head is pure f(t), squash + burst ride the beat ---------
const BURST_N = 12;

function StampStation() {
  const head = useRef<Group>(null);
  const burst = useRef<InstancedMesh>(null);
  const grad = toonRamp();
  const sx = PRESS_STAMP_X;

  useFrame(() => {
    const { t } = useScrollStore.getState();
    const g = head.current;
    if (g) {
      // slam travel: pure f(t) (scrub-safe) -- down at PRESS_STAMP_T, then
      // back UP as the CTA takes over so the head never buries the moment;
      // pop squash is authored-time
      const down =
        clamp01((t - (PRESS_STAMP_T - 0.0025)) / 0.0025) -
        clamp01((t - PRESS_CTA_IN[0] - 0.001) / 0.003);
      const v = PRESS_STAMP_POP.v;
      g.position.y = lerp(4.6, 1.78, down);
      g.scale.set(1 + 0.18 * v, 1 - 0.3 * v, 1 + 0.18 * v);
    }
    const b = burst.current;
    if (b) {
      const v = PRESS_STAMP_POP.v;
      b.visible = v > 0.02;
      if (b.visible) {
        for (let i = 0; i < BURST_N; i++) {
          const a = (i / BURST_N) * Math.PI * 2;
          const r = 1.5 + v * 2.4;
          tmpO.position.set(sx + Math.cos(a) * r, 1.9 + Math.sin(a) * r * 0.8, 2.2);
          tmpO.rotation.set(0, 0, a);
          tmpO.scale.set(0.4 + v, 0.5 + 0.5 * v, 1);
          tmpO.updateMatrix();
          b.setMatrixAt(i, tmpO.matrix);
        }
        b.instanceMatrix.needsUpdate = true;
      }
    }
  });

  return (
    <group>
      <mesh position={[sx - 2.1, 2.6, 0]}>
        <boxGeometry args={[1.0, 5.2, 1.2]} />
        <meshToonMaterial color={STEEL} gradientMap={grad} />
      </mesh>
      <mesh position={[sx + 2.1, 2.6, 0]}>
        <boxGeometry args={[1.0, 5.2, 1.2]} />
        <meshToonMaterial color={STEEL} gradientMap={grad} />
      </mesh>
      <mesh position={[sx, 5.4, 0]}>
        <boxGeometry args={[5.2, 1.4, 1.6]} />
        <meshToonMaterial color={DARK} gradientMap={grad} />
      </mesh>
      {/* the stamp head: shaft + block + ink face plate */}
      <group ref={head}>
        <mesh position={[sx, 1.6, 0]}>
          <boxGeometry args={[1.4, 3.0, 1.4]} />
          <meshToonMaterial color={STEEL} gradientMap={grad} />
        </mesh>
        <mesh position={[sx, 0, 0]}>
          <boxGeometry args={[3.0, 1.2, 3.0]} />
          <meshToonMaterial color={DARK} gradientMap={grad} />
        </mesh>
        <mesh position={[sx, -0.62, 0]}>
          <boxGeometry args={[2.6, 0.16, 2.6]} />
          <meshBasicMaterial color={INK} />
        </mesh>
      </group>
      {/* radial burst lines -- authored-time only, hidden when idle */}
      <instancedMesh
        ref={burst}
        args={[undefined, undefined, BURST_N]}
        visible={false}
        frustumCulled={false}
      >
        <planeGeometry args={[2.0, 0.14]} />
        <meshBasicMaterial color={INK} />
      </instancedMesh>
    </group>
  );
}

// ---- the through-line: ONE UI button, parts added per department ------------
function PressButton() {
  const grp = useRef<Group>(null);
  const parts = useRef<(Group | null)[]>([]);
  const label = useRef<Group>(null);

  useFrame(() => {
    const g = grp.current;
    if (!g) return;
    const { t } = useScrollStore.getState();
    g.position.set(pressButtonX(t), PRESS_BELT_TOP + 0.28, 0);
    // once stamped + dropped, the DOM CTA takes over (PressCta.tsx)
    g.visible = t < PRESS_CTA_IN[0];
    for (let i = 0; i < PRESS_PART_T.length; i++) {
      const p = parts.current[i];
      if (p) p.visible = t >= PRESS_PART_T[i]!;
    }
    if (label.current) label.current.visible = t >= PRESS_STAMP_T;
  });

  return (
    <group ref={grp}>
      {/* the slab + cap */}
      <mesh>
        <boxGeometry args={[1.7, 0.36, 1.1]} />
        <meshBasicMaterial color={INK} />
      </mesh>
      <mesh position={[0, 0.22, 0]}>
        <boxGeometry args={[1.5, 0.2, 0.9]} />
        <meshBasicMaterial color={INK_HI} />
      </mesh>
      {/* part 1 (REACT): energy under-glow */}
      <group
        ref={(el) => {
          parts.current[0] = el;
        }}
        visible={false}
      >
        <mesh position={[0, -0.24, 0]}>
          <boxGeometry args={[1.8, 0.1, 1.2]} />
          <meshBasicMaterial color={ACCENT[0]} />
        </mesh>
      </group>
      {/* part 2 (TS): blueprint plate */}
      <group
        ref={(el) => {
          parts.current[1] = el;
        }}
        visible={false}
      >
        <mesh position={[0, 0.33, 0]}>
          <boxGeometry args={[1.24, 0.05, 0.68]} />
          <meshBasicMaterial color={ACCENT[1]} />
        </mesh>
      </group>
      {/* part 3 (RUST): heavy ink border */}
      <group
        ref={(el) => {
          parts.current[2] = el;
        }}
        visible={false}
      >
        <mesh position={[0, 0.33, 0.4]}>
          <boxGeometry args={[1.5, 0.06, 0.1]} />
          <meshBasicMaterial color={DARK} />
        </mesh>
        <mesh position={[0, 0.33, -0.4]}>
          <boxGeometry args={[1.5, 0.06, 0.1]} />
          <meshBasicMaterial color={DARK} />
        </mesh>
        <mesh position={[0.7, 0.33, 0]}>
          <boxGeometry args={[0.1, 0.06, 0.9]} />
          <meshBasicMaterial color={DARK} />
        </mesh>
        <mesh position={[-0.7, 0.33, 0]}>
          <boxGeometry args={[0.1, 0.06, 0.9]} />
          <meshBasicMaterial color={DARK} />
        </mesh>
      </group>
      {/* part 4 (AI): core light */}
      <group
        ref={(el) => {
          parts.current[3] = el;
        }}
        visible={false}
      >
        <mesh position={[0.5, 0.38, 0]}>
          <boxGeometry args={[0.26, 0.14, 0.26]} />
          <meshBasicMaterial color={ACCENT[3]} />
        </mesh>
      </group>
      {/* the stamped face -- appears at the slam, pure f(t) */}
      <group ref={label} visible={false}>
        <Text
          position={[0, 0.37, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          font={BANGERS}
          fontSize={0.3}
          color={PAPER}
          anchorX="center"
          anchorY="middle"
        >
          {CTA}
        </Text>
      </group>
    </group>
  );
}

// ---- the cat (S5b.1 cameo): forecat, supervising from a crate ---------------
function PressCat() {
  const tail = useRef<Group>(null);

  useFrame(({ clock }) => {
    const { quality, reducedMotion } = useScrollStore.getState();
    const fps = quality === "low" ? 8 : 12;
    const s = reducedMotion ? 0 : stepTime(clock.elapsedTime, fps);
    if (tail.current) tail.current.rotation.z = 0.4 + Math.sin(s * 1.8) * 0.16;
  });

  return (
    <group>
      <mesh position={[30.8, 0.75, -1.8]}>
        <boxGeometry args={[1.5, 1.5, 1.5]} />
        <meshToonMaterial color={STEEL} gradientMap={toonRamp()} />
      </mesh>
      <group
        position={[30.8, 2.05, -1.4]}
        scale={0.8}
        onClick={(e) => {
          e.stopPropagation();
          useScrollStore.getState().meow();
        }}
      >
        <CatModel mode="flat" pose="sitting" palette={CAT_PALETTE} rig={{ tail }} />
      </group>
    </group>
  );
}

// ---- uniform driver: one place feeds all four materials ----------------------
function MaterialDriver({ mats }: { mats: DeptMats }) {
  useFrame(({ clock }) => {
    const { t, quality, reducedMotion } = useScrollStore.getState();
    const fps = quality === "low" ? 8 : 12;
    const st = reducedMotion ? 0 : stepTime(clock.elapsedTime, fps);
    // stepped time per the pressMaterials contract; scroll ramps pure f(t)
    mats.react.uniforms.uTime!.value = st;
    mats.react.uniforms.uEnergy!.value = 0.35 + 0.65 * ramp01(t, PRESS_ENERGY_RANGE);
    mats.ts.uniforms.uTrace!.value = ramp01(t, PRESS_TRACE_RANGE); // monotonic
    mats.rust.uniforms.uTime!.value = st;
    mats.rust.uniforms.uSpark!.value = PRESS_SPARK.v; // beat envelope (budgeted)
    mats.ai.uniforms.uTime!.value = st;
    mats.ai.uniforms.uPulse!.value = 0.25 + 0.75 * ramp01(t, PRESS_PULSE_RANGE);
  });
  return null;
}

// ---- the set -----------------------------------------------------------------
export default function Press({ index }: { index: number }) {
  const issue = ISSUES[index]!;
  const grad = toonRamp();

  const mats = useMemo<DeptMats>(
    () => ({
      react: pressReactMaterial(),
      ts: pressTypescriptMaterial(),
      rust: pressRustMaterial(),
      ai: pressAiMaterial(),
    }),
    [],
  );

  // explicit dispose contract for the four dept ShaderMaterials
  useEffect(
    () => () => {
      mats.react.dispose();
      mats.ts.dispose();
      mats.rust.dispose();
      mats.ai.dispose();
    },
    [mats],
  );

  return (
    <IssueShell index={index} issue={issue}>
      <MaterialDriver mats={mats} />

      {/* floor */}
      <mesh position={[3, -0.2, -2]}>
        <boxGeometry args={[68, 0.4, 26]} />
        <meshToonMaterial color={FLOOR} gradientMap={grad} />
      </mesh>

      {/* dept walls: TS + AI carry their materials; REACT/RUST get trims */}
      {PRESS_BAY_X.map((bx, i) => {
        const wallMat = i === 1 ? mats.ts : i === 3 ? mats.ai : undefined;
        return (
          <group key={i}>
            {wallMat ? (
              <mesh position={[bx, 4.0, -7]} material={wallMat}>
                <boxGeometry args={[11.5, 8.5, 0.6]} />
              </mesh>
            ) : (
              <>
                <mesh position={[bx, 4.0, -7]}>
                  <boxGeometry args={[11.5, 8.5, 0.6]} />
                  <meshToonMaterial color={STEEL} gradientMap={grad} />
                </mesh>
                <mesh position={[bx - 5.2, 4.0, -6.65]}>
                  <boxGeometry args={[0.35, 8.5, 0.1]} />
                  <meshBasicMaterial color={ACCENT[i]!} />
                </mesh>
                <mesh position={[bx + 5.2, 4.0, -6.65]}>
                  <boxGeometry args={[0.35, 8.5, 0.1]} />
                  <meshBasicMaterial color={ACCENT[i]!} />
                </mesh>
              </>
            )}
          </group>
        );
      })}

      <Conveyor />
      <ReactRig mat={mats.react} />
      <TsRig mat={mats.ts} />
      <RustRig mat={mats.rust} />
      <AiRig mat={mats.ai} />
      <StampStation />
      <PressButton />
      <Dressing />

      <Suspense fallback={null}>
        {/* dept labels + captions (issueCopy.press -- locked strings) */}
        {PRESS_BAY_X.map((bx, i) => (
          <group key={DEPTS[i]!.label}>
            <Text
              position={[bx, 6.3, -6.6]}
              font={BANGERS}
              fontSize={1.05}
              color={ACCENT[i]!}
              anchorX="center"
              anchorY="middle"
            >
              {DEPTS[i]!.label}
            </Text>
            {/* AI's plaque sits frame-LEFT of its bay so it never drifts,
                clipped, into the stamp-finale frame (S5b.4 focal check) */}
            <Plaque x={bx + (i === 3 ? -1.7 : 1.7)} y={2.7} z={1.7} text={DEPTS[i]!.caption} />
          </group>
        ))}
        <PressCat />
      </Suspense>
    </IssueShell>
  );
}
