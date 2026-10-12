# Workflow, guidance and design plan — "always know what to do next"

_2026-10-12 · owner brief: "after creating a profile I don't know what to do, I have to come back to campaigns… simplify, even if the application logic has to change; coach marks on every step behind a toggle; complete the Sales version; the simple view still does not look good."_

## 1. The problem, concretely

| Where the person gets lost today | Why |
|---|---|
| After **Create profile** the page just reloads the profile | Nothing says "next: find jobs"; Campaigns is a menu item |
| **Find jobs** → results → "Start a campaign" → builder → run page → results → approvals tab | Seven screens and three vocabularies for one idea |
| After **Approve** | No pointer to "apply" or "reach out" |
| After **sending** | No follow-up is created or mentioned |
| The sidebar lists 6–13 places | A new person does not know which one is "next" |
| Sales sees the same screens with different words | The path (profile → hiring companies → leads → outreach → follow-up → deal) is not visible |

**Principle:** the app, not the person, remembers where they are. Every screen shows **one** next action; menus are for people who already know the product (Advanced).

## 2. The journey (the new spine of the UI)

Five steps, the same shape for both workspaces:

| # | Candidate | Sales | Done when |
|---|---|---|---|
| 1 | **Profile** — what you offer and your skills | **Profile** — what you sell | a profile exists |
| 2 | **Find jobs** | **Find companies** (who is hiring) | a search was turned into a campaign (or a run finished) |
| 3 | **Review** — approve the best matches | **Review** — approve the best leads | something is approved |
| 4 | **Reach out / Apply** — apply, or message a recruiter | **Reach out** — LinkedIn note / email | a draft was sent (receipt) or a job marked applied |
| 5 | **Follow up** — check replies, nudge | **Follow up** — replies, meetings, deals | a follow-up exists / a reply arrived |

`nextStep(state, workspace)` (a pure function, unit-tested) returns the single next action with its target and one plain sentence. It is shown in a **Next bar** on every page and drives the **post-action redirects**:

- Profile saved → **straight to a pre-filled "New campaign"** (search terms taken from the profile's skills) — no menu hunting.
- "Create & run" → run page → **Review** (the "Waiting for approval" view opens when there is something to approve).
- Approve → the opportunity page with **Approve & apply / Reach out** highlighted.
- Receipt pasted ("I sent it") → **a follow-up is scheduled automatically** and the Next bar says so → Follow up.
- Empty states always end in a button for the next step, never in a description.

## 3. New shell

| | Simple (default) | Advanced |
|---|---|---|
| Navigation | **Journey bar** across the top: ① Profile ② Find ③ Review ④ Reach out ⑤ Follow up (done = ✓, current = highlighted, click to jump). **No sidebar.** Logo → Home | The full sidebar as today (Campaigns, Follow-ups, Staffing, How it works…), plus the journey bar |
| Top bar | Logo · Candidate \| Sales · journey bar · **Guide** switch · **Advanced** switch · ? · theme · account | same |
| Phone | one compact "Step 3 of 5 · Review →" bar | drawer |
| Page body | Centred column (max ~1040 px), task-first header (title + one sentence + one primary button), cards as soft floating tiles | wide layout |

## 4. Guide mode (the toggle the owner asked for)

- A **Guide** switch (top bar and Settings), on by default for a new person, remembered per browser.
- **On:** the Next bar is shown on every page **and** a coachmark tour (3–4 steps, the pattern's limit) starts on every screen of the journey: Home, Profile, Find jobs (+ Trends), New campaign, Run, Review, Opportunity, Reach out, Follow up, and the Sales equivalents. Turning it on **restarts all tours**.
- **Off:** no tips, no Next bar; the **?** button still replays the current screen's tips on demand.
- Tips only point at things that are on screen; a missing target is skipped.

## 5. Design (what is borrowed, from the real DESIGN.md files)

Sources checked: getdesign.md, VoltAgent/awesome-design-md, designmd.ai. Kept **Notion** as the palette (calm paper, one blue). Borrowed structure only:

| From | What we use |
|---|---|
| **Zapier** | Numbered **workflow steps** as the primary UI metaphor (the journey bar and the Getting-started card); warm cream ground |
| **Intercom** | Soft floating white tiles with hairline borders, 8–16 px radii; guidance written in short human sentences |
| **Cal.com** | Generous whitespace, ~12 px cards, one clear primary button per screen, friendly large type |
| Rejected | Linear (dark-first marketing), Clay (illustration-heavy), Airtable (editorial long-scroll) — wrong density for a task app |

Type: Inter, body 15 px in simple mode (14 px in Advanced tables), headings 24–28 px; line length ≤ 70 ch; one primary button per page; secondary actions as quiet text buttons.

## 6. Sales version — complete path

Profile ("what you sell") → **Find companies** (hiring signals on LinkedIn/Indeed/SEEK/Wellfound + Trends) → **Review leads** (approve) → **Reach out** (LinkedIn note / email, from the connected mailbox when available) → **Follow up** (automatic sequence, replies, meetings) → **Deal** (staffing stages, Advanced). Sales wording everywhere (company, lead, hiring signal), and a Sales-specific Next bar.

## 7. Build order and checks

W2 next-step engine → W3 shell (journey bar, Advanced rail) → W4 guide toggle + tours → W5 redirects and empty states → W6 visual pass → W7 Sales pass → Edge walkthrough of both journeys at 1440 / 375 px in light and dark, axe 0, unit tests for `nextStep`, one merge.

## 8. Risks

- **Moving navigation** surprises existing users → Advanced keeps the sidebar; the Advanced switch is in the top bar.
- **Too many tips** → one tour per screen, ≤ 4 steps, skippable, "Skip tips" turns Guide off.
- **Redirect loops** → redirects fire only on the specific success events listed above.
