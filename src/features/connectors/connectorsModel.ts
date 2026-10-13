/**
 * Apps OpportunityPilot could connect to. Every entry is honest about where it stands: "Works today" has a button that does
 * something now (connect a mailbox, download a file), "Next up" means work has started, "Planned" means it is on the list.
 */

export type ConnectorCategory = 'Email' | 'Calendar' | 'Docs & data' | 'CRM' | 'Chat' | 'Automation' | 'Sign-in & security'
export type ConnectorStatus = 'Works today' | 'Next up' | 'Planned'
/** What the button on the card does: connect a mailbox, download calendar or CSV files, or open account settings. */
export type ConnectorAction = 'mail-Microsoft' | 'mail-Google' | 'ics' | 'csv' | 'account'
export type Audience = 'Candidate' | 'Sales' | 'Both'

export interface Connector {
  id: string
  name: string
  category: ConnectorCategory
  status: ConnectorStatus
  audience: Audience
  /** One sentence: what it would do for the person. */
  does: string
  /** What the owner or the person must provide first. */
  needs: string
  action?: ConnectorAction
  /** What the action gives today, when it is less than the full connector. */
  today?: string
}

export const CATEGORIES: ConnectorCategory[] = ['Email', 'Calendar', 'Docs & data', 'CRM', 'Chat', 'Automation', 'Sign-in & security']

export const CONNECTORS: Connector[] = [
  { id: 'outlook', name: 'Microsoft Outlook', category: 'Email', status: 'Works today', audience: 'Both', does: 'Send your approved messages from your own Outlook (web or installed app) and see replies, with no copy and paste.', needs: 'A Microsoft Entra app registration (client ID) from the owner, and your one-time consent.' , action: 'mail-Microsoft', today: 'Send approved messages from your Outlook with one click. Reading replies is not built yet.' },
  { id: 'gmail', name: 'Gmail', category: 'Email', status: 'Works today', audience: 'Both', does: 'Send approved messages from your Gmail and keep the thread together for follow-ups.', needs: 'A Google Cloud OAuth client from the owner; Google review is needed beyond a few testers.' , action: 'mail-Google', today: 'Send approved messages from your Gmail with one click. Reading replies is not built yet.' },
  { id: 'google-calendar', name: 'Google Calendar', category: 'Calendar', status: 'Works today', audience: 'Both', does: 'Put follow-up reminders and interviews on your calendar.', needs: 'Google OAuth client and your consent.' , action: 'ics', today: 'Download your open follow-ups as a calendar file and open it in Google Calendar. One-way, on demand.' },
  { id: 'outlook-calendar', name: 'Outlook Calendar', category: 'Calendar', status: 'Works today', audience: 'Both', does: 'Add follow-ups and meetings to your Outlook calendar.', needs: 'The same Microsoft app as Outlook mail.' , action: 'ics', today: 'Download your open follow-ups as a calendar file and open it in Outlook. One-way, on demand.' },
  { id: 'google-sheets', name: 'Google Sheets', category: 'Docs & data', status: 'Works today', audience: 'Both', does: 'Keep a live sheet of jobs or leads and what happened to each.', needs: 'Google OAuth client and your consent.' , action: 'csv', today: 'Export your leads or jobs as a CSV file and import it there. No live sync.' },
  { id: 'notion', name: 'Notion', category: 'Docs & data', status: 'Works today', audience: 'Both', does: 'Save approved jobs or leads into a Notion database you already use.', needs: 'A Notion integration token from you.' , action: 'csv', today: 'Export your leads or jobs as a CSV file and import it there. No live sync.' },
  { id: 'airtable', name: 'Airtable', category: 'Docs & data', status: 'Works today', audience: 'Sales', does: 'Mirror your lead list into an Airtable base for the team.', needs: 'An Airtable token from you.' , action: 'csv', today: 'Export your leads or jobs as a CSV file and import it there. No live sync.' },
  { id: 'google-drive', name: 'Google Drive', category: 'Docs & data', status: 'Planned', audience: 'Candidate', does: 'Attach your CV or portfolio from Drive when you apply.', needs: 'Google OAuth client and your consent.' },
  { id: 'hubspot', name: 'HubSpot', category: 'CRM', status: 'Works today', audience: 'Sales', does: 'Push approved leads to HubSpot as companies and contacts, and log each message sent.', needs: 'A HubSpot private-app token from you.' , action: 'csv', today: 'Export your leads or jobs as a CSV file and import it there. No live sync.' },
  { id: 'salesforce', name: 'Salesforce', category: 'CRM', status: 'Works today', audience: 'Sales', does: 'Create leads in Salesforce and note outreach on them.', needs: 'A Salesforce connected app from the owner.' , action: 'csv', today: 'Export your leads or jobs as a CSV file and import it there. No live sync.' },
  { id: 'zapier', name: 'Zapier', category: 'Automation', status: 'Planned', audience: 'Both', does: 'Send events (lead approved, message sent, reply logged) to thousands of apps through Zapier.', needs: 'A Zapier webhook URL from you.' },
  { id: 'slack', name: 'Slack', category: 'Chat', status: 'Planned', audience: 'Both', does: 'A daily digest and an alert when a follow-up is due.', needs: 'A Slack app or incoming-webhook URL from you.' },
  { id: 'teams', name: 'Microsoft Teams', category: 'Chat', status: 'Planned', audience: 'Both', does: 'The same digest and alerts, in a Teams channel.', needs: 'A Teams incoming-webhook URL from you.' },
  { id: 'google-signin', name: 'Sign in with Google', category: 'Sign-in & security', status: 'Next up', audience: 'Both', does: 'Free one-click sign-in with your Google account instead of a guest session.', needs: 'The Supabase sign-in keys (owner) with Google switched on.' , action: 'account' },
  { id: 'microsoft-signin', name: 'Sign in with Microsoft', category: 'Sign-in & security', status: 'Next up', audience: 'Both', does: 'Free sign-in with a work, school or personal Microsoft account (pairs with Outlook).', needs: 'The Supabase sign-in keys (owner) with Microsoft switched on.' , action: 'account' },
  { id: 'totp', name: 'Authenticator-app code (MFA)', category: 'Sign-in & security', status: 'Next up', audience: 'Both', does: 'A second step with Google Authenticator, Microsoft Authenticator or any TOTP app. Free, no extra server.', needs: 'The Supabase sign-in keys (owner); MFA is built into Supabase Auth.' , action: 'account' },
]

