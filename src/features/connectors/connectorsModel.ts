import type { Integration, IntegrationKind } from './integrationsModel'
import type { Mailbox } from '../mail/mailModel'

/**
 * Apps OpportunityPilot connects to. Every entry is honest about where it stands: "Connect now" talks to the real service once you
 * paste an address or token; "Needs server setup" works once the server owner registers a sign-in app; "File export" is a download;
 * "Next up" and "Planned" are not built.
 */

export type ConnectorCategory = 'Email' | 'Find people' | 'Calendar' | 'Docs & data' | 'CRM' | 'Chat' | 'Automation' | 'Sign-in & security'
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
  /** At most eight words, shown on the card. */
  short: string
  /** One sentence: what it does for the person (searched, not shown). */
  does: string
  /** What the owner or the person must provide first. */
  needs: string
  action?: ConnectorAction
}

export const CATEGORIES: ConnectorCategory[] = ['Email', 'Find people', 'Calendar', 'Docs & data', 'CRM', 'Chat', 'Automation', 'Sign-in & security']

export const CONNECTORS: Connector[] = [
  { id: 'smtp', name: 'Your email (app password)', short: 'Send from your own email address', category: 'Email', status: 'Connect now', audience: 'Both', does: 'Send approved messages from your own Gmail, Outlook, Microsoft 365 or Yahoo address with one click, and find replies in your inbox (leads move to Responded, follow-ups stop).', needs: 'An app password from your email provider (a few clicks in your account security page).', action: 'smtp' },
  { id: 'outlook', name: 'Outlook', short: 'Send approved emails from Outlook', category: 'Email', status: 'Needs server setup', audience: 'Both', does: 'Send approved messages from Outlook by signing in with Microsoft instead of an app password.', needs: 'A Microsoft Entra app registration from the server owner, then your one-time consent.', action: 'mail-Microsoft' },
  { id: 'gmail', name: 'Gmail', short: 'Send approved emails from Gmail', category: 'Email', status: 'Needs server setup', audience: 'Both', does: 'Send approved messages from Gmail by signing in with Google instead of an app password.', needs: 'A Google Cloud OAuth client from the server owner, then your one-time consent.', action: 'mail-Google' },
  { id: 'hunter', name: 'Hunter.io', short: 'Find work emails at a company', category: 'Find people', status: 'Connect now', audience: 'Both', does: 'Find the people and work emails at a company from its website domain, with how sure Hunter is about each address.', needs: 'Your own Hunter API key (free plan: 25 searches a month).', action: 'int-Hunter' },
  { id: 'apollo', name: 'Apollo.io', short: 'Find recruiters and decision makers', category: 'Find people', status: 'Connect now', audience: 'Both', does: 'Find recruiters, hiring managers and decision makers at a company; show a work email when you choose (uses your Apollo credit).', needs: 'Your own Apollo API key with People Search and Enrichment.', action: 'int-Apollo' },
  { id: 'calendar', name: 'Google Calendar / Outlook Calendar', short: 'Follow-ups in your calendar', category: 'Calendar', status: 'Connect now', audience: 'Both', does: 'Your follow-ups and interviews appear in your calendar and stay up to date, through a private link your calendar subscribes to.', needs: 'Nothing: make the link here and paste it into your calendar once.', action: 'int-CalendarFeed' },
  { id: 'hubspot', name: 'HubSpot', short: 'Send leads to your CRM', category: 'CRM', status: 'Connect now', audience: 'Sales', does: 'Send leads to HubSpot as companies, with the contact and a note. A company already there is not added twice.', needs: 'Your HubSpot login. You allow access on HubSpot’s own page.', action: 'int-HubSpot' },
  { id: 'notion', name: 'Notion', short: 'Save leads in a Notion database', category: 'Docs & data', status: 'Connect now', audience: 'Both', does: 'Add jobs or leads as pages in a Notion database you already use, filling the columns it has.', needs: 'Your Notion login. You pick the pages to share on Notion’s own page.', action: 'int-Notion' },
  { id: 'airtable', name: 'Airtable', short: 'Save leads in an Airtable table', category: 'Docs & data', status: 'Connect now', audience: 'Both', does: 'Add jobs or leads as records in an Airtable table, filling the columns it has.', needs: 'Your Airtable login. You pick the bases to share on Airtable’s own page.', action: 'int-Airtable' },
  { id: 'slack', name: 'Slack', short: 'Get alerts in Slack', category: 'Chat', status: 'Connect now', audience: 'Both', does: 'A message in your channel when an email goes out, when a search finds leads, and a daily summary of what is due.', needs: 'Your Slack login. You pick the channel on Slack’s own page.', action: 'int-Slack' },
  { id: 'teams', name: 'Microsoft Teams', short: 'Get alerts in a Teams channel', category: 'Chat', status: 'Connect now', audience: 'Both', does: 'The same messages and daily summary, as cards in a Teams channel.', needs: 'A Teams Workflows webhook address for the channel.', action: 'int-Teams' },
  { id: 'zapier', name: 'Zapier, Make or any webhook', short: 'Send events to Zapier, Make or n8n', category: 'Automation', status: 'Connect now', audience: 'Both', does: 'Send each event (email sent, new leads, daily summary) as JSON to Zapier, Make or n8n, and on to thousands of apps.', needs: 'A catch-hook address from Zapier, Make or n8n.', action: 'int-Webhook' },
  { id: 'google-sheets', name: 'Google Sheets', short: 'Export leads as a CSV file', category: 'Docs & data', status: 'File export', audience: 'Both', does: 'Export your leads or jobs as a CSV file and import it into a sheet.', needs: 'Nothing. A live sheet needs a Google app from the server owner.', action: 'csv' },
  { id: 'salesforce', name: 'Salesforce', short: 'Export leads for a Salesforce import', category: 'CRM', status: 'File export', audience: 'Sales', does: 'Export leads as a CSV file and import them with the Data Import Wizard.', needs: 'Nothing. A live link needs a Salesforce connected app from the server owner.', action: 'csv' },
  { id: 'google-drive', name: 'Google Drive', short: 'Attach your CV from Drive', category: 'Docs & data', status: 'Planned', audience: 'Candidate', does: 'Attach your CV or portfolio from Drive when you apply.', needs: 'Google OAuth client and your consent.' },
  { id: 'google-signin', name: 'Sign in with Google', short: 'Sign in with Google', category: 'Sign-in & security', status: 'Next up', audience: 'Both', does: 'Free one-click sign-in with your Google account instead of a guest session.', needs: 'The Supabase sign-in keys (owner) with Google switched on.', action: 'account' },
  { id: 'microsoft-signin', name: 'Sign in with Microsoft', short: 'Sign in with Microsoft', category: 'Sign-in & security', status: 'Next up', audience: 'Both', does: 'Free sign-in with a work, school or personal Microsoft account (pairs with Outlook).', needs: 'The Supabase sign-in keys (owner) with Microsoft switched on.', action: 'account' },
  { id: 'totp', name: 'Authenticator-app code (MFA)', short: 'Add an authenticator app code', category: 'Sign-in & security', status: 'Next up', audience: 'Both', does: 'A second step with Google Authenticator, Microsoft Authenticator or any TOTP app. Free, no extra server.', needs: 'The Supabase sign-in keys (owner); MFA is built into Supabase Auth.', action: 'account' },
]

