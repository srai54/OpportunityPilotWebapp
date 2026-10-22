import { useState, type FormEvent } from 'react'
import { ErrorNotice } from '../../components/ErrorNotice'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState, LoadingState } from '../../components/States'
import { SampleDataButton } from '../sample/SampleDataButton'
import { Badge } from '../../components/StatusBadge'
import { CallButton } from '../../components/CallButton'
import { KpiBand, KpiCard } from '../../components/kpi/kpi'
import { api } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { ProgressShare } from '../progress/ProgressShare'
import { ResumeTailorPanel } from '../resume/ResumeTailorPanel'
import { CANDIDATE_FIELDS, money } from './staffingModel'
import { latestDealFor } from '../calls/scheduleModel'
import type { Availability, CandidateField, Consent, InterviewBoardRow, RateUnit, StaffingCandidate } from './staffingTypes'

export function StaffingCandidatesPage() {
  const list = useApi<StaffingCandidate[]>('/api/v1/staffing/candidates')
  // Which deal a call is about (the candidate's latest interview), so "After the call" can save it there.
  const board = useApi<InterviewBoardRow[]>('/api/v1/staffing/interviews?take=500')
  const [editing, setEditing] = useState<StaffingCandidate | 'new' | null>(null)
  const [consentFor, setConsentFor] = useState<StaffingCandidate | null>(null)
  const [sharing, setSharing] = useState<StaffingCandidate | null>(null)
  const [fitFor, setFitFor] = useState<StaffingCandidate | null>(null)

  return <div className="page page-wide stack-4">
    <PageHeader title="Candidates" subtitle="Your bench. Submitted only with consent."
      actions={<button className="btn btn-primary" type="button" onClick={() => setEditing('new')}>+ Add candidate</button>} />
    {editing && <CandidateForm key={editing === 'new' ? 'new' : editing.id} candidate={editing === 'new' ? null : editing}
      onDone={() => { setEditing(null); list.reload() }} />}
    {fitFor && <div className="stack-2"><div className="row"><span className="grow" /><button className="btn btn-secondary btn-sm" type="button" onClick={() => setFitFor(null)}>Close</button></div><ResumeTailorPanel key={fitFor.id} editableJob jobTitle="" jobText="" candidate={{ name: fitFor.name, email: fitFor.email }} /></div>}
    {sharing && <ProgressShare key={sharing.id} candidate={sharing} onClose={() => setSharing(null)} />}
    {consentFor && <ConsentForm key={consentFor.id} candidate={consentFor} onDone={() => { setConsentFor(null); list.reload() }} />}

    {list.data && list.data.length > 0 && <KpiBand label="Bench">
      <KpiCard icon="people" tone="blue" label="On the bench" value={list.data.length} sub="candidates" />
      <KpiCard icon="check" tone="green" label="Available now" value={list.data.filter((c) => c.availability === 'Immediate').length} sub="can start" />
      <KpiCard icon="check" tone="teal" label="Consent given" value={list.data.filter((c) => c.consent === 'Granted').length} sub="may be submitted" />
      <KpiCard icon="calendar" tone="amber" label="Need consent" value={list.data.filter((c) => c.consent !== 'Granted').length} sub="ask before submitting" />
    </KpiBand>}

    <section className="panel">
      {list.error ? <ErrorNotice error={list.error} onRetry={list.reload} what="candidates" />
        : !list.data ? <LoadingState label="Loading candidates…" waking={list.waking} />
        : list.data.length === 0 ? <EmptyState title="No candidates yet" actions={<SampleDataButton workspace="Sales" onLoaded={list.reload} />}>Add the people you can place, then record what each agreed to share.</EmptyState>
        : <div className="table-scroll"><table className="table">
          <thead><tr><th>Candidate</th><th>Availability</th><th className="num">Rate</th><th>Consent</th><th>May be shared</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>{list.data.map((c) => <tr key={c.id}>
            <td><strong>{c.name}</strong><div className="muted-small">{[c.headline, c.location, c.yearsExperience != null ? `${c.yearsExperience} yrs` : null].filter(Boolean).join(' · ')}</div></td>
            <td>{c.availability === 'NoticePeriod' ? `${c.noticePeriodDays ?? '?'} days' notice` : c.availability === 'NotAvailable' ? 'Not available' : c.availability}</td>
            <td className="num op-numeric">{c.rateAmount != null ? `${money(c.rateAmount, c.rateCurrency)} / ${c.rateUnit?.toLowerCase()}` : '—'}</td>
            <td><Badge tone={c.consent === 'Granted' ? 'success' : c.consent === 'Withdrawn' ? 'danger' : 'warning'}>{c.consent}</Badge>
              {c.consentEvidence && <div className="muted-small">{c.consentEvidence}</div>}</td>
            <td className="small">{c.shareableFields.length ? c.shareableFields.join(', ') : '—'}</td>
            <td className="row"><CallButton phone={c.phone} who={c.name} entityType="candidate" entityId={c.id} context={latestDealFor(c.id, board.data ?? [])} />
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => setEditing(c)}>Edit</button>
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => setConsentFor(c)}>Consent</button>
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => setSharing(c)}>Share progress</button>
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => setFitFor(c)}>Resume fit</button></td>
          </tr>)}</tbody>
        </table></div>}
    </section>
  </div>
}

