# Free sign-in and MFA — which two to use

> **2026-10-14:** Hanko was chosen as the main sign-in (passkeys, passwords, email codes, TOTP/security-key MFA), with
> Supabase kept as the older sign-in. Setup: [`AUTH_SETUP.md`](AUTH_SETUP.md). The comparison below is kept for history.

_2026-10-12 · recommendation only; nothing is switched on. Today the deployed app signs people in as a private **guest** (no accounts) because the Supabase sign-in keys are not set yet (task U1)._

## The three options you pasted

| Option | Cost | Hosting | MFA | Verdict |
|---|---|---|---|---|
| Authenticator app code (TOTP: Google/Microsoft Authenticator) | Free | None | Yes (the app code) | **Use** |
| Microsoft Entra (native auth / sign-in with Microsoft) | Free tier (check the live pricing page for the monthly-user limit) | None (managed by Microsoft) | Managed by Microsoft; SMS codes may cost money, so do not rely on them | **Use, for sign-in** |
| Authelia (self-hosted) | Free software | An always-on container (Render free plan sleeps; an always-on service is paid) | TOTP, WebAuthn, push | **Skip for now**: too much to run for a small app |

## The two I would pick

1. **Authenticator-app code (TOTP) on top of Supabase Auth.** Supabase Auth is already how the app is built to sign in; TOTP MFA is built into it, free, and needs no server of our own. Works with Google Authenticator, Microsoft Authenticator, 1Password and the rest.
2. **Sign in with Microsoft (and Google) through Supabase.** A work, school or personal Microsoft account signs in with one click. It reuses the **same Microsoft app registration** we need anyway for sending from Outlook, so the owner does one setup, not two.

## What it takes (owner)
- Create the Supabase project and set `Auth__SupabaseUrl` on Render and `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` on Vercel (task U1).
- In Supabase → Authentication → Providers, switch on Microsoft (paste the Entra app's client ID and secret) and Google.
- Switch on MFA (TOTP) in Supabase → Authentication → Multi-factor.

## What I build once those exist
Sign-in buttons for Microsoft and Google; a Security card in Settings with "Set up an authenticator app" (QR code, confirm with a 6-digit code) and "Use a recovery option"; a prompt to confirm the code at sign-in. Until the keys exist this stays listed as upcoming on the Connectors page.
