# Redesign v4 — Implementation plan

**For:** the developer (or AI agent in VS Code) working in `OpportunityPilotWebapp`
**Design source of truth:** `prototype.html` in this folder — open it in Edge. Use the screen picker at the bottom right, and the **Data / Empty** switch to see both states.
**Rules source of truth:** `DESIGN.md` (stays mandatory). The proposed amendments are in §9.
**Status:** design approved for build. Self-tested (see `SELFTEST_REPORT.md`).

---

## 0. What this is, and what it is not

**It is** a redesign of the screens you already have, on the tokens you already have:

- the same routes, nav labels and workspace vocabulary (from `shellModel.ts`)
- the same journey bar
- the same Simple/Advanced split
- no new hex values

**It adds:**

- a one-line app bar with a hamburger
- a KPI band with trend badges
- richer lead and company cards
- a weekly-goal ring, pipeline funnel, source health and activity timeline on Overview
- KPI strips on Opportunities, Find, Outreach, Follow-ups, Campaigns and Staffing
- fixes for the six defects found when testing the live app (§1)

**It is not:**

- no new routes
- no API contract changes, except the data listed in §6, which degrades honestly when missing
- no new libraries
- no Ctrl K palette, kanban, team or billing (those were explored and dropped)

**Estimate:** about 7 working days for one developer: shell 1.5, components 1.5, screens 3, tests and polish 1. This is an estimate, not a commitment.

---

## 1. Defects found on the live app (tested 13 Oct 2026, every route, both workspaces, Simple + Advanced, light + dark)

| # | What happens | Cause | Fixed in |
|---|---|---|---|
| D1 | Page title truncates ("Opportuniti…") | Title and hint stacked in a squeezed column, `AppShell.tsx` `.topbar-heading`, `app.css:197–202` | 1.4 |
| D2 | Sidebar shows its own scrollbar on a normal laptop | 42px rows + 30px icon tiles, `app.css:2117–2120` `.rail-link`, `.rail-tile` | 1.3 |
| D3 | Amber demo banner takes ~50px on every page, inside the sticky area | `AppShell.tsx:455` | 1.8 |
| D4 | Overview repeats the Candidate/Sales switch as "Find a job / Find customers" | `OverviewPage.tsx:465–466` | 3.1 |
| D5 | "Trends" sits among job-site tabs but is not a site | `WellfoundPage.tsx:125` | 3.2 |
| D6 | Profile save bar covers form fields while scrolling | `.save-bar` sticky with no space reserved, `app.css:960`; `ProfilesPage.tsx:344, 562` | 3.9 |

Not app defects: the round dark button on the right edge of the live site is a browser extension, not in the page DOM.

---

## 2. The design in one page

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ ≡  [⚡ OpportunityPilot] │ (● Candidate | ○ Sales) │ Work / Opportunities ··· ● Rules mode │ Guide ○ Advanced ● │ ? ◐ (G) │  52px, one line
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│              ✓ Profile ── ✓ Find jobs ── (3 Review 24 NEXT) ── ✓ Apply & reach out ── 5 Follow up 2              │  journey bar
├────────────┬─────────────────────────────────────────────────────────────────────────────────┤
│ rail       │  page (Simple: 1040px column, no rail · Advanced: rail + 1320px)                 │
│ (Advanced, │  ┌ demo notice (slim, in page, dismissible) ┐                                      │
│ 236 → 60px │  hero: greeting + one sentence from real counts + primary button │ weekly goal ring │
│ on ≡)      │  KPI band (6 on Overview, 4 elsewhere): icon chip · value · delta · sparkline     │
│            │  two columns: next step + funnel │ sources health + activity                     │
│            │  rich cards …                                                                    │
└────────────┴─────────────────────────────────────────────────────────────────────────────────┘
  footer: API online · Email not connected ··· How it works · Nothing is sent or applied without your approval
