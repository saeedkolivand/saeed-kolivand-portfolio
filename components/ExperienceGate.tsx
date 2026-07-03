"use client";

import { useEffect, useRef, useState } from "react";
import { links, printEdition } from "@/lib/content";
import { useScrollStore } from "@/lib/scrollStore";
import AudioToggle from "./AudioToggle";
import Experience from "./Experience";
import JumpCover from "./JumpCover";
import Lettering from "./Lettering";
import PressCta from "./PressCta";
import PrintEdition from "./PrintEdition";
import ScrollProxy from "./ScrollProxy";
import styles from "./PrintEdition.module.css";

/*
 * ExperienceGate (SPEC Phase 5 + S8): the mount decision. Always renders the
 * PrintEdition semantic document. Server + first client paint render PRINT
 * ONLY (all state defaults false) so there is no hydration mismatch and no
 * window access at render scope. A single effect decides, client-side:
 *
 *   showExperience = NOT prefers-reduced-motion AND NOT mobile/low
 *                    AND WebGL-available AND NOT user-forced-reader.
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
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function ExperienceGate() {
  const printRef = useRef<HTMLDivElement>(null);
  const [showExperience, setShowExperience] = useState(false);
  const [forceReader, setForceReader] = useState(false);
  const [forceExperience, setForceExperience] = useState(false);
  const [capable, setCapable] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const prefersReduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = matchMedia("(pointer: coarse)").matches;
    const narrow = window.innerWidth < 820;
    const low = new URLSearchParams(location.search).has("low");
    const mobileLow = coarse || narrow || low;

    const store = useScrollStore.getState();
    store.setReducedMotion(prefersReduced);
    if (low) store.setQuality("low");

    const webgl = !prefersReduced && !mobileLow ? probeWebGL() : false;

    setReduced(prefersReduced);
    setCapable(!mobileLow); // desktop-class hardware; gates the opt-in offer
    setShowExperience(!prefersReduced && !mobileLow && webgl);
  }, []);

  // Decorative DevTools console greeting. ExperienceGate always mounts, so this
  // fires on EVERY load -- animated and reduced-motion/print paths alike. Client
  // only (useEffect), guarded once, log level only. No engine/beat interaction.
  useEffect(() => {
    logConsoleEgg();
  }, []);

  const effectiveShow = !forceReader && (showExperience || forceExperience);
  // Offer "watch the animated version" only on capable hardware currently in
  // print mode -- the reduced-motion opt-in, and the undo for a manual switch.
  const offerExperience = capable && !effectiveShow && (reduced || forceReader);

  const revealReader = () => {
    // A keyboard/AT user tabbed into the print doc hidden behind the canvas:
    // reveal it and tear the whole interactive stack down so focus is visible.
    if (effectiveShow) setForceReader(true);
  };

  return (
    <>
      {effectiveShow ? (
        <button type="button" className={styles.switchReader} onClick={() => setForceReader(true)}>
          {printEdition.toReaderLabel}
        </button>
      ) : null}

      <div ref={printRef} className={effectiveShow ? styles.behind : undefined} onFocus={revealReader}>
        <PrintEdition />
      </div>

      {offerExperience ? (
        <button
          type="button"
          className={styles.switchExperience}
          onClick={() => {
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
          <AudioToggle />
          <JumpCover />
          <ScrollProxy />
        </>
      ) : null}
    </>
  );
}
