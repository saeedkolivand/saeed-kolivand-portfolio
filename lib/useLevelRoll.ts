"use client";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Vector3 } from "three";

const WORLD_UP = new Vector3(0, 1, 0);

// Returns a group ref that, each frame, cancels the camera's roll about its view axis so the group's
// content stays level in view. For content scenes sitting on hard/fast-banking spline sections where
// a static counter-roll only levels one instant. It reads the ACTUAL camera roll, so it self-corrects
// for whatever bank remains — including under reduced motion, where CameraRig only DAMPS the bank to
// 25% (it does not disable it). Do NOT gate this on reducedMotion. No per-frame allocation.
export function useLevelRoll() {
  const ref = useRef<Group>(null);
  const fwd = useRef(new Vector3()).current;
  const right = useRef(new Vector3()).current;
  const levelRight = useRef(new Vector3()).current;
  const cross = useRef(new Vector3()).current;

  useFrame((state) => {
    if (!ref.current) return;
    const cam = state.camera;
    cam.getWorldDirection(fwd);
    levelRight.crossVectors(fwd, WORLD_UP); // where "right" points with zero roll
    if (levelRight.lengthSq() < 1e-8) return; // fwd ∥ up — can't happen on this spline, but avoid NaN
    levelRight.normalize();
    right.set(1, 0, 0).applyQuaternion(cam.quaternion); // camera's actual right
    const sin = cross.crossVectors(levelRight, right).dot(fwd);
    ref.current.rotation.z = -Math.atan2(sin, levelRight.dot(right));
  });

  return ref;
}
