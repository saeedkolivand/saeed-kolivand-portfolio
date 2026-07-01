"use client";
import { useScrollStore } from "@/lib/scrollStore";
import { scenes } from "@/scenes/registry";

// Dev-only readout of scroll progress + active scene. Real DOM UI (glass panels, nav)
// lands in later phases.
export function UIOverlay() {
  const t = useScrollStore((s) => s.t);
  const active = useScrollStore((s) => s.activeIndex);
  if (process.env.NODE_ENV === "production") return null;

  const label = scenes[active]?.label ?? "—";
  return (
    <div className="pointer-events-none fixed left-3 top-3 z-50 rounded bg-black/60 px-2 py-1 font-mono text-xs text-sky-300">
      t={t.toFixed(3)} · [{active}] {label}
    </div>
  );
}
