import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardList } from '../../components/cards'
import { ErrorNotice } from '../../components/ErrorNotice'
import { LoadingState } from '../../components/States'
import type { JobInterview } from '../../lib/types'
import { useApi } from '../../lib/useApi'
import { JobInterviewCard, JobInterviewForm } from './JobInterviewParts'
import { useJobInterviewActions } from './useJobInterviewActions'
import { splitJobInterviews } from './interviewsModel'
import { ScheduleInterviewDialog } from '../calls/ScheduleInterviewDialog'

/** Opportunity page (job leads): the interviews you recorded for this job, and a short form to add the next round. */
export function JobInterviewsCard({ opportunityId }: Readonly<{ opportunityId: string }>) {
  const list = useApi<JobInterview[]>(`/api/v1/interviews?opportunityId=${encodeURIComponent(opportunityId)}`)
  const [now] = useState(() => new Date())
  const [form, setForm] = useState<JobInterview | 'new' | null>(null)
  const [scheduling, setScheduling] = useState(false)
  const actions = useJobInterviewActions(list.reload)
  const rows = list.data ?? []
  const { upcoming, past } = splitJobInterviews(rows, now)

  return <Card title="Interviews" subtitle="Rounds for this job. Only you see them."
    actions={<Link className="btn btn-link btn-sm" to="/interviews">All interviews</Link>}>
    <div className="stack-3">
      <span className="sr-only" role="status" aria-live="polite">{actions.said}</span>
      {actions.error && <ErrorNotice error={actions.error} />}
      {list.error && !list.data ? <ErrorNotice error={list.error} onRetry={list.reload} what="interviews" />
        : !list.data ? <LoadingState label="Loading interviews…" rows={1} />
        : rows.length > 0 && <CardList label="Interviews for this job">{[...upcoming, ...past].map((i) =>
          <JobInterviewCard key={i.id} i={i} now={now} showJob={false} busy={actions.busy} onStatus={actions.setStatus} onEdit={(x) => setForm(x)} onRemove={actions.remove} />)}</CardList>}
      {form ? <JobInterviewForm key={form === 'new' ? 'new' : form.id} opportunityId={opportunityId} editing={form === 'new' ? null : form}
          onCancel={() => setForm(null)} onSaved={() => { setForm(null); list.reload() }} />
        : list.data && <div className="row wrap"><button type="button" className="btn btn-primary btn-sm" onClick={() => setScheduling(true)}>+ Schedule interview</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setForm('new')}>
          {rows.length === 0 ? 'Add an interview' : `Add round ${Math.max(...rows.map((r) => r.round)) + 1}`}</button></div>}
      {scheduling && <ScheduleInterviewDialog target={{ workspace: 'candidate', opportunityId }} onClose={() => setScheduling(false)} onDone={() => { setScheduling(false); list.reload() }} />}
    </div>
  </Card>
}
