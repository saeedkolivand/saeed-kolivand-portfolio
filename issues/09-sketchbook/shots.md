# Issue 9 -- SKETCHBOOK (t 0.762-0.838, intensity 2 -- the held-breath valley)

S0.8 shot table (mirrored exactly in ./shots.ts). Palette S0.4 row 9: paper
#F7F2E7, graphite #5A564E -> ink #232019, wash #6FA8DC. The whole look is the
prebuilt shaders/sketchMaterials.ts layer: ONE scrub uniform uInk morphs
pencil [0, .05] -> ink draw-on [.05, .60] -> held breath (.60-.65) -> flat
color flood [.65, 1.0]; uInk is authored as pure issue-local f(t) (inkAt in
./shots.ts), so the sketch inks itself as you scroll and un-inks on the way
back. uTime is STEPPED at 8 fps per the shader contract (this is the slow
issue); one uSweepSpan is shared across every sketch mesh so the flood reads
as a single print run crossing the page.

RECIPE RULING (logged here): SKETCH_RECIPE drops the Phase 0 RECIPES[9]
mono 0.7 to mono 0 -- the world is AUTHORED in graphite/ink on paper (same
restraint precedent as Screentone) and the stage-C wash flood #6FA8DC is the
entire color payoff; desaturating it would kill the jaw-drop. Paper #F7F2E7
is light: standard halftone/hatch polarity, no in-shader flip. Post hatch
stays 0 (the sketch material already hatches; doubling strokes would smear).

Copy: issueCopy.sketchbook.annotations (6 handwritten snippets) along the
chain Frontend -> API -> Workers -> AI -> DB -> Search -> Desktop; the
DB + Search snippet sits between those two nodes. Handwriting renders in
Caveat (S0.4 type table, OFL) as crisp troika SDF lettering -- requires
public/fonts/Caveat-Regular.ttf (shared-file request, held for registry go).
Click-the-cat word pops draw from lettering.onomatopoeia.cat. Zero invented
strings.

WORLD: one sketchbook page (78 x 40) lying flat, spiral binding along the
north edge, a pencil resting on the south edge, a coffee-stain ring. The
architecture chain is drawn ON the page: 7 primitive diagram-machines
(monitor / gate / gears / robot head / cylinder stack / magnifier / tower +
screen) joined by a dashed ink line with chevron arrows; stick-figure robots
(instanced, 8 fps stepped idle) push data packets west to east along it. All
drawn things share the sketch material; the page itself stays paper.

ENTRANCE (motivated, S5b.1): Pop Print's whip drops from full-blast neon
chat into near-silence on blank pencil linework -- the contrast IS the
design (intensity 2 between two 5s). The cat that rode Issue 8 pads across
this very page mid-scene (guide moment). EXIT: the finished print run floods
the page flat, then the 0.010 gutter ink-floods to black into The Spread --
the ink that finished the page swallows it.

| # | kind | lens | share of issue | framing |
|---|---|---|---|---|
| 1 | dolly | 25mm | 0.30 | overhead establish descending west: the full chain reads left-to-right in pencil, inking begins at u=.05; FG pencil + coffee stain on the south edge, MG the seven-node chain + robots, BG annotations row + spiral binding |
| 2 | dolly | 33mm | 0.28 | low tracking west->east as the drawing inks itself; Caveat annotations FG lower third, robots + packets on the chain mid, node machines + binding BG; the cat enters frame-left at u~.20, pads across the FG paper leaving ink pawprints, sits frame-right by u=.50 |
| 3 | dolly | 33->25mm | 0.34 | flood finale: slow pull up and back to the whole page; the wash front sweeps W->E across every drawn mesh (one shared print run), finishing flat at issue end; final pose is the composed full page handed to the ink-flood gutter |

Intra-issue gutters: both are DRIFT (quiet-valley grammar, lib/shots.ts) --
shot 1's end pose IS shot 2's from pose and shot 2's end pose IS shot 3's
from pose (shared Pose constants, near-zero delta at the mid-gutter snap).
The camera never cuts inside this issue; it breathes.

## Jaw-drop: the sketch inks itself (registerJawDrop, flashless)
- The self-inking + flood IS the jaw-drop and is entirely pure f(uInk) --
  deep jumps and reverse scrubs land on the identical frame.
- registerJawDrop({ id: "sketch-print-run", t: at(0.65) }) fires at flood
  start with NO flash (S5b quiet-valley drop per lib/beats.ts: Issues 4, 9
  omit it) -- authored-time garnish only: the resting pencil settles with a
  tiny 0.7s nudge (SKETCH_SETTLE channel), as if it just finished the page.
  Deliberately slow and near-silent; BeatRunner owns hysteresis + skip.

## Cat: guide moment (S5b.1)
Flat CatModel crossing (-20, 8.5) -> (8, 5.2) as pure f(uInk) over
u .20-.50 (walking pose while crossing, sitting before/after -- the pose
snap is 12 fps comic grammar). 10 pawprint decals (pawprintMaterial clones,
one per print, own uSeed staggered u .22-.52) lie 0.03 + k*0.0006 above the
paper (y-offset dodge, depthWrite already off). Palette-law identity: fill
paper, ink outline, collar/tag in the wash #6FA8DC (S0.4 row 9 allows no
teal/red; Screentone precedent). Click = meow() + cat-pool word in ink.

## Coffee stain (RULING, logged here)
The stain prints in a diluted sepia #8C6F52 at low opacity -- a working tone
of the row-9 ink family (precedent: Noir/Screentone working grays). It is a
flat transparent decal trio (blob + offset blob + ring), single AA edge,
zero blur (S2.16).

## Reduced motion + low tier
- Boil OFF (uTime pinned 0 -- shader contract: freezes boil, nothing else);
  robots parked (stepped phase constant, legs neutral); cat piecewise-STILL
  (sitting at path start for u<.35, at path end after -- train precedent);
  jaw-drop skipped centrally by BeatRunner.
- Scroll-driven stays f(t) everywhere: ink draw-on, flood, pawprint reveal,
  annotation fades (gentle opacity ramps, Noir caption precedent).
- Low tier: robots 4 -> 2 (instance count trim); stepped rate is already 8
  fps by the shader contract, no further drop.

## S2.16 / intensity-2 check
- Zero channel anything; ONE hard AA edge per stroke, pawprint and flood
  front (hard ragged wipe, never a fade-blur); annotations are single-layer
  troika SDF lettering exempt from post; the only flash-capable moment is
  registered flashless.
- Valley by design: quieter than Pop Print (5) before and The Spread (5)
  after; no two adjacent intensities equal. Visibly distinct from both
  neighbors: cream paper + graphite linework vs saturated dark webcomic vs
  near-black cosmos.
