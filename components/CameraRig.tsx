"use client";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3, PerspectiveCamera } from "three";
import { curve } from "@/lib/spline";
import { scenes } from "@/scenes/registry";
import { useScrollStore } from "@/lib/scrollStore";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const BASE_FOV = 62;
const TWO_PI = Math.PI * 2;

// Camera feel tuning.
// WHIP MUST stay < 1 to keep u monotonic: du/dt = 1 + WHIP·cos(2πN·t) ≥ 1 − WHIP.
// WHIP = 1 freezes the camera at each scene edge; WHIP > 1 makes it briefly reverse.
const WHIP = 0.7;
const BANK_GAIN = 3.5;
const MAX_BANK = 0.6; // rad
const LOOK_AHEAD = 16; // world units ahead the camera aims
const FOV_SPEED_GAIN = 0.35;
const MAX_FOV_BOOST = 14; // deg above BASE_FOV
const CORKSCREW_AMP = 0.1; // rad, peaks mid-transition, zero at scenes
const SWAY_A = 0.02; // rad
const SWAY_B = 0.025; // rad

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
    // Read via getState() (not a selector) so the rig never re-renders on scroll.
    const { t, reducedMotion } = useScrollStore.getState();
    const scroll = clamp01(t);

    // Dwell at each scene, whip between them: remap scroll -> path parameter so a constant scroll
    // speed yields a rhythmic slow-fast-slow ride. The whip runs WITHIN each (possibly non-uniform)
    // scene segment, so u == scroll at every scene center + boundary (sin term is 0 there) and scene
    // placement/mounting stay aligned. With uniform ranges this is exactly the old single sinusoid.
    let si = scenes.length - 1;
    while (si > 0 && scroll < scenes[si]!.range[0]) si--;
    const segStart = scenes[si]!.range[0];
    const segLen = scenes[si]!.range[1] - segStart;
    const segLocal = segLen > 1e-6 ? (scroll - segStart) / segLen : 0;
    const u = clamp01(scroll + ((WHIP * segLen) / TWO_PI) * Math.sin(TWO_PI * segLocal));

    curve.getPointAt(u, pos.current);
    curve.getTangentAt(u, tan.current);
    curve.getTangentAt(clamp01(u + 0.02), tanAhead.current);

    // Look ahead along the path so the camera leads into turns.
    desiredLook.current.copy(pos.current).addScaledVector(tan.current, LOOK_AHEAD);

    // Bank into horizontal turns. Reduced motion keeps the (user-driven) forward flight
    // but damps the autonomous vestibular triggers — bank, corkscrew, sway, FOV pulse —
    // that cause motion sickness.
    const heading = Math.atan2(tan.current.x, -tan.current.z);
    const headingAhead = Math.atan2(tanAhead.current.x, -tanAhead.current.z);
    let dHeading = headingAhead - heading;
    dHeading = Math.atan2(Math.sin(dHeading), Math.cos(dHeading)); // wrap to [-π, π]
    const bankLimit = reducedMotion ? MAX_BANK * 0.25 : MAX_BANK;
    const targetRoll = clamp(-dHeading * BANK_GAIN, -bankLimit, bankLimit);

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

    // Speed → FOV: widens during whips, settles at scenes. Held flat under reduced motion.
    const speed = state.camera.position.distanceTo(prev.current) / Math.max(delta, 1e-3);
    prev.current.copy(state.camera.position);
    const targetFov = reducedMotion
      ? BASE_FOV
      : BASE_FOV + clamp(speed * FOV_SPEED_GAIN, 0, MAX_FOV_BOOST);
    fov.current += (targetFov - fov.current) * (1 - Math.exp(-4 * delta));
    // Only touch the projection matrix when the FOV has actually moved (it asymptotes).
    if (state.camera instanceof PerspectiveCamera && Math.abs(state.camera.fov - fov.current) > 0.01) {
      state.camera.fov = fov.current;
      state.camera.updateProjectionMatrix();
    }

    // Idle sway + a gentle corkscrew that peaks mid-transition and is flat at each scene.
    // Both off under reduced motion.
    let extraRoll = 0;
    if (!reducedMotion) {
      const time = state.clock.elapsedTime;
      const sway = Math.sin(time * 0.35) * SWAY_A + Math.sin(time * 0.13) * SWAY_B;
      const corkscrew = Math.sin(TWO_PI * segLocal) * CORKSCREW_AMP;
      extraRoll = sway + corkscrew;
    }

    state.camera.up.set(0, 1, 0);
    state.camera.lookAt(look.current);
    state.camera.rotateZ(roll.current + extraRoll);
  });

  return null;
}
