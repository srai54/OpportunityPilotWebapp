import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../../components/StatusBadge'
import { CallButton } from '../../components/CallButton'
import { displayPhone, findPhone } from '../../lib/phone'
import { useApi } from '../../lib/useApi'
import { CANDIDATE_FIELDS, inZone, money, submittableFields, zonedToUtc } from './staffingModel'
import type {
  CandidateField, DealWork, FeedbackDecision, FeedbackSource, HandoffChannel, InterviewMode, Offer, RateCard, RateUnit,
  StaffingCandidate, Submission,
} from './staffingTypes'

type Act = <T>(path: string, method: string, body: unknown) => Promise<T | undefined>
type PanelProps = { base: string; work: DealWork; busy: boolean; act: Act }

/** Asks for the handoff channel and the receipt (message id, portal reference) the user got when they sent it themselves. */
function HandoffForm({ busy, label, onSend }: { busy: boolean; label: string; onSend: (channel: HandoffChannel, receipt: string) => void }) {
  const [channel, setChannel] = useState<HandoffChannel>('Email')
  const [receipt, setReceipt] = useState('')
  return <form className="row wrap" onSubmit={(e) => { e.preventDefault(); if (receipt.trim()) onSend(channel, receipt.trim()) }}>
    <select aria-label="Sent by" value={channel} onChange={(e) => setChannel(e.target.value as HandoffChannel)}>
      <option value="Email">Email</option><option value="ClientPortal">Client portal</option><option value="Manual">Other (manual)</option>
    </select>
    <input className="grow" aria-label="Receipt" value={receipt} maxLength={1000} onChange={(e) => setReceipt(e.target.value)} placeholder="Receipt: sent-mail subject/id, portal ref…" />
    <button className="btn btn-primary btn-sm" type="submit" disabled={busy || !receipt.trim()}>{label}</button>
  </form>
}

export function SubmissionsPanel({ base, work, busy, act }: PanelProps) {
  const candidates = useApi<StaffingCandidate[]>('/api/v1/staffing/candidates')
  const [candidateId, setCandidateId] = useState('')
  const [fields, setFields] = useState<CandidateField[]>([])
  const [note, setNote] = useState('')
  const chosen = candidates.data?.find((c) => c.id === candidateId)
  const allowed = chosen ? submittableFields(chosen) : []

  function toggle(f: CandidateField) { setFields((cur) => cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]) }

  return <section className="panel">
    <header className="panel-head"><h3 className="eyebrow">Candidate submissions</h3><span className="grow" />
      <span className="muted-small">Only fields the candidate allowed can be shared; the approved snapshot is exactly what the client gets.</span></header>
    <div className="panel-body stack-3">
      {work.submissions.length === 0 && <p className="muted-small">No candidates submitted yet.</p>}
      {work.submissions.map((s) => <SubmissionCard key={s.id} s={s} base={base} busy={busy} act={act} />)}

      <form className="stack-2 subtle-box" onSubmit={(e) => {
        e.preventDefault()
        void act(`${base}/submissions`, 'POST', { candidateId, sharedFields: fields.filter((f) => allowed.includes(f)), note: note.trim() || null })
          .then((r) => { if (r) { setCandidateId(''); setFields([]); setNote('') } })
      }}>
        <div className="row wrap">
          <label className="field"><span>Submit a candidate</span>
            <select value={candidateId} onChange={(e) => { setCandidateId(e.target.value); setFields([]) }}>
              <option value="">Choose…</option>
              {(candidates.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}{c.consent !== 'Granted' ? ' (no consent)' : ''}</option>)}
            </select>
          </label>
          <Link className="btn-link" to="/staffing/candidates">Manage candidates</Link>
        </div>
        {chosen && (allowed.length === 0
          ? <p className="notice notice-warning">{chosen.name} has not given consent to be shared. Record their consent on the Candidates page first.</p>
          : <fieldset className="row wrap"><legend className="muted-small">Fields to share (allowed by the candidate)</legend>
            {CANDIDATE_FIELDS.filter((f) => allowed.includes(f.field)).map((f) =>
              <label key={f.field} className="check"><input type="checkbox" checked={fields.includes(f.field)} onChange={() => toggle(f.field)} /> {f.label}</label>)}
          </fieldset>)}
        {chosen && allowed.length > 0 && <>
          <input value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} placeholder="Note to the client (optional)" aria-label="Note to the client" />
          <div><button className="btn btn-primary btn-sm" type="submit" disabled={busy || fields.length === 0}>Save draft submission</button></div>
        </>}
      </form>
    </div>
  </section>
}

