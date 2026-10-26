# Sales flow — the app as a sales assistant

The Sales team uses the app to find business opportunities (companies with a problem the product solves; later freelance projects and tenders/RFPs), prepare proposals and emails, approve them in a batch, send, and follow up. Customer-mode research and the first manual sales project/bid/approve API are built; the project screens, provider discovery/placement, tender feeds, proposal/email drafts, sending, and follow-up UI remain pending.

Template fields per entry: Route, Component, What it shows, Actions, State (reads), State (writes), Navigation out, Validation, Status, TODOs. `Status` is flipped only by `/build-screen`. The campaign builder, research run and opportunity screens are the same components as the Candidate flow; their full entries are in `docs/CANDIDATE_FLOW.md` and only Customer differences are listed here. Contracts: `../OpportunityPilotWebApi/docs/api-contracts.md` (what exists) and `../OpportunityPilotWebApi/docs/feature-contracts.md` (earlier slice specs). Gap IDs refer to `docs/open-questions.md`.

### Job discovery — Wellfound and Indeed

- **Route:** `/wellfound` in the Sales workspace.
- **Component:** `src/features/wellfound/WellfoundPage.tsx`.
- **What it shows:** Wellfound public roles as stored hiring signals plus OAuth-only recruiter scope, and an Indeed official-search builder for role/tech/company/location/work-mode/type/experience/date/exclusion research. Wellfound filters and KPIs use only observed facts.
- **Actions:** Refresh and filter Wellfound signals, open exact postings, or open a generated Indeed search. A company found on Indeed is manually carried into a Customer campaign; no copied Indeed listing or automatic outreach is claimed.
- **State:** Wellfound status, jobs, applications, activities and Sales KPIs from `/api/v1/wellfound/*`. Indeed search criteria remain transient and are not presented as synced data.
- **Navigation out:** exact Wellfound job URL, generated Indeed search URL, or the existing Campaigns screen through normal navigation.
- **Validation:** Indeed needs at least a query term or location. Unknown Wellfound facts do not pass a selected filter.
- **Status:** Wellfound public hiring-signal research and Indeed official-search handoff built; private recruiter actions and an approved Indeed feed remain provider-authorized work.
- **TODOs:** OQ-FE-043 (Wellfound OAuth), OQ-FE-044 (Indeed partner API approval), and a future explicit convert-signal-to-campaign action.

---

### Campaign builder — Customer specifics (steps 1–4)

- **Route:** `/campaigns/new`, `/campaigns/:id/edit?step=1..4` (same routes as the Job builder)
- **Component:** `src/features/campaigns/CampaignBuilder.tsx`, `GoalStep.tsx`, `FiltersStep.tsx`, `SourcesStep.tsx`, `ReviewStep.tsx`; logic in `campaignModel.ts`
- **What it shows:** Step 1: mode "Customers — Companies with a problem you solve" (suggested automatically for Product, Business and Services profiles); Customer placeholders ("e.g. EU logistics software companies"). Step 2: Search "Product and search words"; hard filters Geography, Exclude keywords, Exclude organisations (no required skills, work modes or years); scored Industries, Problems you solve ("two or more mentions count as a full match"), Published signals ("absence is unknown, not a negative"); weights Industry 25, Problem 30, Geography 15, Published signals 20, Contact path 10 (contact path is always applied). Step 3: paste blocks start with the company name and accept `Website:`; CSV requires `name`, optional `website`, `country`, `industry`, `description`. Step 4: review lists Geography as a hard filter and Industries / Problems / Signals as scored.
- **Actions:** As in `docs/CANDIDATE_FLOW.md` (Campaign builder steps 1–4). Reset to defaults applies the Customer weights.
- **State (reads):** As in the Job builder; `campaign.mode === 'Customer'` switches labels, criteria, weights and CSV columns.
- **State (writes):** `POST /api/v1/campaigns` / `PUT /api/v1/campaigns/:id` with only Customer criteria (`keywords`, `industries`, `problems`, `locations`, `signals`, `excludeKeywords`, `excludeOrganizations`) and Customer weights; sources and research calls as in the Job builder.
- **Navigation out:** As in the Job builder.
- **Validation:** Same rules as the Job builder (`draftProblems`); no years-of-experience field in Customer mode.
- **Status:** built
- **TODOs:** No tender/RFP or Freelancer.com project sources — only Paste, URL, Feed, CSV (OQ-FE-002). Freelance mode disabled until M7 (OQ-FE-032). Discovery provider not built (OQ-FE-021). "Suggest criteria" (M4) not built (OQ-FE-007).

