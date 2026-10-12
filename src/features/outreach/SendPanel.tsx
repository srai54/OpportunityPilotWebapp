import { useState } from 'react'
import { ErrorNotice } from '../../components/ErrorNotice'
import { Badge } from '../../components/StatusBadge'
import { api } from '../../lib/api'
import { useApi } from '../../lib/useApi'

type Execution = {
  id: string; state: 'AwaitingManualConfirmation' | 'Succeeded' | 'Failed'; provider: string; attempt?: number
  receipt: string | null; safeFailure: string | null; createdAt: string; completedAt: string | null; instructions: string
}

/**
 * Sending an approved draft (S13/P6): start an execution (checks approval, suppression, quota, idempotency), send the exact
 * text yourself, then confirm with a receipt — or record that it failed. Only a confirmed send marks the draft Sent.
 */
export function SendPanel({ draftId, version, state, onChange }: { draftId: string; version: number; state: string; onChange: () => void }) {
  const executions = useApi<Execution[]>(`/api/v1/executions?subjectId=${draftId}`)
  const [receipt, setReceipt] = useState('')
  const [failure, setFailure] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Error>()
  const pending = executions.data?.find((e) => e.state === 'AwaitingManualConfirmation')
  const sent = executions.data?.find((e) => e.state === 'Succeeded')

  async function run(path: string, body: unknown) {
    setBusy(true); setError(undefined)
    try { await api(path, { method: 'POST', body: JSON.stringify(body) }); setReceipt(''); setFailure(''); executions.reload(); onChange() }
    catch (e) { setError(e as Error) } finally { setBusy(false) }
  }

  if (state !== 'Approved' && state !== 'Sent') return null
  return <section className="subtle-box stack-2" aria-label="Send" data-coach="out-receipt">
    {error && <ErrorNotice error={error} />}
    {sent ? <p className="small"><Badge tone="success">Sent</Badge> Recorded {sent.completedAt ? new Date(sent.completedAt).toLocaleString() : ''}: {sent.receipt}</p>
      : pending ? <>
        <p className="small">{pending.instructions}</p>
        <form className="row wrap" onSubmit={(e) => { e.preventDefault(); if (receipt.trim()) void run(`/api/v1/executions/${pending.id}/confirm`, { receipt: receipt.trim() }) }}>
          <input className="grow" aria-label="Receipt" value={receipt} maxLength={1000} onChange={(e) => setReceipt(e.target.value)} placeholder="Receipt: sent item subject or id, time" />
          <button className="btn btn-primary btn-sm" type="submit" disabled={busy || !receipt.trim()}>I sent it</button>
        </form>
        <form className="row wrap" onSubmit={(e) => { e.preventDefault(); if (failure.trim()) void run(`/api/v1/executions/${pending.id}/fail`, { reason: failure.trim() }) }}>
          <input className="grow" aria-label="What went wrong" value={failure} maxLength={500} onChange={(e) => setFailure(e.target.value)} placeholder="Or: what went wrong (bounced, form error…)" />
          <button className="btn btn-secondary btn-sm" type="submit" disabled={busy || !failure.trim()}>It failed</button>
        </form>
      </>
      : <div className="row wrap">
        <button className="btn btn-primary btn-sm" type="button" disabled={busy} onClick={() => void run(`/api/v1/executions/drafts/${draftId}`, { version })}>Send this approved version</button>
        <span className="muted-small">Checks approval, the suppression list and today's limit; it can be recorded as sent only once.</span>
      </div>}
    {(executions.data ?? []).filter((e) => e.state === 'Failed').map((e) => <p key={e.id} className="muted-small">Earlier attempt failed: {e.safeFailure}</p>)}
  </section>
}
