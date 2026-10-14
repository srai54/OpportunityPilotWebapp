# DESIGN.md — OpportunityPilot design rules (v4: card-first, one-line app bar, KPI band)

**Mandatory.** Read this before changing any screen, component, colour, copy or chart. If a rule here conflicts with a habit or a guess, this file wins. If a case is not covered, extend this file in the same change — do not invent a one-off style. Values come from `src/styles/tokens.css` (single source) and the decisions recorded in `docs/UI_REVAMP_PLAN.md` and `docs/WORKFLOW_GUIDE_PLAN.md`.

## 1. Principles

1. **The app remembers where you are.** Every screen shows one next action. The journey bar and the Next bar (Guide on) carry the person; menus are for people who already know the product (Advanced).
2. **Simple by default, everything else under Advanced.** The simple view never shows scoring tables, weights, filters beyond the basics, or analytics panels. Advanced adds them; it never changes what simple does.
3. **Honest.** Nothing is claimed that did not happen: "sent" only after a receipt, "delivered" never from an API 2xx, AI/generated text is visibly marked and never styled like evidence, sample/fictional data is labelled, a missing figure is a dash with a reason — never an invented number.
4. **Task-first.** A page = title, one plain sentence, one primary button. Secondary actions are quiet.
5. **Colour never carries meaning alone.** Status = colour + word (+ icon). Charts have labels or values, not just hues.

## 2. Reference designs (what is borrowed, what is rejected)

| Source | Borrowed | Rejected |
|---|---|---|
| Notion (getdesign.md) | Warm paper canvas, hairline borders, one blue, calm density — our base palette | Marketing-scale type |
| Zapier | Numbered workflow steps as the main metaphor (journey bar, Getting started) | Orange brand colour |
| Intercom | Soft white tiles on a tinted canvas, human one-sentence guidance | Illustration-heavy layouts |
| Cal.com | Whitespace, one clear primary button, friendly type | — |
| Intercom / Zapier / Cal.com (card chrome) | Floating white tiles on a warm canvas, 12–16px corners, hairline border plus a very soft shadow, one tinted "signature" card for the thing to do now | Marketing-scale type, pill-rounded cards |
| Linear / Clay / Airtable | — | Dark-first marketing look, illustration, long editorial scroll: wrong density for a task app |

**Skill libraries reviewed (open source, read as text only, nothing installed or run), 2026-10-12:**

| Repo | Used? | Why |
|---|---|---|
| `jakubkrehel/skills` (better-ui, better-layout, better-writing, better-accessibility) | **Yes** | Exact radius, press, layout-grouping and writing rules that match this app (sections 14–15) |
| `emilkowalski/skills` (emil-design-eng, break-ui) | **Yes** | Concrete motion values and a worst-case-data checklist (sections 14, 16) |
| `Owl-Listener/designer-skills` (interaction-design: onboarding, forms, error flows, state mapping) | **As a checklist** | Same goals as our journey and forms; used when designing a new flow, not copied |
| `codeswithroh/tastemaker` | **Partly** | The "anti-slop" list (no `transition: all`, no `ease-in`, no `scale(0)`, no layout-property animation, always reduced motion) is adopted in section 14 |
| `MengTo/Skills`, `elayadesign/ai-design-skills`, `ConardLi/garden-skills` | No | Landing pages, games, illustration, prompt libraries, video/article tools: not a task app |

New inspiration is allowed only if it is recorded here with what is borrowed and rejected. Library sources: getdesign.md, github.com/VoltAgent/awesome-design-md, designmd.ai.

## 3. Colour (tokens only — never a hex in a component)

| Role | Token | Notes |
|---|---|---|
| Page / card / header band | `--op-bg` / `--op-surface` / `--op-panel-head` | Cards are white on the warm page: hairline border + `--op-shadow-card` (very soft). Popovers and tips use `--op-shadow-popover` |
| Text | `--op-ink` (body), `--op-muted` (secondary), `--op-faint` | `--op-faint` (3.7:1) is for axis ticks and eyebrow labels **only** |
| Action | `--op-primary` `#006dd0`, hover `--op-primary-hover`, tint `--op-primary-tint` | White on primary and primary on page both pass 4.5:1. On a grey hover row use `--op-primary-hover` |
| Status | `*-tint` + `--op-on-*-tint` for green / amber / danger / indigo / teal / neutral | Always with words |
| Generated text | `--op-ai-*` | Must never share styling with source evidence |
| Workspace | Candidate = blue `--op-ws-candidate`, Sales = orange `--op-ws-sales` | Used only on the workspace toggle icon and small markers, never on buttons |
| Charts | `--op-c1…c4` (fixed order, never cycled), sequential `--op-seq-1…5` (one hue), track `--op-chart-track`, grid `--op-chart-grid` | Max 4 series. No rainbow. No red/green as the only difference |

