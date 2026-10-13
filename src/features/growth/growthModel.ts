import type { TrendPoint, TrendTotals } from '../../lib/types'

/** The number shown while it counts up: eased, whole numbers, never past the target. */
export function countUpValue(target: number, progress: number): number {
  const p = Math.min(1, Math.max(0, progress))
  const eased = 1 - (1 - p) ** 3
  return Math.round(target * eased)
}

export interface GrowthTile {
  key: keyof TrendTotals
  label: string
  to: string
  value: number
  previous: number
  series: number[]
  dates: string[]
}

/** The four numbers that show growth: found, approved, applied or contacted, and replies. Each links to where its list is. */
export function growthTiles(points: readonly TrendPoint[], current: TrendTotals, previous: TrendTotals, sales: boolean): GrowthTile[] {
  const defs: { key: keyof TrendTotals; label: string; to: string }[] = [
    { key: 'found', label: sales ? 'Companies found' : 'Jobs found', to: '/opportunities' },
    { key: 'approved', label: sales ? 'Leads approved' : 'Jobs approved', to: '/opportunities' },
    { key: 'reached', label: sales ? 'Contacted' : 'Applied', to: sales ? '/outreach' : '/opportunities' },
    { key: 'replied', label: 'Replies', to: '/follow-ups' },
  ]
  return defs.map((d) => ({ ...d, value: current[d.key], previous: previous[d.key], series: points.map((p) => p[d.key]), dates: points.map((p) => p.date) }))
}

/** Plain words for the change since the period before; no percentage on tiny numbers. */
export function changeWords(value: number, previous: number): { text: string; tone: 'up' | 'down' | 'flat' } {
  const diff = value - previous
  if (diff === 0) return { text: previous === 0 && value === 0 ? 'nothing yet' : 'same as before', tone: 'flat' }
  return diff > 0 ? { text: `${diff} more than before`, tone: 'up' } : { text: `${-diff} fewer than before`, tone: 'down' }
}
