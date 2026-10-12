import type { WellfoundJob } from '../../lib/types'

export type TrendCount = { name: string; count: number; sharePercent: number }
export type TrendPay = { period: string; postings: number; medianMin: number; medianMax: number }
export type TrendFreshness = { last24Hours: number; last3Days: number; lastWeek: number; older: number; unknown: number }

/** The API's report for a sample of the newest postings (`GET /api/v1/trends`). */
export type TrendReport = {
  status: 'Ready' | 'NotConfigured' | 'Failed'
  message: string | null
  sampled: number
  pages: number
  sites: TrendCount[]
  topSkills: TrendCount[]
  topCompanies: TrendCount[]
  locations: TrendCount[]
  employmentTypes: TrendCount[]
  remotePercent: number
  payListedPercent: number
  pay: TrendPay[]
  freshness: TrendFreshness
  observedAt: string | null
  quotaRemaining: number | null
  fromCache: boolean
  source: string
}

export type TrendSearch = { query: string; location: string; datePosted: string; pages: number }

export const DATE_OPTIONS = [
  { value: 'week', label: 'Past week' },
  { value: 'month', label: 'Past month' },
  { value: '3days', label: 'Past 3 days' },
  { value: 'today', label: 'Past 24 hours' },
  { value: 'all', label: 'Any time' },
]

export const SAMPLE_OPTIONS = [
  { value: 1, label: 'Quick — about 10 postings (1 search)' },
  { value: 2, label: 'Better — about 20 postings (2 searches)' },
  { value: 3, label: 'Best — about 30 postings (3 searches)' },
]

/** API path for a trend report, or null when there is no role or skill to look at. */
export function trendsPath(s: TrendSearch): string | null {
  const q = s.query.trim()
  if (!q) return null
  const p = new URLSearchParams({ query: q.slice(0, 200), datePosted: s.datePosted, pages: String(Math.min(3, Math.max(1, s.pages))) })
  if (s.location.trim()) p.set('location', s.location.trim().slice(0, 100))
  return `/api/v1/trends?${p}`
}

/** "USD 65–67 per hour" style text without inventing a currency: JSearch v5 does not give one. */
export function payLine(p: TrendPay): string {
  const n = (v: number) => new Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format(v)
  return `${p.medianMin === p.medianMax ? n(p.medianMin) : `${n(p.medianMin)}–${n(p.medianMax)}`} ${p.period}`
}

/** Plain-English read-out of a report: three facts a person can act on, never a claim the sample cannot support. */
export function headlines(r: TrendReport): string[] {
  if (r.status !== 'Ready' || r.sampled === 0) return []
  const out: string[] = []
  const skills = r.topSkills.slice(0, 3)
  if (skills.length) out.push(`Most asked for: ${skills.map((s) => `${s.name} (${s.sharePercent}%)`).join(', ')}.`)
  const site = r.sites[0]
  if (site) out.push(`${site.name} carries the most of these postings (${site.sharePercent}%); ${r.remotePercent}% are remote.`)
  const fresh = r.freshness.last24Hours + r.freshness.last3Days
  out.push(`${fresh} of ${r.sampled} were posted in the last 3 days${r.payListedPercent ? `; ${r.payListedPercent}% show pay` : '; none show pay'}.`)
  return out
}

export type StartupTrend = { sampled: number; topPlaces: TrendCount[]; topCompanies: TrendCount[]; remotePercent: number; withSalaryPercent: number; withEquityPercent: number; stages: TrendCount[] }

function top(values: (string | null | undefined)[], total: number, take: number): TrendCount[] {
  const counts = new Map<string, { name: string; count: number }>()
  for (const raw of values) {
    const name = raw?.trim()
    if (!name) continue
    const key = name.toLowerCase()
    const hit = counts.get(key)
    if (hit) hit.count++
    else counts.set(key, { name, count: 1 })
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, take)
    .map((c) => ({ name: c.name, count: c.count, sharePercent: total ? Math.round((100 * c.count) / total) : 0 }))
}

/** Free trends from the Wellfound listings the app already stores (no provider search is used). */
export function startupTrend(jobs: WellfoundJob[]): StartupTrend {
  const live = jobs.filter((j) => !j.isDemo)
  const n = live.length
  const pct = (part: number) => (n ? Math.round((100 * part) / n) : 0)
  return {
    sampled: n,
    topPlaces: top(live.map((j) => j.location), n, 8),
    topCompanies: top(live.map((j) => j.companyName), n, 8),
    remotePercent: pct(live.filter((j) => /remote/i.test(j.remoteType ?? '')).length),
    withSalaryPercent: pct(live.filter((j) => j.salaryMin !== null || j.salaryMax !== null).length),
    withEquityPercent: pct(live.filter((j) => j.equityMin !== null || j.equityMax !== null).length),
    stages: top(live.map((j) => j.fundingStage), n, 5),
  }
}

const ALIASES: Record<string, string> = {
  dotnet: '.net', 'dot net': '.net', 'asp.net core': 'asp.net', csharp: 'c#', 'c sharp': 'c#', js: 'javascript', ts: 'typescript',
  node: 'node.js', nodejs: 'node.js', postgres: 'postgresql', k8s: 'kubernetes', 'react.js': 'react', reactjs: 'react', 'vue.js': 'vue',
  golang: 'golang', gcp: 'gcp', 'google cloud': 'gcp', 'amazon web services': 'aws', ml: 'machine learning', 'ci/cd': 'ci/cd',
}

const norm = (v: string) => {
  const k = v.trim().toLowerCase()
  return ALIASES[k] ?? k
}

export type SkillGap = {
  have: TrendCount[]
  missing: TrendCount[]
  /** Share of the sampled demand (by how often each skill appears) that the profile covers, 0–100. */
  coveragePercent: number
}

/** Which of the skills in demand are on the profile, and which are not. Names are matched after a small alias list; nothing is guessed. */
export function skillGap(inDemand: TrendCount[], mySkills: string[]): SkillGap {
  const mine = new Set(mySkills.map(norm).filter(Boolean))
  const have = inDemand.filter((s) => mine.has(norm(s.name)))
  const missing = inDemand.filter((s) => !mine.has(norm(s.name)))
  const total = inDemand.reduce((n, s) => n + s.count, 0)
  const covered = have.reduce((n, s) => n + s.count, 0)
  return { have, missing, coveragePercent: total ? Math.round((100 * covered) / total) : 0 }
}
