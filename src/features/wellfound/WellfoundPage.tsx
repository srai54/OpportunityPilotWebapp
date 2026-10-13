import { useEffect, useMemo, useRef, useState } from 'react'
import { ROLE_LIST_ID, RoleList } from '../suggest/RoleList'
import { useSearchParams } from 'react-router-dom'
import { ErrorNotice } from '../../components/ErrorNotice'
import { CommandBar } from '../command/CommandBar'
import { HowItWorks } from '../../components/HowItWorks'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState, FilteredEmpty, LoadingState } from '../../components/States'
import { Badge } from '../../components/StatusBadge'
import { api } from '../../lib/api'
import type { WellfoundApplication, WellfoundApplicationState, WellfoundActivity, WellfoundJob, WellfoundJobState, WellfoundKpis, WellfoundStatus } from '../../lib/types'
import { useApi } from '../../lib/useApi'
import { safeHref } from '../opportunities/opportunityModel'
import { useShell } from '../shell/ShellContext'
import { TrendsPanel } from '../trends/TrendsPage'
import { AllSitesPanel } from './AllSitesPanel'
import { BoardSearchPanel } from './BoardSearchPanel'
import type { JobBoard } from './boardModel'

function money(value: number | null, currency: string | null) {
  if (value === null) return '—'
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 0 }).format(value)
}