**Dark theme is a selected palette**, not an inversion (same token names re-declared). Never branch on theme in a component. Every new colour pair is measured: body text ≥ 4.5:1, large text/graphics ≥ 3:1; write the figure in the token comment.

## 4. Typography

Inter (`--op-font`); numbers use `.op-numeric` (tabular). Mono (`--op-font-mono`) only for ids and references.

| Use | Size | Weight |
|---|---|---|
| Page title (`PageHeader`, `h2`) | `--op-text-page` 24px | 650, tracking −0.025em |
| Section heading | 16px (`--op-text-screen`) | 600 |
| Body | 14px (`--op-text-body`) | 400 |
| Meta, hints, table secondary | 12.5px (`--op-text-meta`) | 400 |
| KPI figure | `--op-text-metric` 30px | 650 |
| Eyebrow label | 11.5px uppercase, tracking 0.04em | 600, `--op-muted` |

Line length ≤ 72ch for prose. The top bar holds the only `<h1>` (visually hidden in simple mode); pages use `PageHeader` (`h2`). No skipped heading levels.

## 5. Layout, spacing, shape

- Spacing scale 4/8 (`--op-space-1…6`). No other spacing values.
- Radius: cards 16 (`--op-radius-card`), panels/popovers 12 (`--op-radius`), controls 8, chips 6, pills 999.
- Simple mode: one centred column, max 1040px, no sidebar. Advanced: sidebar (236px; collapses to 60px; drawer under 860px) and wide pages (≤ 1320px).
- **App bar (v4):** 52px, one line, full width; the rail sits under it and sticks below the app bar plus journey bar (`--chrome-h`, measured). Never let the bar wrap: it hides things by priority (see §6).
- Breakpoints: 1080 (grids collapse), 860 (drawer / one column), 640 (compact top bar, bottom-sheet tips), 375 must have no horizontal scroll.
- Touch target ≥ 44px on phones; row height 36px in tables.

## 6. Shell and navigation

- **App bar (v4, 52px, one line):** hamburger first · brand · Candidate | Sales toggle · breadcrumb `Section / Page` (Advanced only; the `<h1>` stays, visually hidden, in Simple) · status · Guide switch · Advanced switch · `?` · theme · account. The hamburger opens a drawer in Simple (any width) and on phones; in Advanced on wide screens it collapses the rail to 60px. Its label says what it will do ("Open the menu", "Collapse the menu", "Expand the menu").
- **Priority hiding** so the bar never wraps: ≤ 1240px the status text goes; ≤ 860px the brand (the wordmark only; there is no "OP" badge since 2026-10-14) goes, the home link stays in the menu; Guide and Advanced move into the account menu as `menuitemcheckbox` rows and the breadcrumb goes; ≤ 640px the workspace labels are visually hidden (the icons stay). Hidden labels use the visually-hidden pattern, never `display: none`, and their parent is `position: relative`.
- **Theme button label** states what is rendered: "Theme: System (dark). Switch to Light".
- **Demo notice:** slim, in the page (not in the sticky area), dismissible; the dismissal persists for the session.
- **Journey bar** under it, always: ① Profile ② Find ③ Review ④ Reach out ⑤ Follow up. Done = tick, here = highlighted, recommended = "Next" tag, badge = count waiting. On phones only the current step shows its label (others stay as visually-hidden text, never `display:none`).
- **Next bar** (Guide on): one sentence + one button from real counts; hidden on Home (the Getting-started card does the job), Settings, How it works, and the opportunity page.
- Advanced adds the sidebar; the journey bar stays.
- Sales vocabulary: Companies/Leads, Find companies, Review leads, Reach out. Candidate: Jobs, Find jobs, Review, Apply & reach out.

