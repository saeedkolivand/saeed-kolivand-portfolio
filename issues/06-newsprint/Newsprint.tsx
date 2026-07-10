"use client";

import { Suspense, useEffect, useLayoutEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { Color, Object3D, type Group, type InstancedMesh } from "three";
import IssueShell from "../_IssueShell";
import { ISSUES } from "../registry";
import { ArtPanel } from "../04-origin/Origin";
import { toonRamp } from "@/lib/toon";
import { stepTime } from "@/lib/steppedClock";
import { useScrollStore } from "@/lib/scrollStore";
import { sayWord } from "@/lib/onomatopoeia";
import { uiSound } from "@/lib/audio/ui";
import { issueCopy, lettering, links } from "@/lib/content";
import { colorWindow } from "@/shaders/colorWindow";
import { issueCenter } from "../timeline";
import { NEWS_FLOOD_POP, NEWS_PANEL_POS, NEWS_TICKER_Y, NEWS_TICKER_Z, newsFlood } from "./shots";

/**
 * Issue 6 NEWSPRINT (S0.3 range [0.488, 0.566], palette S0.4 row 6).
 * The reader walks INSIDE the front page: paper floor with column rules,
 * standing headline sheets with greeked body columns, procedural halftone
 * "photos" (the global recipe prints the dots), a commit-graph stock ticker
 * on posts, and the framed FRONT-PAGE STORY panel -- AI Job Hunter.
 *
 * JAW-DROP: the panel floods to full color as the camera approaches --
 * recipe mono 1 + the Phase 1 colorWindow depth-mask channel
 * (shaders/colorWindow.ts, zero RTs); enabled is pure f(t) via newsFlood().
 * GitHub + live-demo buttons live IN the panel (diegetic, S5b.5) and open
 * their links.* URLs in a new tab; empty URLs hide the button (S0.5).
 *
 * All copy is issueCopy.newsprint / content flagship fields -- never
 * invented strings. Ticker crawl is STEPPED (stepTime, house "on 2s"),
 * frozen under reduced motion. Everything scroll-driven is pure f(t).
 */

// ---- palette: S0.4 row 6 + tone steps + Noir-precedent working grays --------
const PAPER = "#EAE3D2";
const INK = "#221F1A";
const RED = "#C63D2F"; // spot red
const SHEET = "#F1EBDB"; // paper +3% (standing pages)
const RULE = "#C9C1AC"; // paper -9% (column rules, posts)
const GREEK = "#7E786C"; // working gray -- greeked body text (Noir precedent)
const INK_SOFT = "#38342C"; // ink +8% (bezels, app mock bg)
// full-color panel interior: locked S0.4 hexes only (desk/cover accents)
const TEAL = "#2BB3A3";
const AMBER = "#F5A623";
const CORAL = "#E2574C";
const BANGERS = "/fonts/Bangers-Regular.ttf";

const COPY = issueCopy.newsprint;

// ---- shared scratch (zero per-frame allocation) -----------------------------
const tmpO = new Object3D();
const tmpC = new Color();

const hash = (i: number, n: number) => {
  const x = Math.sin((i + 1) * n) * 43758.5453;
  return x - Math.floor(x);
};

/* ------------------------------------------- greeked print, one instanced -- */
// Every flat printed bar on the page (floor column rules, headline rules,
// greeked body-text columns, incl. the rotated SH3 sheet) -- ONE InstancedMesh.
interface Bar {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  c: string;
  ry: number;
}

const BARS: Bar[] = [];
const bar = (x: number, y: number, z: number, w: number, h: number, c: string, d = 0.06, ry = 0) =>
  BARS.push({ x, y, z, w, h, d, c, ry });

// floor column rules (the ground IS the page)
for (let i = 0; i < 7; i++) bar(-18 + i * 5.4, 0.03, -1, 0.16, 0.05, RULE, 22);

// headline sheet: rule under the head + 3 greeked columns
bar(-10, 5.35, -2.1, 13.5, 0.14, INK);
for (let c = 0; c < 3; c++)
  for (let r = 0; r < 9; r++) {
    const w = 3.6 * (r === 8 ? 0.55 : 0.72 + 0.28 * hash(c * 9 + r, 4.73));
    bar(-14.2 + c * 4.2 - (3.6 - w) / 2, 4.6 - r * 0.4, -2.1, w, 0.16, GREEK);
  }

// back-wall page: rule + 4 greeked columns (photo plate sits to their right)
bar(-9, 9.7, -9.2, 18, 0.16, INK);
for (let c = 0; c < 4; c++)
  for (let r = 0; r < 8; r++) {
    const w = 4.2 * (r === 7 ? 0.6 : 0.7 + 0.3 * hash(40 + c * 8 + r, 6.19));
    bar(-16.5 + c * 5 - (4.2 - w) / 2, 8.6 - r * 0.48, -9.2, w, 0.2, GREEK);
  }

// SH2 sheet greek (facing +z; sheets sit LOW so the shot-2 band corridor
// stays clear -- iter 2)
for (let r = 0; r < 6; r++)
  bar(1.5, 2.2 - r * 0.3, -3.2, 5.6 * (r === 5 ? 0.5 : 0.75 + 0.25 * hash(80 + r, 3.37)), 0.14, GREEK);

// SH3 sheet greek (sheet rotated ry -0.3; bars rotated about the sheet plane)
const SH3: [number, number, number] = [8.2, 2.0, 1.2];
const SH3_RY = -0.3;
for (let r = 0; r < 6; r++) {
  const w = 5.2 * (r === 5 ? 0.5 : 0.75 + 0.25 * hash(90 + r, 8.11));
  // bar center sits on the sheet face (+0.2 along the rotated normal)
  bar(
    SH3[0] + 0.2 * Math.sin(SH3_RY),
    1.5 - r * 0.3,
    SH3[2] + 0.2 * Math.cos(SH3_RY),
    w,
    0.14,
    GREEK,
    0.06,
    SH3_RY,
  );
}

function InkBars() {
  const inst = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const m = inst.current;
    if (!m) return;
    BARS.forEach((b, i) => {
      tmpO.position.set(b.x, b.y, b.z);
      tmpO.rotation.set(0, b.ry, 0);
      tmpO.scale.set(b.w, b.h, b.d);
      tmpO.updateMatrix();
      m.setMatrixAt(i, tmpO.matrix);
      m.setColorAt(i, tmpC.set(b.c)); // every instance -- unset renders WHITE
    });
    m.instanceMatrix.needsUpdate = true;
    m.instanceColor!.needsUpdate = true;
  }, []);

  return (
    <instancedMesh ref={inst} args={[undefined, undefined, BARS.length]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#FFFFFF" />
    </instancedMesh>
  );
}

