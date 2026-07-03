# origin-cologne-panel

Upgrade for the Issue 4 (ORIGIN) beat-4 panel "TWO SUITCASES AND A ONE-WAY
TICKET. COLOGNE NOW." Procedural primitive art ships regardless; this asset
replaces it at the user's leisure.

Target path: public/images/origin-cologne-panel.png
Format: PNG, opaque (cream fills to the edge). Generate SQUARE 1:1
(e.g. 1024x1024); target is near-square 0.97:1 (3.5 x 3.6 world-unit
panel interior), so a 1:1 canvas drops in with a ~3% width trim. Keep
spire tips and the ticket comfortably inside the edges (small paper
margin all around).

## Prompt

A single comic-book panel seen straight-on, flat comic-panel art: a cream
paper field (#EDE7DB) fills the frame edge to edge. Upper half: the Cologne
Cathedral (Koelner Dom) rendered as one bold simplified twin-spire ink
silhouette (#2A2722) -- the recognizable gothic Dom profile with its two
tall pointed spires, kept as a clean flat shape with NO fine tracery or
window detail. Lower half, on the cream: two suitcases standing side by side
-- one flat terracotta (#C97B5A), one flat slate blue (#7C93B2), each with a
short ink handle (#2A2722) on top -- and beside them a small paper airline
ticket (#EDE7DB) tilted, carrying one terracotta stripe (#C97B5A). Bold
uniform ink outlines on every shape, crisp vector-like silhouettes, flat cel
fills with no gradient. Halftone dot shading only inside the cream paper
field. No other colors anywhere: only #EDE7DB, #2A2722, #7C93B2, and
#C97B5A.

## Avoid

- gradients, soft light falloff, glow bloom, photorealism
- soft shadows, ambient occlusion, 3D rendering look
- chromatic aberration, offset-print ghosting, doubled edges
- text, lettering, numerals, captions, logos of any kind
- photorealistic cathedral, fine gothic tracery, tourists or people
- any color outside the four hexes above; any artist-style reference

## Palette source

lib/recipes.ts issue 4 (S0.4 row 4): paper #EDE7DB, ink #2A2722, blue
#7C93B2, rust #C97B5A. Origin.tsx locks these as PAPER / INK / BLUE / RUST.
All four appear: ink cathedral and handles, rust plus blue suitcases, rust
ticket stripe on the cream ticket.

## Placement notes for the swap-in session

Replaces the MoveArt primitive group (issues/04-origin/Origin.tsx, beat 4 /
PANELS[3]) with a single textured plane 3.5 x 3.6, sat just above the panel
interior fill (z ~0.035), meshBasicMaterial (opaque, no alpha). Keep the
in-scene PanelFrame: the ink border and the caption plate are scene
geometry, the image is interior art only and fills the frame edge to edge.
The scene caption strip overlays the lower band (y = -h/2 + 0.55), so keep
the suitcase row clear of it. Verify in situ against recipe 4's print pass:
does it sit in the muted paper world, and does the halftone pass fight the
printed dots?
