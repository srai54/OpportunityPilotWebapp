import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorNotice } from '../../components/ErrorNotice'
import { Badge } from '../../components/StatusBadge'
import { api } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { canConnectOne, sendName, sendable, type Mailbox } from '../mail/mailModel'

type Execution = {
  id: string; state: 'AwaitingManualConfirmation' | 'Succeeded' | 'Failed'; provider: string; attempt?: number
  receipt: string | null; safeFailure: string | null; createdAt: string; completedAt: string | null; instructions: string
}

/**
 * Sending an approved draft (S13/P6): start an execution (checks approval, suppression, quota, idempotency), send the exact
 * text yourself, then confirm with a receipt — or record that it failed. Only a confirmed send marks the draft Sent.
 */
export function SendPanel({ draftId, version, state, onChange, onSent, appLabel, onOpenAgain }: { draftId: string; version: number; state: string; onChange: () => void; onSent?: () => void; appLabel?: string; onOpenAgain?: () => void }) {
  const executions = useApi<Execution[]>(`/api/v1/executions?subjectId=${draftId}`)
  const mailboxes = useApi<Mailbox[]>('/api/v1/mailboxes')
  const ready = sendable(mailboxes.data)
  const [receipt, setReceipt] = useState('')
  const [failure, setFailure] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Error>()
  const pending = executions.data?.find((e) => e.state === 'AwaitingManualConfirmation')
  const sent = executions.data?.find((e) => e.state === 'Succeeded')

  async function run(path: string, body: unknown, sentOk = false) {
    setBusy(true); setError(undefined)
    try { await api(path, { method: 'POST', body: JSON.stringify(body) }); setReceipt(''); setFailure(''); executions.reload(); onChange(); if (sentOk) onSent?.() }
    catch (e) { setError(e as Error) } finally { setBusy(false) }
  }

  if (state !== 'Approved' && state !== 'Sent') return null
  return <section className="subtle-box stack-2" aria-label="Send" data-coach="out-receipt">
    {error && <ErrorNotice error={error} />}
    {sent ? <p className="small"><Badge tone="success">Sent</Badge> Recorded {sent.completedAt ? new Date(sent.completedAt).toLocaleString() : ''}: {sent.receipt}</p>
      : pending ? <>
        <p className="small">Press Send in your mail app, then come back and click the button.</p>
        {onOpenAgain && <div className="row wrap"><button className="btn btn-secondary btn-sm" type="button" onClick={onOpenAgain}>Open {appLabel ?? 'the mail app'} again</button><span className="muted-small">Closed it by mistake or it did not open? This opens the same message; nothing is sent or recorded twice.</span></div>}
        <div className="row wrap">
          <button className="btn btn-primary" type="button" disabled={busy}
            onClick={() => void run(`/api/v1/executions/${pending.id}/confirm`, { receipt: `Marked as sent by you after opening ${appLabel ?? 'your mail app'} (${new Date().toLocaleString()})` }, true)}>
            I pressed Send ✓
          </button>
          <span className="muted-small">One click records it as sent and sets your follow-up reminder.</span>
        </div>
        <details className="send-more">
          <summary>Add a receipt detail, or say it did not send</summary>
          <form className="row wrap" onSubmit={(e) => { e.preventDefault(); if (receipt.trim()) void run(`/api/v1/executions/${pending.id}/confirm`, { receipt: receipt.trim() }, true) }}>
            <input className="grow" aria-label="Receipt" value={receipt} maxLength={1000} onChange={(e) => setReceipt(e.target.value)} placeholder="Receipt: sent item subject or id, time" />
            <button className="btn btn-secondary btn-sm" type="submit" disabled={busy || !receipt.trim()}>Record it as sent</button>
          </form>
          <form className="row wrap" onSubmit={(e) => { e.preventDefault(); if (failure.trim()) void run(`/api/v1/executions/${pending.id}/fail`, { reason: failure.trim() }) }}>
            <input className="grow" aria-label="What went wrong" value={failure} maxLength={500} onChange={(e) => setFailure(e.target.value)} placeholder="What went wrong (bounced, form error…)" />
            <button className="btn btn-ghost btn-sm" type="submit" disabled={busy || !failure.trim()}>It failed</button>
          </form>
        </details>
      </>
      : <div className="stack-2">
        {ready.map((m) => (
          <div className="row wrap" key={m.provider}>
            <button className="btn btn-primary" type="button" disabled={busy} onClick={() => void run(`/api/v1/drafts/${draftId}/send-via-mailbox`, { version, provider: m.provider }, true)}>
              {busy ? 'Sending…' : `Send from ${sendName(m.provider)}`}
            </button>
            <span className="muted-small">From {m.emailAddress}. Accepted by {sendName(m.provider)} is recorded as sent; it is not a delivery confirmation.</span>
          </div>
        ))}
        <div className="row wrap">
          <button className={`btn ${ready.length > 0 ? 'btn-secondary' : 'btn-primary'} btn-sm`} type="button" disabled={busy} onClick={() => void run(`/api/v1/executions/drafts/${draftId}`, { version })}>{ready.length > 0 ? 'I will send it myself' : 'Send this approved version'}</button>
          <span className="muted-small">Checks approval, the suppression list and today's limit; it can be recorded as sent only once.</span>
        </div>
        {canConnectOne(mailboxes.data) && <p className="muted-small">Want one click? <Link to="/settings">Connect your email in Settings</Link>.</p>}
      </div>}
    {(executions.data ?? []).filter((e) => e.state === 'Failed').map((e) => <p key={e.id} className="muted-small">Earlier attempt failed: {e.safeFailure}</p>)}
  </section>
}
