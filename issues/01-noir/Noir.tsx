"use client";

import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { InstancedMesh, Object3D, type Group } from "three";
import CatModel, { HARLEY } from "@/components/CatModel";
import { ArtPanel } from "../04-origin/Origin";
import { colorWindow, setSpotRect, spotRect } from "@/shaders/colorWindow";
import { toonRamp } from "@/lib/toon";
import { stepTime } from "@/lib/steppedClock";
import { useScrollStore } from "@/lib/scrollStore";
import { clamp01, lerp } from "@/lib/shots";
import { sayWord } from "@/lib/onomatopoeia";
import { lettering } from "@/lib/content";
import { issueCenter } from "../timeline";
import { NOIR_SHOTS, NOIR_WINDOW } from "./shots";

/**
 * ISSUE 1 -- NOIR (S0 Phase 1). Pure B&W hatched-ink street world (recipe 1
 * carries mono + crosshatch); rain is an InstancedMesh of white dashes on
 * stepped time; ONE window prints in full CMYK via the shaders/colorWindow
 * rect, and the Harley cat carries its golden-tabby color through the
 * tracking spot rect (user override 2026-07-03) -- everything else stays
 * mono. All scroll-driven motion (the cat walk / trot / leap) is a pure
 * function of t read via getState() (S2.2).
 */

// S0.4 row 1 palette + working grays (post drives the final ink look)
const PAPER = "#0E0E10";
const INK = "#F5F1E8";
const AMBER = "#FFB347"; // PINK/TEAL accents now live in the baked art
const WALL = "#23232A";
const WALL_DARK = "#17171C";
const GLASS_DARK = "#060609";
const STREET = "#101014";
const RAIL = "#3A3A44";

const S3 = NOIR_SHOTS[2]!.range;
const S4 = NOIR_SHOTS[3]!.range;
const shotP = (t: number, r: [number, number]) => clamp01((t - r[0]) / (r[1] - r[0]));

const frac = (x: number) => x - Math.floor(x);
const hash = (i: number, k: number) => frac(Math.sin((i + 1) * k) * 43758.5453);

/* ---------------------------------------------------------------- rain -- */

const RAIN = { x0: -12, x1: 14, y0: -2, y1: 24, z0: -9, z1: 12, speed: 16 };
const RAIN_H = RAIN.y1 - RAIN.y0;

function Rain({ count }: { count: number }) {
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const lastStep = useRef(-1);

  useFrame(({ clock }) => {
    const m = mesh.current;
    if (!m) return;
    const st = stepTime(clock.elapsedTime, 12); // S2.8 chunky comic rain
    if (st === lastStep.current) return;
    lastStep.current = st;
    for (let i = 0; i < count; i++) {
      const sx = hash(i, 12.9898);
      const sy = hash(i, 78.233);
      const sz = hash(i, 39.425);
      dummy.position.set(
        RAIN.x0 + sx * (RAIN.x1 - RAIN.x0),
        RAIN.y1 - ((sy * RAIN_H + st * RAIN.speed) % RAIN_H),
        RAIN.z0 + sz * (RAIN.z1 - RAIN.z0),
      );
      dummy.rotation.set(0, 0, 0.07);
      dummy.scale.set(1, 0.7 + sx * 0.6, 1);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix); // every instance set, every step
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} frustumCulled={false}>
      <boxGeometry args={[0.025, 0.55, 0.025]} />
      <meshBasicMaterial color={INK} />
    </instancedMesh>
  );
}

/* -------------------------------------------------------------- facade -- */

const GRID_COLS = [-9.5, -6, -2.5, 2.5, 6.5, 10];
const GRID_ROWS = [2.5, 6.5, 10.5, 14.5, 18.5, 22.5];
// every cell except THE window's slot
const GRID_CELLS: [number, number][] = GRID_COLS.flatMap((x) =>
  GRID_ROWS.filter((y) => !(x === NOIR_WINDOW.x && y === NOIR_WINDOW.y)).map(
    (y) => [x, y] as [number, number],
  ),
);

function DarkWindows() {
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    GRID_CELLS.forEach(([x, y], i) => {
      dummy.position.set(x, y, -7.88);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [dummy]);
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, GRID_CELLS.length]}>
      <boxGeometry args={[1.6, 2.0, 0.1]} />
      <meshToonMaterial color={GLASS_DARK} gradientMap={toonRamp()} />
    </instancedMesh>
  );
}

