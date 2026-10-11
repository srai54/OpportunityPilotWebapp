import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { ErrorNotice } from '../../components/ErrorNotice'
import { HowItWorks } from '../../components/HowItWorks'
import { LoadingState } from '../../components/States'
import { Badge } from '../../components/StatusBadge'
import type { WellfoundJob } from '../../lib/types'
import { useApi } from '../../lib/useApi'
import { useShell } from '../shell/ShellContext'
import { DATE_OPTIONS, SAMPLE_OPTIONS, headlines, payLine, startupTrend, trendsPath, type TrendCount, type TrendReport, type TrendSearch } from './trendsModel'

function Bars({ title, rows, empty }: Readonly<{ title: string; rows: TrendCount[]; empty: string }>) {
  const max = Math.max(1, ...rows.map((r) => r.count))
  return <section className="panel" aria-label={title}>
    <header className="panel-head"><h3 className="eyebrow">{title}</h3></header>
    <div className="panel-body">
      {rows.length === 0 ? <p className="muted-small">{empty}</p> : <ul className="bar-list">
        {rows.map((r) => <li key={r.name} className="bar-row">
          <span className="bar-name" title={r.name}>{r.name}</span>
          <span className="bar-track" aria-hidden="true"><i style={{ width: `${Math.max(4, (100 * r.count) / max)}%` }} /></span>
          <span className="bar-n op-numeric">{r.count}<small> · {r.sharePercent}%</small></span>
        </li>)}
      </ul>}
    </div>
  </section>
}

function Stat({ label, value, sub }: Readonly<{ label: string; value: string | number; sub: string }>) {
  return <div className="kpi"><span className="kpi-label">{label}</span><strong className="kpi-value op-numeric">{value}</strong><span className="muted-small">{sub}</span></div>
}

function Report({ r }: Readonly<{ r: TrendReport }>) {
  if (r.status !== 'Ready') {
    return <section className="result-blocked"><Badge tone="warning">{r.status === 'NotConfigured' ? 'Trends not set up' : 'Trends unavailable'}</Badge><p className="grow">{r.message}</p></section>
  }
  if (r.sampled === 0) return <p className="muted-small">{r.message}</p>
  const f = r.freshness
  const day = f.last24Hours
  return <div className="stack-4">
    <div className="kpi-strip">
      <Stat label="Postings sampled" value={r.sampled} sub={`${r.pages} search${r.pages === 1 ? '' : 'es'}${r.fromCache ? ' (cached)' : ''}`} />
      <Stat label="Remote" value={`${r.remotePercent}%`} sub="marked remote" />
      <Stat label="Pay shown" value={`${r.payListedPercent}%`} sub="of the postings" />
      <Stat label="Posted in the last day" value={day} sub={`${day + f.last3Days} in 3 days · ${day + f.last3Days + f.lastWeek} in a week`} />
    </div>
    <ul className="headline-list">{headlines(r).map((h) => <li key={h}>{h}</li>)}</ul>
    <div className="panel-grid-2">
      <Bars title="Skills asked for" rows={r.topSkills} empty="No listed skill appears in these postings." />
      <Bars title="Who is hiring" rows={r.topCompanies} empty="No company names." />
    </div>
    <div className="panel-grid-3">
      <Bars title="Sites" rows={r.sites} empty="No site names." />
      <Bars title="Job type" rows={r.employmentTypes} empty="No job type given." />
      <Bars title="Places" rows={r.locations} empty="No city given." />
    </div>
    {r.pay.length > 0 && <section className="panel" aria-label="Pay">
      <header className="panel-head"><h3 className="eyebrow">Pay shown in the postings</h3></header>
      <div className="panel-body"><ul className="plain-list">{r.pay.map((p) => <li key={p.period}><strong className="op-numeric">{payLine(p)}</strong> <span className="muted-small">typical range across {p.postings} posting{p.postings === 1 ? '' : 's'} (currency not given by the source)</span></li>)}</ul></div>
    </section>}
    <p className="muted-small">{r.observedAt ? `Retrieved ${new Date(r.observedAt).toLocaleString()}. ` : ''}{r.quotaRemaining != null ? `${r.quotaRemaining} searches left this month.` : ''}</p>
  </div>
}

