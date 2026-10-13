import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, Card, CardList } from '../../components/cards'
import { ErrorNotice } from '../../components/ErrorNotice'
import { LoadingState } from '../../components/States'
import { api } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { safeHref } from '../opportunities/opportunityModel'
import { RoleList, ROLE_LIST_ID } from '../suggest/RoleList'
import type { Workspace } from '../shell/shellModel'
import { feedsPath, mentionsVisaOrRelocation, mergeAll, siteLines, type FeedSearchResult } from './allSitesModel'
import { boardJobsPath, campaignFromSearchPath, employmentLabel, formatSalary, recruiterSearchUrl, type BoardSearchResult, type JobBoard } from './boardModel'

const PAID: JobBoard[] = ['LinkedIn', 'Indeed', 'Seek']

type Found = { query: string; location: string; feed: FeedSearchResult | Error; boards: { board: JobBoard; result: BoardSearchResult | Error }[] }

/**
 * "All sites": one search over every site we can read. The free feeds (Arbeitnow, Jobicy, We Work Remotely, Remotive, Remote OK, Himalayas)
 * cost nothing; LinkedIn, Indeed and SEEK go through JSearch and use 3 of the free monthly searches, so that part is a visible switch.
 */
export function AllSitesPanel({ workspace, tabs }: Readonly<{ workspace: Workspace; tabs: ReactNode }>) {
  const status = useApi<{ configured: boolean }>('/api/v1/jobboards/status')
  const paidReady = status.data?.configured === true
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('')
  const [remoteOnly, setRemoteOnly] = useState(false)
  const [includePaid, setIncludePaid] = useState(true)
  const [visaOnly, setVisaOnly] = useState(false)
  const [busy, setBusy] = useState(false)
  const [found, setFound] = useState<Found>()
  const sales = workspace === 'sales'

  async function submit(e: FormEvent) {
    e.preventDefault()
    const path = feedsPath({ query, location, remoteOnly })
    if (!path || busy) return
    setBusy(true)
    const paid = includePaid && paidReady
    const [feed, ...boards] = await Promise.all([
      api<FeedSearchResult>(path).catch((err: Error) => err),
      ...(paid ? PAID.map(async (board) => {
        const p = boardJobsPath(board, { query, location, workMode: remoteOnly ? 'remote' : '', postedWithinDays: '', country: '' })
        return { board, result: p ? await api<BoardSearchResult>(p).catch((err: Error) => err) : new Error('empty') }
      }) : []),
    ]) as [FeedSearchResult | Error, ...{ board: JobBoard; result: BoardSearchResult | Error }[]]
    setFound({ query: query.trim(), location: location.trim(), feed, boards })
    setBusy(false)
  }

  const feedOk = found && !(found.feed instanceof Error) ? found.feed : undefined
  const merged = found ? mergeAll(feedOk?.jobs ?? [], found.boards.flatMap((b) => (b.result instanceof Error || b.result.status !== 'Ready') ? [] : [{ board: b.board, jobs: b.result.jobs }]), found.query) : []
  const lines = found ? siteLines(feedOk, found.boards) : []
  const shown = visaOnly ? merged.filter((m) => mentionsVisaOrRelocation(m.job)) : merged

  return <>
    <RoleList />
    <form className="search-hero" onSubmit={submit} aria-label="Search all sites">
      {tabs}
      <div className="search-bar" data-coach="find-search">
        <label className="search-field search-field-main"><span className="sr-only">{sales ? 'Role companies are hiring' : 'Role or keywords'}</span>
          <input list={ROLE_LIST_ID} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={sales ? 'Role companies are hiring, e.g. React developer' : 'Role or keywords, e.g. backend developer'} /></label>
        <label className="search-field"><span className="sr-only">Location</span>
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Place (optional), e.g. Berlin" /></label>
        <button className="btn btn-primary" type="submit" disabled={busy || !query.trim()}>{busy ? 'Searching…' : 'Search all sites'}</button>
      </div>
      <div className="search-tools row wrap" data-coach="find-filters">
        <label className="chip-check"><input type="checkbox" checked={remoteOnly} onChange={(e) => setRemoteOnly(e.target.checked)} /> Remote only</label>
        <label className="chip-check" title="Reads each posting's own text; it is a hint, not a promise"><input type="checkbox" checked={visaOnly} onChange={(e) => setVisaOnly(e.target.checked)} /> Mentions visa or relocation</label>
        <label className="chip-check" title={paidReady ? 'Uses 3 of your free monthly searches (one each)' : 'Not set up on this server'}>
          <input type="checkbox" checked={includePaid && paidReady} disabled={!paidReady} onChange={(e) => setIncludePaid(e.target.checked)} /> Also LinkedIn, Indeed and SEEK
        </label>
        <span className="muted-small">{paidReady ? 'That part uses 3 of your free monthly searches.' : 'LinkedIn, Indeed and SEEK need the job-data key on the server.'} The free sites cost nothing.</span>
      </div>
      <p className="muted-small" data-testid="sites-read">Reads: Arbeitnow, Jobicy, We Work Remotely, Remotive, Remote OK, Himalayas{paidReady ? ', LinkedIn, Indeed, SEEK' : ''} — and any regional board the server owner has connected. Wellfound and Trends have their own tabs.</p>
    </form>

    {busy && <LoadingState label="Searching every site…" rows={3} />}
    {!busy && found && <section className="stack-3" aria-label="Results from all sites">
      {found.feed instanceof Error && <ErrorNotice error={found.feed} what="the free job feeds" />}
      <Card tone="muted" title={`${shown.length} ${shown.length === 1 ? 'job' : 'jobs'} for “${found.query}”${found.location ? ` in ${found.location}` : ''}`}
        subtitle={visaOnly ? `Only postings whose text mentions visa sponsorship, a work permit or relocation (${merged.length - shown.length} hidden). Best title matches first.` : 'Best title matches first, then newest. The same job on two sites is shown once.'}
        actions={shown.length > 0 ? <Link className="btn btn-primary btn-sm" data-coach="find-campaign" to={campaignFromSearchPath(workspace, { query: found.query, location: found.location }, 'LinkedIn', 'All sites')}>{sales ? 'Turn into leads' : 'Track these jobs'}</Link> : undefined}>
        <ul className="site-lines" aria-label="What each site returned">
          {lines.map((l) => <li key={l.name} className={l.ok ? 'is-ok' : 'is-off'}><span aria-hidden="true">{l.ok ? '✓' : '○'}</span> <strong>{l.name}</strong> {l.text}</li>)}
        </ul>
      </Card>
      {shown.length === 0
        ? <Card tone="muted"><p>No job matched on any site that answered. Try fewer words, a broader place, or turn off Remote only{visaOnly ? ' and the visa filter' : ''}.</p></Card>
        : <CardList label="Jobs from all sites">
          {shown.slice(0, 80).map(({ site, siteName, job }) => {
            const href = safeHref(job.boardUrl) ?? undefined
            const salary = formatSalary(job)
            return <li key={`${site}:${job.providerJobId}`} className="ccard lead-card result-lite">
              <span aria-hidden="true" />
              <Avatar name={job.companyName || job.title} />
              <div className="lead-main">
                <h3 className="lead-title"><a href={href} target="_blank" rel="noopener noreferrer">{job.title}<span className="sr-only"> (opens on {siteName} in a new tab)</span></a></h3>
                <p className="lead-meta">{[job.companyName, job.location, employmentLabel(job.employmentType)].filter(Boolean).join(' · ')}</p>
                <div className="lead-tags">
                  <span className="chip chip-site">{siteName}</span>
                  {job.isRemote && <span className="chip">Remote</span>}
                  {salary && <span className="chip">{salary}</span>}
                  {job.postedAt && <span className="lead-note">Posted {new Date(job.postedAt).toLocaleDateString()}</span>}
                </div>
                {job.snippet && <p className="result-snippet">{job.snippet}</p>}
              </div>
              <div className="lead-side">
                <a className="btn btn-secondary btn-sm" href={href} target="_blank" rel="noopener noreferrer">Open ↗<span className="sr-only"> {job.title}</span></a>
                <a className="btn btn-ghost btn-sm" href={recruiterSearchUrl(job.companyName, found.query)} target="_blank" rel="noopener noreferrer">Recruiters ↗<span className="sr-only"> at {job.companyName}</span></a>
              </div>
            </li>
          })}
        </CardList>}
    </section>}
  </>
}
