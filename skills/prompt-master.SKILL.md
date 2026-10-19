---
name: prompt-master
description: Clarify a vague request for the OpportunityPilot web app before writing code. Fires when two or more context dimensions are missing (which user, which screen/flow-doc entry, which API contract, acceptance checks...). Gathers everything in ONE structured question burst, tailored to this codebase.
---

# prompt-master — one question burst for vague requests

Wired from `CLAUDE.md` → Mandatory rules. Read this before writing code when a request is vague.

## When it fires

Score the request against the dimensions below. **Two or more missing → fire.** One missing → make the obvious assumption, state it in one line, proceed. None missing → do not fire.

| # | Dimension | Answer it yourself first from | Missing when |
|---|---|---|---|
| 1 | Which user | Request wording; Job vs Customer mode; `docs/SCREEN_MAP.md` | It could be Candidate, Sales or both, and behaviour differs |
| 2 | Which screen / route | `docs/SCREEN_MAP.md`, `src/App.tsx` | No route or component can be pinned down |
| 3 | Flow-doc entry | `docs/CANDIDATE_FLOW.md`, `docs/SALES_FLOW.md`, `docs/SHARED_FLOW.md` | No entry exists, or the request contradicts its Actions/Validation |
| 4 | API contract | `../OpportunityPilotWebApi/docs/api-contracts.md`, `src/lib/types.ts` | The data or endpoint needed is not in a contract (e.g. batch approval, Freelancer.com bids, proposals) |
| 5 | Output shape | Flow-doc "What it shows"; design `../opportunitypilot-ui/*.dc.html` | Unclear what appears, where, and in which states (loading, empty, error, not built) |
| 6 | Constraints | `CLAUDE.md` rules; `docs/open-questions.md` | Conflicts with a rule (no fabricated data, tokens only, approval model, no secrets) or touches an open OQ |
| 7 | Acceptance checks | Flow-doc "Validation" | No way to tell when it is done: CTA enable/disable conditions, error cases, 375 px, keyboard/screen-reader behaviour |
| 8 | Edge cases | Contract error codes (400, 404, 409), demo/guest mode, API asleep | Behaviour on conflict, empty data or unreachable API is unstated |

## How to ask

- One message, at most **five** questions, numbered, each with the options you found in the code or docs and your recommended default.
- Lead with what you already know (screen, files, endpoints) so the user only fills gaps.
- Never ask what the repo already answers. Never ask one question at a time.
- After the answers: update or create the flow-doc entry first (all fields, `Status: not built`), log anything still undecided in `docs/open-questions.md`, then build.

## Question bank (pick the ones that apply)

| Dimension | Question template |
|---|---|
| User | "Is this for the **Candidate** (Job mode, apply agent) or the **Sales team** (Customer mode, outreach), or both? Default: <inferred>." |
| Screen | "Which screen: <route A> (`<component>`) or a new screen? If new, which nav section and route — proposed `<route>`?" |
| Flow doc | "There is no entry for this in `docs/<ROLE>_FLOW.md`. I will add one with these actions and validation: <draft>. Correct?" |
| Contract | "The API has no endpoint for <thing> (`api-contracts.md`). Should I (a) wait for the contract, (b) build the UI as `NotBuiltPage`, or (c) use <existing endpoint> instead?" |
| Approval | "Approval model for this: per version (current contract) or batch 'Approve all' (product decision 2026-10-05, OQ-FE-001)?" |
| Acceptance | "Done means: <CTA> enabled only when <conditions>; errors shown via `ErrorNotice`; 409 keeps edits; no overflow at 375 px; typecheck/lint/test/build green. Anything to add?" |
| Edge cases | "When <empty / 409 / API asleep / guest demo mode>, should it <option A> or <option B>?" |

## Example burst

> I can place this on `/opportunities/:id` (`OpportunityDetailPage.tsx`). Before I build, five gaps:
> 1. User: Sales only (Customer opportunities), or also a Candidate cover note? Default: Sales.
> 2. Contract: drafts are in `M4_M5_CONTRACT.md` but the API has not built them. Build now as a not-built section, or wait?
> 3. Approval: per version (contract) or batch (OQ-FE-001)?
> 4. Flow doc: I will add "Opportunity — Email draft" to `docs/SALES_FLOW.md` with Approve disabled when the body is empty or the recipient is unverified. OK?
> 5. Done when: typecheck, lint, test, build green and no overflow at 375 px. Anything else?

## Anti-patterns

- Never guess an endpoint, DTO field or enum value to avoid asking.
- Never fill a gap with sample data "for now".
- Never ask questions one by one across several turns.
- Never fire for a clear, single-file change (a copy fix, a CSS rule with a file:line).
- Never proceed on an answer that contradicts `CLAUDE.md` without saying so.
