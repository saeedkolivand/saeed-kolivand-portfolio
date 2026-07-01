"use client";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group } from "three";
import { useScrollStore } from "@/lib/scrollStore";
import { insideBuilding } from "@/lib/insideBuilding";
import { COLOR } from "./config";
import { CityInstances } from "./CityInstances";
import { SkyDome, WetStreet, GlassPane, GlowQuad } from "./Environment";

// OUTSIDE — a cold, desaturated cyan noir city canyon that dissolves into the shared #05060a fog.
//
// Hidden once the camera is inside the building (see insideBuilding): OUTSIDE is co-mounted while
// DESK is active (±1 budget), so without this the city would still be visible around the monitor —
// i.e. the monitor would render before you've actually gone inside. Everything is instanced.
export function OutsideScene() {
  const quality = useScrollStore((s) => s.quality);
  const root = useRef<Group>(null);
  useFrame(() => {
    if (root.current) root.current.visible = !insideBuilding(useScrollStore.getState().t);
  });
  return (
    <group ref={root}>
      <SkyDome />
      <CityInstances quality={quality} />
      <GlassPane />
      <WetStreet />
      {/* Cold haze pocket in the canyon. */}
      <GlowQuad color={COLOR.cyan} size={40} position={[14, -12, 20]} opacity={0.12} />
    </group>
  );
}