function SubmissionCard({ s, base, busy, act }: { s: Submission; base: string; busy: boolean; act: Act }) {
  const url = `${base}/submissions/${s.id}`
  return <article className="card stack-2">
    <div className="row wrap"><strong>{s.candidateName}</strong>
      <Badge tone={s.state === 'Sent' ? 'success' : s.state === 'Approved' ? 'primary' : 'neutral'}>{s.state}</Badge>
      {s.candidateChangedSince && s.state === 'Draft' && <Badge tone="warning">Candidate changed — save again to refresh</Badge>}
      <span className="grow" />
      {s.state !== 'Withdrawn' && s.state !== 'Sent' && <button className="btn btn-secondary btn-sm" type="button" disabled={busy} onClick={() => void act(`${url}/withdraw`, 'POST', {})}>Withdraw</button>}
    </div>
    <dl className="criteria-list criteria-row">{Object.entries(s.snapshot).map(([k, v]) =>
      <div key={k}><dt>{k}</dt><dd className="pre-wrap">{k === 'resume' && v ? `${v.slice(0, 300)}${v.length > 300 ? '…' : ''}` : v ?? '—'}</dd></div>)}</dl>
    {s.note && <p className="muted-small">Note: {s.note}</p>}
    {s.state === 'Draft' && <div><button className="btn btn-primary btn-sm" type="button" disabled={busy} onClick={() => void act(`${url}/approve`, 'POST', { expectedVersion: s.version })}>Approve exactly this</button></div>}
    {s.state === 'Approved' && <>
      <p className="muted-small">Approved. Send it to the client yourself, then record how and the receipt — OpportunityPilot does not send it.</p>
      <HandoffForm busy={busy} label="Record as sent" onSend={(channel, receipt) => void act(`${url}/sent`, 'POST', { expectedVersion: s.version, channel, receipt })} />
    </>}
    {s.state === 'Sent' && <p className="muted-small">Sent {s.sentAt ? new Date(s.sentAt).toLocaleString() : ''} by {s.channel}: {s.receipt}</p>}
  </article>
}