export interface ConnectorFilter { query: string; category: ConnectorCategory | 'All'; audience: Audience | 'All' }

/** Case-insensitive match on name, category and what it does. An audience of Both matches everyone. */
export function filterConnectors(list: readonly Connector[], f: ConnectorFilter): Connector[] {
  const q = f.query.trim().toLowerCase()
  return list.filter((c) => {
    if (f.category !== 'All' && c.category !== f.category) return false
    if (f.audience !== 'All' && c.audience !== 'Both' && c.audience !== f.audience) return false
    return !q || `${c.name} ${c.category} ${c.does}`.toLowerCase().includes(q)
  })
}

export const VOTES_KEY = 'op.connectorWants'

export function readWants(): string[] {
  try {
    const raw = window.localStorage.getItem(VOTES_KEY)
    const v = raw ? JSON.parse(raw) : []
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function writeWants(ids: string[]): void {
  try { window.localStorage.setItem(VOTES_KEY, JSON.stringify(ids)) } catch { /* kept for this page view only */ }
}

export function toggleWant(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
}

const icsText = (t: string) => t.replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll(',', '\\,').replaceAll(';', '\\;')
const icsStamp = (d: Date) => d.toISOString().replaceAll('-', '').replaceAll(':', '').replace(/\.\d{3}/, '')

/** An iCalendar file with one 30-minute event per open follow-up. Opens in Google Calendar, Outlook and Apple Calendar. */
export function followUpsIcs(items: readonly { id: string; opportunityTitle: string; organization: string; note: string; dueAt: string }[], now: Date = new Date()): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//OpportunityPilot//Follow-ups//EN', 'CALSCALE:GREGORIAN']
  for (const x of items) {
    const start = new Date(x.dueAt)
    if (Number.isNaN(start.getTime())) continue
    lines.push('BEGIN:VEVENT', `UID:${x.id}@opportunitypilot`, `DTSTAMP:${icsStamp(now)}`, `DTSTART:${icsStamp(start)}`, `DTEND:${icsStamp(new Date(start.getTime() + 30 * 60_000))}`,
      `SUMMARY:${icsText(`Follow up: ${x.organization || x.opportunityTitle}`)}`, `DESCRIPTION:${icsText(x.note || x.opportunityTitle)}`, 'END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n') + '\r\n'
}
