import { AgentStatusCard } from './AgentStatusCard'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CardList, LeadCard } from '../../components/cards'
import { GoalRing } from '../../components/kpi/GoalRing'
import { ActivityCard, SourcesCard, type ActivityRow } from '../../components/kpi/panels'
import { KpiBand, KpiCard } from '../../components/kpi/kpi'
import { formatWhen } from '../applications/applicationStatus'
import type { ActivityFeedItem, AnalyticsOverview, AnalyticsTrend, CampaignSummary, OpportunityPage } from '../../lib/types'
import { useApi } from '../../lib/useApi'
import { activityLine, clampGoal, goalMetric, readGoal } from '../insights/insightsModel'
import { leadChips } from '../../components/cardModel'
import { foundLabel, platformLabel, STATUS_LABELS } from '../opportunities/opportunityModel'
import type { Workspace } from '../shell/shellModel'
import { percent } from './analyticsModel'
import { averageFromBands, greeting, heroFor, lastWeek, strongCount } from './homeModel'

const dateText = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

/** The top of Home: the date, a greeting, one sentence from real counts, the button that fits it, and the weekly goal. */
export function HomeHero({ a, workspace, trend }: Readonly<{ a: AnalyticsOverview; workspace: Workspace; trend: AnalyticsTrend | undefined }>) {
  const sales = workspace === 'sales'
  const hero = heroFor({ sales, awaiting: a.kpis.awaitingApproval, shortlistedNotApplied: a.kpis.shortlistedNotApplied, found: a.kpis.found, qualified: a.kpis.qualified, days: a.days })
  const metric = goalMetric(workspace)
  const goal = clampGoal(readGoal(workspace))
  const done = trend ? lastWeek(trend.points, metric.key) : 0
  const [now] = useState(() => new Date())
  return (
    <section className="ccard hero2" aria-label="Today">
      <div>
        <p className="date">{dateText.format(now)}</p>
        <h2>{greeting(now.getHours())}</h2>
        <p className="lead">{hero.text}</p>
        <div className="acts">
          <Link className="btn btn-primary" to={hero.primary.to} data-coach="start-card">{hero.primary.label}</Link>
          <Link className="btn btn-secondary" to="/wellfound">{sales ? 'Find companies' : 'Find jobs'}</Link>
        </div>
      </div>
      {trend && <GoalRing value={done} goal={goal} label="This week" caption={`${metric.label}. Your goal is ${goal}; change it in Insights.`} />}
    </section>
  )
}

/** Six figures with the change against the period before and the last days as a line. The last tile says why it is empty. */
export function HomeKpis({ a, trend, workspace }: Readonly<{ a: AnalyticsOverview; trend: AnalyticsTrend | undefined; workspace: Workspace }>) {
  const sales = workspace === 'sales'
  const k = a.kpis
  const series = (key: 'found' | 'approved' | 'reached' | 'replied') => trend?.points.slice(-14).map((p) => p[key])
  return (
    <KpiBand six label="Your figures">
      <KpiCard icon="search" tone="blue" label={sales ? 'Companies found' : 'Jobs found'} value={k.found} change={trend && { current: trend.current.found, previous: trend.previous.found }} series={series('found')} to="/opportunities" />
      <KpiCard icon="approvals" tone="amber" label="Waiting for you" value={k.awaitingApproval} sub={k.awaitingApproval ? 'to approve' : 'nothing to approve'} to="/opportunities?view=approvals" />
      <KpiCard icon="check" tone="green" label="Strong, 75+" value={strongCount(a.fitHistogram.bands)} sub="scoring 75 or more" to="/opportunities" />
      <KpiCard icon="outreach" tone="indigo" label={sales ? 'Contacted' : 'Applied'} value={sales ? (k.contacted ?? 0) : (k.applied ?? 0)} change={trend && { current: trend.current.reached, previous: trend.previous.reached }} series={series('reached')} to={sales ? '/outreach' : '/opportunities'} />
      <KpiCard icon="mail" tone="teal" label="Reply rate" value={k.respondedRate === null ? '—' : percent(k.respondedRate)} sub={k.respondedRate === null ? 'No replies recorded yet' : `${k.responded ?? 0} replied`} to="/follow-ups" />
      <KpiCard icon="trend" tone="neutral" label="Average match" value={averageFromBands(a.fitHistogram.bands) ?? '—'} sub={averageFromBands(a.fitHistogram.bands) === null ? 'Nothing scored yet' : 'estimated from score bands'} to="/opportunities" />
    </KpiBand>
  )
}

/** The latest campaign's three best matches, as cards. Nothing is shown until a campaign has results. */
export function BestMatches({ workspace }: Readonly<{ workspace: Workspace }>) {
  const campaigns = useApi<CampaignSummary[]>('/api/v1/campaigns')
  const latest = campaigns.data?.find((c) => c.opportunityCount > 0)
  const list = useApi<OpportunityPage>(latest ? `/api/v1/campaigns/${latest.id}/opportunities?sort=score&take=3` : null)
  const items = (list.data?.items ?? []).filter((o) => o.outcome !== 'Excluded')
  if (items.length === 0) return null
  return (
    <section className="stack-3" aria-label="Best matches">
      <div className="row"><h3 className="section-heading">{workspace === 'sales' ? 'Best leads' : 'Best matches'}</h3><span className="grow" /><Link to="/opportunities">See all</Link></div>
      <CardList label="Best matches">
        {items.map((o) => (
          <LeadCard key={o.id} id={o.id} title={o.title} organization={o.organization} location={o.location} to={`/opportunities/${o.id}`} score={o.score}
            status={STATUS_LABELS[o.status] ?? { text: o.status, tone: 'neutral' }} chips={leadChips({ location: o.location, platformLabel: platformLabel(o.platform) })}
            action={<Link className="btn btn-secondary btn-sm" to={`/opportunities/${o.id}`}>Review<span className="sr-only"> {o.title}</span></Link>}
            found={foundLabel(o.foundAt)} foundAt={o.foundAt} />
        ))}
      </CardList>
    </section>
  )
}

/** Sources health and the last actions, side by side with the funnel on wide screens. */
export function HomeSide({ a, workspace }: Readonly<{ a: AnalyticsOverview; workspace: Workspace }>) {
  const sales = workspace === 'sales'
  const feed = useApi<ActivityFeedItem[]>(`/api/v1/analytics/activity?workspace=${sales ? 'Sales' : 'Candidate'}&take=8`)
  const rows: ActivityRow[] = (feed.data ?? []).map((x) => ({ at: x.at, text: activityLine(x, sales), icon: 'pulse', to: x.opportunityId ? `/opportunities/${x.opportunityId}` : undefined }))
  return (
    <div className="stack-4">
      <SourcesCard rows={a.sources.map((s) => ({ id: s.sourceId, label: s.label, read: s.read, qualified: s.qualified, lastRun: s.lastFetchedAt, failing: s.failing }))} when={formatWhen} />
      {!sales && <AgentStatusCard />}
      <ActivityCard rows={rows} when={formatWhen} />
    </div>
  )
}

