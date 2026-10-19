import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ErrorNotice } from '../../components/ErrorNotice'
import { PageHeader } from '../../components/PageHeader'
import { LoadingState } from '../../components/States'
import { Badge } from '../../components/StatusBadge'
import { ContactCallCard } from '../calls/ContactCallCard'
import { ScheduleInterviewDialog, type ScheduleTarget } from '../calls/ScheduleInterviewDialog'
import { api } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { ConversationPanel } from './ConversationPanel'
import { InterviewsPanel, OffersPanel, ProposalsPanel, SubmissionsPanel } from './DealWorkPanels'
import { isClosed, money, nextStages, SOURCE_LABELS, STAGE_LABELS, stageProgress } from './staffingModel'
import type { DealWork, StaffingAccount, StaffingDeal } from './staffingTypes'

export function StaffingDealPage() {
  const { id = '' } = useParams()
  const deal = useApi<StaffingDeal>(`/api/v1/staffing/deals/${id}`)
  const work = useApi<DealWork>(`/api/v1/staffing/deals/${id}/work`)
  const accounts = useApi<StaffingAccount[]>('/api/v1/staffing/accounts?take=200')
  const [error, setError] = useState<Error>()
  const [busy, setBusy] = useState(false)
  const [scheduling, setScheduling] = useState<ScheduleTarget | null>(null)

  if (deal.error) return <div className="page"><ErrorNotice error={deal.error} onRetry={deal.reload} what="the deal" /></div>
  if (!deal.data) return <div className="page"><LoadingState label="Loading deal…" waking={deal.waking} /></div>
  const d = deal.data
  const account = accounts.data?.find((a) => a.id === d.accountId)
  const contact = account?.contacts.find((c) => c.id === d.contactId)

  /** Every write reloads the deal (stage may advance from a recorded step) and its work. */
  async function act<T>(path: string, method: string, body: unknown): Promise<T | undefined> {
    setBusy(true); setError(undefined)
    try {
      const result = await api<T>(path, { method, body: JSON.stringify(body) })
      deal.reload(); work.reload()
      return result
    } catch (e) { setError(e as Error); return undefined } finally { setBusy(false) }
  }
  const base = `/api/v1/staffing/deals/${d.id}`

  return <div className="page page-wide stack-4">
    <PageHeader title={d.title}
      badges={<><Badge tone={d.stage === 'Won' ? 'success' : isClosed(d.stage) ? 'neutral' : 'primary'}>{STAGE_LABELS[d.stage]}</Badge><Badge>{SOURCE_LABELS[d.source]}</Badge></>}
      subtitle={<>{account ? account.name : 'Client'}{contact ? ` · ${contact.name}${contact.title ? `, ${contact.title}` : ''}` : ''} · {money(d.estimatedValue, d.currency)}</>}
      actions={<Link className="btn btn-secondary" to="/staffing">All deals</Link>} />
    {error && <ErrorNotice error={error} onDismiss={() => setError(undefined)} what="that change" />}
    {contact && <ContactCallCard key={`${contact.id}:${contact.version}`} contact={contact} client={account?.name ?? null} dealId={d.id} onSaved={accounts.reload} />}

    <section className="panel">
      <header className="panel-head"><h3 className="eyebrow">Stage</h3><span className="grow" />
        <span className="muted-small stage-hint">Moves one step at a time. Submitting, interviewing, offers and placement also move it when you record them.</span></header>
      <div className="panel-body">
        {(() => { const all = stageProgress(d.stage, d.stageBeforeHold); const at = Math.max(0, all.findIndex((s) => s.state === 'current'))
          return <div className="stage-compact" aria-hidden="true"><span><strong>{STAGE_LABELS[d.stage]}</strong> · stage {at + 1} of {all.length}</span><span className="stage-compact-bar"><i style={{ width: `${Math.round(((at + 1) / all.length) * 100)}%` }} /></span></div> })()}
        <ol className="stage-track" aria-label="Deal stages">
          {stageProgress(d.stage, d.stageBeforeHold).map((s) => <li key={s.stage} className={`stage-${s.state}`} aria-current={s.state === 'current' ? 'step' : undefined}>
            <span className="stage-dot" aria-hidden="true" /><span className="stage-name">{STAGE_LABELS[s.stage]}</span>
          </li>)}
        </ol>
        <div className="row wrap">
        {nextStages(d.stage, d.stageBeforeHold).length === 0
          ? <span className="muted-small">This deal is closed ({STAGE_LABELS[d.stage]}).</span>
          : nextStages(d.stage, d.stageBeforeHold).map((s) =>
            <button key={s} type="button" disabled={busy} className={`btn btn-sm ${s === 'Lost' || s === 'Disqualified' ? 'btn-secondary' : 'btn-primary'}`}
              onClick={() => void act(`${base}/stage`, 'POST', { stage: s, expectedVersion: d.version })}>
              {s === d.stageBeforeHold ? `Resume: ${STAGE_LABELS[s]}` : `→ ${STAGE_LABELS[s]}`}
            </button>)}
        </div>
      </div>
    </section>

    <NextActionForm deal={d} busy={busy} onSave={(body) => act(base, 'PUT', body)} />

    <ConversationPanel base={base} contacts={account?.contacts ?? []} busy={busy} act={act} onChange={() => deal.reload()} />

    {work.error ? <ErrorNotice error={work.error} onRetry={work.reload} what="the deal's candidates and offers" />
      : !work.data ? <LoadingState label="Loading submissions, interviews and offers…" waking={work.waking} />
      : <>
        <SubmissionsPanel base={base} work={work.data} busy={busy} act={act} />
        <InterviewsPanel base={base} work={work.data} busy={busy} act={act}
          onSchedule={(interviewId) => setScheduling({ workspace: 'sales', dealId: d.id, interviewId, title: [account?.name, d.title].filter(Boolean).join(' · '), client: account?.name ?? null })} />
        <OffersPanel base={base} work={work.data} busy={busy} act={act} />
        <ProposalsPanel base={base} work={work.data} busy={busy} act={act} />
      </>}

    {scheduling && <ScheduleInterviewDialog target={scheduling} onClose={() => setScheduling(null)} onDone={() => { setScheduling(null); deal.reload(); work.reload() }} />}

    <ActivityPanel deal={d} busy={busy} onNote={async (detail) => (await act<StaffingDeal>(`${base}/notes`, 'POST', { detail })) !== undefined} />
  </div>
}