/** `onSchedule` opens the full "Schedule interview" form (null = a new round); without it the inline form is shown as before. */
export function InterviewsPanel({ base, work, busy, act, onSchedule }: PanelProps & { onSchedule?: (interviewId: string | null) => void }) {
  const sent = work.submissions.filter((s) => s.state === 'Sent')
  const name = (id: string) => work.submissions.find((s) => s.id === id)?.candidateName ?? 'Candidate'
  const candidates = useApi<StaffingCandidate[]>('/api/v1/staffing/candidates')
  /** Phone mode: the number written with the interview, else the candidate's own number. */
  const phoneFor = (submissionId: string, location: string | null) => {
    const candidateId = work.submissions.find((s) => s.id === submissionId)?.candidateId
    return findPhone(location) || candidates.data?.find((c) => c.id === candidateId)?.phone || ''
  }
  const dealId = base.split('/').pop() ?? ''
  const [feedbackFor, setFeedbackFor] = useState<{ submissionId: string; interviewId: string | null } | null>(null)
  return <section className="panel">
    <header className="panel-head"><h3 className="eyebrow">Interviews and feedback</h3>{onSchedule && sent.length > 0 && <><span className="grow" />
      <button type="button" className="btn btn-primary btn-sm" onClick={() => onSchedule(null)}>+ Schedule interview</button></>}</header>
    <div className="panel-body stack-3">
      {sent.length === 0 ? <p className="muted-small">Interviews follow a submission that was sent to the client.</p>
        : <div className="row wrap">{sent.map((s) => <button key={s.id} type="button" className="btn btn-secondary btn-sm" disabled={busy}
          onClick={() => void act(`${base}/interviews`, 'POST', { submissionId: s.id })}>+ Interview round for {s.candidateName}</button>)}</div>}
      {work.interviews.map((i) => <article key={i.id} className="card stack-2">
        <div className="row wrap"><strong>{name(i.submissionId)} · round {i.round}</strong><Badge tone={i.state === 'Completed' ? 'success' : i.state === 'Scheduled' ? 'primary' : 'neutral'}>{i.state}</Badge>
          {i.state === 'Scheduled' && <Badge tone={i.candidateNotification === 'NotNotified' ? 'warning' : 'success'}>{i.candidateNotification === 'NotNotified' ? 'Candidate not told yet' : 'Candidate told'}</Badge>}
        </div>
        {i.scheduledAt && <p className="small">{inZone(i.scheduledAt, i.timeZone)} · {i.durationMinutes} min · {i.mode}{i.location ? ` · ${i.location}` : ''}</p>}
        {i.mode === 'Phone' && (i.state === 'Requested' || i.state === 'Scheduled') && phoneFor(i.submissionId, i.location) && <div className="row wrap">
          <span className="small">Number <strong className="op-numeric">{displayPhone(phoneFor(i.submissionId, i.location))}</strong></span>
          <CallButton phone={phoneFor(i.submissionId, i.location)} who={name(i.submissionId)} entityType="interview" entityId={i.id}
            context={{ dealId, submissionId: i.submissionId, context: `Round ${i.round}` }} />
        </div>}
        {i.candidateNotes && <p className="muted-small">Candidate sees: {i.candidateNotes}</p>}
        {i.internalNotes && <p className="muted-small">Internal only: {i.internalNotes}</p>}
        {(i.state === 'Requested' || i.state === 'Scheduled') && onSchedule && <div><button type="button" className="btn btn-secondary btn-sm" onClick={() => onSchedule(i.id)}>
          {i.state === 'Scheduled' ? 'Reschedule' : 'Schedule'}<span className="sr-only"> round {i.round} for {name(i.submissionId)}</span></button></div>}
        {(i.state === 'Requested' || i.state === 'Scheduled') && !onSchedule && <ScheduleForm busy={busy} onSchedule={(body) => void act(`${base}/interviews/${i.id}/schedule`, 'POST', { ...body, expectedVersion: i.version })} rescheduling={i.state === 'Scheduled'} />}
        <div className="row wrap">
          {i.state === 'Scheduled' && i.candidateNotification === 'NotNotified' &&
            <button className="btn btn-secondary btn-sm" type="button" disabled={busy} onClick={() => void act(`${base}/interviews/${i.id}/notified`, 'POST', { status: 'NotifiedManually', expectedVersion: i.version })}>I told the candidate</button>}
          {i.state === 'Scheduled' && <>
            <button className="btn btn-secondary btn-sm" type="button" disabled={busy} onClick={() => void act(`${base}/interviews/${i.id}/finish`, 'POST', { outcome: 'Completed', expectedVersion: i.version })}>Completed</button>
            <button className="btn btn-secondary btn-sm" type="button" disabled={busy} onClick={() => void act(`${base}/interviews/${i.id}/finish`, 'POST', { outcome: 'NoShow', expectedVersion: i.version })}>No-show</button>
          </>}
          {(i.state === 'Requested' || i.state === 'Scheduled') &&
            <button className="btn btn-secondary btn-sm" type="button" disabled={busy} onClick={() => void act(`${base}/interviews/${i.id}/finish`, 'POST', { outcome: 'Cancelled', expectedVersion: i.version })}>Cancel</button>}
          <button className="btn btn-link btn-sm" type="button" onClick={() => setFeedbackFor({ submissionId: i.submissionId, interviewId: i.id })}>Record feedback</button>
        </div>
      </article>)}
      {sent.length > 0 && !feedbackFor && <div><button className="btn btn-link btn-sm" type="button" onClick={() => setFeedbackFor({ submissionId: sent[0].id, interviewId: null })}>Record feedback on a submission</button></div>}
      {feedbackFor && <FeedbackForm busy={busy} submissions={sent} initial={feedbackFor} onCancel={() => setFeedbackFor(null)}
        onSave={(body) => void act(`${base}/feedback`, 'POST', body).then((r) => { if (r) setFeedbackFor(null) })} />}
      {work.feedback.length > 0 && <ul className="activity-list">{work.feedback.map((f) =>
        <li key={f.id}><Badge>{f.source}</Badge> {f.decision !== 'None' && <Badge tone={f.decision === 'Selected' ? 'success' : f.decision === 'Rejected' ? 'danger' : 'neutral'}>{f.decision}</Badge>}{' '}
          {name(f.submissionId)}: {f.detail} <span className="muted-small">{f.sharedWithCandidate ? '· shared with the candidate' : '· not shared'} · {new Date(f.recordedAt).toLocaleDateString()}</span></li>)}</ul>}
    </div>
  </section>
}

