import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardGrid } from '../../components/cards'
import { ErrorNotice } from '../../components/ErrorNotice'
import { PageHeader } from '../../components/PageHeader'
import { LoadingState } from '../../components/States'
import { Badge } from '../../components/StatusBadge'
import { api } from '../../lib/api'
import type { Campaign, CampaignSummary, ResearchJob } from '../../lib/types'
import { useApi } from '../../lib/useApi'
import { StopAllCard } from '../campaigns/StopAllCard'
import { AgentStatusCard } from '../overview/AgentStatusCard'
import { useShell } from '../shell/ShellContext'
import { repeatLabel, type RepeatSchedule } from '../campaigns/campaignModel'
import type { Integration } from '../connectors/integrationsModel'
import type { Mailbox } from '../mail/mailModel'
import { AUTO_APPROVE_CHOICES, autoApproveBody, nextRuns, ranToday, repeatBody, repeatChoice, runWhen, type RepeatChoice } from './autopilotModel'

interface Rule { id: string; title: string; detail: string; on: boolean; manage?: { to: string; label: string }; toggle?: () => Promise<void> }

/**
 * Autopilot: everything that runs on its own, in one place, each with its state and where to change it. It adds no new automation:
 * it shows the repeats, thresholds, reply checks and alerts that already exist, and pauses or resumes the repeats. Nothing here sends.
 */
