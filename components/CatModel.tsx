"use client";

import type { RefObject } from "react";
import { BackSide, type Group } from "three";
import { toonRamp } from "@/lib/toon";

/**
 * CatModel v2 -- the shared mascot (S1 through-line), rebuilt 2026-07-03 to
 * the user-approved flat-illustration reference: chubby cat, big round
 * head (wider than tall, ~40% of the mass), small triangular ears, big oval
 * eyes with pupils, small triangular nose, three thin
 * paper whiskers per side, collar band + tag, low-slung bean body, rounded
 * tapering limbs with paper sock paws, long rounded tail with an accent tip.
 * Default coloring is HARLEY (user directive 2026-07-03): golden-brown
 * tabby fur, cream ruff + socks, amber eyes, pink nose + inner ears,
 * darker-brown tail tip and stripe caps (stripes toon build only).
 * Everything is spheres / capsules / circles / torus arcs -- no boxes, no
 * visible seams; every limb/tail root stays INSIDE a body mass in every pose
 * (Phase 1 invariant, re-verified numerically for the v2 numbers).
 *
 * Two builds under one unchanged v1 API:
 * - mode "flat": unlit 2D print build (circles + capsule limbs with tiny z
 *   offsets, viewed face-on inside printed compositions). meshBasicMaterial
 *   throughout -- flat ink, no lighting.
 * - mode "toon": dimensional lit build (MeshToonMaterial + lib/toon ramp,
 *   paper rim hulls so ink reads against dark sets).
 *
 * Face features (eyes/pupils/nose/whiskers/collar/tag/socks) are palette-
 * toggled: a palette whose paper/collar/tag equal its ink is a pure
 * silhouette (Noir) and the features are skipped entirely. The tail keeps
 * its accent tip geometry but inks it so silhouettes keep full tail length.
 *
 * Scene behavior stays in the scenes; parents animate head/paw/tail through
 * the rig refs. Idle motion a parent adds must sample stepTime (S2.8);
 * scroll motion stays pure f(t).
 */

export type CatPose = "sitting" | "crouch" | "walking" | "leaping";
export type CatMode = "flat" | "toon";

export interface CatPalette {
  ink: string; // body fur
  paper: string; // socks, whiskers, rim hulls (+ eye fallback)
  collar: string; // collar band (identity mark, teal everywhere so far)
  tag: string; // collar tag (identity mark, red everywhere so far)
  accent: string; // tail tip (issue accent color)
  // optional Harley detail fields -- legacy per-scene palettes omit them
  // and render exactly as before (fallbacks reproduce the v2 look)
  eye?: string; // iris fill (falls back to paper: white-sclera look)
  pupil?: string; // falls back to ink
  nose?: string; // falls back to tag (legacy nose == tag)
  earInner?: string; // inner-ear fill; omitted = none
  ruff?: string; // cream chest ruff mass; omitted = none
  stripe?: string; // tabby stripe caps, toon build only; omitted = none
}

/**
 * Default palette: Harley, the real cat (user directive 2026-07-03) --
 * long-haired golden-brown tabby, big cream chest ruff, amber-yellow eyes,
 * pink nose, cream paws, darker-brown tail tip + stripe caps. Teal collar
 * and red tag identity marks stay (approved stylization). Fur hex chosen
 * mid amber-brown so the 3-step toon ramp (27% / 63% / 100%) keeps it
 * reading brown on light and dark paper alike.
 */
export const HARLEY: CatPalette = {
  ink: "#A9743C",
  paper: "#F4E7C8",
  collar: "#2BB3A3",
  tag: "#E2574C",
  accent: "#6E4A24",
  eye: "#F0B429",
  pupil: "#17130C",
  nose: "#E8929B",
  earInner: "#E8929B",
  ruff: "#F4E7C8",
  stripe: "#6E4A24",
};