function ScheduleForm({ busy, rescheduling, onSchedule }: { busy: boolean; rescheduling: boolean; onSchedule: (body: object) => void }) {
  const [local, setLocal] = useState('')
  const [zone, setZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
  const [duration, setDuration] = useState('45')
  const [mode, setMode] = useState<InterviewMode>('Video')
  const [location, setLocation] = useState('')
  const [candidateNotes, setCandidateNotes] = useState('')
  const [internalNotes, setInternalNotes] = useState('')
  const utc = local ? zonedToUtc(local, zone) : null
  return <form className="filters subtle-box" onSubmit={(e) => {
    e.preventDefault()
    if (utc) onSchedule({ scheduledAt: utc, timeZone: zone, durationMinutes: Number(duration), mode, location: location || null, candidateNotes: candidateNotes || null, internalNotes: internalNotes || null })
  }}>
    <label className="field"><span>Date and time</span><input type="datetime-local" value={local} onChange={(e) => setLocal(e.target.value)} required /></label>
    <label className="field"><span>Time zone</span><input value={zone} onChange={(e) => setZone(e.target.value)} placeholder="Asia/Kolkata" /></label>
    <label className="field"><span>Minutes</span><input type="number" min={5} max={600} value={duration} onChange={(e) => setDuration(e.target.value)} /></label>
    <label className="field"><span>Mode</span><select value={mode} onChange={(e) => setMode(e.target.value as InterviewMode)}><option>Video</option><option>Phone</option><option>Onsite</option></select></label>
    <label className="field field-wide"><span>Link or address</span><input value={location} maxLength={1000} onChange={(e) => setLocation(e.target.value)} /></label>
    <label className="field field-wide"><span>Notes the candidate may see</span><input value={candidateNotes} maxLength={2000} onChange={(e) => setCandidateNotes(e.target.value)} /></label>
    <label className="field field-wide"><span>Internal notes</span><input value={internalNotes} maxLength={2000} onChange={(e) => setInternalNotes(e.target.value)} /></label>
    <div className="field"><button className="btn btn-primary btn-sm" type="submit" disabled={busy || !utc}>{rescheduling ? 'Reschedule' : 'Schedule'}</button>
      {local && !utc && <small className="text-danger">Unknown time zone.</small>}</div>
  </form>
}

function FeedbackForm({ busy, submissions, initial, onSave, onCancel }: {
  busy: boolean; submissions: Submission[]; initial: { submissionId: string; interviewId: string | null }; onSave: (body: object) => void; onCancel: () => void
}) {
  const [submissionId, setSubmissionId] = useState(initial.submissionId)
  const [source, setSource] = useState<FeedbackSource>('Client')
  const [decision, setDecision] = useState<FeedbackDecision>('None')
  const [detail, setDetail] = useState('')
  const [shared, setShared] = useState(false)
  return <form className="filters subtle-box" onSubmit={(e) => { e.preventDefault(); onSave({ submissionId, interviewId: initial.interviewId, source, decision, detail, sharedWithCandidate: source !== 'Internal' && shared }) }}>
    <label className="field"><span>Candidate</span><select value={submissionId} onChange={(e) => setSubmissionId(e.target.value)}>{submissions.map((s) => <option key={s.id} value={s.id}>{s.candidateName}</option>)}</select></label>
    <label className="field"><span>From</span><select value={source} onChange={(e) => setSource(e.target.value as FeedbackSource)}><option>Client</option><option>Candidate</option><option value="Internal">Internal note</option></select></label>
    <label className="field"><span>Decision</span><select value={decision} onChange={(e) => setDecision(e.target.value as FeedbackDecision)}>
      <option value="None">No decision</option><option value="NextRound">Next round</option><option>Selected</option><option>Rejected</option><option value="OnHold">On hold</option></select></label>
    <label className="field field-wide"><span>Feedback</span><textarea required rows={3} maxLength={4000} value={detail} onChange={(e) => setDetail(e.target.value)} /></label>
    {source !== 'Internal' && <label className="check"><input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} /> The candidate may see this</label>}
    <div className="row"><button className="btn btn-primary btn-sm" type="submit" disabled={busy || !detail.trim()}>Save feedback</button><button className="btn btn-secondary btn-sm" type="button" onClick={onCancel}>Cancel</button></div>
  </form>
}

