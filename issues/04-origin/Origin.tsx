"use client";

import { Suspense, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import {
  BackSide,
  Color,
  Object3D,
  SRGBColorSpace,
  TextureLoader,
  type Group,
  type InstancedMesh,
  type Mesh,
  type MeshBasicMaterial,
  type WebGLProgramParametersWithUniforms,
} from "three";
import IssueShell from "../_IssueShell";
import { ISSUES } from "../registry";
import CatModel, { type CatPalette } from "@/components/CatModel";
import { snapshots } from "@/lib/snapshots";
import { stepTime } from "@/lib/steppedClock";
import { useScrollStore } from "@/lib/scrollStore";
import { clamp01, lerp } from "@/lib/shots";
import { content, issueCopy } from "@/lib/content";
import { ORIGIN_CAT_HOP, ORIGIN_CAT_WALK, PORTAL_POP } from "./shots";

/**
 * Issue 4 ORIGIN PAGE (S0.3 range [0.315, 0.378], palette S0.4 row 4).
 * A single comic page floating in a paper void: lead caption + 7 story-beat
 * panels (issueCopy.origin -- never invented strings). Three panels quote
 * earlier issues via retained SNAPSHOTS (S2.11 -- zero new live RTs, the
 * S2.10 budget is untouched); the rest are static primitive panel art.
 * Tech icons orbit the page with squash-and-stretch on 2s (S2.8).
 *
 * JAW-DROP (gentle BY DESIGN, intensity 1): the camera glides THROUGH the
 * last panel's surface -- the panel is a recessed shadow-box portal cut into
 * the page, and the glide (pure f(t), shot 4) IS the transition out; the
 * exit gutter's panel-wipe (Phase 2 panel-portal fallback ruling) finishes
 * the cut. registerJawDrop lives in ./shots.ts (no flash -- quiet valley).
 *
 * S2.16: no flashes, no oscillating emissives; lettering is single-layer
 * troika SDF; snapshot panels decode sRGB manually (project memory: custom
 * sampling of canvas copies is NOT auto-decoded).
 */

// ---- palette (S0.4 row 4 -- locked; +/-10% lightness for steps) -------------
const PAPER = "#EDE7DB";
const INK = "#2A2722";
const BLUE = "#7C93B2";
const RUST = "#C97B5A";
const PAPER_DIM = "#E2DACC"; // panel interiors (paper -5%)
const PAGE_SHADOW = "#DAD2C2"; // page drop shadow / void tones
const DARK = "#211E1A"; // in-panel night plates (ink -5%)
const VOID = "#1B1815"; // portal interior (ink -10%)
const BANGERS = "/fonts/Bangers-Regular.ttf";

// mascot identity marks (CatModel contract): teal collar, red tag
const CAT_PALETTE: CatPalette = { ink: INK, paper: PAPER, collar: "#2BB3A3", tag: "#E2574C", accent: RUST };

// ---- page layout (page local coords, page 12 x 16 centered at the set) -----
const LEAD = issueCopy.origin.lead;
const BEATS = issueCopy.origin.beats;

// portal panel (beat 7): outer frame + opening cut clean through the page
const PX = 3.275;
const PY = -3.15;
const OPEN_W = 4.15;
const OPEN_H = 4.1;
const PORTAL_DEPTH = 6.5;

/** paper quads composed AROUND the portal hole (page = 12 x 16, hole x 1.2..5.35, y -5.2..-1.1) */
const PAGE_QUADS: [number, number, number, number][] = [
  [-2.4, 0, 7.2, 16],
  [5.675, 0, 0.65, 16],
  [3.275, 3.45, 4.15, 9.1],
  [3.275, -6.6, 4.15, 2.8],
];

/** drop-shadow quads (page rect offset +0.45,-0.5) with a hole = the box rect */
const SHADOW_QUADS: [number, number, number, number][] = [
  [-2.175, -0.5, 6.75, 16],
  [5.9, -0.5, 1.1, 16],
  [3.275, 3.2, 4.15, 8.6],
  [3.275, -6.85, 4.15, 3.3],
];

interface PanelDef {
  x: number;
  y: number;
  w: number;
  h: number;
  cap: string;
  capSize: number;
  /** quote an earlier issue's retained snapshot (S2.11) */
  snap?: number;
}

const PANELS: PanelDef[] = [
  { x: -2.888, y: 4.95, w: 5.4, h: 3.3, cap: BEATS[0]!, capSize: 0.24 },
  { x: 2.888, y: 4.95, w: 5.4, h: 3.3, cap: BEATS[1]!, capSize: 0.24 },
  { x: -3.85, y: 1.15, w: 3.5, h: 3.6, cap: BEATS[2]!, capSize: 0.2, snap: 2 },
  { x: 0, y: 1.15, w: 3.5, h: 3.6, cap: BEATS[3]!, capSize: 0.2 },
  { x: 3.85, y: 1.15, w: 3.5, h: 3.6, cap: BEATS[4]!, capSize: 0.2, snap: 3 },
  { x: -2.5, y: -3.15, w: 6.2, h: 4.6, cap: BEATS[5]!, capSize: 0.26, snap: 1 },
];

// ---- shared scratch (zero per-frame allocation) -----------------------------
const tmpO = new Object3D();
const tmpC = new Color();
const tmpC2 = new Color();

const hash = (i: number, n: number) => {
  const x = Math.sin((i + 1) * n) * 43758.5453;
  return x - Math.floor(x);
};

// ---- snapshot panels: sRGB decode (canvas copies are not auto-decoded) ------
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

/**
 * Live poll of the snapshot pool (retained keys refresh in their issue's
 * exit tail). Center-crops the screen-aspect frame to the panel aspect via
 * texture repeat/offset; hidden (fallback art shows) until a frame exists,
 * e.g. after a deep jump straight to this issue.
 */
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

// ---- lettering (single-layer troika SDF, S2.16) -----------------------------
function Caption({
  x,
  y,
  w,
  text,
  size = 0.22,
  z = 0.06,
  h = 0.78,
}: {
  x: number;
  y: number;
  w: number;
  text: string;
  size?: number;
  z?: number;
  h?: number;
}) {
  return (
    <group position={[x, y, z]}>
      <mesh>
        <planeGeometry args={[w + 0.08, h + 0.08]} />
        <meshBasicMaterial color={INK} />
      </mesh>
      <mesh position={[0, 0, 0.01]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial color={PAPER} />
      </mesh>
      <Text
        position={[0, 0, 0.02]}
        font={BANGERS}
        fontSize={size}
        color={INK}
        anchorX="center"
        anchorY="middle"
        maxWidth={w - 0.25}
        textAlign="center"
        lineHeight={1.1}
      >
        {text}
      </Text>
    </group>
  );
}

function PanelFrame({ p, children }: { p: PanelDef; children?: ReactNode }) {
  return (
    <group position={[p.x, p.y, 0]}>
      <mesh position={[0, 0, 0.02]}>
        <planeGeometry args={[p.w + 0.16, p.h + 0.16]} />
        <meshBasicMaterial color={INK} />
      </mesh>
      <mesh position={[0, 0, 0.03]}>
        <planeGeometry args={[p.w, p.h]} />
        <meshBasicMaterial color={PAPER_DIM} />
      </mesh>
      {children}
      {p.snap !== undefined && (
        <group position={[0, 0, 0.05]}>
          <SnapshotQuad issue={p.snap} w={p.w} h={p.h} />
        </group>
      )}
      <Caption x={0} y={-p.h / 2 + 0.55} w={p.w - 0.5} text={p.cap} size={p.capSize} />
    </group>
  );
}

// ---- approved panel art (public/images, user-approved 2026-07-03) -----------
/**
 * Single textured plane filling the panel interior. Centered texture crop
 * via repeat/offset reconciles image vs panel aspect (no distortion, no
 * file edits); `trim` insets a further UV fraction per side so the baked
 * canvas-edge ink border cannot double the in-scene PanelFrame border.
 * Built-in material + SRGBColorSpace: three decodes -- no manual pow(2.2)
 * (that rule is for custom-sampled canvas copies only, see decodeSRGB).
 * Mount under a LOCAL Suspense: while loading, the PanelFrame's PAPER_DIM
 * interior fill (z 0.03) is the placeholder, and the rest of the page
 * never unmounts.
 */
export function ArtPanel({
  url,
  w,
  h,
  trim = 0,
  z = 0.035,
}: {
  url: string;
  w: number;
  h: number;
  trim?: number;
  z?: number;
}) {
  const tex = useLoader(TextureLoader, url);

  useLayoutEffect(() => {
    const img = tex.image as { width: number; height: number };
    const a = w / h / (img.width / img.height);
    const rx = (a <= 1 ? a : 1) * (1 - 2 * trim);
    const ry = (a <= 1 ? 1 : 1 / a) * (1 - 2 * trim);
    tex.colorSpace = SRGBColorSpace;
    tex.repeat.set(rx, ry);
    tex.offset.set((1 - rx) / 2, (1 - ry) / 2);
    tex.needsUpdate = true;
  }, [tex, w, h, trim]);

  // useLoader caches by url: clear the cache entry AND free the GPU copy on
  // unmount (SceneManager remount reloads clean); the JSX material is
  // auto-disposed by fiber like the scene's other resources
  useEffect(
    () => () => {
      useLoader.clear(TextureLoader, url);
      tex.dispose();
    },
    [tex, url],
  );

  return (
    <mesh position={[0, 0, z]}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={tex} />
    </mesh>
  );
}

/** beat 2: university -- open book + grad cap */
function UniArt() {
  return (
    <group position={[0, 0.35, 0.035]}>
      <mesh position={[-0.75, -0.3, 0.005]} rotation={[0, 0, 0.08]}>
        <planeGeometry args={[1.5, 1.0]} />
        <meshBasicMaterial color={PAPER} />
      </mesh>
      <mesh position={[0.75, -0.3, 0.005]} rotation={[0, 0, -0.08]}>
        <planeGeometry args={[1.5, 1.0]} />
        <meshBasicMaterial color={PAPER} />
      </mesh>
      <mesh position={[0, -0.33, 0.006]}>
        <planeGeometry args={[0.08, 1.06]} />
        <meshBasicMaterial color={INK} />
      </mesh>
      {[-0.72, 0.72].map((px) =>
        [-0.08, -0.3, -0.52].map((py, j) => (
          <mesh key={`${px}-${j}`} position={[px, py, 0.007]} rotation={[0, 0, px < 0 ? 0.08 : -0.08]}>
            <planeGeometry args={[1.0, 0.045]} />
            <meshBasicMaterial color={INK} />
          </mesh>
        )),
      )}
      {/* grad cap: flattened diamond board + rust tassel */}
      <group position={[0, 0.78, 0.005]} scale={[1, 0.5, 1]}>
        <mesh rotation={[0, 0, Math.PI / 4]}>
          <planeGeometry args={[1.15, 1.15]} />
          <meshBasicMaterial color={INK} />
        </mesh>
      </group>
      <mesh position={[0, 0.8, 0.007]}>
        <circleGeometry args={[0.06, 12]} />
        <meshBasicMaterial color={RUST} />
      </mesh>
      <mesh position={[0.45, 0.55, 0.007]} rotation={[0, 0, 0.15]}>
        <planeGeometry args={[0.035, 0.55]} />
        <meshBasicMaterial color={RUST} />
      </mesh>
      <mesh position={[0.49, 0.28, 0.007]}>
        <circleGeometry args={[0.06, 12]} />
        <meshBasicMaterial color={RUST} />
      </mesh>
    </group>
  );
}

/** beat 3 fallback (under the desk snapshot): mini workstation glyph */
function DeskFallback() {
  return (
    <group position={[0, 0.35, 0.035]}>
      <mesh position={[0, 0.45, 0.004]}>
        <planeGeometry args={[1.6, 1.0]} />
        <meshBasicMaterial color={INK} />
      </mesh>
      <mesh position={[0, 0.47, 0.005]}>
        <planeGeometry args={[1.4, 0.8]} />
        <meshBasicMaterial color={PAPER_DIM} />
      </mesh>
      {[0.68, 0.47, 0.26].map((py, j) => (
        <mesh key={j} position={[(j - 1) * 0.1, py, 0.006]}>
          <planeGeometry args={[0.9, 0.07]} />
          <meshBasicMaterial color={j === 1 ? RUST : BLUE} />
        </mesh>
      ))}
      <mesh position={[0, -0.18, 0.004]}>
        <planeGeometry args={[0.12, 0.3]} />
        <meshBasicMaterial color={INK} />
      </mesh>
      <mesh position={[0, -0.55, 0.004]}>
        <planeGeometry args={[1.5, 0.4]} />
        <meshBasicMaterial color={INK} />
      </mesh>
    </group>
  );
}

/** beat 5 fallback (under the neon snapshot): sharper tools = crisper code */
function NeonFallback() {
  return (
    <group position={[0, 0.35, 0.035]}>
      <mesh position={[0, 0.1, 0.004]}>
        <planeGeometry args={[2.9, 2.2]} />
        <meshBasicMaterial color={DARK} />
      </mesh>
      {[0.85, 0.55, 0.25, -0.05, -0.35, -0.65].map((py, j) => (
        <mesh key={j} position={[-1.2 + (j % 3) * 0.25 + (0.5 + hash(j, 7.13) * 0.9) / 2, py, 0.005]}>
          <planeGeometry args={[0.5 + hash(j, 7.13) * 0.9, 0.09]} />
          <meshBasicMaterial color={j % 3 === 1 ? RUST : BLUE} />
        </mesh>
      ))}
    </group>
  );
}

/** beat 6 fallback (under the noir snapshot): one lit window on a dead block */
function NoirFallback() {
  return (
    <group position={[0, 0.15, 0.035]}>
      <mesh position={[0, 0.1, 0.004]}>
        <planeGeometry args={[5.7, 3.6]} />
        <meshBasicMaterial color={DARK} />
      </mesh>
      <mesh position={[-0.9, -0.3, 0.005]}>
        <planeGeometry args={[2.2, 2.6]} />
        <meshBasicMaterial color={INK} />
      </mesh>
      <mesh position={[-0.6, 0.25, 0.006]}>
        <planeGeometry args={[0.4, 0.5]} />
        <meshBasicMaterial color={RUST} />
      </mesh>
      <mesh position={[1.6, -0.65, 0.005]}>
        <planeGeometry args={[1.5, 1.9]} />
        <meshBasicMaterial color={INK} />
      </mesh>
      <mesh position={[2.1, 1.25, 0.005]}>
        <circleGeometry args={[0.32, 24]} />
        <meshBasicMaterial color={PAPER_DIM} />
      </mesh>
    </group>
  );
}

// ---- the portal panel (beat 7): recessed shadow-box cut through the page ----
const KRACKLE = Array.from({ length: 12 }, (_, i) => ({
  x: (hash(i, 12.9898) - 0.5) * 3.0,
  y: (hash(i, 78.233) - 0.5) * 2.8,
  z: -1.0 - hash(i, 37.719) * 4.6,
  s: 0.05 + hash(i, 9.151) * 0.05,
}));

function PortalKrackle() {
  const inst = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const m = inst.current;
    if (!m) return;
    KRACKLE.forEach((_, i) => {
      tmpC.set(i % 3 === 2 ? RUST : BLUE).multiplyScalar(i % 3 === 2 ? 0.7 : 0.8);
      m.setColorAt(i, tmpC);
    });
    m.instanceColor!.needsUpdate = true;
  }, []);

  useFrame(({ clock }) => {
    const m = inst.current;
    if (!m) return;
    const { quality, reducedMotion } = useScrollStore.getState();
    const fps = quality === "low" ? 8 : 12;
    const st = reducedMotion ? 0 : stepTime(clock.elapsedTime, fps);
    for (let i = 0; i < KRACKLE.length; i++) {
      const k = KRACKLE[i]!;
      tmpO.position.set(
        PX + k.x + 0.15 * Math.sin(st * 1.3 + i * 2.7),
        PY + k.y + 0.15 * Math.cos(st * 1.1 + i * 1.9),
        k.z,
      );
      tmpO.rotation.set(st * 0.7 + i, st * 0.9 + i * 2, 0);
      tmpO.scale.setScalar(k.s);
      tmpO.updateMatrix();
      m.setMatrixAt(i, tmpO.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={inst} args={[undefined, undefined, KRACKLE.length]} frustumCulled={false}>
      <octahedronGeometry args={[1, 0]} />
      <meshBasicMaterial color="#FFFFFF" />
    </instancedMesh>
  );
}

function Portal() {
  const border = useRef<Group>(null);

  // gentle jaw-drop breath (authored-time via lib/beats.ts, 0 when idle)
  useFrame(() => {
    border.current?.scale.setScalar(1 + 0.045 * PORTAL_POP.v);
  });

  return (
    <group>
      {/* ink frame around the opening (breathes on the jaw-drop beat) */}
      <group ref={border} position={[PX, PY, 0.02]}>
        <mesh position={[0, 2.175, 0]}>
          <planeGeometry args={[4.65, 0.25]} />
          <meshBasicMaterial color={INK} />
        </mesh>
        <mesh position={[0, -2.175, 0]}>
          <planeGeometry args={[4.65, 0.25]} />
          <meshBasicMaterial color={INK} />
        </mesh>
        <mesh position={[-2.2, 0, 0]}>
          <planeGeometry args={[0.25, 4.1]} />
          <meshBasicMaterial color={INK} />
        </mesh>
        <mesh position={[2.2, 0, 0]}>
          <planeGeometry args={[0.25, 4.1]} />
          <meshBasicMaterial color={INK} />
        </mesh>
      </group>

      {/* recessed interior: BackSide box = shadow-box walls, open face never
          drawn, so the camera passes the page plane without a clip pop */}
      <mesh position={[PX, PY, -PORTAL_DEPTH / 2]}>
        <boxGeometry args={[OPEN_W, OPEN_H, PORTAL_DEPTH]} />
        <meshBasicMaterial color={VOID} side={BackSide} />
      </mesh>

      {/* deep in the dark: the robot, waiting (beat 7) */}
      <group position={[PX, PY, -PORTAL_DEPTH + 0.3]}>
        <mesh position={[-0.38, 0.25, 0]}>
          <planeGeometry args={[0.34, 0.14]} />
          <meshBasicMaterial color={RUST} />
        </mesh>
        <mesh position={[0.38, 0.25, 0]}>
          <planeGeometry args={[0.34, 0.14]} />
          <meshBasicMaterial color={RUST} />
        </mesh>
        <mesh position={[0, -0.35, 0]}>
          <planeGeometry args={[0.6, 0.06]} />
          <meshBasicMaterial color={BLUE} />
        </mesh>
        <mesh position={[0, 0.85, 0]}>
          <planeGeometry args={[0.04, 0.5]} />
          <meshBasicMaterial color={BLUE} />
        </mesh>
        <mesh position={[0, 1.15, 0]}>
          <circleGeometry args={[0.07, 12]} />
          <meshBasicMaterial color={RUST} />
        </mesh>
      </group>

      <PortalKrackle />
    </group>
  );
}

// ---- orbiting tech icons: squash-and-stretch on 2s (S2.8) ------------------
const STACK = content.stack;
// two lanes, clear of ALL lettering (S2.16): above the page top edge and in
// the blank bottom margin below the portal caption -- chips crossing captions
// in the close shots read as occluded text, so the ring never enters the
// panel/caption band
const ICONS = STACK.map((label, i) => ({
  label,
  phase: (i / STACK.length) * Math.PI * 2,
  r: 9.2 + (i % 3) * 0.7,
  y0: i % 2 ? -6.9 - (i >> 1) * 0.3 : 8.6 + (i >> 1) * 0.4,
  speed: 0.16 + (i % 3) * 0.04,
  sq: i * 1.7,
}));

function IconRing() {
  const inst = useRef<InstancedMesh>(null);
  const labels = useRef<(Group | null)[]>([]);

  useLayoutEffect(() => {
    const m = inst.current;
    if (!m) return;
    ICONS.forEach((_, i) => m.setColorAt(i, tmpC.set(i % 2 ? RUST : BLUE)));
    m.instanceColor!.needsUpdate = true;
  }, []);

  useFrame(({ clock, camera }) => {
    const m = inst.current;
    if (!m) return;
    const { quality, reducedMotion } = useScrollStore.getState();
    const fps = quality === "low" ? 8 : 12;
    const st = reducedMotion ? 0 : stepTime(clock.elapsedTime, fps);
    for (let i = 0; i < ICONS.length; i++) {
      const ic = ICONS[i]!;
      const a = ic.phase + st * ic.speed;
      const q = reducedMotion ? 0 : Math.sin(st * 1.8 + ic.sq);
      tmpO.position.set(
        Math.cos(a) * ic.r,
        ic.y0 + 0.12 * Math.sin(st * 0.9 + ic.phase * 2),
        Math.sin(a) * 4.2,
      );
      tmpO.quaternion.copy(camera.quaternion); // billboard: squash reads in view space
      tmpO.scale.set(1 + 0.18 * q, 1 - 0.18 * q, 1);
      tmpO.updateMatrix();
      m.setMatrixAt(i, tmpO.matrix);
      const lg = labels.current[i];
      if (lg) {
        lg.position.copy(tmpO.position);
        lg.quaternion.copy(tmpO.quaternion);
        lg.scale.copy(tmpO.scale);
      }
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={inst} args={[undefined, undefined, ICONS.length]} frustumCulled={false}>
        <boxGeometry args={[1.6, 0.7, 0.16]} />
        <meshBasicMaterial color="#FFFFFF" />
      </instancedMesh>
      {ICONS.map((ic, i) => (
        <group
          key={ic.label}
          ref={(el) => {
            labels.current[i] = el;
          }}
        >
          <Text position={[0, 0, 0.09]} font={BANGERS} fontSize={0.26} color={INK} anchorX="center" anchorY="middle">
            {ic.label}
          </Text>
        </group>
      ))}
    </group>
  );
}

// ---- dust motes: slow stepped drift in the void (FG depth plane) ------------
const MOTES = Array.from({ length: 20 }, (_, i) => ({
  x: (hash(i, 12.9898) - 0.5) * 15,
  y: (hash(i, 78.233) - 0.5) * 15,
  z: 0.6 + hash(i, 37.719) * 3.6,
  s: 0.04 + hash(i, 9.151) * 0.05,
}));

function Motes() {
  const inst = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const m = inst.current;
    if (!m) return;
    MOTES.forEach((_, i) => {
      tmpC.set(i % 2 ? BLUE : RUST).lerp(tmpC2.set(PAPER), 0.45);
      m.setColorAt(i, tmpC);
    });
    m.instanceColor!.needsUpdate = true;
  }, []);

  useFrame(({ clock }) => {
    const m = inst.current;
    if (!m) return;
    const { quality, reducedMotion } = useScrollStore.getState();
    const fps = quality === "low" ? 8 : 12;
    const st = reducedMotion ? 0 : stepTime(clock.elapsedTime, fps);
    for (let i = 0; i < MOTES.length; i++) {
      const d = MOTES[i]!;
      tmpO.position.set(
        d.x + 0.4 * Math.sin(st * 0.35 + i * 2.1),
        d.y + 0.3 * Math.cos(st * 0.28 + i * 1.3),
        d.z,
      );
      tmpO.rotation.set(0, 0, 0);
      tmpO.scale.setScalar(d.s);
      tmpO.updateMatrix();
      m.setMatrixAt(i, tmpO.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={inst} args={[undefined, undefined, MOTES.length]} frustumCulled={false}>
      <octahedronGeometry args={[1, 0]} />
      <meshBasicMaterial color="#FFFFFF" />
    </instancedMesh>
  );
}

// ---- the cat (S5b.1 guide): pads along the margin INTO the portal ahead of us
function OriginCat() {
  const grp = useRef<Group>(null);
  const head = useRef<Group>(null);
  const tail = useRef<Group>(null);

  useFrame(({ clock }) => {
    const g = grp.current;
    if (!g) return;
    const { t, quality, reducedMotion } = useScrollStore.getState();
    const fps = quality === "low" ? 8 : 12;
    const s = reducedMotion ? 0 : stepTime(clock.elapsedTime, fps);
    const walk = clamp01((t - ORIGIN_CAT_WALK[0]) / (ORIGIN_CAT_WALK[1] - ORIGIN_CAT_WALK[0]));
    const hop = clamp01((t - ORIGIN_CAT_HOP[0]) / (ORIGIN_CAT_HOP[1] - ORIGIN_CAT_HOP[0]));
    const striding = walk > 0.02 && walk < 0.98 ? 1 : 0;
    const bob = reducedMotion ? 0 : Math.abs(Math.sin(s * 3.2)) * 0.06 * striding;
    // margin walk, then a small arc up onto the portal's bottom frame: perched
    // at the mouth of the void, eyeline in -- the guide moment (all pure f(t))
    g.position.set(
      lerp(-3.6, 1.5, walk) + 0.7 * hop,
      lerp(-6.6, -4.6, hop) + 0.55 * Math.sin(Math.PI * hop) + bob * (1 - hop),
      0.07,
    );
    // question-mark tail flick on 2s around the walking pose's base rot (0.5)
    if (tail.current) tail.current.rotation.z = 0.5 + Math.sin(s * 2.0) * 0.18;
    // eyeline lifts toward the portal as it closes in (motivates the glide)
    if (head.current) head.current.rotation.z = 0.15 * walk + 0.22 * hop;
  });

  return (
    <group
      ref={grp}
      scale={0.85}
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
export default function Origin({ index }: { index: number }) {
  const issue = ISSUES[index]!;

  // The quoted issues (1-3) are retained at module load in ./shots.ts:
  // their exit tails are filmed before this set ever mounts, so a
  // retain-on-mount would miss the first forward read (S2.11).

  return (
    <IssueShell index={index} issue={issue}>
      {/* the floating page: paper quads composed around the portal hole */}
      {PAGE_QUADS.map(([cx, cy, w, h], i) => (
        <mesh key={i} position={[cx, cy, 0]}>
          <planeGeometry args={[w, h]} />
          <meshBasicMaterial color={PAPER} />
        </mesh>
      ))}
      {/* drop shadow, composed AROUND the portal box cross-section: a quad
          crossing z=-0.5 inside the box would show through the opening and
          kill the void (hole here = the box rect, not the offset page hole) */}
      {SHADOW_QUADS.map(([cx, cy, w, h], i) => (
        <mesh key={`s${i}`} position={[cx, cy, -0.5]}>
          <planeGeometry args={[w, h]} />
          <meshBasicMaterial color={PAGE_SHADOW} />
        </mesh>
      ))}
      {/* drifting blank pages behind (BG depth plane) */}
      <mesh position={[-8.5, 1.5, -15]} rotation={[0, 0.35, 0.04]}>
        <planeGeometry args={[10, 13.4]} />
        <meshBasicMaterial color="#E4DCCB" />
      </mesh>
      <mesh position={[9, -1, -22]} rotation={[0, -0.3, -0.05]}>
        <planeGeometry args={[10, 13.4]} />
        <meshBasicMaterial color="#DFD6C4" />
      </mesh>

      <Suspense fallback={null}>
        {/* lead caption strip (the masthead already dropped -- S5b.3) */}
        <Caption x={0} y={7.25} w={11.3} text={LEAD} size={0.4} z={0.02} h={0.95} />

        {/* story-beat panels, reading order */}
        <PanelFrame p={PANELS[0]!}>
          <Suspense fallback={null}>
            <ArtPanel url="/images/origin-kid-panel.png" w={5.4} h={3.3} />
          </Suspense>
        </PanelFrame>
        <PanelFrame p={PANELS[1]!}>
          <UniArt />
        </PanelFrame>
        <PanelFrame p={PANELS[2]!}>
          <DeskFallback />
        </PanelFrame>
        <PanelFrame p={PANELS[3]!}>
          <Suspense fallback={null}>
            <ArtPanel url="/images/origin-cologne-panel.png" w={3.5} h={3.6} />
          </Suspense>
        </PanelFrame>
        <PanelFrame p={PANELS[4]!}>
          <NeonFallback />
        </PanelFrame>
        <PanelFrame p={PANELS[5]!}>
          <NoirFallback />
        </PanelFrame>

        {/* beat 7: the portal panel -- caption on the page below the opening */}
        <Portal />
        <Caption x={PX} y={-5.85} w={4.0} text={BEATS[6]!} size={0.22} />

        <IconRing />
      </Suspense>

      <Motes />
      <OriginCat />
    </IssueShell>
  );
}
