# Issue 1 -- NOIR: authored shot list (S0.8 canonical)

Range 0.040-0.108 (RANGES[1]); three intra-issue whip gutters of 0.003.
Shares apply to the span left after gutters (see shots.ts `seg`).

| # | kind | lens | share of issue | framing |
|---|---|---|---|---|
| 1 | hold | 24mm | 0.30 | low dutch from street; window upper-third; FG railing, MG rain, BG facade |
| 2 | whip | 28mm | 0.15 | vertical whip up the facade; speed lines |
| 3 | dolly | 50mm | 0.35 | slow push to window; cat silhouette enters frame-left on rooftop FG |
| 4 | crash | 85->35mm | 0.20 | crash to window; cat leaps frame-right at p~0.8 -- motivated cut |

Notes
- Shot 3 is the S5b color-reveal composition: the CMYK window lands
  dead-center at 50mm compression while the rest of the universe stays B&W.
- Shot 4 opens 85mm tight ON THE CAT (from-target on the crouch spot at
  local (-0.9, 9.2, 0.8)), then the target racks cat->window as the camera
  slams in. The leap window is p 0.72-1.0 with a flat arc (peak y ~10.4,
  end local (6.2, 9.6, -7.0)): the silhouette crosses the lit window in
  screen space at p~0.8 and is fully out frame-right by p~0.93, leaving
  the window dead-center for the cut (gate fix attempt 1, NDC-verified).
- Depth planes: 1 railing/rain/facade; 2 rain/window-grid/roofline;
  3 parapet+cat/rain/window; 4 cat/window/facade wall.
- Lettering.tsx maps the 3 noir captions onto shots 1-3 automatically.
- Screen direction: cat exits frame-right; Issue 2 opens on the landing.
