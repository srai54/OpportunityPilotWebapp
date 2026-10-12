export type MailProvider = 'Microsoft' | 'Google'

export interface Mailbox {
  provider: MailProvider
  configured: boolean
  connected: boolean
  emailAddress: string | null
  status: 'Connected' | 'NeedsReconnect' | null
  connectedAt: string | null
  lastUsedAt: string | null
}

export function providerName(p: MailProvider): string {
  return p === 'Microsoft' ? 'Outlook' : 'Gmail'
}

/** What the Settings row says. "Not configured" is the server's state, not the person's. */
export function mailboxState(m: Mailbox): { text: string; tone: 'success' | 'warning' | 'neutral' } {
  if (!m.configured && !m.connected) return { text: 'Not configured on this server', tone: 'neutral' }
  if (m.connected && m.status === 'NeedsReconnect') return { text: 'Needs to be connected again', tone: 'warning' }
  if (m.connected) return { text: m.emailAddress ? `Connected as ${m.emailAddress}` : 'Connected', tone: 'success' }
  return { text: 'Not connected', tone: 'neutral' }
}

/** Mailboxes that can send right now. */
export function sendable(list: readonly Mailbox[] | undefined): Mailbox[] {
  return (list ?? []).filter((m) => m.configured && m.connected && m.status === 'Connected')
}

/** True when at least one provider could be connected but none is: worth a hint in the send panel. */
export function canConnectOne(list: readonly Mailbox[] | undefined): boolean {
  const all = list ?? []
  return all.some((m) => m.configured) && sendable(all).length === 0
}

const RETURN_MESSAGES: Record<string, { tone: 'success' | 'warning'; text: (name: string) => string }> = {
  connected: { tone: 'success', text: (n) => `${n} is connected. Approved messages can now be sent from it with one click.` },
  declined: { tone: 'warning', text: (n) => `${n} was not connected: access was declined. Nothing was changed.` },
  expired: { tone: 'warning', text: (n) => `The ${n} sign-in expired or was not recognised. Start again.` },
  failed: { tone: 'warning', text: (n) => `${n} could not be connected. Start again and accept the permissions.` },
}

/** The notice for the ?mailbox=…&provider=… the API sends the browser back with; unknown values say nothing. */
export function returnNotice(search: string): { tone: 'success' | 'warning'; text: string } | null {
  const q = new URLSearchParams(search)
  const outcome = q.get('mailbox')
  const provider = q.get('provider')
  if (!outcome || (provider !== 'Microsoft' && provider !== 'Google')) return null
  const m = RETURN_MESSAGES[outcome]
  return m ? { tone: m.tone, text: m.text(providerName(provider)) } : null
}
