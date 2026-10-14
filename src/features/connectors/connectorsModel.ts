import type { IntegrationKind } from './integrationsModel'

/**
 * Apps OpportunityPilot connects to. Every entry is honest about where it stands: "Connect now" talks to the real service once you
 * paste an address or token; "Needs server setup" works once the server owner registers a sign-in app; "File export" is a download;
 * "Next up" and "Planned" are not built.
 */

export type ConnectorCategory = 'Email' | 'Calendar' | 'Docs & data' | 'CRM' | 'Chat' | 'Automation' | 'Sign-in & security'
export type ConnectorStatus = 'Connect now' | 'Needs server setup' | 'File export' | 'Next up' | 'Planned'
/** What the card's control does: connect a mailbox or a service, download a file, or open account settings. */
export type ConnectorAction = 'smtp' | 'mail-Microsoft' | 'mail-Google' | `int-${IntegrationKind}` | 'csv' | 'account'
export type Audience = 'Candidate' | 'Sales' | 'Both'

export interface Connector {
  id: string
  name: string
  category: ConnectorCategory
  status: ConnectorStatus
  audience: Audience
  /** One sentence: what it does for the person. */
  does: string
  /** What the owner or the person must provide first. */
  needs: string
  action?: ConnectorAction
}

export const CATEGORIES: ConnectorCategory[] = ['Email', 'Calendar', 'Docs & data', 'CRM', 'Chat', 'Automation', 'Sign-in & security']

export const CONNECTORS: Connector[] = [
  { id: 'smtp', name: 'Your email (app password)', category: 'Email', status: 'Connect now', audience: 'Both', does: 'Send approved messages from your own Gmail, Outlook, Microsoft 365 or Yahoo address with one click, and find replies in your inbox (leads move to Responded, follow-ups stop).', needs: 'An app password from your email provider (a few clicks in your account security page).', action: 'smtp' },
  { id: 'outlook', name: 'Microsoft Outlook (sign-in)', category: 'Email', status: 'Needs server setup', audience: 'Both', does: 'Send approved messages from Outlook by signing in with Microsoft instead of an app password.', needs: 'A Microsoft Entra app registration from the server owner, then your one-time consent.', action: 'mail-Microsoft' },
  { id: 'gmail', name: 'Gmail (sign-in)', category: 'Email', status: 'Needs server setup', audience: 'Both', does: 'Send approved messages from Gmail by signing in with Google instead of an app password.', needs: 'A Google Cloud OAuth client from the server owner, then your one-time consent.', action: 'mail-Google' },
  { id: 'calendar', name: 'Google Calendar / Outlook Calendar', category: 'Calendar', status: 'Connect now', audience: 'Both', does: 'Your follow-ups and interviews appear in your calendar and stay up to date, through a private link your calendar subscribes to.', needs: 'Nothing: make the link here and paste it into your calendar once.', action: 'int-CalendarFeed' },
  { id: 'hubspot', name: 'HubSpot', category: 'CRM', status: 'Connect now', audience: 'Sales', does: 'Send leads to HubSpot as companies, with the contact and a note. A company already there is not added twice.', needs: 'A HubSpot private-app token (Settings → Integrations → Private Apps).', action: 'int-HubSpot' },
  { id: 'notion', name: 'Notion', category: 'Docs & data', status: 'Connect now', audience: 'Both', does: 'Add jobs or leads as pages in a Notion database you already use, filling the columns it has.', needs: 'A Notion integration secret, with your database shared to it.', action: 'int-Notion' },
  { id: 'airtable', name: 'Airtable', category: 'Docs & data', status: 'Connect now', audience: 'Both', does: 'Add jobs or leads as records in an Airtable table, filling the columns it has.', needs: 'An Airtable personal access token with access to the base.', action: 'int-Airtable' },
  { id: 'slack', name: 'Slack', category: 'Chat', status: 'Connect now', audience: 'Both', does: 'A message in your channel when an email goes out, when a search finds leads, and a daily summary of what is due.', needs: 'An incoming-webhook address for the channel.', action: 'int-Slack' },
  { id: 'teams', name: 'Microsoft Teams', category: 'Chat', status: 'Connect now', audience: 'Both', does: 'The same messages and daily summary, as cards in a Teams channel.', needs: 'A Teams Workflows webhook address for the channel.', action: 'int-Teams' },
  { id: 'zapier', name: 'Zapier, Make or any webhook', category: 'Automation', status: 'Connect now', audience: 'Both', does: 'Send each event (email sent, new leads, daily summary) as JSON to Zapier, Make or n8n, and on to thousands of apps.', needs: 'A catch-hook address from Zapier, Make or n8n.', action: 'int-Webhook' },
  { id: 'google-sheets', name: 'Google Sheets', category: 'Docs & data', status: 'File export', audience: 'Both', does: 'Export your leads or jobs as a CSV file and import it into a sheet.', needs: 'Nothing. A live sheet needs a Google app from the server owner.', action: 'csv' },
  { id: 'salesforce', name: 'Salesforce', category: 'CRM', status: 'File export', audience: 'Sales', does: 'Export leads as a CSV file and import them with the Data Import Wizard.', needs: 'Nothing. A live link needs a Salesforce connected app from the server owner.', action: 'csv' },
  { id: 'google-drive', name: 'Google Drive', category: 'Docs & data', status: 'Planned', audience: 'Candidate', does: 'Attach your CV or portfolio from Drive when you apply.', needs: 'Google OAuth client and your consent.' },
  { id: 'google-signin', name: 'Sign in with Google', category: 'Sign-in & security', status: 'Next up', audience: 'Both', does: 'Free one-click sign-in with your Google account instead of a guest session.', needs: 'The Supabase sign-in keys (owner) with Google switched on.', action: 'account' },
  { id: 'microsoft-signin', name: 'Sign in with Microsoft', category: 'Sign-in & security', status: 'Next up', audience: 'Both', does: 'Free sign-in with a work, school or personal Microsoft account (pairs with Outlook).', needs: 'The Supabase sign-in keys (owner) with Microsoft switched on.', action: 'account' },
  { id: 'totp', name: 'Authenticator-app code (MFA)', category: 'Sign-in & security', status: 'Next up', audience: 'Both', does: 'A second step with Google Authenticator, Microsoft Authenticator or any TOTP app. Free, no extra server.', needs: 'The Supabase sign-in keys (owner); MFA is built into Supabase Auth.', action: 'account' },
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
