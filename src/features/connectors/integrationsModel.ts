/** Services connected with a webhook address, a token or a private calendar link (API: /api/v1/integrations). */

export type IntegrationKind = 'Slack' | 'Teams' | 'Webhook' | 'HubSpot' | 'Notion' | 'Airtable' | 'CalendarFeed' | 'Hunter' | 'Apollo' | 'Gmail'
export type IntegrationEvent = 'sent' | 'leads' | 'replies' | 'digest'

export interface Integration {
  kind: IntegrationKind
  connected: boolean
  label: string | null
  events: IntegrationEvent[]
  connectedAt: string | null
  lastUsedAt: string | null
  lastError: string | null
  feedUrl: string | null
  /** The server has a sign-in app for this service, so "Connect with …" works (Notion, HubSpot, Slack, Airtable). */
  oauthConfigured: boolean
  /** Connected with the service's own sign-in screen instead of a pasted token. */
  oauthConnected: boolean
  /** Notion or Airtable signed in, but where the leads go is not chosen yet. */
  needsTarget: boolean
  /** One-click "Connect" works for this service: the server has the plugin platform key (Notion, Gmail, HubSpot, Slack, Airtable). */
  pluginReady: boolean
  /** Connected with one-click "Connect". */
  viaPlugin: boolean
}

/** Services that connect in one click through the plugin platform when the server has its key. */
export const PLUGIN_KINDS: IntegrationKind[] = ['Notion', 'Gmail', 'HubSpot', 'Slack', 'Airtable']

/** A Notion database, or an Airtable table with its base as `group` (API: GET /api/v1/integrations/{kind}/targets). */
export interface IntegrationTarget { target: string; table: string | null; name: string; group: string | null }

/** Services that connect with one click on their own sign-in screen when the server has an app for them. */
export const OAUTH_KINDS: IntegrationKind[] = ['Notion', 'HubSpot', 'Slack', 'Airtable']

/** Notion and Airtable ask where leads go after signing in. */
export const PICKS_TARGET: IntegrationKind[] = ['Notion', 'Airtable']

export function targetKey(t: IntegrationTarget): string {
  return t.table ? `${t.target}/${t.table}` : t.target
}

/** "Leads", or "Leads (in CRM)" for an Airtable table, so two tables with the same name can be told apart. */
export function targetLabel(t: IntegrationTarget): string {
  return t.group ? `${t.name} (in ${t.group})` : t.name
}

/** What a card says when the server has no sign-in app for the service yet. */
export function setupSentence(_kind?: IntegrationKind): string {
  return 'One-click connect coming soon.'
}

export interface OauthReturn { kind: IntegrationKind; ok: boolean; text: string }

/**
 * The notice after coming back from a service's sign-in screen (`/connectors?connected=Notion` or `?error=declined&service=Notion`).
 * Null when the address is not such a return.
 */
export function oauthReturn(params: URLSearchParams): OauthReturn | null {
  const connected = params.get('connected')
  const kind = (connected ?? params.get('service')) as IntegrationKind | null
  if (!kind || !(OAUTH_KINDS.includes(kind) || PLUGIN_KINDS.includes(kind))) return null
  const name = KIND_NAMES[kind]
  if (connected) {
    const where = kind === 'Notion' ? ' Now choose which database leads go to.' : kind === 'Airtable' ? ' Now choose which table leads go to.' : kind === 'Slack' ? ' A test message is in Slack.' : ''
    return { kind, ok: true, text: `${name} is connected.${where}` }
  }
  const why: Record<string, string> = {
    declined: `${name} was not connected because access was not allowed on ${name}’s page. Try again when you are ready.`,
    expired: `${name} was not connected because the sign-in took too long or was opened twice. Press Connect with ${name} again.`,
  }
  return { kind, ok: false, text: why[params.get('error') ?? ''] ?? `${name} did not finish connecting. Try again, or use a token instead.` }
}

export interface PushLeadResult { opportunityId: string; outcome: 'Added' | 'AlreadyThere' | 'Failed'; reason: string | null; link: string | null }

export const WEBHOOK_KINDS: IntegrationKind[] = ['Slack', 'Teams', 'Webhook']
export const LEAD_TARGETS: IntegrationKind[] = ['HubSpot', 'Notion', 'Airtable']

export const EVENT_LABELS: Record<IntegrationEvent, string> = {
  sent: 'An email is sent',
  leads: 'A search finds new leads',
  replies: 'Someone replies to your email',
  digest: 'Daily summary (follow-ups due, messages waiting)',
}

export const KIND_NAMES: Record<IntegrationKind, string> = {
  Slack: 'Slack', Teams: 'Microsoft Teams', Webhook: 'Webhook', HubSpot: 'HubSpot', Notion: 'Notion', Airtable: 'Airtable', CalendarFeed: 'Calendar', Hunter: 'Hunter', Apollo: 'Apollo', Gmail: 'Gmail',
}

