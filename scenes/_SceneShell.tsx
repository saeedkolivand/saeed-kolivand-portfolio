"use client";
import type { ReactNode } from "react";

// Shared wrapper for every scene. Positions + orients the scene's local frame on the spline
// (transform computed once in SceneManager) so real scenes are authored in local space: the
// camera flies in along local -Z, +Y is world up, origin is the scene's spline center.
// When this group unmounts, react-three-fiber automatically disposes the geometries/materials
// of the JSX meshes inside it, so a distant scene frees its GPU memory for free — the core of
// the "only current ±1 live" budget lever.
// ponytail: no manual dispose loop here until a scene owns resources R3F can't track
// (imperative textures / render targets) — dispose those in a useEffect cleanup.
export function SceneShell({
  position,
  quaternion,
  children,
}: {
  position: [number, number, number];
  quaternion: [number, number, number, number];
  children: ReactNode;
}) {
  return (
    <group position={position} quaternion={quaternion}>
      {children}
    </group>
  );
}