---

### Opportunities — List (Customer)

- **Route:** `/opportunities?campaign=<customer campaign id>`, `/campaigns/:id/opportunities`
- **Component:** `src/features/opportunities/OpportunitiesPage.tsx`
- **What it shows:** Same list as the Job entry in `docs/CANDIDATE_FLOW.md`; rows show the company as title/organisation and mode "Customer"; no platform line. Fit uses the Customer criteria. The page states that bulk sending is not offered.
- **Actions:** Same as the Job list: Shortlist / Dismiss / Remove from shortlist / Restore (`PATCH /api/v1/opportunities/:id/status`), filters, sort, Load more, Refresh, Export CSV, open detail.
- **State (reads):** `GET /api/v1/campaigns`; `GET /api/v1/campaigns/:id/opportunities?outcome&status&sort&take=50&skip`.
- **State (writes):** `PATCH /api/v1/opportunities/:id/status`; `GET /api/v1/campaigns/:id/export` (CSV download).
- **Navigation out:** `/opportunities/:id`, `/research/:jobId`, `/campaigns/new`, `/campaigns/:id/edit?step=4`.
- **Validation:** Same as the Job list.
- **Status:** built
- **TODOs:** No selection of several companies for one outreach batch (OQ-FE-001). Copy "every message is approved individually" conflicts with batch approval (OQ-FE-001).

---

### Opportunity — Detail (Customer)

- **Route:** `/opportunities/:id`
- **Component:** `src/features/opportunities/OpportunityDetailPage.tsx`
- **What it shows:** Same layout as the Job detail in `docs/CANDIDATE_FLOW.md`, with Customer differences: the external link reads "Open website"; "Mark contacted" replaces "Mark applied"; no apply-agent notice; fit contributions are Industry, Problem you solve, Geography, Published signals, Contact path; a missing contact path stays visible as Unknown / a gap.
- **Actions:** Shortlist, Dismiss, Mark contacted (shown when status is not Contacted; no confirm), Set status + Update → `PATCH /api/v1/opportunities/:id/status`. Evidence anchors. Back to the list.
- **State (reads):** `GET /api/v1/opportunities/:id`.
- **State (writes):** `PATCH /api/v1/opportunities/:id/status` `{ status }`.
- **Navigation out:** `/campaigns/:campaignId/opportunities`; the company website (http/https only, new tab).
- **Validation:** Buttons disabled while a change runs; Update disabled when the selected status equals the current one.
- **Status:** built
- **TODOs:** No email/proposal draft section, no AI explanation, no activity logging or next actions (OQ-FE-005, OQ-FE-007, OQ-FE-006). "Mark contacted" is a manual status; M5 replaces it with logged activities (`POST /api/v1/opportunities/{id}/activities`).

---

### Outreach — Inbox and draft editor

- **Route:** `/outreach`.
- **Component:** `src/features/outreach/OutreachPage.tsx`.
- **What it shows:** Cross-opportunity drafts with campaign, organisation, channel, recipient verification, state and exact version; filters for campaign/channel/state; editor fields and API-provided send blockers.
- **Actions:** Open and edit (which clears approval), approve/revoke one version, select eligible filtered drafts for batch approval, or copy a draft while recording a Note activity on its opportunity.
- **State (reads):** `GET /api/v1/drafts?state&channel&campaignId&take&skip`, `GET /api/v1/drafts/:id`.
- **State (writes):** `PUT /api/v1/drafts/:id`, per-version approve/revoke, `POST /api/v1/drafts/batch-approve`, and `POST /api/v1/opportunities/:id/activities` for copy audit.
- **Navigation out:** `/opportunities/:id`.
- **Validation:** The API rechecks suppression during create/edit/approval, refuses bracketed placeholders and stale versions, and reports per-item approved/skipped/stale batch outcomes. User-entered recipients remain visibly unverified. Sending remains unavailable until a provider returns a receipt.
- **Status:** built; strengthened review queue built 2026-10-07.
- **TODOs:** Evidence-derived recipient verification, claims/evidence panel, version history and Gmail sending remain (OQ-FE-010).

