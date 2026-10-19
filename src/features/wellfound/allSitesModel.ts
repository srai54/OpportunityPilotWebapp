import type { BoardJob, BoardSearchResult, JobBoard } from './boardModel'
import { isContract, isRemote } from './jobSignals'
import { SOURCES } from './sourcesModel'

export { isContract, isRemote }

/** What `GET /api/v1/jobboards/feeds` returns. */
export type FeedSiteStatus = { site: string; status: 'Ready' | 'Failed'; listed: number; matched: number; message: string | null; fromCache: boolean }
export type FeedJob = { site: string; siteName: string; job: BoardJob }
export type FeedSearchResult = { sites: FeedSiteStatus[]; jobs: FeedJob[]; observedAt: string }

/** One row of the merged list: the posting, and the site it came from. */
export type AllJob = { site: string; siteName: string; job: BoardJob; /** Other sites with the same posting (U1: shown once, with every site's badge). */ alsoOn?: string[] }

/** Every site "All sites" can read. Free ones need no key; the paid ones go through JSearch and use the monthly allowance. */
export const FREE_SITES = [
  { id: 'Arbeitnow', label: 'Arbeitnow', note: 'Europe and remote' },
  { id: 'Jobicy', label: 'Jobicy', note: 'Remote' },
  { id: 'WeWorkRemotely', label: 'We Work Remotely', note: 'Remote' },
  { id: 'Remotive', label: 'Remotive', note: 'Remote' },
  { id: 'RemoteOk', label: 'Remote OK', note: 'Remote' },
  { id: 'Himalayas', label: 'Himalayas', note: 'Remote, worldwide' },
  { id: 'WorkingNomads', label: 'Working Nomads', note: 'Remote, worldwide' },
  { id: 'HackerNews', label: 'HN Who is hiring', note: 'Monthly thread, many remote and contract roles' },
  { id: 'TheMuse', label: 'The Muse', note: 'US and worldwide' },
  { id: 'Instahyre', label: 'Instahyre', note: 'India tech jobs' },
  { id: 'Adzuna', label: 'Adzuna', note: 'India, UK, US and more (needs server keys)' },
] as const
export const PAID_SITES = [
  { id: 'LinkedIn', label: 'LinkedIn' },
  { id: 'Indeed', label: 'Indeed' },
  { id: 'Seek', label: 'SEEK' },
  { id: 'Naukri', label: 'Naukri' },
] as const

/** Country groups shown in the Country list; the region picker (sourcesModel REGIONS) preselects one of these. */
export type CountryGroup = 'US' | 'Canada' | 'Europe' | 'India' | 'Middle East' | 'Australia & NZ' | 'Asia-Pacific'

/** Markets for the Sales team: the US, Europe country by country, and the other regions. The country narrows the place a search is sent with. */
export const COUNTRIES: readonly { value: string; label: string; group: CountryGroup }[] = [
  { value: 'United States', label: 'United States', group: 'US' },
  { value: 'Canada', label: 'Canada', group: 'Canada' },
  { value: 'Sweden', label: 'Sweden', group: 'Europe' }, { value: 'Germany', label: 'Germany', group: 'Europe' },
  { value: 'United Kingdom', label: 'United Kingdom', group: 'Europe' }, { value: 'Netherlands', label: 'Netherlands', group: 'Europe' },
  { value: 'France', label: 'France', group: 'Europe' }, { value: 'Denmark', label: 'Denmark', group: 'Europe' },
  { value: 'Norway', label: 'Norway', group: 'Europe' }, { value: 'Finland', label: 'Finland', group: 'Europe' },
  { value: 'Ireland', label: 'Ireland', group: 'Europe' }, { value: 'Spain', label: 'Spain', group: 'Europe' },
  { value: 'Poland', label: 'Poland', group: 'Europe' }, { value: 'Switzerland', label: 'Switzerland', group: 'Europe' },
  { value: 'India', label: 'India', group: 'India' },
  { value: 'United Arab Emirates', label: 'United Arab Emirates', group: 'Middle East' }, { value: 'Saudi Arabia', label: 'Saudi Arabia', group: 'Middle East' },
  { value: 'Qatar', label: 'Qatar', group: 'Middle East' },
  { value: 'Australia', label: 'Australia', group: 'Australia & NZ' }, { value: 'New Zealand', label: 'New Zealand', group: 'Australia & NZ' },
  { value: 'Singapore', label: 'Singapore', group: 'Asia-Pacific' }, { value: 'Japan', label: 'Japan', group: 'Asia-Pacific' },
]

export const COUNTRY_GROUPS: readonly CountryGroup[] = ['US', 'Canada', 'Europe', 'India', 'Middle East', 'Australia & NZ', 'Asia-Pacific']

/** The place sent to the sites: the typed place and the chosen country together ("Berlin, Germany"), or whichever there is. */
export function placeWithCountry(place: string, country: string): string {
  const p = place.trim(), c = country.trim()
  if (!c) return p
  if (!p) return c
  return p.toLowerCase().includes(c.toLowerCase()) ? p : `${p}, ${c}`
}

