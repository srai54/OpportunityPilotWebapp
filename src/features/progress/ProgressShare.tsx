import { useEffect, useState } from 'react'
import { ErrorNotice } from '../../components/ErrorNotice'
import { LoadingState } from '../../components/States'
import { Badge } from '../../components/StatusBadge'
import { api } from '../../lib/api'
import { config } from '../../lib/config'
import { useApi } from '../../lib/useApi'
import type { StaffingDeal } from '../staffing/staffingTypes'
import { ANSWER_LABEL, NOTE_MAX, openRoles, PREP_MAX, progressUrl, shownSummary, SHOW_OPTIONS, updateMailto, type ProgressLink, type ShareInterview, type ShowKey } from './progressModel'

const when = (iso: string) => { try { return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) } catch { return iso } }

/** Prep tips for one upcoming interview. Saved on its own; the candidate sees it on their next refresh when "Interview prep" is shared. */
function PrepEditor({ interview }: Readonly<{ interview: ShareInterview }>) {
  const [text, setText] = useState(interview.prep ?? '')
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState<Error>()
  const id = `prep-${interview.id}`
  async function save() {
    setState('saving'); setError(undefined)
    try { await api(`/api/v1/staffing/interviews/${interview.id}/prep`, { method: 'PUT', body: JSON.stringify({ prep: text }) }); setState('saved') }
    catch (e) { setError(e as Error); setState('idle') }
  }
  return (
    <div className="field">
      <label htmlFor={id}>Round {interview.round}{interview.title ? ` · ${interview.title}` : ''} · {when(interview.scheduledAt)}</label>
      <textarea id={id} rows={3} maxLength={PREP_MAX} value={text} aria-describedby={`${id}-hint`} onChange={(e) => { setText(e.target.value); setState('idle') }} />
      <p id={`${id}-hint`} className="hint">Who they meet, what to prepare, how to join. Never pay or internal notes.</p>
      {error && <ErrorNotice error={error} />}
      <div className="row wrap">
        <button className="btn btn-secondary btn-sm" type="button" disabled={state === 'saving'} onClick={() => void save()}>{state === 'saving' ? 'Saving…' : 'Save prep'}</button>
        {state === 'saved' && <span className="muted-small" role="status">Saved. The candidate sees it on their page.</span>}
      </div>
    </div>
  )
}

/**
 * Candidates → "Share progress": the sales team picks what the candidate may see, makes a private link, and tells the candidate by
 * email (opened in their own mail app) and/or by sending the link. The link is shown once; making a new one replaces it.
 * Optional extras (2026-10-22): a note, interview prep and suggested roles the candidate can answer.
 */
