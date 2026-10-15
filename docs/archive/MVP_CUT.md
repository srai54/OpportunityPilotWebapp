# MVP cut — what was removed, where it is, how to bring it back

_Decided by the owner on 2026-10-09 ("a lot of features are not required in the current MVP — remove them, keep them in a separate branch for integration in a few days, and write down what was done")._

## Where the removed code lives (nothing was lost)

| Repo | Branch | Contains |
|---|---|---|
| Web | `archive/pre-mvp-cut-2026-10-09` (`adb0b84`) | The full web app **just before** the cut, including the job-board tabs, paging and "start a campaign from a search" |
| API | `archive/pre-mvp-cut-2026-10-09` (`8448701`) | The full API (the cut changed no API code) |
| Both | `backup/full-featured-2026-10-09` | Older snapshot that also still has the fictional Sales demo and the first Workday code |

To bring a screen back: `git checkout archive/pre-mvp-cut-2026-10-09 -- <paths below>`, restore its route in `src/App.tsx` and its nav entry in `src/features/shell/shellModel.ts` (and the nav tests), then `npm run typecheck && npm run lint && npm test`.

## Removed from the product UI (web PR #30, `76a7f08`)

| Screen / feature | Route | Files (web) | Why removed | What is needed to re-enable |
|---|---|---|---|---|
| Applications (local apply agent results, agent keys, setup steps) | `/applications` | `features/applications/ApplicationsPage.tsx` (the `applicationStatus.ts` helper stays) | The agent has never been run on the live LinkedIn / Naukri / InstaHyre sites (task U3); unofficial automation | A first real agent run by the owner on their own machine |
| Sales: Projects & tenders | `/projects`, `/projects/:id` | `features/sales/SalesProjectsPage.tsx`, `SalesProjectDetailPage.tsx` | Needs Upwork / Freelancer.com API access (U6, N5) | Approved API keys |
| Sales: Proposals & bids, Bids sent | `/proposals`, `/bids` | `features/sales/SalesProposalsPage.tsx`, `SalesBidsPage.tsx` | Same dependency; bids are placed by hand | Same |
| Staffing: Rate cards | `/staffing/rate-cards` | `features/staffing/StaffingRateCardsPage.tsx` | Not needed to run a deal; proposals inside a deal still read rate cards via the API | None — restore when wanted |
| "Other sources — not built yet" list in the campaign Sources step | — | `features/campaigns/SourcesStep.tsx` | Clutter | — |
| Links to the above | — | `overview/analyticsModel.ts`, `integrations/IntegrationsPage.tsx`, `guide/guideModel.ts` | Dead after the cut | Restore with the screens |

All matching **API endpoints still exist and are tested** (`/api/v1/applications`, `/api/v1/sales/projects`, `/api/v1/sales/bids`, `/api/v1/staffing/rate-cards`, agent keys). Only the screens were removed.

## Removed earlier the same day

| What | Where it went |
|---|---|
| Fictional Sales demo (the "Demo —" campaigns) | API #25 / web #27 removed it; code in `backup/full-featured-2026-10-09` |
| Indeed / LinkedIn / SEEK tabs | Removed, then **restored** once the JSearch v5 path (`/search-v2`) was found — they are live now |

## What is live in the MVP

- **Candidate:** profile → campaign (Greenhouse, Lever, Ashby, Workday, Adzuna, Remotive, Remote OK, Wellfound, Indeed / LinkedIn / SEEK through JSearch) → scored opportunities with evidence → batch approval → apply yourself on the job's page and mark it applied.
- **Sales:** hiring signals (job-board search) → "Start a campaign from this search" → scored company leads → outreach drafts (approve the exact version, send yourself, paste a receipt) → follow-ups → staffing deals and candidates.
- **Data:** every source is real and live. There is no demo data.

## Known limits (written down so nobody has to rediscover them)

- JSearch free plan: 200 searches a month, ~17 s per live search, results are what Google for Jobs indexes (sparse for India and SEEK). Identical searches are cached 6 h.
- Nothing is applied or sent automatically. Gmail sending is not connected (N6), so the user sends and records a receipt.
- See the workspace `TASKS.md` for the items that need the owner (keys and accounts).