function Facade() {
  const ramp = toonRamp();
  return (
    <group>
      <mesh position={[1, 13, -8.2]}>
        <boxGeometry args={[26, 30, 0.4]} />
        <meshToonMaterial color={WALL} gradientMap={ramp} />
      </mesh>
      <DarkWindows />
      {/* ledges + roofline give the ink-edge pass long horizontals */}
      <mesh position={[1, 4.5, -7.75]}>
        <boxGeometry args={[26, 0.25, 0.5]} />
        <meshToonMaterial color={WALL_DARK} gradientMap={ramp} />
      </mesh>
      <mesh position={[1, 12.6, -7.75]}>
        <boxGeometry args={[26, 0.25, 0.5]} />
        <meshToonMaterial color={WALL_DARK} gradientMap={ramp} />
      </mesh>
      <mesh position={[1, 28, -7.9]}>
        <boxGeometry args={[26, 0.6, 1]} />
        <meshToonMaterial color={WALL_DARK} gradientMap={ramp} />
      </mesh>
      {/* right flank building closes the street canyon */}
      <mesh position={[13.5, 8, -2]}>
        <boxGeometry args={[5, 20, 8]} />
        <meshToonMaterial color={WALL_DARK} gradientMap={ramp} />
      </mesh>
    </group>
  );
}

/* --------------------------------------------- THE window (only color) -- */

function TheWindow({ cx }: { cx: number }) {
  useEffect(() => {
    colorWindow.center = [cx + NOIR_WINDOW.x, NOIR_WINDOW.y, NOIR_WINDOW.z];
    colorWindow.halfU = [0.95, 0, 0];
    colorWindow.halfV = [0, 1.15, 0];
    colorWindow.depth = 0.6;
    colorWindow.enabled = 1;
    return () => {
      colorWindow.enabled = 0;
    };
  }, [cx]);

  return (
    <group position={[NOIR_WINDOW.x, NOIR_WINDOW.y, NOIR_WINDOW.z]}>
      {/* dark frame plane exactly covers the color rect behind the pane */}
      <mesh position={[0, 0, -0.04]}>
        <planeGeometry args={[1.9, 2.3]} />
        <meshToonMaterial color={WALL_DARK} gradientMap={toonRamp()} />
      </mesh>
      {/* interior art (user-approved, exact 4:5): amber room + backlit dev
          silhouette + pink lamp + teal monitor baked into one flat panel --
          unlit meshBasicMaterial so the colorWindow rect stays the only
          color source. Amber pane stands in while the texture loads
          (local Suspense: the rest of the set never unmounts). */}
      <Suspense
        fallback={
          <mesh>
            <planeGeometry args={[1.6, 2.0]} />
            <meshBasicMaterial color={AMBER} />
          </mesh>
        }
      >
        <ArtPanel url="/images/noir-window-figure.png" w={1.6} h={2.0} z={0} />
      </Suspense>
      {/* mullions keep it reading as a window */}
      <mesh position={[0, 0, 0.04]}>
        <boxGeometry args={[0.07, 2.0, 0.02]} />
        <meshBasicMaterial color={PAPER} />
      </mesh>
      <mesh position={[0, 0.25, 0.04]}>
        <boxGeometry args={[1.6, 0.07, 0.02]} />
        <meshBasicMaterial color={PAPER} />
      </mesh>
      {/* warm kiss on the surrounding wall (mono-safe outside the rect) */}
      <pointLight color={AMBER} intensity={6} distance={7} decay={2} position={[0, 0, 1]} />
    </group>
  );
}

/* ----------------------------------------------------------------- cat -- */

// Harley golden-tabby in the mono world (user override 2026-07-03 of the
// noir silhouette ruling): the shaders/colorWindow SPOT RECT tracks the
// active cat per frame and lifts mono+hatch only (strength 0.9) -- halftone
// and the ink line stay, so the cat keeps the print texture while the
// street around it stays pure B&W.

/** spot rect half-extents, world units, sized just past the 1.2x-scaled
 * silhouette (local build ~ x [-1.0, 0.9], y [0, 1.0], z [-0.35, 0.35]) */
const SPOT = { hu: 1.25, hv: 0.72, cy: 0.62, depthMin: 0.55, depthMax: 1.3 };
/** rect volume must never reach the facade glass (dark panes at z -7.83) */
const SPOT_Z_GUARD = -7.72;

