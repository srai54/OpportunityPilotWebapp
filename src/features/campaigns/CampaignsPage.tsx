import { useShell } from '../shell/ShellContext'
import { AgentStatusCard } from '../overview/AgentStatusCard'
import { Card } from '../../components/cards'
import { StopAllCard } from './StopAllCard'
import { KpiBand, KpiCard } from '../../components/kpi/kpi'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorNotice } from '../../components/ErrorNotice'
import { Badge } from '../../components/StatusBadge'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState, LoadingState } from '../../components/States'
import type { CampaignSummary, ProfileSummary } from '../../lib/types'
import { useApi } from '../../lib/useApi'
import { formatWhen } from '../applications/applicationStatus'
import { JOB_STATE_LABELS } from '../research/researchModel'
import { campaignFilterCounts, filterCampaigns, isRunning, MODE_LABELS, repeatLabel, type CampaignModeFilter } from './campaignModel'

const FLOW = [
  { title: 'Goal and mode', text: 'Pick a profile, choose Jobs or Customers and describe what you are after.' },
  { title: 'Filters', text: 'Enter the skills, places, industries and exclusions a match must meet.' },
  { title: 'Sources', text: 'Greenhouse or Lever boards, public URLs, feeds, a CSV or pasted text.' },
  { title: 'Review and run', text: 'Check the summary and queue a research run. Saving never runs it.' },
]

