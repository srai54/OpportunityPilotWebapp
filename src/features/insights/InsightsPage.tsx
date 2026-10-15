import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { Card } from '../../components/cards'
import { KpiBand, KpiCard } from '../../components/kpi/kpi'
import { ErrorNotice } from '../../components/ErrorNotice'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState, LoadingState } from '../../components/States'
import type { ActivityFeedItem, AnalyticsOverview, AnalyticsTrend } from '../../lib/types'
import { useApi } from '../../lib/useApi'
import { formatWhen } from '../applications/applicationStatus'
import { journeySteps } from '../journey/journeyModel'
import { analyticsPath } from '../overview/analyticsModel'
import { useShell } from '../shell/ShellContext'
import { HBars, ProgressBar, TrendChart } from './Charts'
import {
  ACTIVITY_GROUPS, ACTIVITY_RANGES, activityLine, activityPulse, agoLabel, activityPath, clampGoal, hasMore, type ActivityGroup, trimBands, funnelRows, goalMetric, goalProgress, kpisFor, lastDays, readGoal, seriesFor, sumOf, trendSummary, writeGoal,
} from './insightsModel'

/** 1 = today (the default); the trend chart needs at least a week, so it shows the last 7 days then. */
const RANGES = [1, 7, 14, 30, 90] as const
const KPI_ICONS = ['search', 'check', 'approvals', 'outreach', 'mail', 'trend'] as const
const KPI_TONES = ['blue', 'teal', 'green', 'indigo', 'amber', 'neutral'] as const

/**
 * Advanced → Insights: KPIs with change, a trend chart, progress (path and weekly goal), the funnel, fit, sources and, for Sales,
 * industries and signals. Every figure is counted from the person's own stored records; nothing is estimated, and market data is
 * not mixed in (it has its own, labelled, tab under Find).
 */
/** Keyed by workspace so each side keeps its own goal and range. */
export function InsightsPage() {
  return <InsightsView key={useShell().workspace} />
}

/** "My activity": the person's own recorded actions, newest first, filtered by kind and date, with "Load more". Lines about a job or lead link to it. */
function ActivityPanel({ sales }: Readonly<{ sales: boolean }>) {
  const [group, setGroup] = useState<ActivityGroup>('all')
  const [days, setDays] = useState<number>(1)
  // Keyed so changing a filter starts again from the newest page.
  return <ActivityList key={`${group}|${days}`} sales={sales} group={group} days={days} onGroup={setGroup} onDays={setDays} />
}

/** The live line above "My activity": a pulsing dot while the page is open, the last 14 days as bars, a count per kind, and the streak. Refreshes itself every 30 seconds. */
function ActivityPulseBar({ sales }: Readonly<{ sales: boolean }>) {
  const [start] = useState(() => new Date())
  const [now, setNow] = useState(start)
  const feed = useApi<ActivityFeedItem[]>(activityPath(sales, 'all', 14, null, start, 100))
  const { reload } = feed
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') { reload(); setNow(new Date()) } }, 30_000)
    return () => clearInterval(t)
  }, [reload])
  if (!feed.data) return null
  const pulse = activityPulse(feed.data, now)
  const max = Math.max(1, ...pulse.perDay)
  return (
    <section className="pulse" aria-label="Your activity at a glance">
      <div className="pulse-head">
        <span className="pulse-live"><span className="pulse-dot" aria-hidden="true" />Live</span>
        <span className="muted-small">{pulse.lastAt ? `Last action ${agoLabel(pulse.lastAt, now)}` : 'No action in the last 14 days'}</span>
        <span className="grow" />
        <span className="muted-small">{pulse.total >= 100 ? '100+' : pulse.total} in 14 days · {pulse.activeDays} active {pulse.activeDays === 1 ? 'day' : 'days'}{pulse.streak > 1 ? ` · ${pulse.streak}-day streak` : ''}</span>
      </div>
      <div className="pulse-bars" role="img" aria-label={`Actions per day, last 14 days: ${pulse.perDay.join(', ')}`}>
        {pulse.perDay.map((n, i) => <i key={i} className={i === pulse.perDay.length - 1 ? 'is-today' : ''} style={{ height: `${Math.max(6, (n / max) * 100)}%`, opacity: n === 0 ? 0.25 : 1 }} title={`${n}`} />)}
      </div>
      <ul className="pulse-chips">{pulse.byGroup.filter((g) => g.count > 0).map((g) => <li key={g.key} className="chip"><strong>{g.count}</strong> {g.label.toLowerCase()}</li>)}</ul>
    </section>
  )
}

