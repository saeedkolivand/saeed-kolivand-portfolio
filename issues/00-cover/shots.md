# Cover -- shot list (S0.8)

Range 0.000-0.030 (RANGES[0]). Exits via the crash-through tear in the
showcase gutter 0.030-0.040 (transition already implemented; the end frame
of shot 1b is the snapshot the tear fragments carry).

| # | kind | lens | share of issue | framing |
|---|---|---|---|---|
| 1a | hold (attract) | 33mm | 0.50 | head-on flat print floating in ink void; masthead top, cat + teal burst center, price box UL, blurb banner + barcode low; breathing parallax + 12fps tail flick idle; DOM attract prompt below (Lettering.tsx) |
| 1b | crash | 33->28mm | 0.50 | layers split with t (art 0.55 / hero 1.3 / lettering 2.1 wu); camera crash-dollies at the cat, lettering flies off-frame edges; end frame = cat filling the burst -- feeds the punch-through |

NOTE: 1a and 1b are ONE compiled Shot (`cover-attract-crash`) with a
compound ease (flat drift for the first half, cubic acceleration in the
back half). compileSegments hardcodes intra-issue gutters to "whip"; a whip
smear across static readable cover lettering would break S2.16, so the
cover carries no intra-issue gutter. shots.ts mirrors this table.

S5b.4 checklist, shot 1: focal point = the leaping cat; three depth planes =
lettering / hero+burst / paper board (separate on scroll); reads at 200px
(masthead + cat silhouette + red banner); lettering is crisp drei Text,
deliberately INSIDE the post pipeline -- the print treatment IS the cover.