export function OffersPanel({ base, work, busy, act }: PanelProps) {
  const sent = work.submissions.filter((s) => s.state === 'Sent')
  const name = (id: string) => work.submissions.find((s) => s.id === id)?.candidateName ?? 'Candidate'
  const [creatingFor, setCreatingFor] = useState('')
  return <section className="panel">
    <header className="panel-head"><h3 className="eyebrow">Offers, contracts and placement</h3></header>
    <div className="panel-body stack-3">
      {work.offers.map((o) => <OfferCard key={o.id} o={o} name={name(o.submissionId)} base={base} busy={busy} act={act} />)}
      {sent.length === 0 ? <p className="muted-small">An offer follows a submission that was sent to the client.</p>
        : <div className="row wrap">
          <select aria-label="Offer for" value={creatingFor} onChange={(e) => setCreatingFor(e.target.value)}>
            <option value="">New offer for…</option>{sent.map((s) => <option key={s.id} value={s.id}>{s.candidateName}</option>)}
          </select>
          {creatingFor && <OfferTerms busy={busy} onSave={(t) => void act(`${base}/offers`, 'POST', { submissionId: creatingFor, ...t }).then((r) => { if (r) setCreatingFor('') })} />}
        </div>}
    </div>
  </section>
}

function OfferTerms({ busy, initial, onSave }: { busy: boolean; initial?: Offer; onSave: (terms: object) => void }) {
  const [clientRate, setClientRate] = useState(initial?.clientRate?.toString() ?? '')
  const [pay, setPay] = useState(initial?.candidatePay?.toString() ?? '')
  const [currency, setCurrency] = useState(initial?.currency ?? 'USD')
  const [unit, setUnit] = useState<RateUnit>(initial?.unit ?? 'Hour')
  const [start, setStart] = useState(initial?.startDate ?? '')
  const [value, setValue] = useState(initial?.placementValue?.toString() ?? '')
  const num = (v: string) => (v === '' ? null : Number(v))
  return <form className="filters subtle-box" onSubmit={(e) => {
    e.preventDefault()
    onSave({ clientRate: num(clientRate), candidatePay: num(pay), currency, unit, startDate: start || null, placementValue: num(value), notes: initial?.notes ?? null })
  }}>
    <label className="field"><span>Client rate</span><input type="number" min={0} step="0.01" value={clientRate} onChange={(e) => setClientRate(e.target.value)} /></label>
    <label className="field"><span>Candidate pay</span><input type="number" min={0} step="0.01" value={pay} onChange={(e) => setPay(e.target.value)} /></label>
    <label className="field"><span>Currency</span><input value={currency} maxLength={3} onChange={(e) => setCurrency(e.target.value.toUpperCase())} /></label>
    <label className="field"><span>Per</span><select value={unit} onChange={(e) => setUnit(e.target.value as RateUnit)}><option>Hour</option><option>Day</option><option>Month</option><option>Year</option></select></label>
    <label className="field"><span>Start date</span><input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
    <label className="field"><span>Placement value</span><input type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} /></label>
    <div className="field"><button className="btn btn-primary btn-sm" type="submit" disabled={busy}>Save terms</button></div>
  </form>
}

