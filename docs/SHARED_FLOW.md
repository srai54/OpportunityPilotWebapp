# Shared flow — screens used by both Candidate and Sales users

Each entry follows the flow-doc template: Route, Component, What it shows, Actions, State (reads), State (writes), Navigation out, Validation, Status, TODOs. `Status` is flipped only by `/build-screen`. Role-specific screens: `docs/CANDIDATE_FLOW.md`, `docs/SALES_FLOW.md`. Route index: `docs/SCREEN_MAP.md`. Gap IDs refer to `docs/open-questions.md`.

There is no user-role concept yet: every signed-in user sees the same navigation (OQ-FE-003).

---

### Accounts — Sign in, Create account, Verify email, Reset password, Onboarding (design round 3)

- **Route:** while signed out, `AuthGate` (`src/App.tsx`) picks the screen from the URL (`authScreenFor` in `authModel.ts`): `/signup`, `/verify?email=`, `/reset`, `/reset/new`; any other URL shows Sign in, so deep links survive sign-in. Signed in on an account-only URL → redirect to `/`. A Supabase password-recovery link (`PASSWORD_RECOVERY`) shows "Choose a new password" first. First signed-in visit in a browser (`op.onboarded` unset) shows Onboarding.
- **Component:** `src/features/auth/` — `AuthLayout.tsx` (two panels: dark story panel hidden under 860 px, form card; `PasswordField` with Show/Hide and strength meter; `GoogleButton` with a neutral placeholder mark), `SignInPage.tsx`, `SignUpPage.tsx`, `VerifyEmailPage.tsx`, `ResetPasswordPage.tsx` (request + `NewPasswordPage`), `OnboardingPage.tsx`; logic in `authModel.ts`; session in `AuthProvider.tsx`.
- **What it shows:**
  - Sign in: **supabase** — Continue with Google, email, password (Forgot? → `/reset`), "Keep me signed in on this device" (default on), Sign in, "No account needed" → Continue as guest, "New here? Create an account". **guest** (no Supabase keys) — notice "Accounts are not switched on for this deployment yet", Continue as guest (primary). **dev** — dev name field. Footnote about the API waking. **Hanko on** (`VITE_HANKO_API_URL`, any mode): title "Sign in or create an account", Hanko's `<hanko-auth>` (passkey, password or email code, then the account's second factor; it also signs up), then "Use the older sign-in (Supabase)" (or "Use the development sign-in") → `/signin?with=classic`, which shows the form above plus "Back to sign-in with a passkey"; Continue as guest stays below. `/signup` without Supabase redirects to sign-in.
  - Create account: Google, full name, work email, password with strength (12+ characters), consent stating what is stored (required). The result never reveals whether an email already has an account; both new and existing addresses go to the same check-email screen. Without Supabase keys: notice + "Continue as guest instead".
  - Verify email: address, "Not arrived?" reasons, Resend with a 60 s countdown, Use a different email.
  - Reset: email → same confirmation whether or not the account exists. New password: password + confirm, "Sign out of all other devices" (default on).
  - Onboarding: progress (Your account ✓ · Pick a workspace · Seed a profile), Candidate (Built) / Sales (Partly built) cards, "Next, in 60 seconds", Skip for now / Continue to profile.
- **Actions:** Google → `signInWithOAuth` (redirect to origin; needs the Google provider enabled in Supabase); Sign in → `signInWithPassword`; Create → `signUp` (→ `/verify` when no session); Resend → `auth.resend`; Send reset link → `resetPasswordForEmail` (redirect `/reset/new`); Set password → `updateUser` (+ `signOut({ scope: 'others' })`); Continue as guest → `POST /api/v1/auth/guest` with wake-up retries (404 → "Guest access is switched off"); Onboarding → writes `op.workspace` + `op.onboarded`, opens `/profiles` or `/`.
- **State (reads):** `useAuth()`; build-time Supabase keys; localStorage `op.guestToken` (JSON token + server expiry), `op.devUser`, `op.keepSignedIn`, `op.onboarded`.
- **State (writes):** guest token + expiry (expired/legacy token-only records are discarded); Supabase session in localStorage, or sessionStorage when "Keep me signed in" is off (`src/lib/supabase.ts`; switching clears stale copies); `op.keepSignedIn`, `op.workspace`, `op.onboarded`. Before an API call, a Supabase access token within 60 seconds of expiry is refreshed once and concurrent callers share that refresh.
- **Navigation out:** on sign-in the same URL renders inside `AppShell`; links between the account screens.
- **Validation:** email required; password ≥ 12 on create/reset; confirm must match; consent required.
- **Status:** built
- **TODOs:** real accounts need U1 (Supabase keys on Render + Vercel) and, for Google, the Google provider in Supabase plus Google's official button asset.

