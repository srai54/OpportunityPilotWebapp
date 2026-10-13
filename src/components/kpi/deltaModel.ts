export type DeltaTone = 'up' | 'down' | 'flat'

export interface Delta {
  tone: DeltaTone
  /** Short text on the badge: "+3", "−2", "0". */
  text: string
  /** For screen readers, since the arrow and the colour carry no words. */
  sr: string
}

/**
 * The change against the previous equal period. Returns null when there is no previous period, so the badge is hidden:
 * a change is never invented (DESIGN.md §1.3, §9).
 */
export function formatDelta(current: number, previous: number | null | undefined): Delta | null {
  if (previous === null || previous === undefined || !Number.isFinite(previous) || !Number.isFinite(current)) return null
  const diff = current - previous
  if (diff === 0) return { tone: 'flat', text: '0', sr: 'no change' }
  const shown = Number.isInteger(diff) ? Math.abs(diff) : Math.round(Math.abs(diff) * 10) / 10
  return diff > 0 ? { tone: 'up', text: `+${shown}`, sr: `up ${shown}` } : { tone: 'down', text: `−${shown}`, sr: `down ${shown}` }
}

/** Sparkline points for a series inside a width × height box, as an SVG polyline string. Needs at least two points. */
export function sparkPoints(series: readonly number[], width: number, height: number): string {
  if (series.length < 2) return ''
  const max = Math.max(1, ...series)
  const min = Math.min(0, ...series)
  const span = max - min || 1
  return series
    .map((v, i) => `${((width * i) / (series.length - 1)).toFixed(1)},${(height - ((v - min) / span) * height).toFixed(1)}`)
    .join(' ')
}
