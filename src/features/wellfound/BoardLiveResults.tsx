import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorNotice } from '../../components/ErrorNotice'
import { LoadingState } from '../../components/States'
import { HowItWorks } from '../../components/HowItWorks'
import { Badge } from '../../components/StatusBadge'
import { api } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { safeHref } from '../opportunities/opportunityModel'
import type { Workspace } from '../shell/shellModel'
import { BOARDS, campaignFromSearchPath, employmentLabel, recruiterSearchUrl, formatSalary, applyView, type BoardJob, type BoardSearchResult, type JobBoard, type ResultView } from './boardModel'

const SALES_STEPS = [
  'Click "Start a campaign from this search". The builder opens filled in; pick a Product or Services profile and save.',
  'Run it. Each company that is hiring becomes one lead, scored against your criteria, with its job postings as the evidence.',
  'Open Companies, shortlist the best, then create an email, LinkedIn or contact-form draft for a company.',
  'Approve the exact version, send it yourself from your own mailbox or LinkedIn, and paste a receipt — only then is it marked sent.',
  'Set a follow-up (Follow-ups), and when a company replies click "Make a staffing lead" to track the deal stage by stage.',
]
const CANDIDATE_STEPS = [
  'Open a job on the board to read it in full — every card links to the original posting.',
  'To track jobs, click "Start a campaign from this search". The builder opens filled in; pick your profile and save.',
  'Run it. Jobs are scored against your profile; the best are suggested in Approvals.',
  'Approve in one click, then apply on the board yourself and mark the job applied so your numbers stay true.',
]

type Props = Readonly<{ board: JobBoard; path: string | null; searchUrl: string; workspace: Workspace; query: string; location: string; view: ResultView }>

/** Live postings from one job board (through the licensed JSearch aggregator). Read-only; each card links to the board. */
export function BoardLiveResults({ board, path, searchUrl, workspace, query, location, view }: Props) {
  const first = useApi<BoardSearchResult>(path)
  const name = BOARDS[board].name
  const [pages, setPages] = useState<BoardSearchResult[]>([])
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState<Error>()

  const jobs = useMemo(() => {
    const seen = new Set<string>()
    const all: BoardJob[] = []
    for (const r of [first.data, ...pages]) for (const j of r?.jobs ?? []) if (!seen.has(j.providerJobId)) { seen.add(j.providerJobId); all.push(j) }
    return all
  }, [first.data, pages])
  const { shown, hidden } = useMemo(() => applyView(jobs, view), [jobs, view])

  if (!path) return null
  if (first.error) return <ErrorNotice error={first.error} onRetry={first.reload} what={`live ${name} jobs`} />
  if (!first.data) return <LoadingState label={`Fetching live ${name} jobs…`} waking={first.waking} />
  const r = first.data
  const last = pages.at(-1) ?? r
  const cursor = last.nextCursor ?? null
  if (r.status !== 'Ready') {
    return <section className="result-blocked">
      <Badge tone="warning">{r.status === 'NotConfigured' ? 'Live listings not set up' : 'Live listings unavailable'}</Badge>
      <p className="grow">{r.message}{r.quotaRemaining != null ? ` ${r.quotaRemaining} free searches left this period.` : ''}</p>
      <a className="btn btn-secondary btn-sm" href={searchUrl} target="_blank" rel="noopener noreferrer">See these results on {name} ↗<span className="sr-only"> (opens in a new tab)</span></a>
    </section>
  }

  async function loadMore() {
    if (!cursor || !path) return
    setLoadingMore(true); setMoreError(undefined)
    try { const next = await api<BoardSearchResult>(`${path}&cursor=${encodeURIComponent(cursor)}`); setPages((p) => [...p, next]) }
    catch (e) { setMoreError(e as Error) } finally { setLoadingMore(false) }
  }

  const observed = r.observedAt ? new Date(r.observedAt).toLocaleString() : ''
  const left = last.quotaRemaining
  return <section aria-label={`Live ${name} jobs`} className="stack-3">
    <div className="results-head">
      <h3 className="results-title">{shown.length} live {name} job{shown.length === 1 ? '' : 's'}</h3>
      <Badge tone="success">Live</Badge>
      <span className="grow" />
      <span className="muted-small">Retrieved {observed}{r.fromCache ? ' (cached, no search used)' : ''}{left != null ? ` · ${left} searches left` : ''}</span>
    </div>
    {hidden > 0 && <p className="muted-small">{hidden} of {jobs.length} loaded job{jobs.length === 1 ? '' : 's'} hidden by your filters. <strong>Load more</strong> to look further.</p>}
    {jobs.length > 0 && <div className="hero-strip">
      <div className="hero-strip-text">
        <strong>{workspace === 'sales' ? 'Turn this into leads' : 'Track these jobs'}</strong>
        <p className="muted-small">{workspace === 'sales'
          ? 'Start a campaign from this search: each hiring company becomes a scored lead with its postings as evidence, then outreach drafts, follow-ups and a staffing deal.'
          : 'Start a campaign from this search: jobs are scored against your profile, suggested for approval, and tracked until applied.'}</p>
      </div>
      <div className="row wrap hero-strip-actions"><Link className="btn btn-primary btn-sm" data-coach="find-campaign" to={campaignFromSearchPath(workspace, { query, location }, board, name)}>Start a campaign from this search</Link></div>
    </div>}
    {jobs.length > 0 && <HowItWorks summary="What happens next — step by step">
      <ol className="guide-steps">{(workspace === 'sales' ? SALES_STEPS : CANDIDATE_STEPS).map((step) => <li key={step}>{step}</li>)}</ol>
    </HowItWorks>}
    {shown.length === 0
      ? <p className="muted-small">{jobs.length > 0 ? 'Every loaded job is hidden by your filters. Turn one off, or load more.' : r.message}</p>
      : <ul className="result-list">
        {shown.map((job) => {
          const salary = formatSalary(job)
          const href = safeHref(job.boardUrl) ?? undefined
          return <li key={job.providerJobId} className="result-card">
            <div className="result-main">
              <a className="result-title" href={href} target="_blank" rel="noopener noreferrer">{job.title}<span className="sr-only"> (opens on {name} in a new tab)</span></a>
              <div className="result-sub">{[job.companyName, job.location, job.isRemote ? 'Remote' : null, employmentLabel(job.employmentType)].filter(Boolean).join(' · ')}</div>
              {job.snippet ? <p className="result-snippet">{job.snippet}</p> : null}
            </div>
            <div className="result-side">
              {salary ? <strong className="op-numeric">{salary}</strong> : null}
              {job.postedAt ? <span className="muted-small">Posted {new Date(job.postedAt).toLocaleDateString()}</span> : null}
              <a className="btn btn-secondary btn-sm" href={href} target="_blank" rel="noopener noreferrer">Open on {name} ↗</a>
              <a className="btn btn-ghost btn-sm" href={recruiterSearchUrl(job.companyName, query)} target="_blank" rel="noopener noreferrer">Find recruiters ↗<span className="sr-only"> at {job.companyName} (opens LinkedIn in a new tab)</span></a>
            </div>
          </li>
        })}
      </ul>}
    {moreError && <ErrorNotice error={moreError} onRetry={() => void loadMore()} what={`more ${name} jobs`} />}
    {cursor
      ? <div className="row"><button type="button" className="btn btn-secondary" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? 'Loading…' : 'Load more jobs'}</button><span className="muted-small">Each page uses 1 of your free searches{left != null ? ` (${left} left)` : ''}.</span></div>
      : jobs.length > 0 && <p className="muted-small">No more results for this search.</p>}
  </section>
}