export interface CatRig {
  head?: RefObject<Group | null>;
  paw?: RefObject<Group | null>; // toon build only (flat legs are static)
  tail?: RefObject<Group | null>;
}

interface CatModelProps {
  pose: CatPose;
  mode: CatMode;
  /** omit for the Harley default */
  palette?: CatPalette;
  rig?: CatRig;
}

type Vec3 = [number, number, number];

const isSilhouette = (p: CatPalette) =>
  p.paper === p.ink && p.collar === p.ink && p.tag === p.ink;

/* ----------------------------------------------------- flat-print build -- */

interface FlatBlob {
  pos: Vec3;
  r: number;
  s: [number, number];
}

interface FlatPose {
  body: FlatBlob[]; // overlapping ink masses: torso / belly / haunch / chest
  head: { pos: Vec3; rot: number };
  legs: { pos: Vec3; rot: number; len: number }[]; // capsules, roots inside a mass
  socks: Vec3[]; // paper caps ON the forward paw tips
  collar: { pos: Vec3; rot: number; w: number };
  tag: Vec3;
  ruff: { pos: Vec3; r: number; s: [number, number] }; // chest patch, stays inside the ink outline
  tail: { pivot: Vec3; rot: number; r: number; arc: number; tip: Vec3 };
}

// tail tip = arc end of the torus: [-r + r*cos(arc), r*sin(arc)] (precomputed)
const FLAT_POSES: Record<CatPose, FlatPose> = {
  // mid-pounce (the Cover hero): stretched bean, front socks reaching
  leaping: {
    body: [
      { pos: [0, 0, 0], r: 0.5, s: [1.6, 0.75] },
      { pos: [0.12, -0.16, 0.0004], r: 0.36, s: [1.1, 0.85] },
      { pos: [-0.58, -0.02, 0.0005], r: 0.4, s: [1.05, 1.0] },
      { pos: [0.52, 0.13, 0.0006], r: 0.3, s: [0.95, 0.95] },
    ],
    head: { pos: [0.85, 0.42, 0.003], rot: 0.1 },
    legs: [
      { pos: [0.98, 0.02, 0.0015], rot: -1.2, len: 0.5 },
      { pos: [0.82, -0.06, -0.001], rot: -1.05, len: 0.46 },
      { pos: [-0.66, -0.36, 0.0015], rot: -0.35, len: 0.46 },
      { pos: [-0.84, -0.32, -0.001], rot: -0.72, len: 0.5 },
    ],
    socks: [
      [1.29, 0.14, 0.0035],
      [1.09, 0.1, -0.0005],
    ],
    collar: { pos: [0.6, 0.05, 0.005], rot: -0.75, w: 0.5 },
    tag: [0.67, -0.09, 0.006],
    ruff: { pos: [0.6, -0.02, 0.0045], r: 0.17, s: [1.0, 1.15] },
    tail: { pivot: [-0.85, 0.18, 0.001], rot: 0.15, r: 0.45, arc: 2.0, tip: [-0.637, 0.409, 0.002] },
  },
  // upright sit: wide low base, big head, front paws planted, tail curled
  sitting: {
    body: [
      { pos: [-0.02, -0.46, 0], r: 0.52, s: [1.15, 0.9] },
      { pos: [0.06, -0.05, 0.0004], r: 0.4, s: [0.95, 1.1] },
      { pos: [0.1, 0.28, 0.0006], r: 0.3, s: [0.9, 0.9] },
    ],
    head: { pos: [0.1, 0.68, 0.003], rot: 0 },
    legs: [
      { pos: [0.2, -0.55, 0.0015], rot: 0.03, len: 0.42 },
      { pos: [0.37, -0.53, -0.001], rot: -0.08, len: 0.4 },
      { pos: [-0.14, -0.85, 0.002], rot: 1.5, len: 0.3 },
    ],
    socks: [
      [0.21, -0.85, 0.0035],
      [0.35, -0.82, -0.0005],
    ],
    collar: { pos: [0.1, 0.32, 0.005], rot: 0, w: 0.56 },
    tag: [0.1, 0.22, 0.006],
    ruff: { pos: [0.1, 0.04, 0.0045], r: 0.19, s: [0.85, 1.3] },
    tail: { pivot: [-0.42, -0.62, 0.001], rot: 0.9, r: 0.4, arc: 2.1, tip: [-0.602, 0.345, 0.002] },
  },
  // low anticipation crouch: long low bean, rump up, legs folded flat
  crouch: {
    body: [
      { pos: [0, -0.06, 0], r: 0.5, s: [1.7, 0.6] },
      { pos: [0.05, -0.18, 0.0004], r: 0.32, s: [1.2, 0.7] },
      { pos: [-0.6, 0, 0.0005], r: 0.4, s: [1.05, 0.95] },
      { pos: [0.55, -0.02, 0.0006], r: 0.26, s: [0.95, 0.95] },
    ],
    head: { pos: [0.8, 0.1, 0.003], rot: -0.08 },
    legs: [
      { pos: [0.55, -0.3, 0.0015], rot: 1.35, len: 0.4 },
      { pos: [-0.45, -0.32, 0.0015], rot: 1.45, len: 0.4 },
    ],
    socks: [[0.83, -0.36, 0.0035]],
    collar: { pos: [0.58, -0.04, 0.005], rot: -1.2, w: 0.46 },
    tag: [0.65, -0.17, 0.006],
    ruff: { pos: [0.56, -0.1, 0.0045], r: 0.13, s: [1.0, 1.0] },
    tail: { pivot: [-0.9, 0.06, 0.001], rot: -0.75, r: 0.4, arc: 1.7, tip: [-0.452, 0.397, 0.002] },
  },
  // mid-stride walk: low belly, diagonal limbs, question-mark tail
  walking: {
    body: [
      { pos: [0, 0.06, 0], r: 0.5, s: [1.5, 0.78] },
      { pos: [0.06, -0.1, 0.0004], r: 0.34, s: [1.15, 0.85] },
      { pos: [-0.52, 0, 0.0005], r: 0.38, s: [1.05, 1.0] },
      { pos: [0.5, 0.14, 0.0006], r: 0.28, s: [1.0, 1.0] },
    ],
    head: { pos: [0.78, 0.46, 0.003], rot: 0 },
    legs: [
      { pos: [0.52, -0.34, 0.0015], rot: 0.32, len: 0.46 },
      { pos: [0.28, -0.32, -0.001], rot: -0.38, len: 0.46 },
      { pos: [-0.5, -0.34, 0.0015], rot: -0.3, len: 0.46 },
      { pos: [-0.66, -0.3, -0.001], rot: 0.55, len: 0.46 },
    ],
    socks: [
      [0.62, -0.64, 0.0035],
      [0.17, -0.61, -0.0005],
    ],
    collar: { pos: [0.55, 0.24, 0.005], rot: -1.0, w: 0.48 },
    tag: [0.62, 0.11, 0.006],
    ruff: { pos: [0.52, 0.0, 0.0045], r: 0.15, s: [0.95, 1.25] },
    tail: { pivot: [-0.58, 0.12, 0.001], rot: 0.55, r: 0.42, arc: 2.0, tip: [-0.595, 0.382, 0.002] },
  },
};

