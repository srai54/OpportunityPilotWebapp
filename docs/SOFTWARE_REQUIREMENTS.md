# Software requirements (SRS)

_2026-10-13 · version 1 · how the system is built and the qualities it must meet. Companion to `FUNCTIONAL_REQUIREMENTS.md`._

## 1. Architecture

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
| Web | React 19, TypeScript, Vite, plain CSS tokens (`tokens.css`, `app.css`), vitest | Rules in `DESIGN.md` and the repo `CLAUDE.md` |
| API | .NET 10, Clean Architecture (Domain / Application / Infrastructure / Api), EF Core | Two migration sets: Postgres and SQL Server |
| Data | Supabase Postgres, schema `app`, tables created by API migrations on start | `SQL.md` lists the verification queries |
| Auth | Supabase Auth (JWT), guest tokens for demo, agent keys for the local agent | Sign-in keys not set yet (U1) |
| Hosting | Vercel (web), Render free plan (API, sleeps when idle) | Every merge to `main` deploys both |

## 2. External interfaces
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

## 3. Non-functional requirements

### 3.1 Security and privacy
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

### 3.2 Reliability and performance
| ID | Requirement | State |
|---|---|---|
| NFR-R1 | A sleeping free-tier API shows "Starting the API…" rather than an error, and retries | Built |
| NFR-R2 | Each send happens at most once per approved version (idempotency key); a failed attempt can be retried | Built, tested |
| NFR-R3 | Free feeds cached 30 minutes; provider failures are shown per source, never hidden | Built |
| NFR-R4 | Pages usable within ~3 s on a mid-range phone on 4G after the API is awake | Not measured |

### 3.3 Accessibility and devices
| ID | Requirement | State |
|---|---|---|
| NFR-D1 | WCAG 2.2 AA intent: axe 0 violations, keyboard operable, visible focus, reduced-motion respected | Checked on main screens |
| NFR-D2 | **Supported devices:** iPhone 13 and newer (Safari, iOS 15+, 390×844 up to 430×932), Android phones on current Chrome (360–412 px wide), iPad / Android tablets (768–1024 px), laptops (1280 px and up); light and dark | Checked with real WebKit and Chromium device profiles (see `IMPLEMENTATION_PLAN.md` §5) |
| NFR-D3 | No horizontal scroll at 360 px; touch targets at least 44×44 px; inputs at 16 px so iOS does not zoom; safe-area insets honoured; installable to the home screen | Built (web manifest, safe areas, 16 px fields, 44 px controls); installed-app behaviour not tested |
| NFR-D4 | Browsers: current Edge, Chrome, Safari, Firefox | Edge verified; others by device profiles in P4 |

### 3.3 Maintainability and process (55 Tech standard)
| ID | Requirement | State |
|---|---|---|
| NFR-M1 | Each repo has a `CLAUDE.md` (stack, commands, folder blueprint, rules) and one-concern docs under `docs/` | Present |
| NFR-M2 | Flow docs for each screen; open questions logged with ID, priority, owner | Present, updated per change |
| NFR-M3 | Tests: pure logic unit-tested; API integration-tested against Postgres | API 485 unit + 95 integration; web 295 |
| NFR-M4 | Small logical commits, one branch per batch, one PR per repo, merge only when verified | Followed |
| NFR-M5 | `TASKS.md` lists every task before work starts; `HANDOFF.md` updated each session | Followed |
| NFR-M6 | Design rules in `DESIGN.md` are mandatory for UI work | Followed |

## 4. Constraints and assumptions
- Free-tier hosting: the API sleeps; Render and Vercel limits apply to every deploy.
- JSearch is limited to 200 searches a month; tests use at most 10 live searches per task.
- LinkedIn and Naukri forbid automated use; the local agent is opt-in, low-limit, dry-run by default, and was never run live.
- Sending from a mailbox needs the owner to register an Entra and a Google app once; Google treats `gmail.send` as a sensitive scope (test-user mode works for a small group).
- Supabase keys are not set yet, so account sign-in and MFA cannot be verified live.
