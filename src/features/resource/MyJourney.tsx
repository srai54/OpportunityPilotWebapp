import { useState } from 'react'
import { Card } from '../../components/cards'
import { ApiError } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { JourneyCalendar, JourneyTimeline, LogProgress, UpcomingList } from './JourneyParts'
import { PATH, pathIndex, when, type Journey } from './journeyModel'

/**
 * Candidate page → My journey (2026-10-26), when the team shares it: day N since joining, the seven-step path, what they learned, certified,
 * built and interviewed for, a calendar of what is coming, their recruiter, and "Log progress" so the team sees it on the bench.
 */
export function MyJourney({ token }: Readonly<{ token: string }>) {
  const url = `/api/v1/public/progress/${encodeURIComponent(token)}/journey`
  const res = useApi<Journey>(url)
  const [latest, setLatest] = useState<Journey>()
  const [tab, setTab] = useState<'Timeline' | 'Calendar' | 'Log progress'>('Timeline')
  if (res.error instanceof ApiError && res.error.status === 404) return null
  const j = latest ?? res.data
  if (!j) return null
  const at = pathIndex(j)
  const first = j.name.replace(/\(.*?\)/g, '').trim().split(/\s+/)[0]
  return (
    <div className="stack-4">
      <section className="ccard ccard-default stack-3" aria-label="Your journey">
        <span className="muted-small">Day {j.day} since you joined · {when(j.joinedAt)}</span>
        <h2 className="prog-next-title">{first}, here is your journey so far</h2>
        <ol className="jr-path" aria-label="Your path">
          {PATH.map((s, i) => (
            <li key={s} className={i < at ? 'is-done' : i === at ? 'is-now' : ''} aria-current={i === at ? 'step' : undefined}>
              <span className="jr-path-bar" aria-hidden="true" /><span>{s}<span className="sr-only">{i < at ? ' (done)' : i === at ? ' (now)' : ''}</span></span>
            </li>
          ))}
        </ol>
        <div className="bench-kpis jr-kpis">
          {([['Learned', `${j.learningHours} h`], ['Certifications', j.certifications.length], ['Interviews done / booked', `${j.timeline.filter((t) => t.kind === 'Interview').length} / ${j.upcoming.filter((t) => t.kind === 'Interview').length}`], ['Resume score', j.resumeStrength ?? '—']] as const)
            .map(([label, value]) => <div key={label} className="bench-kpi jr-kpi"><span className="muted-small">{label}</span><strong className="op-numeric">{value}</strong></div>)}
        </div>
      </section>
      {j.salesperson && (
        <section className="rb-review jr-recruiter" aria-label="Your recruiter">
          <span className="muted-small">Your recruiter</span>
          <strong>{j.salesperson}</strong>
          <span className="muted-small">Ask them about roles, interviews or your resume.</span>
        </section>
      )}
      <Card level={2} title="Upcoming"><UpcomingList items={j.upcoming} empty="Nothing booked yet." /></Card>
      <Card level={2} title="Since you joined">
        <div className="stack-3">
          <div className="jr-seg" role="tablist" aria-label="View">
            {(['Timeline', 'Calendar', 'Log progress'] as const).map((t) => <button key={t} type="button" role="tab" aria-selected={tab === t} className="jr-seg-btn" onClick={() => setTab(t)}>{t}</button>)}
          </div>
          {tab === 'Timeline' && <JourneyTimeline items={j.timeline} />}
          {tab === 'Calendar' && <JourneyCalendar items={[...j.upcoming, ...j.timeline]} />}
          {tab === 'Log progress' && <LogProgress<Journey> url={url} onAdded={(v) => { setLatest(v); setTab('Timeline') }}
            intro="Tell your recruiter what you did: a course, a certification (passed or booked), a project you built, interview prep. It shows here and on their side." />}
        </div>
      </Card>
    </div>
  )
}