export function ProgressShare({ candidate, onClose }: Readonly<{ candidate: { id: string; name: string; email: string | null }; onClose: () => void }>) {
  const status = useApi<ProgressLink>(`/api/v1/staffing/candidates/${candidate.id}/progress-link`)
  const [show, setShow] = useState<ShowKey[]>(['Client', 'Role', 'Interviews'])
  const [note, setNote] = useState('')
  const [roleIds, setRoleIds] = useState<string[]>([])
  const [fresh, setFresh] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<Error>()
  const deals = useApi<StaffingDeal[]>(show.includes('Roles') ? '/api/v1/staffing/deals?take=200' : null)

  // Start from what is shared now, so making a new link does not drop the note or the suggested roles by accident.
  const saved = status.data
  useEffect(() => {
    if (!saved) return
    // oxlint-disable-next-line react/set-state-in-effect
    setNote(saved.note ?? '')
    setRoleIds((saved.roles ?? []).map((r) => r.dealId))
  }, [saved])

  async function make() {
    setBusy(true); setError(undefined); setCopied(false)
    try {
      const body = { show, note: show.includes('Note') ? note : null, roleIds: show.includes('Roles') ? roleIds : undefined }
      const made = await api<ProgressLink>(`/api/v1/staffing/candidates/${candidate.id}/progress-link`, { method: 'POST', body: JSON.stringify(body) })
      setFresh(made.token ? progressUrl(config.candidatePortalUrl || window.location.origin, made.token) : null)
      status.reload()
    } catch (e) { setError(e as Error) } finally { setBusy(false) }
  }
  async function stop() {
    setBusy(true); setError(undefined)
    try { await api(`/api/v1/staffing/candidates/${candidate.id}/progress-link`, { method: 'DELETE' }); setFresh(null); status.reload() }
    catch (e) { setError(e as Error) } finally { setBusy(false) }
  }
  async function copy() {
    if (!fresh) return
    try { await navigator.clipboard.writeText(fresh); setCopied(true) } catch { setCopied(false) }
  }

  const mailto = fresh ? updateMailto(candidate, fresh) : null
  const answers = (saved?.roles ?? []).filter((r) => r.answer !== 'None')
  const roles = openRoles(deals.data ?? [])
  const upcoming = saved?.interviews ?? []
  return (
    <section className="panel" aria-label={`Share progress with ${candidate.name}`}>
      <header className="panel-head"><h3 className="eyebrow">Share progress — {candidate.name}</h3><span className="grow" /><button className="btn btn-secondary btn-sm" type="button" onClick={onClose}>Close</button></header>
      <div className="panel-body stack-3">
        {status.loading && !status.data ? <LoadingState label="Loading…" rows={1} /> : (
          <p className="muted-small">{status.data?.active ? `A link is on: it shows ${shownSummary(status.data.show)}.` : 'No link yet. The candidate sees nothing until you make one.'}</p>
        )}
        {answers.length > 0 && (
          <div className="notice notice-neutral stack-1" role="status">
            <p><strong>{candidate.name.split(' ')[0]} answered</strong></p>
            <ul className="stack-1">{answers.map((r) => <li key={r.id} className="row wrap"><span>{r.title}</span><Badge tone={r.answer === 'Interested' ? 'success' : 'neutral'}>{ANSWER_LABEL[r.answer]}</Badge></li>)}</ul>
          </div>
        )}
        <fieldset className="row wrap"><legend className="muted-small">What the candidate may see (the stage of each submission is always shown)</legend>
          {SHOW_OPTIONS.map((o) => <label key={o.key} className="check"><input type="checkbox" checked={show.includes(o.key)}
            onChange={() => setShow((cur) => cur.includes(o.key) ? cur.filter((x) => x !== o.key) : [...cur, o.key])} /> {o.label}</label>)}
        </fieldset>
        {show.includes('Note') && (
          <div className="field">
            <label htmlFor={`note-${candidate.id}`}>Note for {candidate.name.split(' ')[0]}</label>
            <textarea id={`note-${candidate.id}`} rows={3} maxLength={NOTE_MAX} value={note} aria-describedby={`note-${candidate.id}-hint`} onChange={(e) => setNote(e.target.value)} />
            <p id={`note-${candidate.id}-hint`} className="hint">Shown at the top of their page, e.g. "The client liked your profile; expect a call this week." Saved when you make the link.</p>
          </div>
        )}
        {show.includes('Roles') && (
          <fieldset className="stack-2"><legend className="muted-small">Roles to suggest (title only, and the client if you share the client name; never the value). They can answer "I'm interested" or "Not for me".</legend>
            {deals.loading && !deals.data && <LoadingState label="Loading roles…" rows={1} />}
            {deals.error && <ErrorNotice error={deals.error} onRetry={deals.reload} what="the roles" />}
            {deals.data && roles.length === 0 && <p className="muted-small">No open roles yet. Add a deal under Staffing first.</p>}
            {roles.map((d) => {
              const answered = saved?.roles?.find((r) => r.dealId === d.id)
              return <label key={d.id} className="check"><input type="checkbox" checked={roleIds.includes(d.id)} disabled={!roleIds.includes(d.id) && roleIds.length >= 10}
                onChange={() => setRoleIds((cur) => cur.includes(d.id) ? cur.filter((x) => x !== d.id) : [...cur, d.id])} /> {d.title}
                {answered && answered.answer !== 'None' && <> <Badge tone={answered.answer === 'Interested' ? 'success' : 'neutral'}>{ANSWER_LABEL[answered.answer]}</Badge></>}</label>
            })}
            {roleIds.length >= 10 && <p className="muted-small">Up to 10 roles.</p>}
          </fieldset>
        )}
        {show.includes('Prep') && (
          <div className="stack-2">
            <p className="muted-small">Interview prep — saved per interview, shown with that interview.</p>
            {upcoming.length === 0 ? <p className="muted-small">No interview is scheduled for {candidate.name.split(' ')[0]} yet.</p>
              : upcoming.map((iv) => <PrepEditor key={iv.id} interview={iv} />)}
          </div>
        )}
        <p className="muted-small">Pay, rates and internal notes are never shown.</p>
        {error && <ErrorNotice error={error} />}
        <div className="row wrap">
          <button className="btn btn-primary btn-sm" type="button" disabled={busy} onClick={() => void make()}>{status.data?.active ? 'Make a new link (replaces the old one)' : 'Make the link'}</button>
          {status.data?.active && <button className="btn btn-secondary btn-sm" type="button" disabled={busy} onClick={() => void stop()}>Stop sharing</button>}
        </div>
        {fresh && (
          <div className="notice notice-neutral stack-2" role="status">
            <p><strong>Send this link to {candidate.name}.</strong> It is shown only now.</p>
            <input readOnly value={fresh} aria-label="Progress link" onFocus={(e) => e.currentTarget.select()} />
            <div className="row wrap">
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => void copy()}>{copied ? 'Copied' : 'Copy link'}</button>
              {mailto ? <a className="btn btn-secondary btn-sm" href={mailto}>Email it to {candidate.name.split(' ')[0]}</a> : <span className="muted-small">Add an email address to the candidate to send it by email.</span>}
              <a className="btn btn-ghost btn-sm" href={fresh} target="_blank" rel="noopener noreferrer">Preview<span className="sr-only"> (opens in a new tab)</span></a>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
