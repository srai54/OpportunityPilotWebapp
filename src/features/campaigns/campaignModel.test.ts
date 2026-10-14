import { describe, expect, it } from 'vitest'
import {
  quickSourceBodies, stoppable, repeatLabel,
  cadenceLabel,
  modeCopy,
  campaignFilterCounts,
  filterCampaigns,
  isRunning,
  jobSearchTerms,
  searchSourceBlocker,
  addTags,
  adzunaSearch,
  applicableCriteria,
  AUTO_SUGGEST,
  autoSuggestProblem,
  BOARD_TOKEN_PATTERN,
  campaignPayload,
  criteriaForMode,
  criteriaSummary,
  DEFAULT_WEIGHTS,
  draftFromCampaign,
  draftProblems,
  emptyCriteria,
  fieldError,
  newDraft,
  normaliseTags,
  normaliseWeights,
  parseBoardInput,
  parseWorkdayInput,
  parseTagInput,
  sourceKindAllowed,
  weightsForMode,
} from './campaignModel'

const sum = (r: Record<string, number | null>) => Object.values(r).reduce<number>((s, v) => s + (v ?? 0), 0)

describe('tags', () => {
  it('splits pasted lists on commas and new lines and tidies whitespace', () => {
    expect(parseTagInput(' C# ,  .NET\nAzure   Service Bus,, ')).toEqual(['C#', '.NET', 'Azure Service Bus'])
  })

  it('ignores case-insensitive duplicates, keeping the first spelling', () => {
    const r = addTags(['React'], 'react, TypeScript, typescript')
    expect(r.values).toEqual(['React', 'TypeScript'])
    expect(r.added).toEqual(['TypeScript'])
    expect(r.duplicates).toEqual(['react', 'typescript'])
  })

  it('reports tags that do not fit instead of silently dropping them', () => {
    const r = addTags(['a', 'b'], 'c, d', 3)
    expect(r.values).toEqual(['a', 'b', 'c'])
    expect(r.overflow).toEqual(['d'])
  })

  it('normalises lists coming back from the server', () => {
    expect(normaliseTags(['  Berlin ', 'berlin', '', 'Remote'])).toEqual(['Berlin', 'Remote'])
  })
})

describe('criteriaForMode', () => {
  it('drops the other mode’s fields so they cannot affect a run', () => {
    const c = criteriaForMode('Customer', { ...emptyCriteria(), requiredSkills: ['C#'], industries: ['Logistics'], candidateYears: 5 })
    expect(c.requiredSkills).toEqual([])
    expect(c.candidateYears).toBeNull()
    expect(c.industries).toEqual(['Logistics'])
  })

  it('fills lists missing from an older payload and rejects unknown work modes', () => {
    const c = criteriaForMode('Job', { workModes: ['Remote', 'Moon' as never], keywords: ['Backend engineer'] })
    expect(c.workModes).toEqual(['Remote'])
    expect(c.preferredSkills).toEqual([])
    expect(c.keywords).toEqual(['Backend engineer'])
  })
})

describe('weights', () => {
  it('fills defaults for missing keys and ignores keys from another mode', () => {
    expect(weightsForMode('Job', { experience: 50, industry: 99 })).toEqual({ ...DEFAULT_WEIGHTS.Job, experience: 50 })
  })

  it('leaves out criteria the user configured nothing for', () => {
    const c = { ...emptyCriteria(), requiredSkills: ['C#'], locations: ['Pune'] }
    expect([...applicableCriteria('Job', c)].sort()).toEqual(['location', 'mandatorySkills'])
  })

  it('counts experience as applicable at 0 years, because 0 is a configured value', () => {
    expect(applicableCriteria('Job', { ...emptyCriteria(), candidateYears: 0 }).has('experience')).toBe(true)
  })

  it('always scores the customer contact path', () => {
    expect([...applicableCriteria('Customer', emptyCriteria())]).toEqual(['contactPath'])
  })

  it('redistributes inapplicable weight proportionally and still sums to 100', () => {
    const shares = normaliseWeights(DEFAULT_WEIGHTS.Job, new Set(['mandatorySkills', 'location']))
    expect(shares).toEqual({ mandatorySkills: 67, experience: null, location: 33, preferredSkills: null })
    expect(sum(shares)).toBe(100)
  })

  it('rounds with the largest remainder so thirds add up to 100', () => {
    const shares = normaliseWeights({ a: 1, b: 1, c: 1 }, new Set(['a', 'b', 'c']))
    expect(sum(shares)).toBe(100)
    expect(Object.values(shares).sort()).toEqual([33, 33, 34])
  })

  it('shows zero shares rather than dividing by zero when every weight is 0', () => {
    expect(normaliseWeights({ a: 0, b: 0 }, new Set(['a']))).toEqual({ a: 0, b: null })
  })

  it('clamps out-of-range input before normalising', () => {
    expect(normaliseWeights({ a: 250, b: -5 }, new Set(['a', 'b']))).toEqual({ a: 100, b: 0 })
  })
})

