import { Card } from '../../components/cards'
import { Donut, type DonutTone } from '../../components/charts/Donut'
import { GoalRing } from '../../components/kpi/GoalRing'
import { KpiBand, KpiCard } from '../../components/kpi/kpi'
import { ApiError } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { jdMatch, parseDoc, startDoc } from '../resumeBuilder/resumeDoc'
import { activityMix, kindOf, readiness, weeklyActivity, type Journey } from './journeyModel'

/**
 * Candidate dashboard (2026-10-26): the figures and analytics on top of the candidate view — KPIs with a weekly line, readiness to submit,
 * activity per week, how the journey splits, and how well each resume covers its job description. Charts follow DESIGN.md §9: a title,
 * a one-line takeaway, an accessible name and a list fallback.
 */

const MIX_TONE: Record<string, DonutTone> = { Learning: 'indigo', Certification: 'teal', Project: 'warning', InterviewPrep: 'neutral', Interview: 'primary' }
const BAR_VAR: Record<string, string> = { Learning: 'var(--op-on-indigo-tint)', Certification: 'var(--op-on-teal-tint)', Project: 'var(--op-on-amber-tint)', InterviewPrep: 'var(--op-muted)', Interview: 'var(--op-primary)' }

export function CandidateKpis({ j }: Readonly<{ j: Journey }>) {
  const weeks = weeklyActivity(j.timeline, j.joinedAt)
  const done = j.timeline.filter((t) => t.kind === 'Interview').length
  const booked = j.upcoming.filter((t) => t.kind === 'Interview').length
  return (
    <KpiBand label="Your figures">
      <KpiCard icon="trend" tone="indigo" label="Learning" value={`${j.learningHours} h`} sub={`since you joined · ${weeks.length} week${weeks.length === 1 ? '' : 's'}`} series={weeks.length > 1 ? weeks.map((w) => w.hours) : undefined} />
      <KpiCard icon="check" tone="teal" label="Certifications" value={j.certifications.length} sub={j.certifications.at(-1) ?? 'none yet'} />
      <KpiCard icon="calendar" tone="blue" label="Interviews" value={`${done} / ${booked}`} sub="done / booked" />
      <KpiCard icon="sparkles" tone="green" label="Resume score" value={j.resumeStrength ?? '—'} sub={j.bestFit ? `JD match ${j.bestFit.score}% · ${j.bestFit.role}` : 'no scored resume yet'} />
    </KpiBand>
  )
}

export function ReadinessCard({ j }: Readonly<{ j: Journey }>) {
  const items = readiness(j)
  const done = items.filter((i) => i.done).length
  const next = items.find((i) => !i.done)
  return (
    <Card level={2} title="Ready to submit" className="cd-card">
      <div className="stack-3">
        <GoalRing value={done} goal={items.length} label="steps done" caption={next ? `Next: ${next.label.toLowerCase()}.` : 'Everything is in place.'} />
        <ul className="cd-check">
          {items.map((i) => <li key={i.label} className={i.done ? 'is-done' : ''}><span aria-hidden="true">{i.done ? '✓' : '○'}</span>{i.label}<span className="sr-only">{i.done ? ' (done)' : ' (to do)'}</span></li>)}
        </ul>
      </div>
    </Card>
  )
}

