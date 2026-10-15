import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, CardList } from '../../components/cards'
import { ErrorNotice } from '../../components/ErrorNotice'
import { KpiBand, KpiCard } from '../../components/kpi/kpi'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState, LoadingState } from '../../components/States'
import { SampleDataButton } from '../sample/SampleDataButton'
import { Badge } from '../../components/StatusBadge'
import { CallButton } from '../../components/CallButton'
import { findPhone } from '../../lib/phone'
import { ScheduleInterviewDialog, type ScheduleTarget } from '../calls/ScheduleInterviewDialog'
import { api } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import {
  boardCounts, plural, progressLabel, SALES_ACTION_LABELS, SALES_STATE, salesActionRequest, salesActions, splitBoard, toldLabel, whenLabel,
  type SalesAction,
} from '../interviews/interviewsModel'
import { ProgressShare } from '../progress/ProgressShare'
import type { InterviewBoardRow, StaffingCandidate } from './staffingTypes'

const PAST_SHOWN = 30

/**
 * Sales → Staffing → Interviews: every interview across candidates and deals in one list. Quick actions use the deal's own interview
 * endpoints, so the deal page, the KPIs and the candidate's progress link all see the same change.
 */
export function StaffingInterviewsPage() {
  const board = useApi<InterviewBoardRow[]>('/api/v1/staffing/interviews?take=500')
  const candidates = useApi<StaffingCandidate[]>('/api/v1/staffing/candidates')
  const [now] = useState(() => new Date())
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<Error>()
  const [said, setSaid] = useState('')
  const [sharing, setSharing] = useState<InterviewBoardRow | null>(null)
  const [allPast, setAllPast] = useState(false)
  const [scheduling, setScheduling] = useState<ScheduleTarget | null>(null)

  const rows = board.data ?? []
  const { upcoming, past } = splitBoard(rows, now)
  const counts = boardCounts(rows, now)

  async function run(row: InterviewBoardRow, action: SalesAction) {
    const { path, body } = salesActionRequest(row, action)
    setBusy(`${row.interview.id}:${action}`); setError(undefined); setSaid('')
    try {
      await api(path, { method: 'POST', body: JSON.stringify(body) })
      setSaid(`${row.candidateName}, round ${row.interview.round}: ${SALES_ACTION_LABELS[action].toLowerCase()}.`)
      board.reload()
    } catch (e) { setError(e as Error) } finally { setBusy(null) }
  }

  const card = (r: InterviewBoardRow) => {
    const i = r.interview
    const state = SALES_STATE[i.state]
    const told = toldLabel(i)
    const actions = salesActions(r, rows)
    return <li key={i.id} className="ccard followup-card" aria-label={`${r.candidateName}, round ${i.round}`}>
      <Avatar name={r.candidateName} />
      <div className="followup-main">
        <span className="followup-title">{r.candidateName} · round {i.round} <Badge tone={state.tone}>{state.text}</Badge>{told && <> <Badge tone={told.tone}>{told.text}</Badge></>}</span>
        <span className="followup-meta">{[r.client, r.dealTitle].filter(Boolean).join(' · ')} · {whenLabel(i.scheduledAt, now)}{i.mode ? ` · ${i.mode}` : ''}</span>
        <span className="followup-note">{progressLabel(r)}</span>
      </div>
      <div className="followup-actions">
        {i.mode === 'Phone' && (i.state === 'Requested' || i.state === 'Scheduled') &&
          <CallButton phone={findPhone(i.location) || candidates.data?.find((c) => c.id === r.candidateId)?.phone} who={r.candidateName}
            entityType="interview" entityId={i.id} context={{ dealId: i.dealId, submissionId: i.submissionId, context: [r.client, r.dealTitle].filter(Boolean).join(' · ') }} />}
        {(i.state === 'Requested' || i.state === 'Scheduled') && <button type="button" className="btn btn-secondary btn-sm" disabled={busy !== null}
          onClick={() => setScheduling({ workspace: 'sales', dealId: i.dealId, interviewId: i.id, title: [r.client, r.dealTitle].filter(Boolean).join(' · '), client: r.client, candidateName: r.candidateName })}>
          {i.state === 'Scheduled' ? 'Reschedule' : 'Schedule'}<span className="sr-only"> {r.candidateName}, round {i.round}</span></button>}
        {actions.map((a) => <button key={a} type="button" className={`btn btn-sm ${a === 'cancel' ? 'btn-ghost' : 'btn-secondary'}`} disabled={busy !== null}
          onClick={() => void run(r, a)}>{SALES_ACTION_LABELS[a]}<span className="sr-only"> for {r.candidateName}, round {i.round}</span></button>)}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSharing(r)}>Share progress<span className="sr-only"> with {r.candidateName}</span></button>
        <Link className="btn btn-ghost btn-sm" to={`/staffing/deals/${i.dealId}`}>Open deal<span className="sr-only"> {r.dealTitle}</span></Link>
      </div>
    </li>
  }

  const shownPast = allPast ? past : past.slice(0, PAST_SHOWN)
  return <div className="page page-wide stack-4">
    <PageHeader title="Interviews" subtitle="Every interview across your deals." />
    <span className="sr-only" role="status" aria-live="polite">{said}</span>
    {error && <ErrorNotice error={error} />}
    {scheduling && <ScheduleInterviewDialog target={scheduling} onClose={() => setScheduling(null)} onDone={() => { setScheduling(null); board.reload() }} />}
    {sharing && <ProgressShare key={sharing.candidateId} candidate={{ id: sharing.candidateId, name: sharing.candidateName, email: sharing.candidateEmail }}
      onClose={() => { setSharing(null); board.reload() }} />}

    {board.error && !board.data ? <ErrorNotice error={board.error} onRetry={board.reload} what="interviews" />
      : !board.data ? <LoadingState label="Loading interviews…" waking={board.waking} stats={4} />
      : rows.length === 0 ? <EmptyState title="No interviews yet"
          actions={<><Link className="btn btn-primary btn-sm" to="/staffing">Open your deals</Link><SampleDataButton workspace="Sales" onLoaded={board.reload} /></>}>
          <p>Ask for an interview on a deal once a submission is sent.</p>
        </EmptyState>
      : <>
        <KpiBand label="Interviews">
          <KpiCard icon="calendar" tone="blue" label="Coming up" value={counts.upcoming} sub="asked for or booked" />
          <KpiCard icon="followUps" tone="teal" label="Next 7 days" value={counts.next7Days} sub="booked this week" />
          <KpiCard icon="alert" tone="amber" label="Not told" value={counts.notTold} sub="candidate does not know yet" />
          <KpiCard icon="check" tone="green" label="Done" value={counts.completed} sub="interviews held" />
        </KpiBand>
        <section className="stack-3" aria-labelledby="iv-next">
          <h2 id="iv-next" className="eyebrow">Coming up · {plural(upcoming.length, 'interview')}</h2>
          {upcoming.length === 0 ? <p className="muted-small">Nothing booked. Ask for the next round on a done interview below.</p>
            : <CardList label="Interviews coming up">{upcoming.map(card)}</CardList>}
        </section>
        {past.length > 0 && <section className="stack-3" aria-labelledby="iv-past">
          <h2 id="iv-past" className="eyebrow">Past · {plural(past.length, 'interview')}</h2>
          <CardList label="Past interviews">{shownPast.map(card)}</CardList>
          {past.length > PAST_SHOWN && !allPast && <div><button type="button" className="btn btn-secondary btn-sm" onClick={() => setAllPast(true)}>Show all {plural(past.length, 'past interview')}</button></div>}
        </section>}
      </>}
  </div>
}
