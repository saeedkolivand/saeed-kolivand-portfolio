import AudioToggle from "@/components/AudioToggle";
import Experience from "@/components/Experience";
import JumpCover from "@/components/JumpCover";
import Lettering from "@/components/Lettering";
import PressCta from "@/components/PressCta";
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
      <Lettering />
      <PressCta />
      <AudioToggle />
      <JumpCover />
      <ScrollProxy />
    </main>
  );
}
