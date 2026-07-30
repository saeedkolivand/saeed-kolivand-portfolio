# How the README plates and GIF were made

Twelve plates and 96 GIF frames, captured from the running app at authored `t`
positions. Nothing here is a mockup.

**Captured against the production export, not the dev server.** `npm run build`
then serve `out/` (`python -m http.server 3001`). Shooting against `npm run dev`
bakes the Next dev-mode indicator — the small "N" disc — into the bottom-left
corner of every plate. It is not app UI and it does not exist in production, so
plates that contain it are documenting the dev server rather than the site.

1600x800, `?audio=0`, headed Chrome on a real GPU (headless rasterizes through
SwiftShader, which changes halftone dot edges, the Sobel ink line and troika SDF
antialiasing — the exact things these plates exist to show). The sound invite is
dismissed once by clicking "NOT NOW" (it writes `sk.sound-invite`, so it stays
gone), and app chrome (`switchReader`, `skipLink`, the sound button, the cover
CTA) is hidden with injected CSS before shooting.

**Driving `t`.** There is no `?t=` deep link, and `scrollToT` is a module export,
not a global — so a capture script sets `scrollTop` itself. It must apply the
inverse of `tToProgress` ([`components/ScrollProxy.tsx`](../../components/ScrollProxy.tsx)):
scroll distance is doubled inside `t ∈ [0.028, 0.082]`, so a linear
`scrollHeight * t` lands up to `0.054` early for any `t > 0.028`.

```js
const a = 0.028, b = 0.082;
const u = t <= a ? t : t <= b ? a + (t - a) * 2 : t + 0.054;
window.scrollTo(0, (u / 1.054) * (document.documentElement.scrollHeight - innerHeight));
// then wait ~2.5 s: Lenis has to ease in and the store velocity zeroes after 200 ms
```

Sanity check: at an 800 px viewport `scrollHeight` is 20237, which is
`2400vh * 1.054` — the base spacer plus exactly the stretched window.

Plate `t` values start at each issue's mid-range from
[`issues/registry.ts`](../../issues/registry.ts) and were nudged where the
mid-range framed nothing:

| Plate | `t` | Why not mid-range |
|---|---|---|
| `00-cover` | 0.004 | mid-range clips the masthead; 0.004 frames the whole cover |
| `01-noir` | 0.074 | — |
| `02-desk` | 0.135 | 0.166 is a keyboard close-up with no subject |
| `03-neon` | 0.292 | 0.265 is empty pavement; 0.292 has the lit facades |
| `04-origin` | 0.334 | 0.346 is mostly dark; 0.334 makes the panels legible |
| `05-press` … `11-letters` | 0.433, 0.527, 0.616, 0.711, 0.800, 0.889, 0.970 | — |

The hero is `t = 0.022` (the cover, mid crash-dolly). `app/opengraph-image.png`
is cropped from that same 1600x800 capture, not from `hero.png` — the shipped
hero is only 1100 wide, so it cannot be the source of a 1200x630 image. GIF
frames are `t = i/95`, `i` in `[0, 95]`.

Committed sizes, so the commands below can be checked against the tree: plates
600x300, `hero.png` 1100x550, `app/opengraph-image.png` 1200x630,
`scroll.gif` 640x320.

**The twelve table thumbnails carry `alt=""` on purpose.** Every row's `On the
page` cell already describes that scene in a sentence, so descriptive alt text
would make a screen reader announce the same content twice per row; an empty alt
marks the image as decorative and lets the prose do the work. The hero and the
GIF, which have no adjacent description, carry real alt text. This is not the
same claim as the README's "`alt` on every image" — that is a property of the
Print Edition's content images, where the image *is* the content.

**Gotcha:** the CDP eval context persists between calls, so every injected
snippet must be an IIFE. A bare `const t = ...` throws
`Identifier 't' has already been declared` on the second shot — and the scroll
silently never happens, so you get twelve copies of the same frame at twelve
different filenames.

## Encoding

ffmpeg only (already required by `npm run bake:audio`); no `sharp`, no
`pngquant`. PNG-8 rather than JPEG because halftone dots and ink lines ring
badly under JPEG.

```bash
# the twelve plates: 1600x800 capture -> 600x300 PNG-8
ffmpeg -i raw/NN-name.png -vf "scale=600:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=3" -y plates/NN-name.png

# hero: same capture at t=0.022 -> 1100x550
ffmpeg -i raw/hero.png -vf "scale=1100:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=3" -y hero.png

# social preview: crop the 1600x800 capture to 1200:630 aspect FIRST, then scale.
# 800 * (1200/630) = 1524, so take 1524 of the 1600 columns; scaling a 1600x630
# crop straight to 1200x630 would squash it horizontally by 1.11x.
ffmpeg -i raw/hero.png -vf "crop=1524:800:38:0,scale=1200:630:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=3" -y ../../app/opengraph-image.png

# gif: two-pass palette, 96 frames -> 640x320, 12 fps, 8 s per loop
ffmpeg -framerate 12 -i frames/%03d.png -vf "fps=12,scale=640:-1:flags=lanczos,palettegen=max_colors=64" -y pal.png
ffmpeg -framerate 12 -i frames/%03d.png -i pal.png -lavfi "fps=12,scale=640:-1:flags=lanczos,paletteuse=dither=none" -y scroll.gif
```

**The GIF loops forever.** No `-loop` is passed and ffmpeg's GIF default is
infinite (`NETSCAPE2.0`, loop count 0), so "8 s" is the length of one pass, not
the length of the motion. That is deliberate — see
[the ADR](../adr/0001-readme-is-image-led.md) — and `-loop -1` on the second
pass is the one-line change that makes it play once and stop.

Budget: GIF under 5 MB, plates under ~200 KB each. The frame directory is
deleted after encoding; only `scroll.gif` is committed.

Those GIF numbers are the third attempt, and the order they were traded matters:
900px with 96 colours and bayer dithering came out at **10.8 MB** — over
GitHub's 10 MB ceiling, never mind the budget. `dither=none` is the big win on
flat comic art (dithering sprays noise that kills GIF's run-length compression);
640px and 64 colours did the rest, landing at 4.1 MB. Frame count was left
alone on purpose: dropping frames would have shortened the run rather than
compressed it, and the point of the GIF is that all twelve issues go past.

`ffmpeg` note: this build has no glob support, so `-pattern_type glob` fails and
inputs have to be numerically sequenced (`%03d.png`).