describe('criteriaSummary', () => {
  it('lists only configured criteria, separating hard filters from soft ones', () => {
    const lines = criteriaSummary('Job', { ...emptyCriteria(), requiredSkills: ['C#', '.NET'], candidateYears: 4, workModes: ['Onsite'] })
    expect(lines).toEqual([
      { label: 'Required skills', value: 'C#, .NET', kind: 'hard' },
      { label: 'Work modes', value: 'On-site', kind: 'hard' },
      { label: 'Your experience', value: '4 years', kind: 'soft' },
    ])
  })
})

describe('fieldError', () => {
  it('matches ASP.NET property paths in either casing', () => {
    expect(fieldError({ Name: ['Too long.'], 'Criteria.Keywords': ['Too many.'] }, 'name')).toBe('Too long.')
    expect(fieldError({ 'Criteria.Keywords': ['Too many.'] }, 'keywords')).toBe('Too many.')
    expect(fieldError({ goal: ['x'] }, 'name')).toBeUndefined()
  })
})

describe('campaign draft', () => {
  it('sends only the chosen mode’s criteria and weights, trimmed', () => {
    const draft = { ...newDraft(), name: '  Pune backend  ', criteria: { ...emptyCriteria(), requiredSkills: ['C#'], industries: ['Retail'] } }
    const body = campaignPayload(draft, 'Job')
    expect(body.name).toBe('Pune backend')
    expect(body.criteria.industries).toEqual([])
    expect(body.criteria.requiredSkills).toEqual(['C#'])
    expect(Object.keys(body.weights).sort()).toEqual(['experience', 'location', 'mandatorySkills', 'preferredSkills'])
  })

  it('round-trips a saved campaign without reporting changes', () => {
    const saved = { profileId: 'p', mode: 'Customer' as const, name: 'EU logistics', goal: 'g', criteria: { industries: ['Logistics'] }, weights: DEFAULT_WEIGHTS.Customer, resultLimit: 25 }
    const draft = draftFromCampaign(saved)
    expect(campaignPayload(draft, 'Customer')).toEqual(campaignPayload(draftFromCampaign(saved), 'Customer'))
    expect(campaignPayload(draft, 'Customer').weights).toEqual(DEFAULT_WEIGHTS.Customer)
  })

  it('explains every reason the draft cannot be saved', () => {
    const problems = draftProblems({ ...newDraft(), resultLimit: 0, criteria: { ...emptyCriteria(), candidateYears: -1 } }, '')
    expect(problems).toHaveLength(4)
    expect(draftProblems({ ...newDraft(), name: 'Ok' }, 'p')).toEqual([])
  })
})

