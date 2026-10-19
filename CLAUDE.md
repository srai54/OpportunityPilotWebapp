# OpportunityPilot web app — CLAUDE.md

Rules for any AI agent working in this repository. Project rules here win over global ones. Keep this file current: a stack, command or folder change updates it in the same change.

## 1. Project & Stack

| Item | Value |
|---|---|
| What | Single-page app for OpportunityPilot. Two users share one pipeline (find → score → shortlist → act → follow up): **Candidate** (applies to roles) and **Sales team** (the app as sales assistant: business opportunities, proposals, emails, batch approval) |
| UI | React 19.2, react-dom 19.2 |
| Language | TypeScript ~6.0 (`tsc -b`, project references: `tsconfig.app.json` for `src/`, `tsconfig.node.json` for `vite.config.ts`), strict unused-locals/params, `erasableSyntaxOnly`, `verbatimModuleSyntax` |
| Build / dev server | Vite 8 with `@vitejs/plugin-react`; dev server port **5173**, `strictPort` (the API's CORS allows exactly this origin) |
| Routing | react-router-dom 7 **data router** (`createBrowserRouter` in `src/App.tsx`). Required: `useBlocker` guards unsaved edits in Profiles and the Campaign builder |
| State | No global store. Server data through `useApi` (GET hook in `src/lib/useApi.ts`) and `api()` / `apiDownload()` (`src/lib/api.ts`); screen state in component state; capabilities shared through `ShellContext` |
| Auth | `src/features/auth/AuthProvider.tsx`. **Hanko** (`VITE_HANKO_API_URL` set, `@teamhanko/hanko-elements` 3.0.0 loaded on demand by `src/lib/hanko.ts`) is the main sign-in on top of any mode; setup in `docs/SETUP.md`. Three modes picked at build time: **supabase** (Supabase URL + publishable key set), **dev** (`VITE_DEV_AUTH=true` and a dev build only), **guest** (neither — demo mode, the API issues a signed random guest token) |
| Data | Every record comes from the API (`OpportunityPilotWebApi`, .NET 10). Supabase is used for sign-in only; the browser never reads the database |
| API base URL | `VITE_API_BASE_URL`, read in `src/lib/config.ts`; default `http://localhost:5051`; production value committed in `.env.production` |
| Tests | Vitest 5, `environment: node`, only `src/**/*.test.ts` (pure logic; there are no component/DOM tests) |
| Lint | oxlint (`.oxlintrc.json`: react, typescript, oxc plugins) |
| Styling | Plain CSS: `src/styles/tokens.css` (design tokens, copied verbatim from `../opportunitypilot-ui/tokens.css`) + `src/styles/app.css`. No CSS framework, no CSS-in-JS |
| Fonts | Inter (UI) and IBM Plex Mono (ids) from Google Fonts (`index.html`) |
| Hosting | Vercel (current, `vercel.json`) and a Render static-site Blueprint (`render.yaml`). Both: `npm run build` → `dist/`, SPA rewrite to `/index.html`. Details: `docs/PRODUCT.md` |
| Node | `^20.19.0 || >=22.12.0` (Render pins 22.12.0) |
| Docker | None for the web app |

## 1a. Design rules — mandatory

**Before touching any screen, component, colour, copy or chart, read [`DESIGN.md`](DESIGN.md).** It is the single source of design rules (tokens, type, layout, shell, components, forms, charts, copy, accessibility, definition of done). Do not invent styles, hex colours, spacing or chart looks from memory; use the tokens and components it names. If a case is not covered, add the rule to `DESIGN.md` in the same change. A UI change is not done until it meets section 12 of `DESIGN.md` (Edge at 1280 and 375, light and dark, axe 0).

## 2. Cheat-sheet commands

| Task | Command | Notes |
|---|---|---|
| First setup | `npm install`, then copy `.env.example` to `.env.local` | `.env.local` is git-ignored; `VITE_DEV_AUTH=true` signs in without Supabase |
| Start the API first | `dotnet run --project src/OpportunityPilot.Api` in `../OpportunityPilotWebApi` | Listens on 5051; the shell shows "API · starting" until it answers |
| Dev server | `npm run dev` | http://localhost:5173 |
| Typecheck | `npm run typecheck` (same as `npx tsc -b`) | |
| Lint | `npm run lint` | Baseline: 0 errors, 0 warnings — keep it there |
| Test | `npm test` | Vitest, runs once |
| Single test file | `npx vitest run src/features/campaigns/campaignModel.test.ts` | |
| Production build | `npm run build` | `tsc -b && vite build` → `dist/`; currently warns that the bundle is > 500 kB (tracked) |
| Preview build | `npm run preview` | Serves `dist/` |
| Device and accessibility check | `npm run check:devices` (`-- --quick` for 3 devices, `-- --shots out/` to save screenshots) | Seeds a guest Sales workspace through the API, then opens 13 screens on iPhone 13/14 Pro Max, iPad Mini (WebKit), Pixel 7, Galaxy S9+ and a 1280 px laptop, light and dark; fails on sideways scroll or axe violations. Needs the API in demo mode and the dev server (see the header of `scripts/check-devices.mjs`); WebKit once: `npx playwright install webkit`. Part of "done" for any UI change |
| Shell check | `npm run check:shell` | Every route × 1280 / 1024 / 375 × light / dark × Simple / Advanced: app bar exactly one 52px line, hamburger present, no sideways scroll, axe 0, no console errors; plus hamburger drawer/collapse, Escape, theme label and phone account-menu interactions. Same setup as `check:devices` (API in demo mode, dev server on :5198). Part of "done" for any shell or layout change |
| Full gate before "done" | typecheck → lint → test → build, then delete `dist/` | All must pass; lint warnings must not increase |

## 3. Folder blueprint

| Path | Holds | Rule |
|---|---|---|
| `src/main.tsx` | Mounts `<App/>`, imports `tokens.css` then `app.css` | Nothing else goes here |
| `src/App.tsx` | Route table (data router), `AuthGate`, `NotFound` | Every new route is added here **and** to `docs/SCREEN_MAP.md` |
| `src/lib/` | `api.ts` (fetch wrapper, `ApiError`, `ApiUnreachableError`), `config.ts` (public env), `useApi.ts`, `supabase.ts` (auth client only), `types.ts` (DTOs), `download.ts` | Framework-free helpers shared by several features |
| `src/components/` | Shared UI: `ErrorNotice` (inline, or the "Could not load X" card with `what`), `States` (`EmptyState`, `FilteredEmpty`, `LoadingState` with API-waking, `NotBuiltState`), `StatusBadge`/`Badge`, `TagInput` | Only components used by two or more features. Every page uses `States` for loading / empty / waking — no hand-made "Loading…" text or centred empty cards |
| `src/features/<area>/` | One folder per area: `auth`, `shell`, `overview`, `profiles`, `campaigns`, `research`, `opportunities`, `approvals`, `applications`, `integrations`, `settings`, `placeholder` | Screen components are `<Name>Page.tsx` (or a step/section component next to its page) |
| `src/features/<area>/<area>Model.ts` | Pure logic: labels, validation (`draftProblems`), path builders, normalisers, formatters | No React, no fetch, no DOM — so it can be unit-tested in Node. Existing: `campaignModel`, `researchModel`, `opportunityModel`, `approvalModel`, `applicationStatus`, `profileFields` |
| `src/features/<area>/*.test.ts` | Vitest tests, co-located with the model they test | Every new model function gets a test |
| `src/styles/tokens.css` | Design tokens (`--op-*`) | Copied from `../opportunitypilot-ui/tokens.css`; change the design source first, then copy |
| `src/styles/app.css` | All component classes, grouped by screen, responsive rules at the end | Uses tokens only |
| `docs/` | Flow docs, screen map, project reference, open questions | See the reference table below |
| `skills/` | `prompt-master.SKILL.md` | Read when a rule below says so |
| `.claude/commands/` | `/audit-oq`, `/resolve-oq`, `/build-screen` | |
| `.claude/hooks/` | Command/write guards and the write log | Wired in `.claude/settings.json` |

**Where a new screen goes:** flow-doc entry first (role doc) → `src/features/<area>/<Name>Page.tsx` → pure logic in `<area>Model.ts` + `<area>Model.test.ts` → DTOs in `src/lib/types.ts` → route in `src/App.tsx` (with `handle: { title }`) → nav entry in `NAV` in `src/features/shell/AppShell.tsx` if it is top-level → classes in `src/styles/app.css` → `docs/SCREEN_MAP.md`. A screen whose milestone is not built uses `NotBuiltPage` (no sample data, no dead buttons).

## 4. Path aliases

None. There is no `paths`/`baseUrl` in `tsconfig.app.json` and no `resolve.alias` in `vite.config.ts`. Import with relative paths (`../../lib/api`) and without file extensions. Use `import type` for type-only imports (`verbatimModuleSyntax` requires it). Do not add an alias without updating this section, both tsconfigs and the Vite config in the same change.

## 5. Mandatory rules

### Trigger wiring

| When | Do |
|---|---|
| Before building or changing a screen | Read its entry in the role's flow doc: `docs/CANDIDATE_FLOW.md`, `docs/SALES_FLOW.md` or `docs/SHARED_FLOW.md`. If the entry is missing, create it first (all fields, `Status: not built`) and confirm it with the user |
| Building a screen from its flow-doc entry | Run `/build-screen` — it is the only thing that flips `Status` to `built` and updates `docs/SCREEN_MAP.md` |
| A request is vague (two or more of: which user, which screen/route, which flow-doc entry, which API endpoint/contract, acceptance checks are missing) | Read `skills/prompt-master.SKILL.md` and ask its one structured question burst before writing code |
| After finishing a feature | Run `/audit-oq` and register every new mock, hard-code, stub or dead link in `docs/open-questions.md` |
| Closing a tracked gap | Run `/resolve-oq OQ-FE-###` — one OQ per run |
| Adding or changing an API call | Find the endpoint in `../OpportunityPilotWebApi/docs/api-contracts.md` (or the API's controllers). Mirror its DTO in `src/lib/types.ts`. If no contract exists, log an OQ and ask — never invent an endpoint |
| Adding an environment variable | Public values only; add it to `.env.example`, `src/lib/config.ts` and `docs/PRODUCT.md` |
| Something is unknown or undecided | Log it in `docs/open-questions.md` with ID, priority and owner instead of improvising |

### Data honesty

- Everything shown comes from the API. Never fabricate data: no sample rows, placeholder counts, invented percentages or demo values in components.
- Unknown stays unknown: show "Not verified", "—" or an empty state, never a guess. Progress is stages and counts, never an invented percentage.
- A fit score is "Fit N/100", a ranking — never a probability of hiring, buying or replying.
- AI-generated text (when M4 lands) must be visually distinct: its own surface using the `--op-ai-*` tokens plus a visible "AI" label, never styled like evidence. Every AI response shows its `source` and `fallbackReason`.
- Status colour is always paired with words (`Badge`/`StatusBadge`).
- A screen or feature that does not exist yet says so (`NotBuiltPage`, "Not built yet" badge). No control pretends to work.
- No bulk send. Sending or approving anything outgoing follows the approval model in the contract; the batch-approval decision is open (see `docs/open-questions.md`).

### API and types

- All requests go through `api()` / `apiDownload()` / `useApi()` in `src/lib/`. No direct `fetch` in components; no Supabase data queries.
- `src/lib/types.ts` mirrors the API contracts field for field (camelCase, string enums). Change the contract doc first, then the type.
- Show API failures with `ErrorNotice` (it renders the correlation ID and the "API is waking up" text). Map `409` to a "saved elsewhere, your edits are kept" message and offer a reload; show `fieldErrors` next to their fields (`fieldError()` in `campaignModel.ts`).
- Render external URLs from research or the agent only through `safeHref()` (`opportunityModel.ts`), with `target="_blank" rel="noopener noreferrer"` and "(opens in a new tab)" for screen readers.

### Security and configuration

- No secrets in `VITE_` variables — everything `VITE_` is compiled into the public bundle. Only the API URL, the Supabase project URL, the Supabase **publishable** key and the Hanko project API URL are allowed.
- Dev sign-in stays compiled out of production: it is gated by `import.meta.env.DEV` in `config.ts`; never remove that check or add another bypass.
- `.env.production` holds public values only and is committed on purpose; `.env`, `.env.local` and other `.env.*` files are never committed or edited by the agent.
- Agent keys are shown once on creation and never stored by the web app.

### CSS (learned in this codebase)

- Tokens only: colours, spacing, radii, font sizes come from `--op-*` variables in `tokens.css`. No new hex/rgb literals in `app.css`.
- Any `overflow-x: auto|scroll` container is `position: relative` (otherwise absolutely positioned `.sr-only` text inside it widens the page on mobile).
- Single-column mobile grids use `minmax(0, 1fr)`, never bare `1fr`, so wide tables scroll inside their column instead of widening the page.
- Wide tables sit in `.table-card > .table-scroll` with `role="region"`, an accessible name and `tabIndex={0}`.
- Check every changed screen at **375 px** width: zero horizontal page overflow (`document.documentElement.scrollWidth <= innerWidth`). Breakpoints in use: 1080, 860 (drawer nav), 600 px.
- Touch targets are at least `--op-touch-target` (44 px) under 860 px.

### Accessibility

- Real elements only: `<button>` for actions, `<Link>`/`<a href>` for navigation, `<label htmlFor>` for every input, `<fieldset><legend>` for radio/checkbox groups. No clickable `div`s.
- Icon-only or repeated buttons carry an accessible name (`aria-label` or `.sr-only` text naming the row).
- Errors: `role="alert"`; changes announced politely with an `.sr-only` `role="status" aria-live="polite"` span. Field errors are linked with `aria-describedby` and `aria-invalid`.
- Disabled controls explain why (hint text next to them).
- Moving between steps moves focus to the new step heading; destructive actions confirm first.
- Text contrast at least 4.5:1 — use the measured token pairs.

### Git workflow

- Every feature or change goes on a **new branch** (`feature/`, `fix/`, `docs/`, `chore/` + name); never commit to `main`. Run this repo's checks, commit, then from the workspace root run `bash tools/pr.sh <repo> "<title>" <body-file>`: it pushes, raises a PR to `main` and **squash-merges** it (auto-merge authorised by the user *for now*; if withdrawn, pass `--no-merge` and wait), deletes the branch and pulls `main`. `main` deploys automatically, so a merge is a release.
- **Push only at the end of the session or when the user says so (rule, set by the user 2026-10-06 — replaces "always push"):** commit locally as each task finishes; a local commit deploys nothing. Do **not** push, raise or merge a PR after a task or a minor change: every push/merge to `main` deploys Vercel and Render and uses up free-tier limits. Push + PR + merge only when **all tasks of the session are done and verified** (typecheck, lint, tests, build, browser check through the local proxy against the live API), or when the user **explicitly** asks. If the session must stop early, leave the work committed locally on its branch (no push) and note the branch in `TASKS.md`. See `../CLAUDE.md`.

### Do not

- Do not invent endpoints, DTO fields, enum values or sample data.
- Do not flip a flow-doc `Status` by hand; only `/build-screen` does.
- Do not use design artboards (`../opportunitypilot-ui/*.dc.html`) as the routing source of truth; routes come from the flow docs and `src/App.tsx`.
- Do not add dependencies, a state library, a CSS framework or path aliases without asking.
- Do not edit `package-lock.json` by hand, anything in `dist/` or `node_modules/`, or `.env*` files other than `.env.example`/`.env.production` (hooks block these).
- Do not commit or push unless asked; `main` auto-deploys to Vercel.
- Do not bypass hooks (`--no-verify`), force-push, or run `rm -rf` on broad paths.
- Do not claim live verification (Supabase sign-in, LinkedIn/Naukri, Gemini, real-internet fetch, 375 px check) that was not actually run.

## Docs reference

The AI does not discover docs on its own; this table is the bridge. Read the row's file when the trigger applies.

| Domain | File | Read when |
|---|---|---|
| Shared screens: sign-in, shell, Overview, Profiles, Sources & integrations, Settings, 404 | `docs/SHARED_FLOW.md` | Touching any of these screens |
| Candidate screens: job campaigns, research run, opportunities (Job), Applications, approval queue, cover notes | `docs/CANDIDATE_FLOW.md` | Touching a Candidate screen |
| Sales screens: customer campaigns, opportunities (Customer), outreach, follow-ups, proposals, bids, batch approval | `docs/SALES_FLOW.md` | Touching a Sales screen |
| Every route → component → flow doc → status | `docs/SCREEN_MAP.md` | Adding/removing a route; checking what is built |
| Env vars, API base URL, deploy targets and URLs, auth modes, design and contract locations | `docs/PRODUCT.md` | Configuration, deployment, auth or API questions |
| Hanko + Supabase sign-in setup (owner steps, env vars, troubleshooting) | `docs/SETUP.md` | Touching sign-in, or switching Hanko on |
| Open gaps, mocks, hard-codes, undecided items | `docs/open-questions.md` | Before inventing anything; after every feature |
| Vague requests | `skills/prompt-master.SKILL.md` | Two or more context dimensions missing |
| API contract — every built endpoint | `../OpportunityPilotWebApi/docs/api-contracts.md` | Any screen that calls the API |
| API contract — job boards (Greenhouse, Lever, Adzuna), approval queue | `../OpportunityPilotWebApi/docs/CANDIDATE_PHASE1_CONTRACT.md` | Sources step, Filters step, Approvals |
| Earlier slice specs (some not built) | `../OpportunityPilotWebApi/docs/feature-contracts.md` | Planning a new slice |
| Product status and decisions | `../HANDOFF.md`, `../OpportunityPilotWebApi/docs/DECISIONS.md` | Scope or priority questions |
| Designs | `../opportunitypilot-ui/` (`*.dc.html`, `README.md`) | Visual reference for a screen |
| Deployment steps | `../DEPLOY.md` | Deploying API + web + Supabase |
