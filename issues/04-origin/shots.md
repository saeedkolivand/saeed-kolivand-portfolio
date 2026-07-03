# Issue 4 -- ORIGIN PAGE (t 0.315-0.378, intensity 1 -- the first quiet valley)

S0.8 shot table (mirrored exactly in ./shots.ts). Palette S0.4 row 4: paper
#EDE7DB, ink #2A2722, accents #7C93B2 #C97B5A. Copy: issueCopy.origin
(lead + 7 beats) -- the masthead already dropped after Issue 1 (S5b.3), so
this page carries story beats only. Camera DRIFTS; no crash, no whip poses.

| # | kind | lens | share of issue | framing |
|---|---|---|---|---|
| 1 | dolly | 28->50mm | 0.24 | establish: the whole comic page floating in a paper void, 3/4 from frame-left, slow commit toward row 1 (ends on shot 2's from pose); lead caption strip top; FG orbiting tech chips + dust motes, MG the page, BG two dim blank pages adrift; cat cameo tiny in the bottom margin |
| 2 | dolly | 50->85mm | 0.25 | reading drift down the page: rows 1-2 (kid + machine, university, first job / suitcases / senior) in frame at 50mm full width, descending and tightening onto row 3's first panel (noir snapshot); icons cross FG; ends on shot 3's from pose |
| 3 | dolly | 85->50mm | 0.19 | intimate row-3 pan left-to-right: the open-source night panel (noir snapshot) to the dark portal panel, squaring up dead-center on the portal mouth (ends on shot 4's from pose); the flat cat pads right along the bottom margin beneath, eyeline up at the portal (motivates the glide) |
| 4 | dolly | 50->35mm | 0.145 | portal glide: dead-center push THROUGH the portal panel's surface into the recessed dark interior; robot eyes deep in the void; frame ends fully inside the dark -- panel as portal, the transition out |

Intra-issue gutters (0.06 / 0.06 / 0.055 x range) declare out: "drift"
(continuity gutter, gate fix 2026-07-02): each shot's end pose EQUALS the
next shot's from pose, so the gutter carries zero pose delta and the post
pass renders nothing -- no speed lines in the quiet valley. Establish
commits toward row 1 (shot 1 ends on shot 2's from). S1 note: drift is
legal ONLY because the poses are continuous; a raw unstyled jump stays
banned. Issue exit: panel-portal -> panel-wipe post fallback (Phase 2
ruling); the glide itself is authored here as shot 4.

## Panels (page local layout, page 12 x 16)
- Lead strip (top): issueCopy.origin.lead.
- Row 1: beats 1-2 as static primitive art. Row 2: beat 3 = desk snapshot
  (issue 2), beat 4 static art, beat 5 = neon snapshot (issue 3). Row 3:
  beat 6 = noir snapshot (issue 1), beat 7 = the portal panel (its caption
  sits on the page below the opening).
- Snapshots via snapshots.retain(1|2|3) -- zero new live RTs (S2.10 budget
  untouched); every snapshot panel has a static fallback underneath for
  deep-jump arrivals.

## Jaw-drop: panel-portal glide (gentle BY DESIGN)
- Travel is pure f(t): shot 4 crosses the page plane at p ~ 0.593 =>
  ORIGIN_PORTAL_T (exported from shots.ts).
- registerJawDrop({ id: "origin-portal", t: ORIGIN_PORTAL_T }) -- NO flash
  (quiet-valley clause in lib/beats.ts JawDropSpec); animate is a 0.9s
  border-breath (PORTAL_POP) on the portal frame.

## S2.16 / intensity-1 check
- No flashes, no strobing, no channel anything; lettering is single-layer
  troika SDF; snapshot panels decode sRGB via pow 2.2 (project memory).
- Motion budget: slow stepped orbit + squash on 2s, mote drift, tail flick.
  Reduced motion freezes the orbit/squash/gait; beats skipped by BeatRunner.
