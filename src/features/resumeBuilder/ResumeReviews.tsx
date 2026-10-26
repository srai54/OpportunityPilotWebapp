import { useState } from 'react'
import { ErrorNotice } from '../../components/ErrorNotice'
import { Badge } from '../../components/StatusBadge'
import { api } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { fileName, parseDoc, resumeDocx } from './resumeDoc'

interface SalesResume { id: string; dealId: string; dealTitle: string; data: string; matchScore: number | null; status: 'Draft' | 'Submitted' | 'Reviewed'; salesScore: number | null; salesFeedback: string | null; updatedAt: string; submittedAt: string | null }
const when = (iso: string) => { try { return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) } catch { return iso } }

/** The client's job description on one deal; candidates write their resume against it. */
export function JobDescriptionEditor({ dealId, title, initial }: Readonly<{ dealId: string; title: string; initial: string | null }>) {
  const [text, setText] = useState(initial ?? '')
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState<Error>()
  const id = `jd-${dealId}`
  async function save() {
    setState('saving'); setError(undefined)
    try { await api(`/api/v1/staffing/deals/${dealId}/job-description`, { method: 'PUT', body: JSON.stringify({ text }) }); setState('saved') }
    catch (e) { setError(e as Error); setState('idle') }
  }
  return (
    <details className="rb-jd" open={!initial}>
      <summary>Job description · {title}{initial ? '' : ' (not added yet)'}</summary>
      <div className="field">
        <label htmlFor={id}>Paste the client's job description</label>
        <textarea id={id} rows={5} maxLength={8000} value={text} onChange={(e) => { setText(e.target.value); setState('idle') }} />
      </div>
      {error && <ErrorNotice error={error} />}
      <div className="row wrap">
        <button type="button" className="btn btn-secondary btn-sm" disabled={state === 'saving'} onClick={() => void save()}>{state === 'saving' ? 'Saving…' : 'Save job description'}</button>
        {state === 'saved' && <span className="muted-small" role="status">Saved. The candidate sees it beside their resume.</span>}
      </div>
    </details>
  )
}

function Review({ r, onDone }: Readonly<{ r: SalesResume; onDone: () => void }>) {
  const [score, setScore] = useState(r.salesScore?.toString() ?? '')
  const [feedback, setFeedback] = useState(r.salesFeedback ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Error>()
  const doc = parseDoc(r.data)
  const n = Number(score)
  const valid = score.trim() !== '' && Number.isInteger(n) && n >= 0 && n <= 100
  async function save() {
    setBusy(true); setError(undefined)
    try { await api(`/api/v1/staffing/resumes/${r.id}/review`, { method: 'POST', body: JSON.stringify({ score: n, feedback }) }); onDone() }
    catch (e) { setError(e as Error) } finally { setBusy(false) }
  }
  async function download() {
    if (!doc) return
    const url = URL.createObjectURL(await resumeDocx(doc))
    const a = document.createElement('a'); a.href = url; a.download = fileName(doc, r.dealTitle); a.click(); URL.revokeObjectURL(url)
  }
  const id = `rv-${r.id}`
  return (
    <li className="rb-project stack-2">
      <div className="row wrap">
        <strong>{r.dealTitle}</strong>
        <Badge tone={r.status === 'Reviewed' ? 'success' : r.status === 'Submitted' ? 'attention' : 'neutral'}>{r.status === 'Submitted' ? 'Waiting for your review' : r.status}</Badge>
        {r.matchScore !== null && <span className="muted-small">JD match {r.matchScore}%</span>}
        <span className="muted-small">updated {when(r.updatedAt)}</span>
      </div>
      {doc && <p className="muted-small">{doc.title}{doc.summary ? ` — ${doc.summary.slice(0, 180)}${doc.summary.length > 180 ? '…' : ''}` : ''}</p>}
      <div className="row wrap"><button type="button" className="btn btn-secondary btn-sm" disabled={!doc} onClick={() => void download()}>Download Word</button></div>
      {r.status !== 'Draft' && (
        <div className="rb-grid">
          <div className="field">
            <label htmlFor={`${id}-s`}>Score (0–100)</label>
            <input id={`${id}-s`} inputMode="numeric" value={score} aria-invalid={score !== '' && !valid} onChange={(e) => setScore(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor={`${id}-f`}>Feedback for the candidate</label>
            <textarea id={`${id}-f`} rows={3} maxLength={2000} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
          </div>
        </div>
      )}
      {error && <ErrorNotice error={error} />}
      {r.status !== 'Draft' && <div><button type="button" className="btn btn-primary btn-sm" disabled={busy || !valid} onClick={() => void save()}>{busy ? 'Saving…' : 'Save score'}</button></div>}
      {r.status === 'Draft' && <p className="muted-small">Still a draft: you can score it once the candidate submits.</p>}
    </li>
  )
}

/** Share progress → resumes the candidate wrote for the shared roles, with their JD match; the team scores each one. */
export function ResumeReviews({ candidateId, name }: Readonly<{ candidateId: string; name: string }>) {
  const list = useApi<SalesResume[]>(`/api/v1/staffing/candidates/${candidateId}/resumes`)
  if (!list.data || list.data.length === 0) return null
  return (
    <section className="stack-2" aria-label={`Resumes from ${name}`}>
      <p className="muted-small"><strong>Resumes from {name.split(' ')[0]}</strong> — check, download in the client format, and score.</p>
      <ul className="stack-2" style={{ listStyle: 'none', padding: 0, margin: 0 }}>{list.data.map((r) => <Review key={r.id} r={r} onDone={list.reload} />)}</ul>
    </section>
  )
}
