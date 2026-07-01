"use client";
import { useScrollStore } from "@/lib/scrollStore";
import { COLOR } from "./config";
import { CityInstances } from "./CityInstances";
import { Rain } from "./Rain";
import { HeroTower } from "./HeroTower";
import { SkyDome, WetStreet, GlassPane, GlowQuad } from "./Environment";

// OUTSIDE — "The One Warm Window": a cold, desaturated cyan rain-city that dissolves into the
// shared #05060a fog, with exactly one warm amber window (the desk) as the sole warm mark.
//
// Each animated shader self-clocks via useUniformClock — a per-material accumulator that only
// advances while reduced motion is off, so every animation (rain, smog, rivulets, ripples,
// flicker) freezes together into a calm static postcard for prefers-reduced-motion, with zero
// vestibular trigger (the camera flight itself is scroll-driven, never autonomous). Everything
// is instanced/pointed: ~13 scene draw calls. Camera flies +Z entry -> origin -> -Z exit.
export function OutsideScene() {
  const quality = useScrollStore((s) => s.quality);
  return (
    <>
      <SkyDome />
      <CityInstances quality={quality} />
      <Rain quality={quality} />
      <GlassPane />
      <WetStreet />
      <HeroTower />
      {/* Cold haze pocket in the canyon (the warm pocket rides the hero window). */}
      <GlowQuad color={COLOR.cyan} size={40} position={[14, -12, 20]} opacity={0.12} />
    </>
  );
}
