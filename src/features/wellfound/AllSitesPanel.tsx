import { useState, type FormEvent, type ReactNode } from 'react'
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
import { bulkFromSearch } from './bulkFromSearch'
import { runAction } from '../voice/voiceFlow'
import type { ProfileSummary } from '../../lib/types'
import type { Workspace } from '../shell/shellModel'
import { chosenSites, companiesCsv, COUNTRIES, COUNTRY_GROUPS, feedsPath, isContract, isRemote, placeWithCountry, groupByCompany, mentionsVisaOrRelocation, mergeAll, siteCounts, siteLines, type FeedSearchResult } from './allSitesModel'
import { offForRegion, REGIONS, type RegionId } from './sourcesModel'
import { useShell } from '../shell/ShellContext'
import { saveBlob, safeFilename } from '../../lib/download'
import { boardJobsPath, employmentLabel, formatSalary, recruiterSearchUrl, type BoardSearchResult, type JobBoard } from './boardModel'

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
  const sales = workspace === 'sales'
  const { advanced } = useShell()
  // Sales defaults (J3): the staffing team looks for contract and remote roles first; both stay switchable.
  const [remoteOnly, setRemoteOnly] = useState(sales)
  const [region, setRegion] = useState<RegionId>('all')
  const [off, setOff] = useState<Set<string>>(new Set())
  const [visaOnly, setVisaOnly] = useState(false)
  const [country, setCountry] = useState('')
  const [contractOnly, setContractOnly] = useState(sales)
  const [busy, setBusy] = useState(false)
  const [found, setFound] = useState<Found>()
  // Switching workspace resets the defaults (state adjusted during render, not in an effect).
  const [defaultsFor, setDefaultsFor] = useState(sales)
  if (defaultsFor !== sales) { setDefaultsFor(sales); setRemoteOnly(sales); setContractOnly(sales) }
  const profiles = useApi<ProfileSummary[]>('/api/v1/profiles')
  const [adding, setAdding] = useState('')
  const [added, setAdded] = useState<string>()
  const [addError, setAddError] = useState<Error>()

  /** Picking a region (J1) switches on that region's sources only, preselects its country and, for Global remote, Remote only. */
  function pickRegion(id: RegionId) {
    const r = REGIONS.find((x) => x.id === id) ?? REGIONS[0]
    setRegion(r.id)
    setOff(offForRegion(r.id))
    setCountry(r.country)
    if (r.remote) setRemoteOnly(true)
  }

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

  /** The results already on screen go straight into a campaign (no new search), approved; Sales then gets the emails written. */
  async function addShown() {
    if (!found) return
    setAdding('Starting…'); setAdded(undefined); setAddError(undefined)
    try {
      const picked = sales ? companies.slice(0, 40).flatMap((c) => c.roles.map((r) => r.job)) : shown.slice(0, 40).map((m) => m.job)
      const done = await bulkFromSearch({ sales, board: 'All sites', boardName: 'All sites', query: found.query, location: found.location, picked, profiles: profiles.data ?? [], onStep: setAdding })
      setAdded(sales ? `${done.approved} companies added and approved. Writing their emails now; the voice panel asks before anything is sent.`
        : `${done.approved} jobs added and approved. Your desktop agent applies to the LinkedIn, Naukri and Instahyre ones; the rest are in your apply queue.`)
      if (sales) void runAction({ kind: 'outreach', label: 'Write and send the emails', query: null, location: null, page: null, campaignId: done.campaignId }, true)
    } catch (e) { setAddError(e as Error) } finally { setAdding('') }
  }

  const feedOk = found && !(found.feed instanceof Error) ? found.feed : undefined
  const merged = found ? mergeAll(feedOk?.jobs ?? [], found.boards.flatMap((b) => (b.result instanceof Error || b.result.status !== 'Ready') ? [] : [{ board: b.board, jobs: b.result.jobs }]), found.query) : []
  const lines = found ? siteLines(feedOk, found.boards) : []
  const counts = found ? siteCounts(feedOk, found.boards) : undefined
  const afterRemote = remoteOnly ? merged.filter((m) => isRemote(m.job)) : merged
  const afterVisa = visaOnly ? afterRemote.filter((m) => mentionsVisaOrRelocation(m.job)) : afterRemote
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
        <label className="search-field region-select"><span className="sr-only">Region</span>
          <select value={region} onChange={(e) => pickRegion(e.target.value as RegionId)}>
            {REGIONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select></label>
        <label className="search-field"><span className="sr-only">Country</span>
          <select value={country} onChange={(e) => setCountry(e.target.value)}><option value="">Any country</option>
            {COUNTRY_GROUPS.map((g) => <optgroup key={g} label={g}>{COUNTRIES.filter((c) => c.group === g).map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</optgroup>)}</select></label>
        <SitePicker off={off} onChange={setOff} paidReady={paidReady} region={region} counts={counts} />
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
        actions={shown.length > 0 ? <button type="button" className="btn btn-primary btn-sm" data-coach="find-campaign" disabled={Boolean(adding) || !profiles.data} onClick={() => void addShown()}>{adding || (sales ? `Turn ${Math.min(companies.length, 40)} into leads and write emails` : `Track these ${Math.min(shown.length, 40)} jobs`)}</button> : undefined}>
        <ul className="site-lines" aria-label="What each site returned">
          {lines.map((l) => <li key={l.name} className={l.ok ? 'is-ok' : 'is-off'}><span aria-hidden="true">{l.ok ? '✓' : '○'}</span> <strong>{l.name}</strong> {l.text}</li>)}
        </ul>
      </Card>
      {sales && companies.length > 0 && <div className="row wrap">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => saveBlob(new Blob([companiesCsv(companies)], { type: 'text/csv;charset=utf-8' }), safeFilename(`companies-${found.query}`, 'csv'))}>
          Download {companies.length} for Apollo (CSV)</button>
        <span className="muted-small">Import in Apollo under Accounts, then add them to a sequence.</span>
      </div>}
      {added && <p className="muted-small" role="status">{added}</p>}
      {addError && <ErrorNotice error={addError} what="adding these results" />}
      {count === 0
        ? <Card tone="muted"><p>{sales ? 'No hiring company matched' : 'No job matched'} on any site that answered. Try fewer words, a broader place, or turn off Remote only{contractOnly ? ', Contract only' : ''}{visaOnly ? ' and the visa filter' : ''}.</p></Card>
        : sales && advanced ? <div className="table-card"><div className="table-scroll" role="region" aria-label="Companies hiring, as a table" tabIndex={0}>
          <table className="table company-table">
            <thead><tr><th scope="col">Company</th><th scope="col">Roles</th><th scope="col">Remote</th><th scope="col">Contract</th><th scope="col">Location</th><th scope="col">Sites</th><th scope="col">Links</th></tr></thead>
            <tbody>{companies.slice(0, 100).map((c) => {
              const href = safeHref(c.roles[0].job.boardUrl) ?? undefined
              const titles = [...new Set(c.roles.map((r) => r.job.title))]
              return <tr key={c.company}>
                <th scope="row">{c.company}</th>
                <td>{c.roles.length}: {titles.slice(0, 2).join(', ')}{titles.length > 2 ? ` +${titles.length - 2}` : ''}</td>
                <td>{c.remote ? 'Yes' : 'No'}</td>
                <td>{c.contract ? 'Yes' : 'No'}</td>
                <td>{c.places.slice(0, 2).join('; ') || '—'}</td>
                <td>{c.sites.join(', ')}</td>
                <td className="row wrap">{href && <a href={href} target="_blank" rel="noopener noreferrer">Role ↗<span className="sr-only"> at {c.company} (opens in a new tab)</span></a>}
                  <a href={recruiterSearchUrl(c.company, found.query)} target="_blank" rel="noopener noreferrer">Recruiters ↗<span className="sr-only"> at {c.company} (opens in a new tab)</span></a></td>
              </tr>
            })}</tbody>
          </table></div></div>
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
                  {isRemote(job) && <span className="chip">Remote</span>}
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
