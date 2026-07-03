"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import type {
  Group,
  Mesh,
  MeshBasicMaterial,
  WebGLProgramParametersWithUniforms,
} from "three";
import IssueShell from "../_IssueShell";
import { ISSUES } from "../registry";
import { issueCenter } from "../timeline";
import { ArtPanel } from "../04-origin/Origin";
import CatModel, { HARLEY } from "@/components/CatModel";
import { spotRect, setSpotRect } from "@/shaders/colorWindow";
import { toonRamp } from "@/lib/toon";
import { stepTime } from "@/lib/steppedClock";
import { useScrollStore } from "@/lib/scrollStore";
import { snapshots } from "@/lib/snapshots";
import { popScale } from "@/lib/pops";
import { clamp01, lerp } from "@/lib/shots";
import { issueCopy, projects } from "@/lib/content";
import {
  AMBER,
  BACK_COVER_POP,
  CASE,
  catWalk,
  dropPool,
  INK,
  panelPool,
  PAPER,
  RESUME_DROP_POS,
  runCommand,
  SCREEN,
  VISIBLE_COMMANDS,
} from "./shots";

/**
 * Issue 11 TERMINAL / LETTERS PAGE (S0.3 range [0.940, 1.000], palette S0.4
 * row 11). The back cover: a CRT terminal desk printed ON the closing page.
 * "hello visitor_" prompt with a blinking block cursor; REAL keyboard input
 * while the issue is active plus 8 clickable command cards (S5b.5 -- the
 * touch path). Locked commands pop pooled floating response panels
 * (lib/pops.ts squash-and-stretch); github/linkedin ALSO open their real
 * pages and the projects panel grows per-row [open] tabs (rulings in
 * ./shots.md); resume drops an amber sheet into a receding Issue-2 desk
 * snapshot window (S2.11 callback, zero live RTs). Finale: NEXT ISSUE card
 * + barcode gag + the cat walking off-panel. All scroll motion pure f(t).
 */

const BANGERS = "/fonts/Bangers-Regular.ttf";
/** S0.4 type table (shared drop, held for registry go -- see shots.md) */
const MONO = "/fonts/JetBrainsMono-Regular.ttf";

// Sit cat prints the FULL Harley palette (user feedback 2026-07-03): the
// shaders/colorWindow SPOT RECT tracks it per frame and lifts mono only
// (strength 0.8), so the golden tabby survives the green duotone while
// halftone + ink line keep it in the CRT print world (Noir precedent).
// The walk-off plate stays baked green phosphor art -- rect off there.

type TText = Mesh & { text: string; sync: () => void; fillOpacity: number; color: string };

// ---- shared terminal line state (module scope; imperative, no re-renders) ---
// gen bumps on every edit so the screen syncs its troika Text lazily.
const term = { buf: "", gen: 0, errAt: -1e9 };

const GREETING = "hello visitor"; // SPEC literal "hello visitor_": the block cursor IS the underscore
const PROMPT = "> ";
const FS = 0.34; // screen font size
const ADV = FS * 0.6; // JetBrains Mono advance is exactly 0.6 em
const TEXT_X = -2.55;
const GREET_Y = 1.15;
const INPUT_Y = 0.55;

/* ---------------- keyboard (active ONLY while Issue 11 is active) ---------- */

function onKey(e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey || e.altKey) return; // never capture combos
  const ae = document.activeElement as HTMLElement | null;
  if (ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.isContentEditable)) return;
  if (e.key === "Enter") {
    const cmd = term.buf.trim();
    term.buf = "";
    term.gen++;
    if (cmd !== "" && !runCommand(cmd)) term.errAt = performance.now();
    return;
  }
  if (e.key === "Backspace") {
    e.preventDefault();
    term.buf = term.buf.slice(0, -1);
    term.gen++;
    return;
  }
  if (e.key === "Escape") {
    term.buf = "";
    term.gen++;
    return;
  }
  if (e.key.length === 1 && /[a-z0-9-]/i.test(e.key) && term.buf.length < 14) {
    term.buf += e.key.toLowerCase();
    term.gen++;
  }
}

