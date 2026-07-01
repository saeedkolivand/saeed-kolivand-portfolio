"use client";
import { useTexture } from "@react-three/drei";
import { RepeatWrapping, SRGBColorSpace, type Texture } from "three";

// Loads a texture and configures colorspace / wrapping in the load callback — never mutates a
// hook return value during render, so it satisfies react-hooks/immutability. sRGB by default
// (all our source PNGs are authored sRGB); pass { wrap: true } for tiled maps and { srgb: false }
// for raw data/intensity maps. Suspends until loaded (needs a <Suspense> boundary — Canvas3D has one).
export function useAssetTexture(
  url: string,
  opts?: { wrap?: boolean; srgb?: boolean; repeat?: [number, number] },
): Texture {
  return useTexture(url, (loaded) => {
    const tex = Array.isArray(loaded) ? loaded[0] : loaded;
    if (!tex) return;
    if (opts?.srgb !== false) tex.colorSpace = SRGBColorSpace;
    if (opts?.wrap || opts?.repeat) {
      tex.wrapS = tex.wrapT = RepeatWrapping;
      tex.anisotropy = 8; // tiled maps are viewed at grazing angles from the flying camera
    }
    if (opts?.repeat) tex.repeat.set(opts.repeat[0], opts.repeat[1]);
  });
}
