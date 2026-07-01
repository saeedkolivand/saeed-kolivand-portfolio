import { CatmullRomCurve3, Vector3 } from "three";

/** Number of scene regions laid along the spline. */
export const SCENE_COUNT = 11;

// A sculpted 3D flight path: sweeping left/right turns plus elevation changes, so the
// camera banks and re-frames continuously instead of flying straight down a tunnel. The
// same curve drives both the camera (CameraRig) and scene placement (SceneManager), so
// scenes always sit along the flight path and the camera flies through each region.
const points: Vector3[] = Array.from({ length: SCENE_COUNT + 2 }, (_, i) => {
  const z = -i * 24;
  const x = Math.sin(i * 0.8) * 18 + Math.cos(i * 1.7) * 6;
  const y = Math.sin(i * 0.55 + 0.4) * 11;
  return new Vector3(x, y, z);
});

export const curve = new CatmullRomCurve3(points, false, "catmullrom", 0.5);
