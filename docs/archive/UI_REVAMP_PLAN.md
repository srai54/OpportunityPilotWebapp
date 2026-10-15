# UI revamp plan — "calm paper" design, guided by coachmarks

_Written 2026-10-12 at the owner's request. Source of the design: https://getdesign.md (DESIGN.md files). Source of the guidance pattern: https://ui-patterns.com/patterns/coachmarks. Work order and status live in `D:\OpportunityPilot\TASKS.md` (V1–V7)._

## 1. Goal

The app is now simple in structure (6-item menu, one-screen campaign, Advanced switch). It still **looks** heavy: a dark navy rail, small 12–13 px text, many bordered boxes and teal-on-everything. This revamp makes it **look** as simple as it now behaves, and adds **coachmarks** so a first-time person always knows the next step.

Order the owner asked for: **simple first → then push everything extra behind Advanced → then coachmarks.** Structure was done in the earlier rounds; this plan is the look, the per-platform Advanced filters, and the coachmarks.

## 2. Which design — decision

I downloaded the real DESIGN.md of three candidates with `npx getdesign@latest add <brand>` (read as text only) and compared them against what this product is: a **light-first, text-and-table workspace for non-technical users** (job seekers, sales people) with a dark mode.

| | Linear | Supabase | **Notion** |
|---|---|---|---|
| Feel | Near-black, luxurious, "software craft" | White + near-black, one emerald CTA | **Warm paper, quiet chrome, one confident blue** |
| Default mode | Dark-first (canvas `#010102`) | Mixed marketing + dark product mockups | **Light-first** (`#ffffff` / soft `#f6f5f4`) |
| Fit for non-technical users | Low — feels like a developer tool | Medium — developer-portal tone | **High — approachable, familiar from everyday tools** |
| Density for tables/forms | Good | Good | **Good, with generous whitespace** |
| Brand continuity | New accent (lavender) | Closest to the current teal | New accent (blue) |

**Decision: Notion.** It is the only one that is light-first and friendly, which is what a person nervous about a job search needs; its single blue accent leaves every status colour free to mean something (green = good, amber = needs you, red = failed — the honesty rules need that). Supabase would keep our teal but pushes toward a "developer console" look the product is trying to leave. Linear is dark-first marketing.

What we take from Notion's DESIGN.md (values from its file): canvas `#ffffff`, soft canvas `#f6f5f4`, ink `#31302e` / muted `#615d59` / faint `#a39e98`, hairline `#e6e6e6`, primary blue `#0075de` (active `#005bab`), Inter type, weights 400/600/700 with slightly negative tracking on headings, soft sticker accents (sky `#62aef0`, teal `#2a9d99`, green `#1aae39`, orange `#dd5b00`). What we **adapt** (the file is a marketing-site analysis, not an app kit): app-sized type (14–15 px body, not 16–64), table density, focus rings, status tints and a dark theme.

## 3. Token mapping (light) — old → new

| Token | Now | New |
|---|---|---|
| `--op-font` | IBM Plex Sans | **Inter** (Google Fonts, already allowed) |
| `--op-bg` (page) | `#f4f6f9` | `#fbfaf9` (warm off-white) |
| `--op-surface` | `#ffffff` | `#ffffff` |
| `--op-panel-head` / soft | `#fbfcfd` | `#f6f5f4` |
| `--op-ink` | `#16253a` | `#31302e` |
| `--op-muted` | `#5a6b80` | `#615d59` (≥ 4.5:1 on white) |
| `--op-faint` | `#8395a8` | `#8a857f` (labels only, never body) |
| `--op-line` / hairline | `#dfe5ec` | `#e6e6e6` / `#efeeed` |
| `--op-primary` | teal `#087f72` | **blue `#0075de`**, hover `#005bab`, tint `#e8f2fc` |
| rail (`--op-nav*`) | dark navy | **light warm** `#f7f6f3`, ink `#37352f`; active `#ebeae8`; the dark theme keeps a dark rail |
| radius | 12 / 8 / 6 | 10 / 8 / 6 |
| shadows | soft card shadow | none on cards (hairline only) except popovers and coachmarks |
| status tints | green/amber/red/indigo | same meanings, retuned on the warm palette; always paired with words |
| workspace accents | teal / indigo | Candidate = blue, Sales = orange `#dd5b00` (used only on the toggle and a thin rail marker) |

**Dark theme:** a selected palette, not an inversion — canvas `#191919`, surface `#202020`, raised `#2a2a2a`, ink `#f1efed`, muted `#a8a29b`, hairline `#33312f`, primary `#4da3f5` (≥ 4.5:1 on surface), the rail one step darker than the page. Every pair is checked with the contrast numbers in the comments of `tokens.css`, as today.

## 4. Scope and order of work

1. **Tokens + base components** (`tokens.css`, the base/`.btn`/`.field`/`.card`/`.panel`/`.table`/`.badge`/`.notice` rules in `app.css`): colours, Inter, sizes (body 14 px, table 13.5 px, meta 12.5 px), hairlines instead of shadows.
2. **Shell:** light warm rail with the Candidate | Sales toggle and the Advanced switch at the bottom; top bar simplified (title, help `?`, avatar). Drawer below 860 px unchanged in behaviour.
3. **Pages** (checked one by one in Edge, light + dark + 375 px): Overview/welcome, Find jobs (+ Trends), Opportunities, Opportunity, Outreach, Profiles, Settings, run page, New campaign.
4. **Advanced filters per platform** (section 5).
5. **Coachmarks** (section 6).
6. **Verify and ship:** typecheck, lint, tests, build, axe 0 violations (light + dark), Edge walkthrough of both workspaces, one merge when everything is done, live smoke.

