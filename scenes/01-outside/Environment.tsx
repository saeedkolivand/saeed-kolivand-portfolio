"use client";
import { useMemo, useRef } from "react";
import { AdditiveBlending, BackSide, Color, DoubleSide, ShaderMaterial, UniformsLib, UniformsUtils } from "three";
import { COLOR, LAYOUT, MOTION } from "./config";
import { GLASS_FRAG, GLASS_VERT, GLOW_FRAG, GLOW_VERT, STREET_FRAG, STREET_VERT } from "./shaders";
import { useUniformClock } from "@/lib/useUniformClock";
import { useAssetTexture } from "@/lib/useAssetTexture";

// Night-sky backdrop dome — an equirectangular rainy-night panorama (which also carries a
// distant city-light horizon) on a BackSide sphere behind the shared drei Stars. No fog: it IS
// the sky; toneMapped off so the far city lights stay bright enough to bloom.
export function SkyDome() {
  const tex = useAssetTexture("/textures/sky-night.png");
  return (
    <mesh renderOrder={-1}>
      <sphereGeometry args={[LAYOUT.sky.radius, 48, 24]} />
      {/* color multiplies the map — darken the panorama to a moodier night (its bright horizon
          band was reading blown-out now that the raised ground drops the camera toward it). */}
      <meshBasicMaterial map={tex} color="#6f7784" side={BackSide} depthWrite={false} toneMapped={false} fog={false} />
    </mesh>
  );
}

// Wet asphalt below the corridor — a real seamless asphalt albedo (tiled) under analytic neon
// reflections + fresnel sheen + ripples (no extra render pass).
export function WetStreet() {
  const matRef = useRef<ShaderMaterial>(null);
  useUniformClock(matRef);
  const asphalt = useAssetTexture("/textures/wet-asphalt.png", { wrap: true });
  const uniforms = useMemo(
    () => ({
      ...UniformsUtils.clone(UniformsLib.fog),
      uTime: { value: 0 },
      uAsphalt: { value: asphalt },
      uTile: { value: 26 },
      uCyan: { value: new Color(COLOR.cyan) },
      uWarm: { value: new Color(COLOR.warm) },
      uRipple: { value: MOTION.ripple },
    }),
    [asphalt],
  );
  return (
    <mesh position={[0, LAYOUT.street.y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[LAYOUT.street.size, LAYOUT.street.size]} />
      <shaderMaterial ref={matRef} vertexShader={STREET_VERT} fragmentShader={STREET_FRAG} uniforms={uniforms} fog />
    </mesh>
  );
}

// The rain-on-glass threshold pane the camera flies THROUGH at scene centre — the outside/
// inside beat. Fake refraction via procedural rivulets, no screen-space transmission pass.
// TODO(asset): rain-on-glass normal/roughness photo texture can replace the droplet shader.
export function GlassPane() {
  const matRef = useRef<ShaderMaterial>(null);
  useUniformClock(matRef);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uRivulet: { value: MOTION.rivulet },
      uWarm: { value: new Color(COLOR.warm) },
      uCool: { value: new Color(COLOR.cyan) },
    }),
    [],
  );
  const [w, h] = LAYOUT.glass.size;
  const tilt = (LAYOUT.glass.tiltDeg * Math.PI) / 180;
  return (
    <mesh position={[0, -6, LAYOUT.glass.z]} rotation={[tilt, 0, 0]}>
      <planeGeometry args={[w, h]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={GLASS_VERT}
        fragmentShader={GLASS_FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        toneMapped={false}
        side={DoubleSide}
      />
    </mesh>
  );
}

// Soft radial additive glow — the window's bloom carrier and the fake-volumetric haze pockets.
// Static (no clock): it only grows because the scroll-driven camera approaches it.
export function GlowQuad({
  color,
  size,
  position,
  opacity = 0.5,
}: {
  color: string;
  size: number;
  position: [number, number, number];
  opacity?: number;
}) {
  const uniforms = useMemo(
    () => ({ uColor: { value: new Color(color) }, uOpacity: { value: opacity } }),
    [color, opacity],
  );
  return (
    <mesh position={position}>
      <planeGeometry args={[size, size]} />
      <shaderMaterial
        vertexShader={GLOW_VERT}
        fragmentShader={GLOW_FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
        toneMapped={false}
        side={DoubleSide}
      />
    </mesh>
  );
}
