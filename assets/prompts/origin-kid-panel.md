# origin-kid-panel

Upgrade for the Issue 4 (ORIGIN) beat-1 panel "A KID, A HAND-ME-DOWN
MACHINE, ONE BLINKING CURSOR." Procedural primitive art ships regardless;
this asset replaces it at the user's leisure.

Target path: public/images/origin-kid-panel.png
Format: PNG, opaque (cream fills to the edge). Generate LANDSCAPE at your
generator's widest ratio (3:2 e.g. 1536x1024, or 16:9); target crop is
1.64:1 (5.4 x 3.3 world-unit panel interior), so keep ALL content (monitor
top, kid, ground line) inside the central 1.64:1 band - generous empty
paper margins top and bottom, composition spread wide.

## Prompt

A single comic-book panel seen straight-on, flat comic-panel art: a cream
paper field (#EDE7DB) fills the frame edge to edge. On it, a child seated
in profile at a desk, rendered as a clean flat ink silhouette (#2A2722) --
slightly rounded child proportions, NO facial features -- one arm reaching
up onto the desktop toward the machine. The desk and its two legs are the
same flat ink, and a clean ink baseline runs across the panel floor. On the
desk sits an old CRT monitor: a boxy casing in flat slate blue (#7C93B2)
with a near-black screen (#2A2722), and one small blinking-cursor rectangle
in paper color (#EDE7DB) glowing on the dark screen. Bold uniform ink
outlines on every shape, crisp vector-like silhouettes, flat cel fills with
no gradient. Halftone dot shading only inside the cream paper field. No
other colors anywhere: only #EDE7DB, #2A2722, #7C93B2, and #C97B5A.

## Avoid

- gradients, soft light falloff, glow bloom, photorealism
- soft shadows, ambient occlusion, 3D rendering look
- chromatic aberration, offset-print ghosting, doubled edges
- text, lettering, numerals, captions, logos of any kind
- facial features, skin tones, any color outside the four hexes above
- any franchise character or artist-style reference

## Palette source

lib/recipes.ts issue 4 (S0.4 row 4): paper #EDE7DB, ink #2A2722, blue
#7C93B2, rust #C97B5A. Origin.tsx locks these as PAPER / INK / BLUE / RUST.
This panel uses paper, ink, and the blue CRT casing; rust stays available
but is not required.

## Placement notes for the swap-in session

Replaces the KidArt primitive group (issues/04-origin/Origin.tsx, beat 1 /
PANELS[0]) with a single textured plane 5.4 x 3.3, sat just above the panel
interior fill (z ~0.035), meshBasicMaterial (opaque, no alpha). Keep the
in-scene PanelFrame: the ink border and the caption plate are scene
geometry, the image is interior art only and fills the frame edge to edge.
The scene caption strip overlays the lower band (y = -h/2 + 0.55), so keep
that zone visually quiet. Verify in situ against recipe 4's print pass:
does it sit in the muted paper world, and does the halftone pass fight the
printed dots?
