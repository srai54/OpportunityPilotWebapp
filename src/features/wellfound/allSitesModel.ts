import type { BoardJob, BoardSearchResult, JobBoard } from './boardModel'

/** What `GET /api/v1/jobboards/feeds` returns. */
export type FeedSiteStatus = { site: string; status: 'Ready' | 'Failed'; listed: number; matched: number; message: string | null; fromCache: boolean }
export type FeedJob = { site: string; siteName: string; job: BoardJob }
export type FeedSearchResult = { sites: FeedSiteStatus[]; jobs: FeedJob[]; observedAt: string }

/** One row of the merged list: the posting, and the site it came from. */
export type AllJob = { site: string; siteName: string; job: BoardJob }

export function feedsPath(s: { query: string; location: string; remoteOnly: boolean }): string | null {
  const q = s.query.trim()
  if (!q) return null
  const p = new URLSearchParams({ query: q.slice(0, 200), take: '80' })
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
