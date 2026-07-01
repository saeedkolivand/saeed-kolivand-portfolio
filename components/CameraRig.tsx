"use client";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3, type PerspectiveCamera } from "three";
import { curve, SCENE_COUNT } from "@/lib/spline";
import { useScrollStore } from "@/lib/scrollStore";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const BASE_FOV = 62;
const TWO_PI = Math.PI * 2;
// How strongly the camera dwells at scenes and accelerates between them (0 = uniform).
const WHIP = 0.7;

export function CameraRig() {
  const look = useRef(new Vector3(0, 0, -1));
  const pos = useRef(new Vector3());
  const prev = useRef(new Vector3());
  const tan = useRef(new Vector3());
  const tanAhead = useRef(new Vector3());
  const desiredLook = useRef(new Vector3());
  const roll = useRef(0);
  const fov = useRef(BASE_FOV);
  const ready = useRef(false);

  useFrame((state, delta) => {
    // Read t via getState() (not a selector) so the rig never re-renders on scroll.
    const t = clamp01(useScrollStore.getState().t);

    // Dwell at each scene, whip between them: remap scroll -> path parameter so a
    // constant scroll speed yields a rhythmic slow-fast-slow ride. u == t at every scene
    // center and boundary (sin term is 0 there), so scene placement/mounting stay aligned.
    const u = clamp01(t + (WHIP / (TWO_PI * SCENE_COUNT)) * Math.sin(TWO_PI * SCENE_COUNT * t));

    curve.getPointAt(u, pos.current);
    curve.getTangentAt(u, tan.current);
    curve.getTangentAt(clamp01(u + 0.02), tanAhead.current);

    // Look ahead along the path so the camera leads into turns.
    desiredLook.current.copy(pos.current).addScaledVector(tan.current, 16);

    // Bank into horizontal turns: roll toward the inside of the curve.
    const heading = Math.atan2(tan.current.x, -tan.current.z);
    const headingAhead = Math.atan2(tanAhead.current.x, -tanAhead.current.z);
    let dHeading = headingAhead - heading;
    dHeading = Math.atan2(Math.sin(dHeading), Math.cos(dHeading)); // wrap to [-π, π]
    const targetRoll = clamp(-dHeading * 3.5, -0.6, 0.6);

    // Frame-rate-independent smoothing for position, look target, and bank.
    const a = 1 - Math.exp(-4 * delta);
    if (!ready.current) {
      state.camera.position.copy(pos.current);
      prev.current.copy(pos.current);
      look.current.copy(desiredLook.current);
      roll.current = targetRoll;
      ready.current = true;
    } else {
      state.camera.position.lerp(pos.current, a);
      look.current.lerp(desiredLook.current, a);
      roll.current += (targetRoll - roll.current) * a;
    }

    // Speed → FOV: widens during whips between scenes, settles at each scene.
    const speed = state.camera.position.distanceTo(prev.current) / Math.max(delta, 1e-3);
    prev.current.copy(state.camera.position);
    const targetFov = BASE_FOV + clamp(speed * 0.35, 0, 14);
    fov.current += (targetFov - fov.current) * (1 - Math.exp(-4 * delta));
    const cam = state.camera as PerspectiveCamera;
    if (cam.isPerspectiveCamera) {
      cam.fov = fov.current;
      cam.updateProjectionMatrix();
    }

    // Idle sway (scroll-independent) + a gentle corkscrew that peaks mid-transition and is
    // flat at each scene, so whips feel kinetic without disorienting at the dwell points.
    const time = state.clock.elapsedTime;
    const sway = Math.sin(time * 0.35) * 0.02 + Math.sin(time * 0.13) * 0.025;
    const corkscrew = Math.sin(u * TWO_PI * SCENE_COUNT) * 0.1;

    state.camera.up.set(0, 1, 0);
    state.camera.lookAt(look.current);
    state.camera.rotateZ(roll.current + sway + corkscrew);
  });

  return null;
}
