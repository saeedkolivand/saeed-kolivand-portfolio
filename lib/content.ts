export const content = {
  name: "Saeed Kolivand",
  role: "Senior Frontend Developer",
  tagline: "Frontend engineer building AI-powered tools.",
  location: "Germany",
  stack: ["React", "TypeScript", "Next.js", "Tauri", "Node.js", "GraphQL", "AI"],
  timeline: ["Started Programming", "University", "First Job", "Moved to Germany",
    "Senior Frontend Engineer", "Open Source", "AI Job Hunter", "Streaming"],
  flagship: {
    title: "AI Job Hunter",
    blurb: "Local-first desktop app: covers 16 job boards, writes the cover letters, does everything but hit submit.",
    features: ["AI agents", "Resume & cover-letter generation", "Semantic search",
      "Local AI (Ollama)", "Tauri desktop backend", "React frontend"],
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
  flagshipRepoUrl: "https://github.com/saeedkolivand/ai-job-hunter-app", // AI Job Hunter repo (newsprint front-page GITHUB button)
  email: "saeedkolivand1997@gmail.com", // render assembled at runtime (anti-scrape), never as plain text in HTML
  blogUrl: "", // optional -- `blog` command hidden until set
  resumePdf: "", // path in /public; empty => `resume` prints an "out of stock" gag page
};

// The rest of the run -- real GitHub projects (facts verified 2026-07-03).
// Flagship reuses the locked content.flagship + links fields (blurb referenced,
// never re-typed, S0.5). Dry, tone-matched one-liners; PURE ASCII (Turbopack
// rope bug); no franchise vocabulary (SPEC S1). Typed `as const` like issueCopy;
// not yet consumed by a built scene, so the shape is free.
export const projects = [
  {
    name: content.flagship.title, // reuse locked flagship
    blurb: content.flagship.blurb, // reuse locked flagship copy (no dupe)
    url: links.liveDemoUrl,
    tech: "Tauri + React",
  },
  {
    name: "AI Engineering Hub",
    blurb: "Local-first ops room for the AI toolchain: swallows metrics from every tool, serves the local API the desktop and Stream Deck read.",
    url: "https://github.com/saeedkolivand/ai-engineering-hub",
    tech: "Ops platform",
  },
  {
    name: "Claude Usage Stream Deck Plugin",
    blurb: "Your Claude session and weekly burn, lit up on a Stream Deck key.",
    url: "https://github.com/saeedkolivand/claude-usage-streamdeck-plugin",
    tech: "JavaScript",
  },
  {
    name: "TokenSaver Stream Deck Plugin",
    blurb: "Tallies the AI tokens you didn't spend, measured and estimated, one key away.",
    url: "https://github.com/saeedkolivand/tokensaver-streamdeck-plugin",
    tech: "JavaScript",
  },
  {
    name: "Vocal Remover",
    blurb: "Splits the vocals out of a track from the backing instrumental.",
    url: "https://github.com/saeedkolivand/vocal-remover",
    tech: "Python",
  },
] as const;

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
    premise: "The career of a senior frontend engineer, told as a comic.",
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
  sceneCaptions: {
    desk: [
      "Same desk every night. The keys know the way by now.",
      "The monitor never blinks first. Neither do I.",
    ],
    neon: [
      "The city runs on my stack. Every sign down there is a tool I ship with.",
      "You learn a city by shipping in it. I know every block.",
    ],
    spread: [
      "A year of green squares makes a decent sky.",
      "Every star in that band is a commit. My real GitHub graph, pinned overhead.",
    ],
  },
  neonSigns: ["REACT", "TYPESCRIPT", "JAVASCRIPT", "NEXT.JS", "GRAPHQL", "NODE.JS", "TAURI", "AI OPEN 24H"],
} as const;

