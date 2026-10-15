import { useState, type FormEvent, type ReactNode } from 'react'
import { ErrorNotice } from '../../components/ErrorNotice'
import { Icon, type IconName } from '../../components/icons'
import { api } from '../../lib/api'
import { normalisePhone, toTel, toWhatsApp } from '../../lib/phone'
import type { JobInterview } from '../../lib/types'
import { useApi } from '../../lib/useApi'
import type { DealWork, Interview, InterviewMode, StaffingCandidate } from '../staffing/staffingTypes'
import { addReminder } from './reminderModel'
import {
  candidateScheduleBody, draftUtc, emptyDraft, LENGTHS, mailtoLink, nextRound, notifiedStatus, salesScheduleBody, scheduleProblems, tellMessage,
  WHO_CALLS, zoneChoices, type DraftField, type ScheduleDraft, type TellBy, type WhoCalls,
} from './scheduleModel'
import { Sheet } from './Sheet'

export interface ScheduleTarget {
  workspace: 'sales' | 'candidate'
  /** Sales: the deal. */
  dealId?: string | null
  /** Sales: an interview already asked for (Requested) or booked (reschedule). */
  interviewId?: string | null
  /** Sales: book a new round for this submission. */
  submissionId?: string | null
  /** Candidate: the job. */
  opportunityId?: string | null
  /** "Infosys · Java Lead" */
  title?: string | null
  client?: string | null
  /** Prefill (from a call). */
  phone?: string | null
  candidateName?: string | null
}

const MODES: { value: InterviewMode; icon: IconName }[] = [{ value: 'Video', icon: 'video' }, { value: 'Phone', icon: 'phone' }, { value: 'Onsite', icon: 'place' }]
const TELL: { value: TellBy; label: string }[] = [{ value: 'WhatsApp', label: 'WhatsApp' }, { value: 'Email', label: 'Email draft' }, { value: 'Self', label: "I'll tell them" }]
const ownZone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' } catch { return 'UTC' } }

type Done = { interviewId: string; version: number; dealId: string; message: string; whatsapp: string | null; mail: string | null; tell: TellBy; who: string }

/**
 * "Schedule interview" (ScheduleForm.png). Sales: asks for a round on the deal if needed, then books it with the deal's own
 * interview endpoints; Candidate: adds the round to the job. Telling the candidate opens WhatsApp or the mail app with the text;
 * the person presses Send there, and it is marked as told only when they say so.
 */
