import { create } from "zustand";
import { SCENE_COUNT } from "@/lib/spline";

export type QualityTier = "high" | "low";

interface ScrollState {
  /** Normalized scroll progress across the whole journey, 0..1. */
  t: number;
  /** Index of the scene the camera is currently in. Changes only on boundary crossings. */
  activeIndex: number;
  quality: QualityTier;
  reducedMotion: boolean;
  audio: boolean;
  setT: (t: number) => void;
  setQuality: (q: QualityTier) => void;
  setReducedMotion: (v: boolean) => void;
  setAudio: (v: boolean) => void;
}

const indexFromT = (t: number): number =>
  Math.min(SCENE_COUNT - 1, Math.max(0, Math.floor(t * SCENE_COUNT)));

export const useScrollStore = create<ScrollState>((set) => ({
  t: 0,
  activeIndex: 0,
  quality: "high",
  reducedMotion: false,
  audio: false,
  // ponytail: activeIndex assumes scenes evenly tile [0,1]. When real scenes get uneven
  // ranges, derive the index from the registry ranges instead of floor(t * SCENE_COUNT).
  setT: (t) =>
    set((s) => {
      const activeIndex = indexFromT(t);
      return activeIndex === s.activeIndex ? { t } : { t, activeIndex };
    }),
  setQuality: (quality) => set({ quality }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  setAudio: (audio) => set({ audio }),
}));
