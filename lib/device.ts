/**
 * The device gate -- the single place that decides who gets the 3D experience
 * and at which quality tier. ExperienceGate is the ONLY caller and the only
 * writer of the quality tier; keeping the policy here rather than inline keeps
 * the decision reviewable in one piece and out of a component that is already
 * doing four other jobs.
 *
 * Client only: call from an effect, never at render scope. The server and the
 * first client paint render Print Edition with every state default false, and
 * touching matchMedia/location/innerWidth at render scope would break that.
 *
 * Tablets run the experience at the LOW tier. An iPad reports `pointer:
 * coarse` exactly like a phone, but a 1024px-wide viewport shows the authored
 * wide compositions fine and an M-series iPad outruns most laptops, so pointer
 * type alone is the wrong disqualifier -- viewport width is. UA sniffing is not
 * an option here: iPadOS Safari defaults to "Request Desktop Website" and
 * reports itself as macOS.
 */

/** Below this the authored wide compositions do not fit; Print Edition wins. */
const MIN_WIDTH = 820;

export interface DeviceGate {
  /** prefers-reduced-motion: reduce */
  reduced: boolean;
  /** viewport too narrow for the authored compositions (phones, tiny windows) */
  narrow: boolean;
  /** touch-first but wide enough: iPad and friends */
  tablet: boolean;
  /** low quality tier -- any touch/narrow device that ends up running 3D, or ?low */
  low: boolean;
}

export function readDeviceGate(): DeviceGate {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarse = matchMedia("(pointer: coarse)").matches;
  const narrow = window.innerWidth < MIN_WIDTH;
  // ?low forces the low tier for profiling. It does NOT block the experience --
  // a flag that dumped you into Print Edition could never be used to measure
  // the low tier it names.
  const forced = new URLSearchParams(location.search).has("low");
  const tablet = coarse && !narrow;
  return { reduced, narrow, tablet, low: tablet || forced };
}
