# backcover-harley

Walk-off upgrade for the Issue 11 (TERMINAL / LETTERS PAGE) finale -- the cat
that pads off the back cover past the page edge. Procedural CatModel art ships
regardless; this asset replaces it at the user's leisure.

Target path: public/images/backcover-harley.png
Format: PNG, opaque (near-black terminal field fills to the edge). Generate
SQUARE 1:1 (e.g. 1024x1024); the target walk plane is portrait 0.85:1
(2.2 x 2.6 world units, standing in for the flat walking CatModel - side
footprint ~2.45 wide plus tail-up headroom), so keep the cat inside the
central portrait band with plain dark-field margins left and right (a
centered ~15% width trim is applied at swap-in). No baked frame -- the
green page border is scene geometry.

## Prompt

Flat CRT-terminal comic art, seen straight-on: a very fluffy long-haired
tabby cat viewed FROM BEHIND, mid-stride walking AWAY toward the panel edge,
her big fluffy tail raised straight up, her head turned back over one shoulder
so a single eye catches the viewer. Chonky-cuddly proportions, about 2.5 years
old: broad fluffy haunches, huge tufted paws mid-step, a thick tapering tail.
Rendered as PHOSPHOR-GREEN line art and flat shapes (#33FF66) on a near-black
terminal field (#0B0F0C) -- chunky clean vector-like shapes, bold even green
line weight, a low-detail print look. ONE amber accent (#FFB000): the visible
over-the-shoulder eye (and, optionally, a single scanline glint on the tail).
A faint horizontal CRT scanline texture is allowed ONLY in the empty
background field, never on the cat. No text.

## Avoid

- photorealism, soft fur render, gradients, glow bloom, blur
- any color outside the three hexes (#33FF66, #FFB000, #0B0F0C)
- more than one amber element (the eye is the single accent)
- a front or three-quarter face (she is walking AWAY, seen from behind)
- text, lettering, numerals, a prompt, a cursor, a barcode
- a baked panel border/frame (the green page border is scene geometry)
- heavy scanlines over the cat, any franchise character or artist style

## Palette source

issues/11-terminal/shots.ts (S0.4 row 11): INK #33FF66 (phosphor green),
AMBER #FFB000, PAPER #0B0F0C (near-black). The CASE/SCREEN greens are NOT used
in this plate -- three hexes only: ink-green cat plus one amber eye on black.

## Placement notes for the swap-in session

Replaces the walking cat inside TerminalCat (issues/11-terminal/Terminal.tsx):
the `<group ref={walk} ...><CatModel mode="flat" pose="walking" ... /></group>`
body -- swap the CatModel for an ArtPanel-style textured plane 2.2 x 2.6
(reuse ArtPanel from issues/04-origin/Origin.tsx). Keep the `walk` group
wrapper untouched: its scale 0.9, per-frame position lerp (x 1.5 -> 13.8),
stride bob, and visibility gate (catWalk(t)) all stay on the wrapper and now
drive the plane. Leave the SITTING cat (`sit` group, front-facing on the CRT)
as the procedural CatModel -- only the walk-off is replaced. No scene frame
around the cat; the back-cover page border stays scene geometry.
meshBasicMaterial + map, tex.colorSpace = SRGBColorSpace (three decodes -- no
manual pow(2.2)); the material is UNLIT, so the DeskSet phosphor pointLight
never touches the plate. trim = 0 (no baked border). Verify in situ that the
near-black field reads as one with the terminal set and the amber eye stays
the only warm note on the page.
