---
description: Review the current branch against main before the PR — correctness, accessibility, design rules, data honesty, tests and docs — and report findings
---

1. `git diff main...HEAD --stat`, then read every changed file in full.
2. Check, and list each finding with `file:line`, what goes wrong and how to fix it:
   - **Correctness:** loading, empty and error states; a failed request never leaves a spinner; stale state after save.
   - **Design rules:** tokens only, components from DESIGN.md §7, one primary button per view, copy per §10.
   - **Accessibility:** labels, focus order and return, 44 px targets on a phone, colour never the only signal.
   - **Data honesty and privacy:** no invented figures; nothing secret in `VITE_` or `localStorage`; progress-link tokens never sent
     to analytics or error reports.
   - **Tests:** new logic in a `*Model.ts` with tests; coverage floors still met.
   - **Docs:** the `docs-sync` skill's table is satisfied.
3. Rank findings most severe first. Say plainly when there are none. Do not fix anything unless asked.
