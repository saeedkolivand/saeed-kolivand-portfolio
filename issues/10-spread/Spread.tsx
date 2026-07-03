"use client";

import { Suspense, useLayoutEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import {
  Color,
  Object3D,
  type Group,
  type InstancedMesh,
  type Material,
  type Mesh,
  type MeshBasicMaterial,
  type WebGLProgramParametersWithUniforms,
} from "three";
import IssueShell from "../_IssueShell";
import { ISSUES } from "../registry";
import CatModel, { HARLEY, type CatPalette } from "@/components/CatModel";
import { snapshots } from "@/lib/snapshots";
import { stepNoise, stepTime } from "@/lib/steppedClock";
import { useScrollStore } from "@/lib/scrollStore";
import { clamp01, easeInOut, lerp } from "@/lib/shots";
import { issueCopy } from "@/lib/content";
import { ACCENTS, RECIPES } from "@/lib/recipes";
import { getContributions } from "@/lib/contributions";
import { CAT_DRIFT, UNFOLD_POP, UNFOLD_RANGE } from "./shots";

/**
 * Issue 10 THE SPREAD (S0.3 range [0.848, 0.930], palette S0.4 row 10).
 * Near-black cosmos: instanced krackle starfields (Neon's pattern), the real
 * baked GitHub contribution grid as a literal star chart (ONE InstancedMesh,
 * level 0-4 -> size/brightness tiers, contribution green highs), ten labeled
 * abstract constellations (issueCopy.spread -- never invented strings).
 *
 * JAW-DROP OF THE WHOLE SITE: the folded stack at frame-center unfolds into
 * a double-page spread -- every previous issue (0-9) floats as a comic page
 * built from its retained live snapshot (S2.11 pool, ZERO new live RTs),
 * with static per-issue fallback art for cold deep jumps (Origin's
 * DeskFallback pattern). The unfold is PURE f(t) (scrub-safe); only the
 * budgeted flash + a 0.9s breath ride the beat engine (./shots.ts).
 *
 * Reduced motion (logged ruling): the unfold becomes a gentle cross-fade --
 * pages hold their laid-out spread poses and fade in with the same staggered
 * driver; ambient twinkle/drift freezes (st = 0). Low tier: dome 420 -> 180,
 * krackle field 140 -> 60 (InstancedMesh.count clamp), stepped fps 12 -> 8.
 *
 * S2.16: no strobe, no channel work; all lettering is single-layer troika
 * SDF; snapshot quads decode sRGB manually (framebuffer copies are raw).
 */

// ---- palette (S0.4 row 10 -- locked) ----------------------------------------
const PAPER = "#05060D";
const INK = "#EAF2FF";
const GOLD = "#FFD166";
const VIOLET = "#7C5CFF";
const GREEN = "#39D353";
const BANGERS = "/fonts/Bangers-Regular.ttf";

// Harley in the cosmos (gate check-8 fix): base HARLEY, fur pulled toward
// the row-10 gold accent so the tabby sits in-palette on the near-black sky
// (full #A9743C went muddy against #05060D); cream ruff/socks/whiskers stay
// HARLEY cream (near-ink), amber eyes as-is, tail tip takes the issue gold.
// Identity marks (teal collar, red tag) per CatModel contract.
const CAT_PALETTE: CatPalette = { ...HARLEY, ink: "#D9A44F", accent: GOLD };

const LABELS = issueCopy.spread.constellations;
const CLOSING = issueCopy.spread.closingCaption;

// ---- shared scratch (zero per-frame allocation) -----------------------------
const tmpO = new Object3D();
const tmpC = new Color();

const hash = (i: number, n: number) => {
  const x = Math.sin((i + 1) * n) * 43758.5453;
  return x - Math.floor(x);
};

const mulberry32 = (a: number) => () => {
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// ---- star dome: static far-field shell, slow stepped rotation ---------------
const DOME_N = 420;
const DOME_LOW = 180;
const DOME = Array.from({ length: DOME_N }, (_, i) => {
  const r = mulberry32(900 + i);
  const z0 = r() * 2 - 1;
  const phi = r() * Math.PI * 2;
  const rad = 60 + r() * 32;
  const xy = Math.sqrt(1 - z0 * z0);
  return {
    x: xy * Math.cos(phi) * rad,
    y: z0 * rad * 0.75,
    z: xy * Math.sin(phi) * rad,
    s: 0.08 + r() * 0.2,
    b: 0.3 + 0.7 * r() * r(),
    tint: i % 9 === 0 ? GOLD : i % 13 === 0 ? VIOLET : INK,
  };
});

function StarDome() {
  const inst = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const m = inst.current;
    if (!m) return;
    DOME.forEach((d, i) => {
      tmpO.position.set(d.x, d.y, d.z);
      tmpO.rotation.set(0, 0, 0);
      tmpO.scale.setScalar(d.s);
      tmpO.updateMatrix();
      m.setMatrixAt(i, tmpO.matrix);
      m.setColorAt(i, tmpC.set(d.tint).multiplyScalar(d.b));
    });
    m.instanceMatrix.needsUpdate = true;
    m.instanceColor!.needsUpdate = true;
  }, []);

  useFrame(({ clock }) => {
    const m = inst.current;
    if (!m) return;
    const { quality, reducedMotion } = useScrollStore.getState();
    m.count = quality === "low" ? DOME_LOW : DOME_N;
    const fps = quality === "low" ? 8 : 12;
    m.rotation.y = reducedMotion ? 0 : stepTime(clock.elapsedTime, fps) * 0.02;
  });

  return (
    <instancedMesh ref={inst} args={[undefined, undefined, DOME_N]} frustumCulled={false}>
      <octahedronGeometry args={[1, 0]} />
      <meshBasicMaterial color="#FFFFFF" />
    </instancedMesh>
  );
}

