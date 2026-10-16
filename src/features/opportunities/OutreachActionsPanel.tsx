import { ContactFinder } from '../outreach/ContactFinder'
import { Card } from '../../components/cards'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ErrorNotice } from '../../components/ErrorNotice'
import { ProfileConfirmNotice } from '../profiles/ProfileConfirmNotice'
import { needsProfileConfirm } from '../profiles/profileFields'
import { api } from '../../lib/api'
import type { DraftChannel, NextAction, NextActionKind, OpportunityDetail, OutreachDraft } from '../../lib/types'
import { ReachPlanner } from './ReachPlanner'
import { useShell } from '../shell/ShellContext'

const CHANNELS: { value: DraftChannel; label: string }[] = [
  { value: 'Email', label: 'Email — opens in Gmail' }, { value: 'LinkedInMessage', label: 'LinkedIn message' }, { value: 'ContactForm', label: 'Job site message (Naukri, Instahyre, Indeed…) or contact form' },
]

/** What "To" means for each channel, so a LinkedIn name or a contact page is never asked for as an email address. */
const TO: Record<string, { label: string; placeholder: string; button: string }> = {
  Email: { label: 'Email address (optional — or add it in Gmail)', placeholder: 'name@company.com', button: 'Write the email' },
  LinkedInMessage: { label: 'Who (name or LinkedIn profile link)', placeholder: 'Nikhil Malhotra or https://www.linkedin.com/in/…', button: 'Write the LinkedIn note' },
  ContactForm: { label: 'Page to send it on (the job posting or a contact page)', placeholder: 'https://www.naukri.com/job-listings-…', button: 'Write the message' },
}

export function OutreachActionsPanel({ o }: { o: OpportunityDetail }) {
  const opportunityId = o.id
  const { advanced } = useShell()
  const navigate = useNavigate()
  const [adv, setAdv] = useState(advanced)
  const [channel, setChannel] = useState<DraftChannel>('Email')
  const [recipient, setRecipient] = useState('')
  const [kind, setKind] = useState<NextActionKind>('FollowUp')
  const [dueAt, setDueAt] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Error>()
  const [message, setMessage] = useState('')
  // A problem writing the message is shown under its button (the card's top is far above), so it is never missed.
  const [draftError, setDraftError] = useState<Error>()

  async function createDraft() {
    setBusy(true); setError(undefined); setDraftError(undefined)
    try {
      const made = await api<OutreachDraft>(`/api/v1/opportunities/${opportunityId}/drafts`, { method: 'POST', body: JSON.stringify({ channel, recipient: recipient.trim() || null }) })
      // Straight to the written message, where Approve & send opens the mail app, LinkedIn or the contact form.
      navigate(`/outreach?draft=${made.id}`)
    } catch (e) { setDraftError(e as Error) } finally { setBusy(false) }
  }
  async function createAction() {
    if (!dueAt) return
    setBusy(true); setError(undefined)
    try {
      await api<NextAction>(`/api/v1/opportunities/${opportunityId}/next-actions`, { method: 'POST', body: JSON.stringify({ kind, note: note || null, dueAt: new Date(dueAt).toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }) })
      setMessage('Follow-up added.'); setDueAt(''); setNote('')
    } catch (e) { setError(e as Error) } finally { setBusy(false) }
  }
  return <Card title="Reach out">
<div className="stack-3">
    {error && (needsProfileConfirm(error)
      ? <ProfileConfirmNotice opportunityId={opportunityId} onConfirmed={() => setError(undefined)} />
      : <ErrorNotice error={error} />)}{message && <p className="notice notice-success">{message} <Link to="/outreach">Open outreach</Link></p>}
    <ReachPlanner o={o} onError={setError} />
    <button type="button" className="btn btn-ghost btn-sm" aria-expanded={adv} onClick={() => setAdv(!adv)}>{adv ? 'Hide advanced' : 'Write to someone else, or add a follow-up'}</button>
    {adv && <>
    <label className="field"><span>Draft channel</span><select value={channel} onChange={(e) => { const next = e.target.value as DraftChannel; setChannel(next); if (next === 'ContactForm' && !recipient) setRecipient(o.applyUrl ?? o.url ?? '') }}>{CHANNELS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
    <label className="field"><span>{TO[channel].label}</span><input value={recipient} onChange={(e) => setRecipient(e.target.value)} maxLength={320} placeholder={TO[channel].placeholder} /></label>
    {channel === 'Email' && <ContactFinder opportunityId={opportunityId} onUse={setRecipient} />}
    <button className="btn btn-primary btn-sm" type="button" disabled={busy} onClick={createDraft}>{busy ? 'Writing…' : TO[channel].button}</button>
    {draftError && <div ref={(el) => el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })}>
      {needsProfileConfirm(draftError)
        ? <ProfileConfirmNotice opportunityId={opportunityId} onConfirmed={() => { setDraftError(undefined); void createDraft() }} />
        : <ErrorNotice error={draftError} />}
    </div>}
    <p className="muted-small">Opens the message to check; Approve &amp; send then opens {channel === 'Email' ? 'Gmail (or your mail app) — add the address there if it is empty' : channel === 'LinkedInMessage' ? 'LinkedIn on that person, text copied' : 'the contact page, text copied'}.</p>
    <hr />
    <label className="field"><span>Next action</span><select value={kind} onChange={(e) => setKind(e.target.value as NextActionKind)}><option value="FollowUp">Follow up</option><option value="CheckStatus">Check status</option><option value="Call">Call</option><option value="Other">Other</option></select></label>
    <label className="field"><span>Due</span><input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} /></label>
    <label className="field"><span>Note</span><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></label>
    <button className="btn btn-secondary btn-sm" type="button" disabled={busy || !dueAt} onClick={createAction}>Add next action</button>
    </>}
  </div>
</Card>
}