No route, API call, validation rule or honesty rule changes. Colour never carries meaning alone.

## 5. Advanced filters per platform

Today the extra filters are behind a small ghost button, so people do not know they exist. Change: a clearly named **"More filters"** control on every tab, **open by default when the global Advanced switch is on**, with a count of active filters.

| Tab | Always visible | More filters (Advanced) |
|---|---|---|
| Wellfound | Role, location, Refresh | Company, tech stack, work mode, minimum salary, funding stage, industry, employment type, date posted, your decision, equity, sort |
| Indeed / LinkedIn / SEEK | Role, location, Search | Date posted, job type, experience, work mode, distance, **country (new, all boards)**, company, tech stack, exclude terms, **pay shown only (new)**, **hide staffing agencies (new)**, **newest first (new)** |
| Trends | Role/skill, location, Show trends | Posted within, sample size, **country (new)** |

New filters are honest about what they are: *country* is a JSearch parameter; *pay shown only*, *hide agencies* and *newest first* act on the postings already loaded (no extra search). "Hide agencies" is a simple, visible name list (staffing, recruiting, consulting, "solutions"-style agency words) and says what it hid.

## 6. Coachmarks — specification

Following the pattern (ui-patterns.com/patterns/coachmarks): **3–4 items at most per flow**, readable, positioned beside the thing they explain, and — because the pattern warns they "do not solve the underlying problems of a poorly composed interface" — only after the structure was simplified (done in rounds 1–2).

- **What it is:** a small non-blocking popover with an arrow and a soft highlight ring on the target. The page stays usable; no full-screen dim.
- **Controls:** *Next*, *Back*, *Skip tips*; `Esc` closes; counter "2 of 4". Focus moves into the tip and returns to the target when it closes; `role="dialog"` with a label; respects reduced motion; works at 375 px (bottom sheet).
- **When:** first visit to a screen, once. Remembered per browser (`op.coach.<flow>`); skipping hides all tips. **Help (?) in the top bar** replays the tips for the current screen, and Settings → Advanced has "Show all tips again".
- **Where the target is:** elements carry `data-coach="<id>"`; if a target is missing (for example no results yet) that step is skipped, never shown floating.
- **Flows (each ≤ 4 steps):**

| Screen | Steps |
|---|---|
| Overview / welcome | 1 Find jobs (menu) · 2 Opportunities (where matches wait) · 3 Outreach (messages you send) |
| Find jobs | 1 Search box · 2 More filters · 3 Trends tab · 4 Start a campaign |
| New campaign | 1 Role and place · 2 Where to look · 3 Create & run |
| Opportunities | 1 Match score · 2 Waiting for approval · 3 Approve / open a job |
| Opportunity | 1 Approve & apply · 2 Reach out · 3 More details (Advanced) |
| Outreach | 1 The message · 2 Approve & send · 3 Paste the receipt |

- **Next-step hint** (always on, not a tip): the existing "Getting started" card keeps pointing at the next unfinished step.

## 7. Files

`docs/UI_REVAMP_PLAN.md` (this file) · `src/styles/tokens.css` · `src/styles/app.css` · `index.html` (Inter) · `src/features/shell/AppShell.tsx` · `src/components/Coachmarks.tsx` + `src/features/coach/coachFlows.ts` (+ test) · `src/features/wellfound/*` (filters) · `src/features/trends/*` · `docs/MVP_CUT.md` (what changed).

## 8. Risks and how they are handled

- **Contrast** after the palette change → every text pair is measured and written next to its token; axe must report 0 violations in both themes.
- **A whole-app restyle can hide a layout bug** → each screen is opened in Edge in light, dark and 375 px before merge.
- **Coachmarks can annoy** → once per screen, 3–4 steps, skippable in one click, replayable on demand.
- **Rollback:** one PR; the previous look is on `main` before the merge and on the archive branches.

## 9. Status (2026-10-12) — done

| Step | Result |
|---|---|
| Tokens + base look (V2) | Notion-style palette in `tokens.css` (light + dark), Inter, hairlines; every text pair measured (comments in the file); axe **0 violations** in light, dark and with a coachmark open |
| Shell (V3) | Light warm rail (dark theme keeps a dark rail), compact Candidate \| Sales toggle with a per-workspace accent, Advanced switch, Help `?` in the top bar |
| Pages (V4) | Opened in Edge, light + dark + 375 px: welcome, Overview, Find jobs, Opportunities, Opportunity, Outreach, Profiles, Settings, New campaign — no overflow, no page errors |
| Filters (V5) | **More filters** on every tab (open by default when Advanced is on). New: country on all boards, *pay shown only*, *hide staffing & recruiting firms*, *newest first* (these three act on the loaded results and say how many they hid); Trends country |
| Coachmarks (V6) | 6 flows × 3–4 steps (`coachFlows.ts`), non-blocking tip with arrow + ring, Next/Back/Skip tips/Got it, Esc, focus into the tip and back, bottom sheet at 375 px, once per screen, Help `?` replays, Settings → "Show the tips again" |
| Ship (V7) | One PR, merged once; see `TASKS.md` |

Left for later: a deeper restyle of the Advanced-only screens (Campaign builder steps, Staffing) — they inherit the new tokens and were checked for clashes, but were not redesigned.