/** attach/detach the window listener as activeIssue enters/leaves 11 */
function useTerminalKeyboard() {
  useEffect(() => {
    let attached = false;
    const sync = (active: number) => {
      if (active === 11 && !attached) {
        window.addEventListener("keydown", onKey);
        attached = true;
      } else if (active !== 11 && attached) {
        window.removeEventListener("keydown", onKey);
        attached = false;
        term.buf = "";
        term.gen++;
      }
    };
    sync(useScrollStore.getState().activeIssue);
    const unsub = useScrollStore.subscribe((s) => sync(s.activeIssue));
    return () => {
      unsub();
      if (attached) window.removeEventListener("keydown", onKey);
    };
  }, []);
}

/* ---------------- snapshot window (Origin.tsx precedent, S2.11) ------------ */

// snapshot frames are raw framebuffer copies -- decode sRGB manually
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

/* ---------------- the CRT screen: prompt, input, cursor, error shake ------- */

function CrtScreen() {
  const input = useRef<TText | null>(null);
  const cursor = useRef<Mesh>(null);
  const inner = useRef<Group>(null);
  const gen = useRef(-1);

  useFrame(({ clock }) => {
    const { reducedMotion, quality } = useScrollStore.getState();
    if (gen.current !== term.gen) {
      gen.current = term.gen;
      const txt = input.current;
      if (txt) {
        txt.text = PROMPT + term.buf;
        txt.sync();
      }
    }
    const c = cursor.current;
    if (c) {
      // stepped terminal blink, wall-clock idle (t-independent = scrub-safe);
      // solid under reduced motion (comfort ruling, shots.md)
      c.visible = reducedMotion || Math.floor(clock.elapsedTime / 0.53) % 2 === 0;
      const idle = term.buf.length === 0;
      const chars = idle ? GREETING.length : PROMPT.length + term.buf.length;
      c.position.x = TEXT_X + chars * ADV + ADV / 2;
      c.position.y = idle ? GREET_Y : INPUT_Y;
    }
    // unknown-command beat: the locked unknownCommand line prints in a panel
    // (runCommand) AND the screen flinches (ruling in shots.md); the shake
    // is skipped under reduced motion, the printed line is not
    const g = inner.current;
    if (g) {
      const age = (performance.now() - term.errAt) / 1000;
      const fps = quality === "low" ? 8 : 12;
      g.position.x =
        !reducedMotion && age < 0.4
          ? Math.sin(stepTime(age, fps) * 55) * 0.05 * (1 - age / 0.4)
          : 0;
    }
  });

  return (
    <group position={[0, 3.3, 0]}>
      {/* bezel + glass */}
      <mesh position={[0, 0, 1.76]}>
        <planeGeometry args={[6.4, 4.8]} />
        <meshBasicMaterial color={CASE} />
      </mesh>
      <mesh position={[0, 0, 1.77]}>
        <planeGeometry args={[5.8, 4.2]} />
        <meshBasicMaterial color={SCREEN} />
      </mesh>
      <group ref={inner}>
        <Suspense fallback={null}>
          <Text
            font={MONO}
            fontSize={FS}
            color={INK}
            anchorX="left"
            anchorY="middle"
            position={[TEXT_X, GREET_Y, 1.8]}
          >
            {GREETING}
          </Text>
          <Text
            ref={(el: unknown) => {
              input.current = el as TText | null;
            }}
            font={MONO}
            fontSize={FS}
            color={INK}
            anchorX="left"
            anchorY="middle"
            position={[TEXT_X, INPUT_Y, 1.8]}
          >
            {PROMPT}
          </Text>
        </Suspense>
        {/* the blinking block cursor -- the "_" of "hello visitor_" */}
        <mesh ref={cursor} position={[TEXT_X + GREETING.length * ADV + ADV / 2, GREET_Y, 1.81]}>
          <planeGeometry args={[0.19, 0.4]} />
          <meshBasicMaterial color={INK} />
        </mesh>
      </group>
    </group>
  );
}

/* ---------------- clickable command cards (S5b.5 diegetic touch path) ------ */

