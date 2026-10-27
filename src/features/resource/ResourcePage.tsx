import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Card } from '../../components/cards'
import { ErrorNotice } from '../../components/ErrorNotice'
import { LoadingState } from '../../components/States'
import { api } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { ProgressShare } from '../progress/ProgressShare'
import { ResumeReviews } from '../resumeBuilder/ResumeReviews'
import { JourneyCalendar, JourneyTimeline, LogProgress, UpcomingList } from './JourneyParts'
import { STATUS, when, type Journey } from './journeyModel'

/** Joined date, aligned salesperson and the priority flag. */
function ProfileForm({ j, onSaved }: Readonly<{ j: Journey; onSaved: (j: Journey) => void }>) {
  const [joined, setJoined] = useState(j.joinedAt.slice(0, 10))
  const [sales, setSales] = useState(j.salesperson ?? '')
  const [priority, setPriority] = useState(j.priority)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Error>()
  const [saved, setSaved] = useState(false)
  async function save() {
    setBusy(true); setError(undefined); setSaved(false)
    try { onSaved(await api<Journey>(`/api/v1/staffing/candidates/${j.candidateId}/journey-profile`, { method: 'PUT', body: JSON.stringify({ joinedAt: `${joined}T00:00:00Z`, salesperson: sales.trim() || null, priority }) })); setSaved(true) }
    catch (e) { setError(e as Error) } finally { setBusy(false) }
  }
  return (
    <details className="rb-jd">
      <summary>Joined date, salesperson and priority</summary>
      <div className="stack-3">
        <div className="rb-grid">
          <div className="field"><label htmlFor="r-joined">Joined on</label><input id="r-joined" type="date" value={joined} onChange={(e) => setJoined(e.target.value)} /></div>
          <div className="field"><label htmlFor="r-sales">Aligned salesperson</label><input id="r-sales" value={sales} maxLength={120} onChange={(e) => setSales(e.target.value)} /></div>
        </div>
        <label className="check"><input type="checkbox" checked={priority} onChange={(e) => setPriority(e.target.checked)} /> Priority profile (put forward first)</label>
        {error && <ErrorNotice error={error} />}
        <div className="row wrap"><button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save'}</button>{saved && <span className="muted-small" role="status">Saved.</span>}</div>
      </div>
    </details>
  )
}

/**
 * Staffing → Bench → a resource (2026-10-26): one place for everything since they joined: status and priority, certifications, learning,
 * projects, interviews given and booked, resumes and their scores, best fit, upcoming events and the aligned salesperson.
 */
