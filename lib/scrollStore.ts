import { create } from "zustand";

export type Quality = "high" | "low";

/**
 * Audio detail tier, the S0.6 ladder's audio rungs. Separate from `quality`
 * because shedding audio is cheap and inaudible while shedding render targets
 * is visible, so the two want independent control.
 *
 *   2  full   two convolvers crossfading, the room morphs across each gutter
 *   1  A1     one convolver, hard swap at the gutter midpoint
 *   0  A2     no convolution at all, one shared algorithmic reverb
 */
export type AudioTier = 0 | 1 | 2;

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
  audioTier: AudioTier;
  reducedMotion: boolean;
  audioOn: boolean;
  meowCount: number;
  /** Issue index a deep jump is loading toward (JumpCover fill up); null when idle. */
  jumpCover: number | null;
  setT: (t: number, velocity: number) => void;
  setActiveIssue: (i: number) => void;
  setJumpCover: (i: number | null) => void;
  setPointer: (x: number, y: number) => void;
  setQuality: (q: Quality) => void;
  setAudioTier: (v: AudioTier) => void;
  setReducedMotion: (v: boolean) => void;
  setAudioOn: (v: boolean) => void;
  meow: () => void;
}

export const useScrollStore = create<ScrollState>()((set) => ({
  t: 0,
  velocity: 0,
  activeIssue: 0,
  pointerX: 0,
  pointerY: 0,
  quality: "high",
  audioTier: 2,
  reducedMotion: false,
  audioOn: false,
  meowCount: 0,
  jumpCover: null,
  setT: (t, velocity) => set({ t, velocity }),
  setActiveIssue: (activeIssue) => set({ activeIssue }),
  setJumpCover: (jumpCover) => set({ jumpCover }),
  setPointer: (pointerX, pointerY) => set({ pointerX, pointerY }),
  setQuality: (quality) =>
    set((s) => ({ quality, audioTier: quality === "low" ? 1 : s.audioTier })),
  setAudioTier: (audioTier) => set({ audioTier }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  setAudioOn: (audioOn) => set({ audioOn }),
  meow: () => set((s) => ({ meowCount: s.meowCount + 1 })),
}));
