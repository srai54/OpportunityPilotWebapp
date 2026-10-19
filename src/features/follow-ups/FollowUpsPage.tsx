import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorNotice } from '../../components/ErrorNotice'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState, LoadingState } from '../../components/States'
import { Badge } from '../../components/StatusBadge'
import { CallButton } from '../../components/CallButton'
import { findPhone } from '../../lib/phone'
import { api } from '../../lib/api'
import type { DraftPage, NextAction, Suppression } from '../../lib/types'
import { useApi } from '../../lib/useApi'
import { dueLabel } from './followUpModel'
import { Avatar, CardList } from '../../components/cards'
import { KpiBand, KpiCard } from '../../components/kpi/kpi'

export function FollowUpsPage() {
  const actions = useApi<NextAction[]>('/api/v1/next-actions?state=Open')
  const suppressions = useApi<Suppression[]>('/api/v1/suppressions')
  // One fixed "now" for the counts, so a render never changes them by itself.
  const [now] = useState(() => Date.now())
  const today = new Date(now).toDateString()
  const drafts = useApi<DraftPage>('/api/v1/drafts?take=200')
  const sent = (drafts.data?.items ?? []).filter((d) => d.state === 'Sent').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const reminderFor = new Set((actions.data ?? []).map((a) => a.opportunityId))
  const [recipient, setRecipient] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<Error>()

  async function update(id: string, state: 'Done' | 'Cancelled') {
    setError(undefined)
    try { await api(`/api/v1/next-actions/${id}`, { method: 'PATCH', body: JSON.stringify({ state }) }); actions.reload() }
    catch (e) { setError(e as Error) }
  }
  async function suppress() {
    if (!recipient.trim()) return
    setError(undefined)
    try { await api('/api/v1/suppressions', { method: 'POST', body: JSON.stringify({ recipient, reason: reason || null }) }); setRecipient(''); setReason(''); suppressions.reload() }
    catch (e) { setError(e as Error) }
  }
  async function unsuppress(id: string) {
    try { await api(`/api/v1/suppressions/${id}`, { method: 'DELETE' }); suppressions.reload() }
    catch (e) { setError(e as Error) }
  }

  return <div className="page page-wide stack-4">
    <PageHeader title="Follow-ups" subtitle="Sent messages and nudges due." />
    {error && <ErrorNotice error={error} onDismiss={() => setError(undefined)} what="follow-ups" />}
    {actions.data && (
      <KpiBand label="Your follow-ups">
        <KpiCard icon="followUps" tone="danger" label="Overdue" value={actions.data.filter((a) => a.overdue).length} sub="past their date" />
        <KpiCard icon="calendar" tone="amber" label="Due today" value={actions.data.filter((a) => !a.overdue && new Date(a.dueAt).toDateString() === today).length} sub="to do today" />
        <KpiCard icon="refresh" tone="blue" label="This week" value={actions.data.filter((a) => !a.overdue && new Date(a.dueAt).getTime() - now < 7 * 86_400_000).length} sub="coming up" />
        <KpiCard icon="mail" tone="indigo" label="Sent, waiting" value={sent.length} sub="no reply recorded" />
      </KpiBand>
    )}
    <section className="card stack-3" aria-labelledby="sent-heading">
      <div className="row wrap"><h2 id="sent-heading" className="eyebrow">Sent — waiting for a reply</h2><span className="grow" /><span className="muted-small">{sent.length} sent</span></div>
      {drafts.loading && !drafts.data ? <LoadingState label="Loading what you sent…" rows={2} />
        : sent.length === 0 ? <p className="muted-small">Nothing sent yet. Messages you send from Outreach are listed here, with a nudge reminder 5 days later.</p>
        : <CardList label="Messages sent">{sent.slice(0, 20).map((d) => <li key={d.id} className="ccard followup-card">
          <Avatar name={d.organization || d.opportunityTitle} />
          <div className="followup-main">
            <span className="followup-title">{d.organization || d.opportunityTitle} <Badge tone="neutral">{d.channel}</Badge></span>
            <span className="followup-meta">Sent {new Date(d.updatedAt).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}{d.recipient ? ` · to ${d.recipient}` : ''}</span>
            <span className="followup-note">{reminderFor.has(d.opportunityId) ? 'A nudge reminder is set (below).' : 'No reminder is set for this one.'}</span>
          </div>
          <div className="followup-actions"><Link className="btn btn-secondary btn-sm" to={`/opportunities/${d.opportunityId}`}>Open lead</Link></div>
        </li>)}</CardList>}
    </section>
    <div className="panel-grid-2">
      <section className="panel" data-coach="follow-list"><header className="panel-head"><h2 className="eyebrow">Nudges to do</h2></header>
        {actions.loading && !actions.data ? <div className="panel-body"><LoadingState label="Loading follow-ups…" waking={actions.waking} rows={3} /></div> : actions.data?.length === 0 ? <div className="panel-body"><EmptyState title="No nudges to do" actions={<><Link className="btn btn-primary btn-sm" to="/outreach">Go to your messages</Link><Link className="btn btn-secondary btn-sm" to="/opportunities">Review jobs</Link></>}><p>A reminder is added here 5 days after you record a message as sent.</p></EmptyState></div> :
          <div className="panel-body"><CardList label="Follow-ups">{actions.data?.map((row) => <li key={row.id} className="ccard followup-card">
            <Avatar name={row.organization || row.opportunityTitle} />
            <div className="followup-main">
              <span className="followup-title">{row.opportunityTitle} <Badge tone={row.overdue ? 'danger' : 'neutral'}>{dueLabel(row.dueAt)}</Badge></span>
              <span className="followup-meta">{row.organization && row.organization !== row.opportunityTitle ? `${row.organization} · ` : ''}{new Date(row.dueAt).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
              {row.note && <span className="followup-note">{row.note}</span>}
            </div>
            <div className="followup-actions">{row.kind === 'Call' && <CallButton phone={findPhone(row.note)} who={row.organization || row.opportunityTitle} label="Call"
              entityType="nextAction" entityId={row.id} context={{ opportunityId: row.opportunityId, context: row.opportunityTitle }} />}
              <Link className={`btn btn-sm ${row.kind === 'Call' && findPhone(row.note) ? 'btn-secondary' : 'btn-primary'}`} to={`/opportunities/${row.opportunityId}`}>Open</Link><button className="btn btn-secondary btn-sm" type="button" onClick={() => update(row.id, 'Done')}>Done</button><button className="btn btn-ghost btn-sm" type="button" onClick={() => update(row.id, 'Cancelled')}>Cancel</button></div>
          </li>)}</CardList></div>}
      </section>
      <section className="panel" data-coach="follow-suppress"><header className="panel-head"><h2 className="eyebrow">Do not contact</h2></header><div className="panel-body stack-3">
        <p className="muted-small">Suppressed recipients cannot have drafts approved.</p>
        <label className="field"><span>Email, name, or recipient</span><input value={recipient} onChange={(e) => setRecipient(e.target.value)} maxLength={320} /></label>
        <label className="field"><span>Reason</span><input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} /></label>
        <button className="btn btn-secondary" type="button" disabled={!recipient.trim()} onClick={suppress}>Add suppression</button>
        <ul className="suppression-list">{suppressions.data?.map((row) => <li key={row.id}><span className="grow"><strong>{row.recipient}</strong>{row.reason && <small>{row.reason}</small>}</span><button className="btn btn-ghost btn-sm" type="button" onClick={() => unsuppress(row.id)}>Remove</button></li>)}</ul>
      </div></section>
    </div>
  </div>
}
