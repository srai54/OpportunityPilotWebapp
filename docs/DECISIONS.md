
## 2026-10-13 — "No bulk apply" reworded; apply queue added
The Settings rule "No bulk send, no auto-apply" contradicted the product decision (automation level: batch approval) and left nothing to use after approving a batch. Decision (user request): approve a batch once; **Apply to all approved** is a guided queue that opens each posting for the person to submit, and each one is recorded separately (Applied + follow-up). The app still never submits an application itself. Send all (mailbox) follows the same pattern.

## 2026-10-14 — Hanko is the main sign-in; Supabase is "the older sign-in"
User request: add Hanko (open source; passkeys, passwords, email codes, TOTP and security-key MFA) as the main sign-in,
keep Supabase working as a fallback and guests unchanged. Decision: when `VITE_HANKO_API_URL` is set, the sign-in page
shows Hanko's own `<hanko-auth>` element (themed with our tokens through its CSS variables) and links to the Supabase
form as "Use the older sign-in (Supabase)"; Settings → Security shows `<hanko-profile>` for Hanko users. The package
(`@teamhanko/hanko-elements` 3.0.0, SDK pinned to 3.0.0) is loaded only when the URL is set, so other deployments are
unchanged. Hanko and Supabase users are separate owners in the API (no account linking). Setup: `docs/SETUP.md`.
