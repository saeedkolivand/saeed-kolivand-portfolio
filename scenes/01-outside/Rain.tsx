"use client";
import { useMemo, useRef } from "react";
import { AdditiveBlending, Color, ShaderMaterial } from "three";
import { COLOR, COUNT, MOTION, pick } from "./config";
import { RAIN_VERT, RAIN_FRAG } from "./shaders";
import { mulberry32 } from "@/lib/rng";
import { useUniformClock } from "@/lib/useUniformClock";
import type { QualityTier } from "@/lib/scrollStore";

// The rain box hugs the flight corridor; points wrap-fall in the vertex shader (mod over
// spanY) so the volume stays full as the camera flies through — no world-locked pop.
const BOX = { halfX: 70, halfZ: 90, spanY: 100 };

function RainLayer({
  count,
  fall,
  size,
  opacity,
  seed,
}: {
  count: number;
  fall: number;
  size: number;
  opacity: number;
  seed: number;
}) {
  const matRef = useRef<ShaderMaterial>(null);
  useUniformClock(matRef);

  const { positions, seeds } = useMemo(() => {
    const rnd = mulberry32(seed);
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (rnd() * 2 - 1) * BOX.halfX;
      positions[i * 3 + 1] = rnd() * BOX.spanY;
      positions[i * 3 + 2] = (rnd() * 2 - 1) * BOX.halfZ;
      seeds[i] = rnd();
    }
    return { positions, seeds };
  }, [count, seed]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uFall: { value: fall },
      uWind: { value: MOTION.windShear },
      uSpanY: { value: BOX.spanY },
      uSize: { value: size },
      uColor: { value: new Color(COLOR.rain) },
      uOpacity: { value: opacity },
    }),
    [fall, size, opacity],
  );

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSeed" args={[seeds, 1]} />
      </bufferGeometry>
      {/* TODO(asset): rain-streak sprite texture could replace the procedural point smear. */}
      <shaderMaterial
        ref={matRef}
        vertexShader={RAIN_VERT}
        fragmentShader={RAIN_FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}

export function Rain({ quality }: { quality: QualityTier }) {
  return (
    <>
      <RainLayer count={pick(quality, COUNT.rainNear)} fall={MOTION.rainNearFall} size={3} opacity={0.5} seed={7} />
      <RainLayer count={pick(quality, COUNT.rainFar)} fall={MOTION.rainFarFall} size={2} opacity={0.3} seed={13} />
    </>
  );
}