/* ---------------------------------------------- halftone "photo" plates ---- */
// procedural gray dioramas in ink frames; the recipe's dots do the printing
function PhotoFrame({ w, h }: { w: number; h: number }) {
  return (
    <>
      <mesh position={[0, 0, -0.02]}>
        <boxGeometry args={[w + 0.4, h + 0.4, 0.12]} />
        <meshBasicMaterial color={INK} />
      </mesh>
      <mesh>
        <boxGeometry args={[w, h, 0.12]} />
        <meshBasicMaterial color={SHEET} />
      </mesh>
    </>
  );
}

const SKYLINE = [
  { x: -2.2, w: 0.9, h: 2.2, c: "#555046" },
  { x: -1.1, w: 1.0, h: 3.1, c: "#6B6559" },
  { x: 0.1, w: 0.8, h: 1.7, c: "#8A8375" },
  { x: 1.0, w: 0.9, h: 2.7, c: "#555046" },
  { x: 2.1, w: 0.8, h: 2.0, c: "#6B6559" },
];

function WallPhoto() {
  return (
    <group position={[5.5, 5.2, -9.1]}>
      <PhotoFrame w={6} h={5} />
      {SKYLINE.map((b, i) => (
        <mesh key={i} position={[b.x, -2.3 + b.h / 2, 0.1]}>
          <boxGeometry args={[b.w, b.h, 0.06]} />
          <meshBasicMaterial color={b.c} />
        </mesh>
      ))}
    </group>
  );
}

