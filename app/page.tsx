import { Experience } from "@/components/Experience";
import { ScrollProxy } from "@/components/ui/ScrollProxy";
import { UIOverlay } from "@/components/ui/UIOverlay";

export default function Home() {
  return (
    <>
      {/* One persistent fixed Canvas, the tall scroll spacer that drives t, and dev UI. */}
      <Experience />
      <ScrollProxy />
      <UIOverlay />
    </>
  );
}
