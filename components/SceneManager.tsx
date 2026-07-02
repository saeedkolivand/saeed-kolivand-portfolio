"use client";

import { ISSUES } from "@/issues/registry";
import { useScrollStore } from "@/lib/scrollStore";

/**
 * S2.5 -- keeps active +/- 1 issue sets mounted, the rest unmounted (R3F
 * disposes their GPU resources). Both gutter neighbors are always live.
 */
export default function SceneManager() {
  const active = useScrollStore((s) => s.activeIssue);
  const mounted = [active - 1, active, active + 1].filter(
    (i) => i >= 0 && i < ISSUES.length,
  );
  return (
    <>
      {mounted.map((i) => {
        const issue = ISSUES[i]!;
        const IssueScene = issue.component;
        return <IssueScene key={issue.id} index={i} />;
      })}
    </>
  );
}