function NoirCat({ cx }: { cx: number }) {
  const group = useRef<Group>(null);
  const walkG = useRef<Group>(null);
  const crouchG = useRef<Group>(null);
  const leapG = useRef<Group>(null);
  const walkTail = useRef<Group>(null);
  const crouchTail = useRef<Group>(null);
  const leapTail = useRef<Group>(null);
  const walkPaw = useRef<Group>(null);
  const armed = useRef(true);

  useEffect(() => {
    spotRect.enabled = 1;
    return () => {
      spotRect.enabled = 0;
    };
  }, []);

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const { t } = useScrollStore.getState(); // per-frame read, no selector
    const p3 = shotP(t, S3);
    const p4 = shotP(t, S4);
    const trot = clamp01(p4 / 0.72);
    const k = clamp01((p4 - 0.72) / 0.28); // the leap window

    // shot 3: walk in frame-left along the parapet (pure f(t))
    let x = lerp(-7.2, -1.6, p3);
    let y = 9.32;
    let z = 2.5;
    let ry = 0;
    let rz = 0;
    let squash = 1;

    if (p4 > 0) {
      // shot 4 pre-leap: trot toward the facade gap, crouch to anticipate
      x = lerp(-1.6, -0.9, trot);
      y = lerp(9.32, 9.02, clamp01(trot * 2));
      z = lerp(2.5, 0.8, trot);
      ry = lerp(0, 1.35, clamp01(trot * 4));
      squash = 1 - 0.25 * clamp01((trot - 0.75) / 0.25);
    }
    if (k > 0) {
      // the LEAP, frame-right toward the window -- the motivated cut (S5b.1).
      // Flat arc (peak y ~10.4) stays inside the 85->35mm crash frame; the
      // silhouette crosses the lit window in screen space at p~0.8 and exits
      // frame-right by p~0.93 (NDC-verified against shot-4 poseAt).
      x = lerp(-0.9, 6.2, k);
      y = lerp(9.02, 9.6, k) + 1.1 * Math.sin(Math.PI * k);
      z = lerp(0.8, -7.0, k);
      ry = lerp(1.35, 0.85, k);
      rz = lerp(0.55, -0.35, k);
      squash = 1;
      if (armed.current) {
        armed.current = false;
        sayWord(lettering.onomatopoeia.cat, [cx + x, y + 0.7, z], 0.37, INK);
      }
    } else if (!armed.current && p4 < 0.67) {
      armed.current = true; // hysteresis re-arm for reverse scrollers
    }

    g.position.set(x, y, z);
    g.rotation.set(0, ry, rz);
    g.scale.set(1.2, 1.2 * squash, 1.2);

    // spot rect tracks the active cat (world coords; rect normal is +z).
    // The build faces +x, so the z half-thickness widens as ry turns the
    // body toward the facade for the leap, clamped so the volume never
    // reaches the facade glass -- by then the cat is out of frame anyway.
    const depth = Math.min(
      Math.min(SPOT.depthMin + 0.75 * Math.sin(ry), SPOT.depthMax),
      z - SPOT_Z_GUARD,
    );
    setSpotRect([cx + x, y + SPOT.cy, z], [SPOT.hu, 0, 0], [0, SPOT.hv, 0], depth, 0.9);

    // pose switch, pure f(t): walk in, crouch at the gap (squash window),
    // leap build through the k-window -- scrub-safe both directions
    const leaping = k > 0;
    const crouching = !leaping && p4 > 0 && trot >= 0.75;
    if (walkG.current) walkG.current.visible = !leaping && !crouching;
    if (crouchG.current) crouchG.current.visible = crouching;
    if (leapG.current) leapG.current.visible = leaping;
    // 12 fps tail flick -- ambient stepped-time idle (S2.8)
    const flick = Math.sin(stepTime(clock.elapsedTime, 12) * 2.4) * 0.45;
    if (walkTail.current) walkTail.current.rotation.x = flick;
    if (crouchTail.current) crouchTail.current.rotation.x = flick;
    if (leapTail.current) leapTail.current.rotation.x = flick;
    // stride swing derives from parapet x -- pure f(t), scrub-safe
    if (walkPaw.current) walkPaw.current.rotation.z = Math.sin(x * 5.2) * 0.55;
  });

  return (
    <group
      ref={group}
      position={[-7.2, 9.32, 2.5]}
      onClick={(e) => {
        e.stopPropagation();
        useScrollStore.getState().meow();
      }}
    >
      {/* shared mascot (components/CatModel v2): dimensional toon build in
          the Harley golden-tabby palette (spot rect above keeps the color
          alive inside the mono recipe), built facing +x; one instance per
          pose, visibility switched as pure f(t) above */}
      <group ref={walkG}>
        <CatModel mode="toon" pose="walking" palette={HARLEY} rig={{ tail: walkTail, paw: walkPaw }} />
      </group>
      <group ref={crouchG} visible={false}>
        <CatModel mode="toon" pose="crouch" palette={HARLEY} rig={{ tail: crouchTail }} />
      </group>
      <group ref={leapG} visible={false}>
        <CatModel mode="toon" pose="leaping" palette={HARLEY} rig={{ tail: leapTail }} />
      </group>
    </group>
  );
}

