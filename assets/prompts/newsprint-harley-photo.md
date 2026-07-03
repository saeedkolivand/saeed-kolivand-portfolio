# newsprint-harley-photo

Staff-photo upgrade for the Issue 6 (NEWSPRINT) cat cameo -- the procedural
gray CatModel diorama mounted in the front-page press photo. Procedural art
ships regardless; this asset replaces it at the user's leisure.

Target path: public/images/newsprint-harley-photo.png
Format: PNG, opaque (newsprint paper fills to the edge). Generate SQUARE 1:1
(e.g. 1024x1024); the plate is portrait 0.86:1 (3.05 x 3.55 world units), so
keep the cat inside the central portrait band with plain newsprint-paper
margins left and right (a centered ~14% width trim is applied at swap-in).
The image is the whole press photo, edge to edge; no baked frame (the black
photo frame and corner mounts are scene geometry).

## Prompt

A comic-book NEWSPAPER HALFTONE PHOTO, seen straight-on: a very fluffy
long-haired tabby cat loafing ON a computer keyboard, front paws tucked
under her big chest ruff, staring directly at the camera. She is chonky and
cuddly, about 2.5 years old: a broad ruffed chest, thick tabby face stripes,
tufted ears, huge fluffy paws, and an enormous fluffy tail curled beside her.
Rendered ENTIRELY as a coarse black-ink halftone dot screen printed on
off-white newsprint -- two inks only: newsprint paper #EAE3D2 and press ink
#221F1A. Her golden coat reads as mid-density dots, the darker tabby stripes
as dense dot clusters, the pale chest ruff as sparse open dots; a bold
uniform ink outline rings the cat and the keyboard. Big coarse visible dot
rosette, blocky newspaper reproduction, flat even lighting. This is a
black-and-white news photo -- no color anywhere. No text.

## Avoid

- photorealism, real-photo grain, lens blur, depth of field
- smooth grayscale gradients or continuous tone (dots ONLY -- the coarse
  screen does all the shading)
- any color, any spot color, tinted ink (two hexes only: #EAE3D2, #221F1A)
- soft shadows, ambient occlusion, cast shadows, glow
- text, lettering, numerals, a caption, a byline, a masthead
- a baked photo border/frame or corner mounts (those are scene geometry)
- any franchise character or artist-style reference

## Palette source

issues/06-newsprint/Newsprint.tsx (S0.4 row 6): PAPER #EAE3D2, INK #221F1A.
The cameo is a B&W press photo -- the spot red (RED #C63D2F) is NOT used
here; the photo is ink-on-paper only. Full-color life belongs to the
front-page flood panel, never this plate.

## Placement notes for the swap-in session

Replaces the procedural cat inside CatPhoto (issues/06-newsprint/Newsprint.tsx):
the `<group position={[0, -0.55, 0.12]} scale={0.8}><CatModel ... /></group>`.
Drop in an ArtPanel-style textured plane 3.05 x 3.55 (reuse ArtPanel from
issues/04-origin/Origin.tsx) at z ~0.075 -- above the SHEET interior fill
(front face z 0.06) and BEHIND the four photo-corner mounts (z 0.09) so the
corners still read as holding the print. Keep the PhotoFrame (ink border and
SHEET backing) and the corner mounts as scene geometry; keep the click = meow
handler and the tail rig wrapper (the rig simply goes unused).
meshBasicMaterial + map, tex.colorSpace = SRGBColorSpace (three decodes -- no
manual pow(2.2); that rule is only for custom-sampled canvas copies), trim = 0
(no baked border to hide). Verify in situ: the recipe-6 global halftone/print
pass RE-SCREENS the whole scene, so the baked coarse dots can moire against it
-- keep the baked screen coarse (it should dominate) and confirm against
recipe 6's print pass, exactly the origin-kid-panel caution.
