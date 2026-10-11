import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ErrorNotice } from '../../components/ErrorNotice'
import { Icon } from '../../components/icons'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState, LoadingState } from '../../components/States'
import type { AnalyticsOverview, Overview } from '../../lib/types'
import { useApi } from '../../lib/useApi'
import { useShell } from '../shell/ShellContext'
import type { Workspace } from '../shell/shellModel'
import {
  analyticsPath,
  attentionLink,
  formatShortDate,
  funnelRows,
  hasAnyActivity,
  histogramHeights,
  isFirstRun,
  percent,
  shareWidths,
  type SalesModeFilter,
} from './analyticsModel'
import { SampleRunCard } from './SampleRunCard'

/**
 * Design round 3: OverviewFirstRun (nothing set up), Main (Candidate) and OverviewSales.
 * Every figure comes from GET /api/v1/overview or /api/v1/analytics/overview — nothing is estimated.
 */
export function OverviewPage() {
  const overview = useApi<Overview>('/api/v1/overview')
  const { workspace } = useShell()
  const [salesMode, setSalesMode] = useState<SalesModeFilter>('')
  const analytics = useApi<AnalyticsOverview>(overview.data && !isFirstRun(overview.data) ? analyticsPath(workspace, 30, salesMode) : null)

  if (overview.error) return <div className="page"><ErrorNotice error={overview.error} onRetry={overview.reload} what="your overview" /></div>
  if (!overview.data) return <div className="page"><LoadingState label="Loading your overview…" waking={overview.waking} stats={5} rows={4} /></div>
  if (isFirstRun(overview.data)) return <FirstRun />

  const a = analytics.data
  return (
    <div className="page page-wide stack-4">
      <PageHeader
        title={workspace === 'sales' ? 'Sales overview' : 'Your opportunity workspace'}
        subtitle={a ? `${a.campaignCount} ${a.campaignCount === 1 ? 'campaign' : 'campaigns'} in this workspace · last ${a.days} days` : 'Loading figures…'}
        actions={
          <>
            {workspace === 'sales' && (
              <label className="pill-select">
                <span>Mode</span>
                <select value={salesMode} onChange={(e) => setSalesMode(e.target.value as SalesModeFilter)}>
                  <option value="">All Sales modes</option>
                  <option value="Customer">Customers</option>
                  <option value="Partner">Partners</option>
                  <option value="Investor">Investors</option>
                  <option value="Freelance">Freelance</option>
                </select>
              </label>
            )}
            <Link className="btn btn-primary btn-sm" to="/campaigns/new">
              + New campaign
            </Link>
          </>
        }
      />
      {analytics.error && <ErrorNotice error={analytics.error} onRetry={analytics.reload} what="the analytics" />}
      {!a && !analytics.error && <LoadingState label="Computing the figures…" waking={analytics.waking} stats={5} rows={5} />}
      {a && a.activeResearch && (
        <p className="notice notice-neutral">
          <strong>Research running:</strong> {a.activeResearch.campaignName} — {a.activeResearch.stage.toLowerCase()},{' '}
          {a.activeResearch.counts.sourcesDone} of {a.activeResearch.counts.sources} sources done.{' '}
          <Link to={`/research/${a.activeResearch.jobId}`}>Watch it</Link>
        </p>
      )}
      {a && !hasAnyActivity(a) && workspace === 'candidate' && <SampleRunCard />}
      {a && (workspace === 'sales' ? <SalesOverview a={a} /> : <CandidateOverview a={a} overview={overview.data} />)}
    </div>
  )
}

/** The one big call to action on the Overview: go and find something. */
function FindStrip({ workspace }: { workspace: 'candidate' | 'sales' }) {
  return (
    <section className="hero-strip">
      <div className="hero-strip-text">
        <h3 className="section-heading">{workspace === 'sales' ? 'Find companies that are hiring' : 'Find jobs that fit you'}</h3>
        <p className="muted-small">
          {workspace === 'sales'
            ? 'Search LinkedIn, Indeed, SEEK and Wellfound, see the hiring trend, and turn the best into leads.'
            : 'Search LinkedIn, Indeed, SEEK and Wellfound, see what is in demand, and track the best.'}
        </p>
      </div>
      <div className="row wrap hero-strip-actions">
        <Link className="btn btn-primary" to="/wellfound">
          {workspace === 'sales' ? 'Find companies' : 'Find jobs'}
        </Link>
        <Link className="btn btn-ghost btn-sm" to="/campaigns/new">
          New campaign
        </Link>
      </div>
    </section>
  )
}

