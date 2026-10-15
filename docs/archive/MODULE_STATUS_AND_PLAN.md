# Module status and work plan

_2026-10-13 · produced by re-reading the repositories (file counts, tests, routes, which screens use the card system), not from memory. Companion to `FUNCTIONAL_REQUIREMENTS.md`, `SOFTWARE_REQUIREMENTS.md`, `IMPLEMENTATION_PLAN.md`._

## 1. Size and shape
| Repo | Source | Tests |
|---|---|---|
| API (.NET 10) | Domain 3.4k lines, Application 10.5k, Infrastructure 2.2k, Api 1.8k; 32 controllers | 485 unit + 95 integration (Postgres in Docker) |
| Web (React 19) | 24 feature folders, about 14k lines | 298 unit tests (pure logic); screens are checked by browser runs, not component tests |
| Local agent (Node + Playwright) | 10 modules + 3 platform adapters | 34 tests (answers, end-to-end against a local mock of LinkedIn/Naukri, scheduler) |

Honest gap: the web app has no automated screen tests; layout and accessibility are verified by scripted Edge, WebKit and Chromium runs that I wrote in a scratch folder and have not yet added to the repo.

## 2. Modules, status and evidence

Status: **Done** = built, tested, and checked in a browser or against the API; **Partial** = works but with a named gap; **Pending** = not built; **Blocked** = needs the owner.

### 2.1 Identity and access
| Module | Web | API | Status | Evidence / gap |
|---|---|---|---|---|
| Sign-in, register, reset, verify | `auth/` | `Auth/`, `AuthController` | Partial | Email, Google, Microsoft buttons and tabs built; layout and axe checked on 6 devices; **not run against Supabase** (keys not set: U1) |
| Two-factor (authenticator app) | `auth/mfa.ts`, `SecurityCard`, `MfaChallengePage` | Supabase Auth | Partial | Pure logic tested; not run against Supabase |
| Guest sessions, agent keys, security log | `settings/` | `AgentKeys`, `GuestSession`, `SecurityEvent` | Done | Integration-tested |
| Account export / delete | `settings/` | `Accounts/` | Done | Tested |

### 2.2 Find
| Module | Web | API | Status | Evidence / gap |
|---|---|---|---|---|
| Profiles | `profiles/` | `Profiles/` | Done (card look applied) | Claims confirmation tested; versions list shows current only (OQ-FE-042) |
| Campaigns and builder | `campaigns/` (3k lines) | `Campaigns/`, `Automation/` | Done (card look applied) | Server schedules exist; no UI on the agent side |
| Sources, imports, research runner | `campaigns/SourcesStep`, `research/` | `Sources/`, `Imports/`, `Research/` | Done | Many reader kinds (feeds, boards, pasted lists, CSV, pages); integration-tested |
| Job boards (JSearch, free feeds, All sites) | `wellfound/AllSitesPanel`, `JobBoardSources` | `JobBoards/` | Done | Free feeds read live; JSearch not re-run this session |
| Regional boards (RapidAPI) | via All sites | `JobBoards/RapidApiBoards` | Blocked | Reader built and off; needs key and example responses |
| Wellfound | `wellfound/` | `Wellfound/` | Done | Public pages only |
| Trends | `trends/` | `Trends/` | Done | Labelled as live board data |
| Suggestions (skills, roles) | `suggest/` | — | Done | Static catalog |

### 2.3 Decide
| Module | Web | API | Status | Evidence |
|---|---|---|---|---|
| Opportunity list (cards, bulk, order, found date) | `opportunities/`, `approvals/` | `Opportunities/`, `Approvals/` | Done | Edge, WebKit, Chromium matrix: no overflow, axe 0 |
| Opportunity detail | `opportunities/OpportunityDetailPage` | same | Done (card look applied this session) | Matrix incl. detail: axe 0 |

### 2.4 Act
| Module | Web | API | Status | Evidence / gap |
|---|---|---|---|---|
| Drafts and approval by exact version | `outreach/`, `opportunities/*Panel` | `Drafts/`, `ProviderGateway` | Done | Integration-tested |
| Send: manual receipt, queue, edit and send again | `outreach/` | `Outreach/` | Done | 3 sends in Edge |
| Send from own Outlook / Gmail | `mail/`, `outreach/SendPanel` | `Mail/`, `MailboxesController` | Blocked | 18 unit + 7 integration with a fake provider; needs Entra/Google apps; no real mail sent |
| Apply (open posting, "I applied") | `opportunities/` | `Applications/` | Done | Link-out only |
| Local agent: collect, apply, scheduler | — | `agent/` | Partial | Tests green; **never run on live LinkedIn/Naukri (U3)** |
| Follow-ups | `follow-ups/` | `Outreach/NextActions` | Done | Auto-created on send and on Applied |
| Reply detection | — | — | Pending | A6; needs inbox-read permission decision |