/** shared face kit, positioned relative to the head center (head r 0.42,
 *  scaled [1.12, 0.95] -- big oval white eyes, ink pupils, 3-gon nose,
 *  three whiskers per side; reads at 200px, S5b.4) */
function FlatFace({ p }: { p: CatPalette }) {
  return (
    <group>
      <mesh position={[-0.15, 0.05, 0.002]} scale={[0.8, 1.25, 1]}>
        <circleGeometry args={[0.105, 24]} />
        <meshBasicMaterial color={p.eye ?? p.paper} />
      </mesh>
      <mesh position={[0.17, 0.06, 0.002]} scale={[0.8, 1.25, 1]}>
        <circleGeometry args={[0.105, 24]} />
        <meshBasicMaterial color={p.eye ?? p.paper} />
      </mesh>
      <mesh position={[-0.14, 0.02, 0.004]}>
        <circleGeometry args={[0.045, 14]} />
        <meshBasicMaterial color={p.pupil ?? p.ink} />
      </mesh>
      <mesh position={[0.18, 0.03, 0.004]}>
        <circleGeometry args={[0.045, 14]} />
        <meshBasicMaterial color={p.pupil ?? p.ink} />
      </mesh>
      {/* 3-gon nose, point down */}
      <mesh position={[0.02, -0.13, 0.002]} rotation={[0, 0, -Math.PI / 2]}>
        <circleGeometry args={[0.055, 3]} />
        <meshBasicMaterial color={p.nose ?? p.tag} />
      </mesh>
      {/* whiskers: three thin paper strokes per side */}
      {(
        [
          [-0.44, -0.02, 0.2],
          [-0.46, -0.09, 0.03],
          [-0.43, -0.16, -0.15],
          [0.47, 0.0, -0.2],
          [0.49, -0.07, -0.03],
          [0.46, -0.14, 0.15],
        ] as const
      ).map(([x, y, rz], i) => (
        <mesh key={i} position={[x, y, 0.002]} rotation={[0, 0, rz]}>
          <planeGeometry args={[i % 3 === 0 ? 0.26 : 0.24, 0.016]} />
          <meshBasicMaterial color={p.paper} />
        </mesh>
      ))}
    </group>
  );
}