// the cat cameo: a mounted halftone press photo (user-approved Harley art),
// photo-corner mounts, newspaper cutline plate below, click = meow.
// ArtPanel's aspect crop centers the square plate on the portrait frame
// (~7% width trimmed per side; the keyboard bleeding off IS photo language).
// z 0.075: above the SHEET plate face (0.06), under the corner mounts (0.09).
function CatPhoto() {
  return (
    <group
      position={[5.9, 5.05, -4.55]}
      onClick={(e) => {
        e.stopPropagation();
        useScrollStore.getState().meow();
        sayWord(lettering.onomatopoeia.cat, [issueCenter(6)[0] + 5.9, 7.7, -4], undefined, INK);
      }}
    >
      <PhotoFrame w={3.05} h={3.55} />
      <Suspense fallback={null}>
        <ArtPanel url="/images/newsprint-harley-photo.png" w={3.05} h={3.55} z={0.075} />
      </Suspense>
      {[
        [-1.35, 1.6],
        [1.35, 1.6],
        [-1.35, -1.6],
        [1.35, -1.6],
      ].map(([x, y], i) => (
        <mesh key={i} position={[x!, y!, 0.09]} rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[0.55, 0.55, 0.05]} />
          <meshBasicMaterial color={INK} />
        </mesh>
      ))}
      {/* press-photo cutline (user-approved scene lettering): a pasted slip
          over the plate's bottom-right corner -- the only band of the plate
          the FG sheets never occlude across the shot-2 pass (a full-width
          strip under the frame always lost "HARLEY" behind a sheet edge).
          Three short lines keep it readable at the pass framings; single
          crisp Text layers (S2.16). The corner mount pins the slip. */}
      <group position={[0.55, -1.2, 0]} rotation={[0, 0, -0.04]}>
        <mesh position={[0, 0, 0.082]}>
          <planeGeometry args={[1.81, 1.06]} />
          <meshBasicMaterial color={INK} />
        </mesh>
        <mesh position={[0, 0, 0.084]}>
          <planeGeometry args={[1.75, 1.0]} />
          <meshBasicMaterial color={SHEET} />
        </mesh>
        <Suspense fallback={null}>
          {(["HARLEY.", "EDITOR-AT-LARGE.", "UNPAID."] as const).map((line, i) => (
            <Text
              key={line}
              position={[0, 0.29 - i * 0.29, 0.088]}
              font={BANGERS}
              fontSize={0.2}
              color={INK}
              anchorX="center"
              anchorY="middle"
            >
              {line}
            </Text>
          ))}
        </Suspense>
      </group>
    </group>
  );
}

/* ------------------------------------- the stock ticker (stepped crawl) ---- */
const TICKER = COPY.ticker;
const PITCH = 13;
const TRAIN = TICKER.length * PITCH;
// per-item half-width estimate (Bangers ~0.42em advance, fontSize 0.5)
const HALF_W = TICKER.map((w) => w.length * 0.105);

function TickerItems() {
  const items = useRef<(Group | null)[]>([]);

  useFrame(({ clock }) => {
    const { quality, reducedMotion } = useScrollStore.getState();
    const fps = quality === "low" ? 8 : 12;
    const st = reducedMotion ? 0 : stepTime(clock.elapsedTime, fps);
    const off = st * 2.4;
    for (let i = 0; i < TICKER.length; i++) {
      const g = items.current[i];
      if (!g) continue;
      const x = ((((i * PITCH - off) % TRAIN) + TRAIN) % TRAIN) - TRAIN / 2;
      g.position.x = x;
      // items stamp in/out whole behind the end bezels (no clip shader)
      g.visible = Math.abs(x) < 26 - HALF_W[i]!;
    }
  });

  return (
    <group position={[0, NEWS_TICKER_Y - 0.34, NEWS_TICKER_Z + 0.32]}>
      {TICKER.map((w, i) => (
        <group
          key={w}
          ref={(el) => {
            items.current[i] = el;
          }}
        >
          <Text font={BANGERS} fontSize={0.5} color={PAPER} anchorX="center" anchorY="middle">
            {w}
          </Text>
        </group>
      ))}
    </group>
  );
}