describe('auto-suggest threshold', () => {
  it('is off by default and off is always valid', () => {
    expect(newDraft().autoSuggestMinScore).toBeNull()
    expect(autoSuggestProblem(null)).toBeNull()
  })

  it('accepts whole numbers from 1 to 100 and defaults to 80 when turned on', () => {
    expect(AUTO_SUGGEST.default).toBe(80)
    for (const ok of [1, 80, 100]) expect(autoSuggestProblem(ok)).toBeNull()
  })

  it('rejects 0, over 100, fractions and a blank input', () => {
    for (const bad of [0, 101, 80.5, Number.NaN, -3]) expect(autoSuggestProblem(bad)).toMatch(/1 to 100/)
  })

  it('blocks saving a Job draft with a bad threshold but ignores it for Customer drafts', () => {
    const draft = { ...newDraft(), name: 'Ok', autoSuggestMinScore: 0 }
    expect(draftProblems(draft, 'p', 'Job')).toHaveLength(1)
    expect(draftProblems(draft, 'p', 'Customer')).toEqual([])
  })

  it('sends the threshold (or null to turn it off) for Job campaigns and omits it for Customer ones', () => {
    expect(campaignPayload({ ...newDraft(), autoSuggestMinScore: 75 }, 'Job')).toMatchObject({ autoSuggestMinScore: 75 })
    expect(campaignPayload(newDraft(), 'Job')).toHaveProperty('autoSuggestMinScore', null)
    expect(campaignPayload({ ...newDraft(), autoSuggestMinScore: 75 }, 'Customer')).not.toHaveProperty('autoSuggestMinScore')
  })

  it('reads the saved threshold and treats a missing field (older API) as off', () => {
    const base = { profileId: 'p', mode: 'Job' as const, name: 'n', goal: '', criteria: {}, weights: DEFAULT_WEIGHTS.Job, resultLimit: 25 }
    expect(draftFromCampaign({ ...base, autoSuggestMinScore: 90 }).autoSuggestMinScore).toBe(90)
    expect(draftFromCampaign(base).autoSuggestMinScore).toBeNull()
  })
})

describe('board tokens', () => {
  it('accepts a bare token or slug and lower-cases it', () => {
    expect(parseBoardInput('Greenhouse', ' stripe ')).toEqual({ token: 'stripe' })
    expect(parseBoardInput('Lever', 'LeverDemo')).toEqual({ token: 'leverdemo' })
    expect(parseBoardInput('Greenhouse', 'acme-labs-2')).toEqual({ token: 'acme-labs-2' })
  })

  it('derives the Greenhouse token from board URLs, with or without the scheme', () => {
    expect(parseBoardInput('Greenhouse', 'https://boards.greenhouse.io/stripe')).toEqual({ token: 'stripe' })
    expect(parseBoardInput('Greenhouse', 'boards.greenhouse.io/stripe/jobs/123456')).toEqual({ token: 'stripe' })
    expect(parseBoardInput('Greenhouse', 'https://job-boards.greenhouse.io/Stripe?gh_src=x')).toEqual({ token: 'stripe' })
    expect(parseBoardInput('Greenhouse', 'https://boards.greenhouse.io/embed/job_board?for=stripe')).toEqual({ token: 'stripe' })
  })

  it('derives the Lever slug from jobs.lever.co URLs', () => {
    expect(parseBoardInput('Lever', 'https://jobs.lever.co/leverdemo')).toEqual({ token: 'leverdemo' })
    expect(parseBoardInput('Lever', 'jobs.lever.co/leverdemo/5ac21346-8e0c-4494-8e7a-3eb92ff77902')).toEqual({ token: 'leverdemo' })
  })

  it('derives slugs for Ashby, SmartRecruiters, Recruitee and Workable', () => {
    expect(parseBoardInput('Ashby', 'https://jobs.ashbyhq.com/Ashby')).toEqual({ token: 'ashby' })
    expect(parseBoardInput('SmartRecruiters', 'https://careers.smartrecruiters.com/SmartRecruiters')).toEqual({ token: 'smartrecruiters' })
    expect(parseBoardInput('Recruitee', 'https://transperfect.recruitee.com/o/developer')).toEqual({ token: 'transperfect' })
    expect(parseBoardInput('Workable', 'https://apply.workable.com/mindex/j/ABC')).toEqual({ token: 'mindex' })
  })

  it('normalizes public Workday careers URLs and rejects account paths', () => {
    expect(parseWorkdayInput('https://nvidia.wd5.myworkdayjobs.com/en-US/NVIDIAExternalCareerSite/job/India/Engineer_R1')).toEqual({ token: 'nvidia.wd5/NVIDIAExternalCareerSite' })
    expect(parseWorkdayInput('nvidia.wd5/NVIDIAExternalCareerSite')).toEqual({ token: 'nvidia.wd5/NVIDIAExternalCareerSite' })
    expect(parseWorkdayInput('https://nvidia.wd5.myworkdayjobs.com/login').error).toContain('public Workday')
    expect(parseWorkdayInput('https://evil.example/External').error).toContain('public Workday')
  })

  it('rejects other hosts, including the other board provider', () => {
    expect(parseBoardInput('Greenhouse', 'https://jobs.lever.co/leverdemo').error).toMatch(/greenhouse\.io/)
    expect(parseBoardInput('Lever', 'https://boards.greenhouse.io/stripe').error).toMatch(/jobs\.lever\.co/)
    expect(parseBoardInput('Greenhouse', 'https://evil.example/boards.greenhouse.io/stripe').error).toBeDefined()
  })

  it('rejects blanks, links without a token and characters outside the contract pattern', () => {
    expect(parseBoardInput('Greenhouse', '   ').error).toBeDefined()
    expect(parseBoardInput('Greenhouse', 'https://boards.greenhouse.io/').error).toMatch(/does not include/)
    expect(parseBoardInput('Lever', 'acme_corp').error).toMatch(/letters, digits and hyphens/)
    expect(parseBoardInput('Lever', 'a'.repeat(101)).error).toBeDefined()
    expect(parseBoardInput('Lever', 'a'.repeat(100))).toEqual({ token: 'a'.repeat(100) })
  })

  it('only ever returns tokens that match the API pattern', () => {
    for (const raw of ['stripe', 'https://boards.greenhouse.io/stripe', 'ACME', 'x y', 'https://boards.greenhouse.io/a%20b']) {
      const r = parseBoardInput('Greenhouse', raw)
      if (r.token !== undefined) expect(BOARD_TOKEN_PATTERN.test(r.token)).toBe(true)
    }
  })
})

