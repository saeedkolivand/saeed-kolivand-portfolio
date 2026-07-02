# noir-window-figure

Upgrade for the Issue 1 (NOIR) lit-window interior. Procedural silhouette
ships regardless; this asset replaces it at the user's leisure.

Target path: public/images/noir-window-figure.png
Format: PNG with transparent background (alpha), 1024x1280 (4:5 -- matches
the 1.6 x 2.0 world-unit window pane).

## Prompt

A single comic-book panel seen straight-on: the warm interior of one
apartment window at night, viewed from outside through the glass. A person
sits at a desk with their back to the viewer, rendered as a clean solid
ink-black silhouette (#050507): round head wearing over-ear headphones,
soft rounded shoulders, seated at a thin black desk line. On the desk, a
glowing computer monitor in flat teal (#39D0D8) faces the figure so the
head silhouette overlaps the screen; to the left a small desk lamp casts a
flat circular glow in pink (#FF4FA3); a small black coffee mug sits on the
desk. The entire background of the pane is one flat field of warm amber
(#FFB347). No other colors anywhere: only #FFB347, #FF4FA3, #39D0D8,
silhouette black #050507, and deep ink #0E0E10. Flat cel shading, bold
uniform ink outlines, halftone dot shading only inside the amber field,
crisp vector-like shapes, comic panel art.

## Avoid

- gradients, soft light falloff, glow bloom, photorealism
- soft shadows, ambient occlusion, 3D rendering look
- chromatic aberration, offset-print ghosting, doubled edges
- facial features, skin tones, any color outside the five hexes above
- any franchise character, logo, or artist-style reference

## Palette source

lib/recipes.ts issue 1: paper #0E0E10, ink #F5F1E8 (ink is NOT used in
this asset; the figure is silhouette black). Window accents AMBER #FFB347,
PINK #FF4FA3, TEAL #39D0D8 are locked to the inside of the colorWindow
rect (S0.4 row 1).

## Placement notes for the swap-in session

Replaces the silhouette primitive group inside TheWindow (issues/01-noir/
Noir.tsx) as a single textured plane 1.6 x 2.0 at the pane position,
meshBasicMaterial with alpha; keep the mullion bars and the amber point
light. Verify in situ: does it sit in recipe 1's mono world with the CMYK
rect the only color? Does the halftone pass fight it?
