import { useState } from 'react'
import { Card } from '../../components/cards'
import { JourneyCalendar, JourneyTimeline, LogProgress, UpcomingList } from './JourneyParts'
import { PATH, pathIndex, when, type Journey } from './journeyModel'

/** Candidate journey parts (2026-10-26), laid out by the candidate view: hero, recruiter, upcoming, "Since you joined". Data: useMyJourney. */
const firstName = (name: string) => name.replace(/\(.*?\)/g, '').trim().split(/\s+/)[0]

export function JourneyHero({ j }: Readonly<{ j: Journey }>) {
  const at = pathIndex(j)
  return (
    <section className="ccard ccard-default stack-3 cv-hero" aria-label="Your journey">
      <span className="muted-small">Day {j.day} since you joined · {when(j.joinedAt)}</span>
      <h2 className="cv-hero-title">{firstName(j.name)}, you are at: {PATH[at]}</h2>
      <ol className="jr-path" aria-label="Your path">
        {PATH.map((s, i) => (
          <li key={s} className={i < at ? 'is-done' : i === at ? 'is-now' : ''} aria-current={i === at ? 'step' : undefined}>
            <span className="jr-path-bar" aria-hidden="true" /><span>{s}<span className="sr-only">{i < at ? ' (done)' : i === at ? ' (now)' : ''}</span></span>
          </li>
        ))}
      </ol>
      <div className="bench-kpis jr-kpis">
        {([
          ['Learned', `${j.learningHours} h`],
          ['Certifications', j.certifications.length],
          ['Interviews done / booked', `${j.timeline.filter((t) => t.kind === 'Interview').length} / ${j.upcoming.filter((t) => t.kind === 'Interview').length}`],
          ['Resume score', j.resumeStrength ?? '—'],
        ] as const).map(([label, value]) => <div key={label} className="bench-kpi jr-kpi"><span className="muted-small">{label}</span><strong className="op-numeric">{value}</strong></div>)}
      </div>
    </section>
  )
}

export function RecruiterCard({ j }: Readonly<{ j: Journey }>) {
  if (!j.salesperson) return null
  const initials = j.salesperson.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('')
  return (
    <section className="rb-review jr-recruiter cv-recruiter" aria-label="Your recruiter">
      <span className="cv-eyebrow">Your recruiter</span>
      <div className="row"><span className="bench-avatar" aria-hidden="true">{initials}</span><div className="jr-recruiter"><strong>{j.salesperson}</strong><span className="muted-small">Looks after your submissions</span></div></div>
      <span className="muted-small">Ask them about roles, interviews or your resume.</span>
    </section>
  )
}

export function JourneyUpcoming({ j }: Readonly<{ j: Journey }>) {
  return <Card level={2} title="Upcoming"><UpcomingList items={j.upcoming} empty="Nothing booked yet." /></Card>
}

export function JourneySince({ j, url, onAdded }: Readonly<{ j: Journey; url: string; onAdded: (j: Journey) => void }>) {
  const [tab, setTab] = useState<'Timeline' | 'Calendar' | 'Log progress'>('Timeline')
  return (
    <Card level={2} title="Since you joined">
      <div className="stack-3">
        <div className="jr-seg" role="tablist" aria-label="View">
          {(['Timeline', 'Calendar', 'Log progress'] as const).map((t) => <button key={t} type="button" role="tab" aria-selected={tab === t} className="jr-seg-btn" onClick={() => setTab(t)}>{t}</button>)}
        </div>
        {tab === 'Timeline' && <JourneyTimeline items={j.timeline} />}
        {tab === 'Calendar' && <JourneyCalendar items={[...j.upcoming, ...j.timeline]} />}
        {tab === 'Log progress' && <LogProgress<Journey> url={url} onAdded={(v) => { onAdded(v); setTab('Timeline') }}
          intro="Tell your recruiter what you did: a course, a certification (passed or booked), a project you built, interview prep. It shows here and on their side." />}
      </div>
    </Card>
  )
}
