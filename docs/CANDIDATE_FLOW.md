# Candidate flow — finding and applying to jobs

The Candidate is a job seeker: a **Candidate** profile, **Job**-mode campaigns, research that scores postings, a shortlist, and the local apply agent that applies only to shortlisted LinkedIn/Naukri jobs. Pipeline: profile → campaign → research run → opportunities → shortlist → agent applies → Applications.

Phase-1 additions (open job sources Greenhouse / Lever / Adzuna, batch approval queue) follow `../OpportunityPilotWebApi/docs/CANDIDATE_PHASE1_CONTRACT.md`.

### Job discovery — Wellfound and Indeed

- **Route:** `/wellfound` in the Candidate workspace.
- **Component:** `src/features/wellfound/WellfoundPage.tsx`.
- **What it shows:** A Wellfound/Indeed source switch. Wellfound shows stored anonymous public roles, exact posting links and Candidate KPIs with filters for role, company, tech stack, location, work mode, salary, equity, funding, industry, employment type, date, local state and sort. Indeed shows a precise official-search builder; it never labels a handoff as an in-app listing.
- **Actions:** Wellfound: refresh, filter, save, mark applied or open the exact posting. Indeed: assemble role/technology/company/location/work-mode/type/experience/date/exclusion criteria and open that search on Indeed. Applications remain on the provider; local status is explicit.
- **State:** Wellfound status, jobs, activities and Candidate KPIs from `/api/v1/wellfound/*`. Indeed search criteria are transient browser state and produce only an official `indeed.com/jobs` URL.
- **Navigation out:** exact Wellfound job URL or generated Indeed search URL, both in a new tab.
- **Validation:** Indeed needs at least a query term or location before its handoff link is enabled. Wellfound filters use stored facts only; unknown provider facts do not match.
- **Status:** public Wellfound discovery and official Indeed search handoff built. An in-app Indeed listing feed needs written partner approval and an approved API; private Wellfound recruiter data remains blocked on Recruit OAuth.
- **TODOs:** OQ-FE-043 (Wellfound OAuth), OQ-FE-044 (Indeed partner API approval).

**Update 2026-10-08 — Indeed, LinkedIn and SEEK tabs (W10–W13).** The source switch is now Wellfound · Indeed ·
LinkedIn · SEEK. Each board tab (`BoardSearchPanel.tsx`, `boardModel.ts`) keeps the same filters (SEEK adds a
Country select, Australia / New Zealand) and offers two actions: **Show live <board> jobs** calls
`GET /api/v1/jobboards/jobs?board=&query=&location=&remoteOnly=&datePosted=&country=` and lists current postings
published on that board (`BoardLiveResults.tsx`: title, company, location, remote, job type, pay, posted date,
snippet, "Open on <board>"); **Open search on <board>** opens the same search on the board. Results are read-only and
not stored. States: loading; "Live listings not set up" when the server has no `Jsearch__Key`; "unavailable" on
provider errors (refused key, quota); an empty list explains that no matching posting was published on that board.
The page title is now "Job discovery". Supersedes the Indeed-only wording above where they disagree.

Template fields per entry: Route, Component, What it shows, Actions, State (reads), State (writes), Navigation out, Validation, Status, TODOs. `Status` is flipped only by `/build-screen`. Shared screens (sign-in, shell, Overview, Profiles, Integrations, Settings): `docs/SHARED_FLOW.md`. Customer-mode differences of the same components: `docs/SALES_FLOW.md`. API contract for built screens: `../OpportunityPilotWebApi/docs/RESEARCH_CONTRACT.md`. Gap IDs refer to `docs/open-questions.md`.

---

### Campaigns — List

- **Route:** `/campaigns`
- **Component:** `src/features/campaigns/CampaignsPage.tsx`
- **What it shows:** Intro text and "New campaign". Empty state with the four builder steps; if the user has no profile, "Add a profile" instead. Otherwise a table (newest first): campaign name + goal, mode badge (Job / Customer), source count, opportunity count, last run (state badge + finish time, or "Never run"), updated time. Lists campaigns of every mode.
- **Actions:** New campaign → `/campaigns/new`; campaign name → `/campaigns/:id/edit`; source count → `/campaigns/:id/edit?step=3`; opportunity count → `/campaigns/:id/opportunities`; last-run badge → `/research/:jobId`; Add a profile → `/profiles/new`; Try again on error → reload.
- **State (reads):** `GET /api/v1/campaigns` (`CampaignSummary[]`); `GET /api/v1/profiles` (only to know whether any exist).
- **State (writes):** none.
- **Navigation out:** `/campaigns/new`, `/campaigns/:id/edit`, `/campaigns/:id/edit?step=3`, `/campaigns/:id/opportunities`, `/research/:jobId`, `/profiles/new`.
- **Validation:** none (links only). The table scrolls horizontally inside `.table-scroll`.
- **Status:** built
- **TODOs:** No filter by mode or role (OQ-FE-003).

