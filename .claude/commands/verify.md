---
description: Run every check this repo needs before a commit and report the results honestly
---

Run, in order, and stop at the first failure (show its output):

1. `npm run typecheck`
2. `npm run lint` (0 warnings)
3. `npm test`
4. `npm run build`
5. UI change: Edge check at 1280 + 375, light + dark, axe 0 (Playwright script against the local dev server)

Then report one line per check with its result and counts (tests passed / failed). Never report a check you did not run. For UI changes, also say whether the Edge check (1280 + 375, light + dark, axe 0) was done.