export function AutopilotPage() {
  const { workspace } = useShell()
  const campaigns = useApi<CampaignSummary[]>('/api/v1/campaigns')
  const schedules = useApi<RepeatSchedule[]>('/api/v1/schedules')
  const integrations = useApi<Integration[]>('/api/v1/integrations')
  const mailboxes = useApi<Mailbox[]>('/api/v1/mailboxes')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<Error>()
  const [jobs, setJobs] = useState<Record<string, ResearchJob>>({})
  const [now] = useState(() => new Date())
  const today = campaigns.data ? ranToday(campaigns.data, now).slice(0, 6) : []
  const todayKey = today.map((c) => `${c.lastJob!.id}:${c.lastJob!.state}`).join(',')
  // Found / good counts for today's runs (one small request each, at most six).
  useEffect(() => {
    if (!todayKey) return
    let live = true
    void Promise.all(todayKey.split(',').map((k) => api<ResearchJob>(`/api/v1/research-jobs/${k.split(':')[0]}`).catch(() => null)))
      .then((list) => { if (live) setJobs(Object.fromEntries(list.filter((j): j is ResearchJob => j !== null).map((j) => [j.id, j]))) })
    return () => { live = false }
  }, [todayKey])

  if (!campaigns.data || !schedules.data) return <div className="page page-wide"><LoadingState label="Loading what runs on its own…" rows={3} /></div>

  const setPaused = (s: RepeatSchedule, paused: boolean) => async () => {
    await api(`/api/v1/campaigns/${s.campaignId}/schedule`, { method: 'PUT', body: JSON.stringify({ timeZone: s.timeZone, cadenceMinutes: s.cadenceMinutes, nextRunAt: s.nextRunAt, paused, expectedVersion: s.version }) })
    schedules.reload()
  }

  const searchRules: Rule[] = campaigns.data.map((c) => {
    const s = schedules.data!.find((x) => x.campaignId === c.id)
    return {
      id: `run-${c.id}`, title: `Search and score: ${c.name}`,
      detail: s ? repeatLabel(s) : 'Runs only when you press Run',
      on: Boolean(s && !s.paused),
      manage: { to: `/campaigns/${c.id}/edit?step=4`, label: 'Change' },
      toggle: s ? setPaused(s, !s.paused) : undefined,
    }
  })
  const thresholdRules: Rule[] = campaigns.data.flatMap((c) => [
    ...(c.autoApproveMinScore != null ? [{ id: `approve-${c.id}`, title: `Approve strong matches: ${c.name}`, detail: `Scores of ${c.autoApproveMinScore} or more go straight to Approved. Applying or sending still needs you.`, on: true, manage: { to: `/campaigns/${c.id}/edit?step=4`, label: 'Change' } }] : []),
    ...(c.autoSuggestMinScore != null ? [{ id: `suggest-${c.id}`, title: `Suggest for approval: ${c.name}`, detail: `Scores of ${c.autoSuggestMinScore} or more wait in Approvals for your yes.`, on: true, manage: { to: `/campaigns/${c.id}/edit?step=4`, label: 'Change' } }] : []),
  ])
  const hooks = (integrations.data ?? []).filter((x) => x.connected && ['Slack', 'Teams', 'Webhook'].includes(x.kind))
  const mail = mailboxes.data?.find((m) => m.provider === 'Smtp' && m.connected)
  const background: Rule[] = [
    { id: 'replies', title: 'Find replies in your email', detail: mail ? `Every 30 minutes in ${mail.emailAddress ?? 'your email'}. A reply moves the lead to Responded and cancels its follow-ups.` : 'Connect your email with an app password to switch this on.', on: Boolean(mail), manage: { to: '/settings', label: mail ? 'Settings' : 'Connect' } },
    { id: 'followups', title: 'Follow-up reminders', detail: 'A reminder is set 5 days after each message you send. You decide whether to nudge.', on: true, manage: { to: '/follow-ups', label: 'Follow-ups' } },
    { id: 'digest', title: 'Daily summary and alerts', detail: hooks.length ? `To ${hooks.map((h) => h.label ?? h.kind).join(', ')}: ${[...new Set(hooks.flatMap((h) => h.events))].join(', ') || 'no events chosen'}.` : 'Connect Slack, Teams or a webhook to get a daily summary and alerts.', on: hooks.length > 0, manage: { to: '/connectors', label: hooks.length ? 'Change' : 'Connect' } },
  ]

  async function save(id: string, work: () => Promise<void>) {
    setBusy(id); setError(undefined)
    try { await work() } catch (e) { setError(e as Error) } finally { setBusy(null) }
  }
  const setRepeat = (c: CampaignSummary, choice: Exclude<RepeatChoice, 'custom'>) => save(`repeat-${c.id}`, async () => {
    const body = repeatBody(choice, schedules.data!.find((x) => x.campaignId === c.id), new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
    if (!body) return
    await api(`/api/v1/campaigns/${c.id}/schedule`, { method: 'PUT', body: JSON.stringify(body) })
    schedules.reload()
  })
  const setAutoApprove = (c: CampaignSummary, score: number | null) => save(`approve-${c.id}`, async () => {
    const full = await api<Campaign>(`/api/v1/campaigns/${c.id}`)
    await api(`/api/v1/campaigns/${c.id}`, { method: 'PUT', body: JSON.stringify(autoApproveBody(full, score)) })
    campaigns.reload()
  })
  const upcoming = nextRuns(schedules.data, campaigns.data)

  async function run(rule: Rule) {
    if (!rule.toggle) return
    setBusy(rule.id); setError(undefined)
    try { await rule.toggle() } catch (e) { setError(e as Error) } finally { setBusy(null) }
  }

  const section = (title: string, rules: Rule[], empty: string) => (
    <Card title={title}>
      {rules.length === 0 ? <p className="muted-small">{empty}</p> : (
        <ul className="auto-rules">
          {rules.map((r) => (
            <li key={r.id} className="auto-rule">
              <div className="auto-text"><strong>{r.title}</strong><span className="muted-small">{r.detail}</span></div>
              <Badge tone={r.on ? 'success' : 'neutral'}>{r.on ? 'On' : 'Off'}</Badge>
              {r.toggle && <button type="button" className="btn btn-secondary btn-sm" disabled={busy !== null} onClick={() => void run(r)}>{busy === r.id ? 'Saving…' : r.on ? 'Pause' : 'Resume'}<span className="sr-only"> {r.title}</span></button>}
              {r.manage && <Link className="btn btn-ghost btn-sm" to={r.manage.to}>{r.manage.label}<span className="sr-only"> {r.title}</span></Link>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )

  return (
    <div className="page page-wide stack-4">
      <PageHeader title="Autopilot" subtitle="What runs on its own. Sending always waits for you." />
      {error && <ErrorNotice error={error} />}
      <StopAllCard />
      {workspace !== 'sales' && <AgentStatusCard />}
      <div className="auto-two">
        <Card title="Next runs">
          {upcoming.length === 0 ? <p className="muted-small">Nothing repeats yet. Pick Daily or Weekly below.</p> : (
            <ol className="auto-runs">{upcoming.slice(0, 8).map((r) => (
              <li key={r.campaignId}><span className="auto-run-name">{r.name}</span><span className="muted-small op-numeric">{runWhen(r.at, now)}</span></li>
            ))}</ol>
          )}
        </Card>
        <Card title="Ran today">
          {today.length === 0 ? <p className="muted-small">No searches ran today.</p> : (
            <ol className="auto-runs">{today.map((c) => {
              const j = jobs[c.lastJob!.id]
              const running = c.lastJob!.state === 'Queued' || c.lastJob!.state === 'Running'
              return (
                <li key={c.id}>
                  <Link className="auto-run-name" to={`/research/${c.lastJob!.id}`}>{c.name}</Link>
                  {running ? <Badge tone="primary">Running</Badge>
                    : j ? <span className="muted-small op-numeric">{j.counts.candidates.toLocaleString()} found · {j.counts.qualified.toLocaleString()} good</span>
                      : <span className="muted-small">—</span>}
                </li>
              )
            })}</ol>
          )}
        </Card>
      </div>
      {campaigns.data.length === 0 ? section('Repeating searches', searchRules, 'No campaigns yet. Create one and set it to repeat.') : (
        <section className="stack-2" aria-labelledby="auto-campaigns">
          <h3 id="auto-campaigns" className="eyebrow">Repeating searches</h3>
          <CardGrid label="Campaigns">{campaigns.data.map((c) => {
            const s = schedules.data!.find((x) => x.campaignId === c.id)
            const choice = repeatChoice(s)
            const rule = searchRules.find((r) => r.id === `run-${c.id}`)!
            return (
              <li key={c.id} className="ccard auto-card">
                <div className="auto-card-head">
                  <h4 className="auto-card-title">{c.name}</h4>
                  <Badge tone={rule.on ? 'success' : 'neutral'}>{rule.on ? 'On' : 'Off'}</Badge>
                </div>
                <p className="muted-small">{rule.detail}</p>
                <div className="auto-card-controls">
                  <label className="field"><span>Repeat</span>
                    <select value={choice} disabled={busy !== null} onChange={(e) => void setRepeat(c, e.target.value as Exclude<RepeatChoice, 'custom'>)}>
                      <option value="off">Off</option><option value="daily">Daily</option><option value="weekly">Weekly</option>
                      {choice === 'custom' && <option value="custom" disabled>{repeatLabel(s).split(' · ')[0]}</option>}
                    </select>
                  </label>
                  {c.mode === 'Job' && (
                    <label className="field"><span>Auto-approve</span>
                      <select value={c.autoApproveMinScore ?? ''} disabled={busy !== null} onChange={(e) => void setAutoApprove(c, e.target.value ? Number(e.target.value) : null)}>
                        {AUTO_APPROVE_CHOICES.map((v) => <option key={v ?? 'off'} value={v ?? ''}>{v == null ? 'Off' : `Fit ${v}+`}</option>)}
                        {c.autoApproveMinScore != null && !(AUTO_APPROVE_CHOICES as readonly (number | null)[]).includes(c.autoApproveMinScore) && <option value={c.autoApproveMinScore}>Fit {c.autoApproveMinScore}+</option>}
                      </select>
                    </label>
                  )}
                </div>
                <div className="auto-card-foot">
                  {busy === `repeat-${c.id}` || busy === `approve-${c.id}` ? <span className="muted-small" role="status">Saving…</span> : <span />}
                  <Link className="btn btn-ghost btn-sm" to={`/campaigns/${c.id}/edit?step=4`}>More<span className="sr-only"> settings for {c.name}</span></Link>
                </div>
              </li>
            )
          })}</CardGrid>
        </section>
      )}
      {section('Approval thresholds', thresholdRules, 'No thresholds set. Every lead waits for you.')}
      {section('In the background', background, '')}
      <Card title="Always on" subtitle="These cannot be switched off.">
        <ul className="auto-rules">
          {['Nothing is sent or applied without your approval of that exact text.', 'A reply stops the follow-ups for that lead.', 'An opt-out goes on the do-not-contact list and is never contacted again.', 'A message is recorded as sent once, even if you press Send twice.', 'When a follow-up is due and nobody replied, a follow-up draft is written for you to approve.'].map((t) => (
            <li key={t} className="auto-rule"><div className="auto-text"><span>{t}</span></div><Badge tone="success">Always</Badge></li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
