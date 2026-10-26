---
name: docs-sync
description: Which document must change when web-app code changes, so docs never drift — DESIGN.md, flow docs, SCREEN_MAP, PRODUCT, DECISIONS, AI_TOOLING, PRIVACY, HANDOFF and TASKS. Read before finishing any batch.
---

# Keep the docs in step with the code

Docs change in the **same commit** as the code. Before raising the PR, walk this table against `git diff --stat main`.

| What changed | Update |
|---|---|
| A new visual or interaction pattern | `DESIGN.md` (new numbered section or a row in §7) |
| A screen added, moved or removed | `docs/SCREEN_MAP.md` and the flow doc of that role in `docs/` |
| What the product does for a user | `docs/PRODUCT.md` |
| A choice between real options | a dated entry in `docs/DECISIONS.md` |
| A `VITE_` variable | `.env.example` and `docs/PRODUCT.md` (public values only; secrets never go in `VITE_`) |
| An API call the web makes that is new | check the API repo's `docs/api-contracts.md` has it (it is the contract) |
| What the browser sends or stores about a person | `docs/PRIVACY.md` |
| Hooks, permissions, skills, MCP | `docs/AI_TOOLING.md` (`node .claude/check-ai-config.mjs` must pass) |
| End of a session | workspace `HANDOFF.md` and `TASKS.md` (status and counts) |
