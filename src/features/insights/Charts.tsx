import { useId, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { TrendPoint } from '../../lib/types'
import { linePoints, nearestIndex, niceMax, type SeriesDef } from './insightsModel'

const dayFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })
const fmtDay = (iso: string) => dayFmt.format(new Date(`${iso}T00:00:00`))

const W = 720
const H = 250
const PAD = { l: 34, r: 12, t: 12, b: 26 }

/**
 * Lines over time. Click a legend item to hide or show a line; hover, touch or use the arrow keys to read one day's numbers.
 * The same figures are available as a table underneath (DESIGN.md §9), and the chart has a one-line summary in its label.
 */
export function TrendChart({ points, series, summary }: Readonly<{ points: TrendPoint[]; series: SeriesDef[]; summary: string }>) {
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [index, setIndex] = useState<number | null>(null)
  const readoutId = useId()
  const visible = series.filter((s) => !hidden.has(s.key))
  const max = niceMax(Math.max(0, ...visible.flatMap((s) => points.map((p) => p[s.key]))))
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(max * t))
  const labelEvery = Math.max(1, Math.round(points.length / 6))
  const innerW = W - PAD.l - PAD.r
  const xAt = (i: number) => (points.length === 1 ? PAD.l + innerW / 2 : PAD.l + (innerW * i) / (points.length - 1))

  function onPointer(e: PointerEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect()
    setIndex(nearestIndex(((e.clientX - box.left) / box.width) * W, points.length, W, PAD.l, PAD.r))
  }
  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      setIndex((i) => Math.min(points.length - 1, Math.max(0, (i ?? points.length - 1) + (e.key === 'ArrowRight' ? 1 : -1))))
    } else if (e.key === 'Escape') setIndex(null)
  }
  const at = index === null ? null : points[index]
  const toggle = (key: string) => setHidden((h) => { const n = new Set(h); if (n.has(key)) n.delete(key); else n.add(key); return n })

  return (
    <div className="chart">
      <ul className="chart-legend" aria-label="Show or hide a line">
        {series.map((s) => (
          <li key={s.key}>
            <button type="button" className="legend-btn" aria-pressed={!hidden.has(s.key)} onClick={() => toggle(s.key)}>
              <i className="legend-dot" style={{ background: `var(${s.token})` }} aria-hidden="true" />
              {s.label}
            </button>
          </li>
        ))}
      </ul>
      <div className="chart-plot" tabIndex={0} onKeyDown={onKey} onBlur={() => setIndex(null)} aria-describedby={readoutId}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} onPointerMove={onPointer} onPointerLeave={() => setIndex(null)} className="chart-svg">
          {ticks.map((t, i) => {
            const y = PAD.t + (H - PAD.t - PAD.b) * (1 - i / 4)
            return (
              <g key={t + ':' + i}>
                <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke="var(--op-chart-grid)" />
                <text x={PAD.l - 6} y={y + 4} textAnchor="end" className="chart-tick">{t}</text>
              </g>
            )
          })}
          {points.map((p, i) => (i % labelEvery === 0 || i === points.length - 1) && (
            <text key={p.date} x={xAt(i)} y={H - 6} textAnchor="middle" className="chart-tick">{fmtDay(p.date)}</text>
          ))}
          {visible.map((s) => (
            <polyline key={s.key} points={linePoints(points.map((p) => p[s.key]), W, H, PAD, max)} fill="none" stroke={`var(${s.token})`} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {at && index !== null && (
            <g>
              <line x1={xAt(index)} x2={xAt(index)} y1={PAD.t} y2={H - PAD.b} stroke="var(--op-muted)" strokeDasharray="3 3" />
              {visible.map((s) => (
                <circle key={s.key} cx={xAt(index)} cy={PAD.t + (H - PAD.t - PAD.b) * (1 - Math.min(at[s.key], max) / max)} r="4" fill="var(--op-surface)" stroke={`var(${s.token})`} strokeWidth="2" />
              ))}
            </g>
          )}
        </svg>
        <p id={readoutId} className="chart-readout" role="status" aria-live="polite">
          {at
            ? <><strong>{fmtDay(at.date)}</strong>{visible.map((s) => <span key={s.key}><i className="legend-dot" style={{ background: `var(${s.token})` }} aria-hidden="true" /> {s.label} <b className="op-numeric">{at[s.key]}</b></span>)}</>
            : 'Hover, touch, or use the left and right arrow keys to read a day.'}
        </p>
      </div>
      <details className="chart-table">
        <summary>Show the numbers as a table</summary>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th scope="col">Day</th>{series.map((s) => <th key={s.key} scope="col">{s.label}</th>)}</tr></thead>
            <tbody>{points.map((p) => <tr key={p.date}><th scope="row">{fmtDay(p.date)}</th>{series.map((s) => <td key={s.key} className="op-numeric">{p[s.key]}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </details>
    </div>
  )
}

/** A tiny line for a KPI tile: shape only, the number beside it carries the meaning. */
export function Spark({ values, label }: Readonly<{ values: number[]; label: string }>) {
  const max = niceMax(Math.max(0, ...values))
  const pad = { l: 2, r: 2, t: 3, b: 3 }
  return (
    <svg viewBox="0 0 90 28" className="spark" role="img" aria-label={label}>
      <polyline points={linePoints(values, 90, 28, pad, max)} fill="none" stroke="var(--op-c1)" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

/** Labelled horizontal bars; the value is always written, the bar only helps comparison. */
export function HBars({ rows, unit = '', empty }: Readonly<{ rows: { label: string; value: number; note?: string }[]; unit?: string; empty: string }>) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  if (rows.length === 0) return <p className="muted-small">{empty}</p>
  return (
    <ul className="bar-list">
      {rows.map((r) => (
        <li key={r.label} className="bar-row">
          <span className="bar-name" title={r.label}>{r.label}</span>
          <span className="bar-track" aria-hidden="true"><i style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} /></span>
          <span className="bar-n op-numeric">{r.value}{unit}{r.note && <small> {r.note}</small>}</span>
        </li>
      ))}
    </ul>
  )
}

/** A progress bar with its words: "6 of 10". */
export function ProgressBar({ pct, label, text }: Readonly<{ pct: number; label: string; text: string }>) {
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={label} aria-valuetext={text}>
      <div className="progress-track"><i style={{ width: `${pct}%` }} /></div>
      <span className="progress-text op-numeric">{text}</span>
    </div>
  )
}
