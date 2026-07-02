import { DataTexture, NearestFilter, RedFormat } from "three";

/**
 * Shared 3-step toon ramp (S2.7). verified 2026-07 (three r185 docs):
 * gradientMap requires NearestFilter min+mag and NoColorSpace (default).
 */
let ramp: DataTexture | null = null;

export function toonRamp(): DataTexture {
  if (!ramp) {
    ramp = new DataTexture(new Uint8Array([70, 160, 255]), 3, 1, RedFormat);
    ramp.minFilter = NearestFilter;
    ramp.magFilter = NearestFilter;
    ramp.needsUpdate = true;
  }
  return ramp;
}