/** What is searched: every site except the ones switched off; the paid ones only when the server has the key. */
export function chosenSites(off: ReadonlySet<string>, paidReady: boolean): { free: string[]; paid: JobBoard[] } {
  return {
    free: FREE_SITES.map((s) => s.id).filter((id) => !off.has(id)),
    paid: paidReady ? PAID_SITES.map((s) => s.id).filter((id) => !off.has(id)) : [],
  }
}

export function feedsPath(s: { query: string; location: string; remoteOnly: boolean; sites?: readonly string[] }): string | null {
  const q = s.query.trim()
  if (!q) return null
  const p = new URLSearchParams({ query: q.slice(0, 200), take: '80' })
  // Leaving the list out means "every free site", so it is only sent when some are switched off.
  if (s.sites && s.sites.length > 0 && s.sites.length < FREE_SITES.length) p.set('sites', s.sites.join(','))
  if (s.location.trim()) p.set('location', s.location.trim().slice(0, 100))
  if (s.remoteOnly) p.set('remoteOnly', 'true')
  return `/api/v1/jobboards/feeds?${p}`
}

/** The same posting on two sites is shown once: same title at the same company, ignoring case and spacing. */
export function dedupeKey(j: Pick<BoardJob, 'title' | 'companyName'>): string {
  const norm = (x: string) => x.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
  return `${norm(j.title)}|${norm(j.companyName)}`
}

const ts = (j: BoardJob) => (j.postedAt ? Date.parse(j.postedAt) || 0 : 0)

/** 4 per query word in the title, 2 in the company, 1 in the snippet — the same idea the server uses, so paid and free results rank together. */
export function relevance(j: Pick<BoardJob, 'title' | 'companyName' | 'snippet'>, query: string): number {
  let score = 0
  for (const w of query.toLowerCase().split(/[\s,;]+/).filter(Boolean)) {
    if (j.title.toLowerCase().includes(w)) score += 4
    if (j.companyName.toLowerCase().includes(w)) score += 2
    if ((j.snippet ?? '').toLowerCase().includes(w)) score += 1
  }
  return score
}

/**
 * Merges the free feeds and the paid boards. The first occurrence wins, so a free feed (no quota, a direct link) beats the same
 * job from a paid board; best title matches first, then newest.
 */
export function mergeAll(feed: readonly FeedJob[], boards: readonly { board: JobBoard; jobs: readonly BoardJob[] }[], query = ''): AllJob[] {
  const seen = new Map<string, AllJob>()
  const all: AllJob[] = []
  const push = (site: string, siteName: string, job: BoardJob) => {
    const key = dedupeKey(job)
    const first = seen.get(key)
    if (first) {
      if (first.siteName !== siteName && !(first.alsoOn ?? []).includes(siteName)) first.alsoOn = [...(first.alsoOn ?? []), siteName]
      return
    }
    const row: AllJob = { site, siteName, job }
    seen.set(key, row)
    all.push(row)
  }
  for (const f of feed) push(f.site, f.siteName, f.job)
  for (const b of boards) for (const j of b.jobs) push(b.board, b.board === 'Seek' ? 'SEEK' : b.board, j)
  return all.sort((a, b) => relevance(b.job, query) - relevance(a.job, query) || ts(b.job) - ts(a.job))
}

const VISA = /\b(visa sponsorship|visa support|sponsor(?:s|ship)?.{0,20}visa|work permit|blue card|relocation (?:package|support|assistance|bonus|allowance)|we (?:can )?relocate|relocate you|will relocate)\b/i

/** True when the posting's own text mentions visa sponsorship, a work permit or relocation help. A text signal, not a verified fact. */
export function mentionsVisaOrRelocation(j: Pick<BoardJob, 'title' | 'snippet' | 'description'>): boolean {
  return VISA.test(`${j.title} ${j.description ?? j.snippet ?? ''}`)
}

/** One honest line per site: how many matched, or why it did not answer. */
export function siteLines(feed: FeedSearchResult | undefined, boards: readonly { board: JobBoard; result: BoardSearchResult | Error }[]): { name: string; text: string; ok: boolean }[] {
  const lines: { name: string; text: string; ok: boolean }[] = []
  for (const s of feed?.sites ?? []) lines.push({ name: s.site === 'WeWorkRemotely' ? 'We Work Remotely' : s.site === 'RemoteOk' ? 'Remote OK' : s.site, ok: s.status === 'Ready', text: s.status === 'Ready' ? `${s.matched} of ${s.listed}` : (s.message ?? 'did not answer') })
  for (const b of boards) {
    const name = b.board === 'Seek' ? 'SEEK' : b.board
    if (b.result instanceof Error) lines.push({ name, ok: false, text: 'did not answer' })
    else lines.push({ name, ok: b.result.status === 'Ready', text: b.result.status === 'Ready' ? `${b.result.jobs.length} found` : (b.result.status === 'NotConfigured' ? 'not set up on this server' : (b.result.message ?? 'unavailable')) })
  }
  return lines
}