function CandidateForm({ candidate, onDone }: { candidate: StaffingCandidate | null; onDone: () => void }) {
  const c = candidate
  const [name, setName] = useState(c?.name ?? '')
  const [headline, setHeadline] = useState(c?.headline ?? '')
  const [email, setEmail] = useState(c?.email ?? '')
  const [phone, setPhone] = useState(c?.phone ?? '')
  const [location, setLocation] = useState(c?.location ?? '')
  const [skills, setSkills] = useState(c?.skills ?? '')
  const [years, setYears] = useState(c?.yearsExperience?.toString() ?? '')
  const [availability, setAvailability] = useState<Availability>(c?.availability ?? 'Unknown')
  const [notice, setNotice] = useState(c?.noticePeriodDays?.toString() ?? '')
  const [rate, setRate] = useState(c?.rateAmount?.toString() ?? '')
  const [currency, setCurrency] = useState(c?.rateCurrency ?? 'USD')
  const [unit, setUnit] = useState<RateUnit>(c?.rateUnit ?? 'Hour')
  const [resume, setResume] = useState('')
  const [notify, setNotify] = useState(c?.notifyByEmail ?? false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Error>()

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(undefined)
    try {
      await api(c ? `/api/v1/staffing/candidates/${c.id}` : '/api/v1/staffing/candidates', {
        method: c ? 'PUT' : 'POST',
        body: JSON.stringify({
          name, headline: headline || null, email: email || null, phone: phone || null, location: location || null, skills: skills || null,
          yearsExperience: years ? Number(years) : null, availability, noticePeriodDays: notice ? Number(notice) : null,
          rateAmount: rate ? Number(rate) : null, rateCurrency: rate ? currency : null, rateUnit: rate ? unit : null,
          // Left out when editing without a new paste, so the stored resume is kept.
          resumeText: resume || undefined, notifyByEmail: notify, expectedVersion: c?.version ?? null,
        }),
      })
      onDone()
    } catch (err) { setError(err as Error) } finally { setBusy(false) }
  }

  return <form className="panel" onSubmit={(e) => void submit(e)}>
    <header className="panel-head"><h3 className="eyebrow">{c ? `Edit ${c.name}` : 'New candidate'}</h3><span className="grow" /><button className="btn btn-secondary btn-sm" type="button" onClick={onDone}>Close</button></header>
    <div className="panel-body filters">
      <label className="field"><span>Name</span><input required value={name} maxLength={200} onChange={(e) => setName(e.target.value)} /></label>
      <label className="field field-wide"><span>Headline</span><input value={headline} maxLength={300} onChange={(e) => setHeadline(e.target.value)} placeholder="Senior .NET engineer" /></label>
      <label className="field"><span>Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label className="field"><span>Phone</span><input value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
      <label className="field"><span>Location</span><input value={location} onChange={(e) => setLocation(e.target.value)} /></label>
      <label className="field field-wide"><span>Skills</span><input value={skills} maxLength={2000} onChange={(e) => setSkills(e.target.value)} placeholder="C#, Azure, SQL" /></label>
      <label className="field"><span>Years of experience</span><input type="number" min={0} max={60} step="0.5" value={years} onChange={(e) => setYears(e.target.value)} /></label>
      <label className="field"><span>Availability</span><select value={availability} onChange={(e) => setAvailability(e.target.value as Availability)}>
        <option value="Unknown">Unknown</option><option value="Immediate">Immediate</option><option value="NoticePeriod">Notice period</option><option value="NotAvailable">Not available</option></select></label>
      {availability === 'NoticePeriod' && <label className="field"><span>Notice (days)</span><input type="number" min={0} max={365} value={notice} onChange={(e) => setNotice(e.target.value)} /></label>}
      <label className="field"><span>Rate</span><input type="number" min={0} step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} /></label>
      <label className="field"><span>Currency</span><input value={currency} maxLength={3} onChange={(e) => setCurrency(e.target.value.toUpperCase())} /></label>
      <label className="field"><span>Per</span><select value={unit} onChange={(e) => setUnit(e.target.value as RateUnit)}><option>Hour</option><option>Day</option><option>Month</option><option>Year</option></select></label>
      <label className="field field-wide"><span>Resume text {c?.hasResume ? `(stored v${c.resumeVersion}; paste to replace)` : ''}</span><textarea rows={4} maxLength={20000} value={resume} onChange={(e) => setResume(e.target.value)} /></label>
      <label className="check"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> Prefers interview updates by email</label>
    </div>
    {error && <ErrorNotice error={error} />}
    <div className="panel-foot"><button className="btn btn-primary" type="submit" disabled={busy || !name.trim()}>{busy ? 'Saving…' : 'Save candidate'}</button>
      {c && <span className="muted-small">Changing details sends draft submissions back for a refresh before approval.</span>}</div>
  </form>
}