function CommandCard({ cmd, y }: { cmd: string; y: number }) {
  const label = useRef<TText | null>(null);
  return (
    <group position={[0, y, 0]}>
      <mesh>
        <planeGeometry args={[3.2, 0.78]} />
        <meshBasicMaterial color={INK} />
      </mesh>
      <mesh
        position={[0, 0, 0.01]}
        onClick={(e) => {
          e.stopPropagation();
          runCommand(cmd); // cards only list visible commands -- never unknown
        }}
        onPointerOver={() => {
          if (label.current) label.current.color = AMBER;
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          if (label.current) label.current.color = INK;
          document.body.style.cursor = "auto";
        }}
      >
        <planeGeometry args={[3.04, 0.62]} />
        <meshBasicMaterial color={SCREEN} />
      </mesh>
      <Suspense fallback={null}>
        <Text
          ref={(el: unknown) => {
            label.current = el as TText | null;
          }}
          font={MONO}
          fontSize={0.32}
          color={INK}
          anchorX="center"
          anchorY="middle"
          position={[0, 0, 0.02]}
        >
          {cmd}
        </Text>
      </Suspense>
    </group>
  );
}

function CommandCards() {
  const top = VISIBLE_COMMANDS.length - 1;
  return (
    <group position={[6.3, 0.7, 1.0]} rotation={[0, -0.28, 0]}>
      {/* reversed stack so the list reads top-down in locked content order */}
      {VISIBLE_COMMANDS.map((cmd, i) => (
        <CommandCard key={cmd} cmd={cmd} y={(top - i) * 0.86} />
      ))}
    </group>
  );
}

/* ---------------- floating response panels (panelPool renderer) ------------ */

const P_N = panelPool.slots.length;

// [open] tab column for the PROJECTS panel (user feedback 2026-07-03): one
// diegetic raycast tab per body line, index-aligned with the locked
// lib/content.ts projects export (read-only; row r opens projects[r].url).
// Geometry: body renders at fontSize 0.26 / lineHeight 1.35 from anchorY
// "top" y 0.82 -- the locked 5 lines never wrap (33 chars * 0.156 adv =
// 5.148 < maxWidth 5.2), so row centers are a fixed pitch apart.
const OPEN_PITCH = 0.26 * 1.35;
const OPEN_TOP = 0.82;
const openRowY = (r: number) => OPEN_TOP - OPEN_PITCH * (r + 0.5);

/** tab is live only while its slot shows the projects response -- three's
 * Raycaster ignores `visible`, so handlers re-check the pool slot */
const openLive = (i: number) => {
  const slot = panelPool.slots[i];
  return slot !== undefined && slot.active && slot.data.cmd === "projects";
};