---

### Campaign builder — Step 1 · Goal and mode

- **Route:** `/campaigns/new` (no `step`), `/campaigns/:id/edit` or `?step=1`
- **Component:** `src/features/campaigns/CampaignBuilder.tsx` (shell, stepper, footer, save) + `src/features/campaigns/GoalStep.tsx`; logic in `campaignModel.ts`
- **What it shows:** Header (campaign name or "New campaign", mode badge, version, saved time, "Unsaved changes" / "Saved"). Stepper with four steps; steps 3–4 locked until the campaign is saved. Profile select ("Name (Type)"), with a notice and link when the user has no profiles and a hint when the profile is not confirmed. Mode radio cards: Jobs, Customers (enabled), Partners, Investors, Freelance (disabled, "Not built yet · M7"). Campaign name. Goal textarea with a character counter (stored as a note; it is not parsed). Side panel "Criteria" (entered by you) summarising step 2 with "Enter/Edit criteria".
- **Actions:**
  - Pick profile / mode (new campaign only) → draft updates; with no explicit choice the mode follows the profile type (Candidate → Job, otherwise Customer).
  - Enter / Edit criteria, Continue, stepper step 2 → `?step=2` (no save).
  - Save campaign → `POST /api/v1/campaigns` → `/campaigns/:id/edit` on the same step (replace, focus moves to the step heading). Save version N+1 (existing) → `PUT /api/v1/campaigns/:id`.
  - 409 on save → "saved somewhere else" notice + "Load the latest version (discards your edits)".
  - Leaving with unsaved changes → `window.confirm`; closing the tab → browser warning.
