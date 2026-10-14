/** Services connected with a webhook address, a token or a private calendar link (API: /api/v1/integrations). */

export type IntegrationKind = 'Slack' | 'Teams' | 'Webhook' | 'HubSpot' | 'Notion' | 'Airtable' | 'CalendarFeed' | 'Hunter' | 'Apollo'
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
  Slack: 'Slack', Teams: 'Microsoft Teams', Webhook: 'Webhook', HubSpot: 'HubSpot', Notion: 'Notion', Airtable: 'Airtable', CalendarFeed: 'Calendar', Hunter: 'Hunter', Apollo: 'Apollo',
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
