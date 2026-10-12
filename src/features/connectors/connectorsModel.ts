/**
 * Apps OpportunityPilot could connect to. Every entry is honest about where it stands: "Next up" means work has started,
 * "Planned" means it is on the list. None of them works yet.
 */

export type ConnectorCategory = 'Email' | 'Calendar' | 'Docs & data' | 'CRM' | 'Chat' | 'Automation' | 'Sign-in & security'
export type ConnectorStatus = 'Next up' | 'Planned'
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
}

export const CATEGORIES: ConnectorCategory[] = ['Email', 'Calendar', 'Docs & data', 'CRM', 'Chat', 'Automation', 'Sign-in & security']

export const CONNECTORS: Connector[] = [
  { id: 'outlook', name: 'Microsoft Outlook', category: 'Email', status: 'Next up', audience: 'Both', does: 'Send your approved messages from your own Outlook (web or installed app) and see replies, with no copy and paste.', needs: 'A Microsoft Entra app registration (client ID) from the owner, and your one-time consent.' },
  { id: 'gmail', name: 'Gmail', category: 'Email', status: 'Next up', audience: 'Both', does: 'Send approved messages from your Gmail and keep the thread together for follow-ups.', needs: 'A Google Cloud OAuth client from the owner; Google review is needed beyond a few testers.' },
  { id: 'google-calendar', name: 'Google Calendar', category: 'Calendar', status: 'Planned', audience: 'Both', does: 'Put follow-up reminders and interviews on your calendar.', needs: 'Google OAuth client and your consent.' },
  { id: 'outlook-calendar', name: 'Outlook Calendar', category: 'Calendar', status: 'Planned', audience: 'Both', does: 'Add follow-ups and meetings to your Outlook calendar.', needs: 'The same Microsoft app as Outlook mail.' },
  { id: 'google-sheets', name: 'Google Sheets', category: 'Docs & data', status: 'Planned', audience: 'Both', does: 'Keep a live sheet of jobs or leads and what happened to each.', needs: 'Google OAuth client and your consent.' },
  { id: 'notion', name: 'Notion', category: 'Docs & data', status: 'Planned', audience: 'Both', does: 'Save approved jobs or leads into a Notion database you already use.', needs: 'A Notion integration token from you.' },
  { id: 'airtable', name: 'Airtable', category: 'Docs & data', status: 'Planned', audience: 'Sales', does: 'Mirror your lead list into an Airtable base for the team.', needs: 'An Airtable token from you.' },
  { id: 'google-drive', name: 'Google Drive', category: 'Docs & data', status: 'Planned', audience: 'Candidate', does: 'Attach your CV or portfolio from Drive when you apply.', needs: 'Google OAuth client and your consent.' },
  { id: 'hubspot', name: 'HubSpot', category: 'CRM', status: 'Planned', audience: 'Sales', does: 'Push approved leads to HubSpot as companies and contacts, and log each message sent.', needs: 'A HubSpot private-app token from you.' },
  { id: 'salesforce', name: 'Salesforce', category: 'CRM', status: 'Planned', audience: 'Sales', does: 'Create leads in Salesforce and note outreach on them.', needs: 'A Salesforce connected app from the owner.' },
  { id: 'zapier', name: 'Zapier', category: 'Automation', status: 'Planned', audience: 'Both', does: 'Send events (lead approved, message sent, reply logged) to thousands of apps through Zapier.', needs: 'A Zapier webhook URL from you.' },
  { id: 'slack', name: 'Slack', category: 'Chat', status: 'Planned', audience: 'Both', does: 'A daily digest and an alert when a follow-up is due.', needs: 'A Slack app or incoming-webhook URL from you.' },
  { id: 'teams', name: 'Microsoft Teams', category: 'Chat', status: 'Planned', audience: 'Both', does: 'The same digest and alerts, in a Teams channel.', needs: 'A Teams incoming-webhook URL from you.' },
  { id: 'google-signin', name: 'Sign in with Google', category: 'Sign-in & security', status: 'Planned', audience: 'Both', does: 'Free one-click sign-in with your Google account instead of a guest session.', needs: 'The Supabase sign-in keys (owner) with Google switched on.' },
  { id: 'microsoft-signin', name: 'Sign in with Microsoft', category: 'Sign-in & security', status: 'Planned', audience: 'Both', does: 'Free sign-in with a work, school or personal Microsoft account (pairs with Outlook).', needs: 'The Supabase sign-in keys (owner) with Microsoft switched on.' },
  { id: 'totp', name: 'Authenticator-app code (MFA)', category: 'Sign-in & security', status: 'Planned', audience: 'Both', does: 'A second step with Google Authenticator, Microsoft Authenticator or any TOTP app. Free, no extra server.', needs: 'The Supabase sign-in keys (owner); MFA is built into Supabase Auth.' },
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
