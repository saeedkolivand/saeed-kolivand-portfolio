# Issue 3 -- NEON INK / CODE CITY (t 0.225-0.305, intensity 5)

S0.8 shot table (mirrored exactly in ./shots.ts). Palette S0.4 row 3: paper
#060608, ink #EDEDF2, accents #00E5FF #FF3D9A #B7FF2E #FF9E1F #8A7DFF.

| # | kind | lens | share of issue | framing |
|---|---|---|---|---|
| 1 | crash | 20mm | 0.32 | free-fall dive straight down at the plaza; dead city grid fills frame, dim code-line facades; pre-lit AI OPEN 24H hero tower upper-right, REACT sign far-left; FG black void, MG rooftops + cat on hero roof, BG street grid |
| 2 | crash | 85->40mm | 0.20 | crash-zoom down the hero tower face; AI OPEN 24H sign rakes past upper-third; FG facade code lines, MG plaza landing ring, BG far dark blocks |
| 3 | hold | 50mm | 0.33 | dutch (-8 deg) street-level landing hold; landing ring lower-left, avenue vanishing point right-third = focal point; the power-on cascade rolls block-by-block into depth; FG igniting road lines, MG signs popping on, BG skyline booting |

Intra-issue gutters (0.075 x range each) take the default whip; issue exit
stays on the registry outTransition (stamp -> cut fallback until Phase 2).

## Jaw-drop: power-on cascade
- Window: t in [NEON_CASCADE_T, NEON_CASCADE_END] (exported from shots.ts) =
  landing-shot entry to 70% through the hold. Pure f(t), scrub-safe both ways.
- Wave radius quantized to 10 rings (block-by-block on 2s feel); roads ignite
  at 1.15x the wave radius so they lead the blocks outward.
- Sub-thump: `neon-cascade` beat in lib/beats.ts at NEON_CASCADE_T --
  fx.impact double-pop, requestFlash()-gated, hysteresis 0.006 re-arm.

## S2.16 check (max-contrast issue)
- Power-on is a single dim->lit step per element; no oscillating emissives,
  no flicker loops, no strobe. Krackle is position jitter at 12 fps (8 low
  tier), constant luminance. Lettering (troika SDF) is single-layer crisp.
- Grain/paperTex already lowered in the neon recipe (lib/recipes.ts row 3).
