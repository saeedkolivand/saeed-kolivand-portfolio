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
