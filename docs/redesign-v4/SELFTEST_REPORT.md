# Self-test report — Redesign v4 prototype

**Date:** 13 Oct 2026 · **Tools:** Playwright (Chromium) + axe-core 4.10, WCAG 2.1 A/AA · **Script:** `selftest/prototype-selftest.cjs`

## Result

| Check | Result |
|---|---|
| Screen states checked (23 screens × Candidate/Sales × Simple/Advanced × light/dark × 1280/1024/375) | **552** |
| Sideways scroll | **0** |
| Top bar wrapping or taller than 52px | **0** |
| Hamburger missing | **0** |
| Console or page errors | **0** (Google Fonts blocked by the test sandbox's network is filtered out; it does not occur in production) |
| axe WCAG 2.1 AA violations | **0** |
| Interaction checks | **15 / 15 pass** |

### Interactions verified

1. Simple: the hamburger opens the menu drawer
2. Escape closes the drawer
3. Advanced shows the sidebar
4. Advanced: the hamburger collapses the sidebar, 236px → 60px
5. Theme cycles System → Light → Dark, and the label matches what is rendered
6. Approve removes the card and shows a toast (24 → 23)
7. Undo brings it back
8. Selecting a card shows the bulk bar
9. Clear hides the bulk bar
10. Find: a filter narrows the list instantly (24 → 5)
11. Sales wording appears on Find
12. The Profiles save bar sits inside the card and does not float over fields
13. Empty state ends in a button
14. Account menu opens
15. No page errors during interactions

### Also checked by hand in a real Chrome

- **Published page:** the hamburger drawer and the Advanced sidebar both work.
- **Fixed after that check:** at a 1030px window, the Guide and Advanced labels were dropping too early. The brand wordmark now hides first, and 1024px was added to the automated matrix.

## Defects the self-test found and that were fixed before publishing

| # | Defect | Fix |
|---|---|---|
| 1 | Guide/Advanced disappeared on phones with nowhere else to find them | Moved into the account menu at 860px or narrower (DESIGN.md §6) |
| 2 | The account menu was clipped by `overflow: hidden` on the top bar | Overflow moved to the left cluster only |
| 3 | 68 axe button-name violations: control labels hidden with `display: none` | Visually-hidden pattern instead (DESIGN.md §11) |
| 4 | Sideways scroll on phones: visually-hidden step labels escaped their container | `position: relative` on the owning control |
| 5 | Contrast failures: faded done-steps, and the axis-only faint colour used on text | Muted tokens instead |
| 6 | A Settings select had no accessible name | `aria-label` added |
| 7 | Scrollable tables were not reachable by keyboard | `tabindex="0"`, `role="region"`, `aria-label` |
| 8 | Phone layout of selectable cards overflowed | Three-column phone grid; actions on their own row |
| 9 | The sixth KPI sat alone on a row | Explicit column counts: 6, then 3, then 2 |

## Live app (production URL) — tested routes

Overview, Find jobs, Opportunities, Outreach, Campaigns, Follow-ups, Insights, Profiles, Settings, Connectors, How it works, Staffing deals.

- **Coverage:** Candidate and Sales, Simple and Advanced, light and dark.
- **Defects found:** D1–D6 in `IMPLEMENTATION_PLAN.md` §1.
- **Not tested:** phone width on the live app, because the Chrome window could not be resized from automation. `npm run check:devices` already covers phone widths for the real app.
