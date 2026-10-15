import { useEffect, useRef, useState } from 'react'
import { Avatar } from '../../components/cards'
import { ErrorNotice } from '../../components/ErrorNotice'
import { Icon } from '../../components/icons'
import { api } from '../../lib/api'
import type { StaffingDeal } from '../staffing/staffingTypes'
import { canRecord, recordAndTranscribe, type Recording } from '../voice/whisper'
import { agoLabel, CALL_OUTCOMES, callNote, followUpAt, followUpNote, saveTarget, type CallOutcome, type PendingCall } from './callModel'
import type { ScheduleTarget } from './ScheduleInterviewDialog'
import { Sheet } from './Sheet'

/**
 * "After the call" (PhoneCallDone.png): opens when the person comes back from the dialler. Saves how it went to the deal (Sales)
 * or the job (Candidate) with the existing endpoints, and offers the next step.
 */
export function CallDoneSheet({ call, onClose, onSchedule }: Readonly<{ call: PendingCall; onClose: () => void; onSchedule: (t: ScheduleTarget) => void }>) {
  const [outcome, setOutcome] = useState<CallOutcome>('Talked')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Error>()
  const [said, setSaid] = useState('')
  const [listening, setListening] = useState(false)
  const recording = useRef<Recording | null>(null)
  useEffect(() => () => recording.current?.stop(), [])
  const target = saveTarget(call)
  const first = call.who.trim().split(/\s+/)[0] || call.who

  /** Records the call: a phone reply when the client contact talked, otherwise a deal note; a job activity for the candidate. */
  async function save(): Promise<void> {
    const detail = callNote(call.who, outcome, note)
    if (target === 'deal') {
      const base = `/api/v1/staffing/deals/${call.dealId}`
      if (call.contactId && outcome === 'Talked') {
        await api(`${base}/replies`, { method: 'POST', body: JSON.stringify({
          contactId: call.contactId, channel: 'Phone', from: call.who, subject: null, body: note.trim() || detail, intent: 'Unclassified', receivedAt: null,
        }) })
      } else {
        await api(`${base}/notes`, { method: 'POST', body: JSON.stringify({ detail }) })
      }
    } else if (target === 'opportunity') {
      await api(`/api/v1/opportunities/${call.opportunityId}/activities`, { method: 'POST', body: JSON.stringify({ kind: 'Note', detail, occurredAt: call.at }) })
    }
  }

  async function followUp(): Promise<void> {
    const at = followUpAt(new Date())
    const text = followUpNote(call.who, outcome, call.phone)
    if (target === 'deal') {
      const base = `/api/v1/staffing/deals/${call.dealId}`
      const d = await api<StaffingDeal>(base)
      await api(base, { method: 'PUT', body: JSON.stringify({
        title: d.title, externalReference: d.externalReference, estimatedValue: d.estimatedValue, currency: d.currency,
        nextAction: text, nextActionAt: at.toISOString(), expectedVersion: d.version,
      }) })
    } else if (target === 'opportunity') {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      await api(`/api/v1/opportunities/${call.opportunityId}/next-actions`, { method: 'POST', body: JSON.stringify({
        kind: outcome === 'NoAnswer' || outcome === 'CallBack' ? 'Call' : 'FollowUp', note: text, dueAt: at.toISOString(), timeZone: zone,
      }) })
    }
  }

  async function run(step: 'save' | 'follow' | 'schedule') {
    setBusy(true); setError(undefined)
    try {
      await save()
      if (step === 'follow') await followUp()
      if (step === 'schedule') {
        onSchedule(target === 'deal'
          ? { workspace: 'sales', dealId: call.dealId, submissionId: call.submissionId ?? null, title: call.context ?? null, phone: call.phone, candidateName: call.contactId ? null : call.who }
          : { workspace: 'candidate', opportunityId: call.opportunityId, title: call.context ?? null, phone: call.phone })
        return
      }
      setSaid(step === 'follow' ? 'Saved. Follow-up set for 2 days from now.' : 'Saved.')
      onClose()
    } catch (e) { setError(e as Error) } finally { setBusy(false) }
  }

  async function dictate() {
    if (recording.current) { recording.current.stop(); return }
    setListening(true)
    recording.current = await recordAndTranscribe(
      (t) => setNote((n) => (n ? `${n} ${t}` : t)),
      (m) => setError(new Error(m)),
      () => { setListening(false); recording.current = null },
    )
  }

  return <Sheet labelId="call-done-title" title={`Call with ${first}`} onClose={onClose} avatar={<Avatar name={call.who} />}
    subtitle={`${agoLabel(call.at)} · from your phone${call.context ? ` · ${call.context}` : ''}`}>
    <span className="sr-only" role="status" aria-live="polite">{said}</span>
    <fieldset className="call-choice">
      <legend>How did it go?</legend>
      <div className="call-choice-grid">{CALL_OUTCOMES.map((o) => <label key={o.value} className={`call-choice-btn${outcome === o.value ? ' is-on' : ''}`}>
        <input type="radio" name="call-outcome" value={o.value} checked={outcome === o.value} onChange={() => setOutcome(o.value)} /> {o.label}</label>)}</div>
    </fieldset>
    <div className="field">
      <label htmlFor="call-note">Note</label>
      <div className="call-note">
        <textarea id="call-note" rows={3} maxLength={400} value={note} onChange={(e) => setNote(e.target.value)} />
        {canRecord() && <button type="button" className={`btn ${listening ? 'btn-primary' : 'btn-secondary'} call-mic`} onClick={() => void dictate()}
          aria-pressed={listening} aria-label={listening ? 'Stop dictating' : 'Dictate the note'}><Icon name="mic" size={18} /></button>}
      </div>
    </div>
    {error && <ErrorNotice error={error} />}
    <div className="stack-2">
      <span className="field-label">Next step</span>
      <button type="button" className="btn btn-primary btn-lg call-wide" disabled={busy || !target} onClick={() => void run('schedule')}>
        <Icon name="calendar" size={18} /> Schedule interview</button>
      <div className="call-choice-grid">
        <button type="button" className="btn btn-secondary btn-lg" disabled={busy || !target} onClick={() => void run('follow')}>Follow up in 2 days</button>
        <button type="button" className="btn btn-secondary btn-lg" disabled={busy || !target} onClick={() => void run('save')}>Just save</button>
      </div>
      {!target && <p className="muted-small">This call is not linked to a deal or job, so there is nowhere to save it. Close this and open the deal to add a note.</p>}
    </div>
  </Sheet>
}
