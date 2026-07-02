import Experience from "@/components/Experience";
import ScrollProxy from "@/components/ScrollProxy";
import { content } from "@/lib/content";

export default function Home() {
  return (
    <main>
      {/* All text also lives in the DOM (S8) -- grows into the Print Edition in Phase 5 */}
      <h1 className="sr-only">
        {content.name} -- {content.role}
      </h1>
      <p className="sr-only">{content.tagline}</p>
      <Experience />
      <ScrollProxy />
    </main>
  );
}
