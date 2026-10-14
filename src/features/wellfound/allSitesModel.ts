import type { BoardJob, BoardSearchResult, JobBoard } from './boardModel'

/** What `GET /api/v1/jobboards/feeds` returns. */
export type FeedSiteStatus = { site: string; status: 'Ready' | 'Failed'; listed: number; matched: number; message: string | null; fromCache: boolean }
export type FeedJob = { site: string; siteName: string; job: BoardJob }
export type FeedSearchResult = { sites: FeedSiteStatus[]; jobs: FeedJob[]; observedAt: string }

/** One row of the merged list: the posting, and the site it came from. */
export type AllJob = { site: string; siteName: string; job: BoardJob }

/** Every site "All sites" can read. Free ones need no key; the paid ones go through JSearch and use the monthly allowance. */
export const FREE_SITES = [
  { id: 'Arbeitnow', label: 'Arbeitnow', note: 'Europe and remote' },
  { id: 'Jobicy', label: 'Jobicy', note: 'Remote' },
  { id: 'WeWorkRemotely', label: 'We Work Remotely', note: 'Remote' },
  { id: 'Remotive', label: 'Remotive', note: 'Remote' },
  { id: 'RemoteOk', label: 'Remote OK', note: 'Remote' },
  { id: 'Himalayas', label: 'Himalayas', note: 'Remote, worldwide' },
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
  const seen = new Set<string>()
  const all: AllJob[] = []
  const push = (site: string, siteName: string, job: BoardJob) => {
    const key = dedupeKey(job)
    if (seen.has(key)) return
    seen.add(key)
    all.push({ site, siteName, job })
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
export type HiringCompany = { company: string; roles: AllJob[]; sites: string[]; places: string[]; remote: boolean; newest: string | null }

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
    if (!g) { g = { company: name, roles: [], sites: [], places: [], remote: false, newest: null }; firstSeen.set(g, i) }
    g.roles.push(j)
    if (!g.sites.includes(j.siteName)) g.sites.push(j.siteName)
    if (j.job.location && !g.places.includes(j.job.location)) g.places.push(j.job.location)
    g.remote ||= Boolean(j.job.isRemote)
    if (j.job.postedAt && (!g.newest || j.job.postedAt > g.newest)) g.newest = j.job.postedAt
    groups.set(key, g)
  })
  return [...groups.values()].sort((a, b) => b.roles.length - a.roles.length || firstSeen.get(a)! - firstSeen.get(b)!)
}