// Phase 3 lettering & copy -- Issues 4-11. One content pass so issue-builders never invent strings.
// PURE ASCII source (Turbopack rope bug); no franchise vocabulary (SPEC S1). Tone: dry, noir-adjacent,
// first person, short (renders as lettering). CV facts trace to content above -- no invented biography.
export const issueCopy = {
  // Issue 4 -- Origin Page (quiet valley, intensity 1). Masthead already dropped; this page carries
  // story beats drawn from content.timeline. First person.
  origin: {
    lead: "Every issue has an origin. Here's mine, in panels.",
    beats: [
      "A kid, a hand-me-down machine, one blinking cursor.",
      "University taught me the words. The cursor taught me the rest.",
      "First job. First paycheck for making the machine flinch.",
      "Two suitcases and a one-way ticket. Cologne now.",
      "Senior Frontend. Same curiosity, sharper tools.",
      "Nights I leave the lights on in open source.",
      "Then I built a robot to hunt the jobs for me.",
    ],
  },
  // Issue 5 -- The Press (Skills factory). Department labels + one-line factory captions + the CTA
  // the assembly line manufactures end to end (diegetic UI, SPEC 5b.5).
  press: {
    departments: [
      { label: "REACT", caption: "The floor where the UI gets stamped out, part by part." },
      { label: "TYPESCRIPT", caption: "Blueprints. Every wire labeled before it ships." },
      { label: "TAURI", caption: "Heavy machinery, orange sparks. Presses the whole app into one desktop binary." },
      { label: "AI", caption: "The thinking department. Wires itself while you wait." },
    ],
    cta: "See projects",
  },
  // Issue 6 -- Newsprint (Open Source). Spec-given headline + secondaries + reused flagship blurb
  // as the front-page story + open-source ticker.
  newsprint: {
    headline: "LOCAL DEV SHIPS AGAIN",
    secondaryHeadlines: [
      "SOURCE STAYS OPEN, MAINTAINER STAYS AWAKE",
      "MERGE CONFLICT ENDS PEACEFULLY, SOURCES SAY",
      "AI OPS HUB SEES EVERY TOOL, TELLS NO CLOUD",
    ],
    frontPageStory: content.flagship.title, // reuse locked flagship
    frontPageBlurb: content.flagship.blurb, // reuse locked flagship copy
    ticker: [
      "PR MERGED",
      "AI OPS HUB SHIPS LOCAL-FIRST",
      "STREAM DECK NOW SHOWS CLAUDE USAGE",
      "TOKENSAVER COUNTS THE TOKENS SAVED",
      "42 STARS OVERNIGHT",
      "CI GREEN ACROSS THE BOARD",
    ],
  },
  // Issue 7 -- Screentone (Timeline subway). One caption per station, aligned by index to
  // content.timeline (8 entries). First person, subway flavor.
  screentone: {
    stationCaptions: [
      "Boarded here. Didn't know the route yet.", // Started Programming
      "Long stop. Learned to read the map.", // University
      "First transfer. Somebody paid the fare.", // First Job
      "Crossed a border in the dark. New line.", // Moved to Germany
      "Express track now. They handed me the throttle.", // Senior Frontend Engineer
      "Side platform I keep coming back to.", // Open Source
      "Built my own car and hitched it on.", // AI Job Hunter
      "Last stop's lit red. ON AIR.", // Streaming
    ],
  },
  // Issue 8 -- Pop Print (Streaming). Short chat pool + donation alert + donation word-pop.
  popPrint: {
    chat: [
      "first!!",
      "pog",
      "ship it already",
      "clean code king",
      "F in chat",
      "he's locked in",
      "that's a merge",
      "no bugs today?",
      "W stream",
      "green ci baby",
      "the cat! the cat!",
      "type faster!!",
    ],
    donationAlert: "NEW SUPPORTER just bought the whole team pizza.",
    // Donation alert spawns a giant word-pop (SPEC 2.12 / Issue 8 jaw-drop). ASCII, dev/streaming
    // flavored, no franchise vocabulary (S1). (Persian onomatopoeia Easter egg omitted per direction.)
    donationBoom: "KA-CHING!",
  },
  // Issue 9 -- Sketchbook (Architecture). Handwritten (Caveat) annotations along the chain
  // Frontend -> API -> Workers -> AI -> DB -> Search -> Desktop.
  sketchbook: {
    annotations: [
      "Frontend: where the user thinks it's simple.",
      "API: the polite bouncer. Checks every request.",
      "Workers: they do the boring parts, quietly.",
      "AI: reads the room, writes the letter.",
      "DB + Search: everything remembered, everything findable.",
      "Desktop: runs on your machine. No cloud, no leaks.",
    ],
  },
  // Issue 10 -- The Spread. One short constellation label per prior panel (Cover + Issues 1-9),
  // plus the closing caption over the double-page climax.
  spread: {
    constellations: [
      "The Cover", // Cover
      "The Rain", // Issue 1 Noir
      "The Desk", // Issue 2 Desk
      "The City", // Issue 3 Neon
      "The Origin", // Issue 4 Origin
      "The Press", // Issue 5 Press
      "The Headline", // Issue 6 Newsprint
      "The Line", // Issue 7 Screentone
      "The Signal", // Issue 8 Pop Print
      "The Sketch", // Issue 9 Sketchbook
    ],
    closingCaption: "One reader, one thumb, the whole run in a single sky.",
  },
  // Issue 11 -- Letters Page (Terminal). One response per locked content.terminalCommands entry.
  // `resume` is the out-of-stock gag (links.resumePdf empty); `blog` is written but stays hidden
  // until links.blogUrl is set. Email is never printed here -- it renders assembled at runtime (S0.5).
  lettersPage: {
    responses: {
      about: "Senior Frontend Developer. Cologne. I build AI-powered tools and ship them.",
      projects: "AI Job Hunter up front. Then:\nAI Engineering Hub [ops platform]\nClaude Usage [Stream Deck]\nTokenSaver [Stream Deck]\nVocal Remover [Python]",
      experience: "Years of React and TypeScript. Lately: Tauri, teaching machines to type.",
      skills: "React, TypeScript, Next.js, Tauri, Node, GraphQL, and a stubborn amount of AI.",
      contact: "The mailbox is on the desk. Assembled at runtime, so the bots stay hungry.",
      resume: "OUT OF STOCK. This issue sold out its print run. Reprint pending.",
      github: "Opening the archive. Every commit, every all-nighter, cataloged.",
      linkedin: "Straightening the tie. Opening the professional record.",
      blog: "No dispatches filed yet. Check back when the presses roll.",
      // hidden easter egg -- undocumented, not in content.terminalCommands; the real boss answers
      harley: "Harley here. Fluffy, ~2.5 years old, and in charge.\nI supervise every commit; he just types faster.\nThe actual senior engineer on this project.",
    },
    // {cmd} is replaced at runtime with the unrecognized command the visitor typed.
    unknownCommand: "'{cmd}'? Never printed that one. Command not found.",
    backCover: {
      nextIssue: "NEXT ISSUE: ???",
      barcode: "200 OK | this issue never 404s | no refunds",
    },
  },
} as const;