describe('job sources', () => {
  it('offers every public job source to Job campaigns only', () => {
    for (const kind of ['Greenhouse', 'Lever', 'Adzuna', 'Ashby', 'SmartRecruiters', 'Recruitee', 'Workable', 'Workday', 'Remotive', 'RemoteOk', 'Arbeitnow', 'Jobicy', 'WeWorkRemotely'] as const) {
      expect(sourceKindAllowed(kind, 'Job')).toBe(true)
      expect(sourceKindAllowed(kind, 'Customer')).toBe(false)
    }
    expect(sourceKindAllowed('Url', 'Customer')).toBe(true)
    expect(sourceKindAllowed('JobSearch', 'Job')).toBe(true)
    expect(sourceKindAllowed('JobSearch', 'Customer')).toBe(true)
  })

  it('shows Adzuna searching up to 3 keywords in the first non-Remote location', () => {
    expect(adzunaSearch({ keywords: ['a', 'b', 'c', 'd'], locations: ['Remote', ' Pune ', 'Delhi'] })).toEqual({
      keywords: ['a', 'b', 'c'],
      location: 'Pune',
    })
    expect(adzunaSearch({ keywords: [], locations: ['remote'] })).toEqual({ keywords: [], location: null })
  })
})

describe('campaigns list', () => {
  const list = [
    { mode: 'Job' as const, lastJob: { state: 'Running' } },
    { mode: 'Customer' as const, lastJob: null },
    { mode: 'Job' as const, lastJob: { state: 'Completed' } },
  ]
  it('filters and counts by mode', () => {
    expect(filterCampaigns(list, 'Job')).toHaveLength(2)
    expect(filterCampaigns(list, 'all')).toHaveLength(3)
    expect(campaignFilterCounts(list)).toEqual({ all: 3, Job: 2, Customer: 1, Freelance: 0, Investor: 0, Partner: 0 })
  })
  it('knows when the latest run is still going', () => {
    expect(list.map(isRunning)).toEqual([true, false, false])
  })
})

