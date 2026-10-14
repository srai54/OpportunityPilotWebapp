import { useEffect, useState } from 'react'
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
/** The channels a message can be switched to while its send is open (a contact form stays a contact form). */
export type SwitchChannel = 'Email' | 'LinkedInMessage'

export function SendPanel({ draftId, version, state, onChange, onSent, appLabel, onOpenAgain, channel, onSwitchChannel, onPending }: {
  draftId: string; version: number; state: string; onChange: () => void; onSent?: () => void; appLabel?: string; onOpenAgain?: () => void
  channel?: string; onSwitchChannel?: (to: SwitchChannel) => void
  /** Told whether a send is open (waiting for "I pressed Send"), so the page can hide its own send button meanwhile. */
  onPending?: (open: boolean) => void
}) {
  const executions = useApi<Execution[]>(`/api/v1/executions?subjectId=${draftId}`)
  const mailboxes = useApi<Mailbox[]>('/api/v1/mailboxes')
  const ready = sendable(mailboxes.data)
  const [receipt, setReceipt] = useState('')
  const [failure, setFailure] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Error>()
  const pending = executions.data?.find((e) => e.state === 'AwaitingManualConfirmation')
  const sent = executions.data?.find((e) => e.state === 'Succeeded')
  const open = Boolean(pending) && !sent
  useEffect(() => { onPending?.(open) }, [open, onPending])

  async function run(path: string, body: unknown, sentOk = false) {
    setBusy(true); setError(undefined)
    try { await api(path, { method: 'POST', body: JSON.stringify(body) }); setReceipt(''); setFailure(''); executions.reload(); onChange(); if (sentOk) onSent?.() }
    catch (e) { setError(e as Error) } finally { setBusy(false) }
  }

  /**
   * Leave the open send and do it another way: the open attempt is recorded as not sent (so nothing can be counted twice), then
   * the next way runs. The same approved version can be sent again afterwards.
   */
  async function another(reason: string, next?: () => Promise<void> | void) {
    if (!pending) return
    setBusy(true); setError(undefined)
    try {
      await api(`/api/v1/executions/${pending.id}/fail`, { method: 'POST', body: JSON.stringify({ reason }) })
      executions.reload(); onChange()
      await next?.()
    } catch (e) { setError(e as Error) } finally { setBusy(false) }
  }
  const sendFromMailbox = (provider: string) => async () => {
    await api(`/api/v1/drafts/${draftId}/send-via-mailbox`, { method: 'POST', body: JSON.stringify({ version, provider }) })
    executions.reload(); onChange(); onSent?.()
  }

  if (state !== 'Approved' && state !== 'Sent') return null
  return <section className="subtle-box stack-2" aria-label="Send" data-coach="out-receipt">
    {error && <ErrorNotice error={error} />}
    {sent ? <p className="small"><Badge tone="success">Sent</Badge> Recorded {sent.completedAt ? new Date(sent.completedAt).toLocaleString() : ''}: {sent.receipt}</p>
      : pending ? <>
        <p className="small">Press Send in your mail app, then come back and click the button.</p>
        <div className="row wrap">
          <button className="btn btn-primary" type="button" disabled={busy}
            onClick={() => void run(`/api/v1/executions/${pending.id}/confirm`, { receipt: `Marked as sent by you after opening ${appLabel ?? 'your mail app'} (${new Date().toLocaleString()})` }, true)}>
            I pressed Send ✓
          </button>
          <span className="muted-small">One click records it as sent and sets your follow-up reminder.</span>
        </div>
        <div className="stack-2 send-ways" role="group" aria-label="Send it another way">
          <p className="small"><strong>Did not open, or want to send it another way?</strong></p>
          <div className="row wrap">
            {onOpenAgain && <button className="btn btn-secondary btn-sm" type="button" disabled={busy} onClick={onOpenAgain}>Open in {appLabel ?? 'the mail app'}</button>}
            {channel === 'Email' && ready.map((m) => (
              <button key={m.provider} className="btn btn-secondary btn-sm" type="button" disabled={busy}
                onClick={() => void another(`Sent from ${sendName(m.provider)} instead.`, sendFromMailbox(m.provider))}>Send from {sendName(m.provider)} instead</button>
            ))}
            {onSwitchChannel && channel === 'Email' && <button className="btn btn-secondary btn-sm" type="button" disabled={busy}
              onClick={() => void another('Switched to a LinkedIn note.', () => onSwitchChannel('LinkedInMessage'))}>Send as a LinkedIn note</button>}
            {onSwitchChannel && channel === 'LinkedInMessage' && <button className="btn btn-secondary btn-sm" type="button" disabled={busy}
              onClick={() => void another('Switched to an email.', () => onSwitchChannel('Email'))}>Send as an email</button>}
            <button className="btn btn-ghost btn-sm" type="button" disabled={busy} onClick={() => void another('Not sent: you said it did not go out.')}>It did not send</button>
          </div>
          {channel === 'Email' && <span className="muted-small">To use another mail app, pick it in "Open email in" above, then press Open in. Nothing is sent or recorded twice.</span>}
        </div>
        <details className="send-more">
          <summary>Add a receipt detail, or say what went wrong</summary>
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