## 7. Components (use these; do not re-create)

| Need | Use |
|---|---|
| Page heading | `PageHeader` |
| Loading / empty / waking | `States` (`LoadingState`, `EmptyState`) — an empty state **always ends in a button for the next step** |
| Error | `ErrorNotice` — inline for action failures; `what="…"` card **only** for a failed load; show the server's field reasons, never a bare "Validation failed" |
| Status | `Badge` / `StatusBadge` (word + tint) |
| Skills / tags | `TagInput` (with suggestions) |
| Tips | Coachmarks via `data-coach` + `coachFlows.ts` (≤ 4 steps per screen, ≤ 260 characters per body, Sales wording via `sales`) |
| Buttons | One `btn-primary` per view; `btn-secondary` beside it; `btn-ghost` for the rest; disabled buttons explain why nearby |
| Readiness | "Before you send" chip list: ✓ done, ○ to do (clickable → focuses the field) |
| Key figures (v4) | `KpiCard` (icon chip, label, value, `DeltaBadge`, sentence, optional line of the last days; a link when it opens the list behind it) inside a `KpiBand` (explicit 4 or 6 columns → 3 → 2, never auto-fit) |
| Goals and health (v4) | `GoalRing` (n of N), `SourcesCard` (health dot + word + last run), `ActivityCard` (timeline; hidden when empty), `ProgressBar` (the one bar: queues, sends, runs, completeness) |
| Connecting another app (2026-10-14) | **One click first:** one `btn-primary` "Connect with Notion" that goes to the app's own consent page, with one plain sentence ("You allow access on Notion's page, then come back here"). The token or webhook form stays collapsed behind a quiet "Use a token instead" button (`aria-expanded`). Not switched on by the owner → badge "Needs server setup" + one sentence, never a disabled primary. Coming back: a dismissible `notice-success` (`role="status"`) or `notice-warning` (`role="alert"`) at the top that receives focus, then the address is cleaned. A follow-up choice (which database/table) is a radio list with one primary button on the same card; the badge says "One step left" until it is made. No words like token, OAuth, scope or webhook on the default view |

## 8. Forms

- Label above the field; hint under it; error under it in `.field-error` and `aria-invalid`. Never placeholder-as-label.
- Ask only what the next step needs. Simple forms ≤ 5 fields. Saving a short form goes straight to the next step (profile → pre-filled search).
- Where a list of known values exists (skills, roles, countries) offer suggestions; free text is always allowed.
- Validate before the server round trip when the rule is known; on failure focus the first fix.

## 9. Charts and data display

- Use SVG drawn from tokens (no chart library). Every chart has: a title, a one-line takeaway in text, labelled axes or direct value labels, an accessible name (`role="img"` + `aria-label` summarising the numbers) and a table or list fallback for the figures.
- Bars for counts and comparisons, lines for change over time, funnel = horizontal bars with conversion %, progress = a bar with "n of m". Zero data → an empty state with the action that creates data, never an empty axis.
- Label what the data is and how much of it: "sample of 25 postings", "last 14 days", "from your own records". Market data from a third party is labelled with its source.
- Numbers: tabular figures, thousands separators, percentages rounded to whole numbers unless < 10%.
- **Deltas (v4):** a change badge is shown only when there is a previous equal period; otherwise it is hidden, never `0%` or a guess. It carries an arrow and words for screen readers, not colour alone.

## 10. Guidance and copy

- Plain words, second person, sentence case, verbs on buttons ("Review 4 leads", not "Proceed"). No jargon (no "execution", "idempotent"); the product words are job/company, lead, review, reach out, follow up, receipt.
- State what the app does **and does not** do near any send/apply action: "Nothing is sent by approving", "You press Send there".
- Error text says what happened and the next step, never a stack or a bare status.
- Tips explain the next action, not how the app works inside.

## 11. Accessibility (gate, not a nice-to-have)

- axe WCAG 2.1 AA: **0 violations** in light and dark, 1280px and 375px, on every page touched.
- Visible focus on everything (`--op-focus`); keyboard reachable; Esc closes tips and popovers; focus returns to the trigger.
- Respect `prefers-reduced-motion`. No information in colour alone. Switches use `role="switch"` + `aria-checked`.
- Hidden-on-small-screens text uses the visually-hidden pattern, not `display:none`, when it names a control.

