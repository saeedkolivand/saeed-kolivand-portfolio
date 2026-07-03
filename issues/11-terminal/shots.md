# Issue 11 -- LETTERS PAGE / TERMINAL (t 0.940-1.000, intensity 1 -- back cover)

S0.8 shot table (mirrored exactly in ./shots.ts). Palette S0.4 row 11: paper
#0B0F0C, ink #33FF66, amber #FFB000. No gutter after -- the journey ends at
t=1.000 on the closed back cover. Quiet bookend by design (S5b.2: intensity 1
after The Spread's 5; mirrors the Cover's intensity-1 open).

RECIPE RULING (logged here): TERMINAL_RECIPE extends the Phase 0 RECIPES[11]
terminal recipe via printRecipe(). Halftone 0.35 -> 0.5 at pitch 3.5 -> 3.0:
on dark paper the polarity-flipped fine dot grid reads as CRT scanline pitch,
which IS the specced CRT-scanline x halftone hybrid -- no new shader. Mono
0.85 -> 0.7 so the amber accents (S0.4 row 11) survive the green duotone and
still read warm (tuning precedent: Sketchbook mono 0.7 -> 0, Newsprint 0.65
-> 1, rulings logged in their shots.md). Vignette 0.45 -> 0.5 = tube falloff;
boil 0.5 -> 0.3 and grain 0.06 -> 0.05 calm the near-black world (S2.16
strobe caution, Neon precedent).

Copy (zero invented strings):
- content.terminalCommands (9 locked commands) + issueCopy.lettersPage
  .responses (one response each) + backCover.nextIssue + backCover.barcode.
- Prompt: SPEC S0.3/Phase 3 literal "hello visitor_" -- rendered as
  "hello visitor" plus the blinking block cursor AS the trailing underscore
  while the input buffer is empty; the cursor moves to the "> " input line
  once typing begins (ruling: the underscore in the spec string denotes the
  cursor glyph).
- Page header "LETTERS PAGE" = the S0.3 segment name (locked table), Bangers.
- S0.5: links.blogUrl === "" -> the blog command is HIDDEN (8 cards render).
  HIDDEN-KEY RULING (registry-go direction, 2026-07-03): any key present in
  issueCopy.lettersPage.responses answers when TYPED even without a card --
  covers blog (its no-dispatches line is authored for exactly this state)
  and the harley easter egg (the user's real cat; never listed, never
  documented on-screen). links.resumePdf === "" -> resume prints the locked
  OUT OF STOCK gag response.
- Email: assembled at runtime from links.email halves joined with
  String.fromCharCode(64) at spawn time; the joined address never exists as a
  source literal here and only lands in a WebGL text texture, never DOM/HTML.
- UNKNOWN-COMMAND RULING (supersedes the earlier FLAG -- content-scribe
  seeded issueCopy.lettersPage.unknownCommand 2026-07-03): unknown input
  prints the locked line in a response panel with {cmd} replaced by the
  typed echo, AND the screen keeps the 0.4s stepped flinch on top -- words
  plus flinch is the comic error grammar, and the wordless shake alone was
  only ever the stopgap. Shake skipped under reduced motion; the printed
  line is not (it is the accessible path).

WORLD (set-local, issueCenter(11)): a CRT terminal desk printed ON the back
cover page. Page plate 24 x 34 at z -6 (green frame border, LETTERS PAGE
header, NEXT ISSUE card, barcode gag, cat margin walk); desk + keyboard +
mug + letter stack FG; CRT (7 x 5.5 x 4.5) with green phosphor screen MG;
8 clickable command cards column frame-right; floating response panels
(pooled) own the upper air. Green point light = phosphor spill (motivated).

| # | kind | lens | share of issue | framing |
|---|---|---|---|---|
| 1 | dolly | 28mm | 0.30 | terminal establish: three-quarter from front-left, slight dutch; CRT + prompt right-of-thirds MG, keyboard/desk props FG bottom edge, back-cover page + header BG; drifts toward the play pose |
| 2 | hold | 32mm | 0.33 | command-panel play: near-frontal interactive dwell on screen + card column (pointer parallax, S2.15); response panels pop in the upper frame; cat sits on the CRT (S5b.1 "finally sits on the terminal") |
| 3 | dolly | 32->24mm | 0.30 | back-cover pullback: rise + retreat until the whole printed back cover fills frame; NEXT ISSUE card upper third, barcode gag lower-right, cat walks off-panel frame-right along the bottom margin; final frame at t=1.000 |