```

**Hamburger behaviour**

- **Simple, any width:** opens the nav as a drawer. Escape and a click on the backdrop both close it, and focus returns to the hamburger.
- **Advanced, wider than 860px:** collapses the rail to 60px, showing icons only, with counts shown as dots.
- **Advanced, 860px or narrower:** opens the drawer.

**Priority hiding, so the bar never wraps**

| Width | What hides |
|---|---|
| ≤ 1240px | "Rules mode" status text |
| ≤ 1100px | Brand wordmark (visually hidden, the logo stays) |
| ≤ 860px | Guide and Advanced switches move into the account menu (DESIGN.md §6) |
| ≤ 640px | Workspace labels are visually hidden; the coloured dots stay |

---

## 3. Phases and tasks

### Phase 0 — Branch and baseline (½ day)

1. Finish or merge the current `feature/card-ui` first (it is the checked-out branch), then `git checkout -b feature/redesign-v4` from `main`.
2. Copy this folder to `docs/redesign-v4/`. Move `selftest/check-shell.mjs` to `scripts/check-shell.mjs` and add `"check:shell": "node scripts/check-shell.mjs"` to `package.json`.
3. Baseline: `npm run typecheck && npm run lint && npm test && npm run build`, then `npm run check:devices -- --shots out/before/`.

**Done when:** all four commands are green and the baseline screenshots are saved.

### Phase 1 — Shell (1½ days) · `AppShell.tsx`, `ShellContext.tsx`, `ThemeToggle.tsx`, `app.css`, `tokens.css`

**1.1 App bar, full width, one line**

- Move the brand and hamburger out of `.rail-head` into the top bar, so the rail starts under the app bar.
- Structure: `header[data-testid=app-topbar] > .tb-l (burger, brand, sep, workspace switch, sep, breadcrumb) + .tb-gap + .tb-r (status, sep, Guide, Advanced, sep, help, theme, account)`.
- `--op-header-height: 52px`, changed from 56px in `tokens.css`.
- `.topbar { flex-wrap: nowrap }`. **Do not** put `overflow: hidden` on the bar, because it clips the account menu (trap T2). Put it on `.tb-l` only.
- **Accept:** at 1280, 1024 and 375 the bar is exactly one 52px line on every route, and nothing is clipped.

**1.2 Hamburger**

- Add to `ShellContext`:
  - `drawerOpen: boolean`
  - `railCollapsed: boolean`, persisted in `localStorage['op-rail']`
- Behaviour as in §2.
- The drawer is `role="dialog" aria-modal="true"`. Focus moves to the current nav item on open and returns to the hamburger on close. Add `overscroll-behavior: contain`.
- The hamburger's `aria-label` reads "Open the menu", "Collapse the menu" or "Expand the menu", and `aria-expanded` reflects the state.
- **Accept:** `check:shell` interactions 1–3 pass.

**1.3 Rail**

- Rows are 34px. Remove the `.rail-tile` icon boxes and use a 16–17px icon plus text.
- Group labels at 11.5px, uppercase, tracking 0.04em.
- The active item gets `--op-nav-active` plus weight 600. No coloured tile.
- The rail is `position: sticky; top: var(--chrome-h); height: calc(100vh - var(--chrome-h)); overflow-y: auto`. Measure `--chrome-h` from the app bar plus journey bar height on render and resize.
- Collapsed (60px): visually-hidden labels, counts become 8px dots, and each item gets a `title` tooltip.
- **Accept:** at 1280×800 in Advanced, all 15 Sales items fit with no rail scrollbar.

**1.4 Breadcrumb replaces the stacked title and hint (Advanced only, per DESIGN.md §6)**

- One line: `Section / Page`, with `.sec` in `--op-muted` and the page in `--op-ink` 600. Ellipsis on the page name only.
- Remove `.topbar-heading`, `.topbar-title` and `.topbar-hint`. The `<h1>` stays in the bar, visually hidden in Simple.

**1.5 Priority hiding**

- Use the breakpoints in §2.
- Every label that names a control uses the visually-hidden pattern, never `display: none` (trap T3).
- Its parent must be `position: relative` (trap T4).

**1.6 Switches go into the account menu on phones**

- At 860px or narrower, Guide and Advanced appear as `menuitemcheckbox` rows inside `account-menu`, showing On/Off.
- **Accept:** `check:shell` phone interaction passes.

**1.7 Theme button**

- The label shows the choice, and for System also the resolved theme, for example "Theme: System (dark). Switch to Light".
- Keep the existing System → Light → Dark cycle in `themeModel.ts`. The icon is monitor, sun or moon.
- Disable transitions for the frame of the switch (DESIGN.md §14).

**1.8 Demo notice**

- Move it out of the sticky area into the top of the page.
- Use banner tokens, a 12px radius and 8×12px padding, on one line.
- Dismissible, and the dismissal persists in `sessionStorage['op-demo-hidden']`.

**1.9 Footer**

- Keep it as is, as a quiet status strip: API online · Email not connected · How it works · "Nothing is sent or applied without your approval".

### Phase 2 — Components (1½ days) · `src/components/cards`, new `src/components/kpi`

Add pure models with unit tests for any logic, following the `*Model.ts` and `*.test.ts` pattern.

| Component | Status | Spec |
|---|---|---|
| `KpiCard` | **new** | Icon chip (28px, `*-tint` / `--op-on-*-tint`), label 12.5px muted, value 26px/650 tabular, `DeltaBadge`, sub line 12px muted, optional sparkline (SVG polyline, 1.75px, `vector-effect: non-scaling-stroke`). Props: `icon, tone, label, value, delta?, sub?, series?` |
| `DeltaBadge` | **new** | ▲ green tint / ▼ danger tint / flat neutral, plus visually-hidden "up"/"down". Pure `deltaModel.ts`: `formatDelta(current, previous)` returns `null` when there is no previous period (never invent a number) |
| `KpiBand` | **new** | `grid-template-columns: repeat(4, minmax(0,1fr))`; `.k6` gives 6 → 3 at 1180px or narrower → 2 at 760px or narrower. **Never auto-fit**, which leaves orphans (trap T8) |
| `LeadCard` | **enhance** | Grid: `[select] logo | body | side`. Logo tile 42px with initials; tint picked by company-name hash from blue/teal/indigo/amber/green tints. Title 15px/600 + badges (New, Visa / relocation). Company 13px/500 · industry muted. Meta row with icons: place · pay (or "Pay not published") · posted · source. Skills: matched = green tint with tick, missing = outline grey; split by `skillsModel.ts` against the active profile. Evidence: one quoted line on `--op-panel-head` with a 2px left rule. Side: match ring + Skip/Approve (review) or Open |
| `CompanyCard` | **new (Sales)** | Same anatomy: hiring surge / legacy badges, meta (open roles · name .NET/C# · last 3 days), top 4 tech with counts, evidence sentence |
| `StepCard` | **adjust** | Done steps: `--op-panel-head` background, muted title, **no opacity** (trap T6). Current step stays the tinted signature card |
| `GoalRing` | **new** | 96px conic ring, value + "of N" |
| `FunnelCard`, `SourcesCard`, `ActivityCard` | **new** | See Overview in the prototype. Funnel bars show "% of above"; sources show a health dot + last run + count; activity is a vertical timeline with icon chips |
| `EmptyState` | **keep** | Centred icon tile, title, one sentence, always ends in a button (DESIGN.md §7) |

### Phase 3 — Screens (3 days)

| # | Route · file | Change |
|---|---|---|
| 3.1 | `/` · `OverviewPage.tsx` | **Populated:** demo notice → hero (date, greeting, one sentence built from real counts, primary "Review N", secondary Find, right side GoalRing) → `KpiBand.k6` (found, waiting, strong 75+, applied/contacted, reply rate, average match) → two columns (next step with progress bar + FunnelCard │ SourcesCard + ActivityCard) → three best LeadCards. **Empty:** welcome + command card + five StepCards + sample-run card. **Remove** the duplicate workspace tabs (D4) |
| 3.2 | `/wellfound` · `WellfoundPage.tsx` | Source tabs without Trends; "Market trends" becomes a ghost button in the page header (D5). Search card holds the tabs, role + place + Search, and the two live filters (Remote only, Mentions visa or relocation). Results head: `KpiBand` (shown of held, strong 75+, remote %, show pay) + filter chips + "Filtering locally — nothing re-fetched". Advanced: left filter panel (must mention, work mode, posted, minimum match, hide agencies). Results use `LeadCard` |
| 3.3 | `/opportunities` · `OpportunitiesPage.tsx` | `KpiBand` (waiting, strong, new today, average match) → tabs All / Waiting for approval with count → count + Sort → `LeadCard`/`CompanyCard` with select boxes → sticky bulk bar "N selected · Clear · Draft messages · Approve N" (DESIGN.md §13). Approve shows an Undo toast, not a confirmation dialog (§15) |
| 3.4 | `/opportunities/:id` | Unchanged structure; apply the card and evidence styles |
| 3.5 | `/outreach` | `KpiBand` (drafts to review, approved, sent by you, reply rate) above the existing layout. Generated text keeps `--op-ai-*` |
| 3.6 | `/follow-ups` | `KpiBand` (overdue, due today, this week, replied) above the three existing blocks |
| 3.7 | `/campaigns` | `KpiBand` (campaigns, found, matched, approved/contacted) → campaign cards: matched-% ring, status badge, sources + next run meta, three meters, actions Pause/Resume · Edit criteria · See results |
| 3.8 | `/staffing` | "By stage" card with a segmented stage bar + legend above the deals list; the funnel tiles become `KpiCard` |
| 3.9 | `/profiles` | Profile summary card: 88px completeness ring, type + version badges, a six-item checklist where each missing item shows its score impact ("+7 points on most scores"). New-profile form: the save bar is `position: sticky; bottom: 0` **inside the card** with negative margins, so it never covers fields (D6) |
| 3.10 | `/insights` | Stat tiles become `KpiCard` with deltas; keep the 7/14/30/90 switch and the existing charts (DESIGN.md §9: takeaway sentence, labels, `role="img"` + `aria-label`, table fallback) |
| 3.11 | `/settings`, `/connectors`, `/how-it-works`, `/staffing/candidates`, auth, onboarding, 404 | Apply the new card, chip and spacing styles. No structural change |

### Phase 4 — Self-test and polish (1 day)

Run all of these. The work is not done until every one is green.

```
npm run typecheck
npm run lint            # baseline: 0 errors, 3 known warnings — add none
npm test                # includes new deltaModel / skillsModel / railModel tests
npm run build
npm run check:devices   # existing: 13 screens × 6 devices × light/dark, axe 0, no sideways scroll
npm run check:shell     # new: routes × 1280/1024/375 × light/dark × Simple/Advanced + interactions
```

**Manual pass in Edge**

- 1280 and 375 wide, light and dark, in both workspaces.
- The DESIGN.md §16 break test: long names, 0 / 1 / 1,000+ items, 200% zoom.

---

## 4. Traps the self-test caught — do not reintroduce

| # | Trap | Rule |
|---|---|---|
| T1 | Guide/Advanced vanished on phones with no other way in | They move into the account menu (1.6) |
| T2 | `overflow: hidden` on the top bar clipped the account menu | Overflow goes on the left cluster only |
| T3 | `display: none` on control labels removed accessible names | Use the visually-hidden pattern |
| T4 | Visually-hidden labels with `position: absolute` escaped the scroll container and caused sideways scroll on phones | Give their parent `position: relative` |
| T5 | `--op-faint` used for body-size text failed contrast | Only axis ticks and eyebrow labels (DESIGN.md §3); text uses `--op-muted` |
| T6 | Faded done-steps (`opacity`) failed contrast | Use muted tokens instead |
| T7 | Sideways-scrolling tables could not be reached by keyboard | `tabindex="0"`, `role="region"`, `aria-label` |
| T8 | The 6th KPI sat alone on a row | Explicit column counts, never auto-fit |

---

## 5. Test ids to add (used by `check-shell.mjs`)

`app-topbar`, `app-burger`, `app-rail`, `nav-drawer`, `toggle-advanced`, `toggle-guide`, `theme-toggle`, `account-menu-button`, `account-menu`.

---

## 6. Data each new element needs (DESIGN.md §1.3 honesty rule applies)

| Element | Data | If the API does not have it yet |
|---|---|---|
| Delta badges | Same count for the previous equal period | Hide the badge. Never show 0% or a guess |
| Weekly goal | A goal setting (new user setting) + this week's count | Show "Set a weekly goal" with a button to Settings |
| Reply rate, average match | Replies recorded / sent; mean score of found items | Show "—" plus the reason ("No replies recorded yet") |
| Sources health | Last run time + status per connector | Show "Not run yet" |
| Activity | Last ~10 events (approve, reply recorded, campaign finished, follow-up due) | Hide the card |
| Skills matched / missing | Active profile skills + posting tech tags (already parsed) | Show the tech tags without the match split |

---

## 7. CSS map (old → new)

| Old | New |
|---|---|
| `.topbar-wrap` + `.topbar` (two-tier, 56px) | `header.top > .topbar` (52px) + `nav.journey` |
| `.topbar-heading` / `.topbar-title` / `.topbar-hint` | `.crumb` (`.sec` / `.sl` / `b`) |
| `.top-switch` / `.top-switch-track` | `.sw` / `.sw .tk` (28×16 track, 12px knob) |
| `.rail-link` (42px) + `.rail-tile` | `.rlink` (34px), no tile; `.rail.collapsed` |
| `.save-bar` (page-level sticky) | `.savebar` (inside the card, sticky, negative margins) |
| Stat tiles | `.kpi` inside `.kpis` / `.kpis.k6` |
| — | `.ichip .t-blue/.t-teal/.t-indigo/.t-amber/.t-green/.t-danger/.t-neutral`, `.delta.up/.down/.flat`, `.lead2`, `.logo`, `.meta`, `.skills .sk.ok/.miss`, `.why`, `.goal`, `.hero2`, `.two`, `.tl`, `.hrow`, `.stagebar`, `.notice` |

Every colour in these classes is an existing `--op-*` token. No new hex.

---

## 8. Risks

- **API data for deltas, the weekly goal and activity** may not exist. Ship with the honest fallbacks in §6 and add the data later; the layout does not change.
- **`feature/card-ui` is still open.** Merge it first, or the redesign branch will conflict in `app.css` and `OverviewPage.tsx`.
- **Bundle size** is already over 500 kB (tracked). This adds no library; the sparklines and rings are plain SVG and CSS.

---

## 9. Proposed DESIGN.md amendments (v4) — add in the same PR

- **§5:** Header height is 52px, changed from 56px. The app bar spans the full width; the rail sits under it.
- **§6:** The hamburger is always the first item in the bar. In Simple it opens a drawer; in Advanced it collapses the rail to 60px. Add the priority-hide order from §2 of this plan.
- **§7:** Add `KpiCard`, `DeltaBadge`, `KpiBand`, `CompanyCard`, `GoalRing`, `FunnelCard`, `SourcesCard`, `ActivityCard`. Update the `LeadCard` anatomy.
- **§9:** KPI deltas only when a previous equal period exists.
- **§13:** Done steps use muted tokens, never opacity.
- **New §17:** the traps table from §4 of this plan.

---

## Git workflow (from CLAUDE.md)

- Commit locally as each phase finishes.
- Push, raise the PR and merge only when all phases are done and verified, or when the user asks.
- Use `bash tools/pr.sh OpportunityPilotWebapp "Redesign v4: app bar, KPI band, rich cards" <body-file>` from the workspace root.
- A merge to `main` deploys.
