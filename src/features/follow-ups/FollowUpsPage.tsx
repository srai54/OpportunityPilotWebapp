import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorNotice } from '../../components/ErrorNotice'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState, LoadingState } from '../../components/States'
import { Badge } from '../../components/StatusBadge'
import { api } from '../../lib/api'
import type { NextAction, Suppression } from '../../lib/types'
import { useApi } from '../../lib/useApi'

export function FollowUpsPage() {
  const actions = useApi<NextAction[]>('/api/v1/next-actions?state=Open')
  const suppressions = useApi<Suppression[]>('/api/v1/suppressions')
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
    <PageHeader title="Follow-ups" subtitle="Open reminders are shown here in the time zone you recorded. No notification is claimed as delivered." />
    {error && <ErrorNotice error={error} onRetry={() => setError(undefined)} what="follow-ups" />}
    <div className="panel-grid-2">
      <section className="panel" data-coach="follow-list"><header className="panel-head"><h2 className="eyebrow">Open next actions</h2></header>
        {actions.loading && !actions.data ? <div className="panel-body"><LoadingState label="Loading follow-ups…" waking={actions.waking} rows={3} /></div> : actions.data?.length === 0 ? <div className="panel-body"><EmptyState title="Nothing to follow up yet" actions={<><Link className="btn btn-primary btn-sm" to="/outreach">Go to your messages</Link><Link className="btn btn-secondary btn-sm" to="/opportunities">Review jobs</Link></>}><p>When you record a message as sent, a reminder to follow up appears here automatically.</p></EmptyState></div> :
          <ul className="follow-list">{actions.data?.map((row) => <li key={row.id}><div className="grow stack-1"><span><strong>{row.opportunityTitle}</strong> {row.overdue && <Badge tone="danger">Overdue</Badge>}</span><span className="muted-small">{row.organization} · {new Date(row.dueAt).toLocaleString()} · {row.timeZone}</span>{row.note && <span>{row.note}</span>}</div><div className="row wrap"><Link className="btn btn-secondary btn-sm" to={`/opportunities/${row.opportunityId}`}>Open</Link><button className="btn btn-secondary btn-sm" type="button" onClick={() => update(row.id, 'Done')}>Done</button><button className="btn btn-ghost btn-sm" type="button" onClick={() => update(row.id, 'Cancelled')}>Cancel</button></div></li>)}</ul>}
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
