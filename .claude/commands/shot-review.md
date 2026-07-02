---
description: Per-shot screenshot audit of an issue against the S5b.4 composition checklist
argument-hint: <issue-id or number>
---

For issue $ARGUMENTS: read its shots (issues/XX-*/shots.md if present, else
the registry), have gate-auditor screenshot every shot at its representative
t via the running dev server, and check each against SPEC.md S5b.4: one clear
focal point; three depth planes (FG/MG/BG); readable as a 200px thumbnail;
intentional focal placement; lettering pixel-crisp with zero fringing
(S2.16). Iterate fixes with issue-builder, max 3 per shot, then log.
