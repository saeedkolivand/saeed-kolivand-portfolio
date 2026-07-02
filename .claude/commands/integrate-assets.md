---
description: Scan assets/prompts/ for delivered images, swap them in, verify in situ
---

For each prompt file in assets/prompts/: check whether its declared target
path (public/textures/... or public/images/...) now exists. For every
delivered file: wire it into the owning issue (replace the procedural
stand-in), then have gate-auditor screenshot it in situ and verify it sits
in the recipe's palette and does not fight the halftone pass. Move the
prompt file to assets/prompts/done/. Never wait for or ask about undelivered
assets.
