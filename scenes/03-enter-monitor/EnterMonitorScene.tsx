"use client";
import { useMemo, useRef } from "react";
import { AdditiveBlending, Color, ShaderMaterial } from "three";
import { useScrollStore } from "@/lib/scrollStore";
import { useUniformClock } from "@/lib/useUniformClock";
import { useAssetTexture } from "@/lib/useAssetTexture";
import { mulberry32 } from "@/lib/rng";
import { COLOR, CORE, PARTICLES, pickCount } from "./config";

// A swirling tube of GPU particles streams past the diving camera toward a glowing core — the
// plunge INTO the monitor. One Points draw call + one additive core. useUniformClock advances
// uTime (only while reduced motion is off), so the whole flow freezes into a calm static field
// for prefers-reduced-motion. All motion is in-shader off uTime.
const VERT = /* glsl */ `
uniform float uTime; uniform float uSize; uniform float uMaxSize; uniform float uLen; uniform float uSwirl; uniform float uStream;
attribute float aSeed;
varying float vSeed;
void main(){
  vSeed = aSeed;
  vec3 p = position;
  // stream toward +z and wrap over the tube length, so particles rush past the -z-diving camera
  p.z = mod(p.z + uTime * uStream, uLen) - uLen * 0.5;
  // swirl around the z axis, faster near the axis (a vortex)
  float r = length(p.xy);
  float a = uTime * uSwirl / (r * 0.08 + 1.0) + aSeed * 6.2831853;
  float c = cos(a), s = sin(a);
  p.xy = mat2(c, -s, s, c) * p.xy;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = clamp(uSize * (200.0 / -mv.z), 1.0, uMaxSize);
  gl_Position = projectionMatrix * mv;
}
`;
const FRAG = /* glsl */ `
uniform vec3 uColorA; uniform vec3 uColorB; uniform sampler2D uSprite;
varying float vSeed;
void main(){
  float a = texture2D(uSprite, gl_PointCoord).r; // soft radial glow on black
  if (a < 0.01) discard;
  vec3 col = mix(uColorA, uColorB, vSeed);
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}
`;

export function EnterMonitorScene() {
  const matRef = useRef<ShaderMaterial>(null);
  useUniformClock(matRef);
  const sprite = useAssetTexture("/textures/particle-glow.png");
  const quality = useScrollStore((s) => s.quality);
  const count = pickCount(quality);

  const { positions, seeds } = useMemo(() => {
    const rnd = mulberry32(2024);
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    const TWO_PI = Math.PI * 2;
    for (let i = 0; i < count; i++) {
      const ang = rnd() * TWO_PI;
      const rad = Math.sqrt(rnd()) * PARTICLES.radius; // uniform over the disc
      positions[i * 3] = Math.cos(ang) * rad;
      positions[i * 3 + 1] = Math.sin(ang) * rad;
      positions[i * 3 + 2] = rnd() * PARTICLES.length;
      seeds[i] = rnd();
    }
    return { positions, seeds };
  }, [count]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSize: { value: PARTICLES.size },
      uMaxSize: { value: PARTICLES.maxPointPx },
      uLen: { value: PARTICLES.length },
      uSwirl: { value: PARTICLES.swirl },
      uStream: { value: PARTICLES.stream },
      uColorA: { value: new Color(COLOR.particleA) },
      uColorB: { value: new Color(COLOR.particleB) },
      uSprite: { value: sprite },
    }),
    [sprite],
  );

  return (
    <>
      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-aSeed" args={[seeds, 1]} />
        </bufferGeometry>
        <shaderMaterial
          ref={matRef}
          vertexShader={VERT}
          fragmentShader={FRAG}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </points>

      {/* The glowing core the camera passes through — additive so it flares (bloom) rather than
          occludes, bridging the dive into the ABOUT scene. */}
      <mesh>
        <sphereGeometry args={[CORE.radius, CORE.segments, CORE.segments]} />
        <meshBasicMaterial color={COLOR.core} transparent opacity={CORE.opacity} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </>
  );
}
