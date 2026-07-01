"use client";
import { useMemo, useRef } from "react";
import { AdditiveBlending, BackSide, Color, DoubleSide, ShaderMaterial, UniformsLib, UniformsUtils } from "three";
import { COLOR, LAYOUT, MOTION } from "./config";
import {
  GLASS_FRAG,
  GLASS_VERT,
  GLOW_FRAG,
  GLOW_VERT,
  SKY_FRAG,
  SKY_VERT,
  STREET_FRAG,
  STREET_VERT,
} from "./shaders";
import { useUniformClock } from "./useSceneClock";

// Horizon-glow backdrop dome — renders behind the shared drei Stars; no fog (it IS the sky).
// TODO(asset): swap the gradient+fbm material for an equirect night-smog HDR onto the same dome.
export function SkyDome() {
  const matRef = useRef<ShaderMaterial>(null);
  useUniformClock(matRef);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uDrift: { value: MOTION.smogDrift },
      uZenith: { value: new Color(COLOR.skyZenith) },
      uHorizon: { value: new Color(COLOR.skyHorizon) },
    }),
    [],
  );
  return (
    <mesh renderOrder={-1}>
      <sphereGeometry args={[LAYOUT.sky.radius, 32, 16]} />
      <shaderMaterial ref={matRef} vertexShader={SKY_VERT} fragmentShader={SKY_FRAG} uniforms={uniforms} side={BackSide} depthWrite={false} />
    </mesh>
  );
}

// Wet asphalt below the corridor — analytic accent reflections + fresnel sheen, no render pass.
// TODO(asset): real wet-asphalt normal + roughness maps drop onto this same plane.
export function WetStreet() {
  const matRef = useRef<ShaderMaterial>(null);
  useUniformClock(matRef);
  const uniforms = useMemo(
    () => ({
      ...UniformsUtils.clone(UniformsLib.fog),
      uTime: { value: 0 },
      uAsphalt: { value: new Color(COLOR.asphalt) },
      uCyan: { value: new Color(COLOR.cyan) },
      uWarm: { value: new Color(COLOR.warm) },
      uRipple: { value: MOTION.ripple },
    }),
    [],
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
