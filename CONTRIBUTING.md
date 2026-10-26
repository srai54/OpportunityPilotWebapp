# Contributing

How changes get into `main` (which deploys). The same rules apply to people and to Claude Code.

## Setup once per clone

```bash
git config core.hooksPath .githooks      # pre-commit secret scan (needs gitleaks on PATH)
```

Local run and commands: `CLAUDE.md`. How the assistant is set up (skills, commands, hooks, MCP policy): `docs/AI_TOOLING.md`.

## Flow

1. **Task first.** Add the work to the workspace `TASKS.md` (ID, what, done when, status) before starting.
2. **One branch per batch:** `feature/<name>`, `fix/<name>` or `docs/<name>`. Never commit to `main`.
3. **Small commits** that each build and pass the tests, with messages that say what changed for the user.
4. **Verify** with `/verify` (typecheck, lint, tests with coverage floors, build, AI config). UI work is also checked in Edge
   (1280 + 375, light + dark, axe 0) and follows `DESIGN.md`.
5. **Docs in the same batch:** the `docs-sync` skill lists which document changes with which code.
6. **One PR per batch** with the template in `.github/pull_request_template.md` (What and why, Checked with real numbers, Risk and
   rollback). CI must be green: typecheck, lint, tests and coverage floors, build, npm audit,
   gitleaks, AI config and hook tests, PR template. `/review` before raising it.
7. **Merge** with `bash tools/pr.sh <repo> "<title>" <body-file> --merge` (squash), from the workspace root.
   Then `/live-check` on the deployed site and `/handoff`.

## Review

`CODEOWNERS` requests the owner's review on every PR. The owner has authorised merging a verified batch without waiting
(2026-10-13); CI is the gate that cannot be skipped: `tools/pr.sh --merge` waits for every check on the PR and refuses to merge unless all of them passed. Branch protection on `main` (required status checks) is set by the owner in
GitHub → Settings → Branches once the repositories are public (GitHub does not offer it on private repositories of a free account).

## Never

- Commit secrets, `.env*` (other than `.env.example` / `.env.production`), or anything secret in a `VITE_` variable.
- Force-push, skip hooks (`--no-verify`) or merge with a failing check.
- Claim a check that was not run.