function ResponsePanels() {
  const groups = useRef<(Group | null)[]>([]);
  const texts = useRef<(TText | null)[]>([]); // 2 per slot: label, body
  const mats = useRef<(MeshBasicMaterial | null)[]>([]); // 2 per slot: border, body
  const gens = useRef<number[]>(new Array<number>(P_N).fill(-1));
  const openGroups = useRef<(Group | null)[]>([]); // 1 per slot: tab column
  const openMats = useRef<(MeshBasicMaterial | null)[]>([]); // per slot x row
  const openTexts = useRef<(TText | null)[]>([]); // per slot x row

  useFrame(() => {
    const { quality, reducedMotion } = useScrollStore.getState();
    const fps = quality === "low" ? 8 : 12;
    const now = performance.now();
    for (let i = 0; i < P_N; i++) {
      const g = groups.current[i];
      if (!g) continue;
      const slot = panelPool.slots[i]!;
      if (!slot.active) {
        g.visible = false;
        continue;
      }
      const age = panelPool.age(slot, now);
      if (!slot.active) {
        g.visible = false; // outlived life, retired by age()
        continue;
      }
      if (gens.current[i] !== slot.gen) {
        gens.current[i] = slot.gen;
        const label = texts.current[i * 2];
        if (label) {
          label.text = PROMPT + slot.data.cmd;
          label.sync();
        }
        const body = texts.current[i * 2 + 1];
        if (body) {
          body.text = slot.data.body;
          body.sync();
        }
        const og = openGroups.current[i];
        if (og) og.visible = slot.data.cmd === "projects";
      }
      // pops become fades under reduced motion (ruling in shots.md)
      const s = reducedMotion ? 0.95 : popScale(age, panelPool.life, fps, 0.16, 0.35, 0.3);
      if (s <= 0.001) {
        g.visible = false;
        continue;
      }
      const alpha = reducedMotion
        ? Math.max(0, Math.min(1, age / 0.35, (panelPool.life - age) / 0.5))
        : clamp01((panelPool.life - age) / 0.35);
      g.visible = true;
      g.position.copy(slot.pos);
      // squash-and-stretch: width overshoots first, settles by 0.35s
      const w = reducedMotion ? 1 : 1 + 0.16 * Math.sin(Math.min(stepTime(age, fps) / 0.35, 1) * Math.PI);
      g.scale.set(s * w, s / w, 1);
      g.rotation.z = (slot.seed - 0.5) * 0.06;
      for (let k = 0; k < 2; k++) {
        const m = mats.current[i * 2 + k];
        if (m) m.opacity = alpha;
        const txt = texts.current[i * 2 + k];
        if (txt) txt.fillOpacity = alpha;
      }
      if (openGroups.current[i]?.visible) {
        for (let r = 0; r < projects.length; r++) {
          const m = openMats.current[i * projects.length + r];
          if (m) m.opacity = alpha;
          const txt = openTexts.current[i * projects.length + r];
          if (txt) txt.fillOpacity = alpha;
        }
      }
    }
  });

  return (
    <group>
      {panelPool.slots.map((_, i) => (
        <group
          key={i}
          ref={(el) => {
            groups.current[i] = el;
          }}
          visible={false}
        >
          <mesh>
            <planeGeometry args={[5.8, 3.4]} />
            <meshBasicMaterial
              ref={(m) => {
                mats.current[i * 2] = m;
              }}
              color={INK}
              transparent
            />
          </mesh>
          <mesh position={[0, 0, 0.01]}>
            <planeGeometry args={[5.64, 3.24]} />
            <meshBasicMaterial
              ref={(m) => {
                mats.current[i * 2 + 1] = m;
              }}
              color={CASE}
              transparent
            />
          </mesh>
          <Suspense fallback={null}>
            <Text
              ref={(el: unknown) => {
                texts.current[i * 2] = el as TText | null;
              }}
              font={MONO}
              fontSize={0.3}
              color={AMBER}
              anchorX="left"
              anchorY="middle"
              position={[-2.6, 1.25, 0.02]}
            >
              {" "}
            </Text>
            <Text
              ref={(el: unknown) => {
                texts.current[i * 2 + 1] = el as TText | null;
              }}
              font={MONO}
              fontSize={0.26}
              color={INK}
              anchorX="left"
              anchorY="top"
              maxWidth={5.2}
              lineHeight={1.35}
              position={[-2.6, 0.82, 0.02]}
            >
              {" "}
            </Text>
          </Suspense>
          {/* [open] tabs off the right border, one per project row; shown
              only for the projects response (visibility set on gen swap) */}
          <group
            ref={(el) => {
              openGroups.current[i] = el;
            }}
            visible={false}
          >
            {projects.map((p, r) => (
              <group key={p.name} position={[3.52, openRowY(r), 0.02]}>
                <mesh
                  onClick={(e) => {
                    if (!openLive(i)) return; // dead tab: let the ray pass
                    e.stopPropagation();
                    // synchronous with the click gesture -- popup-blocker safe
                    window.open(p.url, "_blank", "noopener");
                  }}
                  onPointerOver={(e) => {
                    if (!openLive(i)) return;
                    e.stopPropagation();
                    openMats.current[i * projects.length + r]?.color.set(AMBER);
                    document.body.style.cursor = "pointer";
                  }}
                  onPointerOut={() => {
                    openMats.current[i * projects.length + r]?.color.set(INK);
                    document.body.style.cursor = "auto";
                  }}
                >
                  <planeGeometry args={[1.2, 0.32]} />
                  <meshBasicMaterial
                    ref={(m) => {
                      openMats.current[i * projects.length + r] = m;
                    }}
                    color={INK}
                    transparent
                  />
                </mesh>
                <Suspense fallback={null}>
                  <Text
                    ref={(el: unknown) => {
                      openTexts.current[i * projects.length + r] = el as TText | null;
                    }}
                    font={MONO}
                    fontSize={0.17}
                    color={CASE}
                    anchorX="center"
                    anchorY="middle"
                    position={[0, 0, 0.01]}
                  >
                    [open]
                  </Text>
                </Suspense>
              </group>
            ))}
          </group>
        </group>
      ))}
    </group>
  );
}

