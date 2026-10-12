# Card redesign — plan

_2026-10-12 · owner brief: "refactor and redesign the whole UI, card-based, simpler; the old look was hard to demo; update DESIGN.md first". Rules live in `DESIGN.md` section 13._

## Why
Tables and long forms read as software; the owner wants something a non-technical person can follow in a demo: **a short stack of cards, one thing to do per card, one card that says what to do now.**

## Direction
Warm canvas, white floating cards (16px corners, hairline plus a soft shadow), one tinted "signature" card for the next action, big plain titles. References checked: Intercom (floating tiles on cream), Zapier (step cards), Cal.com (whitespace, one primary button). Colour palette unchanged (Notion blue on warm paper); only chrome, layout and components change.

## What changes, screen by screen (simple view)

| Screen | Before | After |
|---|---|---|
| Home | Getting-started list in a box | Signature `StepCard` (next step, big button) + four small step cards; Advanced adds the figures |
| Profile | One long form | One `Card` with 3 groups, progress dots, a save card pinned at the bottom |
| Find | Search bar + table of results | Search card (role, place, **site picker incl. All platforms**) + `LeadCard` grid; "Keep these" card |
| Review | Table + checkboxes | `LeadCard` list with a select box, **bulk bar** (Draft messages · Approve · Skip) |
| Lead / job | Two columns | Header card (title, match ring, status), "Reach out" card (LinkedIn / Email / bulk-ready), "Apply" card, details collapsed |
| Outreach | Inbox table + editor | `MessageCard` list (left) and a `ComposeCard` + `SendCard` (right); a **send queue** when several are ready |
| Follow-ups | Table | `FollowUpCard` list |
| Insights, Settings | Panels | `StatCard`s and `Card`s (Advanced; tables stay where numbers matter) |

Advanced view: the same cards plus the sidebar and the existing tables where a table is the right tool (campaign builder, full lists).

## Build order (small commits, in this order)
1. Tokens (`--op-radius-card`, shadows, warm canvas) and the card CSS; shared components `Card`, `StepCard`, `LeadCard`, `MessageCard`, `FollowUpCard`, `BulkBar`, `MatchRing` + pure helpers with tests.
2. Home → Review/Leads → Find results → Outreach → Follow-ups → Profile/Campaign form → Settings/Insights polish.
3. Bulk (select → draft messages → approve → send queue) on top of the cards.
4. Edge pass at 1280 and 375, light and dark, axe 0, both workspaces; re-record the demo.

## Risks
- A restyle can hide layout bugs → every screen is opened in Edge before commit.
- Tables remove density for power users → Advanced keeps them.
- Existing coachmark targets (`data-coach`) must survive the move to cards → keep ids, re-check each tour.
