"use client";
import { Quaternion, Vector3 } from "three";
import { useScrollStore } from "@/lib/scrollStore";
import { scenes } from "@/scenes/registry";
import { SceneShell } from "@/scenes/_SceneShell";
import { PlaceholderScene } from "@/scenes/PlaceholderScene";
import { curve } from "@/lib/spline";

// Static per-scene placement on the spline, computed once (the curve never changes). Each
// scene sits at its region's center point, yaw-oriented so its local -Z faces the flight
// direction — real scenes are then authored in a level local frame (camera flies in along
// -Z, +Y is world up). Yaw-only (tangent flattened to XZ) keeps scenes upright: a desk must
// not tilt with the path's pitch. This runs once at module load, never per frame.
const FORWARD = new Vector3(0, 0, -1);
const sceneItems = scenes.map((scene, index) => {
  const centerT = (scene.range[0] + scene.range[1]) / 2;
  const p = curve.getPointAt(centerT);
  const tan = curve.getTangentAt(centerT);
  const flat = new Vector3(tan.x, 0, tan.z);
  // ponytail: spline z strictly decreases so |flat| is never ~0; fall back to identity if a
  // future curve ever makes the tangent purely vertical.
  const q =
    flat.lengthSq() < 1e-8
      ? new Quaternion()
      : new Quaternion().setFromUnitVectors(FORWARD, flat.normalize());
  return {
    scene,
    index,
    position: [p.x, p.y, p.z] as [number, number, number],
    quaternion: [q.x, q.y, q.z, q.w] as [number, number, number, number],
  };
});

export function SceneManager() {
  // Subscribe to activeIndex only — it changes on boundary crossings, not every frame.
  const active = useScrollStore((s) => s.activeIndex);

  return (
    <>
      {sceneItems.map(({ scene, index, position, quaternion }) => {
        // Only current ± 1 scene is ever mounted — the biggest performance lever.
        if (Math.abs(index - active) > 1) return null;

        const Component = scene.Component;

        return (
          <SceneShell key={scene.id} position={position} quaternion={quaternion}>
            {Component ? (
              <Component index={index} />
            ) : (
              <PlaceholderScene label={scene.label} index={index} />
            )}
          </SceneShell>
        );
      })}
    </>
  );
}