## One-click flows (built 2026-10-09, minimum MVP version)

The owner asked for one click to apply (Candidate) and one click to send (Sales). Providers have no apply/send API the app may use, and the plan requires approval, so the MVP version is **"Approve & open"**: the app approves the exact item, records it, and opens the place where the user finishes it. Nothing is sent or applied by the app.

| Who | Button | What one click does | What the user still does |
|---|---|---|---|
| Candidate | Opportunity → **Approve & apply →** (shortlisted: *Open application page →*) | Shortlists the job and opens its application page in a new tab | Applies there, then clicks **I applied ✓** (recorded in the activity history) |
| Sales | Outreach → **Approve & send →** | Saves edits, approves that exact version, starts the send record, then: Email → opens the mail app pre-filled; LinkedIn message → copies the text and opens LinkedIn Messages; contact form → copies the text and opens the page | Sends it there, pastes a receipt, clicks **I sent it** (only then is it marked Sent) |

A draft with an unfilled `[PLACEHOLDER]` cannot be approved; the button says which one to replace.

**Not built (needs the owner / future):** unattended auto-apply or auto-send. Indeed and LinkedIn offer no apply API; the local agent (LinkedIn / Naukri / InstaHyre) is built but unverified (U3); true one-click email needs Gmail OAuth (N6).

## Reaching the hiring people (built 2026-10-09, local branch `feature/board-filters`)

No data source may list LinkedIn people, and LinkedIn offers no connect API, so the app guides the manual steps:

1. **Find recruiters ↗** on every job-board result and **Find recruiters at <company> ↗** on every opportunity opens a LinkedIn people search for that company (recruiter / talent acquisition / hiring manager, plus the searched skill). The user connects there.
2. **Connection note:** create a *LinkedIn message* draft; the template is a whole-sentence note of at most 300 characters (`LinkedInNote`), shown with a character counter. **Approve & send →** copies it and opens LinkedIn Messages.
3. **Follow-up email:** after they accept, the draft editor links to the opportunity where an email draft is created, approved and sent with the same one-click flow, then a receipt is pasted.

Not possible without a paid licensed contact-data API (Apollo, Hunter, People Data Labs): listing people by skill and finding their email addresses.

## Simplification round 2 (2026-10-09: "too complex — remove what is not working, keep track")

Removed from the UI of the web app; all code is on `archive/pre-mvp-cut-2026-10-09` (web) and the API is untouched.

| Removed | Why | Restore |
|---|---|---|
| Sources & integrations page (`/integrations`, nav entry, `features/integrations/*`) | A technical status matrix; no action a user needs | `git checkout archive/pre-mvp-cut-2026-10-09 -- src/features/integrations` + route + nav |
| Campaign source options: RSS/Atom feed, Adzuna, Workday, Ashby, SmartRecruiters, Recruitee, Workable, Remotive, Remote OK | Not verified live (Adzuna needs a key; the rest never run on real data) | Restore the `ADD_OPTIONS` rows and `JobBoardSources` forms in `SourcesStep.tsx` |
| Campaign modes Partner, Investor, Freelance for **new** campaigns (existing ones keep their mode) | Only Job (Candidate) and Customer (Sales) are used | Drop the mode filter in `GoalStep.tsx` |
| "Scheduling — Schedule setup required" card on the run page | Stale text that contradicted the real schedule panel | — |

Kept and kept working: paste text, public URL, CSV, Greenhouse, Lever and Job-board search (Indeed / LinkedIn / SEEK) sources.

Fixed in the same round:
- A job-board search source with no keywords now **blocks the run** with a clear reason (it used to "complete" with 0 items).
- **Scheduled campaigns did not run** because the free Render instance sleeps and cannot poll. A GitHub Actions timer (`.github/workflows/keepalive.yml`, every 10 minutes, free because the repo is public) now keeps it awake.
- Where data is stored and how to query it: API `docs/DATA_STORAGE.md`.

## Simple UI + Advanced switch (2026-10-09/11: "make the UI simpler, everything under an Advanced toggle")

