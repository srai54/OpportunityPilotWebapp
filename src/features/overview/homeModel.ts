import type { TrendPoint } from '../../lib/types'

/** "Good morning" by the hour of the day (local time). */
export function greeting(hour: number): string {
  if (hour < 5) return 'Good evening'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export interface HeroCounts { sales: boolean; awaiting: number; shortlistedNotApplied: number; found: number; qualified: number; days: number }
export interface Hero { text: string; primary: { label: string; to: string } }

/** One sentence built only from the person's own counts, and the one button that fits it. */
export function heroFor(c: HeroCounts): Hero {
  const things = c.sales ? 'leads' : 'jobs'
  if (c.awaiting > 0) {
    return { text: `${c.awaiting} ${c.awaiting === 1 ? (c.sales ? 'lead is' : 'job is') : `${things} are`} waiting for your yes or no.`, primary: { label: `Review ${c.awaiting}`, to: '/opportunities?view=approvals' } }
  }
  if (!c.sales && c.shortlistedNotApplied > 0) {
    return { text: `${c.shortlistedNotApplied} approved ${c.shortlistedNotApplied === 1 ? 'job has' : 'jobs have'} not been applied to yet.`, primary: { label: 'Apply to them', to: '/opportunities' } }
  }
  if (c.found > 0) {
    return { text: `${c.found} found in the last ${c.days} days, ${c.qualified} of them qualified.`, primary: { label: c.sales ? 'See leads' : 'See matches', to: '/opportunities' } }
  }
  return { text: 'Nothing found yet. Search to bring in matches.', primary: { label: c.sales ? 'Find companies' : 'Find jobs', to: '/wellfound' } }
}

/** Items scoring 75 or more, from the fit-score bands. */
export function strongCount(bands: readonly { from: number; count: number }[]): number {
  return bands.filter((b) => b.from >= 75).reduce((n, b) => n + b.count, 0)
}

/** Sum of one series over the last 7 days (the last point is today). */
export function lastWeek(points: readonly TrendPoint[], key: 'reached' | 'sent'): number {
  return points.slice(-7).reduce((n, p) => n + p[key], 0)
}

/** Average match estimated from the score bands (band midpoints weighted by count); null when nothing is scored. */
export function averageFromBands(bands: readonly { from: number; to: number; count: number }[]): number | null {
  const n = bands.reduce((a, b) => a + b.count, 0)
  if (!n) return null
  return Math.round(bands.reduce((a, b) => a + ((b.from + b.to) / 2) * b.count, 0) / n)
}
