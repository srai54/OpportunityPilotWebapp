import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, Card, CardList } from '../../components/cards'
import { ErrorNotice } from '../../components/ErrorNotice'
import { LoadingState } from '../../components/States'
import { api } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { safeHref } from '../opportunities/opportunityModel'
import { RoleList, ROLE_LIST_ID } from '../suggest/RoleList'
import { placeFor } from '../suggest/picks'
import { PLACE_LIST_ID, PlaceList } from '../suggest/PlaceList'
import { SitePicker } from './SitePicker'
import type { Workspace } from '../shell/shellModel'
import { chosenSites, COUNTRIES, feedsPath, isContract, placeWithCountry, groupByCompany, mentionsVisaOrRelocation, mergeAll, siteLines, type FeedSearchResult } from './allSitesModel'
import { boardJobsPath, campaignFromSearchPath, employmentLabel, formatSalary, recruiterSearchUrl, type BoardSearchResult, type JobBoard } from './boardModel'

const NO_FEED: FeedSearchResult = { sites: [], jobs: [], observedAt: '' }

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
  const [off, setOff] = useState<Set<string>>(new Set())
  const [visaOnly, setVisaOnly] = useState(false)
  const [country, setCountry] = useState('')
  const [contractOnly, setContractOnly] = useState(false)
  const [busy, setBusy] = useState(false)
  const [found, setFound] = useState<Found>()
  const sales = workspace === 'sales'

  async function submit(e: FormEvent) {
    e.preventDefault()
    const pick = placeFor(location)
    const place = placeWithCountry(pick.location, country)
    const remote = remoteOnly || pick.remote
    const { free, paid } = chosenSites(off, paidReady)
    const path = feedsPath({ query, location: place, remoteOnly: remote, sites: free })
    if (!path || busy || free.length + paid.length === 0) return
    setBusy(true)
    const [feed, ...boards] = await Promise.all([
      free.length > 0 ? api<FeedSearchResult>(path).catch((err: Error) => err) : Promise.resolve(NO_FEED),
      ...paid.map(async (board) => {
        const p = boardJobsPath(board, { query, location: place, workMode: remote ? 'remote' : '', postedWithinDays: '', country: '' })
        return { board, result: p ? await api<BoardSearchResult>(p).catch((err: Error) => err) : new Error('empty') }
      }),
    ]) as [FeedSearchResult | Error, ...{ board: JobBoard; result: BoardSearchResult | Error }[]]
    setFound({ query: query.trim(), location: place.trim(), feed, boards })
    setBusy(false)
  }

  const feedOk = found && !(found.feed instanceof Error) ? found.feed : undefined
  const merged = found ? mergeAll(feedOk?.jobs ?? [], found.boards.flatMap((b) => (b.result instanceof Error || b.result.status !== 'Ready') ? [] : [{ board: b.board, jobs: b.result.jobs }]), found.query) : []
  const lines = found ? siteLines(feedOk, found.boards) : []
  const afterVisa = visaOnly ? merged.filter((m) => mentionsVisaOrRelocation(m.job)) : merged
  const shown = contractOnly ? afterVisa.filter((m) => isContract(m.job)) : afterVisa
  // Sales looks for companies that are hiring, not for a job: one row per company with its open roles.
  const companies = sales ? groupByCompany(shown) : []
  const count = sales ? companies.length : shown.length
  const noun = sales ? (count === 1 ? 'company hiring' : 'companies hiring') : (count === 1 ? 'job' : 'jobs')

  return <>
    <RoleList />
    <PlaceList />
    <form className="search-hero" onSubmit={submit} aria-label="Search all sites">
      {tabs}
      <div className="search-bar" data-coach="find-search">
        <label className="search-field search-field-main"><span className="sr-only">{sales ? 'Role companies are hiring' : 'Role or keywords'}</span>
          <input list={ROLE_LIST_ID} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={sales ? 'Role companies are hiring, e.g. React developer' : 'Role or keywords, e.g. backend developer'} /></label>
        <label className="search-field"><span className="sr-only">Place</span>
          <input list={PLACE_LIST_ID} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Place (optional)" /></label>
        {sales && <label className="search-field"><span className="sr-only">Country</span>
          <select value={country} onChange={(e) => setCountry(e.target.value)}><option value="">Any country</option>
            <optgroup label="US">{COUNTRIES.filter((c) => c.group === 'US').map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</optgroup>
            <optgroup label="Europe">{COUNTRIES.filter((c) => c.group === 'Europe').map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</optgroup></select></label>}
        <SitePicker off={off} onChange={setOff} paidReady={paidReady} />
        <button className="btn btn-primary" type="submit" disabled={busy || !query.trim()}>{busy ? 'Searching…' : 'Search'}</button>
      </div>
      <div className="search-tools row wrap" data-coach="find-filters">
        <label className="chip-check"><input type="checkbox" checked={remoteOnly} onChange={(e) => setRemoteOnly(e.target.checked)} /> Remote only</label>
        <label className="chip-check" title="Keeps contract and freelance roles; the posting's own type or title says so"><input type="checkbox" checked={contractOnly} onChange={(e) => setContractOnly(e.target.checked)} /> Contract only</label>
        <label className="chip-check" title="Reads each posting's own text; it is a hint, not a promise"><input type="checkbox" checked={visaOnly} onChange={(e) => setVisaOnly(e.target.checked)} /> Mentions visa or relocation</label>
      </div>
    </form>

    {busy && <LoadingState label="Searching every site…" rows={3} />}
    {!busy && found && <section className="stack-3" aria-label="Results from all sites">
      {found.feed instanceof Error && <ErrorNotice error={found.feed} what="the free job feeds" />}
      <Card tone="muted" title={`${count} ${noun} for “${found.query}”${found.location ? ` in ${found.location}` : ''}`}
        subtitle={visaOnly ? `Only postings whose text mentions visa sponsorship, a work permit or relocation (${merged.length - shown.length} hidden). Best title matches first.`
          : sales ? `From ${shown.length} postings, grouped by company; companies hiring for more of these roles first. Turn them into leads to score them and find who to contact.`
          : 'Best title matches first, then newest. The same job on two sites is shown once.'}
        actions={shown.length > 0 ? <Link className="btn btn-primary btn-sm" data-coach="find-campaign" to={campaignFromSearchPath(workspace, { query: found.query, location: found.location }, 'LinkedIn', 'All sites')}>{sales ? 'Turn into leads' : 'Track these jobs'}</Link> : undefined}>
        <ul className="site-lines" aria-label="What each site returned">
          {lines.map((l) => <li key={l.name} className={l.ok ? 'is-ok' : 'is-off'}><span aria-hidden="true">{l.ok ? '✓' : '○'}</span> <strong>{l.name}</strong> {l.text}</li>)}
        </ul>
      </Card>
      {count === 0
        ? <Card tone="muted"><p>{sales ? 'No hiring company matched' : 'No job matched'} on any site that answered. Try fewer words, a broader place, or turn off Remote only{contractOnly ? ', Contract only' : ''}{visaOnly ? ' and the visa filter' : ''}.</p></Card>
        : sales ? <CardList label="Companies hiring">
          {companies.slice(0, 60).map((c) => {
            const first = c.roles[0]
            const href = safeHref(first.job.boardUrl) ?? undefined
            const titles = [...new Set(c.roles.map((r) => r.job.title))]
            return <li key={c.company} className="ccard lead-card result-lite">
              <span aria-hidden="true" />
              <Avatar name={c.company} />
              <div className="lead-main">
                <h3 className="lead-title">{c.company}</h3>
                <p className="lead-meta">{c.roles.length} open role{c.roles.length === 1 ? '' : 's'}: {titles.slice(0, 3).join(', ')}{titles.length > 3 ? ` and ${titles.length - 3} more` : ''}</p>
                <div className="lead-tags">
                  {c.sites.map((site) => <span key={site} className="chip chip-site">{site}</span>)}
                  {c.remote && <span className="chip">Remote</span>}
                  {c.contract && <span className="chip">Contract</span>}
                  {c.places.slice(0, 2).map((place) => <span key={place} className="chip">{place}</span>)}
                  {c.newest && <span className="lead-note">Newest posting {new Date(c.newest).toLocaleDateString()}</span>}
                </div>
              </div>
              <div className="lead-side">
                <a className="btn btn-secondary btn-sm" href={href} target="_blank" rel="noopener noreferrer">Open a role ↗<span className="sr-only"> at {c.company}</span></a>
                <a className="btn btn-ghost btn-sm" href={recruiterSearchUrl(c.company, found.query)} target="_blank" rel="noopener noreferrer">Recruiters ↗<span className="sr-only"> at {c.company}</span></a>
              </div>
            </li>
          })}
        </CardList>
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
                  {isContract(job) && <span className="chip">Contract</span>}
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
