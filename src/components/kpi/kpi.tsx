import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon, type IconName } from '../icons'
import { formatDelta, sparkPoints, type Delta } from './deltaModel'
import { formatCount, splitNumber, useCountUp } from './countUp'

export type KpiTone = 'blue' | 'teal' | 'indigo' | 'amber' | 'green' | 'danger' | 'neutral'

/** ▲ green, ▼ red, flat grey — always with an arrow and words for screen readers, never colour alone. */
export function DeltaBadge({ delta }: Readonly<{ delta: Delta | null }>) {
  if (!delta) return null
  return (
    <span className={`delta delta-${delta.tone}`}>
      {delta.tone !== 'flat' && <Icon name={delta.tone === 'up' ? 'arrowUp' : 'arrowDown'} size={11} />}
      <span aria-hidden="true">{delta.text}</span>
      <span className="sr-only">{delta.sr} compared with the period before</span>
    </span>
  )
}

export interface KpiCardProps {
  icon: IconName
  tone?: KpiTone
  label: string
  value: ReactNode
  /** Current and previous equal period; the badge is hidden when `previous` is unknown. */
  change?: { current: number; previous: number | null | undefined }
  sub?: ReactNode
  series?: readonly number[]
  /** Makes the whole tile a link to the list behind the number. */
  to?: string
}

/** A number that counts up when it first appears; anything that is not a plain number is shown as it is. */
export function AnimatedValue({ value }: Readonly<{ value: ReactNode }>) {
  const parts = typeof value === 'number' || typeof value === 'string' ? splitNumber(String(value)) : null
  const shown = useCountUp(parts ? parts.value : null)
  if (!parts || shown === null) return <>{value}</>
  return <><span aria-hidden="true">{parts.prefix}{formatCount(shown, parts.decimals)}{parts.suffix}</span><span className="sr-only">{String(value)}</span></>
}

/** One figure: an icon chip, the label, the value, how it changed, a sentence, and an optional line of the last days. */
export function KpiCard({ icon, tone = 'blue', label, value, change, sub, series, to }: Readonly<KpiCardProps>) {
  const delta = change ? formatDelta(change.current, change.previous) : null
  const points = series ? sparkPoints(series, 100, 26) : ''
  const body = (
    <>
      <span className="kh"><span className={`ichip t-${tone}`}><Icon name={icon} size={15} /></span>{label}</span>
      <span className="kv"><b className="op-numeric"><AnimatedValue value={value} /></b><DeltaBadge delta={delta} /></span>
      {sub && <span className="ks">{sub}</span>}
      {points && (
        <svg className="sp" viewBox="0 0 100 26" preserveAspectRatio="none" role="img" aria-label={`${label} over the last ${series!.length} days: ${series!.join(', ')}`}>
          <polyline points={points} fill="none" stroke="var(--op-c1)" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
      )}
    </>
  )
  return <li className="ccard kpi">{to ? <Link to={to} className="kpi-in">{body}</Link> : <div className="kpi-in">{body}</div>}</li>
}

/** A row of KpiCards with an explicit column count (never auto-fit, which strands one tile on its own row). */
export function KpiBand({ children, label, six = false }: Readonly<{ children: ReactNode; label: string; six?: boolean }>) {
  return <ul className={`kpis${six ? ' k6' : ''} plain-list`} aria-label={label}>{children}</ul>
}
