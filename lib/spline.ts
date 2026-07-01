import { CatmullRomCurve3, Vector3 } from "three";

/** Number of scene regions laid along the spline. */
export const SCENE_COUNT = 11;

// A gentle forward-flying corridor with slight lateral/vertical drift, so the camera
// move reads as flight rather than a straight rail. Scenes are placed along this curve;
// the same curve drives both the camera (CameraRig) and scene placement (SceneManager),
// so the camera literally flies through each scene region.
const points: Vector3[] = Array.from({ length: SCENE_COUNT + 2 }, (_, i) => {
  const z = -i * 20;
  const x = Math.sin(i * 0.6) * 8;
  const y = Math.cos(i * 0.4) * 4;
  return new Vector3(x, y, z);
});

export const curve = new CatmullRomCurve3(points, false, "catmullrom", 0.5);
