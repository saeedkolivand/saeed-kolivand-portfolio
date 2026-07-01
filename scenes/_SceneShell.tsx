"use client";
import type { ReactNode } from "react";

// Shared wrapper for every scene. When this group unmounts, react-three-fiber
// automatically disposes the geometries/materials of the JSX meshes inside it, so a
// distant scene frees its GPU memory for free — the core of the "only current ±1 live"
// budget lever.
// ponytail: no manual dispose loop here until a scene owns resources R3F can't track
// (imperative textures / render targets) — dispose those in a useEffect cleanup.
export function SceneShell({ children }: { children: ReactNode }) {
  return <group>{children}</group>;
}
