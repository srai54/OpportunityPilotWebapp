import { describe, expect, it } from 'vitest'
import type { OpportunitySummary } from '../../lib/types'
import {
  agentApplyPlatform,
  canMoveTo,
  nextPermittedAction,
  primaryAction,
  searchLoaded,
  selectionCsv,
  appendUnique,
  appliesViaForPlatform,
  appliesViaLabel,
  DEFAULT_FILTERS,
  factLabel,
  formatCoverage,
  formatPoints,
  formatScore,
  isUserApplyBoard,
  opportunitiesPath,
  platformLabel,
  quickActions,
  safeHref,
  settableStatuses,
  STATUS_LABELS,
  valueLabel,
} from './opportunityModel'

describe('valueLabel', () => {
  it('keeps unknown distinct from not met', () => {
    expect(valueLabel(null).text).toBe('Unknown')
    expect(valueLabel(0).text).toBe('Not met')
    expect(valueLabel(null).tone).not.toBe(valueLabel(0).tone)
  })

  it('maps full and partial matches', () => {
    expect(valueLabel(1).text).toBe('Met')
    expect(valueLabel(0.5).text).toBe('Partly')
  })
})

describe('score formatting', () => {
  it('reads as a rank out of 100, never a likelihood', () => {
    expect(formatScore(82)).toBe('82/100')
    expect(formatScore(82)).not.toContain('%')
  })

  it('rounds and bounds what the server sends', () => {
    expect(formatScore(104.6)).toBe('100/100')
    expect(formatCoverage(87.5)).toBe('coverage 88%')
    expect(formatCoverage(Number.NaN)).toBe('coverage 0%')
    expect(formatPoints(31.6, 35)).toBe('32 / 35')
  })
})

describe('factLabel', () => {
  it('only calls a fact verified when it has evidence and is not an inference', () => {
    expect(factLabel({ evidenceId: 'e1', isInference: false }).text).toBe('Verified')
    expect(factLabel({ evidenceId: 'e1', isInference: true }).text).toBe('Inferred')
    expect(factLabel({ evidenceId: null, isInference: false }).text).toBe('Not verified')
  })
})

