# Issue 6 -- NEWSPRINT (t 0.488-0.566, intensity 3 -- broadsheet calm, one flood)

S0.8 shot table (mirrored exactly in ./shots.ts). Palette S0.4 row 6: paper
#EAE3D2, ink #221F1A, spot red #C63D2F (+/-10% steps and Noir-precedent
working grays for greeked body text; full-color panel interior composes only
locked S0.4 hexes: #2BB3A3, #F5A623, #E2574C + the spot red). Copy:
issueCopy.newsprint (headline, 3 secondary headlines, flagship front-page
story + blurb, 6 ticker items) -- never invented strings. Button lettering
"GITHUB" / "LIVE DEMO" derives from the links field names (functional UI
labels, S0.5 affordances; hidden + logged if a URL is empty).

WORLD: the reader stands INSIDE the front page -- paper floor with column
rules, a standing headline sheet, a back-wall page with a halftone "photo"
(procedural gray skyline plate; global newsprint recipe prints the dots), a
commit-graph STOCK TICKER band on posts, and the framed FRONT-PAGE PANEL
(AI Job Hunter) far right. Everything mono (recipe mono 1) until the panel
floods to full color through the Phase 1 colorWindow depth-mask channel
(shaders/colorWindow.ts -- zero new RTs, zero new shader work).

ENTRANCE (motivated, S5b.1): Issue 5 IS the press -- its stamp cut lands on
the page that press just printed. Screen direction stays left-to-right the
whole issue (Press continuity). EXIT: paper-tear (native mode 6; the
registry gutter [0.566, 0.576] declares it -- nothing scene-side).

| # | kind | lens | share of issue | framing |
|---|---|---|---|---|
| 1 | hold | 26mm | 0.27 | establish: high 3/4 from front-left; headline sheet "LOCAL DEV SHIPS AGAIN" dominates left third; ticker band crosses the upper frame; front-page panel small far right (plant for the reveal); FG floor column rules, MG headline sheet + secondary sheets, BG wall page |
| 2 | dolly | 50mm | 0.245 | ticker detail: truck right ABOVE the sheet tops pacing the crawl; commit-graph polyline + stepped items on the ink band upper-mid; the cat press photo hangs from the band dead-center (photo-corner cameo, items slide behind it); low SH2/SH3 sheets FG-bottom, wall page + panel BG (gate iters 1-3: corridor raised, sheets sunk, photo rehung on the band) |
| 3 | dolly | 48mm | 0.265 | reveal approach: high-left start, push toward the front-page panel; colorWindow flood ramps 0 to 1 across NEWS_FLOOD_RANGE (pure f(t)); jaw-drop beat at p~0.73 (frame pop + spot-red word upper-right); SH3 sheet sweeps FG-left, panel MG, wall + floor recede BG (gate iter 1: end pose pulled to ~11.7 units, near-frontal) |
| 4 | hold | 52mm | 0.125 | front page close (full-bleed, ink frame just cropping): story banner top, app-mock "photo" center, blurb below, GITHUB + LIVE DEMO buttons bottom -- readable + click-verified (diegetic S5b.5, new tab); micro-drift only so pointer parallax owns the frame |

Intra-issue gutters: shots 1-2 and 2-3 take the default whip; shot 3-4 is a
CONTINUITY DRIFT (shot 3 end pose authored equal to shot 4 from pose, per
the lib/shots.ts drift contract) so the flood lands uninterrupted.

## Jaw-drop: the front-page color flood (S5b, registerJawDrop)
- The flood itself is pure f(t): colorWindow.enabled = ramp01(t,
  NEWS_FLOOD_RANGE), monotonic across shot 3, held 1 through shot 4, and it
  un-floods when scrubbed backward. Deep jumps and reduced motion still get
  the colored panel (state, not animation).
- registerJawDrop({ id: "newsprint-flood", t: NEWS_FLOOD_T }) adds the
  authored-time garnish only: NEWS_FLOOD_POP squash on the panel frame + one
  impact-pool word pop in spot red. NO flash requested -- an impact frame on
  a bright paper world edges toward strobe (S2.16); the color arriving IS
  the drop. BeatRunner owns hysteresis + reduced-motion skip.

## Ticker (stepped crawl, not a marquee)
Six issueCopy.newsprint.ticker items ride a fixed 13-unit pitch train; the
offset samples stepTime (12 fps, 8 low tier -- house "on 2s" convention) so
the crawl jumps in discrete print-frames; items stamp in/out whole behind
ink bezels at the band ends (no clipping shader). Frozen under reduced
motion (3 items rest visible). The commit-graph polyline is a static
instanced segment chart on the same band.

## Cat: cameo (S5b.1)
A framed B&W halftone "photo" of the cat (CatModel flat/sitting, canonical
collar+tag marks -- mono prints them gray, which is the gag) with photo-corner
mounts, hung ON the ticker band like a wire-service print; ticker items crawl
behind it. Dead-center in shot 2. Click = meow() + cat-pool word (S5b.5).

## S2.16 / intensity-3 check
- Zero channel anything; all lettering single-layer troika SDF; no flash
  requested anywhere in this issue.
- Busier than Origin (1) and calmer than Neon/Pop (5): one stepped ticker,
  one tail flick, one flood -- the rest is still print. Contrasts with both
  neighbors (Press 3 is dark + 4 accents + constant machinery; Screentone 4
  is dark manga B&W): light-paper mono broadsheet reads unmistakably apart.
- Reduced motion: ticker + tail frozen (st=0), beat skipped centrally,
  flood/buttons/copy all remain pure f(t) and fully readable.
