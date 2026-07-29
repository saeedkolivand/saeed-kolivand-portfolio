"use client";

import { useEffect, useRef, useState } from "react";
import { useScrollStore } from "@/lib/scrollStore";
import { enableAudio } from "@/lib/audio/director";
import { lettering } from "@/lib/content";
import { clamp01 } from "@/lib/shots";
import { RANGES } from "@/issues/timeline";

/**
 * The sound-on invitation (S5b activation): a one-time cover card in the comic
 * idiom, arming audio inside the user's own click.
 *
 * This exists because everything the audio rebuild shipped is unreachable by
 * default. Audio is OFF until a gesture, correctly -- but the only door was a
 * 13 px "SOUND OFF" chip in the corner, which most visitors will never read as
 * an invitation to turn anything on.
 *
 * Choice persists in localStorage: the FIRST use of storage in this repo, so
 * it is read only inside an effect, never at render scope. The SSR rule is
 * that the server and the first client paint agree, and they only do if the
 * card starts hidden and appears on the second paint.
 *
 * Persistence deliberately means "do not ask twice", not "restore the choice".
 * Audio cannot be resumed without a gesture anyway, so a returning visitor who
 * said yes gets no card and the toggle they already know about.
 *
 * Presence is pure f(t) over the cover segment, like PressCta -- so scrubbing
 * back to the cover brings it back, and no timer owns anything.
 */

const KEY = "sk.sound-invite";
/** Fades out across the back half of the cover segment. */
const FADE: readonly [number, number] = [RANGES[0]![1] * 0.45, RANGES[0]![1]];

const PAPER = "#F2EAD9";
const INK = "#14110E";
const RED = "#E2574C";

export default function SoundInvite() {
  const [ask, setAsk] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setAsk(true);
    } catch {
      // Storage blocked (private mode, third-party context). Ask anyway and
      // simply forget the answer -- an invitation that cannot be remembered is
      // still better than one that never appears.
      setAsk(true);
    }
  }, []);

  useEffect(() => {
    if (!ask) return;
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const el = box.current;
      if (!el) return;
      const { t } = useScrollStore.getState();
      const o = 1 - clamp01((t - FADE[0]) / (FADE[1] - FADE[0]));
      el.style.opacity = o.toFixed(3);
      el.style.visibility = o > 0.001 ? "visible" : "hidden";
      // Only clickable while it is actually legible, so a ghost at 5% opacity
      // can never eat a scroll gesture aimed at the cover.
      el.style.pointerEvents = o > 0.5 ? "auto" : "none";
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [ask]);

  if (!ask) return null;

  const answer = (on: boolean) => {
    // enableAudio() FIRST and synchronously: Tone.start() needs to be reached
    // from inside this click's task or the unlock is refused. Nothing may be
    // awaited ahead of it.
    if (on) enableAudio();
    try {
      localStorage.setItem(KEY, on ? "on" : "off");
    } catch {
      // not fatal; the card just reappears next visit
    }
    setAsk(false);
  };

  const button = (label: string, primary: boolean, on: boolean) => (
    <button
      type="button"
      onClick={() => answer(on)}
      style={{
        fontFamily: "var(--font-bangers)",
        fontSize: "clamp(14px, 2vh, 19px)",
        letterSpacing: "0.07em",
        padding: "0.3em 1em",
        background: primary ? INK : "transparent",
        color: primary ? PAPER : INK,
        border: `3px solid ${INK}`,
        borderRadius: "9px",
        boxShadow: primary ? `4px 4px 0 ${RED}` : "none",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      ref={box}
      // dvh, not vh: vh is the LARGE viewport on iOS, so a vh offset is
      // measured against a box 168 px taller than what is on screen.
      className="fixed left-1/2 z-30"
      style={{
        // Sits in the ink-void band at the very bottom, OVER the attract
        // prompt. At any offset high enough to clear the prompt the card lands
        // on the cover blurb instead, and the blurb is copy while the prompt is
        // an instruction that has not become relevant yet: the sound question
        // is the first decision, the scroll is the one after it. Answering
        // uncovers the prompt.
        bottom: "2.2dvh",
        transform: "translateX(-50%)",
        opacity: 0,
        visibility: "hidden",
        pointerEvents: "none",
        textAlign: "center",
        background: PAPER,
        border: `3px solid ${INK}`,
        borderRadius: "12px",
        boxShadow: `6px 6px 0 ${INK}`,
        padding: "0.45em 1.2em 0.6em",
        // Wide enough to cover the attract prompt it sits on top of. The
        // prompt's font is clamped at 30px, which caps it at ~350px, so 25rem
        // hides it at every viewport rather than leaving its first and last
        // letters poking out either side of the card looking like a bug.
        minWidth: "min(92vw, 25rem)",
        maxWidth: "min(92vw, 46ch)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-bangers)",
          fontSize: "clamp(11px, 1.5vh, 14px)",
          letterSpacing: "0.16em",
          color: RED,
        }}
      >
        {lettering.cover.sound.kicker}
      </div>
      <div
        style={{
          fontFamily: "var(--font-bangers)",
          fontSize: "clamp(24px, 4vh, 40px)",
          lineHeight: 1,
          letterSpacing: "0.03em",
          color: INK,
        }}
      >
        {lettering.cover.sound.headline}
      </div>
      <div
        style={{
          fontFamily: "var(--font-caveat)",
          fontSize: "clamp(14px, 2vh, 19px)",
          lineHeight: 1.2,
          margin: "0.25em 0 0.7em",
          color: INK,
        }}
      >
        {lettering.cover.sound.sub}
      </div>
      <div style={{ display: "flex", gap: "0.6em", justifyContent: "center" }}>
        {button(lettering.cover.sound.yes, true, true)}
        {button(lettering.cover.sound.no, false, false)}
      </div>
    </div>
  );
}