// Phase 5 -- The Print Edition. Structural/connective copy ONLY for the static, semantic-DOM
// reading of the comic (reduced-motion / mobile / screen-reader / SEO, zero WebGL). Every issue's
// body copy is REUSED from content/projects/issueCopy above -- never re-typed (S0.5). Section
// titles 0-9 reference issueCopy.spread.constellations (Cover..Issue 9); 10-11 supplied to match.
// PURE ASCII (Turbopack rope bug); no franchise vocabulary (S1). Email is assembled at runtime
// (S0.5) -- contactNote is the label, not the address. Tone: dry, noir-adjacent, first person.
export const printEdition = {
  masthead: {
    title: content.name, // reuse locked name
    dek: "The whole run, set in print -- a frontend engineer building AI-powered tools.",
  },
  intro: "This is the comic read flat: every panel pressed to the page, no motion, no camera. Same story, same lettering, ink that finally holds still.",
  // 12 pages, Cover..Terminal. Titles reuse issueCopy.spread.constellations (no re-type, S0.5).
  // kicker: optional 3-5 word deck.
  sectionTitles: [
    { title: issueCopy.spread.constellations[0], kicker: "first printing" }, // Cover
    { title: issueCopy.spread.constellations[1], kicker: "one window still lit" }, // Issue 1 Noir
    { title: issueCopy.spread.constellations[2], kicker: "keys under the lamp" }, // Issue 2 Desk
    { title: issueCopy.spread.constellations[3], kicker: "the stack in neon" }, // Issue 3 Neon
    { title: issueCopy.spread.constellations[4], kicker: "kid to senior" }, // Issue 4 Origin
    { title: issueCopy.spread.constellations[5], kicker: "skills off the line" }, // Issue 5 Press
    { title: issueCopy.spread.constellations[6], kicker: "open source, front page" }, // Issue 6 Newsprint
    { title: issueCopy.spread.constellations[7], kicker: "station by station" }, // Issue 7 Screentone
    { title: issueCopy.spread.constellations[8], kicker: "live and on air" }, // Issue 8 Pop Print
    { title: issueCopy.spread.constellations[9], kicker: "the architecture, by hand" }, // Issue 9 Sketchbook
    { title: "The Spread", kicker: "the whole run at once" }, // Issue 10 Spread
    { title: "The Letters", kicker: "commands in, answers out" }, // Issue 11 Terminal
  ],
  skipLinkLabel: "Skip to the Print Edition",
  toReaderLabel: "Read the Print Edition",
  toExperienceLabel: "Watch the animated version",
  altText: {
    mascot: "Harley, the fluffy golden-brown tabby cat mascot, seated and watching the desk.",
    noirWindow: "A lone figure at a single lit window on a dark, rain-streaked block.",
    originKid: "A child at a hand-me-down computer, one cursor blinking in the dark.",
    originCologne: "A young developer arriving in Cologne with two suitcases.",
    pressHarley: "Front-page newsprint photo of Harley, the golden-brown tabby mascot, on duty.",
    backCoverHarley: "Back-cover portrait of Harley, the golden-brown tabby mascot.",
  },
  contactNote: "Write to the desk. The address assembles at runtime -- never set in plain ink.",
  // Fires once in the DevTools console on every load (both paths). Headline logs styled;
  // lines log plain, then the GitHub address (links.githubUrl -- never retyped here).
  consoleEgg: {
    headline: "YOU FOUND THE SOURCE",
    lines: [
      "Peeking behind the ink at this hour. Everyone's a detective.",
      "Harley signed off on every line down here -- she's the senior engineer.",
      "I just do the typing. The rest of the run is on file:",
    ],
  },
} as const;