export function WellfoundPage() {
  const { workspace, advanced } = useShell()
  const ws = workspace === 'sales' ? 'Sales' : 'Candidate'
  const [params] = useSearchParams()
  const [provider, setProvider] = useState<'all' | 'wellfound' | 'trends' | JobBoard>(params.get('tab') === 'trends' ? 'trends' : params.get('tab') === 'wellfound' ? 'wellfound' : 'all')
  const [keyword, setKeyword] = useState('')
  const [company, setCompany] = useState('')
  const [location, setLocation] = useState('')
  const [techStack, setTechStack] = useState('')
  const [workMode, setWorkMode] = useState('')
  const [equityOnly, setEquityOnly] = useState(false)
  const [minSalary, setMinSalary] = useState('')
  const [fundingStage, setFundingStage] = useState('')
  const [industry, setIndustry] = useState('')
  const [employmentType, setEmploymentType] = useState('')
  const [postedWithinDays, setPostedWithinDays] = useState('')
  const [jobState, setJobState] = useState('')
  const [sort, setSort] = useState('newest')
  const [busy, setBusy] = useState(false)
  const [moreOpen, setMoreOpen] = useState(advanced)
  const [actionError, setActionError] = useState<Error>()
  const [syncWarning, setSyncWarning] = useState('')
  const autoSyncAttempted = useRef(false)

  const jobsPath = useMemo(() => {
    const q = new URLSearchParams({ workspace: ws, take: '100' })
    if (keyword.trim()) q.set('keyword', keyword.trim())
    if (company.trim()) q.set('company', company.trim())
    if (location.trim()) q.set('location', location.trim())
    if (techStack.trim()) q.set('techStack', techStack.trim())
    if (workMode) q.set('workMode', workMode)
    if (equityOnly) q.set('equityOnly', 'true')
    if (minSalary) q.set('minSalary', minSalary)
    if (fundingStage) q.set('fundingStage', fundingStage)
    if (industry.trim()) q.set('industry', industry.trim())
    if (employmentType) q.set('employmentType', employmentType)
    if (postedWithinDays) q.set('postedWithinDays', postedWithinDays)
    if (jobState) q.set('state', jobState)
    q.set('sort', sort)
    return `/api/v1/wellfound/jobs?${q}`
  }, [ws, keyword, company, location, techStack, workMode, equityOnly, minSalary, fundingStage, industry, employmentType, postedWithinDays, jobState, sort])

  const status = useApi<WellfoundStatus>('/api/v1/wellfound/status')
  const jobs = useApi<WellfoundJob[]>(jobsPath)
  const kpis = useApi<WellfoundKpis>(`/api/v1/wellfound/kpis?workspace=${ws}`)
  const applications = useApi<WellfoundApplication[]>(workspace === 'sales' ? '/api/v1/wellfound/applications' : null)
  const activities = useApi<WellfoundActivity[]>('/api/v1/wellfound/activities?take=20')

  function reloadAll() {
    jobs.reload(); kpis.reload(); applications.reload(); activities.reload()
  }

  async function syncPublic() {
    if (busy) return
    setBusy(true); setSyncWarning('')
    try { await api('/api/v1/wellfound/public/sync', { method: 'POST' }); reloadAll() }
    catch { setSyncWarning('Live refresh is temporarily unavailable. Stored public listings remain available below.') }
    finally { setBusy(false) }
  }

  useEffect(() => {
    if (autoSyncAttempted.current || !jobs.data || jobs.loading) return
    if (jobs.data.length === 0 || jobs.data.every((job) => job.isDemo)) {
      autoSyncAttempted.current = true
      // Same path as the button, so the button is disabled while this first refresh runs (no double refresh).
      void syncPublic()
    }
    // This one-shot migration is intentionally keyed only to the first loaded job collection.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs.data, jobs.loading])

  async function changeJob(job: WellfoundJob, state: WellfoundJobState) {
    setActionError(undefined)
    try {
      await api(`/api/v1/wellfound/jobs/${job.id}/state`, { method: 'PATCH', body: JSON.stringify({ state, expectedVersion: job.version }) })
      reloadAll()
    } catch (e) { setActionError(e as Error) }
  }

  async function changeApplication(item: WellfoundApplication, state: WellfoundApplicationState) {
    setActionError(undefined)
    try {
      await api(`/api/v1/wellfound/applications/${item.id}/state`, { method: 'PATCH', body: JSON.stringify({ state, expectedVersion: item.version, confirmed: true }) })
      reloadAll()
    } catch (e) { setActionError(e as Error) }
  }

  const noData = jobs.data?.length === 0 && (!applications.data || applications.data.length === 0)
  const activeFilterCount = [keyword, company, location, techStack, workMode, minSalary, fundingStage, industry,
    employmentType, postedWithinDays, jobState, equityOnly ? 'equity' : ''].filter(Boolean).length

  function clearFilters() {
    setKeyword(''); setCompany(''); setLocation(''); setTechStack(''); setWorkMode(''); setEquityOnly(false)
    setMinSalary(''); setFundingStage(''); setIndustry(''); setEmploymentType(''); setPostedWithinDays('')
    setJobState(''); setSort('newest')
  }

  const tabs = <div className="segmented" role="group" aria-label="Job source" data-coach="find-tabs">
    <button type="button" className={provider === 'all' ? 'active' : ''} aria-pressed={provider === 'all'} onClick={() => setProvider('all')}>All sites</button>
    <button type="button" className={provider === 'wellfound' ? 'active' : ''} aria-pressed={provider === 'wellfound'} onClick={() => setProvider('wellfound')}>Wellfound</button>
    {(['Indeed', 'LinkedIn', 'Seek'] as const).map((board) => <button key={board} type="button" className={provider === board ? 'active' : ''} aria-pressed={provider === board} onClick={() => setProvider(board)}>{board === 'Seek' ? 'SEEK' : board}</button>)}
    <button type="button" className={provider === 'trends' ? 'active' : ''} aria-pressed={provider === 'trends'} onClick={() => setProvider('trends')}>Trends</button>
  </div>
  const extraCount = [company, techStack, workMode, minSalary, fundingStage, industry, employmentType, postedWithinDays, jobState, equityOnly ? 'equity' : ''].filter(Boolean).length

  return <div className="page page-wide stack-4">
    <PageHeader title={workspace === 'sales' ? 'Find companies' : 'Find jobs'} subtitle={workspace === 'sales'
      ? 'See which companies are hiring right now. One search covers every site we can read, with live hiring signals.'
      : 'One search over every site we can read, each job linked to its original posting.'} />
    <CommandBar />

    {provider === 'trends' ? <TrendsPanel workspace={workspace === 'sales' ? 'sales' : 'candidate'} tabs={tabs} /> : provider === 'all' ? <AllSitesPanel workspace={workspace} tabs={tabs} /> : provider !== 'wellfound' ? <BoardSearchPanel key={provider} board={provider} workspace={workspace} tabs={tabs} /> : <>

    <RoleList />
    <form className="search-hero" aria-label="Search Wellfound" onSubmit={(e) => e.preventDefault()}>
      {tabs}
      <div className="search-bar" data-coach="find-search">
        <label className="search-field search-field-main"><span className="sr-only">Role or keywords</span><input list={ROLE_LIST_ID} value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder={workspace === 'sales' ? 'Role companies are hiring, e.g. React developer' : 'Role or keywords, e.g. Backend engineer'} /></label>
        <label className="search-field"><span className="sr-only">Location</span><input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location, e.g. India, Remote" /></label>
        <button className="btn btn-primary" type="button" disabled={busy} onClick={syncPublic}>{busy ? 'Refreshing…' : 'Refresh live jobs'}</button>
      </div>
      <div className="search-tools">
        <button type="button" className="btn btn-ghost btn-sm" data-coach="find-filters" aria-expanded={moreOpen} onClick={() => setMoreOpen(!moreOpen)}>{moreOpen ? 'Hide filters' : `More filters${extraCount ? ` (${extraCount})` : ''}`}</button>
        {activeFilterCount > 0 && <button className="btn btn-ghost btn-sm" type="button" onClick={clearFilters}>Clear {activeFilterCount} filter{activeFilterCount === 1 ? '' : 's'}</button>}
        <span className="grow" />
        <label className="inline-select"><span>Sort</span><select value={sort} onChange={(e) => setSort(e.target.value)}><option value="newest">Newest</option><option value="salary">Highest salary</option><option value="company">Company A–Z</option><option value="match">Best match</option></select></label>
      </div>
      {moreOpen && <div className="search-more filters">
        <label className="field"><span>Company</span><input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company name" /></label>
        <label className="field field-wide"><span>Tech stack</span><input value={techStack} onChange={(e) => setTechStack(e.target.value)} placeholder="React, TypeScript, PostgreSQL" /></label>
        <label className="field"><span>Work mode</span><select value={workMode} onChange={(e) => setWorkMode(e.target.value)}><option value="">Any mode</option><option value="Remote">Remote</option><option value="Hybrid">Hybrid</option><option value="In office">In office</option></select></label>
        <label className="field"><span>Minimum salary</span><input type="number" min="0" value={minSalary} onChange={(e) => setMinSalary(e.target.value)} placeholder="100000" /></label>
        <label className="field"><span>Funding</span><select value={fundingStage} onChange={(e) => setFundingStage(e.target.value)}><option value="">Any stage</option><option>Seed</option><option>Series A</option><option>Series B</option><option>Series E</option></select></label>
        <label className="field"><span>Industry</span><input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="FinTech, SaaS…" /></label>
        <label className="field"><span>Employment</span><select value={employmentType} onChange={(e) => setEmploymentType(e.target.value)}><option value="">Any type</option><option value="Full time">Full time</option><option value="Part time">Part time</option><option value="Contract">Contract</option><option value="Internship">Internship</option></select></label>
        <label className="field"><span>Date posted</span><select value={postedWithinDays} onChange={(e) => setPostedWithinDays(e.target.value)}><option value="">Any time</option><option value="1">Past 24 hours</option><option value="3">Past 3 days</option><option value="7">Past week</option><option value="14">Past 2 weeks</option><option value="30">Past month</option></select></label>
        <label className="field"><span>Your decision</span><select value={jobState} onChange={(e) => setJobState(e.target.value)}><option value="">Any state</option><option>New</option><option>Saved</option><option>Applied</option><option>Interviewing</option><option>Offered</option><option>Rejected</option></select></label>
        <label className="check-row"><input type="checkbox" checked={equityOnly} onChange={(e) => setEquityOnly(e.target.checked)} />Equity offered</label>
      </div>}
      <HowItWorks summary="How Wellfound jobs get here — public listings only, recruiter account not connected">
        <p>{status.data?.detail ?? 'OpportunityPilot reads the anonymous public Wellfound jobs page.'} Every filter must match stored public facts; unknown facts are not guessed.</p>
        <p>Saving and applying happen on Wellfound. Recruiter-owned jobs and applicants need Wellfound Recruit authorization (<a href="https://help.wellfound.com/article/1219-connect-wellfound-to-your-ai-assistant" target="_blank" rel="noreferrer">requirements</a>), which is not connected.</p>
      </HowItWorks>
    </form>

    {actionError && <ErrorNotice error={actionError} onRetry={() => setActionError(undefined)} what="the Wellfound action" />}
    {syncWarning && <p className="notice notice-warning" role="status">{syncWarning} <button className="btn btn-secondary btn-sm" type="button" onClick={syncPublic}>Try refresh again</button></p>}

    {jobs.data && jobs.data.length > 0 && <div className="results-head">
      <h3 className="results-title">{jobs.data.length} {workspace === 'sales' ? 'hiring signal' : 'role'}{jobs.data.length === 1 ? '' : 's'}</h3>
      <Badge tone="success">Live public listings</Badge>
      <span className="grow" />
      {kpis.data && <div className="stat-chips">{(workspace === 'candidate'
        ? [['Saved', kpis.data.saved], ['Applied', kpis.data.applied], ['Interviewing', kpis.data.interviewing], ['Offers', kpis.data.offered]] as const
        : [['Owned jobs', kpis.data.jobs], ['Applicants', kpis.data.applicants], ['Shortlisted', kpis.data.shortlisted], ['Rejected', kpis.data.rejected]] as const
      ).map(([label, value]) => <span key={label} className="stat-chip"><strong className="op-numeric">{value}</strong> {label}</span>)}</div>}
    </div>}

    {(jobs.loading || applications.loading) && !jobs.data && <LoadingState label="Loading Wellfound workspace…" rows={4} />}
    {jobs.error && <ErrorNotice error={jobs.error} onRetry={jobs.reload} what="Wellfound jobs" />}
    {noData && activeFilterCount > 0 && <FilteredEmpty onClear={clearFilters}>No stored public role contains every selected fact. Clear filters or refresh the source.</FilteredEmpty>}
    {noData && activeFilterCount === 0 && <EmptyState icon="◇" title="No public Wellfound jobs yet" actions={<button className="btn btn-primary btn-sm" onClick={syncPublic}>Fetch live public jobs</button>}>Refresh the anonymous public Wellfound jobs page. Recruiter-owned jobs and applicants remain OAuth-only.</EmptyState>}

    {jobs.data && jobs.data.length > 0 && <section className="result-grid" aria-label="Wellfound jobs">
      {jobs.data.map((job) => <article className="result-card result-card-col" key={job.id}>
        <div className="result-main">
          <div className="row wrap result-badges">{job.isDemo && <Badge tone="warning">Legacy demo</Badge>}{job.scope === 'RecruiterOwned' && <Badge tone="primary">OAuth synced</Badge>}{job.matchScore !== null && <Badge tone="primary">{job.matchScore}% match</Badge>}{job.state !== 'New' && <Badge tone={job.state === 'Rejected' ? 'neutral' : 'success'}>{job.state}</Badge>}</div>
          {safeHref(job.applyUrl) ? <a className="result-title" href={safeHref(job.applyUrl)!} target="_blank" rel="noopener noreferrer">{job.title}<span className="sr-only"> (opens on Wellfound in a new tab)</span></a> : <span className="result-title">{job.title}</span>}
          <div className="result-sub">{[job.companyName, job.location || 'Location unknown', job.remoteType || 'Work mode unknown', job.fundingStage].filter(Boolean).join(' · ')}</div>
          <div className="result-facts">{(job.salaryMin !== null || job.salaryMax !== null) ? <span><small>Salary</small> {money(job.salaryMin, job.currency)} – {money(job.salaryMax, job.currency)}</span> : <span><small>Salary</small> not listed</span>}{(job.equityMin !== null || job.equityMax !== null) && <span><small>Equity</small> {job.equityMin ?? '—'}% – {job.equityMax ?? '—'}%</span>}{job.visaSponsorship === true && <span>Visa sponsorship</span>}</div>
          {job.summary && <p className="result-snippet">{job.summary}</p>}
          {job.skills.length > 0 && <div className="row wrap">{job.skills.slice(0, 6).map((skill) => <span key={skill} className="skill-chip">{skill}</span>)}{job.skills.length > 6 && <span className="muted-small">+{job.skills.length - 6}</span>}</div>}
        </div>
        <div className="row wrap result-actions">{safeHref(job.applyUrl) && <a className="btn btn-secondary btn-sm" href={safeHref(job.applyUrl)!} target="_blank" rel="noopener noreferrer">Open on Wellfound ↗<span className="sr-only"> (opens in a new tab)</span></a>}{workspace === 'candidate' && <><button className="btn btn-primary btn-sm" type="button" onClick={() => changeJob(job, 'Saved')}>Save</button><button className="btn btn-ghost btn-sm" type="button" onClick={() => changeJob(job, 'Applied')}>Mark applied</button></>}</div>
      </article>)}
    </section>}

    {advanced && workspace === 'sales' && applications.data && applications.data.length > 0 && <section className="panel">
      <header className="panel-head"><div><h3 className="eyebrow">Applicant review</h3><p className="muted-small">Demo actions are local only. Live accept/reject will require a fresh MCP confirmation.</p></div></header>
      <div className="table-scroll"><table className="table"><thead><tr><th>Candidate</th><th>Role</th><th>Fit</th><th>State</th><th>Decision</th></tr></thead><tbody>{applications.data.map((item) => <tr key={item.id}><td className="table-role">{item.candidateName}<div className="muted-small">{item.isDemo ? 'Demo applicant' : 'Provider applicant'}</div></td><td>{item.jobTitle}</td><td className="op-num">{item.fitScore ?? '—'}%</td><td><Badge>{item.state}</Badge></td><td><div className="row wrap"><button className="btn btn-primary btn-sm" onClick={() => changeApplication(item, 'Shortlisted')}>Shortlist</button><button className="btn btn-secondary btn-sm" onClick={() => changeApplication(item, 'Reviewing')}>Review</button><button className="btn btn-ghost btn-sm" onClick={() => changeApplication(item, 'Rejected')}>Not a fit</button></div></td></tr>)}</tbody></table></div>
    </section>}


    {advanced && activities.data && activities.data.length > 0 && <section className="panel"><header className="panel-head"><h3 className="eyebrow">Wellfound activity</h3><span className="muted-small">{activities.data.length} recent events</span></header><ul className="state-list panel-body">{activities.data.map((item) => <li key={item.id}><span><strong>{item.kind}</strong><br /><span className="muted-small">{item.detail}</span></span><time className="muted-small" dateTime={item.occurredAt}>{new Date(item.occurredAt).toLocaleString()}</time></li>)}</ul></section>}
    </>}
  </div>
}
