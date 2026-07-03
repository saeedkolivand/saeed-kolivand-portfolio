import gsap from "gsap";
import { clamp01, easeInOut, type Pose, type Shot, type Vec3 } from "@/lib/shots";
import { printRecipe } from "@/lib/recipes";
import { registerJawDrop } from "@/lib/beats";
import { PopPool } from "@/lib/pops";
import { snapshots } from "@/lib/snapshots";
import { content, issueCopy, links } from "@/lib/content";
import { issueCenter, RANGES } from "../timeline";

/**
 * Issue 11 TERMINAL / LETTERS PAGE -- authored shots + interaction data
 * (S0.8 table in ./shots.md). Establish -> interactive hold -> back-cover
 * pullback, chained by DRIFT gutters (quiet-valley grammar): the camera
 * never cuts inside the journey's denouement. No gutter after -- t ends
 * here (S0.3).
 */

const [S, E] = RANGES[11]!;
const W = E - S;
const at = (f: number) => S + f * W;
const [CX] = issueCenter(11);

/** vertical fov in degrees for a full-frame lens: 2*atan(12/mm) */
const lens = (mm: number) => (2 * Math.atan(12 / mm) * 180) / Math.PI;

// ---- palette (S0.4 row 11 -- locked; +/-10% lightness for working tones) ----
export const PAPER = "#0B0F0C";
export const INK = "#33FF66";
export const AMBER = "#FFB000";
/** screen glass (paper +5%) and case/desk dark (paper -4%) working tones */
export const SCREEN = "#121A14";
export const CASE = "#070A08";

/**
 * Issue 11's full look: the Phase 0 terminal recipe extended (ruling in
 * ./shots.md): halftone 0.5 @ 3.0px = CRT scanline pitch on flipped dark
 * paper; mono 0.7 keeps the amber accents warm; vignette 0.5 = tube
 * falloff; boil/grain lowered for the intensity-1 near-black world (S2.16).
 */
export const TERMINAL_RECIPE = printRecipe({
  paper: PAPER,
  ink: INK,
  mono: 0.7,
  edge: 0.6,
  edgeColor: INK,
  halftone: 0.5,
  halftoneScale: 3.0,
  grain: 0.05,
  paperTex: 0.08,
  vignette: 0.5,
  boil: 0.3,
});

// ---- shot windows (fractions of the issue range; table in ./shots.md) -------
const F: [number, number][] = [
  [0.0, 0.3], // 1 terminal establish
  [0.33, 0.66], // 2 command-panel play (interactive hold)
  [0.7, 1.0], // 3 back-cover pullback
];

// Drift contract (lib/shots.ts): shared poses -- shot 1 ends where shot 2
// begins, shot 2 ends where shot 3 begins. Near-zero delta at the mid-gutter
// snap; the intensity-1 issue breathes instead of cutting.
const P2_FROM: Pose = {
  position: [CX + 1.6, 4.3, 12.6],
  target: [CX + 0.4, 3.9, 0],
  roll: 0.008,
  fov: lens(32),
};
const P3_FROM: Pose = {
  position: [CX + 2.1, 4.8, 12.2],
  target: [CX + 0.4, 4.2, 0],
  roll: 0,
  fov: lens(32),
};

export const TERMINAL_SHOTS: Shot[] = [
  {
    // establish: three-quarter from front-left, slight dutch; CRT right of
    // thirds, keyboard FG, back-cover page BG
    id: "term-establish",
    issue: 11,
    range: [at(F[0]![0]), at(F[0]![1])],
    kind: "dolly",
    from: { position: [CX - 13, 6.5, 18], target: [CX - 0.5, 3.2, 0], roll: -0.022, fov: lens(28) },
    to: P2_FROM,
    ease: easeInOut,
    out: "drift",
  },
  {
    // play: near-frontal interactive dwell (hold = pointer parallax, S2.15);
    // micro-drift only, panels + cards own the frame
    id: "term-play",
    issue: 11,
    range: [at(F[1]![0]), at(F[1]![1])],
    kind: "hold",
    from: P2_FROM,
    to: P3_FROM,
    ease: easeInOut,
    out: "drift",
  },
  {
    // pullback: rise + retreat until the printed back cover fills frame;
    // ends on the closed book at t = 1.000
    id: "term-backcover",
    issue: 11,
    range: [at(F[2]![0]), at(F[2]![1])],
    kind: "dolly",
    from: P3_FROM,
    to: { position: [CX, 8, 30], target: [CX, 8, -6], roll: 0, fov: lens(24) },
    ease: easeInOut,
  },
];

// ---- commands (locked content; S0.5 affordance rules) -----------------------
/** blogUrl empty -> blog hidden (S0.5): no card, but still answers when TYPED. */
export const VISIBLE_COMMANDS: readonly string[] = content.terminalCommands.filter(
  (c) => c !== "blog" || links.blogUrl !== "",
);

/**
 * Locked responses, widened for string-keyed lookup (values are all locked).
 * Deliberately holds MORE keys than VISIBLE_COMMANDS: hidden keys (blog while
 * blogUrl is empty, the harley easter egg -- content ruling 2026-07-03)
 * answer when typed but get no card; VISIBLE_COMMANDS gates the affordance
 * only. Anything else is unknownCommand.
 */
const RESPONSES: Record<string, string> = issueCopy.lettersPage.responses;