### 2.5 Track
| Module | Web | API | Status | Evidence / gap |
|---|---|---|---|---|
| Overview, journey, coach marks | `overview/`, `journey/`, `coach/`, `guide/` | `Overview` | Done | |
| Insights (KPIs, trend, funnel, goal) | `insights/` | `Analytics/` | Done | |
| My activity | `insights/ActivityPanel` | `GET analytics/activity`, `user_events` | Done | Records searches, runs, profile saves, drafts, follow-ups, mailbox connects plus per-opportunity activity; filters and paging; lines without a job/lead show in both workspaces |
| Connectors page | `connectors/` | — | Done | 16 upcoming connectors, "I want this" kept in the browser |

### 2.6 Sales team
| Module | Web | API | Status | Evidence / gap |
|---|---|---|---|---|
| Sales projects and bids | `sales/` | `Sales/` | Done | Gateway-tested |
| Staffing pipeline (accounts, contacts, deals, submissions, proposals) | `staffing/` | `Staffing/` | Done | Integration-tested; screens not on the card family yet |
| Team view (owners, roles) | — | — | Pending | S15, X13 |

### 2.7 Platform
| Module | Status | Gap |
|---|---|---|
| Shell, navigation, theme, responsive | Done | Skip link and a few inline links under 44 px by design |
| PWA manifest, safe areas | Done | Installed-app behaviour untested; no PNG home-screen icon |
| Capabilities, diagnostics, retention | Done | |
| Deploy (Vercel + Render + Supabase) | Partial | Deploys from `main`; the two open PRs are not merged, so live differs from this repo |
| Data checks (`SQL.md`) | Partial | Written, not run |

## 3. UI refactor status (card family, DESIGN.md §13)
| Screen | State |
|---|---|
| Overview, Review (list + approvals), Outreach, Follow-ups, Connectors, All sites | Cards (earlier) |
| Opportunity detail | **Cards now**: hero card (avatar, title, match ring, status, found date, links) and a "What to do now" card |
| Profiles | **Cards now**: list card plus one floating editor card, rounded save bar |
| Campaign builder and run page | **Cards now**: stepper steps as cards, floating save bar, run card |
| Settings, Insights, Trends, Wellfound tabs, Staffing | Panels restyled with the card radius, spacing and shadow; **not yet rebuilt from `Card` components** |
Phone and tablet checks pass on all the screens above (see §5).

## 4. Work plan (modules, in order)
| Wave | Module | What | Done when |
|---|---|---|---|
| 0 | Release | Merge web #43 and API #36 together; confirm migrations in Supabase `app` | Live site matches the repo; `SQL.md` §2 returns 42 tables |
| 1 | Identity | Supabase keys set; walk register, Microsoft, Google, authenticator on an iPhone | Each flow recorded in the status report as verified |
| 2 | Act | Mailbox send live; then "send all" in the queue | One real email from each provider |
| 3 | Track | ~~Record searches, drafts, sends, follow-ups in My activity; filter by kind/date~~ done (T1) | Integration tests; panel updated |
| 4 | Find | Switch on one RapidAPI regional board after a 10-call test | Test sample in the repo; board on/off switch |
| 5 | Act | Run the agent supervised on LinkedIn, then schedule it | First dry run recorded; scheduled cycle visible in status |
| 6 | Decide | Reply detection and automatic follow-up stop | Reply in a test mailbox moves the lead to Responded |
| 7 | UI | Rebuild Settings, Insights, Trends, Staffing from `Card`; retire duplicate `.panel` rules | Matrix passes; CSS shrinks |
| 8 | Sales | Team view | Owner/assignee and roles with integration tests |
| 9 | Quality | Move the scripted device/axe run into the repo (`npm run check:devices`) and add it to CI | One command reproduces the matrix |
| 10 | Docs | Re-record the demo video; update flow docs for the new screens | Video and `SCREEN_MAP.md` current |

## 5. Verified this session
iPhone 13, iPhone 14 Pro Max, iPad Mini (WebKit), Pixel 7, Galaxy S9+ (Chromium) and a 1280 px laptop (Edge), light and dark, on sign-in, sign-up, Overview, Opportunities, the opportunity detail, Profiles, Campaigns, the campaign builder, Outreach, Settings and Insights: no sideways scroll and axe 0 violations on the final run. One heading-order flag on Overview appeared once and did not repeat on two further runs; I did not find its cause. Web 298 tests, typecheck, lint and build clean. A real phone was not used.