### Shell — Navigation rail, top bar, API status, banners

- **Route:** wraps every signed-in route (`AuthGate` → `AppShell` → `<Outlet/>`).
- **Component:** `src/features/shell/AppShell.tsx`, `src/features/shell/ShellContext.tsx`; nav table and pure helpers in `src/features/shell/shellModel.ts` (tested in `shellModel.test.ts`); line icons in `src/components/icons.tsx`. Pages render their heading block with `src/components/PageHeader.tsx`.
- **What it shows:** Skip link. Left rail (232 px, deep navy; design `Main.dc.html`): brand mark (target-like line SVG, `--op-brand-accent`) + "OpportunityPilot"; nav items, each an inline SVG line icon (`stroke="currentColor"`, `aria-hidden`) plus a text label, grouped under small section labels (each group is a `<ul>` named by its label) — **Find**: Overview, Campaigns, Opportunities · **Decide**: Approvals · **Act**: Applications, Outreach, Follow-ups · **Setup**: Profiles, Sources & integrations, Settings. The rail depends on the workspace (`navGroupsFor` in `shellModel.ts`, design `WorkspaceSwitcher`): **Candidate** as above; **Sales** — Overview · Find: Campaigns, Projects & tenders, Companies (`/opportunities`) · Decide: Approvals · Act: Proposals & bids, Outreach (Soon) · Track: Bids sent, Follow-ups (Soon) · Set up. The workspace button opens a light popover "Switch workspace": Candidate (Built) / Sales (Partly built) with a check on the current one, and a note that switching changes the rail and never hides data. Counts, only from `GET /api/v1/overview` and only once known: Campaigns (`overview.campaigns`, muted, when > 0; "N campaigns" for screen readers), Approvals (`overview.awaitingApproval`, teal badge, when > 0; "N awaiting approval"), Applications (`overview.needsManual`, warning colour, when > 0; "N need you"). Opportunities has no count — the Overview DTO has no total-opportunity figure (`shortlisted` is a different number; OQ-FE-039). Outreach and Follow-ups carry a "Soon" chip ("not built yet" for screen readers). Active item: lighter navy background, white text, `aria-current="page"`. Rail footer: status dots always paired with words — "API · checking / starting / online / database unavailable" and, when the capability exists, "Gmail · connected / disabled / not connected". Top bar (60 px; 52 px under 860 px): menu button (icon-only, "Open navigation menu", under 860 px only), page title `<h1>` from the route `handle.title` (also `document.title`), then on the right the AI mode pill ("Gemini active" / "Gemini key set · unverified" / "Rules mode · no AI key", hidden under 860 px), the theme button (icon only; cycles System → Light → Dark, label says the current and next choice; `ThemeToggle.tsx`, logic in `themeModel.ts`) and the account avatar (initials) with its menu (email, Sign out). Banners below the top bar: "Starting the API service…" while unreachable; "Demo mode." when capabilities report `temporaryStorage` or `guestSignIn`; danger banner when health is degraded.
- **Actions:**
  - Nav link → its route (active link styled by `NavLink`).
  - Menu button (under 860 px) → opens the rail as a modal drawer: focus moves to the current page's link in the drawer, the rest of the page is `inert`, Tab stays inside the drawer, body scroll is locked. Close button in the drawer, Escape, scrim click or choosing a link closes it and returns focus to the menu button; any route change or widening past 860 px also closes it.
  - Avatar → opens the account menu; Escape or outside click closes it. Sign out → clears the session (see Settings) → sign-in screen.
