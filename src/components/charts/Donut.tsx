import { useEffect, useState } from 'react'
import { DONUT_CIRCUMFERENCE as C, DONUT_RADIUS as R, donutArcs } from './donutModel'

export type DonutTone = 'primary' | 'success' | 'warning' | 'teal' | 'indigo' | 'neutral' | 'danger'
export interface DonutSegment { key: string; label: string; value: number; tone: DonutTone; /** Work happening now: its legend dot pulses. */ live?: boolean }

/**
 * Interactive donut (DESIGN.md §9: own SVG from tokens, no chart library). Slices draw in on first show; hovering or focusing a slice
 * or its legend row highlights it and puts its number in the middle. The legend is the readable list of every value.
 */
export function Donut({ segments, centerLabel, summary }: Readonly<{ segments: DonutSegment[]; centerLabel: string; summary: string }>) {
  const [drawn, setDrawn] = useState(false)
  const [active, setActive] = useState<string | null>(null)
  useEffect(() => { const t = requestAnimationFrame(() => setDrawn(true)); return () => cancelAnimationFrame(t) }, [])
  const total = segments.reduce((n, s) => n + Math.max(0, s.value), 0)
  const arcs = donutArcs(segments)
  const focus = segments.find((s) => s.key === active)
  return (
    <div className="donut">
      <svg viewBox="0 0 140 140" className="donut-svg" role="img" aria-label={summary}>
        <circle cx="70" cy="70" r={R} className="donut-track" />
        {segments.map((s, i) => s.value > 0 && (
          <circle key={s.key} cx="70" cy="70" r={R} className={`donut-arc tone-${s.tone}${active && active !== s.key ? ' is-dim' : ''}${active === s.key ? ' is-on' : ''}`}
            strokeDasharray={`${drawn ? arcs[i].length : 0} ${C}`} strokeDashoffset={-arcs[i].offset} transform="rotate(-90 70 70)"
            onMouseEnter={() => setActive(s.key)} onMouseLeave={() => setActive(null)} />
        ))}
        <text x="70" y="66" textAnchor="middle" className="donut-value">{focus ? focus.value : total}</text>
        <text x="70" y="84" textAnchor="middle" className="donut-caption">{focus ? focus.label : centerLabel}</text>
      </svg>
      <ul className="donut-legend">
        {segments.map((s) => (
          <li key={s.key}>
            <button type="button" className={`donut-key${active === s.key ? ' is-on' : ''}`} onMouseEnter={() => setActive(s.key)} onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(s.key)} onBlur={() => setActive(null)} aria-pressed={active === s.key}>
              <i className={`donut-dot tone-${s.tone}${s.live && s.value > 0 ? ' is-live' : ''}`} aria-hidden="true" />
              <span className="donut-label">{s.label}</span>
              <span className="donut-num op-numeric">{s.value}{total > 0 ? <small> · {Math.round((s.value / total) * 100)}%</small> : null}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