/* ------------------------------------------------------- street + set -- */

function StreetLevel() {
  const ramp = toonRamp();
  const posts = [-7, -5, -3, -1, 1, 3, 5];
  return (
    <group>
      <mesh position={[1, -2, 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[34, 26]} />
        <meshToonMaterial color={STREET} gradientMap={ramp} />
      </mesh>
      <mesh position={[0, -1.83, 9.9]}>
        <boxGeometry args={[22, 0.35, 1.4]} />
        <meshToonMaterial color={WALL_DARK} gradientMap={ramp} />
      </mesh>
      {/* FG railing for the street hold */}
      {posts.map((x) => (
        <mesh key={x} position={[x, -1.42, 9.2]}>
          <cylinderGeometry args={[0.045, 0.045, 1.15, 8]} />
          <meshToonMaterial color={RAIL} gradientMap={ramp} />
        </mesh>
      ))}
      <mesh position={[-1, -0.92, 9.2]}>
        <boxGeometry args={[12.6, 0.08, 0.08]} />
        <meshToonMaterial color={RAIL} gradientMap={ramp} />
      </mesh>
      <mesh position={[-1, -1.28, 9.2]}>
        <boxGeometry args={[12.6, 0.08, 0.08]} />
        <meshToonMaterial color={RAIL} gradientMap={ramp} />
      </mesh>
      {/* dead lamppost, MG depth cue */}
      <mesh position={[4.2, -0.2, 4]}>
        <cylinderGeometry args={[0.08, 0.1, 3.6, 10]} />
        <meshToonMaterial color={RAIL} gradientMap={ramp} />
      </mesh>
      <mesh position={[4.2, 1.7, 4]}>
        <boxGeometry args={[0.5, 0.18, 0.25]} />
        <meshToonMaterial color={RAIL} gradientMap={ramp} />
      </mesh>
    </group>
  );
}

function FgRoof() {
  const ramp = toonRamp();
  return (
    <group>
      {/* foreground rooftop building the cat crosses (shots 3-4) */}
      <mesh position={[-5.75, 3.5, 0]}>
        <boxGeometry args={[10.5, 11, 6]} />
        <meshToonMaterial color={WALL_DARK} gradientMap={ramp} />
      </mesh>
      <mesh position={[-5.75, 9.15, 2.5]}>
        <boxGeometry args={[10.5, 0.35, 0.5]} />
        <meshToonMaterial color={WALL} gradientMap={ramp} />
      </mesh>
      {/* rooftop clutter: vent box + pipe for the edge pass */}
      <mesh position={[-8.5, 9.5, -0.8]}>
        <boxGeometry args={[1.4, 1.0, 1.1]} />
        <meshToonMaterial color={WALL} gradientMap={ramp} />
      </mesh>
      <mesh position={[-3.4, 9.6, -1.6]}>
        <cylinderGeometry args={[0.22, 0.22, 1.2, 10]} />
        <meshToonMaterial color={WALL} gradientMap={ramp} />
      </mesh>
    </group>
  );
}

/* ----------------------------------------------------------- assembly -- */

export default function Noir({ index }: { index: number }) {
  const quality = useScrollStore((s) => s.quality); // mount-time, not per-frame
  const [cx] = issueCenter(index);
  const rainCount = quality === "low" ? 220 : 460;

  return (
    <group name="issue-noir" position={issueCenter(index)}>
      {/* own lights (S2.5): cold key + dim city ambient, no shadows */}
      <ambientLight intensity={0.5} color="#4A5060" />
      <directionalLight position={[-6, 14, 8]} intensity={1.3} color="#C9D2E0" />
      <Facade />
      <FgRoof />
      <StreetLevel />
      <TheWindow cx={cx} />
      <NoirCat cx={cx} />
      <Rain key={rainCount} count={rainCount} />
    </group>
  );
}
