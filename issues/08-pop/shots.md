# Issue 8 -- POP PRINT (t 0.671-0.752, intensity 5 -- streaming, the loudest page)

S0.8 shot table (mirrored exactly in ./shots.ts). Palette S0.4 row 8: paper
#1B0F2E, ink #F4EFFF, accents #FF3D81 pink / #29E0FF cyan / #FFD32E yellow
(+/-10% steps and working purples for desk/gear masses, screentone-gray
precedent: #2A1B45 desk, #241239 rug/tower, #3A2A57 gear, #140A24 housings,
#123B4F screen glass). Recipe: POP_RECIPE extends the Phase 0 RECIPES[8] row
via printRecipe() -- mid halftone at a coarse 9px pitch, hot ink edges, boil
0.65; grain/paperTex kept low on the dark paper (Neon S2.16 precedent).

Copy: issueCopy.popPrint (chat[12], donationAlert, donationBoom "KA-CHING!" --
the ASCII donation word that replaced the Persian Easter egg, logged ruling
2026-07-02) + content.streaming (platforms Twitch/YouTube, tools OBS/Stream
Deck as diegetic gear labels) + spec-given "ON AIR". Word pops draw from
lettering.onomatopoeia pools. Zero invented strings.

WORLD: an open ISLAND STAGE, not a boxed room -- the 360 jaw-drop sees the set
from every side, so nothing encloses it. A round rug (pink rim) carries the
streamer desk (monitor with flat stream-layout UI, PC tower with accent
stripes, keyboard, labeled Stream Deck prop, mic arm, ring light, empty chair
pushed aside -- the CAT is running the stream), a truss stand behind-left
holding the pulsing ON AIR sign (lettered on BOTH faces for the orbit) with
Twitch/YouTube placards on the crossbar, a floating chat column frame-right
where 3D speech balloons POP with chat lines, an emote-sprite rain rising in a
ring around the island, and a diamond garnish ring at the perimeter (FG depth
plane during the orbit).

ENTRANCE (motivated, S5b.1): Screentone's last caption is "Last stop's lit
red. ON AIR." -- the page-flip lands on the promised sign; the subway-riding
cat is now at the streamer desk. EXIT: the 360's angular momentum carries
straight into the registry whip gutter (0.010) toward Sketchbook; the orbit
ends at exactly 0 rotation so exit framing equals entry framing -- whip-clean.

| # | kind | lens | share of issue | framing |
|---|---|---|---|---|
| 1 | hold | 26mm | 0.20 | establish, high front-left: the whole island; ON AIR sign upper-left (off-center per PR #22 whip-gutter rule), desk + cat center, chat balloons popping frame-right; FG diamond ring + emote risers, MG desk set, BG truss + placards |
| 2 | dolly | 36mm | 0.20 | chat-wall track: camera slides in along the balloon column at balloon height, right to left; balloons pop in cadence filling MG, emotes cross FG, desk + sign read BG-left; sets up the cut back to the desk |
| 3 | hold | 45mm | 0.16 | donation beat: front-on over the desk at monitor height; donation alert panel pops above the monitor at p~0.5 (DONATION_T) and the giant KA-CHING! word-pop floods the upper frame, edges bleeding off-panel; FG keyboard/deck edge, MG monitor + cat, BG chat wall |
| 4 | orbit | 28mm | 0.33 | THE 360: the lens cranes gently down and in, butter-smooth, while the ENTIRE WORLD whip-orbits a full 360 under it (world-spin, pure f(t)); every emote/balloon re-faces only on 12fps steps so the stepped world visibly lags the smooth lens; FG diamond ring sweeps past, MG island, BG emote shell |

Intra-issue gutters: all three take the default whip. Windows (fractions of
the issue): [0, .20], [.24, .44], [.47, .63], [.67, 1.0].

## Jaw-drop: the 360 whip-orbit (registerJawDrop "pop-orbit-360")
- RULING (logged here): poseAt() is a strict from/to lerp, so a circular
  camera path is not expressible per-shot without an engine edit. The orbit is
  implemented as WORLD-SPIN: the island group's rotation.y = spinAngle(t) =
  2PI * smoothstep(orbit p) -- optically identical to a camera orbit, pure
  f(t), scrub-safe, zero shared-file edits. The camera itself runs a slow
  from/to crane for extra parallax. If a literal camera orbit is preferred, a
  3-line poseFn hook on Shot is the alternative (held; see interim report).
- registerJawDrop at the orbit's start adds authored garnish only: a 0.6s
  squash kick on the island (ORBIT_KICK), a 3-balloon chat volley, one
  whip-pool word in cyan. NO flash -- the issue's single budgeted flash
  belongs to the donation beat (S2.16 direction).
- The smooth-lens/stepped-world contrast is enforced mechanically: emote and
  balloon billboards sample the camera quaternion only on 12fps step
  boundaries (8 low tier), so they snap against the butter spin.

## Donation beat (registerJawDrop "pop-donation", t = at(0.55), flash 0.5)
Authored ~1.1s GSAP timeline, TIME-STAGGERED (iteration 2): the alert panel
(yellow rim, pink face, locked donationAlert copy) pops over the monitor via
ALERT.v and reads ALONE for ~0.6s; at +0.85s the BOOM pool spawns the giant
"KA-CHING!" (fontSize 1.65 Bangers, yellow with paper outline, popScale
overshoot 0.8) as the panel pops out -- overlapped, the word had covered the
locked copy for its whole life. flash 0.5 rides the central requestFlash
budget -- the ONE full-frame moment of the issue. BeatRunner owns hysteresis
and the reduced-motion skip.

## Chat balloons (PopPool, lib/pops.ts -- built for exactly this)
chatPool = PopPool(8 slots, life 2.6s). Ambient cadence: one spawn every 0.5s
(0.8s low tier), cycling issueCopy.popPrint.chat sequentially over 5 lanes on
the chat column (deterministic lane hash). Balloon = ink ellipsoid + accent
halo rim (pink/cyan/yellow cycle) + ink tail cone + paper-color chat text.
popScale envelope on stepped time, stepped rise, stepped z-wobble; text/halo
re-synced only on slot.gen change (pool contract, zero alloc per frame).

## Emote rain (instanced, procedural, no textures)
24 sprites (12 low): three procedural face variants -- POG (yellow disc, round
eyes, open mouth), LAUGH (cyan disc, squint quads, wide mouth), HEART (pink,
two discs + diamond quad) -- composed from TWO InstancedMeshes total (one
circle, one quad; 56 + 32 instances), every instance colored at init (unset
instances render white). Matrices recomputed ONLY on 12fps step boundaries:
rise/wobble sample stepTime, billboard facing samples the camera on the same
steps -- the whole field animates on 2s by construction.

## ON AIR sign + signage (diegetic environmental art, PR #22 ruling)
drei Text on scene geometry -- NOT protected lettering; kept out of
frame-center at every whip gutter (upper-left in shots 1/4 poses, off-frame in
2/3 boundaries). Sign pulses at ~0.5Hz on stepped time (scale only, no
luminance strobe). Both faces lettered for the orbit. Platform placards and
OBS / Stream Deck labels are locked content.streaming strings.

## Cat: the streamer (guide moment)
Toon-mode CatModel perched on the PC tower top, three-quarter turn toward the
front cameras (loop iterations 1-2: on the desk it vanished dark-on-dark in
front of the screen) -- RULING: flat build vanishes edge-on
during a 360 (Noir precedent in DECISIONS), so this cameo is dimensional.
Palette ruling (screentone precedent, palette law wins): collar prints cyan
#29E0FF (nearest row-8 kin of canonical teal), tag pink #FF3D81 (kin of
canonical red), accent yellow. Click = meow() + cat-pool word at the click
point. The empty pushed-aside chair sells the gag: the cat is live.

## Reduced motion + low tier
- Orbit: RULING -- 3 static angles (0 / 120 / 240 degrees), piecewise-still
  via spinAngle(t, reduced) (screentone trainDisplayX precedent); never seen
  rotating.
- Pops become fades: balloons hold scale ~0.95 and fade via material opacity +
  text fillOpacity (no overshoot, no rise, no wobble).
- Emote rain and diamonds freeze (stepTime factor 0); billboards still re-face
  on step boundaries (readability, not motion). Sign pulse frozen.
- Donation + orbit beats skipped centrally by BeatRunner (no alert, no boom,
  no flash).
- Low tier: emotes 24 -> 12, diamonds 10 -> 6, chat cadence 0.5 -> 0.8s,
  stepped rates 12 -> 8 fps.

## S2.16 / intensity-5 check
- Zero channel anything; chat/alert/boom lettering is single-layer troika SDF;
  balloon pops are SCALE pops, emote motion is stepped geometry -- no
  full-frame flash outside the one budgeted donation moment.
- LOUDER than Screentone (4) by density + saturation + cadence: full
  three-accent saturation on deep purple vs B&W, a pop every half second vs
  dwell plateaus, and the 360 finale vs a single launch. Louder than
  Sketchbook (2) after: near-silent graphite paper. Visibly distinct from both
  neighbors in side-by-side screenshots.

## S0.8 screenshot loop log (agent-browser CLI, 1600x900, 2026-07-03)
- Shot 1: 3 iterations. i1: emotes crossed the ON AIR sign face, balloon
  lanes self-occluded, cat lost dark-on-dark in front of the screen -> emote
  inner radius 4.6 -> 6.8, lanes widened + 3 depth rows, cat to the tower top
  with gear-purple body, desk step lightened (#38255C), monitor/tower BACK
  detail slabs added for the 360. i2: relocated chair blocked the tower ->
  far left-back quadrant. i3: PASS.
- Shot 2: PASS at iteration 2 (rode the shot-1 fixes); balloons crisp,
  spread, chair out of the sight line.
- Shot 3: 3 iterations. i1: boom cropped at frame top (y 5.7 -> 5.05). i2:
  boom covered the alert copy -> time-stagger (Donation beat above). i3:
  PASS -- alert copy reads alone, the single budgeted flash frame observed,
  giant boom proven in the i2 capture, cat reads in three-quarter (ry 0.6,
  mic head raised clear).
- Shot 4: PASS at iteration 2 (57/180/310-degree captures): back-face ON AIR
  reads, stepped billboards visibly lag the butter spin, FG diamond ring
  sweeps, set back no longer bare.
- Reduced-motion emulation: static 120-degree angle at the orbit midpoint,
  frozen emote field, balloons as opacity fades, beats skipped -- the
  approved rulings hold. Console clean (pre-existing engine-wide THREE.Clock
  deprecation warning only).
