import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BulkBar } from '../../components/cards'
import { ErrorNotice } from '../../components/ErrorNotice'
import { LoadingState } from '../../components/States'
import { HowItWorks } from '../../components/HowItWorks'
import { Badge } from '../../components/StatusBadge'
import { api } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import type { ProfileSummary } from '../../lib/types'
import { bulkFromSearch, sameCompany, type BulkResult } from './bulkFromSearch'
import { safeHref } from '../opportunities/opportunityModel'
import type { Workspace } from '../shell/shellModel'
import { hiringPostsUrl } from '../opportunities/reachPlan'
import { BOARDS, campaignFromSearchPath, employmentLabel, recruiterSearchUrl, formatSalary, applyView, type BoardJob, type BoardSearchResult, type JobBoard, type ResultView } from './boardModel'
import { isContract, isRemote } from './jobSignals'

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

import { runAction } from '../voice/voiceFlow'
import { asResult, saveSearch, savedSearches, savedWhen, type SavedSearch } from './savedResults'

type Props = Readonly<{ board: JobBoard; path: string | null; searchUrl: string; workspace: Workspace; query: string; location: string; view: ResultView; initialSaved?: SavedSearch | null }>

/** Live postings from one job board (through the licensed JSearch aggregator). Read-only; each card links to the board. */
export function BoardLiveResults({ board, path, searchUrl, workspace, query, location, view, initialSaved = null }: Props) {
  // An already-searched result opens without calling the board (no credit used).
  const first = useApi<BoardSearchResult>(initialSaved ? null : path)
  const name = BOARDS[board].name
  // Saved results: a live search that found jobs is kept in this browser; when the board fails or finds nothing, saved ones can be shown.
  const [saved, setSaved] = useState<SavedSearch | null>(initialSaved)
  useEffect(() => { if (first.data && !first.data.fromCache) saveSearch(board, query, location, first.data) }, [first.data, board, query, location])
  const savedList = savedSearches(board)
  const live = saved ? asResult(saved) : first.data
  const [pages, setPages] = useState<BoardSearchResult[]>([])
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState<Error>()

  const jobs = useMemo(() => {
    const seen = new Set<string>()
    const all: BoardJob[] = []
    for (const r of [live, ...(saved ? [] : pages)]) for (const j of r?.jobs ?? []) if (!seen.has(j.providerJobId)) { seen.add(j.providerJobId); all.push(j) }
    return all
  }, [live, saved, pages])
  const { shown, hidden } = useMemo(() => applyView(jobs, view), [jobs, view])
  const sales = workspace === 'sales'
  const profiles = useApi<ProfileSummary[]>('/api/v1/profiles')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState('')
  const [bulkDone, setBulkDone] = useState<BulkResult>()
  const [bulkError, setBulkError] = useState<Error>()
  /** Sales sees one row per hiring company; ticking a company ticks all its postings. */
  const companies = useMemo(() => {
    const groups: { company: string; jobs: BoardJob[] }[] = []
    for (const j of shown) {
      const g = groups.find((x) => sameCompany(x.company, j.companyName))
      if (g) g.jobs.push(j); else groups.push({ company: j.companyName, jobs: [j] })
    }
    return groups.sort((a, b) => b.jobs.length - a.jobs.length)
  }, [shown])
  const pickedJobs = shown.filter((j) => picked.has(j.providerJobId))
  const pickedCompanies = companies.filter((c) => c.jobs.some((j) => picked.has(j.providerJobId)))
  const toggle = (ids: string[]) => setPicked((cur) => {
    const next = new Set(cur)
    const all = ids.every((id) => next.has(id))
    for (const id of ids) { if (all) next.delete(id); else next.add(id) }
    return next
  })
  /** Adds the given results straight into a campaign (no new search); for Sales the emails are then written and the voice panel asks to send. */
  async function runBulk(list: BoardJob[] = pickedJobs) {
    setBulkBusy('Starting…'); setBulkError(undefined); setBulkDone(undefined)
    try {
      const done = await bulkFromSearch({ sales, board, boardName: name, query: saved?.query ?? query, location: saved?.location ?? location, picked: list, profiles: profiles.data ?? [], onStep: setBulkBusy })
      setBulkDone(done)
      setPicked(new Set())
      if (sales) void runAction({ kind: 'outreach', label: 'Write and send the emails', query: null, location: null, page: null, campaignId: done.campaignId }, true)
    } catch (e) { setBulkError(e as Error) } finally { setBulkBusy('') }
  }

  if (!path && !saved) return null
  // A failed or blocked live search (e.g. guests, who may not use paid searches) still offers the saved results.
  if (first.error && !saved) return <div className="stack-2">
    <ErrorNotice error={first.error} onRetry={first.reload} what={`live ${name} jobs`} />
    {savedList.length > 0 && <div className="row wrap" role="group" aria-label="Saved results">
      <span className="muted-small">Saved results (no search used):</span>
      {savedList.map((s) => <button key={`${s.query}|${s.location}|${s.savedAt}`} type="button" className="btn btn-secondary btn-sm" onClick={() => setSaved(s)}>
        {s.query}{s.location ? ` · ${s.location}` : ''} · {savedWhen(s.savedAt)} ({s.jobs.length})</button>)}
    </div>}
  </div>
  if (!live) return <LoadingState label={`Fetching live ${name} jobs…`} waking={first.waking} />
  const r = live
  const last = saved ? r : pages.at(-1) ?? r
  const savedChoices = savedList.length > 0 && <div className="row wrap" role="group" aria-label="Saved results">
    <span className="muted-small">Saved results (no search used):</span>
    {savedList.map((s) => <button key={`${s.query}|${s.location}|${s.savedAt}`} type="button" className="btn btn-secondary btn-sm" onClick={() => setSaved(s)}>
      {s.query}{s.location ? ` · ${s.location}` : ''} · {savedWhen(s.savedAt)} ({s.jobs.length})</button>)}
  </div>
  const cursor = last.nextCursor ?? null
  if (r.status !== 'Ready') {
    return <section className="result-blocked">
      <Badge tone="warning">{r.status === 'NotConfigured' ? 'Live listings not set up' : 'Live listings unavailable'}</Badge>
      <p className="grow">{r.message}{r.quotaRemaining != null ? ` ${r.quotaRemaining} free searches left this period.` : ''}</p>
      <a className="btn btn-secondary btn-sm" href={searchUrl} target="_blank" rel="noopener noreferrer">See these results on {name} ↗<span className="sr-only"> (opens in a new tab)</span></a>
      {savedChoices}
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
      <h3 className="results-title">{shown.length} {saved ? 'saved' : 'live'} {name} job{shown.length === 1 ? '' : 's'}</h3>
      {saved ? <Badge tone="neutral">Searched {savedWhen(saved.savedAt)} · not live</Badge> : <Badge tone="success">Live</Badge>}
      <span className="grow" />
      {saved ? (path ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSaved(null)}>Back to live results</button> : null)
        : <span className="muted-small">Retrieved {observed}{r.fromCache ? ' (cached, no search used)' : ''}{left != null ? ` · ${left} searches left` : ''}</span>}
    </div>
    {saved && <p className="muted-small">Saved from a real {name} search for “{saved.query}”{saved.location ? ` in ${saved.location}` : ''} on {new Date(saved.savedAt).toLocaleString()}. Jobs may have closed since.</p>}
    {!saved && jobs.length === 0 && savedChoices}
    {hidden > 0 && <p className="muted-small">{hidden} of {jobs.length} loaded job{jobs.length === 1 ? '' : 's'} hidden by your filters. <strong>Load more</strong> to look further.</p>}
    {jobs.length > 0 && <div className="hero-strip">
      <div className="hero-strip-text">
        <strong>{workspace === 'sales' ? 'Turn this into leads' : 'Track these jobs'}</strong>
        <p className="muted-small">{workspace === 'sales'
          ? 'The companies on screen become approved leads straight away (no new search), and an email is written for each; you send. Tick some below to add only those.'
          : 'The jobs on screen are added and approved straight away (no new search); your agent applies to the LinkedIn, Naukri and Instahyre ones. Tick some below to add only those.'}</p>
      </div>
      <div className="row wrap hero-strip-actions"><button type="button" className="btn btn-primary btn-sm" data-coach="find-campaign" disabled={bulkBusy !== '' || !profiles.data} onClick={() => void runBulk(shown)}>
          {bulkBusy || (sales ? `Add all ${companies.length} as leads and write emails` : `Add all ${shown.length} jobs`)}</button>
        {!saved && <Link className="btn btn-ghost btn-sm" to={campaignFromSearchPath(workspace, { query, location }, board, name)}>Repeat this search daily</Link>}
        <a className="btn btn-secondary btn-sm" href={hiringPostsUrl(query, '', location)} target="_blank" rel="noopener noreferrer">Hiring posts on LinkedIn ↗<span className="sr-only"> (opens a new tab)</span></a>
        <a className="btn btn-ghost btn-sm" href={recruiterSearchUrl('', query, true)} target="_blank" rel="noopener noreferrer">Recruiters in my network ↗<span className="sr-only"> (opens LinkedIn in a new tab)</span></a></div>
    </div>}
    {jobs.length > 0 && <HowItWorks summary="What happens next — step by step">
      <ol className="guide-steps">{(workspace === 'sales' ? SALES_STEPS : CANDIDATE_STEPS).map((step) => <li key={step}>{step}</li>)}</ol>
    </HowItWorks>}
    {bulkError && <ErrorNotice error={bulkError} />}
    {bulkDone && <div className="notice notice-success" role="status">
      {sales
        ? <>{bulkDone.approved} compan{bulkDone.approved === 1 ? 'y' : 'ies'} added as approved leads. <Link to="/outreach">Write the emails</Link> · <Link to={`/opportunities?campaign=${bulkDone.campaignId}`}>See the leads</Link></>
        : <>{bulkDone.approved} job{bulkDone.approved === 1 ? '' : 's'} approved for applying. Your desktop agent applies to all of them: <code>npm run agent -- apply {name.toLowerCase()} --submit</code> · <Link to={`/opportunities?campaign=${bulkDone.campaignId}`}>See the jobs</Link></>}
    </div>}
    {shown.length > 0 && <div className="row wrap">
      <label className="check"><input type="checkbox" checked={shown.length > 0 && shown.every((j) => picked.has(j.providerJobId))}
        onChange={() => toggle(shown.map((j) => j.providerJobId))} /> {sales ? `Select all ${companies.length} companies` : `Select all ${shown.length} jobs`}</label>
    </div>}
    {sales && shown.length > 0 && <ul className="result-list" aria-label={`Companies hiring on ${name}`}>
      {companies.map((c) => {
        const ids = c.jobs.map((j) => j.providerJobId)
        const on = ids.every((id) => picked.has(id))
        const titles = [...new Set(c.jobs.map((j) => j.title))]
        return <li key={c.company} className={`result-card${on ? ' is-selected' : ''}`}>
          <input type="checkbox" className="result-check" checked={on} onChange={() => toggle(ids)} aria-label={`Select ${c.company}`} />
          <div className="result-main">
            <strong className="result-title">{c.company}</strong>
            <div className="result-sub">{c.jobs.length} open role{c.jobs.length === 1 ? '' : 's'}: {titles.slice(0, 3).join(', ')}{titles.length > 3 ? ` and ${titles.length - 3} more` : ''}</div>
            <div className="result-sub">{[...new Set(c.jobs.map((j) => j.location).filter(Boolean))].slice(0, 3).join(' · ')}</div>
          </div>
          <div className="result-side">
            <a className="btn btn-ghost btn-sm" href={recruiterSearchUrl(c.company, query)} target="_blank" rel="noopener noreferrer">Find recruiters ↗<span className="sr-only"> at {c.company} (opens LinkedIn in a new tab)</span></a>
          </div>
        </li>
      })}
    </ul>}
    {shown.length === 0
      ? <p className="muted-small">{jobs.length > 0 ? 'Every loaded job is hidden by your filters. Turn one off, or load more.' : r.message}</p>
      : !sales && <ul className="result-list">
        {shown.map((job) => {
          const salary = formatSalary(job)
          const href = safeHref(job.boardUrl) ?? undefined
          return <li key={job.providerJobId} className={`result-card${picked.has(job.providerJobId) ? ' is-selected' : ''}`}>
            <input type="checkbox" className="result-check" checked={picked.has(job.providerJobId)} onChange={() => toggle([job.providerJobId])} aria-label={`Select ${job.title} at ${job.companyName}`} />
            <div className="result-main">
              <a className="result-title" href={href} target="_blank" rel="noopener noreferrer">{job.title}<span className="sr-only"> (opens on {name} in a new tab)</span></a>
              <div className="result-sub">{[job.companyName, job.location, isRemote(job) ? 'Remote' : null, employmentLabel(job.employmentType) ?? (isContract(job) ? 'Contract' : null)].filter(Boolean).join(' · ')}</div>
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
    <BulkBar count={sales ? pickedCompanies.length : pickedJobs.length} noun={sales ? { one: 'company', many: 'companies' } : { one: 'job', many: 'jobs' }} onClear={() => setPicked(new Set())}>
      <button type="button" className="btn btn-primary btn-sm" disabled={bulkBusy !== ''} onClick={() => void runBulk(pickedJobs)}>
        {bulkBusy || (sales ? `Add ${pickedCompanies.length} as leads` : `Apply to ${pickedJobs.length}`)}
      </button>
    </BulkBar>
    {moreError && <ErrorNotice error={moreError} onRetry={() => void loadMore()} what={`more ${name} jobs`} />}
    {cursor
      ? <div className="row"><button type="button" className="btn btn-secondary" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? 'Loading…' : 'Load more jobs'}</button><span className="muted-small">Each page uses 1 of your free searches{left != null ? ` (${left} left)` : ''}.</span></div>
      : jobs.length > 0 && <p className="muted-small">No more results for this search.</p>}
  </section>
}
