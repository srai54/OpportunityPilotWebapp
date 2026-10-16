import { useEffect, useState } from 'react'

/** Illustrative only: what the autopilot loop looks like. No real data or people. */
const STAGES = [
  { key: 'find', label: 'Find', line: 'Reading 20+ job sites and hiring signals' },
  { key: 'decide', label: 'Decide', line: 'Scoring each match against your profile' },
  { key: 'act', label: 'Act', line: 'Applying or reaching out — within your limits' },
  { key: 'track', label: 'Track', line: 'Replies, interviews and offers in one place' },
] as const

const FEED = [
  { site: 'Naukri', role: 'Senior .NET Engineer', score: 92, state: 'Applied' },
  { site: 'LinkedIn', role: 'Full-stack Developer', score: 88, state: 'Approved' },
  { site: 'Wellfound', role: 'Backend Engineer · Fintech', score: 81, state: 'Shortlisted' },
  { site: 'Instahyre', role: 'Tech Lead · React', score: 77, state: 'Scored' },
  { site: 'Indeed', role: 'Cloud Engineer · Azure', score: 74, state: 'Found' },
] as const

function reducedMotion(): boolean {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

/** Animated preview of the Find → Decide → Act → Track loop for the sign-in story panel. */
export function AuthShowcase() {
  const [stage, setStage] = useState(0)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (reducedMotion()) return
    const a = window.setInterval(() => setStage((s) => (s + 1) % STAGES.length), 2600)
    const b = window.setInterval(() => setTick((t) => t + 1), 1800)
    return () => { window.clearInterval(a); window.clearInterval(b) }
  }, [])
  const rows = [0, 1, 2].map((i) => FEED[(tick + i) % FEED.length])
  const current = STAGES[stage]

  return (
    <div className="sx" aria-hidden="true">
      <div className="sx-orb sx-orb-a" />
      <div className="sx-orb sx-orb-b" />
      <div className="sx-grid" />

      <ol className="sx-steps">
        {STAGES.map((s, i) => (
          <li key={s.key} className={i === stage ? 'is-on' : i < stage ? 'is-done' : ''}>
            <span className="sx-dot">{i + 1}</span>{s.label}
          </li>
        ))}
        <li className="sx-track" style={{ ['--sx-p' as string]: `${(stage / (STAGES.length - 1)) * 100}%` }} />
      </ol>
      <p className="sx-line" key={current.key}>{current.line}</p>

      <div className="sx-card">
        <div className="sx-card-head">
          <span className="sx-live"><i />Autopilot</span>
          <span className="sx-muted">Example run</span>
        </div>
        <ul className="sx-feed">
          {rows.map((r, i) => (
            <li key={r.role} className="sx-row" style={{ animationDelay: `${i * 90}ms` }}>
              <span className="sx-site">{r.site.slice(0, 2)}</span>
              <span className="sx-role"><b>{r.role}</b><small>{r.site}</small></span>
              <span className="sx-score"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" /><circle className="sx-arc" cx="18" cy="18" r="15" style={{ strokeDasharray: `${(r.score / 100) * 94} 94` }} /></svg><em>{r.score}</em></span>
              <span className={`sx-state sx-${r.state.toLowerCase()}`}>{r.state}</span>
            </li>
          ))}
        </ul>
        <div className="sx-kpis">
          <div><b>24</b><small>found today</small></div>
          <div><b>9</b><small>strong matches</small></div>
          <div><b>6</b><small>applied</small></div>
        </div>
      </div>
    </div>
  )
}