---

### Follow-ups — Reminders by due date

- **Route:** `/follow-ups` (Follow up hub: replies, follow-up drafts and suppressions)
- **Component:** today `src/features/placeholder/NotBuiltPage.tsx` via `src/App.tsx:63-73`; planned `src/features/follow-ups/FollowUpsPage.tsx` + `followUpModel.ts`
- **What it shows:** Today: "Follow-ups — Reminders grouped by due date, with opt-outs and suppression respected." and "Not built yet — milestone M7". Planned (next actions in the API repo's `feature-contracts.md`, design `FollowUps.dc.html`): open next actions grouped by due date with the time zone stated, overdue marked, opportunity title and organisation; suppression list. Reminders are shown in the app only — nothing is delivered.
- **Actions:** Today: Go to profiles. Planned: mark done / cancel, reschedule, open the opportunity, add/remove a suppression.
- **State (reads):** Today: none. Planned: `GET /api/v1/next-actions?state=Open`, `GET /api/v1/suppressions`.
- **State (writes):** Today: none. Planned: `PATCH /api/v1/next-actions/:id { state?, dueAt? }`, `POST /api/v1/opportunities/:id/next-actions { kind, note, dueAt, timeZone }`, `POST /api/v1/suppressions { recipient, reason }`, `DELETE /api/v1/suppressions/:id`.
- **Navigation out:** Today: `/profiles`. Planned: `/opportunities/:id`.
- **Validation:** Planned: due date required and in the user's stated time zone; suppression recipient required.
- **Status:** not built
- **TODOs:** Milestone label M7 conflicts with the contract's M5 (OQ-FE-006). API not built. Also relevant to Candidate follow-ups once roles exist (OQ-FE-003).

---

### Proposal drafts — Proposals for projects, tenders and companies

- **Route:** `/proposals`; editing occurs at `/projects/:id`.
- **Component:** `src/features/sales/SalesProposalsPage.tsx`, `SalesProjectDetailPage.tsx`, pure helpers in `salesModel.ts`.
- **What it shows:** Current manual bid drafts and approved versions across sales projects. Each row shows project, proposal excerpt, exact version, amount, currency, delivery window and approval state. A warning states that nothing is submitted from this screen.
- **Actions:** Open a project; create or edit a bid; approve the exact current version. Editing clears approval through the API.
- **State (reads):** `GET /api/v1/sales/projects`, `GET /api/v1/sales/projects/:id`.
- **State (writes):** `POST /api/v1/sales/projects/:id/bid`, `PUT /api/v1/sales/bids/:id`, `POST /api/v1/sales/bids/:id/approve`.
- **Navigation out:** `/projects`, `/projects/:id`.
- **Validation:** Amount > 0, three-letter uppercase currency, delivery 1–3650 days, non-empty proposal; the API remains authoritative and returns 409 for stale versions.
- **Status:** first manual bid/proposal slice built
- **TODOs:** Evidence-backed generated sales proposal drafts, tender handoff, provider placement and batch approval remain (OQ-FE-001/OQ-FE-002).

---

### Freelancer.com bids — Find projects and place bids

- **Route:** `/projects`, `/projects/:id`, `/proposals`, `/bids`.
- **Component:** `src/features/sales/SalesProjectsPage.tsx`, `SalesProjectDetailPage.tsx`, `SalesProposalsPage.tsx`, `SalesBidsPage.tsx`.
- **What it shows:** (planned) Freelancer.com projects found through the official API, scored like other opportunities, with a prepared bid (amount, delivery time, proposal text) per project.
- **Actions:** (planned) review prepared bids, approve a batch, place approved bids through the Freelancer.com API.
- **State (reads):** `GET /api/v1/sales/projects` and `GET /api/v1/sales/projects/:id`; Freelance campaign mode remains disabled.
- **State (writes):** (implemented API first slice) manual project creation and bid create/edit/approve; bid placement remains server-side and is not implemented.
- **Navigation out:** (planned) opportunity detail, approval batch.
- **Validation:** (planned) no bid is placed without approval; amounts come from the user, never invented.
- **Status:** first manual project/bid UI slice built
- **TODOs:** Freelancer provider discovery/placement and Freelance mode (OQ-FE-032); provider-backed project ingestion; credentials stay in server configuration (`CLAUDE.md` security rules).

---

### Batch approval — Approve outgoing emails and bids in one step

- **Route:** `/outreach` for message drafts; `/proposals` and project detail for bids.
- **Component:** batch selection is integrated into `OutreachPage.tsx`; sales bid batch API exists but has no combined web queue yet.
- **What it shows:** Eligible drafts in the current filters, selected count, and the approved/skipped/stale result summary.
- **Actions:** Select all eligible filtered drafts or individual drafts, then approve their exact versions in one request.
- **State (reads):** `GET /api/v1/drafts`.
- **State (writes):** `POST /api/v1/drafts/batch-approve`; `POST /api/v1/sales/bids/batch-approve` is available for the future combined queue.
- **Navigation out:** outreach editor and opportunity detail.
- **Validation:** Every item is revalidated independently for ownership, version, suppression, required recipient and placeholders. Nothing is sent or placed by approval.
- **Status:** outreach batch approval built.
- **TODOs:** Add sales bids to a combined outgoing review queue when provider placement is implemented (OQ-FE-002).

### Update 2026-10-08 — Sales journey and staffing CRM (P2–P8, X2–X15)

- **Profile (P2):** Product/Services/Business profiles carry ideal customer, regions, capacity, approved case studies and
  an outreach identity (draft sign-off); the editor shows what is still needed; every draft claim names "Profile vN".
- **Campaigns (P3):** Customer, Partner, Investor and Freelance each have their own goal example, steps and criteria
  labels. Sources include Job board search (Indeed, LinkedIn, SEEK via JSearch): hiring companies become leads.
- **Decide (P4):** the opportunity page states the next permitted action; shortlisted companies lead to outreach;
  "Make a staffing lead" turns a company into a staffing account + deal (X3).
- **Act (P6, S13):** drafts go Draft → Approved → Sent; "Send this approved version" starts one execution (approval,
  suppression, daily limit, idempotency), you send it yourself and record the receipt, or record that it failed. Bids use
  the same gateway. Nothing is sent by the server.
- **Overview (P5):** all four Sales modes with a mode filter; Contacted/Responded from stored status changes; outreach
  panel (drafts, bids, follow-ups, reply rate). A demo card builds a replayable fictional Sales + staffing demo (P8).
- **Staffing (rail → Staffing):** Deals (funnel KPIs), deal page (stages, conversation and meetings, submissions,
  interviews, feedback, offers/contract/placement, proposals from rate cards), Candidates (consent and shareable fields),
  Rate cards. Routes: `/staffing`, `/staffing/deals/:id`, `/staffing/candidates`, `/staffing/rate-cards`.

### Interviews — tracker across deals (2026-10-15)

- **Who:** Sales (staffing). **Route:** `/staffing/interviews` (rail → Staffing → Interviews, Advanced like the rest of Staffing).
- **API:** `GET /api/v1/staffing/interviews` (rows with candidate, client, role, progress-link visibility); quick actions call the
  existing deal endpoints (`…/interviews/{id}/notified`, `…/finish` with Completed / NoShow / Cancelled, `POST …/interviews` for the next round).
- **Shows:** KPIs (coming up, next 7 days, candidate not told, done), then cards: coming up (soonest first) and past.
  Each card: candidate · round, status word, "Candidate told / not told", client · role · time, what the progress link shows.
- **Actions:** I told the candidate · Mark done · No-show · Ask for next round · Cancel · Share progress (the existing
  progress-link panel) · Open deal. The candidate's `/progress/<token>` page reflects a status change when the link shows interviews.
- **Status:** built.
