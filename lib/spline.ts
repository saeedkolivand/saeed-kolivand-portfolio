import { CatmullRomCurve3, Vector3 } from "three";

/** Number of scene regions laid along the spline. */
export const SCENE_COUNT = 11;

// A bold, varied 3D flight path: steep dives and climbs plus sharp lateral sweeps, so the
// camera pitches and banks dramatically instead of gliding straight. Higher-frequency
// terms keep no two segments feeling the same. The same curve drives both the camera and
// scene placement, so scenes always sit on the flight path.
const points: Vector3[] = Array.from({ length: SCENE_COUNT + 2 }, (_, i) => {
  const z = -i * 26;
  const x = Math.sin(i * 0.9) * 22 + Math.sin(i * 2.1) * 7;
  const y = Math.sin(i * 0.65 + 0.5) * 15 + Math.cos(i * 1.5) * 5;
  return new Vector3(x, y, z);
});

export const curve = new CatmullRomCurve3(points, false, "catmullrom", 0.5);
