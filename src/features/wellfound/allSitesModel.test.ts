import { describe, expect, it } from 'vitest'
import type { BoardJob, BoardSearchResult } from './boardModel'
import { chosenSites, companiesCsv, newSince, whyLead, COUNTRIES, isContract, siteCounts, placeWithCountry, groupByCompany, dedupeKey, feedsPath, FREE_SITES, PAID_SITES, mentionsVisaOrRelocation, mergeAll, relevance, siteLines, type FeedJob } from './allSitesModel'

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

describe('mentionsVisaOrRelocation', () => {
  it('finds visa and relocation wording in the posting text, and nothing else', () => {
    for (const text of ['We offer visa sponsorship for the right person.', 'Relocation package included', 'EU Blue Card holders welcome', 'We can relocate you to Berlin', 'Visa support and a work permit are provided'])
      expect(mentionsVisaOrRelocation(job({ description: text }))).toBe(true)
    for (const text of ['Remote role in sales', 'Our office relocated last year', 'Travel visa for conferences is paid by you'])
      expect(mentionsVisaOrRelocation(job({ description: text }))).toBe(false)
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

describe('site choice', () => {
  it('lists the free sites and five search sites (with Naukri and Instahyre) and searches all unless some are off', () => {
    expect(FREE_SITES.map((s) => s.id)).toEqual(['Arbeitnow', 'Jobicy', 'WeWorkRemotely', 'Remotive', 'RemoteOk', 'Himalayas', 'WorkingNomads', 'HackerNews', 'TheMuse', 'Instahyre', 'Adzuna', 'Jooble', 'Careerjet', 'Findwork', 'UsaJobs', 'Freelancer', 'Reed'])
    expect(PAID_SITES.map((s) => s.id)).toEqual(['LinkedIn', 'Indeed', 'Seek', 'Naukri'])
    expect(chosenSites(new Set(), true)).toEqual({ free: FREE_SITES.map((s) => s.id), paid: ['LinkedIn', 'Indeed', 'Seek', 'Naukri'] })
    expect(chosenSites(new Set(['Jobicy', 'Indeed']), true)).toMatchObject({ paid: ['LinkedIn', 'Seek', 'Naukri'] })
    expect(chosenSites(new Set(), false).paid).toEqual([])
  })
  it('only names the free sites in the request when some are off', () => {
    expect(feedsPath({ query: 'react', location: '', remoteOnly: false, sites: FREE_SITES.map((s) => s.id) })).not.toContain('sites=')
    expect(feedsPath({ query: 'react', location: '', remoteOnly: false, sites: ['Himalayas', 'Jobicy'] })).toContain('sites=Himalayas%2CJobicy')
  })
})

describe('groupByCompany', () => {
  const job = (companyName: string, title: string, extra: Partial<BoardJob> = {}) => ({ site: 'Remotive', siteName: 'Remotive', job: { providerJobId: title + companyName, title, companyName, location: 'London', boardUrl: 'https://x.test', isRemote: false, postedAt: null, ...extra } as unknown as BoardJob })
  it('puts every role of one company together, most roles first, and skips postings without a company', () => {
    const groups = groupByCompany([
      job('Acme Ltd', 'React developer'),
      job('Globex', 'Frontend engineer'),
      job('acme', 'Senior React developer', { isRemote: true, postedAt: '2026-10-10T00:00:00Z' } as Partial<BoardJob>),
      job('', 'Anonymous role'),
    ])
    expect(groups.map((g) => g.company)).toEqual(['Acme Ltd', 'Globex'])
    expect(groups[0].roles.map((r) => r.job.title)).toEqual(['React developer', 'Senior React developer'])
    expect(groups[0].remote).toBe(true)
    expect(groups[0].newest).toBe('2026-10-10T00:00:00Z')
  })
})

describe('country and contract (Sales markets)', () => {
  it('joins the typed place and the country, once', () => {
    expect(placeWithCountry('Berlin', 'Germany')).toBe('Berlin, Germany')
    expect(placeWithCountry('', 'Sweden')).toBe('Sweden')
    expect(placeWithCountry('Berlin, Germany', 'Germany')).toBe('Berlin, Germany')
    expect(placeWithCountry('Pune', '')).toBe('Pune')
  })
  it('lists the US and Europe by country', () => {
    expect(COUNTRIES.filter((c) => c.group === 'US').map((c) => c.value)).toEqual(['United States'])
    expect(COUNTRIES.map((c) => c.value)).toEqual(expect.arrayContaining(['Sweden', 'Germany']))
  })
  it('spots a contract role by type or title', () => {
    expect(isContract({ employmentType: 'CONTRACTOR', title: 'Dev' })).toBe(true)
    expect(isContract({ employmentType: null, title: 'Freelance React developer' })).toBe(true)
    expect(isContract({ employmentType: 'FULLTIME', title: 'Backend engineer' })).toBe(false)
  })
})

describe('siteCounts', () => {
  it('keys the feed by site id and marks failures as null', () => {
    const counts = siteCounts(
      { sites: [{ site: 'We Work Remotely', status: 'Ready', listed: 50, matched: 7, message: null, fromCache: false }, { site: 'Jobicy', status: 'Failed', listed: 0, matched: 0, message: 'x', fromCache: false }], jobs: [], observedAt: '' },
      [{ board: 'LinkedIn', result: { board: 'LinkedIn', status: 'Ready', jobs: [job({}), job({})], providerResults: 2, message: null, observedAt: null, fromCache: false, source: 'x' } }, { board: 'Seek', result: new Error('down') }],
    )
    expect(counts).toEqual({ WeWorkRemotely: 7, Jobicy: null, LinkedIn: 2, Seek: null })
  })
  it('groups a remote role found only by its place as remote', () => {
    const [c] = groupByCompany([{ site: 'x', siteName: 'x', job: job({ location: 'Remote (worldwide)' }) }])
    expect(c.remote).toBe(true)
  })
})

describe('companiesCsv (U3, Apollo import)', () => {
  it('writes one quoted row per company and neutralises formulas', () => {
    const [c] = groupByCompany([{ site: 'x', siteName: 'Jobicy', job: job({ companyName: '=HYPERLINK("x")', title: 'Contract "React" dev' }) }])
    const csv = companiesCsv([c])
    const [head, row] = csv.trim().split('\r\n')
    expect(head).toBe('"Company Name","Job Titles","Open Roles","Remote","Contract","Locations","Found On","Job Posting URL","Newest Posting"')
    expect(row).toContain(`"'=HYPERLINK(""x"")"`)
    expect(row).toContain('"Contract ""React"" dev","1","No","Yes","Berlin","Jobicy","https://x.test/1"')
  })
})

describe('whyLead and newSince', () => {
  it('explains a lead only from its postings', () => {
    const [c] = groupByCompany([
      { site: 'a', siteName: 'Jobicy', job: job({ providerJobId: '1', title: 'Contract React dev', isRemote: true, postedAt: '2026-10-17T00:00:00Z' }) },
      { site: 'b', siteName: 'LinkedIn', job: job({ providerJobId: '2', title: 'Go dev', postedAt: '2026-10-10T00:00:00Z' }) },
    ])
    expect(whyLead(c, new Date('2026-10-19T12:00:00Z'))).toEqual(['2 open roles', 'a contract role', 'remote', 'posted 2 days ago', 'on 2 sites'])
  })
  it('marks companies that were not in the last search for the same words', () => {
    const cs = groupByCompany([{ site: 'a', siteName: 'A', job: job({ companyName: 'Acme Inc' }) }, { site: 'a', siteName: 'A', job: job({ providerJobId: '2', companyName: 'Globex' }) }])
    expect([...newSince(cs, ['acme'])]).toEqual(['globex'])
    expect(newSince(cs, null).size).toBe(0)
  })
})

describe('mergeAll also-on badges (U1)', () => {
  it('shows a posting once and lists the other sites it was on', () => {
    const merged = mergeAll([fj('Jobicy', { providerJobId: 'f1' })], [{ board: 'LinkedIn', jobs: [job({ providerJobId: 'l1' })] }, { board: 'Indeed', jobs: [job({ providerJobId: 'i1' })] }])
    expect(merged).toHaveLength(1)
    expect(merged[0].alsoOn).toEqual(['LinkedIn', 'Indeed'])
    expect(groupByCompany(merged)[0].sites).toEqual(['Jobicy', 'LinkedIn', 'Indeed'])
  })
})