function NextActionForm({ deal, busy, onSave }: { deal: StaffingDeal; busy: boolean; onSave: (body: unknown) => Promise<unknown> }) {
  const [nextAction, setNextAction] = useState(deal.nextAction ?? '')
  const [due, setDue] = useState(deal.nextActionAt ? deal.nextActionAt.slice(0, 10) : '')
  const [value, setValue] = useState(deal.estimatedValue?.toString() ?? '')
  const [currency, setCurrency] = useState(deal.currency ?? 'USD')
  function submit(e: FormEvent) {
    e.preventDefault()
    void onSave({
      title: deal.title, externalReference: deal.externalReference, estimatedValue: value ? Number(value) : null, currency: value ? currency : null,
      nextAction: nextAction.trim() || null, nextActionAt: due ? `${due}T09:00:00Z` : null, expectedVersion: deal.version,
    })
  }
  return <form className="panel" onSubmit={submit}>
    <header className="panel-head"><h3 className="eyebrow">Next action and value</h3></header>
    <div className="panel-body filters">
      <label className="field field-wide"><span>Next action</span><input value={nextAction} maxLength={500} onChange={(e) => setNextAction(e.target.value)} /></label>
      <label className="field"><span>Due</span><input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></label>
      <label className="field"><span>Estimated value</span><input type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} /></label>
      <label className="field"><span>Currency</span><input value={currency} maxLength={3} onChange={(e) => setCurrency(e.target.value.toUpperCase())} /></label>
    </div>
    <div className="panel-foot"><button className="btn btn-secondary" type="submit" disabled={busy}>Save</button></div>
  </form>
}

function ActivityPanel({ deal, busy, onNote }: { deal: StaffingDeal; busy: boolean; /** Resolves true when the note was saved; the typed note is only cleared then. */ onNote: (detail: string) => Promise<boolean> }) {
  const [note, setNote] = useState('')
  return <section className="panel">
    <header className="panel-head"><h3 className="eyebrow">Activity</h3><span className="grow" /><span className="muted-small">Kept as a permanent record; notes cannot be edited.</span></header>
    <form className="panel-body row" onSubmit={(e) => { e.preventDefault(); if (note.trim()) void onNote(note.trim()).then((saved) => { if (saved) setNote('') }) }}>
      <input className="grow" value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} placeholder="Add a note (call summary, client ask…)" aria-label="Note" />
      <button className="btn btn-secondary" type="submit" disabled={busy || !note.trim()}>Add note</button>
    </form>
    {deal.activities.length === 0 ? <p className="panel-body muted-small">Nothing recorded yet.</p> : (
    <ol className="deal-timeline" aria-label="Deal history, newest first">{deal.activities.map((a) => (
      <li key={a.id} className={`deal-event is-${activityTone(a.type)}`}>
        <span className="deal-event-dot" aria-hidden="true" />
        <div className="deal-event-card">
          <div className="deal-event-head">
            <Badge tone={activityTone(a.type) === 'stage' ? 'primary' : activityTone(a.type) === 'interview' ? 'warning' : activityTone(a.type) === 'done' ? 'success' : undefined}>{a.type.replace(/([a-z])([A-Z])/g, '$1 $2')}</Badge>
            <time className="muted-small" dateTime={a.occurredAt}>{new Date(a.occurredAt).toLocaleString([], { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</time>
          </div>
          <p className="deal-event-text">{prettyDetail(a.detail)}</p>
        </div>
      </li>))}
    </ol>)}
  </section>
}

/** Groups the activity types so each kind gets its own colour on the timeline. */
function activityTone(type: string): 'stage' | 'interview' | 'done' | 'note' {
  if (/Stage/i.test(type)) return 'stage'
  if (/Interview/i.test(type)) return 'interview'
  if (/Confirmed|Created|Won|Placed|Signed/i.test(type)) return 'done'
  return 'note'
}

/** "RequirementConfirmed → CandidatesSubmitted" reads as "Requirement confirmed → Candidates submitted". */
function prettyDetail(detail: string): string {
  return detail.replace(/\b([A-Z][a-z]+)((?:[A-Z][a-z]+)+)\b/g, (_m, first: string, rest: string) => first + rest.replace(/([A-Z])/g, ' $1').toLowerCase())
}
