"use client";

import { useEffect, useRef, useState } from "react";
import { links, printEdition } from "@/lib/content";
import { readDeviceGate } from "@/lib/device";
import { useScrollStore } from "@/lib/scrollStore";
import { RANGES } from "@/issues/timeline";
import AudioToggle from "./AudioToggle";
import SoundInvite from "./SoundInvite";
import Experience from "./Experience";
import JumpCover from "./JumpCover";
import Lettering from "./Lettering";
import PressCta from "./PressCta";
import PrintEdition from "./PrintEdition";
import ScrollProxy, { scrollToT } from "./ScrollProxy";
import styles from "./PrintEdition.module.css";

/*
 * ExperienceGate (SPEC Phase 5 + S8): the mount decision. Always renders the
 * PrintEdition semantic document. Server + first client paint render PRINT
 * ONLY (all state defaults false) so there is no hydration mismatch and no
 * window access at render scope. A single effect decides, client-side:
 *
 *   showExperience = NOT prefers-reduced-motion AND NOT narrow viewport
 *                    AND WebGL-available AND NOT user-forced-reader.
 *
 * Touch devices are NOT excluded -- the disqualifier is viewport width, not
 * pointer type (lib/device.ts). Tablets auto-mount at the low quality tier.
 * Phones keep the Print Edition: a 390px audit found the authored compositions
 * crop badly there, and the print doc is the better narrow experience.
 *
 * When on, the interactive WebGL/scroll stack mounts as an overlay above the
 * print doc, which stays visually-hidden but in the a11y tree + SEO (never
 * inert / display:none / aria-hidden). When off, NONE of the WebGL/scroll
 * stack mounts -- zero WebGL, no Lenis spacer -- and print is the visible page
 * from first paint.
 */

// Only ever called on the not-reduced, not-mobile path (the path that will
// show the experience), so reduced-motion / mobile / low never create a
// WebGL context (S8 print path stays zero-WebGL).
// Module-level so it survives the StrictMode double-mount (dev) and any
// remount: the console greeting logs exactly once per page load.
let consoleEggLogged = false;

function logConsoleEgg(): void {
  if (consoleEggLogged) return;
  consoleEggLogged = true;
  const egg = printEdition.consoleEgg;
  // console.log level ONLY (a Phase 5 gate requires the console stays error-free).
  console.log(
    "%c" + egg.headline,
    "font-family:'Bangers',system-ui,sans-serif;font-size:38px;font-weight:700;color:#c63d2f;letter-spacing:2px;padding:8px 0;",
  );
  console.log(egg.lines.join("\n") + "\n" + links.githubUrl);
}

function probeWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    // Release it immediately. A detached canvas is not promptly GC'd on
    // WebKit and iOS caps live contexts per page, so a probe left holding one
    // costs a context right as R3F is about to ask for the real one.
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return !!gl;
  } catch {
    return false;
  }
}

/** Clamp an issue index into the valid 0..11 registry range. */
function clampIssue(i: number): number {
  return Math.min(11, Math.max(0, Math.round(i)));
}

/*
 * print -> 3D scroll map (WS-E): find which Print Edition section sits at the
 * viewport top and how far through it we have scrolled, then convert that to a
 * global t via the issue's authored range (RANGES). Sections render in document
 * order, so their getBoundingClientRect().top increases monotonically; the
 * current section is the last one whose top has passed above the viewport top
 * (top <= 0), and frac is how far its box has scrolled past. #projects and
 * #contact live past the last issue, so they fall back to issue 11's range.
 * MUST be read synchronously before the toggle collapses the print layout.
 */