export function ScheduleInterviewDialog({ target, onClose, onDone }: Readonly<{ target: ScheduleTarget; onClose: () => void; onDone: () => void }>) {
  const sales = target.workspace === 'sales'
  const work = useApi<DealWork>(sales && target.dealId ? `/api/v1/staffing/deals/${target.dealId}/work` : null)
  const candidates = useApi<StaffingCandidate[]>(sales ? '/api/v1/staffing/candidates' : null)
  const jobRounds = useApi<JobInterview[]>(!sales && target.opportunityId ? `/api/v1/interviews?opportunityId=${encodeURIComponent(target.opportunityId)}` : null)

  const existing = work.data?.interviews.find((i) => i.id === target.interviewId) ?? null
  const sent = (work.data?.submissions ?? []).filter((s) => s.state === 'Sent')
  const [submissionId, setSubmissionId] = useState(target.submissionId ?? existing?.submissionId ?? '')
  const chosenSubmission = existing?.submissionId ?? (submissionId || (sent.length === 1 ? sent[0].id : ''))
  const submission = work.data?.submissions.find((s) => s.id === chosenSubmission)
  const candidate = candidates.data?.find((c) => c.id === submission?.candidateId)
  const who = target.candidateName ?? submission?.candidateName ?? 'the candidate'

  const [draft, setDraft] = useState<ScheduleDraft>(() => ({ ...emptyDraft(ownZone(), target.phone ?? ''), round: '', mode: target.phone ? 'Phone' : 'Video' }))
  const [touchedPhone, setTouchedPhone] = useState(false)
  const [shown, setShown] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Error>()
  const [done, setDone] = useState<Done | null>(null)

  // The round: the one asked for, the next one for that submission, or the next one for the job.
  const salesRound = existing?.round ?? (work.data ? nextRound(work.data.interviews.filter((i) => i.submissionId === chosenSubmission && i.state !== 'Requested').map((i) => i.round)) : 1)
  const requested = !existing && work.data ? work.data.interviews.find((i) => i.submissionId === chosenSubmission && i.state === 'Requested') ?? null : null
  const jobNext = jobRounds.data ? nextRound(jobRounds.data.map((r) => r.round)) : 1
  // Candidate: the next round for the job until the person picks one ('' = not picked).
  const round = sales ? String(requested?.round ?? salesRound) : draft.round || String(jobNext)
  const phone = touchedPhone ? draft.phone : draft.phone || candidate?.phone || ''
  const full: ScheduleDraft = { ...draft, round, phone }
  const problems = scheduleProblems(full, target.workspace)
  const message = tellMessage(full, { candidate: who, client: target.client ?? null })
  const set = <K extends keyof ScheduleDraft>(k: K, v: ScheduleDraft[K]) => setDraft((d) => ({ ...d, [k]: v }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    setShown(true)
    const first = Object.keys(problems)[0] as DraftField | undefined
    if (first) { document.getElementById(`sch-${first}`)?.focus(); return }
    if (sales && !chosenSubmission) { document.getElementById('sch-submission')?.focus(); return }
    setBusy(true); setError(undefined)
    try {
      const at = draftUtc(full)!
      if (sales) {
        const base = `/api/v1/staffing/deals/${target.dealId}/interviews`
        let iv: Interview | null = existing ?? requested
        if (!iv) iv = await api<Interview>(base, { method: 'POST', body: JSON.stringify({ submissionId: chosenSubmission }) })
        const booked = await api<Interview>(`${base}/${iv.id}/schedule`, { method: 'POST', body: JSON.stringify(salesScheduleBody(full, iv.version)) })
        if (full.remind) addReminder({ key: `s:${booked.id}`, at, title: `Round ${booked.round} · ${who}` })
        const email = candidate?.email ?? null
        setDone({
          interviewId: booked.id, version: booked.version, dealId: target.dealId!, message, tell: full.tell, who,
          whatsapp: toWhatsApp(phone, message), mail: mailtoLink(email, `Interview round ${booked.round}${target.client ? ` with ${target.client}` : ''}`, message),
        })
      } else {
        const saved = await api<JobInterview>(`/api/v1/opportunities/${target.opportunityId}/interviews`, { method: 'POST', body: JSON.stringify(candidateScheduleBody(full)) })
        if (full.remind) addReminder({ key: `j:${saved.id}`, at, title: `Round ${saved.round} · ${saved.organization || saved.title}` })
        onDone()
      }
    } catch (err) { setError(err as Error) } finally { setBusy(false) }
  }

  async function markTold() {
    if (!done) return
    const status = notifiedStatus(done.tell)
    if (!status) { onDone(); return }
    setBusy(true); setError(undefined)
    try {
      await api(`/api/v1/staffing/deals/${done.dealId}/interviews/${done.interviewId}/notified`, { method: 'POST', body: JSON.stringify({ status, expectedVersion: done.version }) })
      onDone()
    } catch (err) { setError(err as Error) } finally { setBusy(false) }
  }

  const err = (k: DraftField) => (shown ? problems[k] : undefined)
  const aria = (k: DraftField) => ({ id: `sch-${k}`, 'aria-invalid': err(k) ? true : undefined, 'aria-describedby': err(k) ? `sch-${k}-err` : undefined })
  const field = (k: DraftField, label: string, input: ReactNode, hint?: string) => <div className="field">
    <label htmlFor={`sch-${k}`}>{label}</label>{input}
    {err(k) ? <span className="field-error" id={`sch-${k}-err`}>{err(k)}</span> : hint && <span className="muted-small">{hint}</span>}
  </div>

  const subtitle = [target.title, sales ? who : null].filter(Boolean).join(' · ') || undefined

  if (done) {
    const openLink = done.tell === 'WhatsApp' ? done.whatsapp : done.tell === 'Email' ? done.mail : null
    return <Sheet labelId="sch-title" title="Interview booked" subtitle={subtitle} onClose={onDone}
      footer={done.tell === 'Self' ? <button type="button" className="btn btn-primary" onClick={onDone}>Done</button>
        : <><button type="button" className="btn btn-secondary" onClick={onDone}>Not yet</button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void markTold()}>I sent it</button></>}>
      <p className="notice notice-success" role="status">Round {round} is booked{full.remind ? '. We will remind you 1 hour before' : ''}.</p>
      {done.tell !== 'Self' && <>
        <p className="call-tell-text">{done.message}</p>
        {openLink && <a className="btn btn-primary call-wide" href={openLink} target={done.tell === 'WhatsApp' ? '_blank' : undefined} rel="noopener noreferrer">
          {done.tell === 'WhatsApp' ? 'Open WhatsApp' : 'Open email draft'}{done.tell === 'WhatsApp' && <span className="sr-only"> (opens in a new tab)</span>}</a>}
        <p className="muted-small">You press Send there. Then tap “I sent it” so {done.who} shows as told.</p>
      </>}
      {error && <ErrorNotice error={error} />}
    </Sheet>
  }

  return <Sheet labelId="sch-title" title={existing?.state === 'Scheduled' ? 'Reschedule interview' : 'Schedule interview'} subtitle={subtitle} onClose={onClose}
    footer={<><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
      <button type="submit" form="sch-form" className="btn btn-primary" disabled={busy || (sales && !work.data)}>{busy ? 'Saving…' : existing?.state === 'Scheduled' ? 'Reschedule' : 'Schedule'}</button></>}>
    <form id="sch-form" className="call-form" onSubmit={(e) => void submit(e)} noValidate>
      {sales && work.error && <ErrorNotice error={work.error} onRetry={work.reload} what="the deal's candidates" />}
      {sales && !existing && work.data && (sent.length === 0
        ? <p className="notice notice-warning">Send a candidate to the client first. Interviews follow a sent submission.</p>
        : sent.length > 1 && <div className="field"><label htmlFor="sch-submission">Candidate</label>
          <select id="sch-submission" value={submissionId} onChange={(e) => setSubmissionId(e.target.value)} required>
            <option value="">Choose…</option>{sent.map((s) => <option key={s.id} value={s.id}>{s.candidateName}</option>)}
          </select></div>)}

      <div className="call-grid-3">
        {sales ? <div className="field"><span className="field-label">Round</span><strong className="call-static op-numeric">{round}</strong></div>
          : field('round', 'Round', <select {...aria('round')} value={round} onChange={(e) => set('round', e.target.value)}>
            {Array.from({ length: 20 }, (_, i) => String(i + 1)).map((r) => <option key={r} value={r}>{r}</option>)}</select>)}
        {field('date', 'Date', <input {...aria('date')} type="date" value={draft.date} onChange={(e) => set('date', e.target.value)} />)}
        {field('time', 'Time', <input {...aria('time')} type="time" value={draft.time} onChange={(e) => set('time', e.target.value)} />)}
      </div>
      <div className="call-grid-2">
        <div className="field"><label htmlFor="sch-zone">Time zone</label>
          <select id="sch-zone" value={draft.zone} onChange={(e) => set('zone', e.target.value)}>{zoneChoices(draft.zone).map((z) => <option key={z.value} value={z.value}>{z.label}</option>)}</select></div>
        <div className="field"><label htmlFor="sch-length">Length</label>
          <select id="sch-length" value={draft.minutes} onChange={(e) => set('minutes', Number(e.target.value))}>{LENGTHS.map((m) => <option key={m} value={m}>{m} min</option>)}</select></div>
      </div>

      <fieldset className="call-choice">
        <legend>How</legend>
        <div className="call-choice-row">{MODES.map((m) => <label key={m.value} className={`call-choice-btn${draft.mode === m.value ? ' is-on' : ''}`}>
          <input type="radio" name="sch-mode" value={m.value} checked={draft.mode === m.value} onChange={() => set('mode', m.value)} />
          <Icon name={m.icon} size={16} /> {m.value}</label>)}</div>
      </fieldset>

      {draft.mode === 'Phone' && <>
        <div className="field"><label htmlFor="sch-who">Who calls whom</label>
          <select id="sch-who" value={draft.whoCalls} onChange={(e) => set('whoCalls', e.target.value as WhoCalls)}>
            {(Object.keys(WHO_CALLS) as WhoCalls[]).map((k) => <option key={k} value={k}>{WHO_CALLS[k][target.workspace]}</option>)}</select></div>
        <div className="field">
          <label htmlFor="sch-phone">{sales ? 'Candidate number' : 'Their number'}</label>
          <div className="call-inline">
            <input {...aria('phone')} type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => { setTouchedPhone(true); set('phone', e.target.value) }} placeholder="+91 98765 43210" />
            {toTel(phone) && <a className="btn btn-secondary" href={toTel(phone)!}>Test call</a>}
          </div>
          {err('phone') ? <span className="field-error" id="sch-phone-err">{err('phone')}</span>
            : sales && candidate?.phone && normalisePhone(candidate.phone) === normalisePhone(phone) && <span className="muted-small">Filled from the candidate's profile</span>}
        </div>
      </>}
      {draft.mode === 'Video' && field('link', 'Meeting link', <input {...aria('link')} type="url" value={draft.link} onChange={(e) => set('link', e.target.value)} placeholder="https://" />)}
      {draft.mode === 'Onsite' && field('address', 'Address', <input {...aria('address')} value={draft.address} maxLength={500} onChange={(e) => set('address', e.target.value)} />)}

      {sales && <fieldset className="call-tell">
        <legend>Tell the candidate</legend>
        <div className="call-choice-row">{TELL.map((t) => <label key={t.value} className={`call-choice-btn${draft.tell === t.value ? ' is-on' : ''}`}>
          <input type="radio" name="sch-tell" value={t.value} checked={draft.tell === t.value} onChange={() => set('tell', t.value)} /> {t.label}</label>)}</div>
        {draft.tell !== 'Self' && <>
          <p className="call-tell-text">{message}</p>
          <p className="muted-small">{draft.tell === 'WhatsApp' ? 'Opens WhatsApp with this text. You press Send.' : 'Opens your mail app with this text. You press Send.'}</p>
        </>}
      </fieldset>}

      <label className="check"><input type="checkbox" checked={draft.remind} onChange={(e) => {
        set('remind', e.target.checked)
        if (e.target.checked && typeof Notification !== 'undefined' && Notification.permission === 'default') void Notification.requestPermission().catch(() => undefined)
      }} /> Remind me 1 hour before</label>
      {error && <ErrorNotice error={error} />}
    </form>
  </Sheet>
}