One **Advanced** switch (sidebar footer and Settings, remembered per browser in `op.advanced`) reveals everything non-essential. Nothing was deleted: the full screens are the Advanced view, and the previous layout is on `archive/pre-mvp-cut-2026-10-09`.

| Area | Simple (default) | Under Advanced |
|---|---|---|
| Menu | Overview · Find jobs / Find companies · Opportunities / Companies · Outreach · Profiles · Settings | Campaigns, Follow-ups, Staffing (Deals, Candidates), How it works |
| New campaign | One screen: role, place, where to look, **Create & run** (`QuickCampaign.tsx`) | The full four-step builder (`/campaigns/new?full=1`): weights, hard filters, thresholds, more sources. Existing campaigns always open in it |
| Find jobs | Role + place + Search on tabs Wellfound / Indeed / LinkedIn / SEEK / **Trends** | Filter chips (date, type, experience, mode, distance), company, tech stack, exclude terms; Wellfound activity and applicant panels |
| Approvals | A second view inside Opportunities ("Waiting for approval · N"); `/approvals` redirects there; count badge on the Opportunities menu item | — |
| Hiring trends | A tab in Find jobs; `/trends` redirects there | Date and sample-size settings |
| Overview | "Find jobs" strip, four numbers, what needs attention | Pipeline funnel, score histogram, why-jobs-stall, source performance, applications chart, extra numbers |
| Opportunity page | Title, score, next step, one-click Approve & apply / Approve & send, cover note and outreach | "How the score was built", facts, unknowns, evidence, activity history (button on the page) |
| Settings | Account, display, Advanced switch | Rules and deployment facts |

Restore a simple-mode screen's old layout: set Advanced on, or check out the file from the archive branch.

## Round 2 — simpler screens, plain words, guided start (2026-10-12)

| Change | Simple (default) | Under Advanced |
|---|---|---|
| Opportunity page | "Reach out": **Draft LinkedIn note** / **Draft email** (one click makes the draft and opens it in Outreach, `?draft=`) and a single "Next" bar | Channel, recipient, contact form, follow-up (next action) |
| Opportunities list | Job + company, **Match**, Status, one action; search box | Mode, evidence, outcome, updated, campaign picker (shown without Advanced only if there are 2+ campaigns), outcome/status/sort filters, Refresh, Export CSV |
| Profiles | Name, What you offer, Skills, Availability | Type, experience and other fields, Claims / Summary / Versions tabs |
| Outreach | Draft list + editor, Approve & send | Channel/state/campaign filters, tick boxes, batch approve |
| Words | **Approved** (was Shortlisted), **Skipped** (was Dismissed/Rejected), **Match** (was Fit), buttons Approve / Skip. API values are unchanged | — |
| Chrome | Compact **Candidate \| Sales** toggle (replaces the workspace dropdown); the Demo-mode banner can be dismissed for the session | "Rules mode · no AI key" pill |
| Run page | "Looking for jobs…" and an automatic jump to the results when it finishes; failed/cancelled runs say so plainly | Stage tracker, counts and event log (`advanced` on) |
| Getting started | Welcome page: "Find a job / Find customers" + three guided steps (profile → find → approve), the next one highlighted; the same card sits on the Overview until all three are done | — |
| Removed (dead code) | `features/applications/AgentSetup.tsx` and `HowItWorks.tsx` (apply-agent setup), unused Adzuna / Workday / aggregate source forms, "your agent" wording | Restore from `archive/pre-mvp-cut-2026-10-09` |

New feature: **How you compare** (Find jobs → Trends). It compares the skills the sampled postings ask for with the skills on your profile ("38% of what these postings ask for is on your profile"; "in demand, not on your profile: Databricks 39%"). No extra search is used and the app never adds a skill to your profile.

## Round 3 — new look, per-platform filters, coachmarks (2026-10-12)

See `docs/UI_REVAMP_PLAN.md` (plan and status). Nothing was removed: the look changed (Notion-style tokens), every Find-jobs tab got a **More filters** control, and first-time **coachmarks** guide each workflow (Help `?` replays them; Settings → "Show the tips again"). Restore the previous look from `main` before PR "UI revamp" or the archive branches.