function OfferCard({ o, name, base, busy, act }: { o: Offer; name: string; base: string; busy: boolean; act: Act }) {
  const url = `${base}/offers/${o.id}`
  const [contractVersion, setContractVersion] = useState(o.contractVersion ?? '')
  const [provider, setProvider] = useState(o.signatureProvider ?? '')
  const [docRef, setDocRef] = useState('')
  const move = (state: string) => void act(`${url}/state`, 'POST', { state, expectedVersion: o.version })
  return <article className="card stack-2">
    <div className="row wrap"><strong>{name}</strong><Badge tone={o.state === 'Accepted' ? 'success' : o.state === 'Declined' || o.state === 'Withdrawn' ? 'danger' : 'primary'}>Offer {o.state.toLowerCase()}</Badge>
      <Badge tone={o.contract === 'Signed' ? 'success' : 'neutral'}>Contract {o.contract === 'NotStarted' ? 'not started' : o.contract.toLowerCase()}</Badge>
      {o.outcome !== 'Pending' && <Badge tone={o.outcome === 'Placed' ? 'success' : 'danger'}>{o.outcome === 'Placed' ? 'Placed' : 'Fell through'}</Badge>}</div>
    <p className="small">Client {money(o.clientRate, o.currency)} · candidate {money(o.candidatePay, o.currency)}{o.unit ? ` per ${o.unit.toLowerCase()}` : ''}
      {o.startDate ? ` · starts ${o.startDate}` : ''}{o.placementValue != null ? ` · placement value ${money(o.placementValue, o.currency)}` : ''}</p>
    {(o.state === 'Draft' || o.state === 'Extended') && <OfferTerms busy={busy} initial={o} onSave={(t) => void act(url, 'PUT', { submissionId: o.submissionId, ...t, expectedVersion: o.version })} />}
    <div className="row wrap">
      {o.state === 'Draft' && <button className="btn btn-primary btn-sm" type="button" disabled={busy} onClick={() => move('Extended')}>Mark extended</button>}
      {o.state === 'Extended' && <><button className="btn btn-primary btn-sm" type="button" disabled={busy} onClick={() => move('Accepted')}>Accepted</button>
        <button className="btn btn-secondary btn-sm" type="button" disabled={busy} onClick={() => move('Declined')}>Declined</button></>}
      {(o.state === 'Draft' || o.state === 'Extended') && <button className="btn btn-secondary btn-sm" type="button" disabled={busy} onClick={() => move('Withdrawn')}>Withdraw</button>}
    </div>
    {o.state === 'Accepted' && o.outcome === 'Pending' && <form className="filters subtle-box" onSubmit={(e) => {
      e.preventDefault()
      const status = docRef.trim() ? 'Signed' : 'Sent'
      void act(`${url}/contract`, 'POST', { status, contractVersion: contractVersion || null, signatureProvider: provider || null, signedDocumentReference: docRef.trim() || null, expectedVersion: o.version })
    }}>
      <label className="field"><span>Contract version</span><input value={contractVersion} maxLength={64} onChange={(e) => setContractVersion(e.target.value)} placeholder="MSA-2 / SOW-7" /></label>
      <label className="field"><span>Signature by</span><input value={provider} maxLength={500} onChange={(e) => setProvider(e.target.value)} placeholder="DocuSign, wet ink…" /></label>
      <label className="field field-wide"><span>Signed document reference</span><input value={docRef} maxLength={500} onChange={(e) => setDocRef(e.target.value)} placeholder="Envelope id or private storage key — leave empty if only sent" /><small>Kept private: only “has a signed document” is shown back.</small></label>
      <div className="field"><button className="btn btn-primary btn-sm" type="submit" disabled={busy}>{docRef.trim() ? 'Record signed' : 'Record contract sent'}</button></div>
    </form>}
    {o.contract === 'Signed' && o.outcome === 'Pending' && <div className="row wrap">
      <button className="btn btn-primary btn-sm" type="button" disabled={busy} onClick={() => void act(`${url}/outcome`, 'POST', { outcome: 'Placed', expectedVersion: o.version })}>Candidate started — placed</button>
      <button className="btn btn-secondary btn-sm" type="button" disabled={busy} onClick={() => void act(`${url}/outcome`, 'POST', { outcome: 'FellThrough', expectedVersion: o.version })}>Fell through</button>
    </div>}
  </article>
}

