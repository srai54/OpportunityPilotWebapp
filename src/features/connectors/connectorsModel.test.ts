import { describe, expect, it } from 'vitest'
import { CATEGORIES, CONNECTORS, connectorStatus, filterConnectors, toggleWant } from './connectorsModel'
import { OAUTH_KINDS, oauthReturn, pushSummary, setupSentence, targetKey, targetLabel, webhookProblem } from './integrationsModel'

describe('catalog', () => {
  it('has unique ids, every category in use, and nothing claims to be live', () => {
    expect(new Set(CONNECTORS.map((c) => c.id)).size).toBe(CONNECTORS.length)
    for (const cat of CATEGORIES) expect(CONNECTORS.some((c) => c.category === cat)).toBe(true)
    for (const c of CONNECTORS) {
      expect(['Connect now', 'Needs server setup', 'File export', 'Next up', 'Planned']).toContain(c.status)
      // Only a card whose control talks to the real service may say "Connect now"; a file download says so.
      if (c.status === 'Connect now') expect(c.action === 'smtp' || c.action?.startsWith('int-')).toBe(true)
      expect(c.status === 'File export').toBe(c.action === 'csv')
      expect(c.does.length).toBeGreaterThan(20)
      expect(c.needs.length).toBeGreaterThan(10)
    }
  })
  it('Outlook and Gmail sign-in need the server owner; Slack, Teams, CRMs and the calendar connect now', () => {
    expect(CONNECTORS.filter((c) => c.action?.startsWith('mail-')).map((c) => c.status)).toEqual(['Needs server setup', 'Needs server setup'])
    for (const id of ['slack', 'teams', 'zapier', 'hubspot', 'notion', 'airtable', 'calendar']) expect(CONNECTORS.find((c) => c.id === id)?.status).toBe('Connect now')
  })
})

describe('filterConnectors', () => {
  const all = { query: '', category: 'All', audience: 'All' } as const
  it('returns everything without a filter', () => expect(filterConnectors(CONNECTORS, all)).toHaveLength(CONNECTORS.length))
  it('searches name and description, ignoring case', () => {
    expect(filterConnectors(CONNECTORS, { ...all, query: 'HUBSPOT' }).map((c) => c.id)).toEqual(['hubspot'])
    expect(filterConnectors(CONNECTORS, { ...all, query: 'authenticator' }).map((c) => c.id)).toContain('totp')
  })
  it('filters by category', () => {
    expect(filterConnectors(CONNECTORS, { ...all, category: 'Email' }).map((c) => c.id)).toEqual(['smtp', 'outlook', 'gmail'])
  })
  it('shows Both-audience items to everyone and role-only items to that role', () => {
    const sales = filterConnectors(CONNECTORS, { ...all, audience: 'Sales' }).map((c) => c.id)
    expect(sales).toContain('hubspot')
    expect(sales).toContain('outlook')
    expect(sales).not.toContain('google-drive')
    expect(filterConnectors(CONNECTORS, { ...all, audience: 'Candidate' }).map((c) => c.id)).not.toContain('hubspot')
  })
  it('returns nothing for gibberish', () => expect(filterConnectors(CONNECTORS, { ...all, query: 'zzzqqq' })).toEqual([]))
})

describe('toggleWant', () => {
  it('adds and removes an id without mutating', () => {
    const a = ['x']
    expect(toggleWant(a, 'y')).toEqual(['x', 'y'])
    expect(toggleWant(['x', 'y'], 'x')).toEqual(['y'])
    expect(a).toEqual(['x'])
  })
})

describe('webhookProblem', () => {
  it('accepts each service on its own domain only', () => {
    expect(webhookProblem('Slack', 'https://hooks.slack.com/services/T/B/x')).toBeNull()
    expect(webhookProblem('Slack', 'https://hooks.slack.com.evil.test/x')).not.toBeNull()
    expect(webhookProblem('Teams', 'https://prod-1.westus.logic.azure.com/workflows/a')).toBeNull()
    expect(webhookProblem('Teams', 'https://hooks.slack.com/services/x')).not.toBeNull()
    expect(webhookProblem('Webhook', 'https://hooks.zapier.com/hooks/catch/1/a/')).toBeNull()
    expect(webhookProblem('Webhook', 'http://hooks.zapier.com/x')).not.toBeNull()
    expect(webhookProblem('Webhook', 'https://example.com:8443/x')).not.toBeNull()
    expect(webhookProblem('Webhook', '')).toBe('Paste the webhook address.')
  })
})

describe('pushSummary', () => {
  it('counts each outcome and gives the first failure reason', () => {
    expect(pushSummary('HubSpot', [
      { opportunityId: 'a', outcome: 'Added', reason: null, link: null },
      { opportunityId: 'b', outcome: 'AlreadyThere', reason: 'x', link: null },
      { opportunityId: 'c', outcome: 'Failed', reason: 'HubSpot refused the token.', link: null },
    ])).toBe('1 added to HubSpot, 1 already there, 1 not sent: HubSpot refused the token.')
  })
})

describe('one-click sign-in', () => {
  it('a sign-in card says Connect now only when the server has the app, and Needs server setup otherwise', () => {
    const notion = CONNECTORS.find((c) => c.id === 'notion')!
    expect(connectorStatus(notion, true)).toBe('Connect now')
    expect(connectorStatus(notion, false)).toBe('Needs server setup')
    expect(connectorStatus(notion, undefined)).toBe('Needs server setup')
    // Teams has no sign-in: it keeps its catalog status.
    expect(connectorStatus(CONNECTORS.find((c) => c.id === 'teams')!, false)).toBe('Connect now')
    for (const kind of OAUTH_KINDS) expect(CONNECTORS.find((c) => c.action === `int-${kind}`)?.needs).not.toMatch(/token|secret|webhook/i)
  })

  it('reads the return from a sign-in screen and never trusts an unknown service', () => {
    expect(oauthReturn(new URLSearchParams('connected=Notion'))).toEqual({ kind: 'Notion', ok: true, text: 'Notion is connected. Now choose which database leads go to.' })
    expect(oauthReturn(new URLSearchParams('connected=HubSpot'))?.text).toBe('HubSpot is connected.')
    expect(oauthReturn(new URLSearchParams('error=declined&service=Slack'))).toMatchObject({ kind: 'Slack', ok: false })
    expect(oauthReturn(new URLSearchParams('error=expired&service=Airtable'))?.text).toContain('Press Connect with Airtable again')
    expect(oauthReturn(new URLSearchParams('error=failed&service=HubSpot'))?.text).toContain('use a token instead')
    expect(oauthReturn(new URLSearchParams('connected=Hunter'))).toBeNull()
    expect(oauthReturn(new URLSearchParams('connected=<script>'))).toBeNull()
    expect(oauthReturn(new URLSearchParams(''))).toBeNull()
  })

  it('labels Airtable tables with their base and keys them uniquely', () => {
    const table = { target: 'appA', table: 'tblB', name: 'Leads', group: 'CRM' }
    expect(targetLabel(table)).toBe('Leads (in CRM)')
    expect(targetKey(table)).toBe('appA/tblB')
    const db = { target: 'abc', table: null, name: 'Leads', group: null }
    expect([targetLabel(db), targetKey(db)]).toEqual(['Leads', 'abc'])
    expect(setupSentence('Notion')).toContain('use a token')
  })
})