- **State (reads):** `GET /health/ready` polled with backoff (4 s doubling to 20 s for 8 retries, then every 30 s) → `ApiStatus`; `GET /api/v1/capabilities` via `useApi` once status is ready or degraded, shared through `ShellContext` (`capabilities`); `GET /api/v1/overview` once the API is ready, for the rail counts, shared as `awaitingApproval` with `refreshOverview()` (called by the approval queue and the opportunity screens after a status change); `useAuth()` → `user`; `useMatches()` for the title; `matchMedia('(max-width: 860px)')`; local state: drawer and account menu, each keyed by the pathname it was opened on (so a route change closes it without an effect).
- **State (writes):** theme: `localStorage["op-theme"]` and `<html data-theme>` (removed for System; the inline boot script in `index.html` applies it before CSS loads); `document.title`; `document.body.style.overflow` while the drawer is open; sign out (see Settings). No API writes.
- **Navigation out:** every nav route; sign-in screen after Sign out.
- **Validation:** none (no forms). Unreachable API → "waking"; any other failure → "degraded".
- **Status:** built
- **TODOs:** Outreach and Follow-ups link to not-built placeholders (OQ-FE-005, OQ-FE-006). Gmail/Gemini labels assume today's statuses (OQ-FE-011). Same nav for both roles (OQ-FE-003). No Opportunities count (OQ-FE-039). The design's top-bar profile switcher and "N job running" pill have no API/concept yet (OQ-FE-031). Counts are fetched once per session and refreshed only after approval/status changes made in this tab (OQ-FE-035).

---

### Overview — Your opportunity workspace

- **Route:** `/` (index)
- **Component:** `src/features/overview/OverviewPage.tsx`
- **What it shows:** (design round 3, `analyticsModel.ts`) **First run** (0 profiles and 0 campaigns): "Which job are you here to do?" Candidate/Sales cards that switch the workspace, three steps (Create a profile → Add sources → Run a campaign), the sample-run card (Candidate), zero tiles and a note that tiles stay at zero rather than sample data. **Candidate**: KPI strip (Waiting on you, Shortlisted, Applied · 30 days, Responded, Qualify rate, Agent needs you), pipeline funnel with % of previous, fit-score histogram with the suggest threshold, "Why qualified jobs stall" (most-often-Unknown criteria), source performance table, Needs your attention (links), applications sent in the last 14 days; sample-run card while there is no activity; running research notice. **Sales**: KPIs (Companies found, Qualified, Shortlisted, Contacted —, Responded — "Outreach not built"), Sales pipeline, "What is missing to finish the job" (not built), qualified by industry, buying signals, source performance; with no Customers campaign an empty state offering to build one. All figures from `GET /api/v1/analytics/overview?workspace=…&days=30`; loading skeleton / waking / error card from `States`.
- **Actions:** Add profile / Review profiles → `/profiles`; Set up agent → `/applications`; New campaign → `/campaigns/new`; stat links → `/campaigns`, `/approvals`, `/opportunities`, `/applications`; "All sources and integrations" → `/integrations`; Try again on an error → reload.
- **State (reads):** `GET /api/v1/overview` (`Overview`: profiles, applied, needsManual, campaigns, shortlisted, awaitingApproval) via `useApi`; `GET /api/v1/demo/sales` for the owner-scoped fictional Sales demo; `useShell().capabilities`.
- **Sales demo:** One action creates four clearly labelled fictional Sales campaigns and queues normal research. The card polls stored status and, when research is terminal, finishes the shortlists, channel-specific drafts, follow-ups, approved proposal and staffing interview automatically. It links to the real Companies and Outreach screens. Reset asks for confirmation and deletes only the current owner's `Demo —` records. No external message, bid or application is sent.
- **State (writes):** sample run only: `POST /api/v1/profiles` → `POST /api/v1/campaigns` → `POST /api/v1/campaigns/{id}/sources` ×2 → `POST /api/v1/campaigns/{id}/research`.
- **Navigation out:** `/research/{jobId}` (after the sample run starts), `/profiles`, `/applications`, `/campaigns/new`, `/campaigns`, `/approvals`, `/opportunities`, `/integrations`.
- **Validation:** none. Primary/secondary button emphasis only (step 1 primary until a profile exists; step 3 primary when a profile exists and no campaign does).
- **Status:** built
- **TODOs:** Not role-aware — the apply-agent step is shown to sales users (OQ-FE-003). Design `Main.dc.html` items missing: goal input, active research, recent opportunities, review queue, follow-ups (OQ-FE-031). M5 will add `draftsAwaitingReview` and `followUpsDue` (OQ-FE-028).