function FlatCat({ def, p, rig }: { def: FlatPose; p: CatPalette; rig?: CatRig }) {
  const sil = isSilhouette(p);
  return (
    <group>
      {/* overlapping body masses keep every limb rooted in one silhouette */}
      {def.body.map((b, i) => (
        <mesh key={i} position={b.pos} scale={[b.s[0], b.s[1], 1]}>
          <circleGeometry args={[b.r, 40]} />
          <meshBasicMaterial color={p.ink} />
        </mesh>
      ))}

      {/* limbs: rounded capsules; far pair sits just behind the torso */}
      {def.legs.map((l, i) => (
        <mesh key={i} position={l.pos} rotation={[0, 0, l.rot]}>
          <capsuleGeometry args={[0.08, l.len, 4, 10]} />
          <meshBasicMaterial color={p.ink} />
        </mesh>
      ))}
      {/* paper socks ON the forward paw tips */}
      {!sil &&
        def.socks.map((s, i) => (
          <mesh key={i} position={s}>
            <circleGeometry args={[0.078, 16]} />
            <meshBasicMaterial color={p.paper} />
          </mesh>
        ))}

      {/* the head: big round ellipse, wider than tall, small triangle ears */}
      <group ref={rig?.head} position={def.head.pos} rotation={[0, 0, def.head.rot]}>
        <mesh scale={[1.12, 0.95, 1]}>
          <circleGeometry args={[0.42, 44]} />
          <meshBasicMaterial color={p.ink} />
        </mesh>
        <mesh position={[-0.26, 0.34, 0]} rotation={[0, 0, Math.PI / 2 + 0.22]}>
          <circleGeometry args={[0.15, 3]} />
          <meshBasicMaterial color={p.ink} />
        </mesh>
        <mesh position={[0.26, 0.34, 0]} rotation={[0, 0, Math.PI / 2 - 0.22]}>
          <circleGeometry args={[0.15, 3]} />
          <meshBasicMaterial color={p.ink} />
        </mesh>
        {/* pink inner ears (Harley marking; only when the palette asks) */}
        {!sil && p.earInner && (
          <>
            <mesh position={[-0.26, 0.37, 0.001]} rotation={[0, 0, Math.PI / 2 + 0.22]}>
              <circleGeometry args={[0.075, 3]} />
              <meshBasicMaterial color={p.earInner} />
            </mesh>
            <mesh position={[0.26, 0.37, 0.001]} rotation={[0, 0, Math.PI / 2 - 0.22]}>
              <circleGeometry args={[0.075, 3]} />
              <meshBasicMaterial color={p.earInner} />
            </mesh>
          </>
        )}
        {!sil && <FlatFace p={p} />}
      </group>

      {/* cream chest ruff: sits under collar + tag (z 0.0045 < 0.005) and
          inside the ink outline so the silhouette stays clean */}
      {!sil && p.ruff && (
        <mesh position={def.ruff.pos} scale={[def.ruff.s[0], def.ruff.s[1], 1]}>
          <circleGeometry args={[def.ruff.r, 28]} />
          <meshBasicMaterial color={p.ruff} />
        </mesh>
      )}

      {/* collar band across the neck + tag */}
      {!sil && (
        <>
          <mesh position={def.collar.pos} rotation={[0, 0, def.collar.rot]}>
            <planeGeometry args={[def.collar.w, 0.095]} />
            <meshBasicMaterial color={p.collar} />
          </mesh>
          <mesh position={def.tag}>
            <circleGeometry args={[0.055, 12]} />
            <meshBasicMaterial color={p.tag} />
          </mesh>
        </>
      )}

      {/* tail: torus arc pivoting at its base end; pivot stays INSIDE the
          haunch mass in every pose (Phase 1 invariant). Parents flick
          rotation.z; accent tip caps the arc end (inked for silhouettes so
          the tail keeps its full length). */}
      <group ref={rig?.tail} position={def.tail.pivot} rotation={[0, 0, def.tail.rot]}>
        <mesh position={[-def.tail.r, 0, 0]}>
          <torusGeometry args={[def.tail.r, 0.07, 8, 24, def.tail.arc]} />
          <meshBasicMaterial color={p.ink} />
        </mesh>
        <mesh position={def.tail.tip}>
          <circleGeometry args={[0.075, 12]} />
          <meshBasicMaterial color={sil ? p.ink : p.accent} />
        </mesh>
      </group>
    </group>
  );
}

