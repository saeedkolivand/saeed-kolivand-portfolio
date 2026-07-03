# Issue 10 -- The Spread (Space) -- shot list (S0.8)

Range [0.848, 0.930] (W = 0.082), intensity 5 (after Sketchbook's 2, before
Terminal's 1 -- contrast holds both sides). Exit gutter: dot-match (native
mode 9) into Issue 11.

| # | kind  | lens      | share of issue | framing |
|---|-------|-----------|----------------|---------|
| 1 | dolly | 24mm      | 0.20 | cosmos establish: low drift from frame-left; FG krackle dots, MG contribution star chart glowing green in the upper-right third, BG constellation arc + star dome; slight dutch settling out |
| 2 | dolly | 28->35mm  | 0.22 | star-chart approach: climb + push head-on to the chart; the 53x7 grid resolves into a wide star band across center frame, green highs sparkling on 2s; FG krackle streams past |
| 3 | dolly | 35mm      | 0.18 | constellation drift: lateral pan across the labeled constellation arc (issueCopy.spread labels, one per prior issue); the cat drifts through frame mid-shot (guide, S5b.1); chart rides the top of frame |
| 4 | dolly | 35->24mm  | 0.28 | THE UNFOLD: camera pulls back and centers while the folded stack at frame-center cracks open -- ten comic pages (Cover + Issues 1-9, live snapshots) fan out into a double-page spread wall; closing caption fades in low-center; a bright green cursor star sits dead-center for the dot-match out |

Gutters: 1->2 whip (0.04 W), 2->3 whip (0.04 W), 3->4 drift (0.04 W, shot 3's
end pose EXACTLY equals shot 4's from pose -- C0 match per lib/shots.ts drift
rule; easeInOut gives zero velocity at the join).

Composition (S5b.4, checked per shot at the screenshot loop):
- One focal point each: chart (1, 2), labeled constellations + cat (3),
  the unfolding spread with the cursor star dead-center punch (4).
- Three depth planes everywhere: krackle field (FG, z -12..14), subject
  (MG), star dome + nebula discs + constellation arc (BG, z -24..-95).
- Lettering: constellation labels + page captions + closing caption are
  single-layer troika SDF in #EAF2FF -- crisp, zero fringing (S2.16).

Mechanics:
- Unfold is PURE f(t): driver U over t [at(0.74), at(0.94)], page i eases
  over u_i = (U - i*0.055) / 0.45 (staggered, all ten land by U = 1; the
  last 6% of the issue is a settled frame for the dot-match + caption).
- Jaw-drop (the site's biggest): registerJawDrop "spread-unfold" at
  t = at(0.74), flash 1 through the central requestFlash budget, plus a
  0.9s authored breath on the spread group (UNFOLD_POP). Intensity 5 comes
  from scale + starfield density + the unfold -- zero strobe.
- Dot-match exit authoring: the cursor star (bright #39D353 octahedron +
  gold sparkle rays) sits at local (0, 0.1, -13.5), 0.4 units in front of
  shot 4's end target (0, 0.1, -14) -- near frame-center at issue end; the
  gutter shader does the star -> terminal-cursor match.
- Snapshots: pages poll snapshots.get(0..9); 0 and 4-9 retained at module
  scope in ./shots.ts (1-3 already retained forever by Origin). Zero new
  live RTs; per-page static fallback art (issue palette primitives) covers
  cold deep jumps, Origin DeskFallback pattern.

Ruling (reduced motion): the unfold degrades to a gentle cross-fade -- pages
hold their final laid-out spread poses and fade in with the same staggered
u_i (opacity only, no rotation/translation); ambient twinkle/drift loops
freeze (st = 0 pattern). BeatRunner already skips the flash beat centrally.
To be logged in DECISIONS.md at registry-go.

Low tier: star dome 420 -> 180 instances, krackle field 140 -> 60 (count
clamp on the same InstancedMesh), stepped fps 12 -> 8. Chart (371) and
constellation stars (content-bearing) keep full counts.