function ActivityList({ sales, group, days, onGroup, onDays }: Readonly<{ sales: boolean; group: ActivityGroup; days: number; onGroup: (g: ActivityGroup) => void; onDays: (d: number) => void }>) {
  // One fixed "now" per filter: a path that includes the current time would change on every render and refetch forever.
  const [now] = useState(() => new Date())
  const first = useApi<ActivityFeedItem[]>(activityPath(sales, group, days, null, now))
  const [more, setMore] = useState<ActivityFeedItem[]>([])
  const [lastPage, setLastPage] = useState<number | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState<Error>()
  const items = [...(first.data ?? []), ...more]
  const canLoadMore = first.data !== undefined && hasMore(lastPage ?? first.data.length)

  async function loadMore() {
    const oldest = items[items.length - 1]
    if (!oldest) return
    setLoadingMore(true); setMoreError(undefined)
    try {
      const page = await api<ActivityFeedItem[]>(activityPath(sales, group, days, oldest.at, now))
      setMore((m) => [...m, ...page])
      setLastPage(page.length)
    } catch (e) { setMoreError(e as Error) } finally { setLoadingMore(false) }
  }

  return (
    <Card title="My activity" actions={<span className="muted-small">newest first</span>}>
<div className="stack-3">
        <ActivityPulseBar sales={sales} />
        <div className="toolbar">
          <div className="segmented" role="group" aria-label="Kind of activity">
            {ACTIVITY_GROUPS.map((g) => (
              <button key={g.key} type="button" className={group === g.key ? 'active' : ''} aria-pressed={group === g.key} onClick={() => onGroup(g.key)}>{g.label}</button>
            ))}
          </div>
          <label className="pill-select">
            <span>Period</span>
            <select value={days} onChange={(e) => onDays(Number(e.target.value))}>
              {ACTIVITY_RANGES.map((r) => <option key={r.days} value={r.days}>{r.label}</option>)}
            </select>
          </label>
        </div>
        {first.error && <ErrorNotice error={first.error} onRetry={first.reload} what="your activity" />}
        {first.loading && !first.data && <LoadingState label="Loading your activity…" waking={first.waking} rows={3} />}
        {first.data?.length === 0 && <p className="muted-small">Nothing recorded for this filter. Searches, approvals, drafts, applications and follow-ups show up here with their date.</p>}
        {items.length > 0 && (
          <ol className="activity-list">
            {items.map((x, i) => (
              <li key={`${x.at}-${x.kind}-${i}`}>
                <time className="muted-small" dateTime={x.at}>{formatWhen(x.at)}</time>
                {x.opportunityId ? <Link to={`/opportunities/${x.opportunityId}`}>{activityLine(x, sales)}</Link> : <span>{activityLine(x, sales)}</span>}
              </li>
            ))}
          </ol>
        )}
        {moreError && <ErrorNotice error={moreError} />}
        {canLoadMore && <div className="row"><button type="button" className="btn btn-secondary btn-sm" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? 'Loading…' : 'Load more'}</button></div>}
      </div>
</Card>
  )
}

