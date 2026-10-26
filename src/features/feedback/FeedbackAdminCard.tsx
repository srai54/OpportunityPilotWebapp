import { useState } from 'react'
import { Card } from '../../components/cards'
import { ErrorNotice } from '../../components/ErrorNotice'
import { KpiBand, KpiCard } from '../../components/kpi/kpi'
import { LoadingState } from '../../components/States'
import { Badge } from '../../components/StatusBadge'
import { api } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import type { ClientErrorItem, FeedbackItem, FeedbackSummary } from './feedbackModel'

const when = (iso: string) => { try { return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) } catch { return iso } }
const STATUSES: FeedbackItem['status'][] = ['New', 'Seen', 'Done']

function FeedbackRow({ item, onSaved }: Readonly<{ item: FeedbackItem; onSaved: (f: FeedbackItem) => void }>) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Error>()
  const id = `fb-status-${item.id}`
  async function set(status: FeedbackItem['status']) {
    setBusy(true); setError(undefined)
    try { onSaved(await api<FeedbackItem>(`/api/v1/admin/feedback/${item.id}/status`, { method: 'PUT', body: JSON.stringify({ status }) })) }
    catch (e) { setError(e as Error) } finally { setBusy(false) }
  }
  return (
    <li className="fb-item">
      <div className="fb-item-head">
        <Badge tone={item.kind === 'Bug' ? 'danger' : item.kind === 'Praise' ? 'success' : 'primary'}>{item.kind}</Badge>
        {item.rating && <span className="muted-small">{item.rating} of 5</span>}
        <span className="muted-small">{item.email ?? (item.guest ? 'Guest' : 'No email')} · {item.page ?? '—'} · {when(item.createdAt)}</span>
        <span className="grow" />
        <label className="sr-only" htmlFor={id}>Status</label>
        <select id={id} value={item.status} disabled={busy} onChange={(e) => void set(e.target.value as FeedbackItem['status'])}>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <p>{item.message}</p>
      {error && <ErrorNotice error={error} />}
    </li>
  )
}

/** Settings → Feedback and errors (admin only): what people sent from the app and the browser errors they hit, newest first. */
export function FeedbackAdminCard() {
  const summary = useApi<FeedbackSummary>('/api/v1/admin/feedback/summary')
  const list = useApi<FeedbackItem[]>('/api/v1/admin/feedback')
  const errors = useApi<ClientErrorItem[]>('/api/v1/admin/client-errors')
  const [saved, setSaved] = useState<Record<string, FeedbackItem>>({})
  const s = summary.data
  return (
    <Card title="Feedback and errors" subtitle="What people sent from the app, and errors their browsers hit (kept 30 days).">
      <div className="stack-4">
        {s && (
          <KpiBand label="Feedback figures">
            <KpiCard icon="sparkles" tone="indigo" label="New" value={s.new} sub="not read yet" />
            <KpiCard icon="trend" tone="teal" label="Last 7 days" value={s.last7Days} sub="messages" />
            <KpiCard icon="check" tone="green" label="Rating" value={s.averageRating ?? '—'} sub="average of 5" />
            <KpiCard icon="calendar" tone={s.errorsLast24h > 0 ? 'danger' : 'neutral'} label="Errors" value={s.errorsLast24h} sub={`last 24 h · ${s.errorKinds} kind${s.errorKinds === 1 ? '' : 's'}`} />
          </KpiBand>
        )}
        {list.loading && <LoadingState label="Loading feedback" />}
        {list.error && <ErrorNotice error={list.error} what="feedback" />}
        {list.data && list.data.length === 0 && <p className="muted-small">No feedback yet. People send it with "Send feedback" at the bottom of every page.</p>}
        {list.data && list.data.length > 0 && (
          <ul className="fb-list" aria-label="Feedback">
            {list.data.map((f) => saved[f.id] ?? f).map((f) => <FeedbackRow key={f.id} item={f} onSaved={(n) => { setSaved((m) => ({ ...m, [n.id]: n })); summary.reload() }} />)}
          </ul>
        )}
        <h4 className="fb-subhead">Browser errors</h4>
        {errors.error && <ErrorNotice error={errors.error} what="errors" />}
        {errors.data && errors.data.length === 0 && <p className="muted-small">No errors reported in the last 30 days.</p>}
        {errors.data && errors.data.length > 0 && (
          <ul className="fb-list" aria-label="Browser errors">
            {errors.data.slice(0, 20).map((e) => (
              <li key={e.id} className="fb-item">
                <div className="fb-item-head">
                  <strong>{e.count}×</strong>
                  <span className="muted-small">{e.page ?? '—'} · last {when(e.lastSeenAt)} · build {e.appVersion ?? '—'}</span>
                </div>
                <p>{e.message}</p>
                {e.stack && <details><summary>Stack</summary><pre>{e.stack}</pre></details>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}