function Startups({ workspace }: Readonly<{ workspace: 'candidate' | 'sales' }>) {
  const jobs = useApi<WellfoundJob[]>(`/api/v1/wellfound/jobs?workspace=${workspace === 'sales' ? 'Sales' : 'Candidate'}&take=200`)
  const t = useMemo(() => (jobs.data ? startupTrend(jobs.data) : null), [jobs.data])
  if (jobs.error) return <ErrorNotice error={jobs.error} onRetry={jobs.reload} what="the Wellfound listings" />
  if (!t) return <LoadingState label="Reading stored Wellfound listings…" waking={jobs.waking} rows={2} />
  if (t.sampled === 0) return <p className="muted-small">No Wellfound listings are stored yet. Open Job discovery and refresh the Wellfound tab first.</p>
  return <div className="stack-4">
    <div className="kpi-strip kpi-strip-5">
      <Stat label="Startup jobs" value={t.sampled} sub="stored public listings" />
      <Stat label="Remote" value={`${t.remotePercent}%`} sub="remote-friendly" />
      <Stat label="Salary shown" value={`${t.withSalaryPercent}%`} sub="of the listings" />
      <Stat label="Equity offered" value={`${t.withEquityPercent}%`} sub="of the listings" />
      <Stat label="Top stage" value={t.stages[0]?.name ?? '—'} sub={t.stages[0] ? `${t.stages[0].sharePercent}% of listings` : 'not given'} />
    </div>
    <div className="panel-grid-2">
      <Bars title="Where startups are hiring" rows={t.topPlaces} empty="No places listed." />
      <Bars title="Startups hiring" rows={t.topCompanies} empty="No companies." />
    </div>
  </div>
}

/** Hiring trends inside Find jobs: a sample of the newest postings for a role, across the sites JSearch covers, plus stored Wellfound listings. */
export function TrendsPanel({ workspace, tabs }: Readonly<{ workspace: 'candidate' | 'sales'; tabs: ReactNode }>) {
  const { advanced } = useShell()
  const [form, setForm] = useState<TrendSearch>({ query: '', location: '', datePosted: 'month', pages: 1 })
  const [path, setPath] = useState<string | null>(null)
  const [adv, setAdv] = useState(advanced)
  const report = useApi<TrendReport>(path)

  function submit(event: FormEvent) {
    event.preventDefault()
    setPath(trendsPath(form))
  }

  return <>
    <form className="search-hero" onSubmit={submit} aria-label="Hiring trends search">
      {tabs}
      <div className="search-bar">
        <label className="search-field search-field-main"><span className="sr-only">Role or skill</span>
          <input value={form.query} onChange={(e) => setForm({ ...form, query: e.target.value })} placeholder="Role or skill, e.g. .NET developer, data engineer, sales manager" /></label>
        <label className="search-field"><span className="sr-only">Location</span>
          <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Location, e.g. Bengaluru (optional)" /></label>
        <button className="btn btn-primary" type="submit" disabled={!form.query.trim()}>Show trends</button>
      </div>
      <div className="search-tools">
        <button type="button" className="btn btn-ghost btn-sm" aria-expanded={adv} onClick={() => setAdv(!adv)}>{adv ? 'Hide advanced' : 'Advanced'}</button>
      </div>
      {adv && <div className="filter-row" role="group" aria-label="Advanced settings">
        <label className="chip-select"><span>Posted</span><select value={form.datePosted} onChange={(e) => setForm({ ...form, datePosted: e.target.value })}>{DATE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
        <label className="chip-select"><span>Sample</span><select value={form.pages} onChange={(e) => setForm({ ...form, pages: Number(e.target.value) })}>{SAMPLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
      </div>}
      <HowItWorks summary="How to read this — a sample, not the whole market">
        <p>The numbers come from the newest postings JSearch (Google for Jobs) returns for your search, from every site it covers — LinkedIn, Indeed, Glassdoor, company career pages and more. They show what is being asked for <em>in that sample</em>; they are not market totals, and a different search can give a different picture.</p>
        <p>Each page of about 10 postings uses 1 of your free monthly searches. Repeating the same search within a few hours is free. Skills are counted only from a fixed list, in the posting's title and text.</p>
      </HowItWorks>
    </form>

    {!path && <p className="muted-small search-hint">Type a role or skill and press Show trends.</p>}
    {path && report.error && <ErrorNotice error={report.error} onRetry={report.reload} what="the hiring trends" />}
    {path && !report.error && !report.data && <LoadingState label="Reading the newest postings… this can take up to half a minute" waking={report.waking} rows={3} />}
    {report.data && path && <Report r={report.data} />}

    <h3 className="results-title">Startups on Wellfound</h3>
    <Startups workspace={workspace} />
  </>
}
