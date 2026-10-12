import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorNotice } from '../../components/ErrorNotice'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState, LoadingState } from '../../components/States'
import type { AnalyticsOverview, AnalyticsTrend } from '../../lib/types'
import { useApi } from '../../lib/useApi'
import { journeySteps } from '../journey/journeyModel'
import { analyticsPath } from '../overview/analyticsModel'
import { useShell } from '../shell/ShellContext'
import { HBars, ProgressBar, Spark, TrendChart } from './Charts'
import {
  clampGoal, trimBands, delta, funnelRows, goalMetric, goalProgress, kpisFor, lastDays, readGoal, seriesFor, sumOf, trendSummary, writeGoal,
} from './insightsModel'

const RANGES = [7, 14, 30, 90] as const

/**
 * Advanced → Insights: KPIs with change, a trend chart, progress (path and weekly goal), the funnel, fit, sources and, for Sales,
 * industries and signals. Every figure is counted from the person's own stored records; nothing is estimated, and market data is
 * not mixed in (it has its own, labelled, tab under Find).
 */
/** Keyed by workspace so each side keeps its own goal and range. */
export function InsightsPage() {
  return <InsightsView key={useShell().workspace} />
}

function InsightsView() {
  const { workspace, overview } = useShell()
  const sales = workspace === 'sales'
  const [days, setDays] = useState<(typeof RANGES)[number]>(30)
  const [goal, setGoalState] = useState(() => readGoal(workspace))

  const trend = useApi<AnalyticsTrend>(`/api/v1/analytics/trend?workspace=${sales ? 'Sales' : 'Candidate'}&days=${days}`)
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
              <button key={r} type="button" className={days === r ? 'active' : ''} aria-pressed={days === r} onClick={() => setDays(r)}>{r} days</button>
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

      {t && !empty && (
        <>
          <section className="kpi-strip kpi-strip-6" aria-label="Key figures">
            {kpisFor(workspace).map((k) => {
              const d = delta(t.current[k.key], t.previous[k.key])
              return (
                <div className="kpi" key={k.key}>
                  <div className="kpi-label">{k.label}</div>
                  <div className="kpi-value op-numeric">{t.current[k.key]}</div>
                  <div className={`kpi-delta kpi-delta-${d.tone}`}>{d.text} <span className="muted-small">vs the {days} days before</span></div>
                  <Spark values={t.points.map((p) => p[k.key])} label={`${k.label} per day, last ${days} days`} />
                </div>
              )
            })}
          </section>

          <section className="panel" data-coach="insights-trend">
            <header className="panel-head"><h3 className="eyebrow">Activity over time</h3><div className="grow" /><span className="muted-small">last {days} days · per day</span></header>
            <div className="panel-body stack-3">
              <p>{trendSummary(workspace, days, t.current, t.previous)}</p>
              <TrendChart points={t.points} series={series} summary={trendSummary(workspace, days, t.current, t.previous)} />
            </div>
          </section>

          <div className="panel-grid-2">
            <section className="panel" data-coach="insights-progress">
              <header className="panel-head"><h3 className="eyebrow">Progress</h3></header>
              <div className="panel-body stack-4">
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
            </section>

            <section className="panel">
              <header className="panel-head"><h3 className="eyebrow">Funnel</h3><div className="grow" /><span className="muted-small">last {days} days</span></header>
              <div className="panel-body stack-3">
                <HBars
                  rows={funnelRows(workspace, t.current).map((r) => ({ label: r.label, value: r.count, note: r.fromPrevious === null ? undefined : `${r.fromPrevious}% of previous` }))}
                  empty="Nothing found yet."
                />
                <p className="muted-small">Each step is counted once per {sales ? 'company' : 'job'}, the first time it got there.</p>
              </div>
            </section>
          </div>

          {a && (
            <div className="panel-grid-3">
              <section className="panel">
                <header className="panel-head"><h3 className="eyebrow">How well they fit</h3></header>
                <div className="panel-body stack-2">
                  <HBars rows={trimBands(a.fitHistogram.bands).map((b) => ({ label: `${b.from}–${b.to}`, value: b.count }))} empty="No scores yet." />
                  <p className="muted-small">Match score of everything found, in bands of ten. A ranking against your criteria, not a chance of success.</p>
                </div>
              </section>
              <section className="panel">
                <header className="panel-head"><h3 className="eyebrow">Where results come from</h3></header>
                <div className="panel-body stack-2">
                  <HBars
                    rows={a.sources.slice(0, 6).map((s) => ({ label: s.label, value: s.qualified, note: `of ${s.read} read${s.failing ? ' · failing' : ''}` }))}
                    empty="No source has run yet."
                  />
                  <p className="muted-small">Qualified results per source, out of what it read.</p>
                </div>
              </section>
              {sales ? (
                <section className="panel">
                  <header className="panel-head"><h3 className="eyebrow">Industries and signals</h3></header>
                  <div className="panel-body stack-3">
                    <HBars rows={(a.qualifiedByIndustry ?? []).map((x) => ({ label: x.industry, value: x.count }))} empty="No industry matched yet." />
                    <HBars rows={(a.signalsFound ?? []).slice(0, 5).map((x) => ({ label: x.signal, value: x.count }))} empty="No buying signal matched yet." />
                  </div>
                </section>
              ) : (
                <section className="panel">
                  <header className="panel-head"><h3 className="eyebrow">Needs your attention</h3></header>
                  <div className="panel-body">
                    {a.attention.length === 0
                      ? <p className="muted-small">Nothing is waiting on you.</p>
                      : <ul className="plain-list stack-2">{a.attention.map((x) => <li key={x.kind}>{x.detail}</li>)}</ul>}
                  </div>
                </section>
              )}
            </div>
          )}

          <section className="panel">
            <header className="panel-head"><h3 className="eyebrow">Market view</h3></header>
            <div className="panel-body row wrap">
              <p className="grow">Which skills and companies are in demand right now comes from live job boards, not from your records, so it lives under Find ({sales ? 'Find companies' : 'Find jobs'} → Trends) with its source and sample size shown.</p>
              <Link className="btn btn-secondary btn-sm" to="/wellfound?tab=trends">Open hiring trends</Link>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