export function ResourcePage() {
  const { id = '' } = useParams()
  const res = useApi<Journey>(`/api/v1/staffing/candidates/${id}/journey`)
  const [j, setJ] = useState<Journey>()
  const [tab, setTab] = useState<'Timeline' | 'Calendar' | 'Log progress'>('Timeline')
  const [sharing, setSharing] = useState(false)
  const [error, setError] = useState<Error>()
  // The page keeps the latest journey the API returned (after a save or a new entry) without refetching.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { if (res.data) setJ(res.data) }, [res.data])
  const data = j ?? res.data
  async function remove(entryId: string) {
    setError(undefined)
    try { await api(`/api/v1/staffing/journey/${entryId}`, { method: 'DELETE' }); res.reload() } catch (e) { setError(e as Error) }
  }
  if (res.loading && !data) return <div className="page"><LoadingState label="Loading…" rows={3} waking={res.waking} /></div>
  if (res.error && !data) return <div className="page"><ErrorNotice error={res.error} onRetry={res.reload} what="this resource" /></div>
  if (!data) return null
  const status = data.priority ? STATUS.priority : STATUS[data.status]
  const interviews = data.timeline.filter((t) => t.kind === 'Interview').length
  const nextInterview = data.upcoming.filter((t) => t.kind === 'Interview').length
  const all = [...data.upcoming, ...data.timeline]
  return (
    <div className="page page-wide stack-4">
      <nav aria-label="Breadcrumb" className="muted-small res-crumb"><Link to="/staffing/resources">Resources</Link> / {data.name}</nav>
      <section className="ccard ccard-default res-head" aria-label="Profile">
        <span className="bench-avatar res-avatar" aria-hidden="true">{data.name.replace(/\(.*?\)/g, '').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('')}</span>
        <div className="stack-1 res-who">
          <div className="row wrap"><h2 className="page-title res-name">{data.name}</h2><span className={`jr-chip jr-${status.tone}`}>{status.label}</span>{data.priority && data.status !== 'available' && <span className={`jr-chip jr-${STATUS[data.status].tone}`}>{STATUS[data.status].label}</span>}</div>
          <span className="muted">{data.headline ?? 'No headline'}{data.skills ? ` · ${data.skills}` : ''}</span>
          <span className="muted-small">Joined {when(data.joinedAt)} · day {data.day} · {data.salesperson ? <>aligned with <strong>{data.salesperson}</strong></> : 'no salesperson yet'}</span>
        </div>
        <div className="row wrap"><button type="button" className="btn btn-primary btn-sm" aria-expanded={sharing} onClick={() => setSharing((s) => !s)}>{sharing ? 'Close sharing' : 'Share with the candidate'}</button></div>
      </section>
      {sharing && <ProgressShare candidate={{ id: data.candidateId, name: data.name, email: null }} onClose={() => setSharing(false)} />}
      <ProfileForm j={data} onSaved={setJ} />
      <section className="bench-kpis" aria-label="Key figures">
        {([
          ['Resume strength', data.resumeStrength ?? '—', data.resumeStrength === null ? 'no scored resume yet' : 'best scored resume'],
          ['Best fit', data.bestFit ? `${data.bestFit.score}%` : '—', data.bestFit?.role ?? 'no resume for a role yet'],
          ['Interviews', interviews, `${nextInterview} upcoming`],
          ['Certifications', data.certifications.length, data.certifications.slice(0, 2).join(', ') || 'none logged'],
          ['Learning since joining', `${data.learningHours} h`, 'logged hours'],
        ] as const).map(([label, value, sub]) => <div key={label} className="ccard ccard-default bench-kpi"><span className="muted-small">{label}</span><strong className="op-numeric">{value}</strong><span className="muted-small bench-ellipsis">{sub}</span></div>)}
      </section>
      {error && <ErrorNotice error={error} />}
      <div className="res-cols">
        <Card level={2} title="Journey since joining" className="res-main">
          <div className="stack-3">
            <div className="jr-seg" role="tablist" aria-label="View">
              {(['Timeline', 'Calendar', 'Log progress'] as const).map((t) => <button key={t} type="button" role="tab" aria-selected={tab === t} className="jr-seg-btn" onClick={() => setTab(t)}>{t}</button>)}
            </div>
            {tab === 'Timeline' && <JourneyTimeline items={data.timeline} onDelete={(e) => void remove(e)} />}
            {tab === 'Calendar' && <JourneyCalendar items={all} />}
            {tab === 'Log progress' && <LogProgress<Journey> url={`/api/v1/staffing/candidates/${data.candidateId}/journey`} onAdded={(v) => { setJ(v); setTab('Timeline') }}
              intro="Log what this resource did or has booked. It shows on their journey and on the Resources page." />}
          </div>
        </Card>
        <div className="stack-4 res-side">
          <Card level={2} title="Upcoming"><UpcomingList items={data.upcoming} empty="Nothing booked." /></Card>
          <Card level={2} title="Resumes"><ResumeReviews candidateId={data.candidateId} name={data.name} />{data.bestFit === null && <p className="muted-small">No resume yet. Share the resume builder with the candidate for a role.</p>}</Card>
        </div>
      </div>
    </div>
  )
}
