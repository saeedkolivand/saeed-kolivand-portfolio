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

/** Total scroll length (vh). A wheel notch is fixed px, so more height = less t per notch -- primary pacing knob. */
const SPACER_VH = 2400;
/** Lenis wheel gain (default 1). Below 1 softens each notch a bit more -- secondary pacing knob. */
const WHEEL_MULTIPLIER = 0.7;

/** The live Lenis instance while ScrollProxy is mounted (module-scope so diegetic UI can drive it). */
let activeLenis: Lenis | null = null;

/**
 * Programmatic scroll surface for diegetic UI (e.g. the Issue 5 "See
 * projects" CTA): smooth-scroll the document so global progress lands on
 * `t`. lenis.limit is the max scroll value (lenis 1.3.25 README), matching
 * ScrollTrigger's 0->"max" progress mapping. Instant under reduced motion.
 */
export function scrollToT(t: number) {
  const lenis = activeLenis;
  if (!lenis) return;
  const target = Math.min(Math.max(t, 0), 1) * lenis.limit;
  if (useScrollStore.getState().reducedMotion) lenis.scrollTo(target, { immediate: true });
  else lenis.scrollTo(target, { duration: 2.2 });
}

export default function ScrollProxy() {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const lenis = new Lenis({ wheelMultiplier: WHEEL_MULTIPLIER });
    activeLenis = lenis;
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    const store = useScrollStore.getState();
    const st = ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate: (self) => {
        // ~[-1,1] at a fast wheel fling; the boil/speed-line uniforms want this
        const v = gsap.utils.clamp(-1.5, 1.5, self.getVelocity() / 4000);
        useScrollStore.getState().setT(self.progress, v);
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

  // total scroll length (pacing ruling 2026-07-02: 2x the original ~1200vh)
  return <div aria-hidden style={{ height: `${SPACER_VH}vh` }} />;
}
