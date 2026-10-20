# Security

## Reporting a vulnerability

Please do not open a public issue. Email the maintainers (see the repository owner's profile) with the steps to reproduce and the affected URL or file. We aim to answer within 3 working days.

## How the web app is protected

| Area | What is in place |
|---|---|
| Secrets | Nothing secret is compiled into the bundle: only `VITE_API_BASE_URL`, the Supabase project URL + publishable key and the Hanko project URL are allowed. Provider and AI keys live on the API server only |
| Sign-in | Hanko (main) or Supabase JWT; guest mode issues a short-lived signed token from the API. Dev sign-in is compiled out of production builds (`import.meta.env.DEV`) |
| Guests | Can explore everything except paid parts (voice, AI, live paid boards, sending) |
| External links | Rendered only through `safeHref()` (http/https only) with `rel="noopener noreferrer"` |
| No HTML injection | No `dangerouslySetInnerHTML`, `innerHTML` or `eval` anywhere in `src/` |
| Headers (Vercel) | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (microphone for voice only) |
| Approval | Nothing is sent or applied without a visible tap; bulk actions open a queue the person steps through |
| Dependencies | `npm audit --omit=dev --audit-level=high` runs in CI; Dependabot opens update PRs |

## How the API is protected (summary — details in the API repo's `SECURITY.md`)

Per-visitor rate limits on costly endpoints (guest sign-in, job-board search, lead search, voice, AI writes, assistant, connectors), a 4 MB request-body cap, owner-scoped queries, a server fetcher that only reaches public addresses, daily budgets per paid provider, and encrypted mailbox/connector secrets.

## Known gaps (tracked)

- The Content-Security-Policy restricts scripts to this site plus the hashed theme-boot script (verified on a production build); `connect-src`/`img-src` are left open because company logos and sign-in providers come from many hosts.
- Supabase stores its session in `localStorage` (the library default); with a CSP in place this is the usual SPA trade-off.
