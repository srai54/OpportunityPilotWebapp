import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../../components/cards'
import { ErrorNotice } from '../../components/ErrorNotice'
import { PageHeader } from '../../components/PageHeader'
import { LoadingState } from '../../components/States'
import { Badge } from '../../components/StatusBadge'
import { api } from '../../lib/api'
import type { CampaignSummary } from '../../lib/types'
import { useApi } from '../../lib/useApi'
import { StopAllCard } from '../campaigns/StopAllCard'
import { repeatLabel, type RepeatSchedule } from '../campaigns/campaignModel'
import type { Integration } from '../connectors/integrationsModel'
import type { Mailbox } from '../mail/mailModel'

interface Rule { id: string; title: string; detail: string; on: boolean; manage?: { to: string; label: string }; toggle?: () => Promise<void> }

/**
 * Autopilot: everything that runs on its own, in one place, each with its state and where to change it. It adds no new automation:
 * it shows the repeats, thresholds, reply checks and alerts that already exist, and pauses or resumes the repeats. Nothing here sends.
 */
export function AutopilotPage() {
  const campaigns = useApi<CampaignSummary[]>('/api/v1/campaigns')
  const schedules = useApi<RepeatSchedule[]>('/api/v1/schedules')
  const integrations = useApi<Integration[]>('/api/v1/integrations')
  const mailboxes = useApi<Mailbox[]>('/api/v1/mailboxes')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<Error>()

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
      <PageHeader title="Autopilot" subtitle="Everything that runs on its own, in one place. Searching and scoring can repeat; writing, approving and sending always wait for you." />
      {error && <ErrorNotice error={error} />}
      <StopAllCard />
      {section('Repeating searches', searchRules, 'No campaigns yet. Create one and set it to repeat.')}
      {section('Approval thresholds', thresholdRules, 'No thresholds set. Every lead waits for you.')}
      {section('In the background', background, '')}
      <Card title="Always on" subtitle="These cannot be switched off.">
        <ul className="auto-rules">
          {['Nothing is sent or applied without your approval of that exact text.', 'A reply stops the follow-ups for that lead.', 'An opt-out goes on the do-not-contact list and is never contacted again.', 'A message is recorded as sent once, even if you press Send twice.'].map((t) => (
            <li key={t} className="auto-rule"><div className="auto-text"><span>{t}</span></div><Badge tone="success">Always</Badge></li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
