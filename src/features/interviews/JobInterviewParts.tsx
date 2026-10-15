import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '../../components/cards'
import { ErrorNotice } from '../../components/ErrorNotice'
import { Badge } from '../../components/StatusBadge'
import { api } from '../../lib/api'
import type { JobInterview, JobInterviewStatus } from '../../lib/types'
import { safeHref } from '../opportunities/opportunityModel'
import {
  JOB_ACTION_LABELS, JOB_STATUS, jobDraftBody, jobDraftProblems, jobStatusChoices, utcToLocalInput, whenLabel, type JobInterviewDraft,
} from './interviewsModel'

/** One interview card for the candidate: job, round, time, join link, status and the status changes allowed now. */
export function JobInterviewCard({ i, now, showJob, busy, onStatus, onEdit, onRemove }: Readonly<{
  i: JobInterview; now: Date; showJob: boolean; busy: boolean
  onStatus: (i: JobInterview, s: JobInterviewStatus) => void; onEdit: (i: JobInterview) => void; onRemove: (i: JobInterview) => void
}>) {
  const status = JOB_STATUS[i.status]
  const join = i.status === 'Scheduled' ? safeHref(i.meetingUrl) : null
  const name = showJob ? `${i.organization || i.title}, round ${i.round}` : `Round ${i.round}`
  return <li className="ccard followup-card" aria-label={name}>
    <Avatar name={i.organization || i.title} />
    <div className="followup-main">
      <span className="followup-title">{showJob ? <Link to={`/opportunities/${i.opportunityId}`}>{i.title}</Link> : 'Interview'} · round {i.round} <Badge tone={status.tone}>{status.text}</Badge></span>
      <span className="followup-meta">{showJob && i.organization ? `${i.organization} · ` : ''}{whenLabel(i.scheduledAt, now)}</span>
      {i.notes && <span className="followup-note">{i.notes}</span>}
    </div>
    <div className="followup-actions">
      {join && <a className="btn btn-secondary btn-sm" href={join} target="_blank" rel="noopener noreferrer">Join<span className="sr-only"> {name} (opens in a new tab)</span></a>}
      {jobStatusChoices(i).map((s) => <button key={s} type="button" className={`btn btn-sm ${s === 'Cancelled' ? 'btn-ghost' : 'btn-secondary'}`} disabled={busy}
        onClick={() => onStatus(i, s)}>{JOB_ACTION_LABELS[s]}<span className="sr-only"> for {name}</span></button>)}
      <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => onEdit(i)}>Edit<span className="sr-only"> {name}</span></button>
      <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => onRemove(i)}>Remove<span className="sr-only"> {name}</span></button>
    </div>
  </li>
}

/** Add or edit one interview of a job: when, join link, notes (round only when editing; a new one gets the next round). */
export function JobInterviewForm({ opportunityId, editing, onSaved, onCancel }: Readonly<{
  opportunityId: string; editing: JobInterview | null; onSaved: (saved: JobInterview) => void; onCancel: () => void
}>) {
  const [draft, setDraft] = useState<JobInterviewDraft>({
    when: utcToLocalInput(editing?.scheduledAt ?? null), link: editing?.meetingUrl ?? '', notes: editing?.notes ?? '', round: editing ? String(editing.round) : '',
  })
  const [shown, setShown] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Error>()
  const problems = jobDraftProblems(draft)
  const set = (k: keyof JobInterviewDraft) => (e: { target: { value: string } }) => setDraft((d) => ({ ...d, [k]: e.target.value }))
  const idFor = (k: string) => `iv-${editing?.id ?? 'new'}-${k}`

  async function submit(e: FormEvent) {
    e.preventDefault()
    setShown(true)
    if (Object.keys(problems).length > 0) {
      document.getElementById(idFor(Object.keys(problems)[0]))?.focus()
      return
    }
    setBusy(true); setError(undefined)
    try {
      const saved = editing
        ? await api<JobInterview>(`/api/v1/interviews/${editing.id}`, { method: 'PUT', body: JSON.stringify(jobDraftBody(draft, editing.version)) })
        : await api<JobInterview>(`/api/v1/opportunities/${opportunityId}/interviews`, { method: 'POST', body: JSON.stringify(jobDraftBody({ ...draft, round: '' })) })
      onSaved(saved)
    } catch (err) { setError(err as Error) } finally { setBusy(false) }
  }

  const field = (k: keyof JobInterviewDraft, label: string, input: ReactNode, hint?: string) => {
    const problem = shown ? problems[k] : undefined
    return <div className="field">
      <label htmlFor={idFor(k)}>{label}</label>
      {input}
      {hint && !problem && <span className="muted-small" id={`${idFor(k)}-hint`}>{hint}</span>}
      {problem && <span className="field-error" id={`${idFor(k)}-err`}>{problem}</span>}
    </div>
  }
  const aria = (k: keyof JobInterviewDraft) => ({ id: idFor(k), 'aria-invalid': shown && problems[k] ? true : undefined, 'aria-describedby': shown && problems[k] ? `${idFor(k)}-err` : undefined })

  return <form className="stack-3 subtle-box" onSubmit={(e) => void submit(e)} aria-label={editing ? `Edit round ${editing.round}` : 'Add an interview'}>
    {editing && field('round', 'Round', <input {...aria('round')} inputMode="numeric" value={draft.round} onChange={set('round')} />)}
    {field('when', 'When', <input {...aria('when')} type="datetime-local" value={draft.when} onChange={set('when')} />, 'Your own time zone. Leave empty if not agreed yet.')}
    {field('link', 'Join link', <input {...aria('link')} type="url" value={draft.link} onChange={set('link')} placeholder="https://" />)}
    {field('notes', 'Notes', <textarea {...aria('notes')} rows={2} value={draft.notes} onChange={set('notes')} />)}
    {error && <ErrorNotice error={error} />}
    <div className="row wrap">
      <button className="btn btn-primary btn-sm" type="submit" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add interview'}</button>
      <button className="btn btn-secondary btn-sm" type="button" onClick={onCancel}>Cancel</button>
    </div>
  </form>
}