// static commit-graph polyline on the band's upper face (the "stock chart")
const GPTS: [number, number][] = [];
{
  let gy = 0;
  for (let i = 0; i < 23; i++) {
    gy = Math.min(0.5, Math.max(-0.42, gy + (hash(i, 7.31) - 0.45) * 0.5));
    GPTS.push([-23 + i * (46 / 22), gy]);
  }
}
const GSEG_N = GPTS.length - 1;

function CommitGraph() {
  const inst = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const m = inst.current;
    if (!m) return;
    for (let i = 0; i < GSEG_N; i++) {
      const [ax, ay] = GPTS[i]!;
      const [bx, by] = GPTS[i + 1]!;
      tmpO.position.set((ax + bx) / 2, (ay + by) / 2, 0);
      tmpO.rotation.set(0, 0, Math.atan2(by - ay, bx - ax));
      tmpO.scale.set(Math.hypot(bx - ax, by - ay), 0.09, 0.05);
      tmpO.updateMatrix();
      m.setMatrixAt(i, tmpO.matrix);
      m.setColorAt(i, tmpC.set(PAPER)); // every instance
    }
    m.instanceMatrix.needsUpdate = true;
    m.instanceColor!.needsUpdate = true;
  }, []);

  return (
    <instancedMesh
      ref={inst}
      args={[undefined, undefined, GSEG_N]}
      position={[0, NEWS_TICKER_Y + 0.42, NEWS_TICKER_Z + 0.32]}
      frustumCulled={false}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#FFFFFF" />
    </instancedMesh>
  );
}

function TickerBand() {
  const grad = toonRamp();
  return (
    <group>
      <mesh position={[0, NEWS_TICKER_Y, NEWS_TICKER_Z]}>
        <boxGeometry args={[52, 1.8, 0.5]} />
        <meshBasicMaterial color={INK} />
      </mesh>
      {/* end bezels: the crawl stamps in/out behind these */}
      {[-25, 25].map((x) => (
        <mesh key={x} position={[x, NEWS_TICKER_Y, NEWS_TICKER_Z + 0.55]}>
          <boxGeometry args={[2.4, 2.4, 1.2]} />
          <meshToonMaterial color={INK_SOFT} gradientMap={grad} />
        </mesh>
      ))}
      {/* support posts down to the page floor */}
      {[-24, 24].map((x) => (
        <mesh key={x} position={[x, NEWS_TICKER_Y / 2 - 0.5, NEWS_TICKER_Z]}>
          <boxGeometry args={[0.5, NEWS_TICKER_Y - 1, 0.5]} />
          <meshToonMaterial color={RULE} gradientMap={grad} />
        </mesh>
      ))}
      <CommitGraph />
      <Suspense fallback={null}>
        <TickerItems />
      </Suspense>
    </group>
  );
}

/* ------------------------------ the front-page story panel (the flood) ---- */
function PanelButton({ x, label, url }: { x: number; label: string; url: string }) {
  const grp = useRef<Group>(null);
  const hovered = useRef(false);

  useFrame(() => {
    // comic snap, no easing: hover pop is a single step
    grp.current?.scale.setScalar(hovered.current ? 1.07 : 1);
  });

  // never leave a stuck pointer cursor behind on unmount
  useEffect(
    () => () => {
      document.body.style.cursor = "";
    },
    [],
  );

  return (
    <group
      ref={grp}
      position={[x, -3.5, 0.45]}
      onClick={(e) => {
        e.stopPropagation();
        uiSound("linkPress"); // both GITHUB and WEBSITE plates
        window.open(url, "_blank", "noopener,noreferrer");
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        if (!hovered.current) uiSound("hover"); // tick on false -> true only
        hovered.current = true;
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        hovered.current = false;
        document.body.style.cursor = "";
      }}
    >
      <mesh>
        <boxGeometry args={[3.4, 0.95, 0.3]} />
        <meshBasicMaterial color={RED} />
      </mesh>
      {/* pressed-paper shadow line under the plate */}
      <mesh position={[0.08, -0.55, -0.08]}>
        <boxGeometry args={[3.4, 0.14, 0.1]} />
        <meshBasicMaterial color={INK} />
      </mesh>
      <Text position={[0, 0, 0.18]} font={BANGERS} fontSize={0.44} color={PAPER} anchorX="center" anchorY="middle">
        {label}
      </Text>
    </group>
  );
}

