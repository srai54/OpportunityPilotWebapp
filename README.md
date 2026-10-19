# OpportunityPilot — web app

React 19 + TypeScript + Vite SPA for OpportunityPilot. Two users share one pipeline: a **Candidate** applying to roles, and a **Sales team** using the app as a sales assistant. All data comes from the API in `../OpportunityPilotWebApi`; Supabase is used for sign-in only (guest demo mode when it is not configured).

## What it does

| Workspace | Find | Review | Act | Track |
|---|---|---|---|---|
| Candidate | Jobs from 20+ sites (free feeds, company boards, LinkedIn/Indeed, Naukri, Instahyre) | Score out of 100 with quoted evidence; approve or reject | Apply link or desktop agent; tailored resume | Follow-ups, replies, interview status |
| Sales | Companies hiring for your skills | Lead score with hiring signals | Drafted emails, approve, send from your mailbox | Deals, submissions, shared candidate progress |

**v5 (Oct 2026):** voice launch from any screen (phone mic button; Whisper fallback), animated progress tracker and KPIs, footer status, automatic follow-up drafts, one-line page text. Nothing is sent or applied without your approval.

## Run locally

1. Start the API (`dotnet run --project src/OpportunityPilot.Api` in the API repo, port 5051).
2. `npm install`, copy `.env.example` to `.env.local` (`VITE_DEV_AUTH=true` signs in without Supabase).
3. `npm run dev` → http://localhost:5173

Gate before any change is done: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

## Where to read

| Need | File |
|---|---|
| Stack, commands, folder blueprint, mandatory rules | [CLAUDE.md](CLAUDE.md) |
| Every route and its status | [docs/SCREEN_MAP.md](docs/SCREEN_MAP.md) |
| Screen behaviour per user | [docs/SHARED_FLOW.md](docs/SHARED_FLOW.md), [docs/CANDIDATE_FLOW.md](docs/CANDIDATE_FLOW.md), [docs/SALES_FLOW.md](docs/SALES_FLOW.md) |
| Env vars, API URL, deploy targets, auth modes | [docs/PRODUCT.md](docs/PRODUCT.md) |
| Known gaps and open decisions | [docs/open-questions.md](docs/open-questions.md) |
| AI workflow: skills, commands, hooks | [skills/](skills/prompt-master.SKILL.md), [.claude/commands/](.claude/commands/), [.claude/settings.json](.claude/settings.json) |

Live: https://opportunity-pilot-webapp.vercel.app (API: https://opportunitypilotwebapi.onrender.com). Designs: `../opportunitypilot-ui`. Deployment steps: `../DEPLOY.md`.

## About the data (for reviewers)

This is an MVP running on free or low-credit API plans: SEEK (20 searches), Apollo (50 credits, 25 per search), JSearch for Indeed and LinkedIn (200 searches a month) and Apify for Naukri. When a plan's credits run out, or for a guest session, the search tabs offer **saved results** from real searches, always labelled with their date and "not live". With paid plans in production, every search is real-time. Nothing is ever sent or applied without the person's tap.
