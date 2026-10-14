export type MailProvider = 'Microsoft' | 'Google' | 'Smtp'

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
  return p === 'Microsoft' ? 'Outlook' : p === 'Smtp' ? 'Email (app password)' : 'Gmail'
}

/** How a send button names the mailbox: "Send from your email" for an app-password mailbox, the provider otherwise. */
export function sendName(p: MailProvider): string {
  return p === 'Smtp' ? 'your email' : providerName(p)
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
  if (!outcome || (provider !== 'Microsoft' && provider !== 'Google' && provider !== 'Smtp')) return null
  const m = RETURN_MESSAGES[outcome]
  return m ? { tone: m.tone, text: m.text(providerName(provider)) } : null
}

export interface SmtpPreset { value: string; label: string; help?: { href: string; text: string } }

/** The email providers the app password form knows. "custom" asks for the mail server too. */
export const SMTP_PRESETS: SmtpPreset[] = [
  { value: 'gmail', label: 'Gmail', help: { href: 'https://myaccount.google.com/apppasswords', text: 'Create a Gmail app password' } },
  { value: 'outlook', label: 'Outlook.com / Hotmail', help: { href: 'https://account.live.com/proofs/AppPassword', text: 'Create an Outlook app password' } },
  { value: 'office365', label: 'Microsoft 365 (work or school)' },
  { value: 'yahoo', label: 'Yahoo Mail', help: { href: 'https://login.yahoo.com/account/security', text: 'Create a Yahoo app password' } },
  { value: 'custom', label: 'Another provider (SMTP server)' },
]

/** What the form must have before it is sent: the first thing missing, or null. */
export function smtpFormProblem(f: { preset: string; host: string; username: string; password: string }): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.username.trim())) return 'Enter your full email address.'
  if (!f.password.trim()) return 'Enter the app password.'
  if (f.preset === 'custom' && !f.host.trim()) return 'Enter the mail server, like smtp.example.com.'
  return null
}