/* ---------------- resume sheet drop into the Issue-2 desk snapshot --------- */

function ResumeDrop() {
  const wrap = useRef<Group>(null);
  const snap = useRef<Group>(null);
  const sheet = useRef<Group>(null);
  const mats = useRef<(MeshBasicMaterial | null)[]>([]); // frame, backing, sheet

  useFrame(() => {
    const g = wrap.current;
    if (!g) return;
    const slot = dropPool.slots[0]!;
    if (!slot.active) {
      g.visible = false;
      return;
    }
    const { quality, reducedMotion } = useScrollStore.getState();
    const fps = quality === "low" ? 8 : 12;
    const age = dropPool.age(slot, performance.now());
    if (!slot.active) {
      g.visible = false;
      return;
    }
    g.visible = true;
    const life = dropPool.life;
    const u = clamp01(stepTime(age, fps) / life);
    const alpha = Math.min(1, age / 0.2, (life - age) / 0.4);
    // the desk snapshot recedes as the sheet falls toward it (cheap, no RT)
    if (snap.current) {
      const back = reducedMotion ? 0.75 : lerp(1, 0.5, u * u);
      snap.current.scale.setScalar(back);
    }
    if (sheet.current) {
      if (reducedMotion) {
        sheet.current.position.set(0, 0, 0.06);
        sheet.current.scale.setScalar(0.7);
        sheet.current.rotation.z = 0;
      } else {
        sheet.current.position.set(0.15 * Math.sin(u * 5), lerp(1.7, -0.2, u), 0.06);
        sheet.current.scale.setScalar(lerp(1, 0.42, u));
        sheet.current.rotation.z = 0.35 * Math.sin(u * 6.5) * (1 - u);
      }
    }
    for (const m of mats.current) if (m) m.opacity = alpha;
  });

  return (
    <group ref={wrap} position={RESUME_DROP_POS} rotation={[0, 0.18, 0]} visible={false}>
      {/* window frame onto the Issue-2 desk (snapshots.retain(2), shots.ts) */}
      <mesh>
        <planeGeometry args={[3.6, 2.7]} />
        <meshBasicMaterial
          ref={(m) => {
            mats.current[0] = m;
          }}
          color={INK}
          transparent
        />
      </mesh>
      <mesh position={[0, 0, 0.01]}>
        <planeGeometry args={[3.44, 2.54]} />
        <meshBasicMaterial
          ref={(m) => {
            mats.current[1] = m;
          }}
          color={CASE}
          transparent
        />
      </mesh>
      <group ref={snap} position={[0, 0, 0.02]}>
        <SnapshotQuad issue={2} w={3.44} h={2.54} />
      </group>
      {/* the amber reprint slip (palette ruling in shots.md) */}
      <group ref={sheet} position={[0, 1.7, 0.06]}>
        <mesh>
          <planeGeometry args={[0.95, 1.3]} />
          <meshBasicMaterial
            ref={(m) => {
              mats.current[2] = m;
            }}
            color={AMBER}
            transparent
          />
        </mesh>
      </group>
    </group>
  );
}

/* ---------------- back-cover page: header, NEXT ISSUE card, barcode -------- */