function ConsentForm({ candidate, onDone }: { candidate: StaffingCandidate; onDone: () => void }) {
  const [consent, setConsent] = useState<Consent>(candidate.consent === 'Pending' ? 'Granted' : candidate.consent)
  const [fields, setFields] = useState<CandidateField[]>(candidate.shareableFields)
  const [evidence, setEvidence] = useState(candidate.consentEvidence ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Error>()
  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(undefined)
    try {
      await api(`/api/v1/staffing/candidates/${candidate.id}/consent`, {
        method: 'POST', body: JSON.stringify({ consent, shareableFields: consent === 'Granted' ? fields : [], evidence: evidence || null, expectedVersion: candidate.version }),
      })
      onDone()
    } catch (err) { setError(err as Error) } finally { setBusy(false) }
  }
  return <form className="panel" onSubmit={(e) => void submit(e)}>
    <header className="panel-head"><h3 className="eyebrow">Consent — {candidate.name}</h3><span className="grow" /><button className="btn btn-secondary btn-sm" type="button" onClick={onDone}>Close</button></header>
    <div className="panel-body stack-3">
      <div className="row wrap">{(['Granted', 'Pending', 'Withdrawn'] as Consent[]).map((v) =>
        <label key={v} className="check"><input type="radio" name="consent" checked={consent === v} onChange={() => setConsent(v)} /> {v === 'Granted' ? 'Agreed to be shared' : v === 'Pending' ? 'Not asked yet' : 'Withdrew consent'}</label>)}</div>
      {consent === 'Granted' && <>
        <fieldset className="row wrap"><legend className="muted-small">What they agreed to share with clients</legend>
          {CANDIDATE_FIELDS.map((f) => <label key={f.field} className="check"><input type="checkbox" checked={fields.includes(f.field)}
            onChange={() => setFields((cur) => cur.includes(f.field) ? cur.filter((x) => x !== f.field) : [...cur, f.field])} /> {f.label}</label>)}
        </fieldset>
        <label className="field field-wide"><span>How they agreed</span><input required value={evidence} maxLength={1000} onChange={(e) => setEvidence(e.target.value)} placeholder="Email reply on 8 Oct; call note…" /></label>
      </>}
      {consent === 'Withdrawn' && <p className="notice notice-warning">Withdrawing clears every shareable field. Submissions not yet approved cannot be approved.</p>}
    </div>
    {error && <ErrorNotice error={error} />}
    <div className="panel-foot"><button className="btn btn-primary" type="submit" disabled={busy || (consent === 'Granted' && (!evidence.trim() || fields.length === 0))}>Record consent</button></div>
  </form>
}