const JOB_ROWS = [1.05, 0.35, -0.35, -1.05];

function FrontPage() {
  const panel = useRef<Group>(null);
  const [px, py, pz] = NEWS_PANEL_POS;
  const [cx] = issueCenter(6);

  // the colorWindow rect: covers the framed panel, world-space (S2.16-safe
  // depth mask, zero RTs). enabled is written per-frame below (pure f(t)).
  useEffect(() => {
    colorWindow.center = [cx + px, py, pz + 0.45];
    colorWindow.halfU = [4.9, 0, 0];
    colorWindow.halfV = [0, 5.35, 0];
    colorWindow.depth = 1.2;
    return () => {
      colorWindow.enabled = 0;
    };
  }, [cx, px, py, pz]);

  useFrame(() => {
    const { t } = useScrollStore.getState();
    colorWindow.enabled = newsFlood(t); // scrub-safe flood, both directions
    const g = panel.current;
    if (g) {
      const v = NEWS_FLOOD_POP.v; // authored-time squash (beat engine)
      g.scale.set(1 + 0.05 * v, 1 - 0.04 * v, 1);
    }
  });

  return (
    <group ref={panel} position={[px, py, pz]}>
      {/* backing sheet + ink frame */}
      <mesh>
        <boxGeometry args={[9.2, 10, 0.3]} />
        <meshBasicMaterial color={SHEET} />
      </mesh>
      {[
        [0, 5.1, 9.8, 0.4],
        [0, -5.1, 9.8, 0.4],
      ].map(([x, y, w, h], i) => (
        <mesh key={`h${i}`} position={[x!, y!, 0.1]}>
          <boxGeometry args={[w, h, 0.45]} />
          <meshBasicMaterial color={INK} />
        </mesh>
      ))}
      {[-4.7, 4.7].map((x) => (
        <mesh key={`v${x}`} position={[x, 0, 0.1]}>
          <boxGeometry args={[0.4, 10.6, 0.45]} />
          <meshBasicMaterial color={INK} />
        </mesh>
      ))}

      {/* story banner: spot red + flagship title (locked content) */}
      <mesh position={[0, 3.55, 0.25]}>
        <boxGeometry args={[8.2, 1.15, 0.2]} />
        <meshBasicMaterial color={RED} />
      </mesh>

      {/* the "photo": full-color app mock -- gray until the flood arrives */}
      <group position={[0, 0.75, 0.25]}>
        <mesh>
          <boxGeometry args={[7.6, 4.3, 0.15]} />
          <meshBasicMaterial color={INK_SOFT} />
        </mesh>
        <mesh position={[0, 1.9, 0.09]}>
          <boxGeometry args={[7.6, 0.55, 0.06]} />
          <meshBasicMaterial color={TEAL} />
        </mesh>
        <mesh position={[-2.7, -0.25, 0.09]}>
          <boxGeometry args={[1.8, 3.4, 0.06]} />
          <meshBasicMaterial color={AMBER} />
        </mesh>
        {JOB_ROWS.map((y) => (
          <mesh key={y} position={[0.75, y, 0.09]}>
            <boxGeometry args={[4.9, 0.6, 0.06]} />
            <meshBasicMaterial color={PAPER} />
          </mesh>
        ))}
        <mesh position={[2.6, JOB_ROWS[0]!, 0.14]}>
          <boxGeometry args={[0.7, 0.4, 0.06]} />
          <meshBasicMaterial color={CORAL} />
        </mesh>
      </group>

      <Suspense fallback={null}>
        <Text
          position={[0, 3.55, 0.42]}
          font={BANGERS}
          fontSize={0.7}
          color={PAPER}
          anchorX="center"
          anchorY="middle"
        >
          {COPY.frontPageStory}
        </Text>
        <Text
          position={[0, -2.05, 0.3]}
          font={BANGERS}
          fontSize={0.27}
          color={INK}
          anchorX="center"
          anchorY="middle"
          maxWidth={8.2}
          textAlign="center"
          lineHeight={1.25}
        >
          {COPY.frontPageBlurb}
        </Text>
        {/* diegetic S5b.5: the links live IN the panel; empty URL hides (S0.5) */}
        {links.flagshipRepoUrl ? (
          <PanelButton x={-2.15} label="GITHUB" url={links.flagshipRepoUrl} />
        ) : null}
        {links.liveDemoUrl ? (
          <PanelButton x={2.15} label="WEBSITE" url={links.liveDemoUrl} />
        ) : null}
      </Suspense>
    </group>
  );
}