describe('jobSearchTerms', () => {
  const criteria = { keywords: ['React', 'react', 'Node'], signals: ['hiring frontend', 'new funding'], locations: ['Remote', 'Pune'] }
  it('uses keywords for Job campaigns', () =>
    expect(jobSearchTerms(criteria, 'Job')).toEqual({ terms: ['React', 'Node'], location: 'Pune', remoteOnly: false }))
  it('adds buying signals for Sales campaigns, at most 3', () =>
    expect(jobSearchTerms(criteria, 'Customer').terms).toEqual(['React', 'Node', 'hiring frontend']))
  it('searches remote only when every location is Remote', () =>
    expect(jobSearchTerms({ ...criteria, locations: ['Remote'] }, 'Job')).toMatchObject({ location: null, remoteOnly: true }))
})

describe('cadenceLabel', () => {
  it('names known cadences and falls back to minutes', () => {
    expect(cadenceLabel(1440)).toBe('Daily')
    expect(cadenceLabel(90)).toBe('Every 90 minutes')
  })
})

describe('modeCopy', () => {
  it('gives every Sales mode its own wording', () => {
    const modes = ['Customer', 'Partner', 'Investor', 'Freelance'] as const
    const goals = new Set(modes.map((m) => modeCopy(m).goal))
    const signals = new Set(modes.map((m) => modeCopy(m).signals[0]))
    expect(goals.size).toBe(4)
    expect(signals.size).toBe(4)
    for (const m of modes) expect(modeCopy(m).steps).toHaveLength(4)
  })
})

describe('searchSourceBlocker', () => {
  const empty = { keywords: [], signals: [], locations: [] }
  it('blocks a job-board source with nothing to search for', () => {
    expect(searchSourceBlocker(['JobSearch'], empty, 'Customer')).toContain('nothing to search for')
    expect(searchSourceBlocker(['JobSearch'], empty, 'Job')).toContain('job titles')
  })
  it('lets a run through with keywords or other sources', () => {
    expect(searchSourceBlocker(['JobSearch'], { ...empty, keywords: ['react'] }, 'Job')).toBeNull()
    expect(searchSourceBlocker(['Greenhouse'], empty, 'Job')).toBeNull()
  })
})

describe('quickSourceBodies', () => {
  it('adds every free feed for "all free sites", one feed, one company board or one search site', () => {
    expect(quickSourceBodies('FreeFeeds', '').map((b) => b.kind)).toEqual(['Arbeitnow', 'Jobicy', 'WeWorkRemotely', 'Remotive', 'RemoteOk', 'TheMuse'])
    expect(quickSourceBodies('Remotive', '')).toEqual([{ kind: 'Remotive' }])
    expect(quickSourceBodies('Greenhouse', 'stripe')).toEqual([{ kind: 'Greenhouse', url: 'stripe' }])
    expect(quickSourceBodies('Seek', '')).toEqual([{ kind: 'JobSearch', url: 'Seek' }])
  })
})

describe('repeatLabel', () => {
  it('says not scheduled, paused, or the cadence with the next run', () => {
    expect(repeatLabel(undefined)).toBe('Not scheduled')
    expect(repeatLabel({ cadenceMinutes: 1440, nextRunAt: '2026-10-14T09:00:00Z', paused: true })).toBe('Paused')
    expect(repeatLabel({ cadenceMinutes: 1440, nextRunAt: '2026-10-14T09:00:00Z', paused: false })).toMatch(/^Daily · next /)
  })
})

describe('stoppable', () => {
  it('finds running searches and repeating campaigns, and nothing else', () => {
    const camps = [{ lastJob: { id: 'a', state: 'Running' } }, { lastJob: { id: 'b', state: 'Completed' } }, { lastJob: null }]
    const sched = [{ id: 's1', campaignId: 'c', cadenceMinutes: 1440, nextRunAt: '', paused: false, timeZone: 'UTC', version: 1 }, { id: 's2', campaignId: 'd', cadenceMinutes: 1440, nextRunAt: '', paused: true, timeZone: 'UTC', version: 1 }]
    const r = stoppable(camps, sched)
    expect(r.runs).toHaveLength(1)
    expect(r.repeating.map((s) => s.id)).toEqual(['s1'])
    expect(stoppable([], [])).toEqual({ runs: [], repeating: [] })
  })
})
