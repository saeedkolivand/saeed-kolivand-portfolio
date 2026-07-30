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

The hero is `t = 0.022` (the cover, mid crash-dolly), also cropped to 1200x630
for `app/opengraph-image.png`. GIF frames are `t = i/95`, `i` in `[0, 95]`.

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
# plates: quantize in place
ffmpeg -i in.png -vf "scale=900:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=3" -y out.png

# gif: two-pass palette, 96 frames -> 640x320, 12 fps, 8 s
ffmpeg -framerate 12 -i frames/%03d.png -vf "fps=12,scale=640:-1:flags=lanczos,palettegen=max_colors=64" -y pal.png
ffmpeg -framerate 12 -i frames/%03d.png -i pal.png -lavfi "fps=12,scale=640:-1:flags=lanczos,paletteuse=dither=none" -y scroll.gif
```

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
