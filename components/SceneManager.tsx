"use client";
import { useScrollStore } from "@/lib/scrollStore";
import { scenes } from "@/scenes/registry";
import { SceneShell } from "@/scenes/_SceneShell";
import { PlaceholderScene } from "@/scenes/PlaceholderScene";
import { curve } from "@/lib/spline";

export function SceneManager() {
  // Subscribe to activeIndex only — it changes on boundary crossings, not every frame.
  const active = useScrollStore((s) => s.activeIndex);

  return (
    <>
      {scenes.map((scene, i) => {
        // Only current ± 1 scene is ever mounted — the biggest performance lever.
        if (Math.abs(i - active) > 1) return null;

        const centerT = (scene.range[0] + scene.range[1]) / 2;
        const p = curve.getPointAt(centerT);
        const Component = scene.Component;

        return (
          <SceneShell key={scene.id}>
            {Component ? (
              <Component />
            ) : (
              <PlaceholderScene label={scene.label} position={[p.x, p.y, p.z]} index={i} />
            )}
          </SceneShell>
        );
      })}
    </>
  );
}
