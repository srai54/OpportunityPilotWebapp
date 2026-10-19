# Setup

Everything needed to switch on sign-in, connectors and mail, merged on 2026-10-19.

Contents:
- [Sign-in setup — Hanko (main) with Supabase as the fallback](#sign-in-setup--hanko-main-with-supabase-as-the-fallback)
- [One-click connectors — one-time setup](#one-click-connectors--one-time-setup)
- [Sending from your own Outlook or Gmail — one-time setup](#sending-from-your-own-outlook-or-gmail--one-time-setup)

---

<!-- merged from docs/AUTH_SETUP.md on 2026-10-19 -->

## Sign-in setup — Hanko (main) with Supabase as the fallback

_2026-10-14. Owner guide. Hanko is built into the app and the API but switches on only when its URL is set; until then
everything works exactly as before. Not yet verified against a live Hanko project (OQ-FE-045, API OQ-BE-032)._

### What the visitor gets

| Setting | Sign-in page | Settings → Security |
|---|---|---|
| Nothing set (today) | Guest only ("Accounts are not switched on…") | — |
| Supabase only | Microsoft, Google, email + password; Continue as guest | Supabase authenticator-app card |
| **Hanko set** | **Hanko's sign-in first** (passkey, password or email code, then the second factor if the account has one; it also creates accounts). Below it: "Use the older sign-in (Supabase)" when Supabase is set, and Continue as guest | Hanko accounts: Hanko's own profile (emails, password, passkeys, authenticator app, security keys). Supabase accounts: the Supabase card as before |

A Hanko account is a **new workspace**: data made while signed in with Supabase or as a guest is not moved over (the API
keeps each sign-in system's users apart on purpose).

### 1. Create the Hanko Cloud project

1. Sign in at <https://cloud.hanko.io> and create (or open) your organisation.
2. **Create project** → choose **Hanko** (the full authentication product, not "Passkey API") → name it `OpportunityPilot`.
3. **App URL**: the production web address, e.g. `https://opportunitypilot.vercel.app` (exactly, no trailing slash).
   Hanko uses it for two things: the browser origin allowed to call Hanko (CORS) and the passkey domain (relying-party
   id). Vercel **preview** addresses are different origins, so Hanko sign-in only works on the production address.
4. For local development create a **second project** (e.g. `OpportunityPilot dev`) with App URL `http://localhost:5173`.
   Keep the two apart: passkeys made for one domain never work on the other.

### 2. Switch on the sign-in methods

In the project's settings (names may differ slightly in the console):

| Where | Switch on |
|---|---|
| Authentication / Login methods | **Passkeys**; **Email passcodes** (one-time codes); **Passwords** if you want them |
| Multi-factor authentication (MFA) | **Authenticator app (TOTP)** and **Security keys**. Turn on **"MFA required"** (enforce) if every account must have a second factor; otherwise people add it in Settings → Security |
| Session | Keep the default lifetime. Note: the API accepts a session token until it expires, even if you revoke the session in Hanko |

### 3. Copy the API URL

The project overview shows the **API URL**, like `https://<project-id>.hanko.io`. It is public (it is meant for the
browser), so it is safe in a `VITE_` variable. It is not a secret key, and Hanko's API keys are **not** needed here.

### 4. Set it on Vercel (web) and Render (API)

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

### 5. Check it

1. `GET https://<api>/api/v1/capabilities` → `"signInProviders": ["hanko", "supabase"]` (or `["hanko"]`).
2. Open the site signed out: Hanko's sign-in shows first. Create an account with your email, add a passkey when asked.
3. After sign-in the app opens and stays open (pages load data). Settings → Security shows your passkeys and the
   authenticator-app option; Settings → Account says "Hanko (passkey, password or email code)".
4. Sign out from the account menu, then sign in again with the passkey.

### Troubleshooting

| Symptom | Cause and fix |
|---|---|
| "The sign-in service could not be reached" on the sign-in page | `VITE_HANKO_API_URL` is wrong, or Hanko is unreachable from the browser |
| Hanko's box says "A technical error has occurred" | The page's address is not the project's App URL (CORS), e.g. a Vercel preview address or `127.0.0.1` instead of `localhost` |
| Sign-in works, then at once "Your session ended" | The API rejected the token: `Auth__HankoApiUrl` missing or different from the web value; `Auth__HankoAudience` not equal to the web domain; or the project sets a custom issuer — set `Auth__HankoIssuer` to the token's `iss` (decode a token at jwt.io, never paste it anywhere public) |
| Passkey prompt says the site is not allowed | App URL / domain mismatch; passkeys only work on the domain they were made for |

### Code map

Web: `src/lib/config.ts` (`hankoApiUrl`), `src/lib/hanko.ts` (on-demand `register`), `src/features/auth/AuthProvider.tsx`
(session, token for API calls, sign-out), `HankoElements.tsx` (`<hanko-auth>`, `<hanko-profile>`), styling `.op-hanko` in
`src/styles/app.css`. API: `Auth/HankoAuth.cs`, `Auth/AuthSetup.cs` (see `../OpportunityPilotWebApi/docs/SETUP.md`).

---

<!-- merged from docs/CONNECTOR_OAUTH_SETUP.md on 2026-10-19 -->

## One-click connectors — one-time setup

### The easy way (recommended): one key, no apps to register

1. Create a free account at https://platform.composio.dev (Hobby plan, no card).
2. Copy the project API key (Settings → API Keys).
3. On Render, set `Plugins__ApiKey` to that key on the API service (with `Mail__TokenKey` and `Mail__WebBase`, which are already set for email). Redeploy.

That is all. Every **Connect** button on Connectors (Notion, Gmail, HubSpot, Slack, Airtable) now goes to that app's own page through Composio's ready-made sign-in apps, and comes back connected. Nobody registers an app or pastes a token. Composio holds the tokens; the API stores only Composio's connection id. Limits on the free plan: 20,000 actions a month through Composio's own sign-in apps (https://composio.dev/pricing). The consent page shows Composio's app name, not OpportunityPilot. Not yet run against a real Composio key.

Everything below is the older way (your own app per service). It still works and is used only when `Plugins__ApiKey` is not set, or behind "Advanced: use your own token".

---

### Older way: Notion, HubSpot, Slack, Airtable apps of your own

_2026-10-14 · for the person who owns the Render deployment. The code is built and tested against fake services; each "Connect with …" button stays **Needs server setup** until you register that service's app and set its values in Render. Nothing here has been run against the real services yet._

### What you are setting up

People press **Connect with Notion** (or HubSpot, Slack, Airtable), allow access on that service's own page, and come back connected. No one has to create or paste a token. The service gives the API an access token (and a refresh token); the API stores both **encrypted** (AES-256-GCM, key `Mail__TokenKey`), refreshes them before they expire and never sends them to the browser. Disconnect deletes them. The token/webhook forms stay available behind **Use a token instead**.

Each service needs one "app" registered once, by you. All four are free to register.

**Return addresses (redirect URIs) to register** — exactly as written, one per service:

| Service | Live (Render) | Local (API on port 5051) |
|---|---|---|
| Notion | `https://opportunitypilotwebapi.onrender.com/api/v1/integrations/oauth/callback/Notion` | `http://localhost:5051/api/v1/integrations/oauth/callback/Notion` |
| HubSpot | `https://opportunitypilotwebapi.onrender.com/api/v1/integrations/oauth/callback/HubSpot` | `http://localhost:5051/api/v1/integrations/oauth/callback/HubSpot` |
| Slack | `https://opportunitypilotwebapi.onrender.com/api/v1/integrations/oauth/callback/Slack` | Slack accepts only https addresses: test Slack on the live API (or through an https tunnel) |
| Airtable | `https://opportunitypilotwebapi.onrender.com/api/v1/integrations/oauth/callback/Airtable` | `http://localhost:5051/api/v1/integrations/oauth/callback/Airtable` |

The API builds the address from `Integrations__PublicApiBase`, else `Mail__PublicApiBase`, else the address the request came in on. If your API host is different, replace `https://opportunitypilotwebapi.onrender.com` above and set `Integrations__PublicApiBase` to it.

### 0. Values every service needs (once)

| Render variable | Value |
|---|---|
| `Mail__TokenKey` | 32 random bytes, base64 (`openssl rand -base64 32`). Already set if Outlook/Gmail sign-in is set up ([MAIL_SETUP.md](MAIL_SETUP.md)). Without it the key is derived from the database connection string |
| `Mail__WebBase` | the web app's address, e.g. `https://opportunity-pilot-webapp.vercel.app` — where people land after connecting (`/connectors`) |

A service shows **Connect now** only when its own values below **and** these two are set.

### 1. Notion (free)

1. Sign in to Notion and open the developer portal: <https://www.notion.so/profile/integrations> (Notion's docs now call it *connections*, at <https://app.notion.com/developers/connections>).
2. **New integration / connection** → type **Public**. Name: `OpportunityPilot`. Installation scope: **Any workspace** (cannot be changed later).
3. Fill in what the form asks (company name, website, privacy policy and terms links, support email) — Notion requires these for public integrations.
4. **Redirect URIs:** add the Notion addresses from the table above.
5. **Capabilities:** tick **Read content** and **Insert content**. User information: **No user information** is enough.
6. Save, then open **Configuration** and copy the **OAuth client ID** and **OAuth client secret**.

Render: `Integrations__Notion__ClientId`, `Integrations__Notion__ClientSecret`.

When someone connects, Notion asks which pages to share: they should tick the database (or the page that contains it) that leads should go to. Back in OpportunityPilot they pick that database from a list.

### 2. HubSpot (free developer account)

1. Create a free **HubSpot developer account** at <https://developers.hubspot.com/> (separate from a normal HubSpot login; no paid plan needed).
2. In the developer account: **Apps** → **Create app** (a public app). Name: `OpportunityPilot`.
3. **Auth** tab → **Redirect URLs:** add the HubSpot addresses from the table above.
4. **Scopes:** add exactly these (HubSpot refuses a sign-in that asks for scopes the app does not list):
   - `oauth`
   - `crm.objects.companies.read`, `crm.objects.companies.write`
   - `crm.objects.contacts.read`, `crm.objects.contacts.write`
5. Copy the **Client ID** and **Client secret** from the Auth tab.

Render: `Integrations__HubSpot__ClientId`, `Integrations__HubSpot__ClientSecret`.

HubSpot access tokens last 30 minutes; the API refreshes them on its own. If HubSpot only offers its newer "developer platform" (projects) for new apps, create the app there with OAuth authentication and the same redirect URLs and scopes.

### 3. Slack (free)

1. <https://api.slack.com/apps> → **Create New App** → **From scratch**. Name: `OpportunityPilot`; pick your workspace.
2. **OAuth & Permissions** → **Redirect URLs** → add the Slack address from the table above → Save.
3. Same page → **Scopes** → **Bot Token Scopes** → add **`incoming-webhook`** (nothing else is needed).
4. **Basic Information** → **App Credentials**: copy **Client ID** and **Client Secret**.
5. To let people connect workspaces other than yours: **Manage Distribution** → activate public distribution (Slack asks a few questions first).

Render: `Integrations__Slack__ClientId`, `Integrations__Slack__ClientSecret`.

When someone connects, Slack asks which channel to post to. The API keeps only that channel's webhook address — the same thing the "Use a token instead" form stores — and posts one "OpportunityPilot is connected" message there.

### 4. Airtable (free)

1. <https://airtable.com/create/oauth> → **Register new OAuth integration**. Name: `OpportunityPilot`.
2. **OAuth redirect URL:** add the Airtable addresses from the table above.
3. **Scopes:** tick `data.records:read`, `data.records:write` and `schema.bases:read`.
4. Add a support email, privacy policy and terms of service links (Airtable needs them before other people can connect).
5. **Client secret:** optional. Generate one (recommended, since the API is a server) and copy it with the **Client ID**.

Render: `Integrations__Airtable__ClientId`, and `Integrations__Airtable__ClientSecret` only if you generated a secret.

Airtable access tokens last 60 minutes and refresh tokens 60 days; the API refreshes them on its own. A connection unused for 60 days must be connected again.

### 5. Check it

1. Save the Render variables (the API restarts).
2. Open the web app → **Connectors**: the card shows **Connect now** and a **Connect with …** button.
3. Connect, allow access, and you land back on Connectors with "… is connected." Notion and Airtable then ask which database or table leads go to.
4. **Check connection** on the card re-checks with the service.

If you land back with "did not finish connecting", the Render log has a line `Connecting {Kind} by sign-in failed: …` with the service's answer code (never a token). The usual causes are a redirect address that does not match exactly, or (HubSpot) scopes that differ from the app's list.

| Render variable | Needed for |
|---|---|
| `Integrations__Notion__ClientId`, `Integrations__Notion__ClientSecret` | Connect with Notion |
| `Integrations__HubSpot__ClientId`, `Integrations__HubSpot__ClientSecret` | Connect with HubSpot |
| `Integrations__Slack__ClientId`, `Integrations__Slack__ClientSecret` | Connect with Slack |
| `Integrations__Airtable__ClientId` (+ `Integrations__Airtable__ClientSecret` if generated) | Connect with Airtable |
| `Mail__TokenKey`, `Mail__WebBase` | all four |
| `Integrations__PublicApiBase` (optional) | a different API address for the redirect URIs |

---

<!-- merged from docs/MAIL_SETUP.md on 2026-10-19 -->

## Sending from your own Outlook or Gmail — one-time setup

_2026-10-13 · for the person who owns the Render deployment. The code is built and fixture-tested (Microsoft Graph `sendMail`, Gmail `messages.send`); it stays **Not configured** until you do this. Nothing here has been run against the real providers yet._

### What you are setting up
OpportunityPilot asks Microsoft or Google for permission to **send mail only** (no reading, no deleting) on behalf of the person who clicks **Connect** in Settings. The provider returns a refresh token; the API stores it **encrypted** (AES-256-GCM, key `Mail__TokenKey`) and uses it to send approved messages. Disconnect deletes it. Account export never includes it.

Redirect addresses (replace the host if your API is not the default one):

| Provider | Redirect URI to register |
|---|---|
| Microsoft | `https://opportunitypilotwebapi.onrender.com/api/v1/mailboxes/callback/Microsoft` |
| Google | `https://opportunitypilotwebapi.onrender.com/api/v1/mailboxes/callback/Google` |

### 1. Encryption key (both providers)
Generate 32 random bytes, base64 (any machine with OpenSSL, or PowerShell: `[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])`):

```
openssl rand -base64 32
```
Keep it in Render only. **If you lose or change it, every stored connection stops working and people must connect again.**

### 2. Microsoft (Outlook / Microsoft 365 / outlook.com)
1. Azure portal → **Microsoft Entra ID** → **App registrations** → **New registration**.
2. Name: `OpportunityPilot mail`. Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**.
3. Redirect URI: platform **Web**, the Microsoft address above. Register.
4. **API permissions** → Add → Microsoft Graph → **Delegated** → `Mail.Send`, `offline_access`, `openid`, `email`. (`User.Read` is added by default and is fine.) Work or school tenants may need an admin to grant consent.
5. **Certificates & secrets** → New client secret → copy the **Value** immediately (it is shown once). Note its expiry date: after that the app stops sending until you create a new one.
6. Copy **Application (client) ID** from the Overview page.

### 3. Google (Gmail)
1. Google Cloud console → create a project → **APIs & Services → Library** → enable **Gmail API**.
2. **OAuth consent screen** → User type **External** → fill the app name and your email → **Scopes**: add `.../auth/gmail.send` (plus `openid` and `email`) → **Test users**: add the Gmail addresses that will connect.
3. **Credentials → Create credentials → OAuth client ID** → Application type **Web application** → **Authorized redirect URIs**: the Google address above.
4. Copy the **Client ID** and **Client secret**.

**Important, from Google's rules:** while the consent screen is in **Testing**, refresh tokens expire after **7 days**, so people would have to reconnect weekly. To avoid that, set the publishing status to **In production**. `gmail.send` is a sensitive scope, so Google shows an "unverified app" warning until the app passes verification; for a small group of known users they can continue past it, and verification is only needed to remove the warning and the 100-user cap.

### 4. Render environment variables
Service → **Environment** → add, then redeploy:

| Key | Value |
|---|---|
| `Mail__TokenKey` | the base64 key from step 1 |
| `Mail__PublicApiBase` | `https://opportunitypilotwebapi.onrender.com` |
| `Mail__WebBase` | `https://opportunity-pilot-webapp.vercel.app` (where the browser returns after connecting) |
| `Mail__Microsoft__ClientId` / `Mail__Microsoft__ClientSecret` | from step 2 |
| `Mail__Microsoft__Tenant` | optional; default `common` |
| `Mail__Google__ClientId` / `Mail__Google__ClientSecret` | from step 3 |

A provider is switched on only when its client id **and** secret, the key and `Mail__PublicApiBase` are all set; otherwise its row in Settings says "Not configured on this server".

### 5. Check it works (do these in order)
1. Settings → **Send from your own mailbox** → **Connect Outlook** (or Gmail) → approve → you return to Settings with "… is connected".
2. Run `SQL.md` §10: one row for that provider, `Status = Connected`, `token_chars` greater than 0 and the start of the token is not readable text.
3. Make a draft to **your own address**, approve it, press **Send from Outlook/Gmail**. Check your inbox and Sent folder. The receipt says *accepted*; delivery is not confirmed by the provider.
4. Try **Send all** with two approved drafts to your own address.
5. Revoke access at the provider (Microsoft: myapps.microsoft.com; Google: myaccount.google.com/permissions), then try to send: the row becomes `NeedsReconnect` and nothing is sent.

### 6. When something goes wrong
| Symptom | Cause | Fix |
|---|---|---|
| Microsoft/Google page says redirect URI mismatch | The registered address differs from `Mail__PublicApiBase` + `/api/v1/mailboxes/callback/<Provider>` (trailing slash, http vs https, wrong host) | Make them identical |
| Back in Settings: "sign-in expired or was not recognised" | More than 10 minutes between starting and finishing, or `Mail__TokenKey` changed | Connect again |
| "could not be connected" | The provider refused the code (wrong client secret, expired secret) | Check the secret and its expiry |
| Row says "Needs to be connected again" | Access was revoked or the Google testing-mode token expired | Connect again |
| "The mail provider asked us to slow down" | Provider rate limit | Wait a few minutes; nothing was sent |
| Row says "Not configured on this server" | A variable in step 4 is missing | Add it and redeploy |

### 7. Limits and honesty
- Sending is capped at 100 sends a day per person by the gateway, and Send all at 25 messages per action.
- Replies are **not** read. Reading mail would need `Mail.Read` / `gmail.readonly` (a restricted scope for Google) and is a separate decision (task A6).
- Microsoft's `sendMail` returns 202 Accepted; Gmail returns a message id. Neither proves the recipient received it.
