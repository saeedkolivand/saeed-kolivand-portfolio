---
description: Pre-PR review gate — run grumpy-reviewer + security-reviewer on the branch diff and report a consolidated verdict.
argument-hint: "[base branch, default main]"
---

Run the project's pre-PR review gate on the current branch's diff against `$1` (default `main`).

1. Confirm there is a diff: `git diff --stat ${1:-main}...HEAD`. If empty, stop and say there's nothing to review.
2. In parallel, spawn BOTH read-only reviewers via the Agent tool, each scoped to this branch's diff vs `${1:-main}`:
   - **grumpy-reviewer** — correctness/math, r3f per-frame allocations & disposal, perf, motion-sickness / `reducedMotion` gaps, magic numbers, dead code, TS holes.
   - **security-reviewer** — high-confidence exploitable vulnerabilities only.
3. Consolidate their findings into one ranked list (most severe first) and print a verdict:
   - **FIX-FIRST** — any grumpy BLOCKER/MAJOR or security HIGH/CRITICAL. Do NOT open the PR; route fixes to the owning author agent, then re-run `/pr-gate`.
   - **SHIP-WITH-NITS** — only MINOR/NIT/LOW remain. List them; the PR may proceed.
4. Do NOT open or merge the PR yourself — report the verdict and let the human decide.

This encodes the project rule: every PR clears the review gate first (see `CLAUDE.md` → Rules → review gate).
