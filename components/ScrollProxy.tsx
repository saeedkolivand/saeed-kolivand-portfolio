"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { useScrollStore } from "@/lib/scrollStore";

/**
 * S2.2 scroll model: Lenis -> one ScrollTrigger -> normalized t in the store.
 * The SPACER_VH spacer below is the entire scrollable document.
 *
 * verified 2026-07 (lenis 1.3.25 README): drive vanilla Lenis from
 * gsap.ticker with lenis.raf(time * 1000), lagSmoothing(0), and
 * lenis.on('scroll', ScrollTrigger.update); no scrollerProxy needed on
 * window, and vanilla autoRaf already defaults to false.
 */

/** Base scroll length (vh) before the slow-window stretch. A wheel notch is fixed px, so more height = less t per notch -- primary pacing knob. */
const BASE_SPACER_VH = 2400;
/** Lenis wheel gain (default 1). Below 1 softens each notch a bit more -- secondary pacing knob. */
const WHEEL_MULTIPLIER = 0.7;
/** t-range that scrolls slow: crash-through gutter entry through the end of the noir facade whip (taste knob). */
const SLOW_WINDOW: readonly [number, number] = [0.028, 0.082];
/** Scroll distance multiplier inside SLOW_WINDOW (2 = twice the scroll per t; taste knob). */
const SLOW_FACTOR = 2;
/** Extra scroll length the slow window adds, in units of the linear total. */
const SLOW_EXTRA = (SLOW_FACTOR - 1) * (SLOW_WINDOW[1] - SLOW_WINDOW[0]);
/** Total scroll length (vh), grown by exactly SLOW_EXTRA so every region outside the window keeps its px-per-t feel. */
const SPACER_VH = BASE_SPACER_VH * (1 + SLOW_EXTRA);

/**
 * Non-uniform pacing curve (ruling 2026-07-03): monotone piecewise-linear
 * remap from raw scroll progress s in [0,1] to t. Scroll distance per unit t
 * is SLOW_FACTOR inside SLOW_WINDOW and 1 elsewhere, so all t-space
 * authoring (issues/**, shots, lettering) is untouched. Monotone pure
 * function of scrollY = scrub-safe both directions.
 */
function progressToT(s: number): number {
  const u = s * (1 + SLOW_EXTRA); // scroll position measured in linear-t units
  const [a, b] = SLOW_WINDOW;
  if (u <= a) return u;
  const uEnd = a + (b - a) * SLOW_FACTOR;
  if (u <= uEnd) return a + (u - a) / SLOW_FACTOR;
  return u - SLOW_EXTRA;
}

/** Exact inverse of progressToT, so scrollToT(t) lands on precisely t. */
export function tToProgress(t: number): number {
  const [a, b] = SLOW_WINDOW;
  const u = t <= a ? t : t <= b ? a + (t - a) * SLOW_FACTOR : t + SLOW_EXTRA;
  return u / (1 + SLOW_EXTRA);
}

/** The live Lenis instance while ScrollProxy is mounted (module-scope so diegetic UI can drive it). */
let activeLenis: Lenis | null = null;

/**
 * Programmatic scroll surface for diegetic UI (e.g. the Issue 5 "See
 * projects" CTA): smooth-scroll the document so global progress lands on
 * `t`. lenis.limit is the max scroll value (lenis 1.3.25 README), matching
 * ScrollTrigger's 0->"max" progress mapping. Instant under reduced motion,
 * or when opts.immediate is set (print<->3D toggle jump: no scrub animation
 * across a document swap).
 */
export function scrollToT(t: number, opts?: { immediate?: boolean }) {
  const lenis = activeLenis;
  if (!lenis) return;
  const target = tToProgress(Math.min(Math.max(t, 0), 1)) * lenis.limit;
  if (opts?.immediate || useScrollStore.getState().reducedMotion) {
    lenis.scrollTo(target, { immediate: true });
  } else {
    lenis.scrollTo(target, { duration: 2.2 });
  }
}

export default function ScrollProxy() {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const lenis = new Lenis({ wheelMultiplier: WHEEL_MULTIPLIER });
    activeLenis = lenis;
    lenis.on("scroll", ScrollTrigger.update);
    // scroll-velocity settle: ScrollTrigger only fires onUpdate while scroll
    // events arrive, so the store's velocity would otherwise LATCH its last
    // fling value (sign and all) forever at rest. Snap it to the canonical 0
    // after a fixed quiet window -- pure f(rest), same from either scrub
    // direction (Issue 7 gate check-4 hygiene).
    let lastScrollUpdate = 0;
    const VELOCITY_SETTLE_MS = 200;
    const tick = (time: number) => {
      lenis.raf(time * 1000);
      const s = useScrollStore.getState();
      if (s.velocity !== 0 && performance.now() - lastScrollUpdate > VELOCITY_SETTLE_MS) {
        s.setT(s.t, 0);
      }
    };
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    const store = useScrollStore.getState();
    const st = ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate: (self) => {
        // ~[-1,1] at a fast wheel fling; the boil/speed-line uniforms want this
        const v = gsap.utils.clamp(-1.5, 1.5, self.getVelocity() / 4000);
        lastScrollUpdate = performance.now();
        useScrollStore.getState().setT(progressToT(self.progress), v);
      },
    });

    const onPointer = (e: PointerEvent) =>
      useScrollStore
        .getState()
        .setPointer((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
    addEventListener("pointermove", onPointer);

    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const onMq = () => useScrollStore.getState().setReducedMotion(mq.matches);
    onMq();
    mq.addEventListener("change", onMq);

    if (new URLSearchParams(location.search).has("low")) store.setQuality("low");

    return () => {
      removeEventListener("pointermove", onPointer);
      mq.removeEventListener("change", onMq);
      st.kill();
      gsap.ticker.remove(tick);
      if (activeLenis === lenis) activeLenis = null;
      lenis.destroy();
    };
  }, []);

  // total scroll length: 2400vh linear base (ruling 2026-07-02) + slow-window stretch (ruling 2026-07-03)
  return <div aria-hidden style={{ height: `${SPACER_VH}vh` }} />;
}