function Barcode() {
  // deterministic bars from the locked gag string (Cover.tsx derivation)
  const barcode = useMemo(() => {
    const bars: { x: number; w: number }[] = [];
    let x = 0;
    for (const ch of issueCopy.lettersPage.backCover.barcode) {
      const c = ch.charCodeAt(0);
      const w1 = 0.022 + (c % 3) * 0.012;
      bars.push({ x, w: w1 });
      x += w1 + 0.016;
      const w2 = 0.022 + ((c >> 3) % 3) * 0.012;
      bars.push({ x, w: w2 });
      x += w2 + 0.024;
    }
    return { bars, width: x - 0.024 };
  }, []);
  const barScale = 6.2 / barcode.width;

  return (
    // lower-LEFT page quadrant: the classic corner slot is floor-occluded
    // from the pullback camera, and x -7.4 clears the CRT silhouette so the
    // whole gag line stays readable (loop iter 3)
    <group position={[-7.4, -4.6, 0.3]}>
      <mesh>
        <planeGeometry args={[7.4, 2.5]} />
        <meshBasicMaterial color={INK} />
      </mesh>
      <mesh position={[0, 0, 0.01]}>
        <planeGeometry args={[7.2, 2.3]} />
        <meshBasicMaterial color={SCREEN} />
      </mesh>
      {barcode.bars.map((b, i) => (
        <mesh
          key={i}
          position={[(-barcode.width / 2 + b.x + b.w / 2) * barScale, 0.35, 0.02]}
          scale={[b.w * barScale, 1.1, 1]}
        >
          <planeGeometry />
          <meshBasicMaterial color={INK} />
        </mesh>
      ))}
      <Suspense fallback={null}>
        <Text
          font={MONO}
          fontSize={0.26}
          color={INK}
          anchorX="center"
          anchorY="middle"
          position={[0, -0.72, 0.02]}
          maxWidth={6.9}
          textAlign="center"
        >
          {issueCopy.lettersPage.backCover.barcode}
        </Text>
      </Suspense>
    </group>
  );
}

function BackCoverPage() {
  const card = useRef<Group>(null);

  useFrame(() => {
    // authored-time garnish only (BACK_COVER_POP via lib/beats.ts, flashless)
    card.current?.scale.setScalar(1 + 0.16 * BACK_COVER_POP.v);
  });

  return (
    <group position={[0, 8, -6]}>
      <mesh>
        <planeGeometry args={[24, 34]} />
        <meshBasicMaterial color={PAPER} />
      </mesh>
      {/* page border frame (green ink, inset 0.7) */}
      {([-16.3, 16.3] as const).map((y) => (
        <mesh key={`h${y}`} position={[0, y, 0.1]}>
          <planeGeometry args={[22.6, 0.14]} />
          <meshBasicMaterial color={INK} />
        </mesh>
      ))}
      {([-11.3, 11.3] as const).map((x) => (
        <mesh key={`v${x}`} position={[x, 0, 0.1]}>
          <planeGeometry args={[0.14, 32.6]} />
          <meshBasicMaterial color={INK} />
        </mesh>
      ))}
      <Suspense fallback={null}>
        {/* header = the locked S0.3 segment name */}
        <Text
          font={BANGERS}
          fontSize={1.6}
          letterSpacing={0.22}
          color={INK}
          anchorX="center"
          anchorY="middle"
          position={[0, 12.4, 0.2]}
        >
          LETTERS PAGE
        </Text>
        {/* NEXT ISSUE: ??? -- the tease card (jaw-drop squash rides the beat) */}
        <group ref={card} position={[0, 7.6, 0.3]}>
          <mesh>
            <planeGeometry args={[10.4, 2.9]} />
            <meshBasicMaterial color={INK} />
          </mesh>
          <mesh position={[0, 0, 0.01]}>
            <planeGeometry args={[10.16, 2.66]} />
            <meshBasicMaterial color={SCREEN} />
          </mesh>
          <Text
            font={BANGERS}
            fontSize={1.05}
            letterSpacing={0.06}
            color={AMBER}
            anchorX="center"
            anchorY="middle"
            position={[0, 0, 0.02]}
          >
            {issueCopy.lettersPage.backCover.nextIssue}
          </Text>
        </group>
      </Suspense>
      <Barcode />
    </group>
  );
}

