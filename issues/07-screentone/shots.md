# Issue 7 -- SCREENTONE (t 0.576-0.656, intensity 4 -- subway build, runs vs dwells)

S0.8 shot table (mirrored exactly in ./shots.ts). Palette S0.4 row 7: paper
#101014, ink #E8E8E8, spot yellow #F6C243 (+/-10% steps and Noir-precedent
working grays for the tunnel/train masses). Recipe: SCREENTONE_RECIPE extends
the Phase 0 RECIPES[7] screentone row via printRecipe(); mono is dropped to 0
because this world is AUTHORED grayscale -- the spot yellow (train stripe, map
line, station marks -- the three reserved accent uses) must survive the post
chain. Dark-paper halftone polarity flips in-shader (Phase 1 ruling).

Copy: content.timeline (8 station names) + issueCopy.screentone.stationCaptions
(index-aligned, 8) -- never invented strings. The map insert carries no title
(zero invented lettering); word pops draw from lettering.onomatopoeia pools.

WORLD: one subway line crossing the page west to east. 8 station spreads
(platform, wall panel, name + caption, spot-yellow roundel mark) at 24-unit
spacing; a 2-car train with the yellow stripe rides the track as a pure f(t)
motion profile (dwell plateaus at stations, smoothstep runs between). The
world STOPS at paper-white void walls on both page edges: the train enters
out of the west void and launches into the east one -- the page-flip conceit
is diegetic. Speed lines are authored scene art (instanced streaks around
the train), scaled by trainSpeed(t) and OFF at station dwells -- distinct
from the gutter whips. The map-insert shot is deliberately the clean
readable beat (the run passes below its frame line).

ENTRANCE (motivated, S5b.1): Newsprint's paper-tear opens on the platform the
story continues from; screen direction stays left-to-right (train +x) all
issue, matching the journey. EXIT: the train accelerates through the east
page-border at issue end and the WHOLE WORLD PAGE-FLIPS -- native
TransitionEffect mode 7 in the showcase gutter [0.656, 0.671]; nothing
scene-side, the snapshot system feeds it.

| # | kind | lens | share of issue | framing |
|---|---|---|---|---|
| 1 | hold | 27mm | 0.16 | platform establish, low + dutch: wheel-height from track level at Station 0 "Started Programming"; FG rails/ties bottom frame, MG platform + bench cat (frame right, past the nose mark), BG wall spread name/caption upper third; train arrives frame-left at p~0.6 with arrival speed lines and stops -- motivated hold |
| 2 | dolly | 40mm | 0.23 | through-window tracking: camera paces the line eastward at window height; the train runs/dwells independently (dwells at "University", arrives "First Job") so windows sweep the lower third while the station spreads read over the roof; speed lines on every run |
| 3 | hold | 50mm | 0.18 | map insert beat (S5b insert panel): 2D inset panel floating proud of the tunnel wall -- spot-yellow line, 8 stations, live position marker (pure f(trainX)); train blasts S2->S4 through the bottom frame with heavy speed lines; FG train roof/streaks, MG map panel, BG wall + piers |
| 4 | dolly | 22mm | 0.16 | low wheel-level: camera at rail height east of S5, heavy dutch; the S4->S6 run blasts PAST the lens mid-shot (grazing body sweep + radial speed lines), settling on the "AI Job Hunter" dwell; FG train side/rails, MG platform + spread, BG the east page-void |
| 5 | crash | 42->25mm | 0.15 | edge-run finale: looking east down the line; train arrives "Streaming" (last stop, pulsing yellow mark), micro-dwell, then LAUNCHES into the east page-void; camera pushes + widens after it; jaw-drop lurch at p~0.63; the gutter page-flips the world |

Intra-issue gutters: all four take the default whip (speed-line grammar --
thematically the train's own vocabulary).

## Train motion (pure f(t), scrub-safe both directions)
KNOTS in ./shots.ts: off-page west -> S0 (arrive during shot 1, easeOutCubic
deceleration) -> dwell -> S1 dwell -> S2 dwell -> run to S4 (S3 "Moved to
Germany" passes at speed -- "crossed a border in the dark"; it reads on the
map) -> dwell -> run to S6 (S5 passes at speed, reads on the map) -> dwell ->
S7 last stop -> cubic-in LAUNCH off the east edge. trainSpeed(t) is the
numeric derivative normalized to the run cruise speed (saturates on the
arrival/launch spikes) and drives speed-line length/visibility.

## Jaw-drop: the edge run (registerJawDrop, S5b)
- The launch itself is pure f(t) (the final KNOT segment) -- deep jumps and
  scrub-back get the same train position deterministically.
- registerJawDrop({ id: "screentone-edge-run", t: at(0.945), flash: 0.6 })
  adds authored-time garnish only: TRAIN_LURCH squash-stretch on the train +
  one whip-pool word pop in spot yellow. flash 0.6 rides the central
  requestFlash budget; dark paper world keeps it comfortably off strobe
  territory (S2.16). BeatRunner owns hysteresis + reduced-motion skip.

## Speed lines (authored scene art, NOT the transition whip)
44 instanced streaks (22 low tier) around the train's body, length/visibility
= f(trainSpeed(t)), y-jitter on stepTime/stepNoise (house 12fps, 8 low).
Hidden whenever speed < 0.1 -- station dwells are clean readable spreads.
Never rendered under reduced motion. They are scene geometry: they never
touch lettering (S2.16 -- no blur, no doubled edges anywhere).

## Cat: platform cameo (S5b.1)
Flat CatModel sitting on the S0 bench, placed past the parked train's nose so
it stays visible in shot 1 even when the train dwells (incl. reduced motion).
Click = meow() + cat-pool word. RULING (logged here): the canonical teal
collar / red tag identity marks print in this issue's spot yellow -- the
Newsprint precedent kept them canonical only because mono=1 grayed them; here
mono=0 and S0.4 row 7 allows no teal/red, so palette law wins.

## Reduced motion + low tier
- Speed lines never render; wheel sway, S7 pulse and tail flick freeze
  (stepTime factor 0); jaw-drop skipped centrally by BeatRunner.
- RULING (S0.1, nearest analog: travel stays f(t) while stepped/authored
  motion freezes): "train still" is honored as piecewise-STILL -- under
  reduced motion the train renders parked at the station nearest trainX(t)
  (trainDisplayX), so it is never seen moving, yet tracking shots keep their
  subject. Continuous translation would otherwise be required for framing.
- Low tier: speed-line count 44 -> 22, stepped rates 12 -> 8 fps.

## S2.16 / intensity-4 check
- Zero channel anything; all lettering single-layer troika SDF, exempt from
  post; speed lines are geometry, not blur; one budgeted flash total.
- Louder than Newsprint (3): three full-speed runs, heavy streaks, a launch.
  Quieter than Pop Print (5): B&W, long readable dwells between runs.
  Visibly distinct from both neighbors: dark manga screentone vs light pulp
  broadsheet vs saturated webcomic.
