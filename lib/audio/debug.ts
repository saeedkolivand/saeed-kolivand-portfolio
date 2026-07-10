/**
 * Dev-only structural audio tap. Every fire* helper / sfxMoment case calls
 * logFire(name); the gate audit reads (window as any).__audioLog to assert
 * trigger counts per scroll window. Dead-stripped in production builds.
 */
import { useScrollStore } from "@/lib/scrollStore";

export function logFire(name: string): void {
  if (process.env.NODE_ENV === "production") return;
  if (typeof window === "undefined") return;
  const w = window as unknown as { __audioLog?: { name: string; t: number }[] };
  if (!w.__audioLog) w.__audioLog = [];
  w.__audioLog.push({ name, t: useScrollStore.getState().t });
}