/* ---------------- the cat: sits on the terminal, then walks off-panel ------ */

const [TCX] = issueCenter(11);

/** first fraction of the catWalk range = the hop-down; the walk plate owns
 * the rest. Sit visible u < HOP, walk u >= HOP: NO frame without a cat
 * (continuity fix, user feedback 2026-07-03). All pure f(t), scrub-safe. */
const CAT_HOP = 0.22;
/** sit perch on the CRT top (shots 1-2, on/near the monitor throughout) */
const SIT_FROM: [number, number, number] = [1.9, 6.25, 0.4];
/** floor landing IN FRONT of the desk edge (z 3.5) and LEFT of the command
 * card wall (x 4.7+): the old spawn (x 5, z 2.2) put the plate inside the
 * desk footprint behind the card stack -- an invisible-cat window */
const SIT_LAND: [number, number, number] = [3.5, 0.02, 3.8];

// spot rect scratch -- setSpotRect copies values, no per-frame allocation
const SPOT_C: [number, number, number] = [0, 0, 0];
const SPOT_U: [number, number, number] = [0.95, 0, 0];
const SPOT_V: [number, number, number] = [0, 0.95, 0];

function TerminalCat() {
  const sit = useRef<Group>(null);
  const walk = useRef<Group>(null);

  // channel hygiene: never leave the exemption on after the set unmounts
  useEffect(
    () => () => {
      spotRect.enabled = 0;
    },
    [],
  );

  useFrame(({ clock }) => {
    const { t, quality, reducedMotion } = useScrollStore.getState();
    const u = catWalk(t); // pure f(t), scrub-safe both directions
    const k = u <= 0 ? 0 : Math.min(u / CAT_HOP, 1); // hop progress
    const sitting = u < CAT_HOP;
    const s = sit.current;
    if (s) {
      s.visible = sitting;
      // hop-down arc off the CRT to the floor landing -- small rise first
      // (sin bump), then the fall; reverses identically on scrub-back
      s.position.set(
        lerp(SIT_FROM[0], SIT_LAND[0], k),
        lerp(SIT_FROM[1], SIT_LAND[1], k * k) + 1.15 * Math.sin(Math.PI * k),
        lerp(SIT_FROM[2], SIT_LAND[2], k),
      );
      // HARLEY color: the spot rect tracks the sit cat (hop included);
      // strength 0.8 keeps the scanline print grade on the fur. Depth 0.8
      // hugs the flat build -- the CRT glass (z 1.76+) stays outside at
      // the perch, so screen lettering is never exempted.
      if (sitting) {
        SPOT_C[0] = TCX + s.position.x;
        SPOT_C[1] = s.position.y + 0.15;
        SPOT_C[2] = s.position.z;
        setSpotRect(SPOT_C, SPOT_U, SPOT_V, 0.8, 0.8);
      }
      spotRect.enabled = sitting ? 1 : 0;
    }
    const g = walk.current;
    if (g) {
      // takes over EXACTLY at the hop landing, walks the floor frame-right
      // past the page edge (u=1: off-panel, the journey's last exit)
      g.visible = u >= CAT_HOP && u < 1;
      g.position.x = lerp(SIT_LAND[0], 16.5, clamp01((u - CAT_HOP) / (1 - CAT_HOP)));
      const fps = quality === "low" ? 8 : 12;
      // stride bob is ambient life -- dropped under reduced motion
      g.position.y =
        -0.12 + (reducedMotion ? 0 : 0.09 * Math.abs(Math.sin(stepTime(clock.elapsedTime, fps) * 6)));
    }
  });

  return (
    <>
      <group ref={sit} position={SIT_FROM} scale={0.85}>
        <CatModel mode="flat" pose="sitting" palette={HARLEY} />
      </group>
      {/* walk-off plate (user-approved Harley art, assets/prompts/
          backcover-harley.md): 2.2 x 2.6 ArtPanel plane, aspect crop trims
          ~7.7% width per side; unlit basic material so the phosphor
          pointLight never touches it. The wrapper keeps driving scale,
          x-lerp, stride bob, and the catWalk(t) visibility gate. Lifted
          +0.2 so the painted paw line lands where CatModel's feet walked.
          z 3.8: clear of the desk slab AND the card wall (continuity fix). */}
      <group ref={walk} position={[SIT_LAND[0], -0.12, SIT_LAND[2]]} scale={0.9} visible={false}>
        <group position={[0, 0.2, 0]}>
          <Suspense fallback={null}>
            <ArtPanel url="/images/backcover-harley.png" w={2.2} h={2.6} />
          </Suspense>
        </group>
      </group>
    </>
  );
}

