# Functional requirements (FRD)

_2026-10-13 · version 1 · what the product must do, for whom, and where each requirement stands today. Status words: **Built** (code + tests), **Partial**, **Planned**. "Verified" says what was actually run; anything not listed as verified was not run._

## 1. Purpose and users

OpportunityPilot finds opportunities from sources the user chooses, scores them against criteria with the evidence shown, and helps the user act on them. **The user approves every outreach or application; nothing is sent or applied on its own.**

| User | Goal | Workspace |
|---|---|---|
| **Candidate** | Find jobs, shortlist, apply, reach out, follow up | Candidate |
| **Sales team** | Find companies and leads, reach out, follow up, track | Sales |

Both share one pipeline: **Find → Review → Reach out / Apply → Follow up**. Automation level: **batch approval** (approve many at once, each message still reviewed or approved by exact version).

## 2. Functional requirements

### 2.1 Accounts and access
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

### 2.2 Profile and campaigns
| ID | Requirement | Status |
|---|---|---|
| FR-P1 | Write a profile (what I offer, skills, availability); versions are kept | Built |
| FR-P2 | Messages use only claims the person confirmed | Built, integration-tested |
| FR-P3 | A campaign holds criteria, sources and weights; it can run on a schedule | Built (server schedule); agent scheduling Planned (see plan) |

### 2.3 Finding opportunities
| ID | Requirement | Status |
|---|---|---|
| FR-F1 | Search LinkedIn, Indeed, SEEK through JSearch (200 searches/month) | Built; live JSearch not re-run this session |
| FR-F2 | **All sites** search: free feeds (Arbeitnow, Jobicy, We Work Remotely, Remotive, Remote OK) merged, de-duplicated, ranked, labelled by source | Built, verified live (5 feeds) |
| FR-F3 | Company career boards: Greenhouse, Lever, Ashby, SmartRecruiters, Recruitee, Workable, Workday | Built |
| FR-F4 | Regional boards through RapidAPI (Bayt, Naukri Gulf, JobStreet, StepStone, and any added later by configuration) | Built as a config-driven reader; **off until the owner sets a key and field map**; not verified live |
| FR-F5 | Pasted lists, CSV, web pages, feeds; Wellfound public jobs | Built |
| FR-F6 | Filters: remote, location, visa/relocation text, pay shown | Built |
| FR-F7 | Local agent collects from LinkedIn/Naukri/InstaHyre in the user's own browser | Built; never run against the live sites (U3) |

### 2.4 Review and decide
| ID | Requirement | Status |
|---|---|---|
| FR-R1 | Each job or lead shows score, evidence and gaps; unknown is never counted as a pass | Built |
| FR-R2 | Card list with select, bulk Approve / Skip / Draft messages | Built, verified in Edge |
| FR-R3 | Show when each item was found, its number, and order by best match / newest / oldest / updated | Built, verified in Edge |

### 2.5 Reach out and apply
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

### 2.6 Follow up and track
| ID | Requirement | Status |
|---|---|---|
| FR-T1 | A follow-up reminder is created automatically after a send (5 days) or "Applied" (7 days) | Built |
| FR-T2 | Insights: KPIs with change, trend chart, funnel, progress and weekly goal, sources, fit | Built, verified in Edge |
| FR-T3 | **My activity**: the person's own recorded actions, newest first | Built: searches, runs, profile saves, drafts written/edited/approved, status changes, approvals, sends, follow-ups; filter by kind and period, load more |
| FR-T4 | Sales: companies, contacts, deals, submissions, proposals (staffing pipeline) | Built (API + screens) |
| FR-T5 | Team view (owner, assignment, roles) | Planned (S15, X13) |

### 2.7 Connectors
| ID | Requirement | Status |
|---|---|---|
| FR-C1 | A page listing connectors that exist and those coming (Gmail, Outlook, Calendar, Slack, Notion, HubSpot …) with "I want this" | Built |

## 3. Device and usability requirements
| ID | Requirement | Status |
|---|---|---|
| FR-U1 | Usable on phone, tablet and laptop with no sideways scrolling | Built; checked on iPhone 13/14 Pro Max/iPad Mini (WebKit), Pixel 7/Galaxy S9+ (Chromium) and laptop: no sideways scroll, axe 0; no real phone yet |
| FR-U2 | Simple view by default; Advanced shows tables and detail | Built |
| FR-U3 | Light and dark themes, readable dropdowns | Built |
| FR-U4 | Plain wording, one clear next step per screen, coach marks | Built |
| FR-U5 | Accessible: keyboard, labels, contrast (axe 0 violations) | Built; re-checked on the main screens this session |

## 4. Out of scope (deliberate)
No automatic sending or applying without approval; no scraping of LinkedIn/Indeed pages by the server; no reading of a person's inbox until reply detection (A6) is explicitly approved; no running a logged-in browser on a server.
