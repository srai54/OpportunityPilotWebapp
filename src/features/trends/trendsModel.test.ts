import { describe, expect, it } from 'vitest'
import type { WellfoundJob } from '../../lib/types'
import { headlines, payLine, skillGap, startupTrend, trendsPath, type TrendReport } from './trendsModel'

const report: TrendReport = {
  status: 'Ready', message: null, sampled: 10, pages: 1,
  sites: [{ name: 'LinkedIn', count: 6, sharePercent: 60 }], locations: [], employmentTypes: [], topCompanies: [],
  topSkills: [{ name: 'SQL', count: 5, sharePercent: 50 }, { name: 'AWS', count: 4, sharePercent: 40 }],
  remotePercent: 20, payListedPercent: 30, pay: [], freshness: { last24Hours: 3, last3Days: 2, lastWeek: 4, older: 1, unknown: 0 },
  observedAt: null, quotaRemaining: 150, fromCache: false, source: 'JSearch',
}

describe('trendsPath', () => {
  it('needs a role or skill', () => expect(trendsPath({ query: '  ', location: '', datePosted: 'month', pages: 1 })).toBeNull())
  it('builds the request and keeps pages between 1 and 3', () => {
    const p = new URL('http://x' + trendsPath({ query: 'react', location: 'Pune', datePosted: 'week', pages: 9 })!)
    expect(p.pathname).toBe('/api/v1/trends')
    expect(p.searchParams.get('pages')).toBe('3')
    expect(p.searchParams.get('location')).toBe('Pune')
    expect(new URL('http://x' + trendsPath({ query: 'react', location: '', datePosted: 'week', pages: 0 })!).searchParams.get('pages')).toBe('1')
    expect(new URL('http://x' + trendsPath({ query: 'react', location: '', datePosted: 'week', pages: 1, country: 'IN' })!).searchParams.get('country')).toBe('in')
  })
})

describe('payLine', () => {
  it('shows a range or a single figure without a currency', () => {
    expect(payLine({ period: 'per hour', postings: 2, medianMin: 62.5, medianMax: 68.5 })).toBe('63–69 per hour')
    expect(payLine({ period: 'per year', postings: 1, medianMin: 90000, medianMax: 90000 })).toBe('90,000 per year')
  })
})

describe('headlines', () => {
  it('summarises skills, site, remote share and freshness', () => {
    const lines = headlines(report)
    expect(lines[0]).toBe('Most asked for: SQL (50%), AWS (40%).')
    expect(lines[1]).toContain('LinkedIn carries the most')
    expect(lines[2]).toBe('5 of 10 were posted in the last 3 days; 30% show pay.')
  })
  it('says nothing for an empty or failed report', () => {
    expect(headlines({ ...report, sampled: 0 })).toEqual([])
    expect(headlines({ ...report, status: 'Failed' })).toEqual([])
  })
})

const job = (o: Partial<WellfoundJob>): WellfoundJob => ({ id: o.companyName ?? 'x', providerJobId: 'p', scope: 'CandidateDiscovery', title: 't', companyName: 'A', location: null, remoteType: null,
  salaryMin: null, salaryMax: null, currency: null, equityMin: null, equityMax: null, experienceLevel: null, employmentType: null, industry: null, fundingStage: null,
  employeeCount: null, visaSponsorship: null, postedAt: null, applyUrl: 'https://wellfound.com/jobs/1', summary: null, skills: [], matchScore: null, state: 'New', isDemo: false, version: 1, ...o } as WellfoundJob)

describe('startupTrend', () => {
  it('counts places, companies, remote, pay, equity and stages from stored listings and ignores demo rows', () => {
    const t = startupTrend([
      job({ companyName: 'Alpaca', location: 'New York', remoteType: 'Remote only', salaryMin: 100, fundingStage: 'Seed' }),
      job({ companyName: 'Alpaca', location: 'new york', fundingStage: 'Seed', equityMin: 0.1 }),
      job({ companyName: 'Codes', location: 'Boston', remoteType: 'In office' }),
      job({ companyName: 'Demo', location: 'Mars', isDemo: true }),
    ])
    expect(t.sampled).toBe(3)
    expect(t.topPlaces[0]).toMatchObject({ name: 'New York', count: 2, sharePercent: 67 })
    expect(t.topCompanies[0]).toMatchObject({ name: 'Alpaca', count: 2 })
    expect(t.remotePercent).toBe(33)
    expect(t.withSalaryPercent).toBe(33)
    expect(t.withEquityPercent).toBe(33)
    expect(t.stages[0]).toMatchObject({ name: 'Seed', count: 2 })
  })
})

describe('skillGap', () => {
  const demand = [
    { name: 'SQL', count: 12, sharePercent: 60 }, { name: 'Python', count: 10, sharePercent: 50 }, { name: 'Databricks', count: 6, sharePercent: 30 },
    { name: '.NET', count: 2, sharePercent: 10 },
  ]
  it('splits demand into skills you have and skills you lack, matching aliases and case', () => {
    const g = skillGap(demand, ['sql', 'PYTHON', 'dotnet', ' '])
    expect(g.have.map((s) => s.name)).toEqual(['SQL', 'Python', '.NET'])
    expect(g.missing.map((s) => s.name)).toEqual(['Databricks'])
    expect(g.coveragePercent).toBe(80)   // (12 + 10 + 2) of 30 mentions
  })
  it('covers nothing for an empty profile and handles no demand', () => {
    expect(skillGap(demand, []).coveragePercent).toBe(0)
    expect(skillGap([], ['sql'])).toEqual({ have: [], missing: [], coveragePercent: 0 })
  })
})
