---
name: build-screen
description: Build (or rebuild) one screen from its flow-doc entry following CLAUDE.md, run typecheck/lint/test/build and a 375 px overflow check, then flip the entry's Status to built and update docs/SCREEN_MAP.md. The only command allowed to change a flow-doc Status.
---

# /build-screen <Screen — Heading> — build one screen from its flow doc

Argument: the entry heading, e.g. `Outreach — Inbox and draft editor`, or a route such as `/outreach`.

## Steps

1. **Find the entry** via `docs/SCREEN_MAP.md` and read it in full in `docs/CANDIDATE_FLOW.md`, `docs/SALES_FLOW.md` or `docs/SHARED_FLOW.md`. No entry → stop: create it first (all ten fields, `Status: not built`) and confirm it with the user.
2. **Check readiness.** Every field is filled. Every endpoint in "State (reads/writes)" exists in the API contract (`../OpportunityPilotWebApi/docs/api-contracts.md`) **and** is implemented by the API (check `../OpportunityPilotWebApi/docs/plans-and-status.md` or its controllers). Any linked P1 OQ still Open, or a missing endpoint → stop and report; offer `/resolve-oq` or a `NotBuiltPage` instead. Vague entry → `skills/prompt-master.SKILL.md`.
3. **Read references:** the design artboard in `../opportunitypilot-ui/` (visual only — routes come from the flow doc), the closest built screen as a pattern (e.g. `OpportunitiesPage.tsx` for paged tables, `CampaignBuilder.tsx` for forms with `useBlocker`), and `CLAUDE.md`.
4. **Build in this order:**
   1. Types in `src/lib/types.ts`, mirroring the contract exactly.
   2. Pure logic in `src/features/<area>/<area>Model.ts` (labels, validation that drives CTA enable/disable, path builders) + `<area>Model.test.ts` covering every Validation rule in the entry.
   3. The page in `src/features/<area>/<Name>Page.tsx`: data via `useApi` / `api()`; loading, empty, error (`ErrorNotice` with retry), 409 and field-error states; CTA conditions exactly as in "Validation", with the blocking reason shown.
   4. Route in `src/App.tsx` with `handle: { title }` (replace the `NotBuiltPage` element if there was one); nav entry in `AppShell.tsx` only for a top-level screen.
   5. Styles in `src/styles/app.css` with tokens only; tables in `.table-card > .table-scroll`; `position: relative` on any horizontal scroller; `minmax(0, 1fr)` for single-column mobile grids.
   6. Accessibility per `CLAUDE.md`: real buttons/links/labels, announced changes, focus management, `.sr-only` names for repeated buttons.
   7. Data honesty: nothing fabricated; AI text on the `--op-ai-*` surface with its source; unknowns shown as unknown.
5. **Run the gates** from the repo root: `npx tsc -b`, `npm run lint` (no new warnings), `npm test`, `npm run build`; then delete `dist/`.
6. **375 px check:** run `npm run dev` with the API running, open each new/changed route at 375 px width (browser devtools or Playwright) and confirm `document.documentElement.scrollWidth <= window.innerWidth`, including open menus, long names and error states. If it could not be run, say so — do not flip Status.
7. **Update docs (same change):**
   - Flow-doc entry: set **Status** to `built`; rewrite Actions/State/Validation to match what was actually built; replace TODOs with remaining real gaps.
   - `docs/SCREEN_MAP.md`: route, component and status.
   - `docs/PRODUCT.md (Project reference section)`: new endpoints in the "Endpoints the web app calls" table, new env vars.
   - Run `/audit-oq` for the touched files and register new gaps; mark OQs this build closed as Resolved (with the date and files).
8. **Report:** files created/changed, gate results, 375 px result (and how it was checked), docs updated, open OQs left.

## Anti-patterns

- Never flip Status without green gates and a real 375 px check.
- Never build against an endpoint the API has not implemented; never invent fields.
- Never add sample data to make an empty screen look finished.
- Never change another screen's behaviour while building this one.
- Never commit or push unless asked.
