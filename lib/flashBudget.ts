/**
 * S2.13 flash guard -- hard cap of 3 flashes in any rolling second
 * (WCAG 2.3.1). Every impact frame / glitch pop must be granted here first.
 */
const stamps: number[] = [];

export function requestFlash(now = performance.now()): boolean {
  while (stamps.length && now - stamps[0]! > 1000) stamps.shift();
  if (stamps.length >= 3) return false;
  stamps.push(now);
  return true;
}
