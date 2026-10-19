# Product

What the product must do (functional and software requirements) and the project reference, merged on 2026-10-19. Screen-by-screen behaviour lives in the flow docs (CANDIDATE_FLOW, SALES_FLOW, SHARED_FLOW, SCREEN_MAP).

Contents:
- [Functional requirements (FRD)](#functional-requirements-frd)
- [Software requirements (SRS)](#software-requirements-srs)
- [Project reference](#project-reference)

---

<!-- merged from docs/FUNCTIONAL_REQUIREMENTS.md on 2026-10-19 -->

## Functional requirements (FRD)

_2026-10-13 · version 1 · what the product must do, for whom, and where each requirement stands today. Status words: **Built** (code + tests), **Partial**, **Planned**. "Verified" says what was actually run; anything not listed as verified was not run._

### 1. Purpose and users

OpportunityPilot finds opportunities from sources the user chooses, scores them against criteria with the evidence shown, and helps the user act on them. **The user approves every outreach or application; nothing is sent or applied on its own.**

| User | Goal | Workspace |
|---|---|---|
| **Candidate** | Find jobs, shortlist, apply, reach out, follow up | Candidate |
| **Sales team** | Find companies and leads, reach out, follow up, track | Sales |

Both share one pipeline: **Find → Review → Reach out / Apply → Follow up**. Automation level: **batch approval** (approve many at once, each message still reviewed or approved by exact version).

### 2. Functional requirements

#### 2.1 Accounts and access
| ID | Requirement | Status |
|---|---|---|
| FR-A1 | A person can register with email + password; credentials are stored and verified by Supabase Auth (the app never stores passwords) | Built (needs Supabase keys, task U1; not verified live) |
| FR-A2 | Email verification and password reset | Built (same dependency) |
| FR-A3 | Sign in with Google | Built (needs Supabase provider setup) |
| FR-A4 | Sign in with Microsoft | Built (button + Supabase `azure` provider); needs the provider switched on in Supabase; not verified live |
| FR-A5 | Second factor with an authenticator app (TOTP): setup in Settings → Security, code prompt after sign-in | Built; not verified against Supabase |
| FR-A6 | Guest access (demo, data tied to the browser, expires) | Built, verified locally |
| FR-A7 | Each person sees only their own data | Built (owner id on every row), integration-tested |
| FR-A8 | Export and delete all my data | Built |

#### 2.2 Profile and campaigns
| ID | Requirement | Status |
|---|---|---|
| FR-P1 | Write a profile (what I offer, skills, availability); versions are kept | Built |
| FR-P2 | Messages use only claims the person confirmed | Built, integration-tested |
| FR-P3 | A campaign holds criteria, sources and weights; it can run on a schedule | Built (server schedule); agent scheduling Planned (see plan) |

#### 2.3 Finding opportunities
| ID | Requirement | Status |
|---|---|---|
| FR-F1 | Search LinkedIn, Indeed, SEEK through JSearch (200 searches/month) | Built; live JSearch not re-run this session |
| FR-F2 | **All sites** search: free feeds (Arbeitnow, Jobicy, We Work Remotely, Remotive, Remote OK) merged, de-duplicated, ranked, labelled by source | Built, verified live (5 feeds) |
| FR-F3 | Company career boards: Greenhouse, Lever, Ashby, SmartRecruiters, Recruitee, Workable, Workday | Built |
| FR-F4 | Regional boards through RapidAPI (Bayt, Naukri Gulf, JobStreet, StepStone, and any added later by configuration) | Built as a config-driven reader; **off until the owner sets a key and field map**; not verified live |
| FR-F5 | Pasted lists, CSV, web pages, feeds; Wellfound public jobs | Built |
| FR-F6 | Filters: remote, location, visa/relocation text, pay shown | Built |
| FR-F7 | Local agent collects from LinkedIn/Naukri/InstaHyre in the user's own browser | Built; never run against the live sites (U3) |

#### 2.4 Review and decide
| ID | Requirement | Status |
|---|---|---|
| FR-R1 | Each job or lead shows score, evidence and gaps; unknown is never counted as a pass | Built |
| FR-R2 | Card list with select, bulk Approve / Skip / Draft messages | Built, verified in Edge |
| FR-R3 | Show when each item was found, its number, and order by best match / newest / oldest / updated | Built, verified in Edge |

#### 2.5 Reach out and apply
| ID | Requirement | Status |
|---|---|---|
| FR-O1 | Draft email or LinkedIn note per lead; bulk drafting into a send queue | Built |
| FR-O2 | Approval binds one exact version; any edit clears it | Built |
| FR-O3 | Suppression list and a daily send limit are enforced before every send | Built |
| FR-O4 | One-click "open in Outlook / Gmail / default mail app", then "I pressed Send" records a receipt | Built, verified (3 sends in Edge) |
| FR-O5 | **Send from the person's own Outlook or Gmail** through the provider API, receipt says *accepted*, never *delivered* | Built and fixture-tested; **Not configured until the owner registers the apps; no real email sent** |
| FR-O6 | Edit a sent message and send again as a new send | Built |
| FR-O7 | Apply: open the posting ("Apply on LinkedIn") then "I applied"; the local agent can fill forms (dry run by default) | Built; agent not run live |
| FR-O8 | Detect replies automatically and stop follow-ups | **Planned (A6)** |
| FR-O9 | Find a contact: suggest published addresses from the saved posting and up to three public pages of the company's own site, with the source; the person picks one | Built (unit + integration tested, UI checked); never guesses an address; live company sites not read |
| FR-O10 | Send all approved emails from the connected mailbox in one action, stopping at the first failure | Built (fake-provider tested; not run against a real mailbox) |

#### 2.6 Follow up and track
| ID | Requirement | Status |
|---|---|---|
| FR-T1 | A follow-up reminder is created automatically after a send (5 days) or "Applied" (7 days) | Built |
| FR-T2 | Insights: KPIs with change, trend chart, funnel, progress and weekly goal, sources, fit | Built, verified in Edge |
| FR-T3 | **My activity**: the person's own recorded actions, newest first | Built: searches, runs, profile saves, drafts written/edited/approved, status changes, approvals, sends, follow-ups; filter by kind and period, load more |
| FR-T4 | Sales: companies, contacts, deals, submissions, proposals (staffing pipeline) | Built (API + screens) |
| FR-T5 | Team view (owner, assignment, roles) | Planned (S15, X13) |

#### 2.7 Connectors
| ID | Requirement | Status |
|---|---|---|
| FR-C1 | A page listing connectors that exist and those coming (Gmail, Outlook, Calendar, Slack, Notion, HubSpot …) with "I want this" | Built |

### 3. Device and usability requirements
| ID | Requirement | Status |
|---|---|---|
| FR-U1 | Usable on phone, tablet and laptop with no sideways scrolling | Built; checked on iPhone 13/14 Pro Max/iPad Mini (WebKit), Pixel 7/Galaxy S9+ (Chromium) and laptop: no sideways scroll, axe 0; no real phone yet |
| FR-U2 | Simple view by default; Advanced shows tables and detail | Built |
| FR-U3 | Light and dark themes, readable dropdowns | Built |
| FR-U4 | Plain wording, one clear next step per screen, coach marks | Built |
| FR-U5 | Accessible: keyboard, labels, contrast (axe 0 violations) | Built; re-checked on the main screens this session |

### 4. Out of scope (deliberate)
No automatic sending or applying without approval; no scraping of LinkedIn/Indeed pages by the server; no reading of a person's inbox until reply detection (A6) is explicitly approved; no running a logged-in browser on a server.

---

<!-- merged from docs/SOFTWARE_REQUIREMENTS.md on 2026-10-19 -->

## Software requirements (SRS)

_2026-10-13 · version 1 · how the system is built and the qualities it must meet. Companion to `FUNCTIONAL_REQUIREMENTS.md`._

### 1. Architecture

```
Browser (React 19 + Vite, Vercel) ──HTTPS──► API (.NET 10, Render) ──► Postgres (Supabase, schema "app")
        │                                        │   ├─► JSearch, free job feeds, RapidAPI boards (read-only)
        │ sign-in                                │   ├─► Gemini (optional, AI wording)
        ▼                                        │   └─► Microsoft Graph / Gmail API (send, after the person connects)
 Supabase Auth (email, Google, Microsoft, TOTP)  └── background workers: research runner, schedules, retention
Local agent (Node + Playwright, on the user's computer) ──► API with an agent key (collect, apply on the user's shortlist)
```

| Layer | Choice | Notes |
|---|---|---|
| Web | React 19, TypeScript, Vite, plain CSS tokens (`tokens.css`, `styles/app/*.css`), vitest | Rules in `DESIGN.md` and the repo `CLAUDE.md` |
| API | .NET 10, Clean Architecture (Domain / Application / Infrastructure / Api), EF Core | Two migration sets: Postgres and SQL Server |
| Data | Supabase Postgres, schema `app`, tables created by API migrations on start | `SQL.md` lists the verification queries |
| Auth | Supabase Auth (JWT), guest tokens for demo, agent keys for the local agent | Sign-in keys not set yet (U1) |
| Hosting | Vercel (web), Render free plan (API, sleeps when idle) | Every merge to `main` deploys both |

### 2. External interfaces
| Interface | Use | Credential (server setting) | State |
|---|---|---|---|
| JSearch (RapidAPI) | LinkedIn/Indeed/SEEK postings | `Jsearch__Key` | Built, 200 searches/month |
| Free feeds | Arbeitnow, Jobicy, We Work Remotely, Remotive, Remote OK | none | Built, verified live |
| RapidAPI regional boards | Bayt, Naukri Gulf, JobStreet, StepStone, more by config | `RapidApi__Key`, `RapidApi__Boards__<id>__…` | Built, off until configured |
| Adzuna | Job search | `Adzuna__AppId/AppKey` | Built, optional |
| Gemini | AI wording | `Ai__…` key | Built, optional |
| Microsoft Graph | Send from Outlook (`Mail.Send`, `offline_access`) | `Mail__Microsoft__ClientId/ClientSecret` | Built, fixture-tested, not configured |
| Gmail API | Send from Gmail (`gmail.send`) | `Mail__Google__ClientId/ClientSecret` | Built, fixture-tested, not configured |
| Mail token vault | AES-256-GCM key for stored refresh tokens | `Mail__TokenKey` (32 bytes, base64) | Built |
| Supabase Auth | Accounts, MFA | `Auth__SupabaseUrl`, web `VITE_SUPABASE_*` | Planned wiring (U1) |

Adding another RapidAPI provider is configuration only (host must be `*.p.rapidapi.com`, one field map per API); a provider that needs different logic gets a small adapter behind the same interface.

### 3. Non-functional requirements

#### 3.1 Security and privacy
| ID | Requirement | State |
|---|---|---|
| NFR-S1 | Every row carries an owner id; every query filters by it | Built, tested |
| NFR-S2 | Secrets only in server settings; never in the repo, logs, responses or exports; refresh tokens encrypted at rest | Built |
| NFR-S3 | OAuth uses PKCE and a sealed, expiring state; a forged or expired state stores nothing | Built, tested |
| NFR-S4 | Outbound fetches are SSRF-safe and size-bounded | Built |
| NFR-S5 | Header-injection guard on outgoing mail | Built, tested |
| NFR-S6 | Schema `app` is not exposed through the Supabase Data API (or RLS is on) | **Unverified (I1)** |
| NFR-S7 | Second factor available to every account | Built; not verified live |
| NFR-S8 | Data retention and delete-my-data | Built |

#### 3.2 Reliability and performance
| ID | Requirement | State |
|---|---|---|
| NFR-R1 | A sleeping free-tier API shows "Starting the API…" rather than an error, and retries | Built |
| NFR-R2 | Each send happens at most once per approved version (idempotency key); a failed attempt can be retried | Built, tested |
| NFR-R3 | Free feeds cached 30 minutes; provider failures are shown per source, never hidden | Built |
| NFR-R4 | Pages usable within ~3 s on a mid-range phone on 4G after the API is awake | Not measured |

#### 3.3 Accessibility and devices
| ID | Requirement | State |
|---|---|---|
| NFR-D1 | WCAG 2.2 AA intent: axe 0 violations, keyboard operable, visible focus, reduced-motion respected | Checked on main screens |
| NFR-D2 | **Supported devices:** iPhone 13 and newer (Safari, iOS 15+, 390×844 up to 430×932), Android phones on current Chrome (360–412 px wide), iPad / Android tablets (768–1024 px), laptops (1280 px and up); light and dark | Checked with real WebKit and Chromium device profiles (see `IMPLEMENTATION_PLAN.md` §5) |
| NFR-D3 | No horizontal scroll at 360 px; touch targets at least 44×44 px; inputs at 16 px so iOS does not zoom; safe-area insets honoured; installable to the home screen | Built (web manifest, safe areas, 16 px fields, 44 px controls); installed-app behaviour not tested |
| NFR-D4 | Browsers: current Edge, Chrome, Safari, Firefox | Edge verified; others by device profiles in P4 |

#### 3.3 Maintainability and process (55 Tech standard)
| ID | Requirement | State |
|---|---|---|
| NFR-M1 | Each repo has a `CLAUDE.md` (stack, commands, folder blueprint, rules) and one-concern docs under `docs/` | Present |
| NFR-M2 | Flow docs for each screen; open questions logged with ID, priority, owner | Present, updated per change |
| NFR-M3 | Tests: pure logic unit-tested; API integration-tested against Postgres | API 485 unit + 95 integration; web 295 |
| NFR-M4 | Small logical commits, one branch per batch, one PR per repo, merge only when verified | Followed |
| NFR-M5 | `TASKS.md` lists every task before work starts; `HANDOFF.md` updated each session | Followed |
| NFR-M6 | Design rules in `DESIGN.md` are mandatory for UI work | Followed |

### 4. Constraints and assumptions
- Free-tier hosting: the API sleeps; Render and Vercel limits apply to every deploy.
- JSearch is limited to 200 searches a month; tests use at most 10 live searches per task.
- LinkedIn and Naukri forbid automated use; the local agent is opt-in, low-limit, dry-run by default, and was never run live.
- Sending from a mailbox needs the owner to register an Entra and a Google app once; Google treats `gmail.send` as a sensitive scope (test-user mode works for a small group).
- Supabase keys are not set yet, so account sign-in and MFA cannot be verified live.

---

<!-- merged from docs/PROJECT_REF.md on 2026-10-19 -->

## Project reference

Facts about configuration, deployment and sources of truth. Rules live in `CLAUDE.md`; gaps in `docs/open-questions.md`.

Last updated: 2026-10-05.

### Environment variables

All are `VITE_` build-time values compiled into the public bundle — public values only. Changing one needs a rebuild/redeploy.

| Variable | Purpose | Local (`.env.local`, from `.env.example`) | Production | Read in |
|---|---|---|---|---|
| `VITE_API_BASE_URL` | API origin, no trailing slash | `http://localhost:5051` (also the code default) | `https://opportunitypilotwebapi.onrender.com` — committed in `.env.production` and `render.yaml`; a value set in the Vercel/Render dashboard overrides `.env.production` | `src/lib/config.ts` |
| `VITE_SUPABASE_URL` | Supabase project URL (auth only) | empty → no Supabase | Not set yet (Vercel dashboard; `render.yaml` prompts with `sync: false`) → production runs guest mode (OQ-FE-014) | `src/lib/config.ts` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable (anon) key — never the service-role key | empty | Not set yet (as above) | `src/lib/config.ts` |
| `VITE_HANKO_API_URL` | Hanko project API URL (public; https, or http on localhost). When set, Hanko is the main sign-in | empty → no Hanko (the package is never loaded) | Not set yet (Vercel dashboard; `render.yaml` prompts with `sync: false`). Must match the API's `Auth__HankoApiUrl`; owner steps in `docs/SETUP.md` (Sign-in setup) | `src/lib/config.ts` |
| `VITE_DEV_AUTH` | `true` enables development sign-in (`X-Dev-User`); needs the API in Development with `Auth:DevBypass=true` | `true` | Ignored: gated by `import.meta.env.DEV`, so it is compiled out of production builds | `src/lib/config.ts` |
| `NODE_VERSION` | Node for the Render build | — | `22.12.0` in `render.yaml` | Render |

Browser storage: localStorage `op.devUser` (dev mode), `op.guestToken` (guest token plus server expiry); Supabase keeps its own session (`persistSession`, `autoRefreshToken`). The selected local/session store is cleared before a new password sign-in so an older token cannot reappear when persistence changes.

### API

| Item | Value |
|---|---|
| Local | `http://localhost:5051` — `dotnet run --project src/OpportunityPilot.Api` in `../OpportunityPilotWebApi` |
| Production | `https://opportunitypilotwebapi.onrender.com` (Render free tier: sleeps when idle; first request can take about a minute) |
| Client | `src/lib/api.ts` — adds auth headers, JSON content type, maps failures to `ApiError` (status, correlation ID, field errors) or `ApiUnreachableError`; 401 signs the user out |
| CORS | The API must list the web origin (`Cors__AllowedOrigins__N`). Its `appsettings.Development.json` allows `http://localhost:5173`; `appsettings.json` includes `https://opportunity-pilot-webapp.vercel.app` |
| Health | `GET /health/ready` polled by the shell |

Endpoints the web app calls today:

| Area | Endpoints |
|---|---|
| Auth / setup | `POST /api/v1/auth/guest`, `GET /health/ready`, `GET /api/v1/capabilities`, `GET /api/v1/overview` |
| Profiles | `GET/POST /api/v1/profiles`, `GET/PUT /api/v1/profiles/:id` |
| Campaigns | `GET/POST /api/v1/campaigns`, `GET/PUT /api/v1/campaigns/:id` |
| Sources | `GET/POST /api/v1/campaigns/:id/sources`, `DELETE /api/v1/campaigns/:id/sources/:sourceId`, `POST /api/v1/imports/preview`, `POST /api/v1/imports/:importId/commit` |
| Research | `POST /api/v1/campaigns/:id/research`, `GET /api/v1/campaigns/:id/research-jobs`, `GET /api/v1/research-jobs/:id`, `POST /api/v1/research-jobs/:id/cancel` |
| Opportunities | `GET /api/v1/campaigns/:id/opportunities`, `GET /api/v1/opportunities/:id`, `PATCH /api/v1/opportunities/:id/status`, `GET /api/v1/campaigns/:id/export`, `GET/POST /api/v1/opportunities/:id/drafts`, `PUT/POST/DELETE /api/v1/drafts/:id` (CoverNote) |
| Approvals | `GET /api/v1/approvals?campaignId&take&skip`, `POST /api/v1/approvals/decide` (phase-1 contract; also `POST …/sources` kinds `Greenhouse`, `Lever`, `Adzuna` and `autoSuggestMinScore` on campaign bodies) |
| Applications / agent | `GET /api/v1/applications`, `GET /api/v1/applications/summary`, `GET/POST /api/v1/agent-keys`, `DELETE /api/v1/agent-keys/:id` |
| Job discovery | `GET /api/v1/wellfound/status|jobs|kpis|activities|applications`, `POST /api/v1/wellfound/public/sync`, `PATCH /api/v1/wellfound/jobs/:id/state`; Indeed currently uses an official `https://www.indeed.com/jobs` search handoff and no API |

### Deploy targets

| Target | Config | URL | State |
|---|---|---|---|
| Vercel (current) | `vercel.json`: framework vite, `npm run build`, output `dist`, rewrite all paths to `/index.html`, security headers (`nosniff`, `strict-origin-when-cross-origin`, `X-Frame-Options: DENY`), immutable cache for `/assets/*` | https://opportunity-pilot-webapp.vercel.app | Auto-deploys from `main` |
| Render static site (alternative) | `render.yaml` Blueprint: `npm ci && npm run build`, publish `./dist`, SPA rewrite, same headers, Node 22.12.0 | Unknown — no deployed Render web URL is recorded in `../HANDOFF.md` | Blueprint kept as an alternative; Vercel is the current target |
| API (separate repo) | `../OpportunityPilotWebApi` Dockerfile on Render | https://opportunitypilotwebapi.onrender.com | Auto-deploys from `main` |

Step-by-step deployment for API + web + Supabase: `../DEPLOY.md`.

### Auth modes

Chosen at build time in `src/features/auth/AuthProvider.tsx`:

| Mode | When | Credentials sent to the API | Notes |
|---|---|---|---|
| hanko (on top of any mode) | `VITE_HANKO_API_URL` set | `Authorization: Bearer <Hanko session token>` (`hanko.getSessionToken()`) | Shown first on the sign-in page (`<hanko-auth>`: passkey, password, email code, MFA); the mode below becomes "the older sign-in" (`/signin?with=classic`). Settings → Security shows `<hanko-profile>` for Hanko users. `@teamhanko/hanko-elements` 3.0.0 is loaded on demand |
| supabase | `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` set | `Authorization: Bearer <Supabase access token>` | Email/password + Google; access tokens refresh automatically and once more before API calls when near expiry |
| dev | Supabase not set, `VITE_DEV_AUTH=true`, dev build | `X-Dev-User: <name>` | Any name is a separate synthetic user; impossible in production builds |
| guest | Neither of the above (current production) | `Authorization: Bearer <guest token>` from `POST /api/v1/auth/guest` | Demo mode; the browser enforces the returned expiry. With real sign-in the API keeps guests only when `Auth__AllowGuests=true`; data may be in-memory and reset on restart |

### Sources of truth

| What | Where |
|---|---|
| Designs (visual reference, not routing) | `../opportunitypilot-ui/*.dc.html`, `../opportunitypilot-ui/README.md` |
| Design tokens | `../opportunitypilot-ui/tokens.css` → copied verbatim to `src/styles/tokens.css` (identical on 2026-10-05) |
| API contract — every built endpoint | `../OpportunityPilotWebApi/docs/api-contracts.md` |
| Earlier slice specs (some not built) | `../OpportunityPilotWebApi/docs/feature-contracts.md` |
| API contract — sales projects, bids, tenders and proposal drafts | `../OpportunityPilotWebApi/docs/SALES_CONTRACT.md` (manual project/bid/approve API built; provider feeds, drafts and UI remain) |
| API contract — candidate phase 1: Greenhouse / Lever / Adzuna sources, `Suggested` status, approval queue | `../OpportunityPilotWebApi/docs/CANDIDATE_PHASE1_CONTRACT.md` (web built 2026-10-05; API built in parallel) |
| API implementation status and decisions | `../OpportunityPilotWebApi/docs/IMPLEMENTATION_STATUS.md`, `../OpportunityPilotWebApi/docs/DECISIONS.md` |
| Product status, decisions, next steps | `../HANDOFF.md` |
| Local apply agent (CLI the web copy refers to) | `../OpportunityPilotWebApi/agent/README.md` |
| Routes and screen status | `docs/SCREEN_MAP.md` |