/** Design round 3 `Campaigns`: mode chips, one row per campaign with its latest run and next action. */
export function CampaignsPage() {
  const { workspace } = useShell()
  const campaigns = useApi<CampaignSummary[]>('/api/v1/campaigns')
  const profiles = useApi<ProfileSummary[]>('/api/v1/profiles')
  const schedules = useApi<{ campaignId: string; cadenceMinutes: number; nextRunAt: string; paused: boolean }[]>('/api/v1/schedules')
  const [filter, setFilter] = useState<CampaignModeFilter>('all')
  const noProfiles = profiles.data?.length === 0
  const counts = campaignFilterCounts(campaigns.data ?? [])
  const rows = filterCampaigns(campaigns.data ?? [], filter)
  const running = (campaigns.data ?? []).filter(isRunning).length

  return (
    <div className="page page-wide stack-4">
      <PageHeader
        title="Campaigns"
        subtitle="A campaign is one search: a mode, the criteria it scores against, and the sources it reads."
        actions={
          campaigns.data && campaigns.data.length > 0 ? (
            <div className="chips" role="group" aria-label="Show campaigns by mode">
              {(['all', 'Job', 'Customer', 'Partner', 'Investor', 'Freelance'] as const).map((f) => (
                <button key={f} type="button" className={`chip ${filter === f ? 'chip-on' : ''}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>
                  {f === 'all' ? 'All' : MODE_LABELS[f]} {counts[f]}
                </button>
              ))}
            </div>
          ) : undefined
        }
      />

      <StopAllCard />
      {campaigns.data && campaigns.data.length > 0 && (
        <KpiBand label="Your campaigns">
          <KpiCard icon="campaigns" tone="blue" label="Campaigns" value={campaigns.data.length} sub={running > 0 ? `${running} running now` : 'none running'} />
          <KpiCard icon="search" tone="teal" label="Found" value={campaigns.data.reduce((n, c) => n + c.opportunityCount, 0)} sub="across all campaigns" />
          <KpiCard icon="integrations" tone="indigo" label="Sources" value={campaigns.data.reduce((n, c) => n + c.sourceCount, 0)} sub="read on each run" />
          <KpiCard icon="followUps" tone="green" label="Repeating" value={(schedules.data ?? []).filter((s) => !s.paused).length} sub="on a schedule" />
        </KpiBand>
      )}
      {campaigns.error && <ErrorNotice error={campaigns.error} onRetry={campaigns.reload} what="your campaigns" />}
      {campaigns.loading && !campaigns.data && <LoadingState label="Loading campaigns…" waking={campaigns.waking} rows={3} />}

      {campaigns.data && campaigns.data.length === 0 && (
        <EmptyState
          icon="◎"
          title="No campaigns yet"
          actions={
            noProfiles ? (
              <Link className="btn btn-primary btn-sm" to="/profiles/new">
                Add a profile first
              </Link>
            ) : (
              <>
                <Link className="btn btn-primary btn-sm" to="/campaigns/new">
                  New campaign
                </Link>
                <Link className="btn btn-secondary btn-sm" to="/">
                  Try a sample run
                </Link>
              </>
            )
          }
        >
          <p>Nothing is researched until you build a campaign and queue a run. It takes four steps:</p>
          <ol className="flow-steps">
            {FLOW.map((s) => (
              <li key={s.title}>
                <strong>{s.title}</strong> — {s.text}
              </li>
            ))}
          </ol>
          {noProfiles && <p>A campaign judges fit against one of your profiles, so add a profile first.</p>}
        </EmptyState>
      )}

      {campaigns.data && campaigns.data.length > 0 && (
        <section className="panel" aria-labelledby="campaigns-heading">
          <header className="panel-head">
            <h3 id="campaigns-heading" className="eyebrow">
              {filter === 'all' ? 'All campaigns' : `${MODE_LABELS[filter]} campaigns`}
              {running > 0 && ` · ${running} running`}
            </h3>
            <div className="grow" />
            <Link className="btn btn-primary btn-sm" to="/campaigns/new" data-coach="campaigns-new">
              + New campaign
            </Link>
          </header>
          <div className="table-scroll" role="region" aria-label="Campaigns table" tabIndex={0} data-coach="campaigns-table">
            <table className="table">
              <caption className="sr-only">Your campaigns, newest first.</caption>
              <thead>
                <tr>
                  <th scope="col">Campaign</th>
                  <th scope="col" className="col-opt">Mode</th>
                  <th scope="col" className="op-num">Sources</th>
                  <th scope="col" className="op-num">Found</th>
                  <th scope="col" className="col-opt">Suggest at</th>
                  <th scope="col">Last run</th>
                  <th scope="col" className="col-opt2">Repeats</th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="sr-only">Next step</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const state = c.lastJob ? JOB_STATE_LABELS[c.lastJob.state] : undefined
                  return (
                    <tr key={c.id}>
                      <td className="table-role">
                        <Link to={`/campaigns/${c.id}/edit`}>{c.name}</Link>
                        {c.goal && <div className="muted-small clamp-2">{c.goal}</div>}
                      </td>
                      <td className="col-opt">
                        <Badge tone={c.mode === 'Job' ? 'success' : 'primary'}>{MODE_LABELS[c.mode] ?? c.mode}</Badge>
                      </td>
                      <td className="op-num">
                        <Link to={`/campaigns/${c.id}/edit?step=3`}>
                          {c.sourceCount}
                          <span className="sr-only"> sources for {c.name}</span>
                        </Link>
                      </td>
                      <td className="op-num">
                        <Link to={`/campaigns/${c.id}/opportunities`}>
                          {c.opportunityCount}
                          <span className="sr-only"> opportunities in {c.name}</span>
                        </Link>
                      </td>
                      <td className="muted-small col-opt">{c.mode === 'Job' ? (c.autoSuggestMinScore ?? 'off') : '—'}</td>
                      <td className="table-when muted-small">
                        {c.lastJob ? (
                          c.lastJob.finishedAt ? <time dateTime={c.lastJob.finishedAt}>{formatWhen(c.lastJob.finishedAt)}</time> : 'In progress'
                        ) : (
                          'Never run'
                        )}
                      </td>
                      <td className="muted-small col-opt2">
                        <Link to={`/campaigns/${c.id}/edit?step=4`}>{repeatLabel(schedules.data?.find((x) => x.campaignId === c.id))}</Link>
                      </td>
                      <td>
                        {c.lastJob ? <Badge tone={state?.tone}>{state?.text ?? c.lastJob.state}</Badge> : <Badge>Not run</Badge>}
                      </td>
                      <td>
                        {c.lastJob && isRunning(c) ? (
                          <Link to={`/research/${c.lastJob.id}`}>Progress</Link>
                        ) : (
                          <Link to={`/campaigns/${c.id}/edit?step=4`}>Run now</Link>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {campaigns.data && campaigns.data.length > 0 && (
        <div className="panel-grid-2">
          {workspace !== 'sales' && <AgentStatusCard />}
          <Card title="Jobs campaigns feed Approvals">
<div className="stack-3">
              <p className="muted-small">
                A Jobs campaign with a suggest threshold puts everything scoring at or above it into the approval queue. You approve
                a batch; approved jobs become shortlisted and the agent (or you) applies.
              </p>
              <p className="flow-chips">
                <span className="chip">Run</span>›<span className="chip chip-warn">Suggested</span>›<span className="chip chip-ok">You approve</span>›
                <span className="chip">Applied</span>
              </p>
            </div>
</Card>
          <Card title="Business campaigns continue into outreach">
<div className="stack-3">
              <p className="muted-small">
                Customer, Partner, Investor, and Freelance campaigns use evidence-based company/project scoring, then continue into reviewed drafts and follow-ups.
                you can read and export.
              </p>
              <p className="flow-chips">
                <span className="chip">Run</span>›<span className="chip">Qualified</span>›<span className="chip chip-ok">You shortlist</span>›
                <span className="chip">You contact (approved draft, receipt)</span>
              </p>
            </div>
</Card>
        </div>
      )}
    </div>
  )
}
