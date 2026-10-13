# Implementation plan — what is pending and how to finish it

_2026-10-13 · read with `FUNCTIONAL_REQUIREMENTS.md`, `SOFTWARE_REQUIREMENTS.md` and `FINAL_STATUS_REPORT.md`. Task IDs match `TASKS.md` at the workspace root. "Needs you" means I cannot do it without an account, key or decision from the owner._

## 1. Where we are
The product runs end to end locally (find → review → draft → send → follow up) for both Candidate and Sales, with the card UI, bulk actions, free job feeds, Insights, mailbox sending (built, not configured), sign-in with Microsoft/Google/email, an authenticator-app second factor (built, not verified live) and a phone/tablet pass. Two PRs (web #43, API #36) hold the earlier work and are **not merged**; the newest commits are local only.

## 2. Pending work, in the order I recommend

| # | Work | Why now | Depends on | Effort | Done when |
|---|---|---|---|---|---|
| 1 | **Release the branches** (merge both PRs together, push the newest commits first) | Everything below is verified against a deployed build; the preview and the API are different builds today (likely cause of the Outreach 500) | Your "merge" | 0.5 day | Live site shows the new screens; `/api/v1/diagnostics` says `pendingMigrations: 0`; tables visible in Supabase schema `app` (`SQL.md` §2) |
| 2 | **Supabase sign-in on** (U1) | Unblocks real accounts, Microsoft/Google sign-in and the authenticator app | Needs you: Supabase URL + publishable key on Vercel, URL on Render; Microsoft and Google providers switched on in Supabase; MFA (TOTP) switched on | 0.5 day | Register, verify email, sign in, Microsoft, Google, enrol authenticator, sign out and back in with a code — each walked once in Edge and on an iPhone |
| 3 | **Row-level security / schema exposure** (I1) | Real accounts mean real data | #2 | 0.5 day | `SQL.md` §14 returns `false, false` |
| 4 | **Mailbox sending live** (K4) | Removes the compose-window step | Needs you: Entra app + Google OAuth client, `Mail__*` on Render | 0.5 day | One real email sent from Gmail and one from Outlook; receipt says *accepted*; token stored encrypted |
| 5 | **Reply detection and follow-up stop** (A6) | Closes the loop: reply → status Responded → follow-ups stop | #4; adds read permission (`gmail.readonly` / `Mail.Read`) which Google reviews as a restricted scope — decide whether to ask for it | 4–5 days | A reply in a test mailbox moves the lead to Responded within minutes; an opt-out adds a suppression |
| 6 | **Bulk "send all" from the queue** | One click for many (builds on #4) | #4 | 1 day | 10 approved messages go out in one action, each with its own receipt; a failure stops and says which |
| 7 | **More job providers** (see §3) | Wider coverage, regions | RapidAPI key + field maps (needs you) | 1–2 days per provider | Each provider: 10-call test recorded, mapping tested on a real sample, switch to turn it off |
| 8 | **Agent scheduler** (options A–C in the exploration) | Hands-off collection | U3 first (the agent has never run live) | 1 day (A+B), 3 days (C) | Scheduled collect + dry run on your computer; app shows when the agent last ran |
| 9 | **My activity, complete** | "Track what each person did" | — | 1–2 days | Searches, draft edits, sends and follow-ups recorded with filters by kind and date |
| 10 | **Sales team view** (S15/X13) | Teams, not only individuals | — | 1 week | Owner/assignee, roles, team activity feed |
| 11 | **K2 leftovers** | Consistent cards everywhere | — | 1–2 days | Profile, Campaign form and job detail as cards; Edge matrix passes |
| 12 | **Demo video re-record** and handoff | Hackathon submission | #1, #2 | 1 day | Video shows the card flow on laptop and phone |

## 3. Job providers: what exists and what to add

| Group | Provider | State | Next step |
|---|---|---|---|
| Aggregator | JSearch (LinkedIn, Indeed, SEEK) | Built, 200 searches/month | Keep; budget shown in the UI |
| Free feeds | Arbeitnow, Jobicy, We Work Remotely, Remotive, Remote OK | **Built, verified live** | Maintain |
| Company boards | Greenhouse, Lever, Ashby, SmartRecruiters, Recruitee, Workable, Workday | Built | Workday live sample (Y4, needs you) |
| Regional via RapidAPI | Bayt, Naukri Gulf, JobStreet, StepStone | Reader built, **off**; mappings unit-tested on invented samples | Subscribe, send each API's example response, run the 10-call test, switch on |
| Other RapidAPI hub options | Candidates listed in `RAPIDAPI_OPTIONS_ANALYSIS.md` (hiring-signal and job-search APIs) | Analysed, none subscribed | Pick by region; each one is a config entry (`RapidApi__Boards__<id>__…`) |
| Not recommended | Server-side scraping of LinkedIn/Naukri/Glassdoor | — | The local agent is the compliant route |

Rule for every new provider: official or licensed access first, a 10-call test before enabling, source and date shown on every result, an off switch, and failures shown per source.

## 4. Sign-in and security design (decided)
- **Accounts:** Supabase Auth stores credentials (the app never sees or stores a password). Register and sign in sit on one screen with tabs; Microsoft and Google are one tap; email + password is the fallback; guests are kept for demos.
- **Two-factor:** authenticator-app code (TOTP) through Supabase MFA — free, no server of our own. After sign-in the account is asked for the code when a factor exists (`aal1 → aal2`). Setup and removal are in Settings → Security. Authelia was rejected (needs an always-on container).
- **Not yet verifiable:** all of the above without the Supabase keys. Pure logic is unit-tested; the screens were checked in a throwaway preview with a placeholder URL (layout and accessibility only).

## 5. Devices
Supported: iPhone 13 and newer (Safari/WebKit), Android phones (Chrome, 360–412 px), iPad / Android tablets, laptops. Checked with Playwright's real **WebKit** engine (iPhone 13, iPhone 14 Pro Max, iPad Mini) and Chromium device profiles (Pixel 7, Galaxy S9+) plus Edge at 1280 px, light and dark, on sign-in, sign-up, Overview, Opportunities, Outreach, Settings and Insights: no sideways scroll and axe 0 violations. **Not done:** a real phone, the installed home-screen app, iOS older than 15, slow-network timing.

## 6. Standards followed (55 Tech AI Academy)
`CLAUDE.md` per repo with commands and rules; one-concern docs (this pack, `SQL.md`, flow docs, `DESIGN.md`, `DECISIONS.md`, open questions); tests for pure logic and API integration; small logical commits on a batch branch; one PR per repo; `TASKS.md` before work and `HANDOFF.md` after; claims marked verified or not. Open gap: the hooks and skills folders were set up earlier but not re-audited this session.

## 7. Risks
| Risk | Mitigation |
|---|---|
| Free-tier sleep and deploy limits | One push per batch; "Starting the API…" notice |
| LinkedIn/Naukri terms | Local agent only, dry run default, low limits; never server-side |
| Google restricted scope for reading mail | Send-only now; reading (A6) only after an explicit decision |
| Preview and API out of step | Merge web and API together |
| Unverified live pieces | Listed in the status report; none described as working |