---

### Profiles — List and versioned editor

- **Route:** `/profiles` (redirects to the newest profile, or `/profiles/new` when there are none), `/profiles/new`, `/profiles/:id`
- **Component:** `src/features/profiles/ProfilesPage.tsx`; field definitions and pure logic in `src/features/profiles/profileFields.ts` (tested in `profileFields.test.ts`)
- **What it shows:** (design round 3 `Profiles` + `ProfileNew`) Edge-to-edge two panels. Left (232 px, collapsible with "Hide this list", stored in `op.profilesListHidden`): "Profiles · N", + New, cards (name, type badge, version · date · confirmed / claims to confirm), empty card "No profiles yet". Create (`/profiles/new`): type as one row of four cards (Candidate, Services, Product, Business), Profile name, the offer and non-claim fields, a note that claims come after saving; sticky bar Cancel / Create profile (needs name + offer). Edit: header (name, type badge, "N claims to confirm", version · saved date · unsaved changes), tabs Details (two-column grid capped at 1000 px: name, read-only type, fields; skills as chips; inline Confirmed / Confirm chip per claim) · Claims (each claim with its confirm toggle; missing ones say they stay missing) · Summary (own words joined) · Versions (current version only — OQ-FE-042); sticky bar "Saving writes version N+1", Discard changes, Save as version N+1.
- **Actions:**
  - Profile card → `/profiles/:id`. New → `/profiles/new`.
  - Edit a field → clears that field's confirmation. Tick confirm → marks the claim confirmed.
  - Create profile → `POST /api/v1/profiles` → list reloads → `/profiles/:id` (replace).
  - Save version N+1 → `PUT /api/v1/profiles/:id` → list and profile reload.
  - Discard changes → restores the loaded version.
  - Leaving with unsaved edits → `window.confirm`; closing the tab → browser warning.
- **State (reads):** `GET /api/v1/profiles` (`ProfileSummary[]`); `GET /api/v1/profiles/:id` (`Profile`); local state type, name, data `{ fields, confirmations }`, dirty flag, field errors.
- **State (writes):** `POST /api/v1/profiles` `{ type, name, data, confirmed }`; `PUT /api/v1/profiles/:id` `{ name, data, confirmed, expectedVersion }`. `confirmed` = every filled confirmable claim is confirmed and at least one exists.
- **Navigation out:** `/profiles/:id`, `/profiles/new`; any nav route (guarded by `useBlocker` while dirty).
- **Validation:** Create/Save disabled when nothing changed, while saving, or when Name is blank. Discard disabled when nothing changed or while saving. Name `maxLength` 200. Type is fixed after creation. A 409 shows "…Your edits are still here — copy anything you need, then reload." Server `fieldErrors.name` / `fieldErrors.data` shown under the fields.
- **Status:** built
- **TODOs:** No version history view (design `Profiles.dc.html`, OQ-FE-031). `data` shape not pinned in the API (OQ-FE-029). Summary copy mentions Gemini, which is not built (OQ-FE-007).

---

### Sources & integrations — Capability list

- **Route:** `/integrations`
- **Component:** `src/features/integrations/IntegrationsPage.tsx`
- **What it shows:** Environment, Database and AI mode facts; capabilities grouped by category (Core, AI, Sources, Outreach, Platforms, Optional, then any other), each with name, status badge (`StatusBadge`: Ready, Configured · unverified, Not configured, Disabled, Manual handoff, Not built yet, Local agent · beta), detail text, "can" and "cannot yet" lists. Secrets are never shown.
- **Actions:** Try again on an error → reload. Nothing else.
- **State (reads):** `GET /api/v1/capabilities` (`Capabilities`) via its own `useApi` call (not the shell context).
- **State (writes):** none.
- **Navigation out:** none (nav only).
- **Validation:** none.
- **Status:** built
- **TODOs:** Gemini usage (`GET /api/v1/ai/status`) not shown (OQ-FE-007). No setup actions for unconfigured items.

