import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export for GitHub Pages: `next build` emits ./out (HTML/CSS/JS).
  // The app is 100% client-side (one R3F canvas + a static DOM Print Edition),
  // GitHub-contribution data is baked at build time (scripts/bake-contributions.mjs),
  // so nothing needs a server. Served at the apex domain root, so no basePath.
  output: "export",
};

export default nextConfig;
