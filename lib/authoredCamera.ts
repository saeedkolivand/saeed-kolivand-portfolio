import { PerspectiveCamera } from "three";
import { evaluateTimeline } from "./shots";
import { SEGMENTS } from "@/issues/registry";

/**
 * The AUTHORED camera for a scroll position -- evaluateTimeline's raw pose,
 * with NO delta smoothing and NO pointer parallax (ShotDirector adds both to
 * the live camera, which makes the live view a function of scroll history and
 * of the mouse). Scene guards that gate READABLE lettering on framing must
 * project through this camera instead, so the fade stays a pure function of t:
 * identical from either scrub direction and immune to pointer movement
 * (S2.16 / audit 2026-07-27).
 *
 * Module scope, cached per (t, aspect): all callers in a frame share one
 * rebuild and it allocates nothing. near/far mirror the Canvas camera
 * (components/Experience.tsx) so the far-plane reject agrees with the render.
 */
const cam = new PerspectiveCamera(45, 1, 0.1, 400);
let lastT = NaN;
let lastAspect = NaN;

export function authoredCamera(t: number, aspect: number): PerspectiveCamera {
  if (t === lastT && aspect === lastAspect) return cam;
  lastT = t;
  lastAspect = aspect;
  const { pose } = evaluateTimeline(t, SEGMENTS);
  cam.fov = pose.fov ?? 45;
  cam.aspect = aspect;
  cam.updateProjectionMatrix();
  cam.position.set(pose.position[0], pose.position[1], pose.position[2]);
  cam.lookAt(pose.target[0], pose.target[1], pose.target[2]);
  if (pose.roll) cam.rotateZ(pose.roll);
  // Camera.updateMatrixWorld also refreshes matrixWorldInverse -- what
  // Vector3.project() reads
  cam.updateMatrixWorld(true);
  return cam;
}
