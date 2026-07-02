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

export default function ScrollProxy() {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const lenis = new Lenis({ wheelMultiplier: WHEEL_MULTIPLIER });
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
      lenis.destroy();
    };
  }, []);

  // total scroll length (pacing ruling 2026-07-02: 2x the original ~1200vh)
  return <div aria-hidden style={{ height: `${SPACER_VH}vh` }} />;
}
