"use client";
import { useMemo, useRef } from "react";
import { Color, ShaderMaterial, UniformsLib, UniformsUtils } from "three";
import { COLOR, LAYOUT } from "./config";
import { TOWER_VERT, TOWER_FRAG } from "./shaders";
import { GlowQuad } from "./Environment";
import { useUniformClock } from "@/lib/useUniformClock";

// The developer's building — a near-black monolith the descending camera aims down, carrying
// the ONE warm window (the desk) that is the sole warm mark and the bloom handoff into DESK.
export function HeroTower() {
  const matRef = useRef<ShaderMaterial>(null);
  useUniformClock(matRef);

  // Reuses the tower shader via its non-instanced (USE_INSTANCING off) branch; aSeed/aLit are
  // uniforms here. High threshold => almost every window dark, for a lonely late-night facade.
  const uniforms = useMemo(
    () => ({
      ...UniformsUtils.clone(UniformsLib.fog),
      uTime: { value: 0 },
      uBody: { value: new Color(COLOR.towerBody) },
      uEdge: { value: new Color(COLOR.edge) },
      uWindowDim: { value: new Color(COLOR.windowDim) },
      uCyan: { value: new Color(COLOR.cyan) },
      uThreshold: { value: 0.97 },
      aSeed: { value: 3.0 },
      aLit: { value: 1.0 },
    }),
    [],
  );

  const [hx, hy, hz] = LAYOUT.hero.pos;
  const [sx, sy, sz] = LAYOUT.hero.size;
  const [wx, wy] = LAYOUT.warmWindow.size;
  const yaw = (LAYOUT.hero.yawDeg * Math.PI) / 180;
  const faceZ = sz / 2 + 0.05;
  const winY = sy * 0.16;

  return (
    <group position={[hx, hy, hz]} rotation={[0, yaw, 0]}>
      {/* TODO(asset): swap this box for a hero-building GLTF; the warm-window inset + glow stay. */}
      <mesh scale={[sx, sy, sz]}>
        <boxGeometry args={[1, 1, 1]} />
        <shaderMaterial ref={matRef} vertexShader={TOWER_VERT} fragmentShader={TOWER_FRAG} uniforms={uniforms} fog />
      </mesh>

      {/* THE one warm window — the developer's desk. Bright enough to cross the bloom threshold. */}
      {/* TODO(asset): can later show a lit-interior card/texture in this same inset slot. */}
      <mesh position={[2.4, winY, faceZ]}>
        <planeGeometry args={[wx, wy]} />
        <meshBasicMaterial color={COLOR.warm} toneMapped={false} />
      </mesh>

      {/* Warm glow carrier + haze pocket so the window survives fog and blooms on approach. */}
      <GlowQuad color={COLOR.warm} size={LAYOUT.warmWindow.glow} position={[2.4, winY, faceZ + 0.1]} opacity={0.55} />
    </group>
  );
}
