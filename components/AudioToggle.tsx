"use client";

import { useScrollStore } from "@/lib/scrollStore";
import { disableAudio, enableAudio } from "@/lib/audio/director";

/**
 * Sound on/off toggle on the post-exempt DOM layer (S2.16 -- crisp single
 * layer, printed-comic idiom: paper fill, ink border, hard offset shadow).
 * Bottom-right corner: clear of the attract prompt + Press CTA (bottom
 * center), noir caption spots, and the ?debug PerfHUD (top-left). OFF by
 * default, never autoplays -- enableAudio() runs synchronously inside the
 * click so Tone.start() gets its user-gesture unlock. Native button =
 * keyboard operable.
 */

const PAPER = "#F2EAD9";
const INK = "#14110E";
const RED = "#E2574C";

export default function AudioToggle() {
  const on = useScrollStore((s) => s.audioOn);
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label="Sound"
      onClick={() => (useScrollStore.getState().audioOn ? disableAudio() : enableAudio())}
      className="fixed bottom-4 right-4 z-30"
      style={{
        fontFamily: "var(--font-bangers)",
        fontSize: "clamp(13px, 1.8vh, 17px)",
        letterSpacing: "0.08em",
        padding: "0.35em 0.9em",
        background: on ? INK : PAPER,
        color: on ? PAPER : INK,
        border: `3px solid ${INK}`,
        borderRadius: "10px",
        boxShadow: `4px 4px 0 ${on ? RED : INK}`,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      SOUND {on ? "ON" : "OFF"}
    </button>
  );
}
