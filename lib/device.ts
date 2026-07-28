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

/** Fine-pointer (desktop) minimum width. Below this the compositions do not fit. */
const MIN_WIDTH = 820;

/**
 * Coarse-pointer devices are separated by their SHORT side, not their width.
 * Width alone fails badly in landscape: an iPhone 15 Pro is 852 CSS px wide and
 * a 16 Pro Max is 956, so a width test at 820 admits every current iPhone above
 * the mini -- with roughly 430 px of height, and at an aspect of 2.17 where
 * projected word-art area SHRINKS by 0.74x against the desktop baseline, so
 * blocks can drop under the ink-exemption threshold and lose their exemption.
 *
 * The short side separates the two classes with a wide margin and needs no
 * per-device list.
 *
 * The threshold sits at 560 rather than something nearer the raw device sizes
 * because this is measured against innerWidth/innerHeight, which EXCLUDE the
 * browser's tab bar and toolbar. In landscape the short side is innerHeight, so
 * an iPad mini's 744 screen height arrives here as roughly 664. Meanwhile a
 * phone's short side can never exceed its portrait width (440 on a 16 Pro Max),
 * because in landscape the min is the height -- and chrome only ever shrinks
 * both. That leaves a safe band of about 440 to 660, and 560 sits in the middle
 * of it with room on either side.
 *
 * Deliberately NOT screen.width/screen.height, which would be chrome-independent
 * but would also not shrink in iPad Split View -- a 507px Slide Over pane would
 * then read as a tablet and get the cropped compositions the 390px audit
 * rejected.
 */
const MIN_SHORT_SIDE = 560;

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
  // Portrait iPad DOES auto-mount: its short side clears 700 (mini is 744).
  // Deliberate -- the audit found portrait one crop short of clean (spread's
  // "THE HEADLIN[E]"), which is a blemish in one scene, and rotating fixes it.
  // Locking every portrait tablet out over that would cost far more than it
  // saves.
  const shortSide = Math.min(window.innerWidth, window.innerHeight);
  const tablet = coarse && shortSide >= MIN_SHORT_SIDE;
  const narrow = coarse ? !tablet : window.innerWidth < MIN_WIDTH;
  // ?low forces the low tier for profiling. It does NOT block the experience --
  // a flag that dumped you into Print Edition could never be used to measure
  // the low tier it names.
  const forced = new URLSearchParams(location.search).has("low");
  return { reduced, narrow, tablet, low: tablet || forced };
}
