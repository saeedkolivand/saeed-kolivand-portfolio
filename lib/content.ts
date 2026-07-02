export const content = {
  name: "Saeed Kolivand",
  role: "Senior Frontend Developer",
  tagline: "Frontend engineer building AI-powered tools.",
  location: "Germany",
  stack: ["React", "TypeScript", "Next.js", "Rust", "Tauri", "Node.js", "GraphQL", "AI"],
  timeline: ["Started Programming", "University", "First Job", "Moved to Germany",
    "Senior Frontend Engineer", "Open Source", "AI Job Hunter", "Streaming"],
  flagship: {
    title: "AI Job Hunter",
    blurb: "Local-first desktop app: covers 16 job boards, writes the cover letters, does everything but hit submit.",
    features: ["AI agents", "Resume & cover-letter generation", "Semantic search",
      "Local AI (Ollama)", "Rust backend", "React frontend"],
  },
  streaming: { platforms: ["Twitch", "YouTube"], tools: ["OBS", "Stream Deck"] },
  terminalCommands: ["about", "projects", "experience", "skills", "contact",
    "resume", "github", "linkedin", "blog"],
} as const;

// REQUIRED_INPUT -- filled and URL-verified; empty fields hide their affordance, log, continue:
export const links = {
  githubUrl: "https://github.com/saeedkolivand", // bakes the contribution star chart
  linkedinUrl: "https://www.linkedin.com/in/saeedkolivand/",
  liveDemoUrl: "https://aijobhunter.app",
  email: "saeedkolivand1997@gmail.com", // render assembled at runtime (anti-scrape), never as plain text in HTML
  blogUrl: "", // optional -- `blog` command hidden until set
  resumePdf: "", // path in /public; empty => `resume` prints an "out of stock" gag page
};

// Phase 1 lettering & copy -- cover, title drop, onomatopoeia pools, captions, signage.
// PURE ASCII (Turbopack rope bug); no franchise vocabulary (SPEC S1). Pool the words at runtime.
export const lettering = {
  cover: {
    masthead: "SAEED KOLIVAND",
    issueLine: "ISSUE #1 - JUL 2026 - FIRST PRINTING",
    priceBox: "STILL ONLY 200 OK",
    blurb: "The origin issue: one dev, three worlds, zero ghosting.",
    barcode: "saeedkolivand", // GitHub handle, set as the cover barcode digits
    attractPrompt: "SCROLL TO CRACK THE SPINE",
  },
  titleDrop: {
    name: "SAEED KOLIVAND",
    sub: "SENIOR FRONTEND ENGINEER - AI & AGENTIC TOOLS",
  },
  onomatopoeia: {
    keycaps: ["CLACK", "CLACK-CLACK", "CLAK", "KACHUNK", "TAK-TAK", "CLICK"],
    whip: ["WHOOSH", "FWISH", "SWISH", "VWOOO", "FWOOSH", "WHIP"],
    impact: ["WHAM", "THOOM", "KRAKA-THOOM", "BADOOM", "SLAM", "KRUNCH"],
    neonPowerOn: ["BZZT", "VNNN", "ZAP", "KRZZT", "TZAK", "HMMMM"],
    rain: ["TAP TAP", "DRIP", "PATTER", "TIK TIK", "PLINK", "DRIP-DRIP"],
    cat: ["MEW", "PRRR", "MRRP", "THUMP", "PADD", "MROW"],
  },
  noirCaptions: [
    "Rain again. The kind that gets into your commits.",
    "One window lit on the whole dead block. Mine.",
    "Then the cat jumped. Cats always know the cut.",
  ],
  neonSigns: ["REACT", "TYPESCRIPT", "RUST", "NEXT.JS", "GRAPHQL", "NODE.JS", "TAURI", "AI OPEN 24H"],
} as const;
