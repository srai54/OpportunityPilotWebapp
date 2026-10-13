import type { TrendPoint, TrendTotals, ActivityFeedItem } from '../../lib/types'
import type { Workspace } from '../shell/shellModel'

/** The four lines on the trend chart, fixed order (DESIGN.md: max four series, never cycled). `reached` is Applied or Contacted. */
export type SeriesKey = 'found' | 'approved' | 'reached' | 'replied'

export interface SeriesDef { key: SeriesKey; label: string; token: string }

export function seriesFor(workspace: Workspace): SeriesDef[] {
  const sales = workspace === 'sales'
  return [
    { key: 'found', label: sales ? 'Companies found' : 'Jobs found', token: '--op-c1' },
    { key: 'approved', label: sales ? 'Leads approved' : 'Jobs approved', token: '--op-c3' },
    { key: 'reached', label: sales ? 'Contacted' : 'Applied', token: '--op-c2' },
    { key: 'replied', label: 'Replies', token: '--op-c4' },
  ]
}

export interface KpiDef { key: keyof TrendTotals; label: string }

export function kpisFor(workspace: Workspace): KpiDef[] {
  const sales = workspace === 'sales'
  return [
    { key: 'found', label: sales ? 'Companies found' : 'Jobs found' },
    { key: 'qualified', label: 'Qualified' },
    { key: 'approved', label: 'Approved' },
    { key: 'reached', label: sales ? 'Contacted' : 'Applied' },
    { key: 'sent', label: 'Messages sent' },
    { key: 'replied', label: 'Replies' },
  ]
}

export interface Delta { text: string; tone: 'up' | 'down' | 'flat' }

/** "up 3" / "down 2" / "same" compared with the window before; a plain statement, no invented percentage on tiny numbers. */
export function delta(current: number, previous: number): Delta {
  const diff = current - previous
  if (diff === 0) return { text: 'same as before', tone: 'flat' }
  return diff > 0 ? { text: `up ${diff}`, tone: 'up' } : { text: `down ${-diff}`, tone: 'down' }
}

export const sumOf = (points: readonly TrendPoint[], key: keyof TrendTotals): number => points.reduce((n, p) => n + p[key], 0)

/** Total of the most recent `days` points (the last point is today). */
export const lastDays = (points: readonly TrendPoint[], days: number): TrendPoint[] => points.slice(Math.max(0, points.length - days))

/** A friendly axis maximum: 5, 10, 20, 50, 100… at least 5, never below the data. */
export function niceMax(max: number): number {
  if (max <= 5) return 5
  const pow = 10 ** Math.floor(Math.log10(max))
  for (const step of [1, 2, 5, 10]) if (step * pow >= max) return step * pow
  return 10 * pow
}

/** Whole-number gridline values from 0 to `max` (a value from `niceMax`), e.g. 5 → 0..5, 10 → 0,2,…,10, 100 → 0,25,…,100. */
export function axisTicks(max: number): number[] {
  const intervals = max <= 5 ? Math.max(1, max) : max % 4 === 0 ? 4 : max % 5 === 0 ? 5 : 2
  return Array.from({ length: intervals + 1 }, (_, i) => Math.round((max * i) / intervals))
}

/** Drops empty bands at both ends of a histogram so a few real bands are not buried in zeros; always keeps at least one. */
export function trimBands<T extends { count: number }>(bands: readonly T[]): T[] {
  const first = bands.findIndex((b) => b.count > 0)
  if (first < 0) return bands.slice(-1)
  let last = bands.length - 1
  while (last > first && bands[last].count === 0) last--
  return bands.slice(first, last + 1)
}

