"use client";

import { type ReactNode } from "react";
import { issueCenter, type IssueEntry } from "./registry";

/**
 * S2.5 set isolation: each issue is its own world-space group with its own
 * lighting. R3F disposes GPU resources on unmount, which is the
 * dispose-on-unmount contract for placeholder sets.
 */
export default function IssueShell({
  index,
  issue,
  children,
}: {
  index: number;
  issue: IssueEntry;
  children: ReactNode;
}) {
  return (
    <group name={`issue-${issue.id}`} position={issueCenter(index)}>
      <ambientLight intensity={0.9} color={issue.recipe.paper} />
      <directionalLight position={[4, 8, 6]} intensity={1.6} />
      {children}
    </group>
  );
}
