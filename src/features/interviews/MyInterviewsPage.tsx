import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CardList } from '../../components/cards'
import { ErrorNotice } from '../../components/ErrorNotice'
import { KpiBand, KpiCard } from '../../components/kpi/kpi'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState, LoadingState } from '../../components/States'
import type { JobInterview } from '../../lib/types'
import { useApi } from '../../lib/useApi'
import { JobInterviewCard, JobInterviewForm } from './JobInterviewParts'
import { useJobInterviewActions } from './useJobInterviewActions'
import { plural, splitJobInterviews } from './interviewsModel'

const DAY = 86_400_000

/** Candidate → My interviews: every interview you recorded across your job applications, upcoming first. */
export function MyInterviewsPage() {
  const list = useApi<JobInterview[]>('/api/v1/interviews')
  const [now] = useState(() => new Date())
  const [editing, setEditing] = useState<JobInterview | null>(null)
  const actions = useJobInterviewActions(list.reload)
  const rows = list.data ?? []
  const { upcoming, past } = splitJobInterviews(rows, now)
  const week = upcoming.filter((i) => i.scheduledAt && new Date(i.scheduledAt).getTime() - now.getTime() < 7 * DAY).length
  const card = (i: JobInterview) => <JobInterviewCard key={i.id} i={i} now={now} showJob busy={actions.busy}
    onStatus={actions.setStatus} onEdit={setEditing} onRemove={actions.remove} />

  return <div className="page page-wide stack-4">
    <PageHeader title="My interviews" subtitle="Your interview rounds, soonest first." />
    <span className="sr-only" role="status" aria-live="polite">{actions.said}</span>
    {actions.error && <ErrorNotice error={actions.error} />}
    {editing && <JobInterviewForm key={editing.id} opportunityId={editing.opportunityId} editing={editing}
      onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); list.reload() }} />}

    {list.error && !list.data ? <ErrorNotice error={list.error} onRetry={list.reload} what="your interviews" />
      : !list.data ? <LoadingState label="Loading your interviews…" waking={list.waking} stats={4} />
      : rows.length === 0 ? <EmptyState title="No interviews yet"
          actions={<Link className="btn btn-primary btn-sm" to="/opportunities">Open your jobs</Link>}>
          <p>Got an interview? Open the job and add it under Interviews.</p>
        </EmptyState>
      : <>
        <KpiBand label="Your interviews">
          <KpiCard icon="calendar" tone="blue" label="Coming up" value={upcoming.length} sub="still to happen" />
          <KpiCard icon="followUps" tone="teal" label="Next 7 days" value={week} sub="this week" />
          <KpiCard icon="check" tone="green" label="Done" value={rows.filter((i) => i.status === 'Completed').length} sub="rounds held" />
          <KpiCard icon="opportunities" tone="indigo" label="Jobs" value={new Set(rows.map((i) => i.opportunityId)).size} sub="with an interview" />
        </KpiBand>
        <section className="stack-3" aria-labelledby="my-iv-next">
          <h2 id="my-iv-next" className="eyebrow">Coming up · {plural(upcoming.length, 'interview')}</h2>
          {upcoming.length === 0 ? <p className="muted-small">Nothing booked right now.</p> : <CardList label="Interviews coming up">{upcoming.map(card)}</CardList>}
        </section>
        {past.length > 0 && <section className="stack-3" aria-labelledby="my-iv-past">
          <h2 id="my-iv-past" className="eyebrow">Past · {plural(past.length, 'interview')}</h2>
          <CardList label="Past interviews">{past.map(card)}</CardList>
        </section>}
      </>}
  </div>
}
