import { describe, expect, it } from 'vitest'
import type { BoardJob, BoardSearchResult } from './boardModel'
import { dedupeKey, feedsPath, mergeAll, relevance, siteLines, type FeedJob } from './allSitesModel'

const job = (o: Partial<BoardJob>): BoardJob => ({
  providerJobId: 'x', title: 'React Developer', companyName: 'Acme', companyLogoUrl: null, boardUrl: 'https://x.test/1', location: 'Berlin', isRemote: false,
  employmentType: null, salaryMin: null, salaryMax: null, salaryCurrency: null, salaryPeriod: null, postedAt: null, snippet: null, ...o,
})
const fj = (site: string, o: Partial<BoardJob>): FeedJob => ({ site, siteName: site, job: job(o) })

describe('feedsPath', () => {
  it('needs a query and carries place and remote', () => {
    expect(feedsPath({ query: '  ', location: '', remoteOnly: false })).toBeNull()
    expect(feedsPath({ query: 'react developer', location: 'Berlin', remoteOnly: true })).toBe('/api/v1/jobboards/feeds?query=react+developer&take=80&location=Berlin&remoteOnly=true')
  })
})

describe('dedupeKey', () => {
  it('ignores case, punctuation and spacing', () => {
    expect(dedupeKey({ title: 'React  Developer!', companyName: 'ACME, Inc.' })).toBe(dedupeKey({ title: 'react developer', companyName: 'Acme Inc' }))
    expect(dedupeKey({ title: 'A', companyName: 'B' })).not.toBe(dedupeKey({ title: 'A', companyName: 'C' }))
  })
})

describe('mergeAll', () => {
  it('keeps the free feed copy of a job that a paid board also returned, newest first', () => {
    const merged = mergeAll(
      [fj('Arbeitnow', { providerJobId: 'f1', postedAt: '2026-10-10T00:00:00Z' })],
      [{ board: 'LinkedIn', jobs: [job({ providerJobId: 'l1', postedAt: '2026-10-10T00:00:00Z' }), job({ providerJobId: 'l2', title: 'Go Developer', postedAt: '2026-10-12T00:00:00Z' })] }],
    )
    expect(merged.map((m) => `${m.site}:${m.job.providerJobId}`)).toEqual(['LinkedIn:l2', 'Arbeitnow:f1'])
  })
  it('puts undated jobs last and handles nothing at all', () => {
    expect(mergeAll([], [])).toEqual([])
    const m = mergeAll([fj('Jobicy', { providerJobId: 'a', title: 'One' }), fj('Jobicy', { providerJobId: 'b', title: 'Two', postedAt: '2026-10-01T00:00:00Z' })], [])
    expect(m.map((x) => x.job.providerJobId)).toEqual(['b', 'a'])
  })
})

describe('relevance', () => {
  it('ranks a title match above a mention in the text, across sites', () => {
    const merged = mergeAll(
      [fj('Arbeitnow', { providerJobId: 'f', title: 'Product Lead', snippet: 'works with the sales manager', postedAt: '2026-10-12T00:00:00Z' })],
      [{ board: 'LinkedIn', jobs: [job({ providerJobId: 'l', title: 'Sales Manager', companyName: 'Zed', postedAt: '2026-10-01T00:00:00Z' })] }],
      'sales manager',
    )
    expect(merged.map((m) => m.job.providerJobId)).toEqual(['l', 'f'])
    expect(relevance(job({ title: 'Sales Manager' }), 'sales manager')).toBe(8)
    expect(relevance(job({ title: 'X', companyName: 'Y' }), '')).toBe(0)
  })
})

describe('siteLines', () => {
  it('says plainly what each site did', () => {
    const ready = { board: 'Indeed', status: 'Ready', jobs: [job({})], providerResults: 1, message: null, observedAt: null, fromCache: false, source: 'JSearch' } as BoardSearchResult
    const off = { board: 'LinkedIn', status: 'NotConfigured', jobs: [], providerResults: 0, message: 'no key', observedAt: null, fromCache: false, source: 'JSearch' } as BoardSearchResult
    const lines = siteLines(
      { sites: [{ site: 'WeWorkRemotely', status: 'Ready', listed: 89, matched: 4, message: null, fromCache: true }, { site: 'Jobicy', status: 'Failed', listed: 0, matched: 0, message: 'down', fromCache: false }], jobs: [], observedAt: '' },
      [{ board: 'Indeed', result: ready }, { board: 'LinkedIn', result: off }, { board: 'Seek', result: new Error('x') }],
    )
    expect(lines.map((l) => `${l.name}: ${l.text}`)).toEqual(['We Work Remotely: 4 of 89', 'Jobicy: down', 'Indeed: 1 found', 'LinkedIn: not set up on this server', 'SEEK: did not answer'])
    expect(lines.map((l) => l.ok)).toEqual([true, false, true, false, false])
  })
})