/* ------------------------------------------------------ lit-toon build -- */

interface ToonPose {
  scale: Vec3; // pose transform on the whole rig (sitting = identity)
  rot: number;
  lift: number; // body raise so pose leg tips still land at y ~ 0
  head: Vec3; // default group positions -- rig-ref parents override per frame
  paw: Vec3;
  legs: { pos: Vec3; rot: number; len: number }[]; // static limbs (paw rig is its own)
  socks: Vec3[]; // paper sock spheres on forward tips
}

const TOON_POSES: Record<CatPose, ToonPose> = {
  // neutral perch/loaf rig (the Desk cat): head default is LOCKED -- Desk
  // drives head/paw per frame through the rig refs. Paw default PLANTED
  // (sock tip lands at y ~0, user feedback 2026-07-03): undriven sitters
  // (Neon, Pop) read a grounded near-side front foot instead of a floating
  // chest stub; Desk overrides the paw every frame, so typing/batting is
  // untouched.
  sitting: {
    scale: [1, 1, 1],
    rot: 0,
    lift: 0,
    head: [0.5, 0.62, 0],
    paw: [0.44, 0.32, 0.16],
    legs: [{ pos: [0.34, 0.16, -0.15], rot: 0.05, len: 0.3 }],
    socks: [[0.34, 0.02, -0.15]],
  },
  crouch: {
    scale: [1.06, 0.78, 1],
    rot: 0,
    lift: 0,
    head: [0.54, 0.5, 0],
    paw: [0.52, 0.34, 0.16],
    legs: [],
    socks: [],
  },
  walking: {
    scale: [1.04, 0.96, 1],
    rot: -0.04,
    lift: 0.12,
    head: [0.56, 0.66, 0],
    paw: [0.64, 0.4, 0.16],
    legs: [
      { pos: [0.4, 0.18, -0.16], rot: -0.2, len: 0.32 },
      { pos: [-0.34, 0.18, -0.16], rot: 0.28, len: 0.32 },
      { pos: [-0.28, 0.18, 0.16], rot: -0.22, len: 0.32 },
    ],
    socks: [
      [0.44, 0.02, -0.16],
      [-0.4, 0.02, -0.16],
    ],
  },
  // stretched airborne attitude: front limb reaching, rear limbs trailing
  leaping: {
    scale: [1.12, 0.9, 1],
    rot: 0.2,
    lift: 0.1,
    head: [0.6, 0.68, 0],
    paw: [0.68, 0.52, 0.16],
    legs: [
      { pos: [0.55, 0.42, -0.15], rot: -1.25, len: 0.36 },
      { pos: [-0.5, 0.3, -0.14], rot: 1.9, len: 0.4 },
      { pos: [-0.46, 0.32, 0.14], rot: 2.1, len: 0.36 },
    ],
    socks: [[0.77, 0.49, -0.15]],
  },
};

