import { create } from "zustand";

export type Quality = "high" | "low";

interface ScrollState {
  /** Normalized global scroll progress, the single timeline driver. */
  t: number;
  /** Smoothed scroll velocity, roughly [-1, 1] after normalization. */
  velocity: number;
  /** Index into the issue registry (derived from t each frame). */
  activeIssue: number;
  /** Pointer position in NDC [-1, 1] for parallax. */
  pointerX: number;
  pointerY: number;
  quality: Quality;
  reducedMotion: boolean;
  audioOn: boolean;
  meowCount: number;
  setT: (t: number, velocity: number) => void;
  setActiveIssue: (i: number) => void;
  setPointer: (x: number, y: number) => void;
  setQuality: (q: Quality) => void;
  setReducedMotion: (v: boolean) => void;
  meow: () => void;
}

export const useScrollStore = create<ScrollState>()((set) => ({
  t: 0,
  velocity: 0,
  activeIssue: 0,
  pointerX: 0,
  pointerY: 0,
  quality: "high",
  reducedMotion: false,
  audioOn: false,
  meowCount: 0,
  setT: (t, velocity) => set({ t, velocity }),
  setActiveIssue: (activeIssue) => set({ activeIssue }),
  setPointer: (pointerX, pointerY) => set({ pointerX, pointerY }),
  setQuality: (quality) => set({ quality }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  meow: () => set((s) => ({ meowCount: s.meowCount + 1 })),
}));
