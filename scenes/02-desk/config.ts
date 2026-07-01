// Tunables for the DESK scene — "the warm room": the lamp-lit interior the OUTSIDE warm
// window belonged to. The camera flies in over the desk toward a monitor showing a live code
// editor, closing on the screen to set up the ENTER MONITOR dive. Warm lamp (the same
// #ffcf8a as the OUTSIDE window, for continuity) against a cool glowing editor.

/** Palette — warm interior, cool screen. */
export const COLOR = {
  wall: "#070709", // near-black room shell — reads as a dark room and vanishes into the
  // #05060a background when it briefly co-mounts with the OUTSIDE scene (no visible bleed).
  desk: "#241a12", // dark wood
  bezel: "#070709", // monitor frame, near-black
  keyboard: "#14121a",
  warm: "#ffcf8a", // lamp glow — matches the OUTSIDE window (narrative continuity)
  screenBg: "#0d1117", // editor background
  screenCool: "#9fd0ff", // cool light the monitor casts into the room
} as const;

/** Local-frame layout (camera flies +Z entry -> origin -> -Z, +Y up). The monitor faces +Z
 *  so the camera approaches the screen head-on; the room is an open-fronted tunnel in -Z. */
// A tight, fully-enclosed pocket: walls (halfWidth 18 < OUTSIDE's tower reach at x~30) occlude
// the exterior city so the interior reads clean, and the monitor sits close to the origin so it
// dominates the view the moment the camera arrives at DESK centre.
export const LAYOUT = {
  monitor: { pos: [0, -0.5, -11] as const, screen: [15, 8.4] as const, bezel: 0.5 },
  desk: { y: -5.4, z: -8, depth: 26, width: 40, thick: 1.2 },
  keyboard: { pos: [0, -4.7, -6] as const, size: [10, 0.5, 3.6] as const },
  lamp: { pos: [10, 8, -8] as const, intensity: 55, distance: 40, size: 0.6 },
  screenLight: { intensity: 14, distance: 30 }, // cool spill from the monitor
  // front kept modest so the room doesn't reach far upstream into the OUTSIDE scene (which is
  // co-mounted during the transition); back/walls still enclose the camera at DESK centre.
  room: { front: 16, back: -24, floor: -8, ceiling: 13, halfWidth: 18 },
} as const;
