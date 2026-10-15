import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, Card, CardList } from '../../components/cards'
import { CallButton } from '../../components/CallButton'
import { ErrorNotice } from '../../components/ErrorNotice'
import { Icon } from '../../components/icons'
import { api } from '../../lib/api'
import { findPhone } from '../../lib/phone'
import type { JobInterview, NextAction } from '../../lib/types'
import { useApi } from '../../lib/useApi'
import type { InterviewBoardRow, StaffingCandidate } from '../staffing/staffingTypes'
import { callsToday, nextSoon, snoozeUntil, soonFromBoard, soonFromJobs, startsIn } from './reminderModel'

const SNOOZE_KEY = 'op.snoozedInterviews'
function readSnoozed(): Record<string, number> {
  try { return JSON.parse(sessionStorage.getItem(SNOOZE_KEY) ?? '{}') as Record<string, number> } catch { return {} }
}

/** Overview: "Next interview in N min" (within 2 hours) and today's calls. Shows nothing when there is neither. */
export function TodayCalls({ workspace }: Readonly<{ workspace: 'sales' | 'candidate' }>) {
  const sales = workspace === 'sales'
  const board = useApi<InterviewBoardRow[]>(sales ? '/api/v1/staffing/interviews?take=200' : null)
  const candidates = useApi<StaffingCandidate[]>(sales ? '/api/v1/staffing/candidates' : null)
  const jobs = useApi<JobInterview[]>(sales ? null : '/api/v1/interviews')
  const open = useApi<NextAction[]>('/api/v1/next-actions?state=Open')
  const done = useApi<NextAction[]>('/api/v1/next-actions?state=Done')
  const [now] = useState(() => new Date())
  const [snoozed, setSnoozed] = useState(readSnoozed)
  const [error, setError] = useState<Error>()

  const items = sales
    ? soonFromBoard(board.data ?? [], (id) => candidates.data?.find((c) => c.id === id)?.phone)
    : soonFromJobs(jobs.data ?? [])
  const soon = nextSoon(items, now, snoozed)
  const calls = callsToday(open.data ?? [], done.data ?? [], now)

  function snooze() {
    if (!soon) return
    const next = { ...snoozed, [soon.key]: snoozeUntil(soon.at, now) }
    setSnoozed(next)
    try { sessionStorage.setItem(SNOOZE_KEY, JSON.stringify(next)) } catch { /* kept for this view only */ }
  }
  async function markDone(a: NextAction) {
    setError(undefined)
    try { await api(`/api/v1/next-actions/${a.id}`, { method: 'PATCH', body: JSON.stringify({ state: 'Done' }) }); open.reload(); done.reload() }
    catch (e) { setError(e as Error) }
  }

  if (!soon && calls.total === 0) return null
  return <div className="stack-3">
    {soon && <section className="ccard ccard-signature next-iv" aria-labelledby="next-iv-title">
      <span className="next-iv-icon" aria-hidden="true"><Icon name="followUps" size={22} /></span>
      <div className="next-iv-main">
        <h2 id="next-iv-title" className="next-iv-title">Interview {startsIn(soon.at, now)}</h2>
        <p className="next-iv-detail">{soon.detail}</p>
      </div>
      <div className="next-iv-actions">
        {soon.mode === 'Phone' && <CallButton phone={soon.phone} who={soon.who} entityType={sales ? 'interview' : 'jobInterview'} entityId={soon.key.slice(2)} size="md"
          context={{ dealId: soon.dealId, submissionId: soon.submissionId, opportunityId: soon.opportunityId, context: soon.title }} />}
        {soon.joinUrl && <a className="btn btn-primary" href={soon.joinUrl} target="_blank" rel="noopener noreferrer">Join<span className="sr-only"> {soon.title} (opens in a new tab)</span></a>}
        {!soon.joinUrl && !(soon.mode === 'Phone' && soon.phone) && <Link className="btn btn-primary" to={soon.to}>Open</Link>}
        <button type="button" className="btn btn-secondary" onClick={snooze}>Snooze</button>
      </div>
    </section>}

    {calls.total > 0 && <Card title="Calls today" actions={<span className="muted-small op-numeric">{calls.done} of {calls.total} done</span>}>
      {error && <ErrorNotice error={error} />}
      {calls.todo.length === 0 ? <p className="muted-small">All calls for today are done.</p>
        : <CardList label="Calls to make today">{calls.todo.map((a) => {
          const who = a.organization || a.opportunityTitle
          return <li key={a.id} className="ccard followup-card" aria-label={`Call ${who}`}>
            <Avatar name={who} />
            <div className="followup-main">
              <span className="followup-title">{who}</span>
              <span className="followup-meta">{a.note || a.opportunityTitle}{a.overdue ? ' · overdue' : ''}</span>
            </div>
            <div className="followup-actions">
              {findPhone(a.note) ? <CallButton phone={findPhone(a.note)} who={who} entityType="nextAction" entityId={a.id} iconOnly
                context={{ opportunityId: a.opportunityId, context: a.opportunityTitle }} />
                : <Link className="btn btn-secondary btn-sm" to={`/opportunities/${a.opportunityId}`}>Open<span className="sr-only"> {who}</span></Link>}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => void markDone(a)}>Done<span className="sr-only"> calling {who}</span></button>
            </div>
          </li>
        })}</CardList>}
    </Card>}
  </div>
}