export function ProposalsPanel({ base, work, busy, act }: PanelProps) {
  const cards = useApi<RateCard[]>('/api/v1/staffing/rate-cards')
  const active = (cards.data ?? []).filter((c) => c.status === 'Active')
  const [cardId, setCardId] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  return <section className="panel">
    <header className="panel-head"><h3 className="eyebrow">Commercial proposals</h3><span className="grow" /><Link className="btn-link" to="/staffing/rate-cards">Rate cards</Link></header>
    <div className="panel-body stack-3">
      {work.proposals.map((p) => {
        const url = `${base}/proposals/${p.id}`
        return <article key={p.id} className="card stack-2">
          <div className="row wrap"><strong>{p.title}</strong><Badge tone={p.state === 'Accepted' ? 'success' : p.state === 'Rejected' ? 'danger' : p.state === 'Draft' ? 'neutral' : 'primary'}>{p.state}</Badge>
            <span className="muted-small">from rate card v{p.rateCardVersion}{p.validUntil ? ` · valid until ${p.validUntil}` : ''}</span></div>
          <div className="table-scroll"><table className="table"><thead><tr><th>Role</th><th>Seniority</th><th className="num">Rate</th></tr></thead>
            <tbody>{p.lines.map((l, i) => <tr key={i}><td>{l.role}</td><td>{l.seniority ?? '—'}</td><td className="num op-numeric">{money(l.rate, p.currency)} / {l.unit.toLowerCase()}</td></tr>)}</tbody></table></div>
          {p.terms && <p className="muted-small">Terms: {p.terms}</p>}
          {p.body && <p className="pre-wrap small">{p.body}</p>}
          {p.state === 'Draft' && <div><button className="btn btn-primary btn-sm" type="button" disabled={busy} onClick={() => void act(`${url}/approve`, 'POST', { expectedVersion: p.version })}>Approve exactly this</button></div>}
          {p.state === 'Approved' && <HandoffForm busy={busy} label="Record as sent" onSend={(channel, receipt) => void act(`${url}/sent`, 'POST', { expectedVersion: p.version, channel, receipt })} />}
          {p.state === 'Sent' && <div className="row wrap"><span className="muted-small">Sent: {p.receipt}</span>
            <button className="btn btn-primary btn-sm" type="button" disabled={busy} onClick={() => void act(`${url}/answer`, 'POST', { accepted: true, expectedVersion: p.version })}>Client accepted</button>
            <button className="btn btn-secondary btn-sm" type="button" disabled={busy} onClick={() => void act(`${url}/answer`, 'POST', { accepted: false, expectedVersion: p.version })}>Client rejected</button></div>}
        </article>
      })}
      {active.length === 0 ? <p className="muted-small">Activate a rate card to quote from it.</p>
        : <form className="filters subtle-box" onSubmit={(e) => {
          e.preventDefault()
          void act(`${base}/proposals`, 'POST', { rateCardId: cardId, title: title.trim(), body: body.trim() || null }).then((r) => { if (r) { setTitle(''); setBody('') } })
        }}>
          <label className="field"><span>Rate card</span><select value={cardId} onChange={(e) => setCardId(e.target.value)} required>
            <option value="">Choose…</option>{active.map((c) => <option key={c.id} value={c.id}>{c.name} v{c.cardVersion} ({c.currency})</option>)}</select></label>
          <label className="field field-wide"><span>Title</span><input value={title} maxLength={300} onChange={(e) => setTitle(e.target.value)} placeholder="Proposal for…" /></label>
          <label className="field field-wide"><span>Cover text</span><textarea rows={3} maxLength={20000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Replace any [placeholder] before approving." /></label>
          <div className="field"><button className="btn btn-primary btn-sm" type="submit" disabled={busy || !cardId}>Draft proposal with all card roles</button></div>
        </form>}
    </div>
  </section>
}