function measurePrintT(): number {
  const sections: { issue: number; id: string }[] = [];
  for (let i = 0; i <= 11; i++) sections.push({ issue: i, id: "issue-" + i });
  sections.push({ issue: 11, id: "projects" });
  sections.push({ issue: 11, id: "contact" });

  let curIssue = 0;
  let frac = 0;
  for (const { issue, id } of sections) {
    const el = document.getElementById(id);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.top > 24) break; // 1rem scroll-margin (16px) + rounding headroom
    curIssue = issue;
    // a section resting at its scroll-margin (top ~16px) maps to frac 0 of THAT
    // issue; only extra scroll past the margin advances frac.
    frac = r.height > 0 ? Math.min(1, Math.max(0, -Math.min(r.top - 16, 0) / r.height)) : 0;
  }

  const [s, e] = RANGES[curIssue]!;
  return s + frac * (e - s);
}

export default function ExperienceGate() {
  const printRef = useRef<HTMLDivElement>(null);
  // WS-E scroll bridge: issue to scroll the print doc to after 3D -> print;
  // global t to restore in the 3D stack after print -> 3D. Consumed + cleared
  // by the mapping effect below.
  const pendingReaderIssue = useRef<number | null>(null);
  const pendingExperienceT = useRef<number | null>(null);
  const [showExperience, setShowExperience] = useState(false);
  const [forceReader, setForceReader] = useState(false);
  const [forceExperience, setForceExperience] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [noWebGL, setNoWebGL] = useState(false);

  useEffect(() => {
    const store = useScrollStore.getState();
    // Latch: once granted we never re-probe, so a device that stays narrow
    // never creates a WebGL context no matter how often it is resized.
    let granted = false;

    // `initial` distinguishes the one call where there is nothing to capture
    // from every later one, which is a LIVE grant over someone already reading
    // the print doc. Keying this on "did a resize cause it" missed the
    // reduce-motion path, which grants exactly the same way.
    const evaluate = (initial: boolean) => {
      const gate = readDeviceGate();
      store.setReducedMotion(gate.reduced);
      if (gate.low) store.setQuality("low");
      setReduced(gate.reduced);
      setNarrow(gate.narrow);
      // && short-circuits, so the print path still never creates a WebGL context.
      if (!granted && !gate.reduced && !gate.narrow && probeWebGL()) {
        granted = true;
        // Capture where they were, exactly as the deliberate opt-in does -- the
        // WS-E mapping effect reads this, and without it their scrollY is
        // reinterpreted against the 2400vh spacer and lands at an arbitrary t.
        if (!initial) pendingExperienceT.current = measurePrintT();
        setShowExperience(true);
      }
    };

    evaluate(true);

    // An OS-level reduce-motion change should be picked up on its own, not only
    // if the user also happens to resize the window (ScrollProxy already
    // subscribes to the same query properly).
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => evaluate(false);
    motion.addEventListener("change", onMotion);

    // Re-evaluate on rotate, GRANT ONLY -- never revoke, or a window drag would
    // tear a live canvas down mid-scroll. Coarse pointers only: this listener
    // exists so a portrait tablet rotated to landscape stops being stuck in
    // Print Edition. A desktop window drag has no rotation story behind it and
    // must not mount the 3D stack uninvited over someone who is reading.
    let resizeTimer = 0;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => evaluate(false), 150);
    };
    const coarse = matchMedia("(pointer: coarse)").matches;
    if (coarse) {
      addEventListener("resize", onResize);
      addEventListener("orientationchange", onResize);
    }
    return () => {
      clearTimeout(resizeTimer);
      motion.removeEventListener("change", onMotion);
      removeEventListener("resize", onResize);
      removeEventListener("orientationchange", onResize);
    };
  }, []);

  // Decorative DevTools console greeting. ExperienceGate always mounts, so this
  // fires on EVERY load -- animated and reduced-motion/print paths alike. Client
  // only (useEffect), guarded once, log level only. No engine/beat interaction.
  useEffect(() => {
    logConsoleEgg();
  }, []);

  const effectiveShow = !forceReader && (showExperience || forceExperience);
  // Offer "watch the animated version" to the reduced-motion opt-in and as the
  // undo for a manual switch. Withdrawn once a probe has actually failed, so
  // the button is never a dead control.
  //
  // Deliberately NOT offered on narrow viewports. A 390px audit found copy
  // cropped on both sides in 8 of the 12 scenes and no subject framed at all in
  // the desk issue -- the compositions are authored wide and a phone cannot hold
  // them. The Print Edition is the better phone experience until the scenes
  // carry narrow-safe framing (the frame-guard pattern in Pop.tsx:742 and
  // Sketchbook.tsx:340 is the model for that).
  //
  // `|| showExperience` keeps the UNDO working: a tablet that was granted the
  // experience and then rotated to portrait must still be able to come back
  // from the reader. It only ever re-offers what this session already had.
  const offerExperience =
    !effectiveShow && !noWebGL && (reduced || forceReader) && (!narrow || showExperience);

  // WS-E: map scroll position across the print <-> 3D toggle. Runs whenever the
  // mount decision flips. Into the experience: restore the t captured from the
  // print doc -- the child ScrollProxy's mount effect runs before this parent
  // effect, so activeLenis is live (scrollToT still guards null). Into the print
  // doc: scroll the now-visible section into view (Lenis is gone, plain DOM). No
  // pending value on first load, so this never scrolls on initial mount.
  useEffect(() => {
    if (effectiveShow) {
      const t = pendingExperienceT.current;
      if (t !== null) {
        pendingExperienceT.current = null;
        scrollToT(t, { immediate: true });
      }
    } else {
      const i = pendingReaderIssue.current;
      if (i !== null) {
        pendingReaderIssue.current = null;
        document.getElementById("issue-" + i)?.scrollIntoView();
      }
    }
  }, [effectiveShow]);

  // 3D -> print: capture the live issue BEFORE tearing the stack down, so the
  // print doc can scroll to the matching section once it becomes visible.
  const goToReader = () => {
    pendingReaderIssue.current = clampIssue(useScrollStore.getState().activeIssue);
    setForceReader(true);
  };

  const revealReader = () => {
    // A keyboard/AT user tabbed into the print doc hidden behind the canvas:
    // reveal it and tear the whole interactive stack down so focus is visible.
    // Do NOT capture pendingReaderIssue here -- the focus path must not
    // reposition, or the tabbed-to element gets yanked out from under the user.
    // Only the visible button click (goToReader) scrolls to the active issue.
    if (effectiveShow) setForceReader(true);
  };

  return (
    <>
      {effectiveShow ? (
        <button type="button" className={styles.switchReader} onClick={goToReader}>
          {printEdition.toReaderLabel}
        </button>
      ) : null}

      {/*
       * AudioToggle sits BEFORE the print doc in DOM order, and must stay there.
       * It is position:fixed, so this costs nothing visually, but tab order
       * follows the DOM: anything after the print doc is unreachable by
       * keyboard, because focusing a print link bubbles focusin to
       * revealReader below, which tears this whole stack down. Placed after,
       * the sound control could never be reached without a mouse.
       */}
      {effectiveShow ? <AudioToggle /> : null}
      {/* Same DOM-order rule as AudioToggle above: this has buttons, so placing
          it after the print doc would make it mouse-only. */}
      {effectiveShow ? <SoundInvite /> : null}

      <div ref={printRef} className={effectiveShow ? styles.behind : undefined} onFocus={revealReader}>
        <PrintEdition />
      </div>

      {offerExperience ? (
        <button
          type="button"
          className={styles.switchExperience}
          onClick={() => {
            // First WebGL probe on this path -- the offer is shown without one so
            // the print path stays zero-WebGL until the user actually asks.
            // On failure, withdraw the offer rather than leaving a dead button.
            if (!probeWebGL()) {
              setNoWebGL(true);
              return;
            }
            // print -> 3D: measure the in-view section synchronously, BEFORE the
            // state change collapses the print layout, then restore in the effect.
            pendingExperienceT.current = measurePrintT();
            setForceReader(false);
            setForceExperience(true);
          }}
        >
          {printEdition.toExperienceLabel}
        </button>
      ) : null}

      {effectiveShow ? (
        <>
          <Experience />
          <Lettering />
          <PressCta />
          <JumpCover />
          <ScrollProxy />
        </>
      ) : null}
    </>
  );
}