/* ----------------------------------------------------------- the set ------ */
export default function Newsprint({ index }: { index: number }) {
  const issue = ISSUES[index]!;
  const grad = toonRamp();

  return (
    <IssueShell index={index} issue={issue}>
      {/* the page floor */}
      <mesh position={[-2, -0.2, -1]}>
        <boxGeometry args={[60, 0.4, 26]} />
        <meshToonMaterial color={PAPER} gradientMap={grad} />
      </mesh>

      {/* standing sheets: headline, SH2, SH3 (angled toward the panel) */}
      <mesh position={[-10, 4.5, -2.3]}>
        <boxGeometry args={[16, 9, 0.35]} />
        <meshToonMaterial color={SHEET} gradientMap={grad} />
      </mesh>
      <mesh position={[1.5, 1.9, -3.5]}>
        <boxGeometry args={[7.5, 5.6, 0.3]} />
        <meshToonMaterial color={SHEET} gradientMap={grad} />
      </mesh>
      <group position={SH3} rotation={[0, SH3_RY, 0]}>
        <mesh>
          <boxGeometry args={[6.5, 6, 0.3]} />
          <meshToonMaterial color={SHEET} gradientMap={grad} />
        </mesh>
      </group>

      {/* back-wall page */}
      <mesh position={[-2, 6.5, -9.5]}>
        <boxGeometry args={[40, 13, 0.5]} />
        <meshToonMaterial color={SHEET} gradientMap={grad} />
      </mesh>

      <InkBars />
      <WallPhoto />
      <TickerBand />
      <FrontPage />

      <Suspense fallback={null}>
        {/* headline + secondaries: issueCopy.newsprint, locked strings */}
        <Text
          position={[-10, 6.4, -2.05]}
          font={BANGERS}
          fontSize={1.55}
          color={INK}
          anchorX="center"
          anchorY="middle"
          maxWidth={15}
          textAlign="center"
        >
          {COPY.headline}
        </Text>
        <Text
          position={[-9, 10.6, -9.15]}
          font={BANGERS}
          fontSize={1.0}
          color={INK}
          anchorX="center"
          anchorY="middle"
          maxWidth={30}
          textAlign="center"
        >
          {COPY.secondaryHeadlines[0]}
        </Text>
        <Text
          position={[1.5, 4.15, -3.28]}
          font={BANGERS}
          fontSize={0.55}
          color={INK}
          anchorX="center"
          anchorY="top"
          maxWidth={6.8}
          textAlign="center"
          lineHeight={1.15}
        >
          {COPY.secondaryHeadlines[1]}
        </Text>
        <group position={SH3} rotation={[0, SH3_RY, 0]}>
          <Text
            position={[0, 2.6, 0.22]}
            font={BANGERS}
            fontSize={0.42}
            color={INK}
            anchorX="center"
            anchorY="top"
            maxWidth={5.2}
            textAlign="center"
            lineHeight={1.15}
          >
            {COPY.secondaryHeadlines[2]}
          </Text>
        </group>
        <CatPhoto />
      </Suspense>
    </IssueShell>
  );
}