/** SVG polyline points for a series: x spread across the width, y inverted against `max`. One point sits in the middle. */
export function linePoints(values: readonly number[], width: number, height: number, pad: { l: number; r: number; t: number; b: number }, max: number): string {
  const innerW = width - pad.l - pad.r
  const innerH = height - pad.t - pad.b
  return values
    .map((v, i) => {
      const x = values.length === 1 ? pad.l + innerW / 2 : pad.l + (innerW * i) / (values.length - 1)
      const y = pad.t + innerH - (innerH * Math.min(v, max)) / max
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

/** Index of the point nearest an x position inside the plot, for hover and keyboard readouts. */
export function nearestIndex(x: number, count: number, width: number, padL: number, padR: number): number {
  if (count <= 1) return 0
  const t = (x - padL) / (width - padL - padR)
  return Math.min(count - 1, Math.max(0, Math.round(t * (count - 1))))
}

/** Share of `part` in `whole` as a whole percent; null when there is nothing to divide by. */
export function percent(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null
}

export interface FunnelRow { key: string; label: string; count: number; fromPrevious: number | null }

/** Found → Qualified → Approved → Applied/Contacted → Replied for a window, with each step as a share of the one before. */
export function funnelRows(workspace: Workspace, t: TrendTotals): FunnelRow[] {
  const sales = workspace === 'sales'
  const steps: { key: string; label: string; count: number }[] = [
    { key: 'found', label: sales ? 'Companies found' : 'Jobs found', count: t.found },
    { key: 'qualified', label: 'Qualified', count: t.qualified },
    { key: 'approved', label: 'Approved', count: t.approved },
    { key: 'reached', label: sales ? 'Contacted' : 'Applied', count: t.reached },
    { key: 'replied', label: 'Replied', count: t.replied },
  ]
  return steps.map((s, i) => ({ ...s, fromPrevious: i === 0 ? null : percent(s.count, steps[i - 1].count) }))
}

/* ---- Weekly goal -------------------------------------------------------------- */

export const GOAL_MIN = 1
export const GOAL_MAX = 200
export const GOAL_DEFAULT = 10

export const goalKey = (workspace: Workspace) => `op.goal.${workspace}`

export function clampGoal(n: number): number {
  return Number.isFinite(n) ? Math.min(GOAL_MAX, Math.max(GOAL_MIN, Math.round(n))) : GOAL_DEFAULT
}

export function readGoal(workspace: Workspace): number {
  try {
    const raw = window.localStorage.getItem(goalKey(workspace))
    return raw === null ? GOAL_DEFAULT : clampGoal(Number(raw))
  } catch {
    return GOAL_DEFAULT
  }
}

export function writeGoal(workspace: Workspace, n: number): void {
  try { window.localStorage.setItem(goalKey(workspace), String(clampGoal(n))) } catch { /* the goal lasts for this page view only */ }
}

/** What the weekly goal counts: Candidate = applications made, Sales = messages sent. */
export function goalMetric(workspace: Workspace): { key: 'reached' | 'sent'; label: string } {
  return workspace === 'sales' ? { key: 'sent', label: 'messages sent' } : { key: 'reached', label: 'applications made' }
}

export function goalProgress(done: number, goal: number): { pct: number; text: string } {
  const g = clampGoal(goal)
  return { pct: Math.min(100, Math.round((done / g) * 100)), text: `${done} of ${g}` }
}

/** Plain-language one-line takeaway for the trend chart, so the picture is also said in words. */
export function trendSummary(workspace: Workspace, days: number, current: TrendTotals, previous: TrendTotals): string {
  const s = seriesFor(workspace)
  const label = (k: SeriesKey) => s.find((x) => x.key === k)!.label
  if (current.found + current.approved + current.reached + current.replied + current.sent === 0)
    return `Nothing recorded in the last ${days} days yet.`
  const d = delta(current.found, previous.found)
  // Label first, then the number: it reads right for 1 and for 6 ("Leads approved: 1"), with no plural to get wrong.
  return `Last ${days} days: ${label('found')} ${current.found} (${d.text}) · ${label('approved')} ${current.approved} · ${label('reached')} ${current.reached} · Replies ${current.replied}.`
}

const ACTIVITY_VERBS: Record<string, string> = {
  Researched: 'Found',
  Suggested: 'Suggested for review',
  Approved: 'You approved',
  Rejected: 'You skipped',
  Applied: 'You applied to',
  StatusChanged: 'Updated',
}

/** Kinds the person's own actions are recorded as. Their stored detail is already a full sentence. */
const OWN_KINDS = new Set(['Searched', 'RunStarted', 'ProfileSaved', 'DraftCreated', 'DraftEdited', 'DraftApproved', 'FollowUpUpdated', 'MailboxConnected'])

/** "You approved" / "Found" for a stored activity kind; an unknown kind is shown as written, never guessed. */
export function activityVerb(kind: string): string {
  return ACTIVITY_VERBS[kind] ?? kind
}

/** One readable line per recorded action: the verb, the job or lead, and the stored detail when it adds something. */
export function activityLine(item: Pick<ActivityFeedItem, 'kind' | 'title' | 'organization' | 'detail'> & { opportunityId?: string | null }, sales: boolean): string {
  if (OWN_KINDS.has(item.kind)) {
    const what = item.opportunityId ? (sales ? item.organization || item.title : item.title) : ''
    return what ? `${item.detail}: ${what}` : item.detail
  }
  const what = sales ? item.organization || item.title : [item.title, item.organization].filter(Boolean).join(' · ')
  const detail = item.detail && item.kind === 'StatusChanged' ? ` — ${item.detail}` : ''
  return `${activityVerb(item.kind)} ${what}${detail}`
}

export type ActivityGroup = 'all' | 'searches' | 'messages' | 'decisions' | 'applications' | 'followups' | 'setup'

/** The filter chips and the stored kinds each one stands for (the API filters on kinds, not on groups). */
export const ACTIVITY_GROUPS: { key: ActivityGroup; label: string; kinds: string[] }[] = [
  { key: 'all', label: 'Everything', kinds: [] },
  { key: 'searches', label: 'Searches', kinds: ['Searched', 'RunStarted', 'Researched'] },
  { key: 'decisions', label: 'Decisions', kinds: ['Suggested', 'Approved', 'Rejected'] },
  { key: 'messages', label: 'Messages', kinds: ['DraftCreated', 'DraftEdited', 'DraftApproved'] },
  { key: 'applications', label: 'Applications', kinds: ['Applied', 'StatusChanged'] },
  { key: 'followups', label: 'Follow-ups', kinds: ['FollowUpUpdated'] },
  { key: 'setup', label: 'Profile and mailbox', kinds: ['ProfileSaved', 'MailboxConnected'] },
]

export const ACTIVITY_RANGES = [{ days: 7, label: '7 days' }, { days: 30, label: '30 days' }, { days: 90, label: '90 days' }, { days: 0, label: 'All time' }] as const

/** The API path for one page of the feed. `before` is the oldest time already shown; `days` 0 means no start date. */
export function activityPath(sales: boolean, group: ActivityGroup, days: number, before: string | null, now: Date = new Date(), take = 20): string {
  const q = new URLSearchParams({ workspace: sales ? 'Sales' : 'Candidate', take: String(take) })
  const kinds = ACTIVITY_GROUPS.find((g) => g.key === group)?.kinds ?? []
  if (kinds.length) q.set('kinds', kinds.join(','))
  if (days > 0) q.set('from', new Date(now.getTime() - days * 86_400_000).toISOString())
  if (before) q.set('before', before)
  return `/api/v1/analytics/activity?${q}`
}

/** Pages are full (take) until the last one; a short page means there is nothing older. */
export function hasMore(pageSize: number, take = 20): boolean {
  return pageSize >= take
}
