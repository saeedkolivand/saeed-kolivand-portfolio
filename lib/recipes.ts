/**
 * PrintRecipe -- the per-issue knob set for the single shared post pipeline
 * (S2.6). Issues never rebuild the composer; they swap one of these and the
 * pipeline cross-fades its uniforms (~0.2s). All values respect S2.16: no
 * channel offsets exist anywhere in this model.
 *
 * Authoring surface (Phase 2 gate): a new issue's full look is ONE
 * printRecipe() object. Only paper + ink are required; bg defaults to paper
 * and every other knob to RECIPE_DEFAULTS, so a minimal recipe is one line:
 *
 *   printRecipe({ paper: "#F2EAD9", ink: "#201D18" })
 *   printRecipe({ paper: "#0B0F0C", ink: "#33FF66", mono: 0.85, edge: 0.6 })
 *
 * Dark paper flips halftone/hatch polarity automatically inside PrintEffect
 * (derived from paper luminance) -- no recipe field needed.
 */
export interface PrintRecipe {
  /** page + ink hexes from the S0.4 palette table */
  paper: string;
  ink: string;
  /** scene background/fog color */
  bg: string;
  /** 0..1 desaturation toward mono (noir/screentone worlds) */
  mono: number;
  /** ink edge pass strength 0..1 */
  edge: number;
  edgeColor: string;
  /** halftone blend 0..1 and dot screen scale in px */
  halftone: number;
  halftoneScale: number;
  grain: number;
  paperTex: number;
  vignette: number;
  /** line-boil amplitude 0..1 */
  boil: number;
  /** crosshatch shadow shading 0..1 (noir/sketch looks) */
  hatch: number;
  /** hatch stroke pitch in px */
  hatchScale: number;
}

/** Defaults for every non-color knob; printRecipe() spreads these under your overrides. */
export const RECIPE_DEFAULTS: Omit<PrintRecipe, "paper" | "ink" | "bg"> = {
  mono: 0,
  edge: 0.7,
  edgeColor: "#201D18",
  halftone: 0.4,
  halftoneScale: 6,
  grain: 0.06,
  paperTex: 0.1,
  vignette: 0.25,
  boil: 0.5,
  hatch: 0,
  hatchScale: 7,
};

/**
 * Build a full PrintRecipe from paper + ink and any overrides. bg defaults
 * to paper (sets are boxed rooms; bg only shows during cuts).
 */
export function printRecipe(
  spec: Partial<PrintRecipe> & Pick<PrintRecipe, "paper" | "ink">,
): PrintRecipe {
  return { ...RECIPE_DEFAULTS, bg: spec.paper, ...spec };
}

/** One recipe per registry entry, S0.4 palettes. Visibly distinct per S7 Phase 0 gate. */
export const RECIPES: PrintRecipe[] = [
  // 0 Cover -- printed cover, mid halftone
  printRecipe({ paper: "#F2EAD9", ink: "#201D18", halftone: 0.45, halftoneScale: 7 }),
  // 1 Noir -- B&W hatched ink: crosshatch carries the shadow shading,
  // halftone drops to a whisper so dots and strokes never fight. Dark-paper
  // polarity flip: white ink lands on lit forms, deep shadow stays
  // paper-black silhouette (ruling 2026-07-02, gate fix attempt 1)
  printRecipe({ paper: "#0E0E10", ink: "#F5F1E8", mono: 1, edge: 0.95, edgeColor: "#F5F1E8", halftone: 0.12, halftoneScale: 4, vignette: 0.45, hatch: 1, hatchScale: 6 }),
  // 2 Desk -- warm full-color halftone
  printRecipe({ paper: "#F6EFE3", ink: "#1C1B1A", halftone: 0.6, halftoneScale: 8, grain: 0.08 }),
  // 3 Neon Ink -- flat neon on black, razor edges, barely any dots.
  // grain/paperTex lowered: 10Hz grain flicker on a max-contrast black
  // world edged toward strobe territory (S2.16 check, 2026-07-02)
  printRecipe({ paper: "#060608", ink: "#EDEDF2", edge: 1, edgeColor: "#EDEDF2", halftone: 0.08, halftoneScale: 4, grain: 0.03, paperTex: 0.05, vignette: 0.4, boil: 0.7 }),
  // 4 Origin -- muted valley
  printRecipe({ paper: "#EDE7DB", ink: "#2A2722", halftone: 0.3, edge: 0.5, boil: 0.3 }),
  // 5 Press -- dark factory, strong ink
  printRecipe({ paper: "#23272E", ink: "#E8E4DC", edgeColor: "#E8E4DC", edge: 0.85, halftone: 0.35, halftoneScale: 5 }),
  // 6 Newsprint -- heavy coarse halftone, near-mono
  printRecipe({ paper: "#EAE3D2", ink: "#221F1A", mono: 0.65, halftone: 0.8, halftoneScale: 11, grain: 0.12, paperTex: 0.18 }),
  // 7 Screentone -- manga B&W, fine dots
  printRecipe({ paper: "#101014", ink: "#E8E8E8", mono: 1, edge: 0.9, edgeColor: "#E8E8E8", halftone: 0.65, halftoneScale: 4.5 }),
  // 8 Pop Print -- oversaturated webcomic
  printRecipe({ paper: "#1B0F2E", ink: "#F4EFFF", halftone: 0.5, halftoneScale: 9, edge: 0.8, edgeColor: "#F4EFFF", boil: 0.65 }),
  // 9 Sketchbook -- graphite on paper, soft edges
  printRecipe({ paper: "#F7F2E7", ink: "#232019", mono: 0.7, edge: 0.45, edgeColor: "#5A564E", halftone: 0.12, paperTex: 0.22, boil: 0.6 }),
  // 10 Spread -- cosmic near-black
  printRecipe({ paper: "#05060D", ink: "#EAF2FF", edge: 0.4, edgeColor: "#EAF2FF", halftone: 0.18, halftoneScale: 5, vignette: 0.5 }),
  // 11 Terminal -- CRT green on black
  printRecipe({ paper: "#0B0F0C", ink: "#33FF66", mono: 0.85, edge: 0.6, edgeColor: "#33FF66", halftone: 0.35, halftoneScale: 3.5, vignette: 0.45 }),
];

/** Per-issue accent hexes (S0.4), used by placeholder props now, real sets later. */
export const ACCENTS: string[][] = [
  ["#E2574C", "#2BB3A3"],
  ["#FFB347", "#FF4FA3", "#39D0D8"],
  ["#F5A623", "#2BB3A3", "#E2574C"],
  ["#00E5FF", "#FF3D9A", "#B7FF2E", "#FF9E1F", "#8A7DFF"],
  ["#7C93B2", "#C97B5A"],
  ["#4FC3F7", "#3B82C4", "#D9772F", "#9D6BFF"],
  ["#C63D2F"],
  ["#F6C243"],
  ["#FF3D81", "#29E0FF", "#FFD32E"],
  ["#6FA8DC"],
  ["#FFD166", "#7C5CFF", "#39D353"],
  ["#FFB000"],
];
