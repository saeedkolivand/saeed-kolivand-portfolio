# Issue 5 -- THE PRESS (t 0.388-0.478, intensity 3 -- factory rhythm, not chaos)

S0.8 shot table (mirrored exactly in ./shots.ts). Palette S0.4 row 5: paper
#23272E, ink #E8E4DC, accents React #4FC3F7 / TS #3B82C4 / Rust #D9772F /
AI #9D6BFF. Copy: issueCopy.press (4 department labels + captions, cta
"See projects") -- never invented strings. Department materials are the four
prebuilt ShaderMaterials in shaders/pressMaterials.ts (boxy geo only, uTime
stepped, uTrace monotonic f(t), uSpark flashBudget-guarded beat envelope).

THROUGH-LINE (S5b.1/S5b.5): ONE UI button rides the conveyor left-to-right
across all four departments; every cut is motivated by following it (screen
direction constant, frame-left to frame-right the whole issue).

| # | kind | lens | share of issue | framing |
|---|---|---|---|---|
| 1 | hold | 28mm | 0.20 | establish REACT dept: wide 3/4 down the line from frame-left; cel-blue energy arch straddles the belt upper-right; the blank button slab enters frame-left and passes under the arch; FG hanging hooks, MG belt + arch + orbiting energy cells, BG dept wall + overhead pipes |
| 2 | dolly | 40mm | 0.185 | TYPESCRIPT dept tracking: camera trucks right pacing the button; blueprint wall draws its circuit traces in as we pass (uTrace, monotonic f(t)); dept label top-third, caption plaque mid-right; button gains its blueprint plate |
| 3 | dolly | 35mm | 0.185 | RUST dept low tracking: heavy-ink press blocks flank the belt, piston pounding on 2s; spark beat at p~0.5 (flash-budget guarded) slams the resting KRUNCH word (visibility = clankWordOpacity(t) scroll window); button gains its heavy ink border; FG hooks graze frame-top |
| 4 | dolly | 50mm | 0.165 | AI dept drift, slightly high: krackle constellation wall + floating node cells brighten as we pass (uPulse ramp); button gains its purple core light; nodes cross FG for depth |
| 5 | dolly | 70mm | 0.135 | stamp finale: low push-in on the stamp station looking back down the line (BG = all four bays receding); button parks dead-center; at p=0.5 the head slams -- impact frame + radial burst lines + slam kick on the resting SLAM word (visibility = stampWordOpacity(t) scroll window, fades as the CTA takes over); the button takes the CTA face and drops out of the scene as the live DOM "See projects" button; cat cameo on the crate frame-right |

Intra-issue gutters: shots 1-2, 2-3, 3-4 take PANEL-WIPE (Shot.out, new in
lib/shots.ts -- department cuts per SPEC Issue 5); shot 4-5 takes the default
whip (pace shift into the finale). Issue exit: stamp cut (S0.3, showcase-free
0.010 gutter). snapshots.retain(5) at module load keeps the issue's own
snapshot fresh in every shot tail so intra-issue panel-wipes have their
outgoing frame (paper-color fallback on deep jumps).

## Jaw-drop: the final stamp (S5b.5 diegetic CTA)
- Head travel is pure f(t): up before PRESS_STAMP_T (shot 5 p=0.5), slammed
  after -- scrub-safe both directions.
- registerJawDrop({ id: "press-stamp", t: PRESS_STAMP_T, flash: 1 }) plays
  the budgeted impact frame + sub-thump; animate drives PRESS_STAMP_POP
  (squash + radial burst) and PRESS_CTA_DROP (the DOM button drop-in).
- The stamped face label and the DOM CTA's presence are pure f(t): fast
  scrollers, reduced motion, and deep jumps all still get the clickable CTA.
- CTA click -> scrollToT(0.51) (ScrollProxy Lenis surface): smooth-scroll to
  the Issue 6 newsprint front-page story; immediate under reduced motion.

## Secondary beat: RUST clank (id "press-clank", no impact frame)
requestFlash()-guarded 0.4s uSpark envelope at PRESS_SPARK_T (shot 3 p=0.5).
Fires <3Hz by construction (beat hysteresis). The KRUNCH word rides its own
scroll window (below), not the beat.

## Beat words: scroll windows (standing rule 2026-07-03, Pop pattern)
Word VISIBILITY is a pure f(t) opacity window with 0.30 edge fades
(clankWordOpacity / stampWordOpacity in ./shots.ts) -- scrub-safe both
directions; deep jumps land the word resting at scale exactly 1; the beats
contribute only slam scale (PRESS_SPARK / PRESS_STAMP_POP kicks) + their
budgeted flashes; reduced motion = window only. Words are locked
lettering.onomatopoeia.impact entries (KRUNCH, SLAM). Press is outside the
ScrollProxy slow window, so plain notch math (~0.0043 t/notch):
- KRUNCH (rust bay): [at(0.40), at(0.695)] -- ~6.1 notches, ~2.5-notch
  plateau, PRESS_SPARK_T dead-center.
- SLAM (stamp station): [at(0.80), at(1.0)] -- ~4.2 notches, ~1.7-notch
  plateau, PRESS_STAMP_T at window p~0.66 (inside the plateau); end pinned
  to the issue range so the word fades exactly as the DOM CTA drops in and
  is gone before the exit gutter.

## S2.16 / intensity-3 check
- No channel anything; all lettering is troika SDF or the DOM CTA layer.
- AI shimmer clamped in-shader (0.8..1.0); uSpark and the impact frame are
  the only flashes, both requestFlash()-gated.
- Busier than Origin (1): constant belt motion, piston, orbit cells, node
  drift -- all on stepped 2s. Calmer than Neon/Pop (5): no full-field
  cascades, two resting beat words on f(t) windows, three panel-wipes as the
  only intra cuts.
- Reduced motion freezes stepped machinery (st=0), skips beats centrally,
  keeps every caption/label/CTA readable and pure f(t).