function Kpi({ label, value, sub, tone }: { label: string; value: string | number; sub: string; tone?: 'warning' | 'muted' }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value op-numeric ${tone === 'warning' ? 'text-warning' : tone === 'muted' ? 'muted' : ''}`}>{value}</div>
      <div className="muted-small">{sub}</div>
    </div>
  )
}

function Panel({ title, aside, children, className = '' }: { title: string; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`}>
      <header className="panel-head">
        <h3 className="eyebrow">{title}</h3>
        <div className="grow" />
        {aside && <span className="muted-small">{aside}</span>}
      </header>
      <div className="panel-body">{children}</div>
    </section>
  )
}

function Funnel({ a, title, tone }: { a: AnalyticsOverview; title: string; tone: 'teal' | 'blue' }) {
  const rows = funnelRows(a.funnel)
  return (
    <Panel title={title} aside={`${a.sources.length} ${a.sources.length === 1 ? 'source' : 'sources'} · last ${a.days} days`}>
      <ul className="funnel plain-list">
        {rows.map((r) => (
          <li key={r.key} className={r.count === null ? 'funnel-off' : ''} title={r.note}>
            <span className="funnel-label">{r.label}</span>
            <span className="funnel-count op-numeric">{r.count ?? '—'}</span>
            <span className={`funnel-track funnel-${tone}`}>
              <i style={{ width: `${r.width}%` }} />
            </span>
            <span className="muted-small funnel-prev">{r.count === null ? 'not tracked yet' : (r.ofPrevious ?? '')}</span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function Histogram({ a }: { a: AnalyticsOverview }) {
  const { bands, threshold, aboveThreshold } = a.fitHistogram
  const heights = histogramHeights(bands)
  const total = bands.reduce((n, b) => n + b.count, 0)
  return (
    <Panel title="Fit score distribution">
      {total === 0 ? (
        <p className="muted-small">No qualified opportunities in this window yet, so there is nothing to plot.</p>
      ) : (
        <>
          <div className="histogram" role="img" aria-label={`Qualified opportunities by fit band: ${bands.map((b) => `${b.from}–${b.to}: ${b.count}`).join(', ')}`}>
            {bands.map((b, i) => (
              <div key={b.from} className={`histogram-col ${threshold !== null && b.from >= threshold ? 'is-above' : ''}`}>
                <span className="histogram-n">{b.count || ''}</span>
                <i style={{ height: `${Math.max(heights[i], b.count ? 4 : 1)}%` }} />
                <span className="histogram-x">{i % 2 === 0 ? b.from : ''}</span>
              </div>
            ))}
          </div>
          <p className="muted-small">
            Qualified opportunities by score band.
            {threshold !== null && (
              <>
                {' '}
                Your suggest threshold is <strong>{threshold}</strong> — {aboveThreshold ?? 0} sit at or above it.
              </>
            )}
          </p>
        </>
      )}
    </Panel>
  )
}

function RankedBars({ title, rows, total, tone, empty, footer }: { title: string; rows: { label: string; count: number }[]; total?: number; tone: string; empty: string; footer?: React.ReactNode }) {
  const widths = shareWidths(rows.map((r) => r.count))
  return (
    <Panel title={title}>
      {rows.length === 0 ? (
        <p className="muted-small">{empty}</p>
      ) : (
        <ul className="ranked plain-list">
          {rows.map((r, i) => (
            <li key={r.label}>
              <span className="ranked-label">{r.label}</span>
              <span className={`ranked-track ranked-${tone}`}>
                <i style={{ width: `${widths[i]}%` }} />
              </span>
              <span className="muted-small op-numeric ranked-n">{total ? `${r.count} of ${total}` : r.count}</span>
            </li>
          ))}
        </ul>
      )}
      {footer && <p className="muted-small">{footer}</p>}
    </Panel>
  )
}

function Sources({ a }: { a: AnalyticsOverview }) {
  return (
    <Panel title="Source performance">
      {a.sources.length === 0 ? (
        <p className="muted-small">No source has been read in this window.</p>
      ) : (
        <div className="table-scroll" tabIndex={0} role="region" aria-label="Source performance table">
          <table className="mini-table">
            <thead>
              <tr>
                <th>Source</th>
                <th className="op-num">Read</th>
                <th className="op-num">Qualified</th>
                <th className="op-num">Rate</th>
                <th>Last run</th>
              </tr>
            </thead>
            <tbody>
              {a.sources.map((s) => (
                <tr key={s.sourceId}>
                  <td className={s.failing ? 'text-warning' : ''}>{s.label}</td>
                  <td className="op-num">{s.read}</td>
                  <td className="op-num">{s.qualified}</td>
                  <td className={`op-num ${s.failing ? 'text-warning' : ''}`}>{s.failing ? 'failing' : percent(s.rate)}</td>
                  <td>{formatShortDate(s.lastFetchedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}

function CandidateOverview({ a, overview }: { a: AnalyticsOverview; overview: Overview }) {
  const { advanced } = useShell()
  const k = a.kpis
  const perDay = a.applicationsPerDay ?? []
  const dayMax = Math.max(1, ...perDay.map((d) => d.applied))
  const replies = perDay.reduce((n, d) => n + d.replies, 0)
  const appliedTotal = perDay.reduce((n, d) => n + d.applied, 0)
  return (
    <>
      <FindStrip workspace="candidate" />
      <div className={advanced ? 'kpi-strip' : 'kpi-strip kpi-strip-4'}>
        <Kpi label="Waiting on you" value={k.awaitingApproval} sub="jobs to approve" tone={k.awaitingApproval ? 'warning' : undefined} />
        <Kpi label="Shortlisted" value={k.shortlisted} sub={`${k.shortlistedNotApplied} not yet applied`} />
        <Kpi label={`Applied · ${a.days} days`} value={k.applied ?? '—'} sub={advanced ? `${k.appliedByAgent ?? 0} agent · ${k.appliedByYou ?? 0} by you` : 'marked applied by you'} />
        <Kpi label="Responded" value={k.responded ?? '—'} sub={k.respondedRate === null ? 'no applications yet' : `${percent(k.respondedRate)} of applications`} />
        {advanced && <>
        <Kpi label="Qualify rate" value={`${k.qualified} / ${k.found}`} sub={`${percent(k.qualifyRate)} of what was found`} />
        <Kpi label="Agent needs you" value={k.agentNeedsYou || overview.needsManual} sub="captcha or an extra question" tone={k.agentNeedsYou ? 'warning' : undefined} />
        </>}
      </div>

      <div className="panel-grid-2">
        <Panel
          title="Needs your attention"
          aside={
            <Link className="btn btn-secondary btn-sm" to="/campaigns">
              Queue a run
            </Link>
          }
        >
          {a.attention.length === 0 ? (
            <p className="muted-small">Nothing is waiting on you.</p>
          ) : (
            <ul className="attention plain-list">
              {a.attention.map((x) => {
                const link = attentionLink(x.kind)
                return (
                  <li key={x.kind}>
                    <span className={`dot dot-${link.tone}`} aria-hidden="true" />
                    <span className="grow">{x.detail}</span>
                    <Link to={link.to}>{link.action}</Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>
        {advanced && (
        <Panel title="Applications sent — last 14 days">
          {appliedTotal === 0 ? (
            <p className="muted-small">No applications in the last 14 days — approve jobs, then apply from their page or let the agent do it.</p>
          ) : (
            <div className="days" role="img" aria-label={`${appliedTotal} applications in the last 14 days`}>
              {perDay.map((d) => (
                <div key={d.date} className="days-col" title={`${formatShortDate(d.date)}: ${d.applied} applied, ${d.replies} replies`}>
                  <span className="histogram-n">{d.applied || ''}</span>
                  <i style={{ height: `${d.applied ? Math.max(8, (d.applied / dayMax) * 100) : 2}%` }} />
                </div>
              ))}
            </div>
          )}
          <p>
            <strong className="kpi-inline op-numeric">{appliedTotal}</strong> applications · {replies} replies
          </p>
          <p className="muted-small">Counted from agent results and the jobs you marked applied. Nothing is inferred.</p>
        </Panel>
        )}
      </div>

      {advanced && <>
      <Funnel a={a} title="Pipeline — what happened to everything we read" tone="teal" />

      <div className="panel-grid-3">
        <Histogram a={a} />
        <RankedBars
          title="Why qualified jobs stall"
          tone="amber"
          rows={a.unknownCriteria.map((u) => ({ label: u.label, count: u.unknownCount }))}
          empty="No criterion was left unknown in this window."
          footer={
            <>
              Criteria most often <strong>Unknown</strong>. Unknown never counts as a pass — adding a source that supplies these
              lifts scores honestly.
            </>
          }
        />
        <Sources a={a} />
      </div>
      </>}
    </>
  )
}

function SalesOverview({ a }: { a: AnalyticsOverview }) {
  const { advanced } = useShell()
  const k = a.kpis
  if (a.campaignCount === 0)
    return (
      <>
      <EmptyState
        icon="▦"
        title="No Sales campaign yet"
        actions={
          <>
            <Link className="btn btn-primary btn-sm" to="/campaigns/new">
              Build a Sales campaign
            </Link>
            <Link className="btn btn-secondary btn-sm" to="/profiles/new">
              Write a Product or Services profile
            </Link>
          </>
        }
      >
        Sales works on data you bring: a CSV of companies, a pasted list, a public page or feed, or the live hiring signals from
        Wellfound (Job discovery). There is no built-in company database, so nothing appears until you add a source.
      </EmptyState>
      </>
    )
  const industryTotal = (a.qualifiedByIndustry ?? []).reduce((n, x) => n + x.count, 0)
  return (
    <>
      <FindStrip workspace="sales" />
      <div className="kpi-strip kpi-strip-5">
        <Kpi label="Companies found" value={k.found} sub={`across ${a.campaignCount} ${a.campaignCount === 1 ? 'campaign' : 'campaigns'}`} />
        <Kpi label="Qualified" value={k.qualified} sub={`${percent(k.qualifyRate)} of what was found`} />
        <Kpi label="Shortlisted" value={k.shortlisted} sub="ready to contact" />
        <Kpi label="Contacted" value={k.contacted ?? 0} sub="marked after you sent the approved message" />
        <Kpi label="Responded" value={k.responded ?? 0} sub={k.respondedRate == null ? 'nothing contacted yet' : `${percent(k.respondedRate)} of contacted`} />
      </div>

      <div className="panel-grid-2 panel-grid-wide-left">
        {advanced && <Funnel a={a} title="Pipeline — Sales" tone="blue" />}
        <Panel title="Outreach">
          {a.outreach ? (
            <dl className="criteria-list criteria-row">
              <div><dt>Drafts awaiting your review</dt><dd className="op-numeric">{a.outreach.draftsAwaitingReview}</dd></div>
              <div><dt>Approved, ready for you to send</dt><dd className="op-numeric">{a.outreach.draftsApproved}</dd></div>
              <div><dt>Bids placed / failed</dt><dd className="op-numeric">{a.outreach.bidsPlaced} / {a.outreach.bidsFailed}</dd></div>
              <div><dt>Follow-ups due this week</dt><dd className="op-numeric">{a.outreach.followUpsDue}</dd></div>
              <div><dt>Follow-ups overdue</dt><dd className={`op-numeric ${a.outreach.followUpsOverdue ? 'text-danger' : ''}`}>{a.outreach.followUpsOverdue}</dd></div>
              <div><dt>Reply rate</dt><dd className="op-numeric">{percent(a.outreach.replyRate)}</dd></div>
            </dl>
          ) : <p className="muted-small">No outreach yet.</p>}
          <p className="muted-small">You send every message yourself; OpportunityPilot counts only what you recorded.</p>
          <div className="row">
            <Link className="btn btn-secondary btn-sm" to="/outreach">Open outreach</Link>
            <Link to="/follow-ups">Follow-ups</Link>
          </div>
        </Panel>
      </div>

      {advanced && (
      <div className="panel-grid-3">
        <RankedBars
          title="Qualified by industry"
          tone="blue"
          total={industryTotal}
          rows={(a.qualifiedByIndustry ?? []).map((x) => ({ label: x.industry, count: x.count }))}
          empty="No qualified company has a matched industry yet. Add industries to a Customers campaign's criteria."
        />
        <RankedBars
          title="Buying signals found"
          tone="plum"
          rows={(a.signalsFound ?? []).map((x) => ({ label: x.signal, count: x.count }))}
          empty="No buying signal matched yet. Add signals (e.g. “hiring for the problem area”) to a campaign's criteria."
        />
        <Sources a={a} />
      </div>
      )}
    </>
  )
}

const CHOICES: { key: Workspace; title: string; sub: string; status: string; points: string[] }[] = [
  {
    key: 'candidate',
    title: 'Candidate',
    sub: 'I am looking for work',
    status: 'Built',
    points: ['Every role that fits your skills, scored with evidence', 'Greenhouse, Lever, Wellfound, Indeed and your own browser agent', 'Approve a batch, then apply — nothing goes out without you'],
  },
  {
    key: 'sales',
    title: 'Sales',
    sub: 'I am looking for customers',
    status: 'Built — you send',
    points: ['Find companies that need what you sell, with evidence', 'Live hiring signals from Wellfound, plus your own CSV, list or page', 'Drafts and deals you approve, then send yourself'],
  },
]

/** Design OverviewFirstRun: pick a workspace, then three steps in order. Tiles stay at zero rather than sample data. */
function FirstRun() {
  const { workspace, setWorkspace } = useShell()
  const navigate = useNavigate()
  return (
    <div className="page page-wide stack-4">
      <PageHeader
        title="Welcome to OpportunityPilot"
        subtitle="Pick what you are here to do. You can switch any time from the workspace menu."
      />
      <div className="choice-grid">
        {CHOICES.map((c) => (
          <section key={c.key} className={`choice choice-${c.key} ${workspace === c.key ? 'is-on' : ''}`}>
            <div className="row">
              <span className="onboarding-icon" aria-hidden="true">
                <Icon name={c.key} size={18} />
              </span>
              <span className="stack-0">
                <strong>{c.title}</strong>
                <span className="muted-small">{c.sub}</span>
              </span>
              <div className="grow" />
              <span className={`badge ${c.key === 'candidate' ? 'badge-success' : 'badge-warning'}`}>{c.status}</span>
            </div>
            <ul className="onboarding-points">
              {c.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <button
              type="button"
              className={`btn ${workspace === c.key ? 'btn-primary' : 'btn-secondary'} auth-wide`}
              aria-pressed={workspace === c.key}
              onClick={() => setWorkspace(c.key)}
            >
              {workspace === c.key ? `Using the ${c.title} workspace` : `Use the ${c.title} workspace`}
            </button>
          </section>
        ))}
      </div>

      {workspace === 'candidate' && <SampleRunCard />}

      <h3 className="section-heading">Or set it up yourself — three steps</h3>
      <ol className="first-steps plain-list">
        <li className="card is-next">
          <span className="step-num">1</span>
          <div className="stack-2">
            <strong>Create a profile</strong>
            <span className="muted-small">What you offer, in your own words. You confirm every claim.</span>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/profiles/new')}>
              Start
            </button>
          </div>
        </li>
        <li className="card">
          <span className="step-num">2</span>
          <div className="stack-2">
            <strong>Add sources</strong>
            <span className="muted-small">Greenhouse or Lever boards, a job-board search, a CSV, or pasted text.</span>
            <Link className="btn btn-secondary btn-sm" to="/campaigns/new">
              Add sources
            </Link>
          </div>
        </li>
        <li className="card">
          <span className="step-num">3</span>
          <div className="stack-2">
            <strong>Run a campaign</strong>
            <span className="muted-small">Set criteria, queue a run, then approve what it suggests.</span>
            <Link className="btn btn-secondary btn-sm" to="/campaigns/new">
              Build
            </Link>
          </div>
        </li>
      </ol>


    </div>
  )
}
