"use client";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import { curve } from "@/lib/spline";
import { useScrollStore } from "@/lib/scrollStore";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function CameraRig() {
  const look = useRef(new Vector3(0, 0, -1));
  const pos = useRef(new Vector3());
  const tan = useRef(new Vector3());
  const tanAhead = useRef(new Vector3());
  const desiredLook = useRef(new Vector3());
  const roll = useRef(0);
  const ready = useRef(false);

  useFrame((state, delta) => {
    // Read t via getState() (not a selector) so the rig never re-renders on scroll.
    const t = clamp01(useScrollStore.getState().t);
    curve.getPointAt(t, pos.current);
    curve.getTangentAt(t, tan.current);
    curve.getTangentAt(clamp01(t + 0.02), tanAhead.current);

    // Look a little ahead along the path.
    desiredLook.current.copy(pos.current).addScaledVector(tan.current, 14);

    // Bank into horizontal turns: roll toward the inside of the curve so sweeping turns
    // read as banked flight rather than a flat pan.
    const heading = Math.atan2(tan.current.x, -tan.current.z);
    const headingAhead = Math.atan2(tanAhead.current.x, -tanAhead.current.z);
    let dHeading = headingAhead - heading;
    dHeading = Math.atan2(Math.sin(dHeading), Math.cos(dHeading)); // wrap to [-π, π]
    const targetRoll = clamp(-dHeading * 3.0, -0.45, 0.45);

    // Frame-rate-independent smoothing: position, look target, and bank all ease.
    const a = 1 - Math.exp(-3.5 * delta);
    if (!ready.current) {
      state.camera.position.copy(pos.current);
      look.current.copy(desiredLook.current);
      roll.current = targetRoll;
      ready.current = true;
    } else {
      state.camera.position.lerp(pos.current, a);
      look.current.lerp(desiredLook.current, a);
      roll.current += (targetRoll - roll.current) * a;
    }

    // Idle sway, independent of scroll, so paused frames still breathe.
    const sway = Math.sin(state.clock.elapsedTime * 0.35) * 0.02;

    state.camera.up.set(0, 1, 0);
    state.camera.lookAt(look.current);
    state.camera.rotateZ(roll.current + sway);
  });

  return null;
}