/** A company that is hiring: the sales view of a search, one row per company instead of one per posting. */
export type HiringCompany = { company: string; roles: AllJob[]; sites: string[]; places: string[]; remote: boolean; contract: boolean; newest: string | null }

const companyKey = (name: string) => name.toLowerCase().replace(/\b(inc|ltd|llc|limited|gmbh|pvt|private|corp|corporation|co)\b\.?/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

/**
 * Groups postings by company (names compared without case, punctuation or "Inc/Ltd/LLC"), keeping the order of best match.
 * Companies hiring for more of these roles come first; postings without a company name are left out (nobody to contact).
 */
export function groupByCompany(jobs: readonly AllJob[]): HiringCompany[] {
  const groups = new Map<string, HiringCompany>()
  const firstSeen = new Map<HiringCompany, number>()
  jobs.forEach((j, i) => {
    const name = j.job.companyName?.trim()
    if (!name) return
    const key = companyKey(name) || name.toLowerCase()
    let g = groups.get(key)
    if (!g) { g = { company: name, roles: [], sites: [], places: [], remote: false, contract: false, newest: null }; firstSeen.set(g, i) }
    g.roles.push(j)
    for (const s of [j.siteName, ...(j.alsoOn ?? [])]) if (!g.sites.includes(s)) g.sites.push(s)
    if (j.job.location && !g.places.includes(j.job.location)) g.places.push(j.job.location)
    g.remote ||= isRemote(j.job)
    g.contract ||= isContract(j.job)
    if (j.job.postedAt && (!g.newest || j.job.postedAt > g.newest)) g.newest = j.job.postedAt
    groups.set(key, g)
  })
  return [...groups.values()].sort((a, b) => b.roles.length - a.roles.length || firstSeen.get(a)! - firstSeen.get(b)!)
}

/** Results per source id from one search, for the source cards: a number, or null when the site did not answer. */
export function siteCounts(feed: FeedSearchResult | undefined, boards: readonly { board: JobBoard; result: BoardSearchResult | Error }[]): Record<string, number | null> {
  const out: Record<string, number | null> = {}
  // The feed answer names sites by their display name ("We Work Remotely"); the cards use ids ("WeWorkRemotely").
  for (const s of feed?.sites ?? []) out[SOURCES.find((x) => x.label === s.site || x.id === s.site)?.id ?? s.site] = s.status === 'Ready' ? s.matched : null
  for (const b of boards) out[b.board] = b.result instanceof Error || b.result.status !== 'Ready' ? null : b.result.jobs.length
  return out
}

const csvCell = (v: string) => {
  // Quote every cell; a leading = + - @ is prefixed so a spreadsheet never runs it as a formula (CSV injection).
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v
  return `"${safe.replace(/"/g, '""')}"`
}

/**
 * Companies hiring, as a CSV the Sales team imports into Apollo (Accounts → Import): one row per company, with its roles, whether
 * any role is remote or contract, places, the sites it was found on and a link to one posting. No domain: the sites do not give one.
 */
export function companiesCsv(companies: readonly HiringCompany[]): string {
  const head = ['Company Name', 'Job Titles', 'Open Roles', 'Remote', 'Contract', 'Locations', 'Found On', 'Job Posting URL', 'Newest Posting']
  const rows = companies.map((c) => [
    c.company, [...new Set(c.roles.map((r) => r.job.title))].join('; '), String(c.roles.length), c.remote ? 'Yes' : 'No', c.contract ? 'Yes' : 'No',
    c.places.join('; '), c.sites.join('; '), c.roles[0]?.job.boardUrl ?? '', c.newest ? c.newest.slice(0, 10) : '',
  ])
  return [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

/**
 * "Why this lead" (rules, no AI): the facts on the postings that make a hiring company worth contacting for a staffing team.
 * Every reason comes from the postings themselves; nothing is guessed.
 */
export function whyLead(c: HiringCompany, now: Date = new Date()): string[] {
  const out: string[] = []
  const contractRoles = c.roles.filter((r) => isContract(r.job)).length
  if (c.roles.length > 1) out.push(`${c.roles.length} open roles`)
  if (contractRoles > 0) out.push(contractRoles === 1 ? 'a contract role' : `${contractRoles} contract roles`)
  if (c.remote) out.push('remote')
  if (c.newest) {
    const days = Math.floor((now.getTime() - Date.parse(c.newest)) / 86_400_000)
    if (days >= 0 && days <= 14) out.push(days === 0 ? 'posted today' : `posted ${days} day${days === 1 ? '' : 's'} ago`)
  }
  if (c.sites.length > 1) out.push(`on ${c.sites.length} sites`)
  return out
}

/** The key a company is remembered by between searches (same rule as grouping). */
export const companyMemoryKey = (name: string) => companyKey(name) || name.toLowerCase()

/** Companies in this search that were not in the last one for the same words; all of them when there was no last search. */
export function newSince(companies: readonly HiringCompany[], previous: readonly string[] | null): Set<string> {
  if (!previous) return new Set()
  const seen = new Set(previous)
  return new Set(companies.map((c) => companyMemoryKey(c.company)).filter((k) => !seen.has(k)))
}
