# Next batch (tracked from the 2026-10-15 request)

Done in `feature/redesign-v5-voice`: page subtitles cut to one short line on 14 screens; v5 colour, voice launch from any screen (phone button), animated journey progress, count-up KPIs, footer, docs index (`docs/README.md`). Nothing was moved or deleted.

| # | Item | Why it is not in this batch | Done when |
|---|---|---|---|
| N1 | **Paused by you (2026-10-15).** Backend layering: Controller → `I…Service` (BL) → `I…Repository` (repo), module by module starting with Campaigns, Opportunities, Profiles | 36 controllers; must keep every endpoint identical and needs the .NET build + 580 tests per module | Each module has interfaces, DI registration, unchanged routes, tests green |
| N2 | Whisper transcription: `POST /api/v1/voice/transcribe` (OpenAI `whisper-1`, key `OpenAi__Key` on Render only), used when browser speech is missing (Firefox, some Android) | Needs the API change and a key; no .NET 10 SDK reachable from this session to build and test it | Firefox records and transcribes; no key → falls back to typing |
| N3 | Redesign pass on remaining screens (Staffing, Settings, Insights, Trends) with the v5 card + KPI rules | Time | All screens on `Card`/`KpiBand` |
| N4 | Sales → candidate shared interview status (progress link exists): add interview stage timeline the candidate can see | Already live: `/progress/<token>` shows stage path, interview round, countdown, join link and calendar file. Next: candidate-side dashboard in the separate repo | Candidate page shows stage + next interview |
| N5 | Real-user scenario runs (guest mode, Candidate + Sales, phone) recorded as the demo video with narration | After deploy | Video in `/video`, linked from README |
| N6 | Automate manual steps: auto-record "I applied" from the agent, auto follow-up drafts after N days | API changes need the .NET build (not reachable here) | Toggle in Autopilot |
| N7 | Done 2026-10-15: superseded docs moved to `docs/archive/`, workspace plan files to `_archive/` (nothing deleted) | — | — |
