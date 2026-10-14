# Sign-in setup — Hanko (main) with Supabase as the fallback

_2026-10-14. Owner guide. Hanko is built into the app and the API but switches on only when its URL is set; until then
everything works exactly as before. Not yet verified against a live Hanko project (OQ-FE-045, API OQ-BE-032)._

## What the visitor gets

| Setting | Sign-in page | Settings → Security |
|---|---|---|
| Nothing set (today) | Guest only ("Accounts are not switched on…") | — |
| Supabase only | Microsoft, Google, email + password; Continue as guest | Supabase authenticator-app card |
| **Hanko set** | **Hanko's sign-in first** (passkey, password or email code, then the second factor if the account has one; it also creates accounts). Below it: "Use the older sign-in (Supabase)" when Supabase is set, and Continue as guest | Hanko accounts: Hanko's own profile (emails, password, passkeys, authenticator app, security keys). Supabase accounts: the Supabase card as before |

A Hanko account is a **new workspace**: data made while signed in with Supabase or as a guest is not moved over (the API
keeps each sign-in system's users apart on purpose).

## 1. Create the Hanko Cloud project

1. Sign in at <https://cloud.hanko.io> and create (or open) your organisation.
2. **Create project** → choose **Hanko** (the full authentication product, not "Passkey API") → name it `OpportunityPilot`.
3. **App URL**: the production web address, e.g. `https://opportunitypilot.vercel.app` (exactly, no trailing slash).
   Hanko uses it for two things: the browser origin allowed to call Hanko (CORS) and the passkey domain (relying-party
   id). Vercel **preview** addresses are different origins, so Hanko sign-in only works on the production address.
4. For local development create a **second project** (e.g. `OpportunityPilot dev`) with App URL `http://localhost:5173`.
   Keep the two apart: passkeys made for one domain never work on the other.

## 2. Switch on the sign-in methods

In the project's settings (names may differ slightly in the console):

| Where | Switch on |
|---|---|
| Authentication / Login methods | **Passkeys**; **Email passcodes** (one-time codes); **Passwords** if you want them |
| Multi-factor authentication (MFA) | **Authenticator app (TOTP)** and **Security keys**. Turn on **"MFA required"** (enforce) if every account must have a second factor; otherwise people add it in Settings → Security |
| Session | Keep the default lifetime. Note: the API accepts a session token until it expires, even if you revoke the session in Hanko |

## 3. Copy the API URL

The project overview shows the **API URL**, like `https://<project-id>.hanko.io`. It is public (it is meant for the
browser), so it is safe in a `VITE_` variable. It is not a secret key, and Hanko's API keys are **not** needed here.

## 4. Set it on Vercel (web) and Render (API)

| Where | Variable | Value |
|---|---|---|
| Vercel → Project → Settings → Environment Variables (Production) | `VITE_HANKO_API_URL` | the API URL from step 3 |
| Render → API service → Environment | `Auth__HankoApiUrl` | the same API URL |
| Render → API service → Environment (recommended) | `Auth__HankoAudience` | the web domain without `https://`, e.g. `opportunitypilot.vercel.app` (Hanko puts this in the token's `aud`) |
| Render (only if needed) | `Auth__HankoIssuer` | only if the API rejects Hanko tokens because the project sets a custom issuer (see troubleshooting) |

Set **both** sides. With only the web variable, people can sign in to Hanko but the API answers 401 and the app signs
them out ("Your session ended"). Then redeploy both: Vercel compiles `VITE_` values at build time.

Keep `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` and `Auth__SupabaseUrl` set if the older sign-in should stay.
`Auth__AllowGuests=false` on Render switches guest access off once Hanko (or Supabase) is on.

Local development: put `VITE_HANKO_API_URL=<dev project URL>` in `.env.local`, and run the API with
`Auth__HankoApiUrl=<dev project URL>` and `Auth__HankoAudience=localhost`.

## 5. Check it

1. `GET https://<api>/api/v1/capabilities` → `"signInProviders": ["hanko", "supabase"]` (or `["hanko"]`).
2. Open the site signed out: Hanko's sign-in shows first. Create an account with your email, add a passkey when asked.
3. After sign-in the app opens and stays open (pages load data). Settings → Security shows your passkeys and the
   authenticator-app option; Settings → Account says "Hanko (passkey, password or email code)".
4. Sign out from the account menu, then sign in again with the passkey.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| "The sign-in service could not be reached" on the sign-in page | `VITE_HANKO_API_URL` is wrong, or Hanko is unreachable from the browser |
| Hanko's box says "A technical error has occurred" | The page's address is not the project's App URL (CORS), e.g. a Vercel preview address or `127.0.0.1` instead of `localhost` |
| Sign-in works, then at once "Your session ended" | The API rejected the token: `Auth__HankoApiUrl` missing or different from the web value; `Auth__HankoAudience` not equal to the web domain; or the project sets a custom issuer — set `Auth__HankoIssuer` to the token's `iss` (decode a token at jwt.io, never paste it anywhere public) |
| Passkey prompt says the site is not allowed | App URL / domain mismatch; passkeys only work on the domain they were made for |

## Code map

Web: `src/lib/config.ts` (`hankoApiUrl`), `src/lib/hanko.ts` (on-demand `register`), `src/features/auth/AuthProvider.tsx`
(session, token for API calls, sign-out), `HankoElements.tsx` (`<hanko-auth>`, `<hanko-profile>`), styling `.op-hanko` in
`src/styles/app.css`. API: `Auth/HankoAuth.cs`, `Auth/AuthSetup.cs` (see `../OpportunityPilotWebApi/docs/SETUP.md`).
