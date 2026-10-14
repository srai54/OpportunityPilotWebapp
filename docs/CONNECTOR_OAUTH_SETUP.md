# One-click connectors — one-time setup

## The easy way (recommended): one key, no apps to register

1. Create a free account at https://platform.composio.dev (Hobby plan, no card).
2. Copy the project API key (Settings → API Keys).
3. On Render, set `Plugins__ApiKey` to that key on the API service (with `Mail__TokenKey` and `Mail__WebBase`, which are already set for email). Redeploy.

That is all. Every **Connect** button on Connectors (Notion, Gmail, HubSpot, Slack, Airtable) now goes to that app's own page through Composio's ready-made sign-in apps, and comes back connected. Nobody registers an app or pastes a token. Composio holds the tokens; the API stores only Composio's connection id. Limits on the free plan: 20,000 actions a month through Composio's own sign-in apps (https://composio.dev/pricing). The consent page shows Composio's app name, not OpportunityPilot. Not yet run against a real Composio key.

Everything below is the older way (your own app per service). It still works and is used only when `Plugins__ApiKey` is not set, or behind "Advanced: use your own token".

---

## Older way: Notion, HubSpot, Slack, Airtable apps of your own

_2026-10-14 · for the person who owns the Render deployment. The code is built and tested against fake services; each "Connect with …" button stays **Needs server setup** until you register that service's app and set its values in Render. Nothing here has been run against the real services yet._

## What you are setting up

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

## 0. Values every service needs (once)

| Render variable | Value |
|---|---|
| `Mail__TokenKey` | 32 random bytes, base64 (`openssl rand -base64 32`). Already set if Outlook/Gmail sign-in is set up ([MAIL_SETUP.md](MAIL_SETUP.md)). Without it the key is derived from the database connection string |
| `Mail__WebBase` | the web app's address, e.g. `https://opportunity-pilot-webapp.vercel.app` — where people land after connecting (`/connectors`) |

A service shows **Connect now** only when its own values below **and** these two are set.

## 1. Notion (free)

1. Sign in to Notion and open the developer portal: <https://www.notion.so/profile/integrations> (Notion's docs now call it *connections*, at <https://app.notion.com/developers/connections>).
2. **New integration / connection** → type **Public**. Name: `OpportunityPilot`. Installation scope: **Any workspace** (cannot be changed later).
3. Fill in what the form asks (company name, website, privacy policy and terms links, support email) — Notion requires these for public integrations.
4. **Redirect URIs:** add the Notion addresses from the table above.
5. **Capabilities:** tick **Read content** and **Insert content**. User information: **No user information** is enough.
6. Save, then open **Configuration** and copy the **OAuth client ID** and **OAuth client secret**.

Render: `Integrations__Notion__ClientId`, `Integrations__Notion__ClientSecret`.

When someone connects, Notion asks which pages to share: they should tick the database (or the page that contains it) that leads should go to. Back in OpportunityPilot they pick that database from a list.

## 2. HubSpot (free developer account)

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

## 3. Slack (free)

1. <https://api.slack.com/apps> → **Create New App** → **From scratch**. Name: `OpportunityPilot`; pick your workspace.
2. **OAuth & Permissions** → **Redirect URLs** → add the Slack address from the table above → Save.
3. Same page → **Scopes** → **Bot Token Scopes** → add **`incoming-webhook`** (nothing else is needed).
4. **Basic Information** → **App Credentials**: copy **Client ID** and **Client Secret**.
5. To let people connect workspaces other than yours: **Manage Distribution** → activate public distribution (Slack asks a few questions first).

Render: `Integrations__Slack__ClientId`, `Integrations__Slack__ClientSecret`.

When someone connects, Slack asks which channel to post to. The API keeps only that channel's webhook address — the same thing the "Use a token instead" form stores — and posts one "OpportunityPilot is connected" message there.

## 4. Airtable (free)

1. <https://airtable.com/create/oauth> → **Register new OAuth integration**. Name: `OpportunityPilot`.
2. **OAuth redirect URL:** add the Airtable addresses from the table above.
3. **Scopes:** tick `data.records:read`, `data.records:write` and `schema.bases:read`.
4. Add a support email, privacy policy and terms of service links (Airtable needs them before other people can connect).
5. **Client secret:** optional. Generate one (recommended, since the API is a server) and copy it with the **Client ID**.

Render: `Integrations__Airtable__ClientId`, and `Integrations__Airtable__ClientSecret` only if you generated a secret.

Airtable access tokens last 60 minutes and refresh tokens 60 days; the API refreshes them on its own. A connection unused for 60 days must be connected again.

## 5. Check it

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