describe('opportunitiesPath', () => {
  it('sends only the filters that are set', () => {
    expect(opportunitiesPath('c1', DEFAULT_FILTERS, 0)).toBe('/api/v1/campaigns/c1/opportunities?sort=score&take=50&skip=0')
    expect(opportunitiesPath('c1', { outcome: 'NeedsVerification', status: 'New', sort: 'recent' }, 50)).toBe(
      '/api/v1/campaigns/c1/opportunities?outcome=NeedsVerification&status=New&sort=recent&take=50&skip=50',
    )
  })

  it('appends the next page without repeating shifted rows', () => {
    expect(appendUnique([{ id: 'a' }, { id: 'b' }], [{ id: 'b' }, { id: 'c' }]).map((x) => x.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('quickActions', () => {
  it('lets a shortlisted row be undone and a dismissed one restored', () => {
    expect(quickActions('Shortlisted').map((a) => a.to)).toEqual(['New', 'Dismissed'])
    expect(quickActions('Dismissed').map((a) => a.to)).toEqual(['New'])
  })

  it('offers no list shortcut that could overwrite later pipeline states', () => {
    expect(quickActions('Applied')).toEqual([])
    expect(quickActions('Contacted')).toEqual([])
  })
})

describe('agentApplyPlatform', () => {
  it('names the platform for shortlisted LinkedIn and Naukri jobs only', () => {
    expect(agentApplyPlatform({ mode: 'Job', platform: 'Naukri', status: 'Shortlisted' })).toBe('naukri')
    expect(agentApplyPlatform({ mode: 'Job', platform: 'Other', status: 'Shortlisted' })).toBeNull()
    expect(agentApplyPlatform({ mode: 'Job', platform: 'LinkedIn', status: 'New' })).toBeNull()
    expect(agentApplyPlatform({ mode: 'Customer', platform: 'LinkedIn', status: 'Shortlisted' })).toBeNull()
  })
})

describe('safeHref', () => {
  it('links only http and https URLs', () => {
    expect(safeHref('https://example.com/jobs/1')).toBe('https://example.com/jobs/1')
    expect(safeHref('javascript:alert(1)')).toBeNull()
    expect(safeHref('not a url')).toBeNull()
    expect(safeHref(null)).toBeNull()
  })
})

describe('suggested status', () => {
  it('reads as awaiting approval, paired with a tone', () => {
    expect(STATUS_LABELS.Suggested).toEqual({ text: 'Awaiting approval', tone: 'warning' })
  })

  it('offers Approve (→ Shortlisted) and Skip (→ Dismissed) as quick actions', () => {
    expect(quickActions('Suggested')).toEqual([
      { label: 'Approve', to: 'Shortlisted' },
      { label: 'Skip', to: 'Dismissed' },
    ])
  })

  it('cannot be chosen by hand, but stays visible while it is the current status', () => {
    expect(settableStatuses('New')).not.toContain('Suggested')
    expect(settableStatuses('Suggested')).toContain('Suggested')
    expect(settableStatuses('New')).toContain('Shortlisted')
  })
})

describe('platforms and who applies', () => {
  it('labels the open job boards and hides Other / unknown', () => {
    expect(platformLabel('Greenhouse')).toBe('Greenhouse')
    expect(platformLabel('Lever')).toBe('Lever')
    expect(platformLabel('Adzuna')).toBe('Adzuna')
    expect(platformLabel('Other')).toBeNull()
    expect(platformLabel(null)).toBeNull()
  })

  it('maps LinkedIn and Naukri to the agent and everything else to you', () => {
    expect(appliesViaForPlatform('LinkedIn')).toBe('Agent')
    expect(appliesViaForPlatform('Naukri')).toBe('Agent')
    for (const p of ['Greenhouse', 'Lever', 'Adzuna', 'Other', null] as const) expect(appliesViaForPlatform(p)).toBe('You')
  })

  it('words the applies-via line for the approval queue', () => {
    expect(appliesViaLabel('Agent', 'Naukri')).toBe('your agent (Naukri)')
    expect(appliesViaLabel('Agent', null)).toBe('your agent (LinkedIn/Naukri/InstaHyre)')
    expect(appliesViaLabel('You', 'Greenhouse')).toBe('you (opens the application page)')
  })

  it('marks only Greenhouse, Lever and Adzuna as boards the user applies to directly', () => {
    expect(isUserApplyBoard('Lever')).toBe(true)
    expect(isUserApplyBoard('LinkedIn')).toBe(false)
    expect(isUserApplyBoard('Other')).toBe(false)
  })
})

describe('opportunity list helpers', () => {
  const o = (over: Partial<OpportunitySummary>): OpportunitySummary => ({
    id: '1', campaignId: 'c', mode: 'Job', title: 'Backend Engineer', organization: 'Stripe', location: 'Dublin', url: 'https://x',
    applyUrl: null, platform: null, score: 83, coverage: 100, outcome: 'Qualified', outcomeReason: null, status: 'New', gapsCount: 0,
    updatedAt: '2026-10-06T00:00:00Z', ...over,
  })
  it('searches title, organisation and location of loaded rows', () => {
    const rows = [o({ id: 'a' }), o({ id: 'b', title: 'Sales Engineer', organization: 'Leverdemo', location: 'New York' })]
    expect(searchLoaded(rows, 'york').map((r) => r.id)).toEqual(['b'])
    expect(searchLoaded(rows, '  ')).toHaveLength(2)
  })
  it('allows bulk moves only where the row itself allows them', () => {
    expect(canMoveTo('Suggested', 'Shortlisted')).toBe(true)
    expect(canMoveTo('Applied', 'Dismissed')).toBe(false)
  })
  it('exports the selection as CSV with quoting', () => {
    const csv = selectionCsv([o({ title: 'Engineer, "Platform"' })])
    expect(csv.split('\n')[1]).toBe('"Engineer, ""Platform""",Stripe,Dublin,83,100,Qualified,New,https://x')
  })
  it('offers one next step per row', () => {
    expect(primaryAction(o({ status: 'Suggested' })).label).toBe('Approve')
    expect(primaryAction(o({ status: 'New', outcome: 'NeedsVerification' })).label).toBe('Review')
    expect(primaryAction(o({ status: 'Shortlisted' })).label).toBe('Open posting')
    expect(primaryAction(o({ status: 'Shortlisted', mode: 'Customer' })).label).toBe('Draft outreach')
    expect(nextPermittedAction(o({ status: 'Shortlisted', mode: 'Customer' }))).toMatch(/Draft outreach/)
    expect(nextPermittedAction(o({ status: 'Shortlisted', mode: 'Job' }))).toMatch(/application page/)
    expect(nextPermittedAction(o({ status: 'Suggested' }))).toMatch(/Nothing is contacted/)
  })
})