---

### Settings — Account and deployment facts

- **Route:** `/settings`
- **Component:** `src/features/settings/SettingsPage.tsx`
- **What it shows:** Account: signed-in email (or "Guest" / dev name), sign-in method (Supabase / Development sign-in (local only) / Guest (demo mode)), browser time zone. Deployment: API base URL (`config.apiBaseUrl`), environment, database, AI mode (from capabilities, "—" until loaded). Outreach safety: three fixed rules (per-version approval, no sending to unsourced addresses, demo data labelled). Read-only.
- **Security (2026-10-14):** Hanko users see Hanko's `<hanko-profile>` (emails, password, passkeys, authenticator app, security keys); Supabase users see the authenticator-app card; guests and dev see none. Sign-in method reads "Hanko (passkey, password or email code)" for Hanko users.
- **Actions:** Sign out → Hanko `logout()` (Hanko session) and Supabase `signOut` (supabase mode) and removal of `op.devUser` / `op.guestToken` → sign-in screen.
- **State (reads):** `useAuth()` → `user`, `mode`; `useShell().capabilities`; `config.apiBaseUrl`; `Intl` time zone.
- **State (writes):** localStorage `op.devUser`, `op.guestToken` removed; Supabase session cleared.
- **Navigation out:** sign-in screen after Sign out.
- **Validation:** none.
- **Status:** built
- **TODOs:** Stale "(M2)" copy; research defaults not editable (OQ-FE-023). "Outreach safety" states per-version approval, which conflicts with the batch-approval decision (OQ-FE-001).

---

### Not found — There is no page at this address

- **Route:** `*` inside the signed-in shell
- **Component:** `NotFound` in `src/App.tsx`
- **What it shows:** Empty state "There is no page at this address".
- **Actions:** Go to overview → `/`.
- **State (reads):** none.
- **State (writes):** none.
- **Navigation out:** `/`.
- **Validation:** none.
- **Status:** built
- **TODOs:** none.

---

### Not built placeholder — milestone notice (component, not a screen)

- **Route:** used by `/outreach` and `/follow-ups` (see `docs/SALES_FLOW.md`)
- **Component:** `src/features/placeholder/NotBuiltPage.tsx`
- **What it shows:** The planned screen's heading and description, "Not built yet — milestone M#", a statement that nothing is simulated and where the designs are.
- **Actions:** Go to profiles → `/profiles`.
- **State (reads):** props only (`heading`, `milestone`, `description`).
- **State (writes):** none.
- **Navigation out:** `/profiles`.
- **Validation:** none.
- **Status:** built
- **TODOs:** Remove its use from a route when the real screen is built.

### Update 2026-10-06 — design round 3: Sources & integrations, Settings, How it works

- **Sources & integrations:** header shows counts (Ready / Not configured / Not built yet); capabilities are cards in a grid per category, each with ✓ can / — cannot lists and, where the app itself can act, one action (`CARD_ACTIONS`: Manage boards → Campaigns, Set up the agent → Applications, Add to a campaign). No action for things only server configuration can change.
- **Settings:** two columns. Left: Account (signed in as, sign-in method, **Workspace** select — the same per-browser preference as the rail switcher, time zone from the browser) and Display (theme System/Light/Dark). Right: "Rules that cannot be switched off" (five product guarantees, each "Always on") and "This deployment" (web host, API URL, environment, database with a "temporary" badge in demo mode, AI mode, idle behaviour) with Sign out. Default profile, date format and time-zone override from the design are **not** offered: nothing would store them (no dead controls).
- **How it works** (`/how-it-works`, rail Set up → How it works, `src/features/guide/`): the pipeline in nine steps (what happens, where you see it, with links), "How to check each source worked" (what you add, the event-log line written when it worked — wording taken from the API's research runner — and what it needs), "What it does not do", and the sample-run card (Candidate) or a Customers-campaign prompt (Sales). Static text; no figures.