Intra-issue gutters: both DRIFT (quiet-valley grammar, lib/shots.ts contract)
-- shot 1's end pose IS shot 2's from pose, shot 2's end pose IS shot 3's
from pose (shared Pose constants). The camera never cuts inside the issue.

## Interaction (S5b.5 diegetic, REAL keyboard)
- window keydown listener attached/detached by a zustand subscribe on
  activeIssue === 11 ONLY; ignores ctrl/meta/alt combos; ignores keys when a
  DOM input/textarea/contenteditable has focus; consumes [a-z0-9-],
  Backspace (preventDefault), Enter, Escape; buffer capped 14 chars.
- Enter runs the command: locked visible commands spawn a floating response
  panel from panelPool (lib/pops.ts PopPool, 4 slots, GC-clean round-robin);
  squash-and-stretch = popScale envelope + differential x/y wobble on
  stepped time. NO navigation -- github/linkedin/projects answer in panels.
- Clickable command cards (8 visible) = the touch/no-keyboard path; hover
  swaps the label to amber + pointer cursor (restored on out).
- resume: spawns the gag panel AND the paper-sheet drop -- a framed window
  onto the RETAINED Issue-2 desk snapshot (snapshots.retain(2) at module
  scope in ./shots.ts; framebuffer copy, zero live RTs, S2.10 untouched);
  the snapshot recedes (scales down) while an amber sheet falls into it on
  stepped time, f(slot age), 2.8s life. RULING: the sheet prints in amber
  #FFB000 (the row-11 accent) -- reads as the reprint slip gag; no
  off-palette paper white exists in this world.

## Jaw-drop: back-cover reveal (registerJawDrop, FLASHLESS)
registerJawDrop({ id: "terminal-back-cover", t: at(0.74) }) -- no flash
field: gentle-by-design intensity-1 bookend (quiet-valley clause in
lib/beats.ts, Issues 4/9 precedent). Authored-time garnish only: the NEXT
ISSUE card does one soft squash pop (BACK_COVER_POP channel, 1.15s).
The reveal itself is the pure-f(t) pullback -- scrub-safe both directions.

## Cat: guide moment closes the through-line (S5b.1)
Sits flat on the CRT top through shots 1-2; at catWalk() range (t .72-.97 of
the issue) the walk-off crosses the page bottom margin frame-right and exits
past the page edge at u=1 -- off-panel, the journey's last image before
t=1.000. Pose snap sit -> walk at the range edge is 12fps comic grammar
(Sketchbook precedent).
PALETTE RULING (updated 2026-07-03, supersedes the phosphor-palette ruling):
sit cat = { ...HARLEY, accent: amber #FFB000 } -- CatModel v2 golden-tabby
Harley default per user directive, amber tail tip as the issue accent
(Origin {...HARLEY, accent} precedent); the recipe's green duotone supplies
the phosphor cast in-post, keeping S0.4 row 11 intact on the final print.
WALK-OFF ART (another agent, kept deliberately): the walking cat is the
user-approved textured ArtPanel /images/backcover-harley.png (green
phosphor Harley with its baked CRT-card border) inside the same wrapper --
scale, x-lerp, stride bob, and the catWalk(t) gate are unchanged and stay
pure f(t).

## Reduced motion + low tier
- Reduced: cursor SOLID (no blink); panel pops and the resume drop become
  opacity fades at fixed 0.95 scale (Pop Print ruling precedent); unknown
  shake skipped; cat walk position stays pure f(t) (scroll-driven) but the
  stepped stride bob is dropped; jaw-drop skipped centrally by BeatRunner.
- Low tier: stepped rate 12 -> 8 fps. No instancing and < 80 draws in the
  set by design (intensity-1 valley) -- no further per-issue trim needed.

## S2.16 / comfort check
- Zero channel separation anywhere: the CRT look is recipe work (duotone +
  fine halftone + vignette), never RGB fringe or ghosting. All lettering is
  single-layer troika SDF (post-exempt read); panels fade by opacity only,
  no blur. The one flash-capable moment is registered flashless.
- Neighbors: near-black green terminal vs The Spread's cosmic #05060D --
  distinct by treatment (duotone scanline grid vs krackle starfield);
  intensity 1 vs 5 satisfies the beat chart; two full valleys exist (4, 11).

## Shared-file requests (APPLIED at registry go, 2026-07-03)
- public/fonts/JetBrainsMono-Regular.ttf (S0.4 type table, OFL static)
  dropped; MONO lettering live.
- issueCopy.lettersPage.unknownCommand + .responses.harley seeded by
  content-scribe and wired (rulings above).
- issues/registry.ts: last placeholder row replaced with the Terminal row.
