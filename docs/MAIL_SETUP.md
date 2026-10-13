# Sending from your own Outlook or Gmail — one-time setup

_2026-10-13 · for the person who owns the Render deployment. The code is built and fixture-tested (Microsoft Graph `sendMail`, Gmail `messages.send`); it stays **Not configured** until you do this. Nothing here has been run against the real providers yet._

## What you are setting up
OpportunityPilot asks Microsoft or Google for permission to **send mail only** (no reading, no deleting) on behalf of the person who clicks **Connect** in Settings. The provider returns a refresh token; the API stores it **encrypted** (AES-256-GCM, key `Mail__TokenKey`) and uses it to send approved messages. Disconnect deletes it. Account export never includes it.

Redirect addresses (replace the host if your API is not the default one):

| Provider | Redirect URI to register |
|---|---|
| Microsoft | `https://opportunitypilotwebapi.onrender.com/api/v1/mailboxes/callback/Microsoft` |
| Google | `https://opportunitypilotwebapi.onrender.com/api/v1/mailboxes/callback/Google` |

## 1. Encryption key (both providers)
Generate 32 random bytes, base64 (any machine with OpenSSL, or PowerShell: `[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])`):

```
openssl rand -base64 32
```
Keep it in Render only. **If you lose or change it, every stored connection stops working and people must connect again.**

## 2. Microsoft (Outlook / Microsoft 365 / outlook.com)
1. Azure portal → **Microsoft Entra ID** → **App registrations** → **New registration**.
2. Name: `OpportunityPilot mail`. Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**.
3. Redirect URI: platform **Web**, the Microsoft address above. Register.
4. **API permissions** → Add → Microsoft Graph → **Delegated** → `Mail.Send`, `offline_access`, `openid`, `email`. (`User.Read` is added by default and is fine.) Work or school tenants may need an admin to grant consent.
5. **Certificates & secrets** → New client secret → copy the **Value** immediately (it is shown once). Note its expiry date: after that the app stops sending until you create a new one.
6. Copy **Application (client) ID** from the Overview page.

## 3. Google (Gmail)
1. Google Cloud console → create a project → **APIs & Services → Library** → enable **Gmail API**.
2. **OAuth consent screen** → User type **External** → fill the app name and your email → **Scopes**: add `.../auth/gmail.send` (plus `openid` and `email`) → **Test users**: add the Gmail addresses that will connect.
3. **Credentials → Create credentials → OAuth client ID** → Application type **Web application** → **Authorized redirect URIs**: the Google address above.
4. Copy the **Client ID** and **Client secret**.

**Important, from Google's rules:** while the consent screen is in **Testing**, refresh tokens expire after **7 days**, so people would have to reconnect weekly. To avoid that, set the publishing status to **In production**. `gmail.send` is a sensitive scope, so Google shows an "unverified app" warning until the app passes verification; for a small group of known users they can continue past it, and verification is only needed to remove the warning and the 100-user cap.

## 4. Render environment variables
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

## 5. Check it works (do these in order)
1. Settings → **Send from your own mailbox** → **Connect Outlook** (or Gmail) → approve → you return to Settings with "… is connected".
2. Run `SQL.md` §10: one row for that provider, `Status = Connected`, `token_chars` greater than 0 and the start of the token is not readable text.
3. Make a draft to **your own address**, approve it, press **Send from Outlook/Gmail**. Check your inbox and Sent folder. The receipt says *accepted*; delivery is not confirmed by the provider.
4. Try **Send all** with two approved drafts to your own address.
5. Revoke access at the provider (Microsoft: myapps.microsoft.com; Google: myaccount.google.com/permissions), then try to send: the row becomes `NeedsReconnect` and nothing is sent.

## 6. When something goes wrong
| Symptom | Cause | Fix |
|---|---|---|
| Microsoft/Google page says redirect URI mismatch | The registered address differs from `Mail__PublicApiBase` + `/api/v1/mailboxes/callback/<Provider>` (trailing slash, http vs https, wrong host) | Make them identical |
| Back in Settings: "sign-in expired or was not recognised" | More than 10 minutes between starting and finishing, or `Mail__TokenKey` changed | Connect again |
| "could not be connected" | The provider refused the code (wrong client secret, expired secret) | Check the secret and its expiry |
| Row says "Needs to be connected again" | Access was revoked or the Google testing-mode token expired | Connect again |
| "The mail provider asked us to slow down" | Provider rate limit | Wait a few minutes; nothing was sent |
| Row says "Not configured on this server" | A variable in step 4 is missing | Add it and redeploy |

## 7. Limits and honesty
- Sending is capped at 100 sends a day per person by the gateway, and Send all at 25 messages per action.
- Replies are **not** read. Reading mail would need `Mail.Read` / `gmail.readonly` (a restricted scope for Google) and is a separate decision (task A6).
- Microsoft's `sendMail` returns 202 Accepted; Gmail returns a message id. Neither proves the recipient received it.
