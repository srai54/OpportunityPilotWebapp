import { Link } from 'react-router-dom'
import { Card } from '../../components/cards'
import { Donut } from '../../components/charts/Donut'
import { ProgressBar } from '../../components/ProgressBar'
import type { CampaignSummary, DraftPage } from '../../lib/types'
import { useApi } from '../../lib/useApi'
import type { RepeatSchedule } from '../campaigns/campaignModel'
import type { Workspace } from '../shell/shellModel'
import { campaignSegments, outreachSegments, runPercent, runWords } from './progressCharts'

interface AgentStatus { connected: boolean; online: boolean; appliedLast7Days: number; waiting: number }

/**
 * "Your automation": what is running, repeating and done, as charts that move. Shown once there is a campaign. Every number is
 * counted from stored records; the charts refresh when the page does.
 */
export function AutomationProgress({ workspace }: Readonly<{ workspace: Workspace }>) {
  const sales = workspace === 'sales'
  const campaigns = useApi<CampaignSummary[]>('/api/v1/campaigns')
  const schedules = useApi<RepeatSchedule[]>('/api/v1/schedules')
  const drafts = useApi<DraftPage>('/api/v1/drafts?take=200')
  const replies = useApi<unknown[]>(`/api/v1/analytics/activity?workspace=${sales ? 'Sales' : 'Candidate'}&kinds=Replied&take=100`)
  const agent = useApi<AgentStatus>('/api/v1/agent-keys/status')
  if (!campaigns.data || !schedules.data) return null
  const mine = campaigns.data.filter((c) => (sales ? c.mode !== 'Job' : c.mode === 'Job'))
  if (mine.length === 0) return null

  const campaignSegs = campaignSegments(mine, schedules.data)
  const ids = new Set(mine.map((c) => c.id))
  const myDrafts = (drafts.data?.items ?? []).filter((d) => ids.has(d.campaignId))
  const outreachSegs = outreachSegments(myDrafts, replies.data?.length ?? 0)
  const running = mine.filter((c) => c.lastJob?.state === 'Queued' || c.lastJob?.state === 'Running')
  const sent = myDrafts.filter((d) => d.state === 'Sent').length
  const toSend = myDrafts.filter((d) => d.state === 'Approved').length
  const a = agent.data

  return (
    <section className="stack-3" aria-labelledby="auto-progress-h">
      <div className="row wrap">
        <h2 id="auto-progress-h" className="section-title">Your automation</h2>
        {running.length > 0 && <span className="live-pill"><i aria-hidden="true" /> {running.length} running now</span>}
        <span className="grow" />
        <Link className="btn btn-ghost btn-sm" to="/autopilot">Open Autopilot</Link>
      </div>
      <div className="chart-grid">
        <Card title="Campaigns" subtitle={`${mine.length} in total. ${campaignSegs[1].value} repeat on their own.`}>
          <Donut segments={campaignSegs} centerLabel="campaigns" summary={`Campaigns: ${campaignSegs.map((s) => `${s.value} ${s.label.toLowerCase()}`).join(', ')}.`} />
        </Card>
        <Card title="Outreach" subtitle={myDrafts.length ? `${sent} sent, ${outreachSegs[3].value} replied.` : 'No messages yet.'}>
          {myDrafts.length
            ? <Donut segments={outreachSegs} centerLabel="messages" summary={`Outreach: ${outreachSegs.map((s) => `${s.value} ${s.label.toLowerCase()}`).join(', ')}.`} />
            : <p className="muted-small">Approve {sales ? 'leads' : 'jobs'}, then write messages from Outreach. <Link to="/outreach">Go to Outreach</Link></p>}
        </Card>
        <Card title={sales ? 'Sending' : 'Applying'} subtitle={sales ? 'Approved messages and how many went out.' : 'Your desktop agent applies to approved LinkedIn, Naukri and Instahyre jobs.'}>
          <div className="stack-3">
            {sales || !a ? (
              <ProgressBar pct={sent + toSend ? (sent / (sent + toSend)) * 100 : 0} label="Approved messages sent" text={`${sent} of ${sent + toSend} approved messages sent`} tone="success" />
            ) : (
              <>
                <p className="row wrap"><span className={`agent-dot${a.online ? ' is-live' : ''}`} aria-hidden="true" /> <strong>{a.online ? 'Agent running' : a.connected ? 'Agent not running' : 'No agent connected'}</strong></p>
                <ProgressBar pct={a.appliedLast7Days + a.waiting ? (a.appliedLast7Days / (a.appliedLast7Days + a.waiting)) * 100 : 0} label="Approved jobs applied"
                  text={`${a.appliedLast7Days} applied this week, ${a.waiting} waiting`} tone="success" active={a.online && a.waiting > 0} />
              </>
            )}
            {running.map((c) => (
              <ProgressBar key={c.id} pct={runPercent(c.lastJob?.stage)} label={`${c.name}: ${runWords(c.lastJob?.stage)}`} text={`${c.name} · ${runWords(c.lastJob?.stage)}`} active />
            ))}
            {running.length === 0 && <p className="muted-small">No search is running right now.</p>}
          </div>
        </Card>
      </div>
    </section>
  )
}