- **State (reads):** `GET /api/v1/campaigns/:id` (`Campaign`, existing only); `GET /api/v1/profiles` (`ProfileSummary[]`); URL `?step=`; local draft (`CampaignDraft`), `saved`, `error`.
- **State (writes):** `POST /api/v1/campaigns` `{ profileId, mode, name, goal, criteria, weights, resultLimit }` (only the mode's criteria and weights, trimmed text); `PUT /api/v1/campaigns/:id` `{ name, goal, criteria, weights, resultLimit, expectedVersion }`; URL `?step=`.
- **Navigation out:** `?step=2`; `/campaigns/:id/edit` after first save; `/profiles/new` (no-profile notice).
- **Validation:** Save disabled while saving, when nothing needs saving (existing campaign unchanged), or when `draftProblems` is non-empty: no profile, blank name, name > 200, goal > 2000, result limit not a whole number 1–100, years of experience outside 0–60. The footer lists the problems. Profile and mode are disabled once saved. Name `maxLength` 200, goal `maxLength` 2000. Continue is always enabled. Server `fieldErrors` for `name`/`goal` shown under the fields.
- **Status:** built
- **TODOs:** "Suggest criteria" from the goal (M4 goal previews) not built (OQ-FE-007). Partner/Investor/Freelance disabled (OQ-FE-032). Goal error text is not linked with `aria-describedby`.

---

### Campaign builder — Step 2 · Filters (Job)

- **Route:** `/campaigns/new?step=2`, `/campaigns/:id/edit?step=2`
- **Component:** `src/features/campaigns/FiltersStep.tsx` (+ `WeightsEditor` in the same file), `src/components/TagInput.tsx`
- **What it shows:** Search: "Job titles and search phrases" (also used by the agent's searches). Hard filters (badge "Hard filter"): Required skills, Locations ("Remote" accepts remote roles), Work modes (Remote / Hybrid / On-site checkboxes), Exclude keywords, Exclude organisations — with the Excluded / Needs verification explanation. Scored criteria: Preferred skills, Your years of experience. Result limit (new opportunities kept per run). **Suggest jobs for approval** (Job only): a checkbox, off by default; when on, "Minimum fit score" number input (1–100, default 80) and the explanation "After each research run, qualified jobs scoring at least N wait in Approvals; nothing is applied until you approve." with a link to `/approvals`. Scoring weights table: Required skills, Experience, Location and work mode, Preferred skills — weight 0–100 and a preview of each share of 100 ("Not applied — nothing configured" when the criterion is empty).
- **Actions:** Tag inputs: Enter or comma adds, paste of a comma/line list adds several, × removes (announced). Tick work modes. Edit numbers. Tick "Suggest jobs for approval" → threshold set to 80; untick → off (`null`). Reset to defaults → Job default weights 40/20/20/20. Footer: Back → step 1; Save; "Save and continue" (or Continue when saved and unchanged) → step 3.
- **State (reads):** local draft (criteria, weights, resultLimit, autoSuggestMinScore); server `fieldErrors` keyed by criterion (and `autoSuggestMinScore`).
- **State (writes):** local draft only; saving as in step 1 (`POST`/`PUT /api/v1/campaigns…`, Job bodies include `autoSuggestMinScore`: the threshold or `null` when off; Customer bodies omit it); URL `?step=3`.
- **Navigation out:** `?step=1`, `?step=3` (after save), `/approvals`.
- **Validation:** "Save and continue" disabled while saving or when the draft needs saving and `draftProblems` is non-empty; Save as in step 1. Tags: max 50 per list (input disabled with "Limit of 50 reached"), 100 characters each, case-insensitive duplicates rejected and announced. Years 0–60 (blank skips the criterion). Result limit 1–100 whole number. Weights clamped to 0–100 integers; when every applied weight is 0 a hint warns that every result would score 0 (does not block saving). Auto-suggest threshold must be a whole number 1–100 when on (`draftProblems`, field error linked with `aria-describedby`/`aria-invalid`).
- **Status:** built — against `CANDIDATE_PHASE1_CONTRACT.md`; not yet verified against a running API (OQ-FE-033)
- **TODOs:** Turning auto-suggest off sends `autoSuggestMinScore: null`; the contract says PUT keeps the value when the field is omitted, so the API must treat an explicit `null` as "off" (OQ-FE-034).

---

### Campaign builder — Step 3 · Sources

- **Route:** `/campaigns/:id/edit?step=3` (saved campaigns only; unsaved drafts are clamped to step 2)
- **Component:** `src/features/campaigns/SourcesStep.tsx` (`PasteForm`, `UrlForm`, `CsvImport` in the same file)
- **What it shows:** "Sources in this campaign" table: label (+ URL, permission note, safe error), kind (+ platform for agent sources), status badge (Not fetched yet / OK / Failed / Skipped), content (characters, items, rows or "Read on each run"), last fetched, Remove. Summary "N sources · N fetched OK · N failed". Empty notice. "Add a source": kind radio — Paste text, Public URL, RSS / Atom feed, CSV file, and for Job campaigns only "Company careers board — Greenhouse", "Company careers board — Lever", "Adzuna job search (India)" — and its form. Greenhouse: board token or `boards.greenhouse.io` / `job-boards.greenhouse.io` URL (hint, example `stripe`), the derived token is shown. Lever: company slug or `jobs.lever.co` URL (example `leverdemo`). Adzuna: no input; explains it searches the campaign's job titles (up to 3) in its first non-Remote location and shows those values (warning when there are no keywords). Each of the three shows its capability status from `/api/v1/capabilities` (`greenhouse`, `lever`, `adzuna`; Adzuna "Not configured" when the server has no keys, with the consequence spelled out; "Status unknown" when capabilities are not loaded). CSV: required/optional columns for Job (`title`, `company`; `location`, `url`, `description`, `id`), preview with valid/error counts, warnings, first 50 rows with per-row errors, label, Import / Discard. "Other sources": discovery provider "Not built yet"; LinkedIn / Naukri "Via your local agent" with a link to Applications.
- **Actions:**
  - Add pasted text → `POST /api/v1/campaigns/:id/sources` `{ kind: 'Paste', label?, text }` → list reloads, announced.
  - Add URL / Add feed → `POST …/sources` `{ kind: 'Url'|'Feed', label?, url, permissionNote? }`.
  - Add Greenhouse board / Add Lever board → `POST …/sources` `{ kind: 'Greenhouse'|'Lever', url: <normalised token/slug>, label? }`. Add Adzuna search → `{ kind: 'Adzuna', label? }`.
  - Choose CSV → size check (1 MB) → `POST /api/v1/imports/preview` `{ campaignId, csv }` → preview. Import N valid rows → `POST /api/v1/imports/:importId/commit` `{ label? }`. Discard → clears the preview.
  - Remove → `window.confirm` → `DELETE /api/v1/campaigns/:id/sources/:sourceId` (found opportunities are kept).
  - Applications page link → `/applications`. Footer: Back → step 2; Continue → step 4.
- **State (reads):** `GET /api/v1/campaigns/:id/sources` (`Source[]`); `campaign.mode` for CSV columns, paste placeholders and which kinds are offered; `campaign.criteria.keywords` / `locations` for the Adzuna explanation; `useShell().capabilities`; local form state.
- **State (writes):** the POST/DELETE calls above; the file is read in the browser (`File.text()`) and sent as text.
- **Navigation out:** `?step=2`, `?step=4`, `/applications`.
- **Validation:** Add pasted text disabled while busy or when the text is blank; text `maxLength` 50 000 with a counter. Add URL / feed disabled while busy or URL blank; URL `required`, `type=url`, `maxLength` 1000; label 200; permission note 500. Greenhouse/Lever: input normalised by `parseBoardInput` (URL → first path segment, embed `?for=`; lower-cased; must match `[a-z0-9-]{1,100}`; other hosts rejected); Add disabled while busy or when it does not parse, with the reason linked to the input. CSV over 1 MB rejected before upload; Import disabled while busy or with 0 valid rows; Discard disabled while busy. Remove disabled for the row being removed. Server `fieldErrors` for `text`/`url` shown under the field.
- **Status:** built — includes Workday public careers-site source (URL normalization, capability truth, first-three-keyword search); live tenant verification remains Y4
- **TODOs:** Discovery provider hard-coded "Not built yet" (OQ-FE-021). Token lower-casing and Greenhouse embed links (`?for=`) are handled client-side only (OQ-FE-037). "India" for Adzuna is fixed in the copy (OQ-FE-038). Greenhouse / Lever / Adzuna built against the contract before the API implemented them (OQ-FE-033).

---

### Campaign builder — Step 4 · Review and run

- **Route:** `/campaigns/:id/edit?step=4`
- **Component:** `src/features/campaigns/ReviewStep.tsx`
- **What it shows:** Review list: Profile (fixed), Mode (fixed), Goal, Criteria (hard filters badged), Result limit, Suggest for approval (Job: "Qualified jobs scoring at least N wait in Approvals" or "Off"), Scoring weights (shares of 100), Sources — each editable item with an Edit link. Source coverage (count, failed last time, discovery provider not built, no workload estimate; max 100 candidates and the result limit). Manual run card with "Queue research run" and an "already queued/running" notice. Scheduled run card ("Schedule setup required", static). Previous runs (latest 5: state, queued time, qualified / to verify / excluded). "View N opportunities" when the campaign has any.
- **Actions:** Edit → step 1/2/3. Queue research run → `POST /api/v1/campaigns/:id/research` → `/research/:jobId` (the API returns the active job instead of a duplicate). "Follow its progress" / previous run → `/research/:jobId`. View opportunities → `/campaigns/:id/opportunities`. Footer: Back → step 3; Save.
- **State (reads):** `GET /api/v1/campaigns/:id/sources`; `GET /api/v1/campaigns/:id/research-jobs` (`ResearchJob[]`, events omitted); draft and saved campaign from the builder.
- **State (writes):** `POST /api/v1/campaigns/:id/research` → `{ jobId }`.
- **Navigation out:** `/research/:jobId`, `/campaigns/:id/opportunities`, `?step=1..3`.
- **Validation:** Queue disabled while queueing or when blocked: unsaved changes ("Save your changes first — a run uses the saved campaign.") or sources loaded and none exist ("Add a source in step 3 first…"); the reason is shown under the button. A ref prevents double submission.
- **Status:** built
- **TODOs:** Scheduling text hard-coded instead of the `scheduler` capability (OQ-FE-020). Discovery provider literal (OQ-FE-021). While sources are still loading the Queue button is not blocked.

---

### Research run — Progress

- **Route:** `/research/:jobId`
- **Component:** `src/features/research/ResearchProgressPage.tsx`; logic in `researchModel.ts` (tested)
- **What it shows:** Campaign name and state badge (Queued, Running, Completed, Completed with gaps, Failed, Cancelled); run ID prefix, queued/started/finished times, time zone. Plain-language state explanation (+ safe error). Polling status line (announced) and last check time. Six stages (Prepare, Gather sources, Extract facts, Filter, Score, Complete) marked done / in progress / not started / stopped, with per-stage counts. Counts: sources processed, items fetched, candidates, qualified (+ to verify, excluded) — no percentage. Event log (latest 100, safe summaries, level badges). Partial results / Results card. Scheduling card (static "Not scheduled"). Link back to the campaign.
- **Actions:** Cancel run (active only) → `window.confirm` → `POST /api/v1/research-jobs/:id/cancel` → polling restarts. View (partial) results / Open list → `/campaigns/:campaignId/opportunities`. Check again (after the 10-minute limit) → restarts polling. Try again on a load error. Back to the campaign → `/campaigns/:id/edit?step=4`.
- **State (reads):** `GET /api/v1/research-jobs/:id` (`ResearchJob` with events) polled every 2 s, backing off ×1.5 to 10 s when unchanged or failing; stops when finished, after 10 minutes, or on 401/403/404; `GET /api/v1/campaigns/:campaignId` for the name.
- **State (writes):** `POST /api/v1/research-jobs/:id/cancel`.
- **Navigation out:** `/campaigns/:campaignId/opportunities`, `/campaigns/:campaignId/edit?step=4`.
- **Validation:** Cancel shown only while Queued/Running; disabled while cancelling or after a cancel was requested ("Cancel requested").
- **Status:** built
- **TODOs:** Scheduling card hard-coded (OQ-FE-020). The host sleeps when idle, so a queued run may wait (explained in the copy, not a defect).

---

### Opportunities — List (Job)

- **Route:** `/opportunities` (campaign from `?campaign=`, default newest) and `/campaigns/:id/opportunities`
- **Component:** `src/features/opportunities/OpportunitiesPage.tsx` (`CampaignOpportunities`, `OpportunityTable`); logic in `opportunityModel.ts` (tested)
- **What it shows:** Campaign select (all modes; "Unknown campaign" for a foreign/unknown id). Per campaign: name, "Latest run" link, Refresh, Export CSV. Filters: Outcome (All, Qualified, Needs verification, Excluded), Status (Any + 9 statuses, including "Awaiting approval" = `Suggested`), Sort (Fit score, Recently updated). Table: title (+ organisation · location), mode (+ platform: LinkedIn, Naukri, Greenhouse, Lever, Adzuna), "Fit N/100" + coverage %, outcome badge + reason + "N not verified", status badge, updated, quick actions. "Showing N of total · sorted and paged by the server", Load more. Empty states for no campaigns, no opportunities, and no filter matches. Note that bulk sending is not offered.
- **Actions:** Change campaign → `?campaign=` (replace) or `/campaigns/:id/opportunities`. Title → `/opportunities/:id`. Quick actions: Suggested → Approve (→ Shortlisted) / Reject (→ Dismissed); New → Shortlist / Dismiss; Shortlisted → Remove from shortlist (→ New) / Dismiss; Dismissed → Restore (→ New); later statuses have none — each `PATCH /api/v1/opportunities/:id/status`, row updated in place and announced. Refresh / filter change → back to page 1. Load more → next page (offset, deduplicated). Export CSV → file download. Latest run → `/research/:jobId`. Empty-state links → `/campaigns/new`, `/campaigns/:id/edit?step=4`.
- **State (reads):** `GET /api/v1/campaigns`; `GET /api/v1/campaigns/:id/opportunities?outcome&status&sort&take=50&skip` (`OpportunityPage`); local filters, appended pages, patched rows.
- **State (writes):** `PATCH /api/v1/opportunities/:id/status` `{ status }`; `GET /api/v1/campaigns/:id/export` (`text/csv`) saved via `saveBlob` with a sanitised file name (`lib/download.ts`); URL `?campaign=`.
- **Navigation out:** `/opportunities/:id`, `/research/:jobId`, `/campaigns/new`, `/campaigns/:id/edit?step=4`, `/campaigns/:id/opportunities`.
- **Validation:** Export disabled while exporting. Quick-action buttons disabled while that row's request runs. Load more shown only while fewer than `total` are loaded; disabled while loading.
- **Status:** built
- **TODOs:** Mobile uses a scrolling table, not the compact cards in `MobileOpportunities.dc.html` (OQ-FE-031).

---

### Opportunity — Detail (Job)

- **Route:** `/opportunities/:id`
- **Component:** `src/features/opportunities/OpportunityDetailPage.tsx`
- **What it shows:** Back link; title, mode and status badges, organisation · location · platform, updated time; "Open posting" and "Open application page" (only http/https via `safeHref`, new tab; for Greenhouse/Lever/Adzuna "Open application page" is always shown when `applyUrl` is usable and "Open posting" only when it differs). Pipeline status card: "Awaiting approval" badge and notice for `Suggested`, quick buttons, "Set status" select + Update, apply-agent notice when the job is Shortlisted on LinkedIn/Naukri ("…on its next `npm run agent -- apply <platform>` run"); for Greenhouse/Lever/Adzuna a notice that you apply yourself (open the application page, then Mark applied) because the agent only applies on LinkedIn/Naukri. Fit score /100 with evidence coverage and outcome. Fit contributions table (criterion, points / weight, Met / Partly / Not met / Unknown, reason, evidence links). Facts (Verified / Inferred / Not verified) and gaps ("No source in this campaign supplied it"). "Text as retrieved" (collapsed). Activity list. Evidence panel (source, link, excerpt, retrieval date, extraction method).
- **Actions:** Approve (Suggested → Shortlisted, primary), Reject (Suggested → Dismissed), Shortlist (New/Dismissed), Dismiss (New/Shortlisted), Mark applied (Job, not Applied; confirm dialog), Set status + Update → `PATCH /api/v1/opportunities/:id/status`; the response replaces the page data, the change is announced and the shell's approval count is refreshed. "Set status" offers every status except `Suggested` (set by research only; shown when it is the current one). Evidence links jump to `#evidence-<id>`. Back → `/campaigns/:campaignId/opportunities`.
- **State (reads):** `GET /api/v1/opportunities/:id` (`OpportunityDetail`); local `chosen` status, `busy`, `error`.
- **State (writes):** `PATCH /api/v1/opportunities/:id/status` `{ status }` (adds an Activity row server-side).
- **Navigation out:** `/campaigns/:campaignId/opportunities`; external posting/application URLs.
- **Validation:** All status buttons disabled while a change runs. Update disabled when the selected status equals the current one. Mark applied requires `window.confirm`.
- **Status:** built
- **TODOs:** No AI "Explain this match" (OQ-FE-007). No cover-note draft (OQ-FE-008). Activity is read-only — logging notes/replies and next actions are M5 (OQ-FE-006). Agent command text hard-coded (OQ-FE-022).

---

### Applications — Agent activity, keys and setup

- **Route:** `/applications`
- **Component:** `src/features/applications/ApplicationsPage.tsx`, `AgentSetup.tsx`, `HowItWorks.tsx`; logic in `applicationStatus.ts` (tested)
- **What it shows:** Stats: Applied (+ last 7 days), Needs you, Dry runs, Last activity. Activity filters (Status: All, Applied, Needs you, Dry run, Skipped, Failed; Platform: All, LinkedIn, Naukri) and a table (role link, company · location, platform, status badge, detail, when) with Load more. Empty state explaining the agent is not connected. "How the apply agent works": five-node diagram (Campaign → Agent collects → Research → You shortlist → Agent applies) with legend, and the per-job outcome path (Skipped, Needs you, Dry run, Applied, Failed). "Apply agent" section: unofficial-automation warning, agent keys (name, prefix, created, last used, Revoke), create-key form, one-time key reveal, seven setup steps with copyable commands, demo-mode note about `npm run agent -- sync`.
- **Actions:** Refresh → reloads summary and restarts the table. Filter change → page 1. Load more → next page. Role link → job URL in a new tab. "Set up the agent" (empty state) → scrolls to and focuses `#apply-agent`. Create agent key → `POST /api/v1/agent-keys` → key shown once. "I have copied it" → hides it. Revoke → `window.confirm` → `DELETE /api/v1/agent-keys/:id`. Copy → clipboard (failure message when blocked).
- **State (reads):** `GET /api/v1/applications/summary` (`ApplicationSummary`); `GET /api/v1/applications?status&platform&take=50&skip` (`ApplicationPage`); `GET /api/v1/agent-keys` (`AgentKey[]`); `useShell().capabilities.temporaryStorage`.
- **State (writes):** `POST /api/v1/agent-keys` `{ name }` → `CreatedAgentKey` (full key returned once, kept only in component state); `DELETE /api/v1/agent-keys/:id`; clipboard.
- **Navigation out:** external job URLs; in-page anchor `#apply-agent`.
- **Validation:** Create disabled while creating or when the name is blank; name `required`, `maxLength` 100, server `fieldErrors.name` shown. Revoke disabled for the key being revoked. Load more shown only while fewer than `total`; disabled while loading.
- **Status:** built
- **TODOs:** `jobUrl` not passed through `safeHref` (OQ-FE-012). Setup commands hard-coded (OQ-FE-022). Instahyre is in the API enum but not offered as a filter (agent does not support it).

---

### Approval queue — Approve suggested jobs in one batch

- **Route:** `/approvals` (optional `?campaign=<id>` filter)
- **Component:** `src/features/approvals/ApprovalQueuePage.tsx`; logic in `src/features/approvals/approvalModel.ts` (tested); "applies via" mapping in `opportunityModel.ts`
- **What it shows:** Intro: what approving does (Suggested → Shortlisted; the agent applies to LinkedIn/Naukri on its next apply run, other sites you open yourself; nothing is applied on approval) and what rejecting does (→ Dismissed, restorable from Opportunities). Campaign filter (All campaigns + the user's Job campaigns; "Unknown campaign" for a foreign id). Total awaiting. Items (`ApprovalItem`, highest score first) grouped by campaign (heading = campaign name + count; groups ordered by their best item). Each group heading has a "Suggestion settings" link to the campaign's step 2. Each item is a card: checkbox, title (link to the opportunity), organisation · location, platform, "Fit N/100" + coverage, outcome reason, "Applies via: your agent (LinkedIn/Naukri)" or "Applies via: you (opens the application page)". Bulk bar: select-all checkbox ("Select all N shown"), "N selected", Approve selected, Reject selected, Approve all N. Result notice with approved / rejected / skipped counts. "Showing N of total" and Load more. Empty state explaining how suggestions appear (turn on "Suggest jobs for approval" in a Job campaign's Filters step), with a link to campaigns (or to that campaign's step 2 when filtered).
- **Actions:**
  - Change campaign → `?campaign=` (replace); "All campaigns" removes it. Selection and loaded pages reset.
  - Tick a row / select all / clear → local selection only.
  - Approve selected → `POST /api/v1/approvals/decide` `{ approve: [...ids], reject: [] }`. Reject selected → `{ approve: [], reject: [...ids] }`. Approve all N (N = items loaded on the page) → `window.confirm` stating the count and what happens → `{ approve: [...all loaded ids], reject: [] }`. Batches over 200 ids are split into several requests and the counts summed. After any decision: counts shown in an `aria-live` notice, selection cleared, list reloaded from page 1, the shell's nav count refreshed.
  - Title → `/opportunities/:id`. Load more → next page (`skip`). Try again on a load error.
  - Empty state → `/campaigns` or `/campaigns/:id/edit?step=2`.
- **State (reads):** `GET /api/v1/approvals?campaignId&take=100&skip` (`ApprovalPage { total, items: ApprovalItem[] }`); `GET /api/v1/campaigns` (`CampaignSummary[]`, Job mode used for the filter); URL `?campaign=`; local selection, extra pages, busy flag, last result.
- **State (writes):** `POST /api/v1/approvals/decide` `{ approve: Guid[], reject: Guid[] }` → `{ approved, rejected, skipped }` (≤ 200 ids per request, never one id in both lists); URL `?campaign=`.
- **Navigation out:** `/opportunities/:id`, `/campaigns`, `/campaigns/:id/edit?step=2`.
- **Validation:** Approve selected / Reject selected disabled while a decision runs or when nothing is selected (hint "Select at least one job"). Approve all disabled while busy or when nothing is loaded; it always confirms first. The payload helper drops duplicate ids and any id that is in both lists. Skipped ids (not owned or no longer Suggested) are reported as skipped, not as errors. Load more shown only while fewer than `total` are loaded.
- **Status:** built — against `CANDIDATE_PHASE1_CONTRACT.md`; not yet verified against a running API (OQ-FE-033)
- **TODOs:** "Approve all" covers the loaded items only (100 per page, Load more for the rest) — the API has no "approve everything matching" call (OQ-FE-036). Nav count freshness (OQ-FE-035). Checked at 375 px on 2026-10-05 against a local stub of the contract, not the real API.

---

### Cover notes — Draft a cover note for a job

- **Route:** none yet (planned as a section of `/opportunities/:id`)
- **Component:** none yet (planned in `src/features/opportunities/` or a new `src/features/drafts/`)
- **What it shows:** (planned, `M4_M5_CONTRACT.md` channel `CoverNote`) A generated cover note for the job: greeting, role, matched required skills, the profile's own offer sentence, availability, with `[placeholders]` for unknowns; the basis of each claim (Profile / Evidence); version, approval state, source (Template or Gemini + fallback reason). AI text on the AI surface.
- **Actions:** Generate → `POST /api/v1/opportunities/:id/drafts { channel: 'CoverNote' }`; edit and save → `PUT /api/v1/drafts/:id` (clears approval); approve → `POST /api/v1/drafts/:id/approve { version }`; revoke approval or delete. The agent fills the approved note only into cover-letter-like free-text fields.
- **State (reads):** `GET /api/v1/opportunities/:id/drafts`.
- **State (writes):** the POST/PUT calls above, `POST /api/v1/drafts/:id/revoke-approval`, `DELETE /api/v1/drafts/:id`.
- **Navigation out:** (planned) none beyond the detail page.
- **Validation:** Approve disabled when the body is empty, has unsaved edits, or the API reports a stale version (409); every disabled control states its blocker (`sendBlockers`). Editing an approved note requires saving before it can be approved again.
- **Status:** built locally — browser verification pending
- **TODOs:** Gemini and other draft channels remain API work (OQ-BE-006/OQ-BE-007). Sending remains blocked until Gmail (M6). Full live LinkedIn/Naukri selector verification remains OQ-BE-001.

### Update 2026-10-05 — MVP research rules
- **Builder step 2 (Job)**: hard filters gain "Exclude staffing agencies" (checkbox → `criteria.excludeStaffingAgencies`) and "Only postings from the last N days" (1–365, empty = off → `criteria.maxPostingAgeDays`). Both shown in the step-4 review.
- **Opportunity detail**: each fit-contribution row shows the exact sentence that justified the verdict (`breakdown[].excerpt`), styled as quoted evidence; nothing shown when the verdict is Unknown.

### Update 2026-10-06 — design round 3 (layout; same API calls, same rules)

Designs: `../opportunitypilot-ui/` (`Campaigns`, `Campaign*`, `ResearchProgress`, `Opportunities`, `OpportunityDetail`, `Approvals`, `Applications`, `Mobile*`). Where an entry above disagrees on layout, this section wins.

- **Campaigns — List:** mode chips (All / Jobs / Customers with counts; `filterCampaigns`, `campaignFilterCounts`), panel "All campaigns · N running" with + New campaign; columns Campaign, Mode, Sources, Found, Suggest at, Last run, Status, next step ("Progress" while the latest run is queued/running — `isRunning` — otherwise "Run now" → step 4). Two explainer panels: Jobs campaigns feed Approvals; Customers campaigns stop at the shortlist. Empty: `EmptyState` with the four steps.
- **Campaign builder (all steps):** wide page; stepper shows ✓ on finished steps; the step heading is visually hidden (still the focus target); step content is laid out as panels in a responsive grid; sticky save bar "Saving is not running. A run is queued only on step 4." Step 1 adds a "What this mode will do" panel (four numbered lines per mode) above the criteria summary. Step 4 shows "Loading…" instead of "Profile not found" while profiles load.
- **Opportunities — List:** toolbar of pill selects (Campaign, Outcome, Status, Sort) + search box + Refresh + Export CSV. Search filters **only the rows already loaded** (`searchLoaded`; the API has no search) and says so. Header action "Go to approvals · N" when suggestions wait. Panel "N opportunities" with qualified / suggested / excluded counts of loaded rows. Columns: select, Opportunity, Mode, Fit (number + meter; "—" for Excluded), Evidence (coverage meter, amber below 70%), Outcome, Status, Updated, one next step (`primaryAction`: Approve, Shortlist, Restore, Open posting, Review). Selection bar: N selected · Shortlist · Dismiss · Export selection (client-side CSV, `selectionCsv`); rows whose status does not allow the move are skipped and counted (`canMoveTo`). No bulk send or apply.
- **Opportunity — Detail:** header badges Mode · Outcome · Status, "Open posting ↗" inline, decision buttons in the header (Reject/Dismiss, Restore, Shortlist, "✓ Approve — adds to shortlist"). Three columns: score card (fit, meter, coverage, reason) + "What is still unknown" (unknown criteria and gaps, link to add a source) + Facts | "How the score was built" (criterion, verdict, points with meter, the matched sentence or reason, evidence links; total line; text as retrieved) | Evidence, Activity, "Applies via" and Open application page, Set status.
- **Approval queue:** pill campaign select; selection bar with "✓ Approve selected · N", Reject selected, Approve all; one panel per campaign ("NAME · N suggested", threshold, Suggestion settings) with a table: Job, Platform, Fit meter, Evidence meter, Why it was suggested, Applies via ("Your agent" / "You apply").
- **Applications:** KPI strip (Applied, Needs you, Dry run, Failed, Skipped, Last activity); "Agent results" panel with Status/Platform pill filters beside the agent setup panel; "How the apply agent works" below. Header: Refresh, Agent setup.
- **Phones (< 860 px):** opportunity and approval tables render each row as a card (title, fit on the right, then badges and meters).

### Update 2026-10-08 — Indeed campaign source (W17)

Campaign builder step 3 offers **Indeed job search** (Job campaigns only), next to Adzuna. The form shows what will be
searched (first 3 job titles/phrases, first location that is not "Remote"), warns when the server has no JSearch key,
and adds a source with no URL (`POST /api/v1/campaigns/{id}/sources { kind: "Indeed" }`). Runs list Indeed postings in
Opportunities with platform "Indeed"; they are scored, suggested to Approvals and applied to on Indeed.

### My interviews — rounds for jobs you applied to (2026-10-15)

- **Who:** Candidate. **Route:** `/interviews` (rail → Work → My interviews, Advanced); per job on the opportunity page (job leads) as the "Interviews" card.
- **API:** `GET /api/v1/interviews[?opportunityId=]`, `POST /api/v1/opportunities/{id}/interviews`, `PUT /api/v1/interviews/{id}`,
  `POST /api/v1/interviews/{id}/status`, `DELETE /api/v1/interviews/{id}`.
- **Shows:** KPIs (coming up, next 7 days, done, jobs), then cards (coming up soonest first, then past): job · round, status word, time, notes, Join link.
- **Actions:** Add (on the job page: when, join link, notes; the round counts up), Edit, Mark done / Missed / Cancel (done and missed need a time), Undo, Remove (confirms).
  Typed in by you; nothing is read from a calendar or sent.
- **Status:** built.
