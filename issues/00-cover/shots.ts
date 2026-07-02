import type { EaseFn, Shot } from "@/lib/shots";
import { issueCenter, RANGES } from "../timeline";

/**
 * Cover shot list (S0.8, mirrored in ./shots.md).
 *
 * ONE compiled Shot with a compound ease instead of hold + crash as two
 * shots: compileSegments hardcodes intra-issue gutters to "whip", and a
 * whip smear over static, readable cover lettering violates S2.16. The
 * hold phase lives in the flat first half of the ease (attract drift),
 * the crash in the cubic back half. Scrub-safe pure f(t) either way.
 */

const [START, END] = RANGES[0]!;
const [cx, cy, cz] = issueCenter(0);

/** First half: slow attract drift (<=5% of travel). Back half: cubic crash. */
const attractCrash: EaseFn = (x) => {
  const k = Math.max(0, (x - 0.5) * 2);
  return 0.1 * x + 0.9 * k * k * k;
};

export const COVER_SHOTS: Shot[] = [
  {
    id: "cover-attract-crash",
    issue: 0,
    range: [START, END],
    kind: "dolly", // hold/dolly keep pointer parallax alive during attract
    // attract pose leaves a ~8vh ink-void band below the cover: the DOM
    // attract prompt (Lettering.tsx) lives there, clear of the barcode
    from: { position: [cx, cy + 1, cz + 15.8], target: [cx, cy + 1, cz], roll: -0.012, fov: 40 },
    to: { position: [cx, cy + 0.75, cz + 5.3], target: [cx, cy + 0.5, cz], roll: 0.025, fov: 47 },
    ease: attractCrash,
  },
];