export function WeeklyActivityCard({ j }: Readonly<{ j: Journey }>) {
  const weeks = weeklyActivity(j.timeline, j.joinedAt)
  const max = Math.max(1, ...weeks.map((w) => w.total))
  const busiest = weeks.reduce((a, b) => (b.total > a.total ? b : a), weeks[0])
  const recentHours = weeks.slice(-4).reduce((n, w) => n + w.hours, 0)
  const total = weeks.reduce((n, w) => n + w.total, 0)
  const H = 120, W = 100 / weeks.length
  const summary = total === 0 ? 'No activity logged yet.' : `Busiest: week of ${busiest.label} (${busiest.total}). ${recentHours} h of learning in the last 4 weeks.`
  return (
    <Card level={2} title="Activity per week" className="cd-card">
      <div className="stack-2">
        <p className="muted-small">{summary}</p>
        {total > 0 && (
          <>
            <svg className="cd-bars" viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" role="img" aria-label={`Activity per week: ${weeks.map((w) => `${w.label} ${w.total}`).join(', ')}`}>
              {weeks.map((w, i) => {
                let y = H
                return Object.entries(w.counts).map(([kind, n]) => {
                  const h = (n / max) * (H - 6)
                  y -= h
                  return <rect key={`${i}-${kind}`} x={i * W + W * 0.18} y={y} width={W * 0.64} height={h} rx="1.2" fill={BAR_VAR[kind] ?? 'var(--op-muted)'} />
                })
              })}
            </svg>
            <div className="cd-axis" aria-hidden="true">{weeks.map((w) => <span key={w.start}>{w.label}</span>)}</div>
            <ul className="cd-legend">{Object.keys(BAR_VAR).map((k) => <li key={k}><span style={{ background: BAR_VAR[k] }} aria-hidden="true" />{kindOf(k).label}</li>)}</ul>
          </>
        )}
      </div>
    </Card>
  )
}

export function ActivityMixCard({ j }: Readonly<{ j: Journey }>) {
  const mix = activityMix([...j.timeline, ...j.upcoming])
  const total = mix.reduce((n, m) => n + m.count, 0)
  if (total === 0) return null
  const top = mix.reduce((a, b) => (b.count > a.count ? b : a))
  return (
    <Card level={2} title="Where your time went" className="cd-card">
      <Donut segments={mix.map((m) => ({ key: m.kind, label: kindOf(m.kind).label, value: m.count, tone: MIX_TONE[m.kind] ?? 'neutral' }))}
        centerLabel="entries" summary={`Most of your journey is ${kindOf(top.kind).label.toLowerCase()} (${top.count} of ${total}).`} />
    </Card>
  )
}

interface ResumeJob { dealId: string; title: string; client: string | null; jobDescription: string | null; resume: { data: string; salesScore: number | null } }
interface Workspace { name: string; headline: string | null; skills: string | null; jobs: ResumeJob[] }

/** For each shared role: how much of its job description the resume covers, the skills it has and the ones it is missing. */
export function SkillsCoverageCard({ token }: Readonly<{ token: string }>) {
  const ws = useApi<Workspace>(`/api/v1/public/progress/${encodeURIComponent(token)}/resumes`)
  if (ws.error instanceof ApiError && ws.error.status === 404) return null
  const rows = (ws.data?.jobs ?? []).filter((j) => j.jobDescription).map((j) => {
    const doc = parseDoc(j.resume.data) ?? startDoc(ws.data!.name, ws.data!.headline, ws.data!.skills)
    return { job: j, m: jdMatch(doc, j.jobDescription) }
  }).filter((r) => r.m.score !== null)
  if (rows.length === 0) return null
  return (
    <Card level={2} title="Job description coverage" subtitle="How much of each role's job description your resume covers.">
      <ul className="cd-cover">
        {rows.map(({ job, m }) => (
          <li key={job.dealId} className="stack-2">
            <div className="row"><strong className="cd-cover-role">{job.title}</strong><span className="grow" /><strong className="op-numeric">{m.score}%</strong></div>
            <span className="bench-bar cd-cover-bar" role="img" aria-label={`${job.title}: ${m.score}% of the job description's skills`}><span className={m.score! >= 75 ? 'is-strong' : ''} style={{ width: `${m.score}%` }} /></span>
            <div className="row wrap">
              {m.have.map((s) => <span key={s} className="jr-chip jr-teal">✓ {s}</span>)}
              {m.missing.map((s) => <span key={s} className="jr-chip jr-amber">+ {s}</span>)}
            </div>
            {m.missing.length > 0 && <span className="muted-small">Missing: {m.missing.join(', ')}. Add them to your resume only if you have used them.</span>}
          </li>
        ))}
      </ul>
    </Card>
  )
}
