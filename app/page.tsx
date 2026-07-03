import ExperienceGate from "@/components/ExperienceGate";

/*
 * ExperienceGate owns the mount decision and the real <h1> + all content (via
 * the always-present PrintEdition, S8). It renders the <main> landmark itself,
 * so page.tsx is just the entry point.
 */
export default function Home() {
  return <ExperienceGate />;
}