// ---- mid-field krackle: drifting energy dots (FG/MG depth plane) ------------
const KRACKLE_N = 140;
const KRACKLE_LOW = 60;
const KRACKLE_COLORS = [GOLD, VIOLET, INK];
const KRACKLE = Array.from({ length: KRACKLE_N }, (_, i) => {
  const r = mulberry32(300 + i * 7);
  return {
    x: (r() - 0.5) * 60,
    y: -6 + r() * 20,
    z: -12 + r() * 26,
    s: 0.06 + r() * 0.14,
    ci: Math.floor(r() * 3),
  };
});

function KrackleField() {
  const inst = useRef<InstancedMesh>(null);
  const lastStep = useRef(-1);

  useLayoutEffect(() => {
    const m = inst.current;
    if (!m) return;
    KRACKLE.forEach((k, i) => m.setColorAt(i, tmpC.set(KRACKLE_COLORS[k.ci]!)));
    m.instanceColor!.needsUpdate = true;
  }, []);

  useFrame(({ clock }) => {
    const m = inst.current;
    if (!m) return;
    const { quality, reducedMotion } = useScrollStore.getState();
    m.count = quality === "low" ? KRACKLE_LOW : KRACKLE_N;
    const fps = quality === "low" ? 8 : 12;
    const el = clock.elapsedTime;
    const st = reducedMotion ? 0 : stepTime(el, fps);
    if (st === lastStep.current) return;
    lastStep.current = st;
    for (let i = 0; i < KRACKLE_N; i++) {
      const k = KRACKLE[i]!;
      const n1 = reducedMotion ? 0 : stepNoise(el, fps, i);
      const n2 = reducedMotion ? 0 : stepNoise(el, fps, i + 311);
      const n3 = reducedMotion ? 0 : stepNoise(el, fps, i + 977);
      tmpO.position.set(k.x + n1 * 0.4, k.y + n2 * 0.4, k.z + n3 * 0.4);
      tmpO.rotation.set(n1 * 3, n2 * 3, 0);
      tmpO.scale.setScalar(k.s * (0.75 + 0.25 * Math.abs(n3)));
      tmpO.updateMatrix();
      m.setMatrixAt(i, tmpO.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={inst} args={[undefined, undefined, KRACKLE_N]} frustumCulled={false}>
      <octahedronGeometry args={[1, 0]} />
      <meshBasicMaterial color="#FFFFFF" />
    </instancedMesh>
  );
}

// ---- the contribution star chart: ONE InstancedMesh, baked data -------------
const CHART_POS: [number, number, number] = [-4, 11, -30];
const CHART_ROT: [number, number, number] = [-0.1, 0.12, 0];
const CHART_SPACING = 0.42;
/** level 0-4 -> size tier */
const LVL_SIZE = [0.07, 0.115, 0.16, 0.21, 0.27];
/** level 0-4 -> twinkle amplitude (highs sparkle hardest) */
const LVL_AMP = [0.1, 0.14, 0.18, 0.24, 0.3];
/** level 0-4 -> brightness tier: dim ink lows -> contribution green highs */
const LVL_COLOR = [
  new Color(INK).multiplyScalar(0.16),
  new Color(INK).multiplyScalar(0.34),
  new Color(INK).multiplyScalar(0.55).lerp(new Color(GREEN), 0.5),
  new Color(GREEN),
  new Color(GREEN).lerp(new Color("#FFFFFF"), 0.35),
];

const CHART = getContributions().weeks.flatMap((week, w) =>
  week.map((day, d) => ({
    x: (w - 26) * CHART_SPACING,
    y: (3 - d) * CHART_SPACING,
    l: Math.min(4, Math.max(0, day.l)),
  })),
);

function ContributionChart() {
  const inst = useRef<InstancedMesh>(null);
  const lastStep = useRef(-1);

  useLayoutEffect(() => {
    const m = inst.current;
    if (!m) return;
    // set EVERY instance: unset instance colors render white (three r185)
    CHART.forEach((c, i) => m.setColorAt(i, LVL_COLOR[c.l]!));
    m.instanceColor!.needsUpdate = true;
  }, []);

  useFrame(({ clock }) => {
    const m = inst.current;
    if (!m) return;
    const { quality, reducedMotion } = useScrollStore.getState();
    const fps = quality === "low" ? 8 : 12;
    const el = clock.elapsedTime;
    const st = reducedMotion ? 0 : stepTime(el, fps);
    if (st === lastStep.current) return; // matrices only change per step
    lastStep.current = st;
    for (let i = 0; i < CHART.length; i++) {
      const c = CHART[i]!;
      const tw = reducedMotion ? 0 : stepNoise(el, fps, i);
      tmpO.position.set(c.x, c.y, 0);
      tmpO.rotation.set(0, 0, 0);
      tmpO.scale.setScalar(LVL_SIZE[c.l]! * (1 + LVL_AMP[c.l]! * tw));
      tmpO.updateMatrix();
      m.setMatrixAt(i, tmpO.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <group position={CHART_POS} rotation={CHART_ROT}>
      <instancedMesh ref={inst} args={[undefined, undefined, CHART.length]} frustumCulled={false}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color="#FFFFFF" />
      </instancedMesh>
    </group>
  );
}

// ---- constellations: 10 labeled clusters (one per prior issue) --------------
interface ConstStar {
  x: number;
  y: number;
  z: number;
  s: number;
  gold: boolean;
}
const CONST_STARS: ConstStar[] = [];
const CONST_LABELS: { text: string; x: number; y: number; z: number }[] = [];
const linePos: number[] = [];

LABELS.forEach((text, i) => {
  const r = mulberry32(1000 + i * 77);
  const cx = -34 + i * 7.5;
  const cy = 2 + r() * 5.5;
  const cz = -27 - 6 * Math.sin(i * 1.7);
  const n = 4 + Math.floor(r() * 3);
  const pts: [number, number, number][] = [];
  for (let j = 0; j < n; j++) {
    const p: [number, number, number] = [
      cx + (r() - 0.5) * 5,
      cy + (r() - 0.5) * 3.4,
      cz + (r() - 0.5) * 2,
    ];
    pts.push(p);
    CONST_STARS.push({ x: p[0], y: p[1], z: p[2], s: j === 0 ? 0.24 : 0.13 + r() * 0.1, gold: j === 0 });
    if (j > 0) linePos.push(...pts[j - 1]!, ...p);
  }
  if (n >= 5) linePos.push(...pts[1]!, ...pts[3]!);
  CONST_LABELS.push({ text, x: cx, y: cy - 3.1, z: cz });
});

const LINE_POS = new Float32Array(linePos);

function Constellations() {
  const inst = useRef<InstancedMesh>(null);
  const labels = useRef<(Mesh | null)[]>([]);
  const lastStep = useRef(-1);

  useLayoutEffect(() => {
    const m = inst.current;
    if (!m) return;
    CONST_STARS.forEach((s, i) => m.setColorAt(i, tmpC.set(s.gold ? GOLD : INK)));
    m.instanceColor!.needsUpdate = true;
  }, []);

  useFrame(({ clock }) => {
    const m = inst.current;
    if (!m) return;
    const { t, quality, reducedMotion } = useScrollStore.getState();
    // labels hand the frame to the spread: fade out as the unfold begins
    // (pure f(t)) so the climax owns its lettering (S5b.4 one focal point)
    const o = 1 - clamp01((unfoldU(t) - 0.1) / 0.4);
    for (const lm of labels.current) {
      if (!lm) continue;
      lm.visible = o > 0.01;
      (lm.material as Material).opacity = o;
    }
    const fps = quality === "low" ? 8 : 12;
    const el = clock.elapsedTime;
    const st = reducedMotion ? 0 : stepTime(el, fps);
    if (st === lastStep.current) return;
    lastStep.current = st;
    for (let i = 0; i < CONST_STARS.length; i++) {
      const s = CONST_STARS[i]!;
      const tw = reducedMotion ? 0 : stepNoise(el, fps, i + 555);
      tmpO.position.set(s.x, s.y, s.z);
      tmpO.rotation.set(0, 0, 0);
      tmpO.scale.setScalar(s.s * (1 + 0.16 * tw));
      tmpO.updateMatrix();
      m.setMatrixAt(i, tmpO.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={inst} args={[undefined, undefined, CONST_STARS.length]} frustumCulled={false}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color="#FFFFFF" />
      </instancedMesh>
      {/* faint violet chart lines -- one draw call for all constellations */}
      <lineSegments frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[LINE_POS, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={VIOLET} transparent opacity={0.38} />
      </lineSegments>
      {CONST_LABELS.map((l, i) => (
        <Text
          key={l.text}
          ref={(el) => {
            labels.current[i] = el as unknown as Mesh | null;
          }}
          position={[l.x, l.y, l.z]}
          font={BANGERS}
          fontSize={1.15}
          color={INK}
          anchorX="center"
          anchorY="middle"
        >
          {l.text}
        </Text>
      ))}
    </group>
  );
}

// ---- snapshot pages: sRGB decode (framebuffer copies are not auto-decoded) --
function decodeSRGB(shader: WebGLProgramParametersWithUniforms) {
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <map_fragment>",
    [
      "#ifdef USE_MAP",
      "vec4 sampledDiffuseColor = texture2D( map, vMapUv );",
      "sampledDiffuseColor.rgb = pow( sampledDiffuseColor.rgb, vec3( 2.2 ) );",
      "diffuseColor *= sampledDiffuseColor;",
      "#endif",
    ].join("\n"),
  );
}

/** Live poll of the snapshot pool; hidden (fallback art shows) until a frame
 *  exists, e.g. after a cold deep jump. Center-crops to the page aspect. */
function SnapshotQuad({ issue, w, h }: { issue: number; w: number; h: number }) {
  const mesh = useRef<Mesh>(null);

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const tex = snapshots.get(issue);
    const mat = m.material as MeshBasicMaterial;
    if (mat.map !== tex) {
      mat.map = tex;
      if (tex) {
        const texA = tex.image.width / tex.image.height;
        const a = w / h / texA;
        if (a <= 1) {
          tex.repeat.set(a, 1);
          tex.offset.set((1 - a) / 2, 0);
        } else {
          tex.repeat.set(1, 1 / a);
          tex.offset.set(0, (1 - 1 / a) / 2);
        }
      }
      mat.needsUpdate = true;
    }
    m.visible = tex !== null;
  });

  return (
    <mesh ref={mesh} visible={false}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial onBeforeCompile={decodeSRGB} />
    </mesh>
  );
}

// ---- static fallback art per page (cold deep jumps, Origin pattern) ---------
/** Seeded primitive "page art" in the quoted issue's own palette. */
function PageFallback({ issue }: { issue: number }) {
  const rec = RECIPES[issue]!;
  const acc = ACCENTS[issue]!;
  const r = mulberry32(4242 + issue * 131);
  const bars = Array.from({ length: 4 }, (_, j) => ({
    x: (r() - 0.5) * 2.6,
    y: 2.6 - j * 1.7 + (r() - 0.5) * 0.5,
    w: 1.8 + r() * 2.4,
    h: 0.3 + r() * 0.5,
    c: acc[j % acc.length]!,
  }));
  return (
    <group>
      <mesh>
        <planeGeometry args={[5.9, 7.9]} />
        <meshBasicMaterial color={rec.paper} />
      </mesh>
      {bars.map((b, j) => (
        <mesh key={j} position={[b.x, b.y, 0.004]}>
          <planeGeometry args={[b.w, b.h]} />
          <meshBasicMaterial color={b.c} />
        </mesh>
      ))}
      <mesh position={[(r() - 0.5) * 2, -2.2 - r() * 0.8, 0.005]}>
        <circleGeometry args={[0.7 + r() * 0.5, 24]} />
        <meshBasicMaterial color={rec.ink} />
      </mesh>
      <mesh position={[0, -0.4, 0.003]}>
        <planeGeometry args={[5.1, 0.09]} />
        <meshBasicMaterial color={rec.ink} />
      </mesh>
    </group>
  );
}

// ---- the double-page spread: ten pages, pure-f(t) unfold --------------------
const PAGE_W = 6;
const PAGE_H = 8;
const WALL_Z = -18;

const PAGES = Array.from({ length: 10 }, (_, i) => {
  const col = i % 5;
  const row = Math.floor(i / 5);
  const x = (col - 2) * 7.4;
  return {
    x,
    y: row === 0 ? 4.8 : -4.6,
    z: WALL_Z - (i % 3) * 0.2,
    ry: -x * 0.006,
    rz: (hash(i, 5.7) - 0.5) * 0.05,
    // folded: stacked edge-on at center, alternating swing direction so the
    // spread opens outward from the spine
    foldRy: (x < -0.1 ? -1 : x > 0.1 ? 1 : row === 0 ? -1 : 1) * 1.62,
  };
});

function Page({ i }: { i: number }) {
  return (
    <group>
      <mesh>
        <planeGeometry args={[PAGE_W + 0.3, PAGE_H + 0.3]} />
        <meshBasicMaterial color={INK} />
      </mesh>
      <group position={[0, 0, 0.01]}>
        <PageFallback issue={i} />
      </group>
      <group position={[0, 0, 0.02]}>
        <SnapshotQuad issue={i} w={5.9} h={7.9} />
      </group>
      {/* page caption: the issue's constellation label (issueCopy.spread) */}
      <group position={[0, -3.35, 0.04]}>
        <mesh>
          <planeGeometry args={[4.6, 0.9]} />
          <meshBasicMaterial color={PAPER} />
        </mesh>
        <Text position={[0, 0, 0.01]} font={BANGERS} fontSize={0.42} color={INK} anchorX="center" anchorY="middle">
          {LABELS[i]!}
        </Text>
      </group>
    </group>
  );
}

/** Unfold driver, pure f(t) -- scrub-safe both directions. */
const unfoldU = (t: number) =>
  clamp01((t - UNFOLD_RANGE[0]) / (UNFOLD_RANGE[1] - UNFOLD_RANGE[0]));
const pageU = (U: number, i: number) => easeInOut(clamp01((U - i * 0.055) / 0.45));

function SpreadPages() {
  const root = useRef<Group>(null);
  const pages = useRef<(Group | null)[]>([]);
  const wasReduced = useRef(false);

  const setOpacity = (g: Group, o: number) => {
    g.traverse((obj) => {
      if (!(obj as Mesh).isMesh) return;
      const m = (obj as Mesh).material as Material | Material[];
      for (const mat of Array.isArray(m) ? m : [m]) {
        mat.transparent = true;
        mat.opacity = o;
      }
    });
  };

  useFrame(() => {
    const { t, reducedMotion } = useScrollStore.getState();
    const U = unfoldU(t);
    // jaw-drop breath (authored-time via lib/beats.ts, 0 when idle)
    root.current?.scale.setScalar(1 + 0.05 * UNFOLD_POP.v);

    for (let i = 0; i < PAGES.length; i++) {
      const g = pages.current[i];
      if (!g) continue;
      const d = PAGES[i]!;
      const u = pageU(U, i);
      g.visible = u > 0.001;
      if (reducedMotion) {
        // logged ruling: gentle cross-fade to the laid-out spread -- final
        // poses always, staggered opacity only
        g.position.set(d.x, d.y, d.z);
        g.rotation.set(0, d.ry, d.rz);
        g.scale.setScalar(1);
        if (g.visible) setOpacity(g, u);
        wasReduced.current = true;
      } else {
        if (wasReduced.current) setOpacity(g, 1);
        g.position.set(lerp(0, d.x, u), lerp(0.5, d.y, u), lerp(WALL_Z - i * 0.06, d.z, u));
        g.rotation.set(0, lerp(d.foldRy, d.ry, u), lerp(0, d.rz, u));
        g.scale.setScalar(0.55 + 0.45 * u);
      }
    }
    if (!useScrollStore.getState().reducedMotion) wasReduced.current = false;
  });

  return (
    <group ref={root}>
      {PAGES.map((_, i) => (
        <group
          key={i}
          ref={(el) => {
            pages.current[i] = el;
          }}
          visible={false}
        >
          <Page i={i} />
        </group>
      ))}
    </group>
  );
}

// ---- closing caption: fades in over the settled spread ----------------------
function ClosingCaption() {
  const grp = useRef<Group>(null);
  const bg = useRef<MeshBasicMaterial>(null);
  const frame = useRef<MeshBasicMaterial>(null);
  const txt = useRef<Group>(null);

  useFrame(() => {
    const { t } = useScrollStore.getState();
    const o = clamp01((unfoldU(t) - 0.8) / 0.18);
    if (grp.current) grp.current.visible = o > 0.001;
    if (bg.current) bg.current.opacity = o;
    if (frame.current) frame.current.opacity = o;
    const tm = txt.current?.children[0] as Mesh | undefined;
    if (tm) (tm.material as Material).opacity = o;
  });

  return (
    <group ref={grp} position={[0, -9.6, -14]} visible={false}>
      <mesh>
        <planeGeometry args={[15.3, 1.7]} />
        <meshBasicMaterial ref={frame} color={INK} transparent opacity={0} />
      </mesh>
      <mesh position={[0, 0, 0.01]}>
        <planeGeometry args={[15, 1.4]} />
        <meshBasicMaterial ref={bg} color={PAPER} transparent opacity={0} />
      </mesh>
      <group ref={txt}>
        <Text
          position={[0, 0, 0.02]}
          font={BANGERS}
          fontSize={0.62}
          color={INK}
          anchorX="center"
          anchorY="middle"
          maxWidth={14.4}
          textAlign="center"
        >
          {CLOSING}
        </Text>
      </group>
    </group>
  );
}

// ---- the cursor star: the dot-match exit anchor (dead-center at issue end) --
function CursorStar() {
  const grp = useRef<Group>(null);

  useFrame(({ clock }) => {
    const g = grp.current;
    if (!g) return;
    const { quality, reducedMotion } = useScrollStore.getState();
    const fps = quality === "low" ? 8 : 12;
    const st = reducedMotion ? 0 : stepTime(clock.elapsedTime, fps);
    g.scale.setScalar(1 + 0.06 * Math.sin(st * 2.4));
  });

  return (
    <group ref={grp} position={[0, 0.1, -13.5]}>
      <mesh>
        <octahedronGeometry args={[0.5, 0]} />
        <meshBasicMaterial color={GREEN} />
      </mesh>
      <mesh>
        <octahedronGeometry args={[0.24, 0]} />
        <meshBasicMaterial color={INK} />
      </mesh>
      {/* gold sparkle rays */}
      <mesh scale={[2.2, 0.1, 0.1]}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color={GOLD} />
      </mesh>
      <mesh scale={[0.1, 2.2, 0.1]}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color={GOLD} />
      </mesh>
    </group>
  );
}

// ---- the cat (S5b.1 guide): drifts weightless across the constellation arc --
function SpreadCat() {
  const grp = useRef<Group>(null);
  const head = useRef<Group>(null);
  const tail = useRef<Group>(null);

  useFrame(({ clock }) => {
    const g = grp.current;
    if (!g) return;
    const { t, quality, reducedMotion } = useScrollStore.getState();
    const fps = quality === "low" ? 8 : 12;
    const s = reducedMotion ? 0 : stepTime(clock.elapsedTime, fps);
    const p = clamp01((t - CAT_DRIFT[0]) / (CAT_DRIFT[1] - CAT_DRIFT[0]));
    // weightless drift, pure f(t); gentle stepped bob + sway on 2s
    g.position.set(
      lerp(-16, 12, p),
      4.0 + 0.5 * Math.sin(Math.PI * p) + (reducedMotion ? 0 : 0.1 * Math.sin(s * 1.3)),
      -15,
    );
    g.rotation.z = reducedMotion ? 0 : 0.08 * Math.sin(s * 0.9);
    if (tail.current) tail.current.rotation.z = 0.5 + Math.sin(s * 2.0) * 0.18;
    if (head.current) head.current.rotation.z = 0.12 + 0.1 * Math.sin(s * 0.7);
  });

  return (
    <group
      ref={grp}
      scale={1.6}
      onClick={(e) => {
        e.stopPropagation();
        useScrollStore.getState().meow();
      }}
    >
      <CatModel mode="flat" pose="walking" palette={CAT_PALETTE} rig={{ head, tail }} />
    </group>
  );
}

// ---- the set -----------------------------------------------------------------
export default function Spread({ index }: { index: number }) {
  const issue = ISSUES[index]!;

  // Quoted issues 0 + 4-9 are retained at module load in ./shots.ts (1-3 are
  // Origin's permanent retentions) -- retain-on-mount would miss every exit
  // tail filmed before this set mounts (S2.11).

  return (
    <IssueShell index={index} issue={issue}>
      {/* one faint nebula disc (BG depth plane) -- deep + dim so it never
          competes with the chart or the spread for the focal point (a gold
          twin read as a mud-brown moon over the chart -- cut, iteration 2) */}
      <mesh position={[12, 2, -70]}>
        <circleGeometry args={[11, 32]} />
        <meshBasicMaterial color={VIOLET} transparent opacity={0.06} depthWrite={false} />
      </mesh>

      <StarDome />
      <KrackleField />
      <ContributionChart />

      <Suspense fallback={null}>
        <Constellations />
        <SpreadPages />
        <ClosingCaption />
      </Suspense>

      <CursorStar />
      <SpreadCat />
    </IssueShell>
  );
}