/* ---------------- desk furniture (toon + ink edge does the drawing) -------- */

function DeskSet() {
  const ramp = toonRamp();
  return (
    <group>
      {/* floor slab + desk */}
      <mesh position={[0, -1.05, -0.5]}>
        <boxGeometry args={[34, 0.6, 14]} />
        <meshToonMaterial color={CASE} gradientMap={ramp} />
      </mesh>
      <mesh position={[0, -0.35, 0]}>
        <boxGeometry args={[15, 0.7, 7]} />
        <meshToonMaterial color={SCREEN} gradientMap={ramp} />
      </mesh>
      {/* CRT body + foot */}
      <mesh position={[0, 2.75, -0.5]}>
        <boxGeometry args={[7, 5.5, 4.5]} />
        <meshToonMaterial color={CASE} gradientMap={ramp} />
      </mesh>
      <mesh position={[0, 0.15, 0.4]}>
        <boxGeometry args={[4.2, 0.3, 2.6]} />
        <meshToonMaterial color={CASE} gradientMap={ramp} />
      </mesh>
      {/* power LED + blank amber sticky note (accents, S0.4 row 11) */}
      <mesh position={[2.7, 1.05, 1.79]}>
        <circleGeometry args={[0.09, 16]} />
        <meshBasicMaterial color={AMBER} />
      </mesh>
      <mesh position={[-2.9, 4.9, 1.77]} rotation={[0, 0, 0.12]}>
        <planeGeometry args={[0.85, 0.85]} />
        <meshBasicMaterial color={AMBER} />
      </mesh>
      {/* keyboard: slab + three key rows */}
      <group position={[0, 0.18, 3.2]} rotation={[0.06, 0, 0]}>
        <mesh>
          <boxGeometry args={[4.6, 0.35, 1.7]} />
          <meshToonMaterial color={SCREEN} gradientMap={ramp} />
        </mesh>
        {[-0.45, 0, 0.45].map((z) => (
          <mesh key={z} position={[0, 0.19, z]}>
            <planeGeometry args={[4.2, 0.3]} />
            <meshBasicMaterial color={CASE} />
          </mesh>
        ))}
      </group>
      {/* mug FG-left, letter stack MG-right (letters-page mail) */}
      <mesh position={[-5.6, 0.55, 1.8]}>
        <cylinderGeometry args={[0.42, 0.42, 1.1, 14]} />
        <meshToonMaterial color={CASE} gradientMap={ramp} />
      </mesh>
      <group position={[5.4, 0.06, 2.5]} rotation={[0, 0.25, 0]}>
        {[0, 1, 2].map((k) => (
          <mesh key={k} position={[k * 0.06, k * 0.12, 0]} rotation={[0, 0, (k - 1) * 0.06]}>
            <boxGeometry args={[1.5, 0.1, 1.0]} />
            <meshToonMaterial color={SCREEN} gradientMap={ramp} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/* ---------------- issue root -------------------------------------------- */

export default function Terminal({ index }: { index: number }) {
  useTerminalKeyboard();
  return (
    <IssueShell index={index} issue={ISSUES[index]!}>
      {/* phosphor spill onto desk + cat (motivated key, S2.5 own lights) */}
      <pointLight position={[0, 3.6, 5]} intensity={5} distance={16} color={INK} />
      <BackCoverPage />
      <DeskSet />
      <CrtScreen />
      <CommandCards />
      <ResponsePanels />
      <ResumeDrop />
      <TerminalCat />
    </IssueShell>
  );
}
