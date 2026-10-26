---
name: resolve-oq
description: Close exactly ONE open question (e.g. /resolve-oq OQ-FE-012) — read the entry, fix the source per CLAUDE.md, run the gates, then update docs/open-questions.md, docs/SCREEN_MAP.md and docs/PRODUCT.md (Project reference section) together.
---

# /resolve-oq OQ-FE-### — close one gap atomically

Argument: one ID, e.g. `OQ-FE-012`. One OQ per run. If no ID is given, list the Open P1/P2 entries and ask which one.

## Steps

1. **Read the entry** in `docs/open-questions.md`. Stop if it is not Open.
2. **Check the owner.** Owner **Shivanshu** (a decision, credentials or a contract): do not change code. Ask for the decision in one message (use `.claude/skills/prompt-master/SKILL.md`), and only continue once it is given. Record the decision in the entry.
3. **Read context:** every file in `Where`; the flow-doc entry for the affected screen (`docs/*_FLOW.md`); the API contract if an endpoint or type is involved (`../OpportunityPilotWebApi/docs/api-contracts.md`); the relevant `CLAUDE.md` rules.
4. **Fix the source** — the smallest change that resolves the entry:
   - Pure logic goes in the feature's `*Model.ts` with a co-located `*.test.ts` case.
   - API calls go through `src/lib/api.ts` / `useApi`; types in `src/lib/types.ts` mirror the contract.
   - CSS uses tokens; scroll containers `position: relative`; mobile grids `minmax(0, 1fr)`.
   - Do not change unrelated behaviour. If the fix reveals a new gap, log it as a new OQ instead of widening this change.
5. **Run the gates** from the repo root: `npx tsc -b`, `npm run lint` (warning count must not rise; it drops if this OQ was a warning), `npm test`, `npm run build`, then delete `dist/`. For any UI change, check the affected screens at 375 px for horizontal overflow and state whether that check was actually run.
6. **Update the three tracking docs in the same change:**
   - `docs/open-questions.md` — move the row to **Resolved** with the date and what changed (files touched).
   - `docs/SCREEN_MAP.md` — if a route, component or status changed (a `NotBuiltPage` replaced, a route added/removed). Otherwise leave it, and say so.
   - `docs/PRODUCT.md (Project reference section)` — if an env var, endpoint, deploy setting or auth mode changed. Otherwise leave it, and say so.
   - Also update the screen's flow-doc TODOs line that cited this OQ. Do **not** flip a flow-doc `Status` here — that is `/build-screen`.
7. **Report:** OQ ID and title, files changed, gate results, which tracking docs changed, anything left open (new OQ IDs).

## Anti-patterns

- Never resolve more than one OQ per run.
- Never resolve an OQ that `/audit-oq` has not registered — audit first.
- Never mark Resolved when the gates fail or the fix is partial; leave it Open with a note.
- Never commit or push unless asked.