function ToonCat({ def, p, rig }: { def: ToonPose; p: CatPalette; rig?: CatRig }) {
  const ramp = toonRamp();
  const sil = isSilhouette(p);
  const L = def.lift;
  return (
    <group scale={def.scale} rotation={[0, 0, def.rot]}>
      {/* body: three overlapping spheres (chest / barrel / haunch) -- one
          smooth low-slung bean from every shot angle */}
      <mesh position={[0, 0.34 + L, 0]} scale={[1.5, 1.05, 1.15]}>
        <sphereGeometry args={[0.34, 24, 18]} />
        <meshToonMaterial color={p.ink} gradientMap={ramp} />
      </mesh>
      <mesh position={[-0.3, 0.36 + L, 0]} scale={[1.15, 1.1, 1.2]}>
        <sphereGeometry args={[0.3, 24, 18]} />
        <meshToonMaterial color={p.ink} gradientMap={ramp} />
      </mesh>
      <mesh position={[0.32, 0.38 + L, 0]} scale={[1, 1, 1.05]}>
        <sphereGeometry args={[0.26, 20, 16]} />
        <meshToonMaterial color={p.ink} gradientMap={ramp} />
      </mesh>
      {/* paper rim hulls (inverted BackSide) so ink reads against dark sets */}
      {!sil && (
        <>
          <mesh position={[0, 0.34 + L, 0]} scale={[1.62, 1.13, 1.24]}>
            <sphereGeometry args={[0.34, 24, 18]} />
            <meshBasicMaterial color={p.paper} side={BackSide} />
          </mesh>
          <mesh position={[-0.3, 0.36 + L, 0]} scale={[1.24, 1.19, 1.3]}>
            <sphereGeometry args={[0.3, 24, 18]} />
            <meshBasicMaterial color={p.paper} side={BackSide} />
          </mesh>
        </>
      )}

      {/* static limbs per pose + paper sock tips */}
      {def.legs.map((l, i) => (
        <mesh key={i} position={l.pos} rotation={[0, 0, l.rot]}>
          <capsuleGeometry args={[0.065, l.len, 4, 10]} />
          <meshToonMaterial color={p.ink} gradientMap={ramp} />
        </mesh>
      ))}
      {!sil &&
        def.socks.map((s, i) => (
          <mesh key={i} position={s}>
            <sphereGeometry args={[0.07, 12, 10]} />
            <meshToonMaterial color={p.paper} gradientMap={ramp} />
          </mesh>
        ))}

      {/* cream chest ruff: bulges ~0.04 past the chest sphere front, under
          the collar/chin (Harley marking; only when the palette asks) */}
      {!sil && p.ruff && (
        <mesh position={[0.46, 0.33 + L, 0]} scale={[0.9, 1.2, 1.05]}>
          <sphereGeometry args={[0.18, 16, 12]} />
          <meshToonMaterial color={p.ruff} gradientMap={ramp} />
        </mesh>
      )}

      {/* tabby stripe caps on the back (2 of 3; third caps the skull).
          Low-poly flattened spheres poking ~0.03 wu above the body hull --
          negligible geometry, silhouette bulge under 0.04 wu */}
      {!sil && p.stripe && (
        <>
          <mesh position={[0.05, 0.63 + L, 0]} scale={[0.5, 0.7, 1.28]}>
            <sphereGeometry args={[0.14, 12, 10]} />
            <meshToonMaterial color={p.stripe} gradientMap={ramp} />
          </mesh>
          <mesh position={[-0.24, 0.63 + L, 0]} scale={[0.5, 0.7, 1.32]}>
            <sphereGeometry args={[0.14, 12, 10]} />
            <meshToonMaterial color={p.stripe} gradientMap={ramp} />
          </mesh>
        </>
      )}

      {/* collar ring + tag at the neck join */}
      {!sil && (
        <>
          <mesh position={[0.36, 0.5 + L, 0]} rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.2, 0.05, 8, 20]} />
            <meshToonMaterial color={p.collar} gradientMap={ramp} />
          </mesh>
          <mesh position={[0.5, 0.42 + L, 0]}>
            <sphereGeometry args={[0.055, 12, 10]} />
            <meshBasicMaterial color={p.tag} />
          </mesh>
        </>
      )}

      <group ref={rig?.head} position={def.head}>
        {/* skull: round, wider than tall */}
        <mesh scale={[1.12, 0.98, 1.06]}>
          <sphereGeometry args={[0.27, 24, 18]} />
          <meshToonMaterial color={p.ink} gradientMap={ramp} />
        </mesh>
        {!sil && (
          <mesh scale={[1.21, 1.06, 1.15]}>
            <sphereGeometry args={[0.27, 24, 18]} />
            <meshBasicMaterial color={p.paper} side={BackSide} />
          </mesh>
        )}
        {/* small triangular ears */}
        <mesh position={[0.02, 0.28, 0.14]} rotation={[0.3, 0, 0.1]}>
          <coneGeometry args={[0.1, 0.2, 4]} />
          <meshToonMaterial color={p.ink} gradientMap={ramp} />
        </mesh>
        <mesh position={[0.02, 0.28, -0.14]} rotation={[-0.3, 0, 0.1]}>
          <coneGeometry args={[0.1, 0.2, 4]} />
          <meshToonMaterial color={p.ink} gradientMap={ramp} />
        </mesh>
        {/* pink inner ears: smaller cones nudged forward so they show on
            the front face (Harley marking; only when the palette asks) */}
        {!sil && p.earInner && (
          <>
            <mesh position={[0.075, 0.27, 0.14]} rotation={[0.3, 0, 0.1]}>
              <coneGeometry args={[0.05, 0.13, 4]} />
              <meshBasicMaterial color={p.earInner} />
            </mesh>
            <mesh position={[0.075, 0.27, -0.14]} rotation={[-0.3, 0, 0.1]}>
              <coneGeometry args={[0.05, 0.13, 4]} />
              <meshBasicMaterial color={p.earInner} />
            </mesh>
          </>
        )}
        {/* skull stripe cap (third tabby stripe) */}
        {!sil && p.stripe && (
          <mesh position={[-0.05, 0.2, 0]} scale={[1.0, 0.55, 0.9]}>
            <sphereGeometry args={[0.16, 12, 10]} />
            <meshToonMaterial color={p.stripe} gradientMap={ramp} />
          </mesh>
        )}
        {!sil && (
          <>
            {/* big oval eyes (iris) + pupils (crisp, unlit) */}
            <mesh position={[0.26, 0.06, 0.105]} scale={[0.45, 1.3, 1.05]}>
              <sphereGeometry args={[0.085, 16, 12]} />
              <meshBasicMaterial color={p.eye ?? p.paper} />
            </mesh>
            <mesh position={[0.26, 0.06, -0.105]} scale={[0.45, 1.3, 1.05]}>
              <sphereGeometry args={[0.085, 16, 12]} />
              <meshBasicMaterial color={p.eye ?? p.paper} />
            </mesh>
            <mesh position={[0.295, 0.03, 0.1]} scale={[0.4, 1, 1]}>
              <sphereGeometry args={[0.034, 12, 10]} />
              <meshBasicMaterial color={p.pupil ?? p.ink} />
            </mesh>
            <mesh position={[0.295, 0.03, -0.1]} scale={[0.4, 1, 1]}>
              <sphereGeometry args={[0.034, 12, 10]} />
              <meshBasicMaterial color={p.pupil ?? p.ink} />
            </mesh>
            {/* small triangular nose, point forward */}
            <mesh position={[0.3, -0.05, 0]} rotation={[0, 0, -Math.PI / 2]}>
              <coneGeometry args={[0.05, 0.1, 3]} />
              <meshBasicMaterial color={p.nose ?? p.tag} />
            </mesh>
            {/* whiskers: three thin paper strokes per side */}
            {(
              [
                [0.298, -0.02, -0.181, 0.95, 0.15],
                [0.308, -0.06, -0.181, 0.95, 0],
                [0.298, -0.1, -0.181, 0.95, -0.15],
                [0.298, -0.02, 0.181, -0.95, 0.15],
                [0.308, -0.06, 0.181, -0.95, 0],
                [0.298, -0.1, 0.181, -0.95, -0.15],
              ] as const
            ).map(([x, y, z, ry, rz], i) => (
              <mesh key={i} position={[x, y, z]} rotation={[0, ry, rz]}>
                <boxGeometry args={[0.2, 0.012, 0.012]} />
                <meshBasicMaterial color={p.paper} />
              </mesh>
            ))}
          </>
        )}
      </group>

      {/* batting paw rig: rounded limb, paper sock tip */}
      <group ref={rig?.paw} position={def.paw}>
        <mesh position={[0, -0.16, 0]}>
          <capsuleGeometry args={[0.06, 0.26, 4, 10]} />
          <meshToonMaterial color={p.ink} gradientMap={ramp} />
        </mesh>
        {!sil && (
          <mesh position={[0, -0.32, 0]}>
            <sphereGeometry args={[0.075, 12, 10]} />
            <meshToonMaterial color={p.paper} gradientMap={ramp} />
          </mesh>
        )}
      </group>

      {/* tail: rounded segments from a pivot INSIDE the haunch; accent tip
          (inked for silhouettes). Parents drive the group rotation. */}
      <group ref={rig?.tail} position={[-0.48, 0.4 + L, 0]} rotation={[0, 0, 0.9]}>
        <mesh position={[-0.16, 0.16, 0]} rotation={[0, 0, 0.9]}>
          <capsuleGeometry args={[0.055, 0.42, 4, 10]} />
          <meshToonMaterial color={p.ink} gradientMap={ramp} />
        </mesh>
        <mesh position={[-0.35, 0.33, 0]} rotation={[0, 0, 0.9]}>
          <capsuleGeometry args={[0.048, 0.1, 4, 10]} />
          <meshToonMaterial color={sil ? p.ink : p.accent} gradientMap={ramp} />
        </mesh>
      </group>
    </group>
  );
}

/* -------------------------------------------------------------- export -- */

export default function CatModel({ pose, mode, palette = HARLEY, rig }: CatModelProps) {
  return mode === "flat" ? (
    <FlatCat def={FLAT_POSES[pose]} p={palette} rig={rig} />
  ) : (
    <ToonCat def={TOON_POSES[pose]} p={palette} rig={rig} />
  );
}
