# The README is image-led; engine detail lives in docs/ENGINE.md

The README was 26 KB of prose with no images at all, so a visitor read three
screens of text before learning the thing is beautiful. We captured plates from
the running app, put them at the top and inside the twelve-issues table, and
moved `Engine notes` and the audio deep dive verbatim to
[`docs/ENGINE.md`](../ENGINE.md). New engine prose goes there, not in the README.

## Considered options

Trimming to ~9 KB was the original target and was rejected. `Engine notes` +
`Audio` are only half the file, so 9 KB would have required cutting `The
constraints` too — the section PR #65 deliberately built the README around as
"the part a senior reader is actually assessing". Cutting depth is cheap;
cutting the thesis would have meant the images were paid for by the argument
they were added to support. The result is ~14 KB, and it scans shorter than the
old 26 KB because twelve plates break up every wall of text.

## Consequences

- Three shields badges were added, reversing the "no badges" property that
  PR #65 verified on purpose. Deliberate, not drift.
- The autoplaying scroll GIF cannot honour `prefers-reduced-motion` — GitHub
  supports `<picture>` with `prefers-color-scheme` only. Accepted knowingly,
  and it is the one place in the project where motion is not opt-in.
- **It loops indefinitely, and the relevant criterion is WCAG 2.2.2 (Pause,
  Stop, Hide), not 2.3.1.** The 8 s figure is one pass, not the duration of the
  motion: no `-loop` is passed and ffmpeg's GIF default is infinite. The flash
  budget is satisfied either way (~1.5 transition frames per second against the
  3/s cap), but a flash analysis is the wrong test for perpetual motion with no
  pause control, and this consequence originally claimed a time-boxed exception
  it did not have. Visible looping motion was chosen over a `<details>` gate
  because the motion is what the portfolio is selling; `-loop -1` in
  [`../readme/CAPTURE.md`](../readme/CAPTURE.md) reverses it in one line if that
  trade stops being worth it.
- `t range` stays in the README table but `Exit gutter` moves out, so the
  "ranges and gutters chain exactly to 1.000" claim is no longer verifiable from
  the front page alone.
- Plates live in `docs/`, not `public/`, so `output: "export"` never ships them
  to the site.
