---
description: Run the current phase's gate checks via gate-auditor
---

Determine the current phase from PLAN.md and the git log. Ensure the dev
server is running (npm run dev). Invoke the gate-auditor subagent with the
phase's gate checklist from SPEC.md S7 (plus S5b.4 composition and S2.16
comfort checks for realized issues). Then: if every check passes, record the
result in DECISIONS.md; for failures, iterate fixes (max 5 attempts per
check) through the routing table, then apply the S0.6 degradation ladder.
Never ask the user; log degraded-passes prominently.
