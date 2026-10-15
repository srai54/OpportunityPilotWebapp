# Screen map

Every route in `src/App.tsx`, plus planned screens that have a flow-doc entry but no route. Status mirrors the flow doc and is changed only by `/build-screen` (or `/resolve-oq` when an OQ changes a route). All signed-in routes render inside `AppShell`.

Last updated: 2026-10-06 (design round 3).

| Route | Component | Flow doc → entry | Status |
|---|---|---|---|
| any URL, signed out | `src/features/auth/SignInPage.tsx` | `docs/SHARED_FLOW.md` → Accounts | built |
| `/signup`, `/verify`, `/reset`, `/reset/new` (signed out) | `src/features/auth/SignUpPage.tsx`, `VerifyEmailPage.tsx`, `ResetPasswordPage.tsx` | `docs/SHARED_FLOW.md` → Accounts | built |
| first signed-in visit | `src/features/auth/OnboardingPage.tsx` | `docs/SHARED_FLOW.md` → Accounts | built |
| (wraps every signed-in route) | `src/features/shell/AppShell.tsx` | `docs/SHARED_FLOW.md` → Shell | built |
| `/` | `src/features/overview/OverviewPage.tsx` | `docs/SHARED_FLOW.md` → Overview | built |
| `/profiles`, `/profiles/new`, `/profiles/:id` | `src/features/profiles/ProfilesPage.tsx` | `docs/SHARED_FLOW.md` → Profiles | built |
| `/integrations` | `src/features/integrations/IntegrationsPage.tsx` | `docs/SHARED_FLOW.md` → Sources & integrations | built |
| `/settings` | `src/features/settings/SettingsPage.tsx` | `docs/SHARED_FLOW.md` → Settings | built |
| `*` | `NotFound` in `src/App.tsx` | `docs/SHARED_FLOW.md` → Not found | built |
| `/campaigns` | `src/features/campaigns/CampaignsPage.tsx` | `docs/CANDIDATE_FLOW.md` → Campaigns — List | built |
| `/campaigns/new`, `/campaigns/:id/edit` (`?step=1`) | `src/features/campaigns/CampaignBuilder.tsx` + `GoalStep.tsx` | `docs/CANDIDATE_FLOW.md` → Step 1; Customer: `docs/SALES_FLOW.md` → Customer specifics | built |
| `…?step=2` | `CampaignBuilder.tsx` + `FiltersStep.tsx` | `docs/CANDIDATE_FLOW.md` → Step 2; `docs/SALES_FLOW.md` → Customer specifics | built |
| `/campaigns/:id/edit?step=3` | `CampaignBuilder.tsx` + `SourcesStep.tsx` (+ `JobBoardSources.tsx`) | `docs/CANDIDATE_FLOW.md` → Step 3; `docs/SALES_FLOW.md` → Customer specifics | built |
| `/campaigns/:id/edit?step=4` | `CampaignBuilder.tsx` + `ReviewStep.tsx` | `docs/CANDIDATE_FLOW.md` → Step 4; `docs/SALES_FLOW.md` → Customer specifics | built |
| `/research/:jobId` | `src/features/research/ResearchProgressPage.tsx` | `docs/CANDIDATE_FLOW.md` → Research run — Progress | built |
| `/opportunities`, `/campaigns/:id/opportunities` | `src/features/opportunities/OpportunitiesPage.tsx` | `docs/CANDIDATE_FLOW.md` → Opportunities — List (Job); `docs/SALES_FLOW.md` → Opportunities — List (Customer) | built |
| `/opportunities/:id` | `src/features/opportunities/OpportunityDetailPage.tsx` | `docs/CANDIDATE_FLOW.md` → Opportunity — Detail (Job); `docs/SALES_FLOW.md` → Opportunity — Detail (Customer) | built |
| `/approvals` | `src/features/approvals/ApprovalQueuePage.tsx` | `docs/CANDIDATE_FLOW.md` → Approval queue | built — against the phase-1 contract, API not verified (OQ-FE-033) |
| `/applications` | `src/features/applications/ApplicationsPage.tsx` (+ `AgentSetup.tsx`, `HowItWorks.tsx`) | `docs/CANDIDATE_FLOW.md` → Applications | built |
| `/wellfound` | `src/features/wellfound/WellfoundPage.tsx` + `IndeedSearchPanel.tsx` | Candidate/Sales flow → Job discovery — Wellfound and Indeed | public Wellfound research + official Indeed search handoff built; provider-authorized private feeds pending |
| `/outreach` | `src/features/placeholder/NotBuiltPage.tsx` (M5 placeholder) | `docs/SALES_FLOW.md` → Outreach — Inbox and draft editor | not built |
| `/follow-ups` | `src/features/placeholder/NotBuiltPage.tsx` (M7 placeholder) | `docs/SALES_FLOW.md` → Follow-ups | not built |
| `/projects`, `/projects/:id` (Sales rail) | `src/features/sales/SalesProjectsPage.tsx`, `SalesProjectDetailPage.tsx` | `TASKS.md` R11 / N5 | manual project list + bid draft/approval built; provider ingestion and placement remain |
| `/proposals`, `/bids` (Sales rail) | `src/features/sales/SalesProposalsPage.tsx`, `SalesBidsPage.tsx` | `docs/SALES_FLOW.md` → Proposal drafts / Freelancer.com bids | manual proposal review and provider-confirmed bid tracking built; placement remains pending |
| `/how-it-works` | `src/features/guide/HowItWorksPage.tsx` | `docs/SHARED_FLOW.md` → Update 2026-10-06 | built |
| — (section of `/opportunities/:id`) | — | `docs/CANDIDATE_FLOW.md` → Cover notes | not built |
| — (no route) | — | `docs/SALES_FLOW.md` → Proposal drafts | not built |
| — (no route) | — | `docs/SALES_FLOW.md` → Freelancer.com bids | not built |
| — (no route) | — | `docs/SALES_FLOW.md` → Batch approval | not built |

Navigation rail (`navGroupsFor` in `src/features/shell/shellModel.ts`): **Candidate** — Overview · Find: Campaigns, Opportunities, Job discovery · Decide: Approvals · Act: Applications, Outreach · Track: Follow-ups · Set up: Profiles, Sources & integrations, Settings, How it works. **Sales** — Overview · Find: Campaigns, Projects & tenders, Hiring signals, Companies (`/opportunities`) · Decide: Approvals · Act: Proposals & bids, Outreach · Track: Bids sent, Follow-ups · Set up (same).

### Update 2026-10-08

| Route | Component | Status |
|---|---|---|
| `/staffing` | `src/features/staffing/StaffingDealsPage.tsx` | built |
| `/staffing/deals/:id` | `src/features/staffing/StaffingDealPage.tsx` (+ `DealWorkPanels.tsx`, `ConversationPanel.tsx`) | built |
| `/staffing/candidates` | `src/features/staffing/StaffingCandidatesPage.tsx` | built |
| `/staffing/interviews` | `src/features/staffing/StaffingInterviewsPage.tsx` | built |
| `/interviews` | `src/features/interviews/MyInterviewsPage.tsx` | built |
| `/staffing/rate-cards` | `src/features/staffing/StaffingRateCardsPage.tsx` | built |
| `/wellfound` (Job discovery / Hiring signals) | `src/features/wellfound/WellfoundPage.tsx` + `BoardSearchPanel.tsx` (Indeed, LinkedIn, SEEK tabs) | built |

Sales rail gains a **Staffing** group (Deals, Candidates, Rate cards). Outreach, Follow-ups, Projects, Proposals and Bids are
built; the top bar no longer marks them "Not built yet".
