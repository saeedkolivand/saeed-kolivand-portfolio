"use client";
import { useLayoutEffect, useMemo, useRef } from "react";
import {
  Color,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Quaternion,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector3,
} from "three";
import { COLOR, COUNT, LAYOUT, mulberry32, pick } from "./config";
import { TOWER_VERT, TOWER_FRAG } from "./shaders";
import { useUniformClock } from "./useSceneClock";
import type { QualityTier } from "@/lib/scrollStore";

// The whole megacity is 3 InstancedMeshes (towers · rooftop aerials · cyan signage) — one draw
// call each, thousands of lit windows baked into the tower fragment shader. Layouts are built
// once from a fixed seed (see mulberry32) so the skyline never reshuffles on remount.

function Towers({ count }: { count: number }) {
  const ref = useRef<InstancedMesh>(null);
  const matRef = useRef<ShaderMaterial>(null);
  useUniformClock(matRef);

  const { matrixArray, seeds, lits } = useMemo(() => {
    const rnd = mulberry32(1337);
    const m = new Matrix4();
    const pos = new Vector3();
    const quat = new Quaternion();
    const scl = new Vector3();
    const up = new Vector3(0, 1, 0);
    const { minX, maxX, zFront, zBack } = LAYOUT.corridor;
    const matrixArray = new Float32Array(count * 16);
    const seeds = new Float32Array(count);
    const lits = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const side = rnd() < 0.5 ? -1 : 1;
      const x = side * (minX + rnd() * (maxX - minX));
      const z = zFront + rnd() * (zBack - zFront);
      const h = 18 + rnd() * 72;
      pos.set(x, LAYOUT.street.y + h / 2, z);
      quat.setFromAxisAngle(up, (rnd() - 0.5) * 0.4);
      scl.set(6 + rnd() * 10, h, 6 + rnd() * 10);
      m.compose(pos, quat, scl);
      m.toArray(matrixArray, i * 16);
      seeds[i] = rnd() * 100;
      lits[i] = rnd() < 0.85 ? 1 : 0; // a few towers go fully dark
    }
    return { matrixArray, seeds, lits };
  }, [count]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    mesh.instanceMatrix.array.set(matrixArray);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.geometry.setAttribute("aSeed", new InstancedBufferAttribute(seeds, 1));
    mesh.geometry.setAttribute("aLit", new InstancedBufferAttribute(lits, 1));
  }, [matrixArray, seeds, lits]);

  const uniforms = useMemo(
    () => ({
      ...UniformsUtils.clone(UniformsLib.fog),
      uTime: { value: 0 },
      uBody: { value: new Color(COLOR.towerBody) },
      uEdge: { value: new Color(COLOR.edge) },
      uWindowDim: { value: new Color(COLOR.windowDim) },
      uCyan: { value: new Color(COLOR.cyan) },
      uThreshold: { value: 0.62 },
    }),
    [],
  );

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <shaderMaterial ref={matRef} vertexShader={TOWER_VERT} fragmentShader={TOWER_FRAG} uniforms={uniforms} fog />
    </instancedMesh>
  );
}

function Aerials({ count }: { count: number }) {
  const ref = useRef<InstancedMesh>(null);
  const matrixArray = useMemo(() => {
    const rnd = mulberry32(90210);
    const m = new Matrix4();
    const pos = new Vector3();
    const quat = new Quaternion();
    const scl = new Vector3();
    const arr = new Float32Array(count * 16);
    const { minX, maxX, zFront, zBack } = LAYOUT.corridor;
    for (let i = 0; i < count; i++) {
      const side = rnd() < 0.5 ? -1 : 1;
      const x = side * (minX + rnd() * (maxX - minX));
      const z = zFront + rnd() * (zBack - zFront);
      const top = LAYOUT.street.y + 18 + rnd() * 72;
      pos.set(x, top + 3, z);
      scl.set(0.3, 3 + rnd() * 5, 0.3);
      m.compose(pos, quat, scl);
      m.toArray(arr, i * 16);
    }
    return arr;
  }, [count]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    mesh.instanceMatrix.array.set(matrixArray);
    mesh.instanceMatrix.needsUpdate = true;
  }, [matrixArray]);

  if (count === 0) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color={COLOR.towerBody} fog />
    </instancedMesh>
  );
}

function Signage({ count }: { count: number }) {
  const ref = useRef<InstancedMesh>(null);
  const matrixArray = useMemo(() => {
    const rnd = mulberry32(4242);
    const m = new Matrix4();
    const pos = new Vector3();
    const quat = new Quaternion();
    const scl = new Vector3();
    const up = new Vector3(0, 1, 0);
    const arr = new Float32Array(count * 16);
    const { minX, zFront, zBack } = LAYOUT.corridor;
    for (let i = 0; i < count; i++) {
      const side = rnd() < 0.5 ? -1 : 1;
      pos.set(
        side * (minX * 0.92),
        LAYOUT.street.y + 8 + rnd() * 34,
        zFront * 0.6 + rnd() * (zBack * 0.55 - zFront * 0.6),
      );
      // face the corridor centre: +Z plane normal -> ∓X
      quat.setFromAxisAngle(up, side > 0 ? -Math.PI / 2 : Math.PI / 2);
      scl.set(0.6 + rnd() * 1.4, 0.5 + rnd() * 1.2, 1);
      m.compose(pos, quat, scl);
      m.toArray(arr, i * 16);
    }
    return arr;
  }, [count]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    mesh.instanceMatrix.array.set(matrixArray);
    mesh.instanceMatrix.needsUpdate = true;
  }, [matrixArray]);

  return (
    // TODO(asset): swap for a neon-sign SDF/MSDF atlas sampled per-instance; procedural cyan for now.
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial color={COLOR.cyan} toneMapped={false} fog side={DoubleSide} />
    </instancedMesh>
  );
}

export function CityInstances({ quality }: { quality: QualityTier }) {
  return (
    <>
      <Towers count={pick(quality, COUNT.towers)} />
      <Aerials count={pick(quality, COUNT.aerials)} />
      <Signage count={pick(quality, COUNT.signage)} />
    </>
  );
}
