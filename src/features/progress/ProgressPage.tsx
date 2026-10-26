import { useEffect, useRef, useState } from 'react'
import { Card } from '../../components/cards'
import { ErrorNotice } from '../../components/ErrorNotice'
import { LoadingState } from '../../components/States'
import { Badge } from '../../components/StatusBadge'
import { api, ApiError } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { ResumeBuilder } from '../resumeBuilder/ResumeBuilder'
import { MyJourney } from '../resource/MyJourney'
import { writeMyProgress, agoText, countdown, interviewIcs, joinUrl, journey, nextInterview, type ProgressItem, type ProgressRole, type ProgressView, type RoleAnswer } from './progressModel'

const REFRESH_MS = 30_000

const when = (iso: string, zone?: string | null) => {
  try { return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short', ...(zone ? { timeZone: zone } : {}) }) } catch { return new Date(iso).toLocaleString() }
}

function addToCalendar(item: ProgressItem) {
  const url = URL.createObjectURL(new Blob([interviewIcs(item)], { type: 'text/calendar' }))
  const a = document.createElement('a'); a.href = url; a.download = 'interview.ics'; a.click(); URL.revokeObjectURL(url)
}

/** The five-step path, filled up to where things are. The current step pulses; a stopped path shows where it stopped. */
function Path({ item, changed }: Readonly<{ item: ProgressItem; changed: boolean }>) {
  const j = journey(item.stage)
  const reached = j.steps.filter((s) => s.state === 'done').length + (j.stopped ? 0 : 0.5)
  const pct = Math.min(100, (reached / (j.steps.length - 1)) * 100)
  const [fill, setFill] = useState(0)
  useEffect(() => { const t = requestAnimationFrame(() => setFill(pct)); return () => cancelAnimationFrame(t) }, [pct])
  return (
    <div className={`prog-path${changed ? ' is-changed' : ''}`}>
      <div className="prog-track" aria-hidden="true"><span className={`prog-fill${j.stopped ? ' is-stopped' : ''}`} style={{ width: `${fill}%` }} /></div>
      <ol className="prog-steps" aria-label="Where this application is">
        {j.steps.map((s) => (
          <li key={s.label} className={`prog-step is-${s.state}`} aria-current={s.state === 'now' ? 'step' : undefined}>
            <span className="prog-dot" aria-hidden="true">{s.state === 'done' ? '✓' : s.state === 'stopped' ? '×' : ''}</span>
            <span className="prog-label">{s.label}<span className="sr-only">{s.state === 'done' ? ' (done)' : s.state === 'now' ? ' (now)' : s.state === 'stopped' ? ' (stopped here)' : ''}</span></span>
          </li>
        ))}
      </ol>
      <div className="prog-words">
        <p><strong>{j.meaning}</strong></p>
        <p className="muted-small">What happens next: {j.next}</p>
      </div>
    </div>
  )
}

/** Roles the recruiter suggests. The candidate answers with one tap; the recruiter sees the answer in "Share progress". */
function SuggestedRoles({ token, roles, onAnswered }: Readonly<{ token: string; roles: ProgressRole[]; onAnswered: () => void }>) {
  const [answers, setAnswers] = useState<Record<string, RoleAnswer>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<Error>()
  async function answer(role: ProgressRole, value: Exclude<RoleAnswer, 'None'>) {
    setBusy(role.id); setError(undefined)
    try {
      const saved = await api<ProgressRole>(`/api/v1/public/progress/${encodeURIComponent(token)}/roles/${role.id}`, { method: 'POST', body: JSON.stringify({ answer: value }) })
      setAnswers((cur) => ({ ...cur, [role.id]: saved.answer }))
      onAnswered()
    } catch (e) { setError(e as Error) } finally { setBusy(null) }
  }
  return (
    <Card level={2} title="Roles your recruiter suggests" subtitle="Tell them what you think. Nothing is sent to a client without you.">
      <ul className="stack-3 prog-roles">
        {roles.map((r) => {
          const now = answers[r.id] ?? r.answer
          return (
            <li key={r.id} className="prog-role">
              <div className="prog-role-head">
                <strong>{r.title}</strong>
                {r.client && <span className="muted-small">{r.client}</span>}
              </div>
              <div className="prog-actions" role="group" aria-label={`Your answer for ${r.title}`}>
                <button type="button" className={`btn btn-sm ${now === 'Interested' ? 'btn-primary' : 'btn-secondary'}`} aria-pressed={now === 'Interested'} disabled={busy === r.id}
                  onClick={() => void answer(r, 'Interested')}>I'm interested</button>
                <button type="button" className={`btn btn-sm ${now === 'NotForMe' ? 'btn-primary' : 'btn-secondary'}`} aria-pressed={now === 'NotForMe'} disabled={busy === r.id}
                  onClick={() => void answer(r, 'NotForMe')}>Not for me</button>
              </div>
              {now !== 'None' && <p className="muted-small" role="status">{now === 'Interested' ? 'Your recruiter will see that you are interested.' : 'Your recruiter will see that this one is not for you.'}</p>}
            </li>
          )
        })}
      </ul>
      {error && <ErrorNotice error={error} what="your answer" />}
    </Card>
  )
}

/**
 * The candidate's private page (/progress/<link>). No sign-in. It shows only what the sales team chose to share, and nothing about
 * pay, rates or internal notes. It refreshes itself every 30 seconds and highlights whatever changed.
 */
export function ProgressPage({ token }: Readonly<{ token: string }>) {
  const view = useApi<ProgressView>(`/api/v1/public/progress/${encodeURIComponent(token)}`)
  const gone = view.error instanceof ApiError && view.error.status === 404
  const [now, setNow] = useState(() => Date.now())
  const [fetchedAt, setFetchedAt] = useState(() => Date.now())
  const [changed, setChanged] = useState<Set<number>>(new Set())
  const previous = useRef<string[] | null>(null)
  const { reload } = view

  // Live: fetch again every 30 seconds while the tab is visible, and tick the "updated … ago" text every second.
  useEffect(() => {
    const poll = setInterval(() => { if (document.visibilityState === 'visible') reload() }, REFRESH_MS)
    const tick = setInterval(() => setNow(Date.now()), 1000)
    // Coming back to the tab fetches at once, so a change made by the sales team while it was hidden shows straight away.
    const back = () => { if (document.visibilityState === 'visible') reload() }
    document.addEventListener('visibilitychange', back)
    return () => { clearInterval(poll); clearInterval(tick); document.removeEventListener('visibilitychange', back) }
  }, [reload])

  useEffect(() => {
    if (!view.data) return
    writeMyProgress(token)
    // A new answer from the server arrived (an external event): remember when, for the live marker.
    // oxlint-disable-next-line react/set-state-in-effect
    setFetchedAt(Date.now())
    const keys = view.data.items.map((i) => JSON.stringify(i))
    if (previous.current) {
      const moved = new Set(keys.map((k, i) => (previous.current![i] !== k ? i : -1)).filter((i) => i >= 0))
      if (moved.size) { setChanged(moved); setTimeout(() => setChanged(new Set()), 4000) }
    }
    previous.current = keys
  }, [view.data, token])

  const first = view.data?.firstName
  return (
    <main className="signin prog-page" id="main">
      <div className="page stack-4" style={{ maxWidth: 680, width: '100%' }}>
        <header className="stack-2">
          <h1 className="page-title">{first ? `Hi ${first}, here is where things stand` : 'Your progress'}</h1>
          {view.data && (
            <p className="prog-live" role="status" aria-live="polite">
              <span className="prog-live-dot" aria-hidden="true" /> Live · updated {agoText(fetchedAt, now)}
              <button type="button" className="btn-link" onClick={() => reload()}>Refresh now</button>
            </p>
          )}
        </header>
        {view.loading && !view.data && <LoadingState label="Loading your progress…" waking={view.waking} rows={2} />}
        {gone && <Card tone="muted" level={2} title="This link is not active"><p>It may have been replaced or switched off. Ask the person who sent it for a new one.</p></Card>}
        {view.error && !gone && !view.data && <ErrorNotice error={view.error} onRetry={view.reload} what="your progress" />}
        {view.data && <MyJourney token={token} />}
        {view.data?.note && (
          <Card level={2} tone="signature" title="A note from your recruiter"><p className="prog-note">{view.data.note}</p></Card>
        )}
        {view.data && view.data.items.length === 0 && (
          <Card tone="muted" level={2} title="Nothing to show yet"><p>When your profile is sent to a client, it appears here and this page updates on its own.</p></Card>
        )}
        {view.data && (() => {
          const next = nextInterview(view.data.items, new Date(now))
          if (!next?.interview) return null
          const iv = next.interview
          const join = joinUrl(iv.location)
          const left = countdown(iv.scheduledAt, new Date(now))
          return (
            <section className="ccard ccard-signature prog-next" aria-labelledby="prog-next-title">
              <div className="prog-next-head">
                <h2 id="prog-next-title" className="prog-next-title">Next interview</h2>
                {left && <span className="prog-countdown op-numeric">{left}</span>}
              </div>
              <p className="prog-next-when"><strong>{when(iv.scheduledAt, iv.timeZone)}</strong></p>
              <p className="muted-small">{[`Round ${iv.round}`, next.client, iv.mode, iv.minutes ? `${iv.minutes} min` : null].filter(Boolean).join(' · ')}</p>
              <div className="prog-actions">
                {join && <a className="btn btn-primary btn-sm" href={join} target="_blank" rel="noopener noreferrer">Join<span className="sr-only"> the interview (opens in a new tab)</span></a>}
                <button type="button" className={`btn btn-sm ${join ? 'btn-secondary' : 'btn-primary'}`} onClick={() => addToCalendar(next)}>Add to calendar</button>
              </div>
            </section>
          )
        })()}
        {view.data?.items.map((item, i) => {
          const iv = item.interview
          const left = iv ? countdown(iv.scheduledAt, new Date(now)) : null
          const join = joinUrl(iv?.location)
          return (
            <Card level={2} key={`${item.client ?? ''}-${item.role ?? ''}-${i}`} title={item.role ?? 'Your application'} subtitle={item.client ?? undefined}
              actions={<Badge tone={journey(item.stage).stopped ? 'neutral' : item.stage.toLowerCase().includes('accepted') ? 'success' : 'primary'}>{item.stage}</Badge>}>
              <div className="stack-3">
                <Path item={item} changed={changed.has(i)} />
                {iv && (
                  <div className="prog-interview">
                    <div className="prog-interview-head">
                      <strong>Interview, round {iv.round}</strong>
                      {left && <span className="prog-countdown">{left}</span>}
                    </div>
                    <p>{when(iv.scheduledAt, iv.timeZone)}{iv.timeZone ? ` (${iv.timeZone})` : ''}{iv.minutes ? ` · ${iv.minutes} min` : ''}{iv.mode ? ` · ${iv.mode}` : ''}</p>
                    {iv.location && !join && <p className="muted-small">Where: {iv.location}</p>}
                    {iv.notes && <p className="muted-small">{iv.notes}</p>}
                    {iv.prep && <div className="prog-prep"><strong>How to prepare</strong><p className="prog-note">{iv.prep}</p></div>}
                    <div className="prog-actions">
                      {join && <a className="btn btn-primary btn-sm" href={join} target="_blank" rel="noopener noreferrer">Join the interview<span className="sr-only"> (opens in a new tab)</span></a>}
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => addToCalendar(item)}>Add to my calendar</button>
                    </div>
                  </div>
                )}
                <p className="muted-small">Last change {when(item.updatedAt)}</p>
              </div>
            </Card>
          )
        })}
        {view.data && <ResumeBuilder token={token} />}
        {view.data?.roles && view.data.roles.length > 0 && <SuggestedRoles token={token} roles={view.data.roles} onAnswered={reload} />}
        <p className="muted-small">This page shows only what was chosen to share with you. It updates on its own; keep it open or come back any time.</p>
      </div>
    </main>
  )
}
