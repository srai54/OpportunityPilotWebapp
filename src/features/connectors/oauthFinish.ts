/**
 * Finishing a sign-in (mailbox or connector) after the provider sends the browser back. The API's anonymous callback only hands the
 * code and state to the web app; the signed-in app posts them so the API can check that the person finishing is the person who
 * started. The answer is where to go next — the same `?mailbox=…` / `?connected=…` addresses the pages already understand.
 */
export type FinishCall = { path: string; body: { code: string; state: string } }

const KIND = /^[A-Za-z]{2,30}$/

export function finishCall(search: string): FinishCall | null {
  const q = new URLSearchParams(search)
  const mailCode = q.get('mailboxCode'), mailState = q.get('mailboxState'), provider = q.get('provider')
  if (mailCode && mailState && provider && KIND.test(provider))
    return { path: `/api/v1/mailboxes/${provider}/complete`, body: { code: mailCode, state: mailState } }
  const code = q.get('oauthCode'), state = q.get('oauthState'), service = q.get('service')
  if (code && state && service && KIND.test(service))
    return { path: `/api/v1/integrations/oauth/complete/${service}`, body: { code, state } }
  return null
}

/** Only the query of the API's answer is used, on the current page, so the answer can never send the browser to another site. */
export function nextLocation(next: string, pathname: string): string {
  try { return pathname + new URL(next, 'https://x.invalid').search } catch { return pathname }
}