export interface ConnectorFilter { query: string; category: ConnectorCategory | 'All'; audience: Audience | 'All' }

const OAUTH_ACTIONS: ConnectorAction[] = ['int-Notion', 'int-HubSpot', 'int-Slack', 'int-Airtable']

/**
 * The badge on a card. Sign-in services (Notion, HubSpot, Slack, Airtable) are "Connect now" once the server has their app,
 * otherwise "Needs server setup" (the token form still works behind "Use a token instead"). Others keep their catalog status.
 */
export function connectorStatus(c: Connector, oauthConfigured: boolean | undefined): ConnectorStatus {
  if (c.action && OAUTH_ACTIONS.includes(c.action)) return oauthConfigured ? 'Connect now' : 'Needs server setup'
  return c.status
}

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

/** The service a card connects in one click through the plugin platform, or null. Gmail's card is the Google mailbox. */
export function pluginKindOf(c: Connector): IntegrationKind | null {
  if (c.action === 'mail-Google') return 'Gmail'
  const kind = c.action?.startsWith('int-') ? (c.action.slice(4) as IntegrationKind) : null
  return kind && ['Notion', 'HubSpot', 'Slack', 'Airtable'].includes(kind) ? kind : null
}

/** Whether a card's app is connected now, from the API's integrations and mailboxes. */
export function isConnected(c: Connector, integrations: readonly Integration[] | undefined, mailboxes: readonly Mailbox[] | undefined): boolean {
  const kind = pluginKindOf(c) ?? (c.action?.startsWith('int-') ? (c.action.slice(4) as IntegrationKind) : null)
  if (kind && integrations?.some((i) => i.kind === kind && i.connected)) return true
  const provider = c.action === 'smtp' ? 'Smtp' : c.action?.startsWith('mail-') ? c.action.slice(5) : null
  return !!provider && !!mailboxes?.some((m) => m.provider === provider && m.connected)
}
