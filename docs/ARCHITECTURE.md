# Architecture

OpportunityPilot is two repositories that deploy separately:

| Repo | What | Hosting |
|---|---|---|
| `OpportunityPilotWebapp` (this one) | React 19 SPA, Vite build, no server code | Vercel (also a Render static-site blueprint) |
| `OpportunityPilotWebApi` | ASP.NET Core (.NET 10) API, Clean Architecture, plus `agent/` (the local desktop agent) | Render (Docker), PostgreSQL |

## System view

```mermaid
flowchart TB
  subgraph Browser
    SPA[React SPA<br/>routes lazy-loaded, no global store]
  end
  subgraph API["ASP.NET Core API (Render)"]
    C[Controllers<br/>thin, auth + rate limits]
    S[Application services<br/>rules engine, budgets, approval]
    R[Repositories / EF Core]
    RP[ResearchProcessor<br/>background worker, leased jobs]
    SF[SafeFetcher<br/>public IPs only, size/time caps]
  end
  DB[(PostgreSQL<br/>schema app)]
  FEEDS[Free feeds + ATS boards<br/>Arbeitnow, Jobicy, WWR, Remotive, Remote OK,<br/>Himalayas, The Muse, Instahyre, Greenhouse, Lever, Ashby, Workday]
  PAID[Credit sources<br/>JSearch: LinkedIn/Indeed, SEEK, Apollo, Apify: Naukri, Adzuna]
  AI[Groq / Gemini / Whisper]
  MAIL[Gmail, Outlook, SMTP/IMAP,<br/>Slack, Teams, HubSpot, Notion, Airtable, webhooks]
  AGENT[Desktop agent on the user's PC<br/>Node + Playwright]

  SPA -->|HTTPS, Hanko/Supabase JWT or guest token| C
  C --> S --> R --> DB
  RP --> S
  S --> SF --> FEEDS
  S -->|server-side keys, daily budgets| PAID
  S -->|JSON-only prompts, rules fallback| AI
  S --> MAIL
  AGENT -->|X-Agent-Key, agent endpoints only| C
  AGENT -->|the user's own browser session| LI[LinkedIn / Naukri]
```

## The pipeline (both workspaces)

```mermaid
flowchart LR
  F[Find<br/>campaign or one search] --> SC[Score<br/>rules, evidence quoted] --> AP[Approve<br/>batch queue, optional auto-approve] --> ACT[Act<br/>apply / draft + send] --> FU[Follow up<br/>replies, interviews, deals]
```

- **Find**: a campaign (saved criteria, repeatable on a schedule) queues a research job; the `ResearchProcessor` gathers from the chosen sources through `SafeFetcher` or the provider clients, de-duplicates, and stores opportunities with evidence. One-off searches on **Find** (All sites, Apollo, SEEK…) read live and can be turned into a campaign in one tap.
- **Score**: `Application/Research/Rules` — every point of the fit score has a reason quoted from the posting. No model is used for scoring, so results are explainable and cheap.
- **Approve**: research never changes an opportunity's status; only the person (or an explicit auto-approve threshold they set) does.
- **Act**: Candidate — apply link, tailored resume, or the desktop agent. Sales — drafted emails, approved one by one or in a visible queue, sent from the person's own mailbox.
- **Follow up**: IMAP reply detection, follow-up drafts, interview tracker, deals and submissions.

## Web app structure

| Path | Holds |
|---|---|
| `src/App.tsx` | Route table (data router), lazy pages, auth gate |
| `src/lib/` | `api()` fetch wrapper (auth headers, problem details, wake-up retries), `useApi` GET hook, config, DTO types |
| `src/features/<area>/` | One folder per area; `<Name>Page.tsx` screens and `<area>Model.ts` pure logic with co-located Vitest tests |
| `src/features/wellfound/` | **Find**: All sites (`AllSitesPanel`, `allSitesModel`), the source catalogue and region picker (`sourcesModel`, `SitePicker`), the shared contract/remote rule (`jobSignals`), Apollo, board tabs, saved results |
| `src/features/voice/` | Voice assistant: speech capture, Whisper fallback, plan → confirm → run |
| `src/styles/` | Design tokens and component CSS (rules in `DESIGN.md`) |

Rules that shape the code: all data comes from the API (no direct database access), external links only through `safeHref()`, no secrets in `VITE_*`, every list is cards in the simple view and tables only in Advanced, axe WCAG 2.1 AA must report 0 violations.

## API structure (summary)

Domain ← Application ← Infrastructure ← Api. Every query is owner-scoped from the signed-in user; enums are stored as strings; migrations exist for both SQL Server (local) and PostgreSQL (cloud); without a connection string the API runs in demo mode (in-memory, guest sign-in). Details: the API repo's `CLAUDE.md` and `docs/`.

## Security boundaries

- The server never automates a logged-in site; LinkedIn/Naukri actions happen only in the desktop agent, in the user's own browser, and stop at any login check or CAPTCHA.
- Server-side fetches go through `SafeFetcher` (public addresses only, redirects re-checked, response size and time caps).
- Paid providers and AI have daily budgets and per-visitor rate limits; guests cannot use them.
- Mailbox and connector secrets are encrypted at rest (AES-GCM).