/**
 * S0.5 anti-scrape: the address is assembled at call time (user gesture)
 * from its halves joined with an at-sign built from a char code -- the
 * joined form never exists as a literal in this source and only ever lands
 * in a WebGL text texture, never in served HTML/DOM.
 */
function assembleEmail(): string {
  return links.email.split("@").join(String.fromCharCode(64));
}

// ---- floating response panel pool (lib/pops.ts -- pooled, GC-clean) ---------
export interface PanelData {
  cmd: string;
  body: string;
}

export const panelPool = new PopPool<PanelData>(4, 6, () => ({ cmd: "", body: "" }));

/**
 * Set-local anchors cycled per spawn; panels float in the terminal room air.
 * All z >= 2.4: IN FRONT of the CRT face (bezel z 1.76) so panels overlap
 * the tube like speech balloons instead of clipping behind it (loop iter 1).
 * CAT CLEARANCE (user feedback 2026-07-03): no anchor's 5.8 x 3.4 panel may
 * cover the sit cat's rect (x 0.9..2.9, y 5.4..7.4) -- the mascot stays
 * visible through the whole interactive hold, whatever gets clicked.
 */
export const PANEL_ANCHORS: Vec3[] = [
  [-3.4, 5.9, 2.6],
  [-0.9, 3.5, 2.4],
  [-2.6, 6.4, 2.8],
  [2.9, 3.0, 2.5],
];
let anchorCursor = 0;

/** cycle a pooled panel with a command label + body (zero alloc, lib/pops) */
function spawnPanel(cmd: string, body: string) {
  const slot = panelPool.spawn(PANEL_ANCHORS[anchorCursor]!);
  anchorCursor = (anchorCursor + 1) % PANEL_ANCHORS.length;
  slot.data.cmd = cmd;
  slot.data.body = body;
}

// ---- resume paper-sheet drop (single pooled slot; renderer in Terminal.tsx) -
export const dropPool = new PopPool<null>(1, 2.8, () => null);
/** set-local anchor of the desk-snapshot window the sheet falls into --
 * lower-left FG, clear of the panel anchors and fully in the play frame */
export const RESUME_DROP_POS: Vec3 = [-4.9, 3.5, 3.0];

// Retain the Issue-2 desk snapshot from module load (not mount): PostPipeline
// refreshes retained keys in that issue's exit tail, long before Issue 11
// mounts on a forward read (Origin precedent). Snapshots are framebuffer
// copies, NOT live RTs -- the S2.10 budget is untouched.
snapshots.retain(2);

/**
 * Run a terminal command (keyboard Enter or card click). Any RESPONSES key
 * (visible or hidden) spawns a pooled response panel; resume additionally
 * spawns the sheet drop. github/linkedin ALSO open the real page (user
 * feedback 2026-07-03): window.open fires synchronously inside the click /
 * Enter-keydown gesture so popup blockers allow it -- the panel still
 * spawns as the diegetic echo. Unknown input prints the locked
 * unknownCommand line with the typed echo substituted for {cmd} AND returns
 * false so the caller plays the screen flinch on top (ruling in ./shots.md).
 */
export function runCommand(cmd: string): boolean {
  const locked = RESPONSES[cmd];
  if (locked === undefined) {
    spawnPanel(cmd, issueCopy.lettersPage.unknownCommand.replace("{cmd}", cmd));
    return false;
  }
  spawnPanel(cmd, cmd === "contact" ? locked + "\n" + assembleEmail() : locked);
  if (cmd === "resume") dropPool.spawn(RESUME_DROP_POS);
  if (cmd === "github" && links.githubUrl !== "") window.open(links.githubUrl, "_blank", "noopener");
  if (cmd === "linkedin" && links.linkedinUrl !== "") window.open(links.linkedinUrl, "_blank", "noopener");
  return true;
}

// ---- jaw-drop: the back-cover reveal (gentle BY DESIGN, intensity 1) --------
/** shot-3 entry, just as the NEXT ISSUE card comes into frame */
export const BACK_COVER_T = at(0.74);
/** authored-time squash channel read by Terminal.tsx (0 when idle) */
export const BACK_COVER_POP = { v: 0 };

let coverTl: gsap.core.Timeline | null = null;

// FLASHLESS registerJawDrop (quiet-valley clause, lib/beats.ts -- Issues 4/9
// precedent): the reveal itself is the pure-f(t) pullback; this beat only
// adds the card's soft squash pop. BeatRunner owns hysteresis + skip.
registerJawDrop({
  id: "terminal-back-cover",
  t: BACK_COVER_T,
  animate: () => {
    coverTl?.kill();
    coverTl = gsap
      .timeline()
      .set(BACK_COVER_POP, { v: 0 })
      .to(BACK_COVER_POP, { v: 1, duration: 0.35, ease: "back.out(2.2)" })
      .to(BACK_COVER_POP, { v: 0, duration: 0.8, ease: "power2.out" });
  },
});

// ---- cat walk-off (pure f(t), scrub-safe -- S5b.1 guide exit) ---------------
export const CAT_WALK_RANGE: [number, number] = [at(0.72), at(0.97)];
export const catWalk = (t: number) =>
  clamp01((t - CAT_WALK_RANGE[0]) / (CAT_WALK_RANGE[1] - CAT_WALK_RANGE[0]));
