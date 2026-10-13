import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../../components/icons'
import type { AnalyticsTrend } from '../../lib/types'
import { useApi } from '../../lib/useApi'
import { formatWhen } from '../applications/applicationStatus'
import { linePoints, nearestIndex, niceMax } from '../insights/insightsModel'
import { useShell } from '../shell/ShellContext'
import { changeWords, countUpValue, growthTiles, type GrowthTile } from './growthModel'

/** Counts up to `target` once, quickly; with reduced motion it just shows the number. */
function useCountUp(target: number): number {
  const [shown, setShown] = useState(0)
  const frame = useRef(0)
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  useEffect(() => {
    if (still) return
    const start = performance.now()
    const tick = (now: number) => {
      const p = (now - start) / 700
      setShown(countUpValue(target, p))
      if (p < 1) frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame.current)
  }, [target, still])
  return still ? target : shown
}

const W = 140
const H = 40
const PAD = { l: 3, r: 3, t: 4, b: 4 }

function Tile({ tile }: Readonly<{ tile: GrowthTile }>) {
  const number = useCountUp(tile.value)
  const [hover, setHover] = useState<number | null>(null)
  const max = niceMax(Math.max(0, ...tile.series))
  const pts = linePoints(tile.series, W, H, PAD, max)
  const change = changeWords(tile.value, tile.previous)
  const at = hover ?? tile.series.length - 1
  const [hx, hy] = (pts.split(' ')[at] ?? '0,0').split(',').map(Number)
  return (
    <li className="ccard growth-tile">
      <Link className="growth-link" to={tile.to}>
        <span className="growth-label">{tile.label}</span>
        <span className="growth-number op-numeric">{number}</span>
        <span className={`growth-change growth-${change.tone}`}>
          {change.tone === 'up' && <Icon name="trend" size={13} />} {change.text}
        </span>
      </Link>
      <svg className="growth-spark" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${tile.label} per day, last ${tile.series.length} days: ${tile.series.join(', ')}`}
        onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHover(nearestIndex(((e.clientX - r.left) / r.width) * W, tile.series.length, W, PAD.l, PAD.r)) }}
        onPointerLeave={() => setHover(null)}>
        <polyline points={pts} fill="none" stroke="var(--op-c1)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={hx} cy={hy} r="3.5" fill="var(--op-c1)" />
      </svg>
      <span className="growth-readout muted-small">{tile.series.length > 0 ? `${formatWhen(tile.dates[at])}: ${tile.series[at]}` : 'No data yet'}</span>
    </li>
  )
}

/** Home: how things are growing. Animated numbers, a hoverable line per number, change since the period before, and a click to open the list. */
export function GrowthStrip() {
  const sales = useShell().workspace === 'sales'
  const trend = useApi<AnalyticsTrend>(`/api/v1/analytics/trend?workspace=${sales ? 'Sales' : 'Candidate'}&days=14`)
  if (!trend.data) return null
  const tiles = growthTiles(trend.data.points, trend.data.current, trend.data.previous, sales)
  return (
    <section className="stack-3" aria-label="Your growth">
      <h3 className="section-heading">Your growth · last 14 days</h3>
      <ul className="growth-grid plain-list">{tiles.map((t) => <Tile key={t.key} tile={t} />)}</ul>
    </section>
  )
}