function InsightsView() {
  const { workspace, overview } = useShell()
  const sales = workspace === 'sales'
  const [days, setDays] = useState<(typeof RANGES)[number]>(1)
  const trendDays = Math.max(7, days)
  const rangeLabel = days === 1 ? 'today' : `last ${days} days`
  const [goal, setGoalState] = useState(() => readGoal(workspace))

  const trend = useApi<AnalyticsTrend>(`/api/v1/analytics/trend?workspace=${sales ? 'Sales' : 'Candidate'}&days=${trendDays}`)
  const detail = useApi<AnalyticsOverview>(analyticsPath(workspace, days))
  const t = trend.data
  const a = detail.data
  const series = seriesFor(workspace)
  const metric = goalMetric(workspace)
  const weekDone = t ? sumOf(lastDays(t.points, 7), metric.key) : 0
  const progress = goalProgress(weekDone, goal)
  const steps = journeySteps(workspace, overview)
  const stepsDone = steps.filter((s) => s.done).length
  const empty = t !== undefined && a !== undefined && a.campaignCount === 0 && sumOf(t.points, 'found') === 0

  function changeGoal(value: string) {
    const n = clampGoal(Number(value))
    setGoalState(n)
    writeGoal(workspace, n)
  }

  return (
    <div className="page page-wide stack-4">
      <PageHeader
        title="Insights"
        subtitle={sales
          ? 'How your outreach is going: what was found, approved and contacted, and how it changed. Counted from your own records.'
          : 'How your search is going: what was found, approved and applied, and how it changed. Counted from your own records.'}
        actions={
          <div className="segmented" role="group" aria-label="Time range" data-coach="insights-range">
            {RANGES.map((r) => (
              <button key={r} type="button" className={days === r ? 'active' : ''} aria-pressed={days === r} onClick={() => setDays(r)}>{r === 1 ? 'Today' : `${r} days`}</button>
            ))}
          </div>
        }
      />

      {(trend.error || detail.error) && <ErrorNotice error={(trend.error ?? detail.error)!} onRetry={() => { trend.reload(); detail.reload() }} what="your insights" />}
      {(trend.loading && !t) && <LoadingState label="Counting your records…" waking={trend.waking} rows={4} />}

      {empty && (
        <EmptyState
          title="Nothing to chart yet"
          actions={<Link className="btn btn-primary btn-sm" to="/campaigns/new">{sales ? 'Find companies' : 'Find jobs'}</Link>}
        >
          <p>Run one search and this page fills in: what was found, approved and {sales ? 'contacted' : 'applied to'}, day by day.</p>
        </EmptyState>
      )}

      {/* A search is recorded as soon as it is run, so the person's own actions show even before anything is tracked. */}
      {empty && <ActivityPanel sales={sales} />}

      {t && !empty && (
        <>
          <KpiBand six label="Key figures">
            {kpisFor(workspace).map((k, i) => (
              <KpiCard key={k.key} icon={KPI_ICONS[i % KPI_ICONS.length]} tone={KPI_TONES[i % KPI_TONES.length]} label={k.label} value={t.current[k.key]}
                change={{ current: t.current[k.key], previous: t.previous[k.key] }} sub={`vs the ${trendDays} days before`} series={t.points.map((p) => p[k.key])} />
            ))}
          </KpiBand>

          <Card title="Activity over time" actions={<span className="muted-small">last {trendDays} days · per day</span>} coach="insights-trend">
<div className="stack-3">
              <p>{trendSummary(workspace, days, t.current, t.previous)}</p>
              <TrendChart points={t.points} series={series} summary={trendSummary(workspace, days, t.current, t.previous)} />
            </div>
</Card>

          <div className="panel-grid-2">
            <Card title="Progress" coach="insights-progress">
<div className="stack-4">
                <div className="stack-2">
                  <strong>Your path: {stepsDone} of {steps.length} steps done</strong>
                  <ProgressBar pct={Math.round((stepsDone / steps.length) * 100)} label="Steps of the path done" text={`${stepsDone} of ${steps.length}`} />
                  <ul className="path-chips" aria-label="Steps">
                    {steps.map((s) => <li key={s.id} className={s.done ? 'is-done' : ''}><span aria-hidden="true">{s.done ? '✓' : '○'}</span> {s.label}<span className="sr-only">{s.done ? ' (done)' : ' (not yet)'}</span></li>)}
                  </ul>
                </div>
                <div className="stack-2">
                  <label className="row wrap" htmlFor="weekly-goal">
                    <strong>This week: {metric.label}</strong>
                    <span className="grow" />
                    <span className="muted-small">goal</span>
                    <input id="weekly-goal" type="number" min={1} max={200} inputMode="numeric" className="goal-input" value={goal} onChange={(e) => changeGoal(e.target.value)} />
                  </label>
                  <ProgressBar pct={progress.pct} label={`Weekly goal: ${metric.label}`} text={progress.text} />
                  <p className="muted-small">Last 7 days. The goal is yours to set and is kept in this browser.</p>
                </div>
              </div>
</Card>

            <Card title="Funnel" actions={<span className="muted-small">{rangeLabel}</span>}>
<div className="stack-3">
                <HBars
                  rows={funnelRows(workspace, t.current).map((r) => ({ label: r.label, value: r.count, note: r.fromPrevious === null ? undefined : `${r.fromPrevious}% of previous` }))}
                  empty="Nothing found yet."
                />
                <p className="muted-small">Each step is counted once per {sales ? 'company' : 'job'}, the first time it got there.</p>
              </div>
</Card>
          </div>

          <ActivityPanel sales={sales} />

          {a && (
            <div className="panel-grid-3">
              <Card title="How well they fit">
<div className="stack-2">
                  <HBars rows={trimBands(a.fitHistogram.bands).map((b) => ({ label: `${b.from}–${b.to}`, value: b.count }))} empty="No scores yet." />
                  <p className="muted-small">Match score of everything found, in bands of ten. A ranking against your criteria, not a chance of success.</p>
                </div>
</Card>
              <Card title="Where results come from">
<div className="stack-2">
                  <HBars
                    rows={a.sources.slice(0, 6).map((s) => ({ label: s.label, value: s.qualified, note: `of ${s.read} read${s.failing ? ' · failing' : ''}` }))}
                    empty="No source has run yet."
                  />
                  <p className="muted-small">Qualified results per source, out of what it read.</p>
                </div>
</Card>
              {sales ? (
                <Card title="Industries and signals">
<div className="stack-3">
                    <HBars rows={(a.qualifiedByIndustry ?? []).map((x) => ({ label: x.industry, value: x.count }))} empty="No industry matched yet." />
                    <HBars rows={(a.signalsFound ?? []).slice(0, 5).map((x) => ({ label: x.signal, value: x.count }))} empty="No buying signal matched yet." />
                  </div>
</Card>
              ) : (
                <Card title="Needs your attention">
<div className="stack-3">
                    {a.attention.length === 0
                      ? <p className="muted-small">Nothing is waiting on you.</p>
                      : <ul className="plain-list stack-2">{a.attention.map((x) => <li key={x.kind}>{x.detail}</li>)}</ul>}
                  </div>
</Card>
              )}
            </div>
          )}

          <Card title="Market view">
<div className="row wrap">
              <p className="grow">Which skills and companies are in demand right now comes from live job boards, not from your records, so it lives under Find ({sales ? 'Find companies' : 'Find jobs'} → Trends) with its source and sample size shown.</p>
              <Link className="btn btn-secondary btn-sm" to="/wellfound?tab=trends">Open hiring trends</Link>
            </div>
</Card>
        </>
      )}
    </div>
  )
}
