import { CanvasTexture, SRGBColorSpace } from "three";
import { COLOR } from "./config";

// Draws a syntax-highlighted code editor to a 2D canvas and wraps it as a texture for the
// monitor screen. Static (drawn once) — the "live" feel comes from the fly-through + screen
// bloom; a typing/cursor animation is a later enhancement. The caller disposes the texture.
// TODO(asset): could swap for a real editor screenshot / <video> texture of the actual site.

type Seg = [text: string, color: string];

const C = {
  kw: "#ff7b72",
  fn: "#d2a8ff",
  str: "#a5d6ff",
  num: "#79c0ff",
  com: "#8b949e",
  plain: "#c9d1d9",
  punct: "#8b949e",
} as const;

// The portfolio's own tech, as a wink.
const LINES: Seg[][] = [
  [["// iamsaeed.dev — three.js + react-three-fiber", C.com]],
  [],
  [["import", C.kw], [" { useFrame } ", C.plain], ["from", C.kw], [' "@react-three/fiber"', C.str]],
  [],
  [["export", C.kw], [" ", C.plain], ["function", C.kw], [" ", C.plain], ["CameraRig", C.fn], ["() {", C.punct]],
  [["  ", C.plain], ["const", C.kw], [" t = useScrollStore((s) => s.t)", C.plain]],
  [["  useFrame(() => {", C.plain]],
  [["    curve.", C.plain], ["getPointAt", C.fn], ["(t, camera.position)", C.plain]],
  [["    camera.", C.plain], ["lookAt", C.fn], ["(target)", C.plain]],
  [["  })", C.plain]],
  [["  ", C.plain], ["return", C.kw], [" ", C.plain], ["null", C.num]],
  [["}", C.punct]],
];

// Which line (0-based) the caret sits at — derived from LINES so it can't silently drift.
const CARET_LINE = 7;

export function makeCodeEditorTexture(): CanvasTexture {
  const W = 1024;
  const H = 576;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d canvas context unavailable"); // unreachable for a fresh canvas

  ctx.fillStyle = COLOR.screenBg;
  ctx.fillRect(0, 0, W, H);

  // top tab bar + traffic lights + filename
  const barH = 44;
  ctx.fillStyle = "#161b22";
  ctx.fillRect(0, 0, W, barH);
  const dots = ["#ff5f56", "#ffbd2e", "#27c93f"];
  dots.forEach((d, i) => {
    ctx.fillStyle = d;
    ctx.beginPath();
    ctx.arc(24 + i * 26, barH / 2, 7, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = "#0d1117";
  ctx.fillRect(120, 8, 190, barH - 8);
  ctx.fillStyle = "#c9d1d9";
  ctx.font = "20px monospace";
  ctx.textBaseline = "middle";
  ctx.fillText("CameraRig.tsx", 138, barH / 2 + 1);

  // gutter
  const gutterW = 62;
  ctx.fillStyle = "#0b0f14";
  ctx.fillRect(0, barH, gutterW, H - barH);

  // code
  const fontSize = 22;
  const lineH = 34;
  ctx.font = `${fontSize}px monospace`;
  const top = barH + 28;
  const codeX = gutterW + 16;
  LINES.forEach((segs, i) => {
    const y = top + i * lineH;
    ctx.fillStyle = "#484f58";
    ctx.textAlign = "right";
    ctx.fillText(String(i + 1), gutterW - 12, y);
    ctx.textAlign = "left";
    let x = codeX;
    for (const [text, color] of segs) {
      ctx.fillStyle = color;
      ctx.fillText(text, x, y);
      x += ctx.measureText(text).width;
    }
    if (i === CARET_LINE) {
      // steady caret at the end of that line
      let cx = codeX;
      for (const [text] of segs) cx += ctx.measureText(text).width;
      ctx.fillStyle = "#8fd4ff";
      ctx.fillRect(cx + 2, y - fontSize / 2 - 2, 3, fontSize + 4);
    }
  });

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
