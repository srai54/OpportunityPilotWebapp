# Project reference

Facts about configuration, deployment and sources of truth. Rules live in `CLAUDE.md`; gaps in `docs/open-questions.md`.

Last updated: 2026-10-05.

## Environment variables

All are `VITE_` build-time values compiled into the public bundle — public values only. Changing one needs a rebuild/redeploy.

| Variable | Purpose | Local (`.env.local`, from `.env.example`) | Production | Read in |
|---|---|---|---|---|
| `VITE_API_BASE_URL` | API origin, no trailing slash | `http://localhost:5051` (also the code default) | `https://opportunitypilotwebapi.onrender.com` — committed in `.env.production` and `render.yaml`; a value set in the Vercel/Render dashboard overrides `.env.production` | `src/lib/config.ts` |
| `VITE_SUPABASE_URL` | Supabase project URL (auth only) | empty → no Supabase | Not set yet (Vercel dashboard; `render.yaml` prompts with `sync: false`) → production runs guest mode (OQ-FE-014) | `src/lib/config.ts` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable (anon) key — never the service-role key | empty | Not set yet (as above) | `src/lib/config.ts` |
| `VITE_HANKO_API_URL` | Hanko project API URL (public; https, or http on localhost). When set, Hanko is the main sign-in | empty → no Hanko (the package is never loaded) | Not set yet (Vercel dashboard; `render.yaml` prompts with `sync: false`). Must match the API's `Auth__HankoApiUrl`; owner steps in `docs/AUTH_SETUP.md` | `src/lib/config.ts` |
| `VITE_DEV_AUTH` | `true` enables development sign-in (`X-Dev-User`); needs the API in Development with `Auth:DevBypass=true` | `true` | Ignored: gated by `import.meta.env.DEV`, so it is compiled out of production builds | `src/lib/config.ts` |
| `NODE_VERSION` | Node for the Render build | — | `22.12.0` in `render.yaml` | Render |

Browser storage: localStorage `op.devUser` (dev mode), `op.guestToken` (guest token plus server expiry); Supabase keeps its own session (`persistSession`, `autoRefreshToken`). The selected local/session store is cleared before a new password sign-in so an older token cannot reappear when persistence changes.

## API

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

## Deploy targets

| Target | Config | URL | State |
|---|---|---|---|
| Vercel (current) | `vercel.json`: framework vite, `npm run build`, output `dist`, rewrite all paths to `/index.html`, security headers (`nosniff`, `strict-origin-when-cross-origin`, `X-Frame-Options: DENY`), immutable cache for `/assets/*` | https://opportunity-pilot-webapp.vercel.app | Auto-deploys from `main` |
| Render static site (alternative) | `render.yaml` Blueprint: `npm ci && npm run build`, publish `./dist`, SPA rewrite, same headers, Node 22.12.0 | Unknown — no deployed Render web URL is recorded in `../HANDOFF.md` | Blueprint kept as an alternative; Vercel is the current target |
| API (separate repo) | `../OpportunityPilotWebApi` Dockerfile on Render | https://opportunitypilotwebapi.onrender.com | Auto-deploys from `main` |

Step-by-step deployment for API + web + Supabase: `../DEPLOY.md`.

## Auth modes

Chosen at build time in `src/features/auth/AuthProvider.tsx`:

| Mode | When | Credentials sent to the API | Notes |
|---|---|---|---|
| hanko (on top of any mode) | `VITE_HANKO_API_URL` set | `Authorization: Bearer <Hanko session token>` (`hanko.getSessionToken()`) | Shown first on the sign-in page (`<hanko-auth>`: passkey, password, email code, MFA); the mode below becomes "the older sign-in" (`/signin?with=classic`). Settings → Security shows `<hanko-profile>` for Hanko users. `@teamhanko/hanko-elements` 3.0.0 is loaded on demand |
| supabase | `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` set | `Authorization: Bearer <Supabase access token>` | Email/password + Google; access tokens refresh automatically and once more before API calls when near expiry |
| dev | Supabase not set, `VITE_DEV_AUTH=true`, dev build | `X-Dev-User: <name>` | Any name is a separate synthetic user; impossible in production builds |
| guest | Neither of the above (current production) | `Authorization: Bearer <guest token>` from `POST /api/v1/auth/guest` | Demo mode; the browser enforces the returned expiry. With real sign-in the API keeps guests only when `Auth__AllowGuests=true`; data may be in-memory and reset on restart |

## Sources of truth

| What | Where |
|---|---|
| Designs (visual reference, not routing) | `../opportunitypilot-ui/*.dc.html`, `../opportunitypilot-ui/README.md` |
| Design tokens | `../opportunitypilot-ui/tokens.css` → copied verbatim to `src/styles/tokens.css` (identical on 2026-10-05) |
| API contract — research, campaigns, sources, opportunities, agent | `../OpportunityPilotWebApi/docs/RESEARCH_CONTRACT.md` (built) |
| API contract — Gemini, drafts, suppression, activities, follow-ups | `../OpportunityPilotWebApi/docs/M4_M5_CONTRACT.md` (CoverNote drafts built; remaining slices not built) |
| API contract — sales projects, bids, tenders and proposal drafts | `../OpportunityPilotWebApi/docs/SALES_CONTRACT.md` (manual project/bid/approve API built; provider feeds, drafts and UI remain) |
| API contract — candidate phase 1: Greenhouse / Lever / Adzuna sources, `Suggested` status, approval queue | `../OpportunityPilotWebApi/docs/CANDIDATE_PHASE1_CONTRACT.md` (web built 2026-10-05; API built in parallel) |
| API implementation status and decisions | `../OpportunityPilotWebApi/docs/IMPLEMENTATION_STATUS.md`, `../OpportunityPilotWebApi/docs/DECISIONS.md` |
| Product status, decisions, next steps | `../HANDOFF.md` |
| Local apply agent (CLI the web copy refers to) | `../OpportunityPilotWebApi/agent/README.md` |
| Routes and screen status | `docs/SCREEN_MAP.md` |
