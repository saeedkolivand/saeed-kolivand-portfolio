"use client";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import { curve } from "@/lib/spline";
import { useScrollStore } from "@/lib/scrollStore";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function CameraRig() {
  const look = useRef(new Vector3(0, 0, -1));
  const ready = useRef(false);

  useFrame((state, delta) => {
    // Read t via getState() (not a selector) so the rig never re-renders on scroll.
    const t = clamp01(useScrollStore.getState().t);
    const pos = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t);
    const desiredLook = pos.clone().add(tangent.multiplyScalar(10));

    // Frame-rate-independent smoothing: the camera lerps toward the spline target,
    // so it never teleports and eases to rest when scrolling stops.
    const a = 1 - Math.exp(-4 * delta);

    if (!ready.current) {
      state.camera.position.copy(pos);
      look.current.copy(desiredLook);
      ready.current = true;
    } else {
      state.camera.position.lerp(pos, a);
      look.current.lerp(desiredLook, a);
    }
    state.camera.lookAt(look.current);
  });

  return null;
}