## 12. Definition of done for any UI change

1. Uses tokens and components above; no new hex, no new spacing value.
2. Works signed-out of Advanced (simple) and with Advanced; Candidate and Sales wording both checked.
3. Opened in Edge: 1280 and 375, light and dark; axe 0; no horizontal overflow; no console errors.
4. Unit tests for any new pure logic (`*Model.ts`).
5. New pattern → recorded in this file.
6. Simple view: lists are cards (section 13), not tables.
7. Motion, layout and writing follow sections 14–15; the break test in section 16 was run.

## 13. Card system (v3) — mandatory in the simple view

**Rule: in the simple view, every list of things is a list of cards, never a table. Tables stay in Advanced.** One idea per card, one primary action per card, everything the person needs to decide is on the card itself.

| Card | Used for | Contents |
|---|---|---|
| `Card` | Any grouped content | Optional icon + title, one-line subtitle, body, footer actions. 16px radius, 20–24px padding |
| `StepCard` | Getting started, the path | Number or tick, title, one sentence, one button. The current step is the tinted **signature card** (`--op-primary-tint`); done steps are muted with a tick |
| `LeadCard` (jobs and companies) | Review, approved list, Find results | Select box · initial avatar · title · company · place · source chips (Remote, pay, new) · **match ring** (score out of 100, with the word "match") · status badge · primary action (Approve / Open / Reach out) |
| `MessageCard` | Outreach inbox | Company · channel icon · subject line · state badge (Draft / Approved / Sent) · first line of the text |
| `FollowUpCard` | Follow-ups | Company · what to do · due label · Open / Done |
| `StatCard` | Key figures | Label, figure, change, sparkline |
| `ComposeCard` / `SendCard` | Outreach | Compose = fields + the "Before you send" chips. Send = mail app choice + the one big button + the receipt |

Layout: cards sit in a `CardList` (single column, 12px gap) or a `CardGrid` (auto-fill, min 300px, 16px gap). A page is a short stack of cards under the page header; the **signature card** (what to do now) is always first.

Selection and bulk: any card list that can be acted on in bulk shows a select box on each card and a **bulk bar** (sticky at the bottom) once one or more are chosen: "3 selected · Draft messages · Approve · Clear". Bulk never sends anything by itself; sending is always a visible, per-message step or a queue the person steps through.

Interaction: an interactive card lifts 1px and deepens its shadow on hover; the whole card is clickable only when it has a single destination (a link inside the card, stretched); otherwise its buttons are the click targets. Focus ring on the card or its link. Never nest a link inside a clickable card.

Done steps use the muted tokens (`--op-panel-head`, `--op-muted`), never `opacity` (it fails contrast).

Tokens: `--op-radius-card` 16px, `--op-shadow-card`, `--op-shadow-card-hover`, `--op-canvas` (warm page). Dark theme re-declares them (no theme branching in components).

Accessibility: a card list is a `<ul>`; each card an `<li>` with a heading (`h3`) or an `aria-label`; the match ring has the number as text; status is a word plus colour; bulk bar is a `role="region"` with a live count.

## 14. Motion and interaction polish (from emilkowalski/skills and jakubkrehel/skills)

- **Easing:** exits and entrances use ease-out `cubic-bezier(0.23, 1, 0.32, 1)` (`--op-ease-out`); things already on screen use ease-in-out `cubic-bezier(0.77, 0, 0.175, 1)`. **Never ease-in** for UI.
- **Durations:** press feedback 100–160 ms; tooltips and small popovers 125–200 ms; dropdowns 150–250 ms; dialogs and drawers 200–500 ms. Any UI animation over 300 ms is cut to 150–250 ms. Exits are faster than entrances.
- **Frequency:** things used many times a day (typing, table rows, keyboard-driven actions) are not animated at all.
- **Press:** `:active` scales to **0.97** (range 0.95–0.98) with `transform 160ms ease-out`. Disabled controls never scale.
- **Entrances:** never from `scale(0)`; start at `scale(0.95)` and `opacity: 0`. Staggers are 30–80 ms apart and never block interaction.
- **Animate only `transform` and `opacity`.** Name transition properties explicitly: **never `transition: all`**; never animate layout properties.
- **Hover** styles are wrapped in `@media (hover: hover) and (pointer: fine)` so phones do not get sticky hover.
- **Reduced motion:** under `prefers-reduced-motion: reduce` keep opacity and colour changes, remove movement and scale.
- **Overlays** (menus, drawers, dialogs, the coach tip): `overscroll-behavior: contain`.
- **Nested rounding:** outer radius = inner radius + padding (+ border). Past 24 px padding use separate radius tokens.
- **Rings and outlines:** a `box-shadow: 0 0 0 1px` ring also needs `border: 1px solid transparent` so it survives forced-colours mode. Icons use `currentColor` only.
- **Theme switch:** transitions are disabled for the frame of the switch.

