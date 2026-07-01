import { create } from "zustand";
import { scenes } from "@/scenes/registry";

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

// Derive the active scene from the (possibly non-uniform) registry ranges, not floor(t*N).
const indexFromT = (t: number): number => {
  for (let i = scenes.length - 1; i > 0; i--) if (t >= scenes[i]!.range[0]) return i;
  return 0;
};

export const useScrollStore = create<ScrollState>((set) => ({
  t: 0,
  activeIndex: 0,
  quality: "high",
  reducedMotion: false,
  audio: false,
  setT: (t) =>
    set((s) => {
      const activeIndex = indexFromT(t);
      return activeIndex === s.activeIndex ? { t } : { t, activeIndex };
    }),
  setQuality: (quality) => set({ quality }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  setAudio: (audio) => set({ audio }),
}));
