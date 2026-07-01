// Tunables for the DESK scene — "the warm room": the lamp-lit interior the OUTSIDE warm
// window belonged to. The camera flies in over the desk toward a monitor showing a live code
// editor, closing on the screen to set up the ENTER MONITOR dive. Warm lamp (the same
// #ffcf8a as the OUTSIDE window, for continuity) against a cool glowing editor.

/** Palette — warm interior, cool screen. */
export const COLOR = {
  wall: "#070709", // near-black room shell — reads as a dark room and vanishes into the
  // #05060a background when it briefly co-mounts with the OUTSIDE scene (no visible bleed).
  bezel: "#070709", // monitor frame, near-black
  keyboard: "#14121a",
  warm: "#ffcf8a", // lamp glow — matches the OUTSIDE window (narrative continuity)
  screenCool: "#9fd0ff", // cool light the monitor casts into the room
} as const;

// The workspace (desk / keyboard / lamp / monitor) is parented to a group anchored to the CAMERA's
// pose at the reveal moment (t≈0.151, measured from the spline + bank in CameraRig), so the monitor
// sits dead-centre and upright the instant the room appears — regardless of the camera's bank/pitch.
// Positions under `monitor/desk/keyboard/lamp` are in that anchored frame: local -Z is straight
// ahead of the camera, +Y is up in the frame, origin is at the camera. Re-measure revealAnchor if
// ENTER_T (lib/insideBuilding) or the spline/bank constants change.
export const LAYOUT = {
  // Camera's pose at the reveal moment (t≈0.151) — anchoring the workspace here lands the monitor
  // dead-centre + upright the instant the room appears.
  revealAnchor: {
    pos: [-0.79, -1.81, -9.46] as const,
    rot: [-0.1799, 0.1041, -0.5811] as const,
  },
  monitor: { pos: [0, 0.6, -32] as const, screen: [18, 10] as const, bezel: 0.5 },
  desk: { y: -5, z: -32, depth: 14, width: 52, thick: 1.2 }, // near edge ~25u from camera at reveal
  keyboard: { pos: [0, -3.8, -27] as const, size: [13, 0.5, 4.4] as const },
  lamp: { pos: [12, 2, -32] as const, intensity: 85, distance: 66, size: 0.9 },
  screenLight: { intensity: 16, distance: 34 }, // cool spill from the monitor
  // Room shell is axis-aligned around the DESK origin (not the anchored frame) — a near-black box
  // that occludes the stars/exterior so the interior reads as a dark room.
  room: { front: 16, back: -56, floor: -14, ceiling: 16, halfWidth: 28 },
} as const;
