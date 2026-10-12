import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { ROLE_LIST_ID, RoleList } from '../suggest/RoleList'
import { HowItWorks } from '../../components/HowItWorks'
import { useShell } from '../shell/ShellContext'
import type { Workspace } from '../shell/shellModel'
import { BoardLiveResults } from './BoardLiveResults'
import { BOARDS, COUNTRIES, NO_VIEW, boardJobsPath, type JobBoard, type ResultView } from './boardModel'

function terms(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 12)
}

/** Search one job board (Indeed, LinkedIn or SEEK): live postings through JSearch first, the same search on the board as a fallback. */
export function BoardSearchPanel({ board, workspace, tabs }: { board: JobBoard; workspace: Workspace; tabs: ReactNode }) {
  const info = BOARDS[board]
  const [keywords, setKeywords] = useState('')
  const [techStack, setTechStack] = useState('')
  const [company, setCompany] = useState('')
  const [location, setLocation] = useState('')
  const [country, setCountry] = useState(info.countries?.[0].value ?? '')
  const [view, setView] = useState<ResultView>(NO_VIEW)
  const [workMode, setWorkMode] = useState('')
  const [jobType, setJobType] = useState('')
  const [experience, setExperience] = useState('')
  const [postedWithinDays, setPostedWithinDays] = useState('')
  const [exclude, setExclude] = useState('')
  const [radius, setRadius] = useState('')
  const { advanced } = useShell()
  const [moreOpen, setMoreOpen] = useState(advanced)
  const [livePath, setLivePath] = useState<string | null>(null)

  const query = useMemo(() => {
    const parts = [keywords.trim(), ...terms(techStack), company.trim(), workMode === 'remote' ? '' : workMode]
    for (const excluded of terms(exclude)) parts.push(`-${excluded.replaceAll(' ', '-')}`)
    return parts.filter(Boolean).join(' ')
  }, [keywords, techStack, company, workMode, exclude])

  const search = { query, location, workMode, postedWithinDays, country, employmentType: jobType, experience, radiusKm: radius }
  const searchUrl = info.searchUrl(search)
  const canSearch = Boolean(query || location.trim())
  const extraCount = [techStack, company, exclude].filter(Boolean).length
  const filterCount = [workMode, jobType, experience, postedWithinDays, radius, board === 'Seek' ? '' : country, view.payOnly, view.hideAgencies, view.newestFirst].filter(Boolean).length

  function submit(event: FormEvent) {
    event.preventDefault()
    if (query) setLivePath(boardJobsPath(board, search))
  }

  function clear() {
    setKeywords(''); setTechStack(''); setCompany(''); setLocation(''); setWorkMode(''); setJobType('')
    setExperience(''); setPostedWithinDays(''); setExclude(''); setRadius(''); setView(NO_VIEW); setCountry(info.countries?.[0].value ?? ''); setLivePath(null)
  }

  return <>
    <RoleList />
    <form className="search-hero" onSubmit={submit} aria-label={`Search ${info.name}`}>
      {tabs}
      <div className="search-bar" data-coach="find-search">
        <label className="search-field search-field-main"><span className="sr-only">{workspace === 'candidate' ? 'Role or keywords' : 'Hiring role or demand signal'}</span>
          <input list={ROLE_LIST_ID} value={keywords} onChange={(event) => setKeywords(event.target.value)} placeholder={workspace === 'candidate' ? 'Role or keywords, e.g. .NET developer' : 'Role companies are hiring, e.g. React developer'} /></label>
        <label className="search-field"><span className="sr-only">Location</span>
          <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder={board === 'Seek' ? 'Sydney, Melbourne…' : 'Location, e.g. Bengaluru'} /></label>
        <button className="btn btn-primary" type="submit" disabled={!query}>Search {info.name}</button>
      </div>
      <div className="search-tools">
        <button type="button" className="btn btn-ghost btn-sm" data-coach="find-filters" aria-expanded={moreOpen} onClick={() => setMoreOpen(!moreOpen)}>{moreOpen ? 'Hide filters' : `More filters${extraCount + filterCount ? ` (${extraCount + filterCount})` : ''}`}</button>
        {(canSearch || extraCount > 0 || filterCount > 0) && <button type="button" className="btn btn-ghost btn-sm" onClick={clear}>Clear</button>}
        <span className="grow" />
        {query && <span className="muted-small search-query" title="The query sent to the job board">Query: {query}</span>}
        {canSearch ? <a className="btn btn-ghost btn-sm" href={searchUrl} target="_blank" rel="noopener noreferrer">Open on {info.name} ↗<span className="sr-only"> (opens in a new tab)</span></a> : null}
      </div>
      {moreOpen && <>
      <div className="filter-row" role="group" aria-label="Optional filters — all optional">
        <label className="chip-select"><span>Date posted</span><select value={postedWithinDays} onChange={(event) => setPostedWithinDays(event.target.value)}><option value="">Any time</option><option value="1">Past 24 hours</option><option value="3">Past 3 days</option><option value="7">Past week</option><option value="14">Past month</option></select></label>
        <label className="chip-select"><span>Job type</span><select value={jobType} onChange={(event) => setJobType(event.target.value)}><option value="">Any type</option><option value="FULLTIME">Full time</option><option value="PARTTIME">Part time</option><option value="CONTRACTOR">Contract</option><option value="INTERN">Internship</option><option value="FULLTIME,CONTRACTOR">Full time or contract</option></select></label>
        <label className="chip-select"><span>Experience</span><select value={experience} onChange={(event) => setExperience(event.target.value)}><option value="">Any level</option><option value="no_experience">No experience</option><option value="under_3_years_experience">Under 3 years</option><option value="more_than_3_years_experience">3+ years</option><option value="no_degree">No degree needed</option></select></label>
        <label className="chip-select"><span>Work mode</span><select value={workMode} onChange={(event) => setWorkMode(event.target.value)}><option value="">Any mode</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="in-person">In person</option></select></label>
        <label className="chip-select"><span>Within</span><select value={radius} onChange={(event) => setRadius(event.target.value)} disabled={!location.trim()} title={location.trim() ? undefined : 'Enter a location first'}><option value="">Any distance</option><option value="10">10 km</option><option value="25">25 km</option><option value="50">50 km</option><option value="100">100 km</option></select></label>
        <label className="chip-select"><span>Country</span><select value={country} onChange={(event) => setCountry(event.target.value)}>{(info.countries ?? COUNTRIES).map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
        <label className="chip-check"><input type="checkbox" checked={view.payOnly} onChange={(e) => setView({ ...view, payOnly: e.target.checked })} />Pay shown only</label>
        <label className="chip-check"><input type="checkbox" checked={view.hideAgencies} onChange={(e) => setView({ ...view, hideAgencies: e.target.checked })} />Hide staffing &amp; recruiting firms</label>
        <label className="chip-check"><input type="checkbox" checked={view.newestFirst} onChange={(e) => setView({ ...view, newestFirst: e.target.checked })} />Newest first</label>
      </div>
      </>}
      {moreOpen && <div className="search-more filters">
        <label className="field field-wide"><span>Tech stack</span><input value={techStack} onChange={(event) => setTechStack(event.target.value)} placeholder="React, TypeScript, AWS" /></label>
        <label className="field"><span>Company</span><input value={company} onChange={(event) => setCompany(event.target.value)} placeholder="Only this company" /></label>
        <label className="field field-wide"><span>Exclude terms</span><input value={exclude} onChange={(event) => setExclude(event.target.value)} placeholder="WordPress, agency, unpaid" /></label>
      </div>}
      <HowItWorks summary={`How ${info.name} jobs get here — read-only, nothing is applied for you`}>
        <p>{info.boundary} OpportunityPilot does not scrape it. Live results come from JSearch, a licensed Google-for-Jobs data service, and only postings published on {info.name} are kept, each with its {info.name} link. Results are shown, not saved, and cached for a few hours to stay within the free quota.</p>
        <p>{workspace === 'candidate'
          ? `Apply on ${info.name}, then open the job in your pipeline and mark it applied.`
          : `Use the companies hiring your stack as demand signals, then create or update the customer campaign.`}</p>
      </HowItWorks>
    </form>

    {livePath ? <BoardLiveResults key={livePath} board={board} path={livePath} searchUrl={searchUrl} workspace={workspace} query={query} location={location} view={view} />
      : <p className="muted-small search-hint">{workspace === 'candidate' ? `Type a role and press Search to see live ${info.name} jobs.` : `Type a role and press Search to see which companies are hiring on ${info.name}.`}</p>}
  </>
}