/** The steps to get the address or token, written for someone who has never done it. */
export const HOW_TO: Record<IntegrationKind, { steps: string[]; link?: { href: string; text: string } }> = {
  Slack: {
    steps: ['In Slack, open Apps and add "Incoming WebHooks" (or create an app with Incoming Webhooks switched on).', 'Choose the channel, then copy the Webhook URL (it starts with https://hooks.slack.com/).'],
    link: { href: 'https://api.slack.com/messaging/webhooks', text: 'Slack’s guide' },
  },
  Teams: {
    steps: ['In Teams, open the channel’s ••• menu → Workflows.', 'Pick "Post to a channel when a webhook request is received", finish the steps, and copy the URL it shows.'],
    link: { href: 'https://support.microsoft.com/office/create-incoming-webhooks-with-workflows-for-microsoft-teams-8ae491c7-0394-4861-ba59-055e33f75498', text: 'Microsoft’s guide' },
  },
  Webhook: {
    steps: ['In Zapier choose the trigger "Webhooks by Zapier → Catch Hook" (in Make: "Custom webhook"; n8n: "Webhook").', 'Copy the address it gives you. Each event arrives as JSON with event, title, lines and link.'],
  },
  HubSpot: {
    steps: ['In HubSpot: Settings → Integrations → Private Apps → Create a private app.', 'On Scopes tick crm.objects.companies (read, write) and crm.objects.contacts (read, write), create it, then copy the access token.'],
    link: { href: 'https://developers.hubspot.com/docs/api/private-apps', text: 'HubSpot’s guide' },
  },
  Notion: {
    steps: ['Go to notion.so/my-integrations → New integration, then copy its Internal Integration Secret.', 'Open your leads database as a full page → ••• → Connections → add the integration. Then copy the page link.'],
    link: { href: 'https://developers.notion.com/docs/create-a-notion-integration', text: 'Notion’s guide' },
  },
  Airtable: {
    steps: ['Go to airtable.com/create/tokens → Create token with scopes data.records:read, data.records:write and schema.bases:read, and add your base.', 'Copy the token, and the link of the base or table from your browser.'],
    link: { href: 'https://airtable.com/developers/web/guides/personal-access-tokens', text: 'Airtable’s guide' },
  },
  Hunter: {
    steps: ['Sign in at hunter.io → API (in the account menu) and copy your API key.', 'The free plan gives 25 searches a month; a search that finds nobody is not counted.'],
    link: { href: 'https://hunter.io/api-keys', text: 'Hunter API keys' },
  },
  Apollo: {
    steps: ['In Apollo: Settings → Integrations → API → Create new key, with access to People API Search and People Enrichment (or a master key).', 'Searching people is free; showing a work email uses 1 Apollo credit each time.'],
    link: { href: 'https://developer.apollo.io/keys/', text: 'Apollo API keys' },
  },
  Gmail: { steps: ['Press Connect and allow access on Google’s page.'] },
  CalendarFeed: {
    steps: ['Google Calendar: Other calendars → + → From URL → paste the link.', 'Outlook: Add calendar → Subscribe from web → paste the link. Updates arrive on their own (Google checks every few hours).'],
  },
}

const TEAMS_HOSTS = ['.webhook.office.com', '.logic.azure.com', '.powerplatform.com', '.powerautomate.com']

/** The same rule the server applies, so a wrong paste is caught before the round trip. Null when the address can be tried. */
export function webhookProblem(kind: IntegrationKind, url: string): string | null {
  const value = url.trim()
  if (!value) return 'Paste the webhook address.'
  let u: URL
  try { u = new URL(value) } catch { return 'Use the full address starting with https://.' }
  if (u.protocol !== 'https:') return 'Use the full address starting with https://.'
  if (u.port || u.username || u.password) return 'Use the address exactly as the service gave it.'
  const host = u.hostname.toLowerCase()
  if (kind === 'Slack' && host !== 'hooks.slack.com') return 'A Slack webhook starts with https://hooks.slack.com/.'
  if (kind === 'Teams' && !TEAMS_HOSTS.some((h) => host.endsWith(h))) return 'That is not a Teams Workflows address.'
  return null
}

/** One sentence for the result of sending leads, counting each outcome. */
export function pushSummary(target: IntegrationKind, results: readonly PushLeadResult[]): string {
  const added = results.filter((r) => r.outcome === 'Added').length
  const there = results.filter((r) => r.outcome === 'AlreadyThere').length
  const failed = results.filter((r) => r.outcome === 'Failed')
  const parts = [`${added} added to ${KIND_NAMES[target]}`]
  if (there) parts.push(`${there} already there`)
  if (failed.length) parts.push(`${failed.length} not sent: ${(failed[0].reason ?? 'unknown reason').replace(/\.$/, '')}`)
  return parts.join(', ') + '.'
}
