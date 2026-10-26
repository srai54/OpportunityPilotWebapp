---
name: ui-change
description: The checklist for any OpportunityPilot screen, component, copy or chart change — DESIGN.md rules, model + tests, accessibility, both workspaces, and the Edge check at 1280/375 light/dark with axe 0. Read before touching anything under src/features or src/components, or any CSS.
---

# Change the UI

`DESIGN.md` is mandatory and wins over memory. Open the sections you need (tokens §3, components §7, forms §8, charts §9, copy §10,
accessibility §11, cards §13, traps §17) before writing code.

## Decision table

| Need | Use |
|---|---|
| Colour, spacing, radius | tokens in `src/styles/tokens.css` only; never a hex in a component |
| Logic (validation, scoring, formatting, matching) | a pure `*Model.ts` next to the component, with a `*Model.test.ts` |
| Data from the API | `useApi` for reads, `api()` for writes; show `ErrorNotice` with the server's field reasons |
| A dialog or sheet | `Sheet` (`features/calls/Sheet.tsx`): focus trap, Esc closes, focus returns |
| Key figures / charts | `KpiBand` + `KpiCard`, `Donut`, `GoalRing`; every chart has a title, a takeaway sentence and an accessible name |
| On/off setting | a `role="switch"` button with `aria-checked` (see `.top-switch`) |
| A secret the person pastes | password input, `autocomplete="off"`, validated before sending, never shown back (DESIGN.md §22) |
| Text on a tinted panel | the matching `--op-on-*-tint` token (primary blue fails contrast on tints) |

## Steps

1. Model first, with tests; then the component using existing components.
2. Wording in plain words (DESIGN.md §10); check Candidate and Sales wording, Guide and Advanced.
3. `npm run typecheck`, `npm run lint`, `npm run test:coverage` (floors in `vite.config.ts`), `npm run build`.
4. Edge check against a local API (`VITE_DEV_AUTH=true`, dev user in `localStorage['op.devUser']`): every touched screen at 1280 light and
   375 dark, axe 0, no sideways scroll, no console errors. Look at the screenshots, not only the numbers.
5. A new pattern goes into `DESIGN.md` in the same batch. Shared pieces (progress, resume builder, journey) are copied to
   `OpportunityPilotCandidate` in the same batch.