## 15. Layout and writing details (from jakubkrehel/skills)

- Space between groups is **at least 2×** the space inside a group (8 px inside → 16 px+ between). Use space first, background shape second, separator line last.
- Adjacent bordered or filled controls are **≥ 12 px** apart; borderless text/icon controls ≥ 24 px between glyphs.
- One primary action per view; once there are more than three secondary actions, move them into a menu.
- Visual order matches DOM order (no `order`, `row-reverse`, or grid placement tricks). Identifying content leads a row; metadata and actions trail.
- Text containers use `max-width` and `min-height`, never fixed width/height. Grid tracks `minmax(0, 1fr)`; overflowing flex children `min-width: 0`. Use `100%` not `100vw`, and `100dvh` not `100vh` on phones.
- Breakpoints come from content, not devices. Check 320 px, 200 % zoom and a long-string language.
- **Buttons** start with a verb and name the object ("Send message", "Review 4 leads"). Icon-only buttons have a verb-plus-object accessible name.
- **Toggles** are worded for the ON state ("Send read receipts"). Sentence case everywhere. One vocabulary: if the menu says "Archive", the toast says "archived".
- **Errors** say what failed and how to fix it, next to the field; no blame, no "Oops", no exclamation marks; show known requirements before input, not only after.
- **Empty states** say what the place is for and offer one next action; a filtered-empty names the filter and offers "Clear filters".
- **Confirmations:** prefer **undo** for reversible actions; confirm only irreversible, affects-others or bulk-destructive ones; the title names the action and object ("Delete 'Q3 report'?"), with counts; buttons are verb + object, never Yes/No.
- Cut filler ("successfully", routine "please"). Build sentences with placeholders and plural rules, not fragments.

## 16. Break test (from emilkowalski/skills break-ui) — before any UI change is done

Open the screen with: a very long name and long unbroken email; a one-letter name; missing optional fields and a failed avatar; a name that makes wrong initials (emoji first); **0, 1, and 1,000+ items**; counts of exactly 1 (plurals) and 1,284 (separators); null or zero numbers; 320 px width and 200 % zoom; dark mode. Nothing may overflow, clip, mis-pluralise or show "undefined". Also check slow network (the host sleeps up to a minute).

## 17. Traps found by self-test (v4) — do not reintroduce

| # | Trap | Rule |
|---|---|---|
| T1 | Guide and Advanced vanished on phones with no other way in | They move into the account menu at 860px or narrower |
| T2 | `overflow: hidden` on the app bar clipped the account menu | Overflow goes on the left cluster only |
| T3 | `display: none` on control labels removed their accessible names | Use the visually-hidden pattern |
| T4 | A visually-hidden label with `position: absolute` escaped its scroll container and caused sideways scroll | Give the owning control `position: relative` |
| T5 | `--op-faint` used for body-size text failed contrast | Only axis ticks and eyebrow labels; text uses `--op-muted` |
| T6 | Faded done-steps (`opacity`) failed contrast | Muted tokens instead |
| T7 | Sideways-scrolling tables could not be reached by keyboard | `tabindex="0"`, `role="region"`, `aria-label` |
| T8 | The 6th KPI sat alone on a row | Explicit column counts, never auto-fit |
| T9 | Green/amber used as text on white failed axe contrast | Text uses `--op-on-green-tint` / `--op-on-amber-tint`, never `--op-c3` / `--op-c2` |
| T10 | A page fetched a paged API as a list and crashed at run time (type check did not catch it) | Open every new screen in a browser with real data before calling it done |

