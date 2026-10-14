import { useState } from 'react'
import { Card } from '../../components/cards'
import { ErrorNotice } from '../../components/ErrorNotice'
import { ProgressBar } from '../../components/ProgressBar'
import { percentOf } from '../../components/percent'
import { api } from '../../lib/api'
import type { DraftListItem } from '../../lib/types'
import { useApi } from '../../lib/useApi'
import { sendName, sendable, type Mailbox } from '../mail/mailModel'
import { BATCH_SEND_MAX, sendAllCandidates, summarizeBatchSend, type BatchSendResult } from './sendAll'

/**
 * "Send all": one action for every approved email, from the person's connected Outlook or Gmail. Only messages the person already approved
 * are included, nothing is sent until they confirm the list, each gets its own receipt, and the first failure stops the rest.
 */
export function SendAllCard({ items, onDone }: Readonly<{ items: DraftListItem[]; onDone: () => void }>) {
  const mailboxes = useApi<Mailbox[]>('/api/v1/mailboxes')
  const box = sendable(mailboxes.data)[0]
  const { ready, needApproval } = sendAllCandidates(items)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Error>()
  const [results, setResults] = useState<BatchSendResult[]>()

  if (!box || (ready.length === 0 && !results)) return null
  const name = sendName(box.provider)

  async function run() {
    setBusy(true); setError(undefined)
    try {
      const out = await api<BatchSendResult[]>('/api/v1/drafts/send-via-mailbox-batch', {
        method: 'POST', body: JSON.stringify({ provider: box.provider, items: ready.slice(0, BATCH_SEND_MAX).map((d) => ({ id: d.id, version: d.version })) }),
      })
      setResults(out); setConfirming(false); onDone()
    } catch (e) { setError(e as Error) } finally { setBusy(false) }
  }

  if (results) {
    const s = summarizeBatchSend(results, items)
    return (
      <Card tone={s.failed > 0 ? 'default' : 'signature'} title={s.headline} subtitle={`Accepted by ${name} is recorded as sent. It is not a delivery confirmation.`}
        footer={<button type="button" className="btn btn-secondary btn-sm" onClick={() => setResults(undefined)}>Close</button>}>
        <ProgressBar pct={percentOf(results.filter((r) => r.outcome === 'Sent').length, results.length)} label="Messages sent" text={`${results.filter((r) => r.outcome === 'Sent').length} of ${results.length} sent`} tone={s.failed > 0 ? 'warning' : 'success'} />
        <ul className="plain-list stack-2" aria-label="Result for each message">
          {s.lines.map((l) => <li key={l.id}><strong>{l.recipient}</strong> · {l.outcome}{l.reason ? ` — ${l.reason}` : ''}</li>)}
        </ul>
      </Card>
    )
  }

  const shown = ready.slice(0, BATCH_SEND_MAX)
  return (
    <Card tone="signature" title={`${shown.length} approved ${shown.length === 1 ? 'email is' : 'emails are'} ready`}
      subtitle={`Send them all from ${name} (${box.emailAddress}) in one go.${ready.length > BATCH_SEND_MAX ? ` The first ${BATCH_SEND_MAX} of ${ready.length}; send the rest afterwards.` : ''}${needApproval > 0 ? ` ${needApproval} more still need your approval and are not included.` : ''}`}
      footer={confirming
        ? <>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void run()}>{busy ? 'Sending…' : `Yes, send ${shown.length} now`}</button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setConfirming(false)}>Cancel</button>
        </>
        : <button type="button" className="btn btn-primary" onClick={() => setConfirming(true)}>Send all from {name}</button>}>
      {confirming && (
        <div className="stack-2">
          <p className="muted-small">These go out immediately and cannot be recalled. If one fails, the rest are not sent.</p>
          <ul className="plain-list" aria-label="Messages that will be sent">
            {shown.slice(0, 8).map((d) => <li key={d.id}>{d.recipient} <span className="muted-small">· {d.organization}</span></li>)}
            {shown.length > 8 && <li className="muted-small">and {shown.length - 8} more</li>}
          </ul>
        </div>
      )}
      {busy && <ProgressBar pct={100} active label="Sending" text={`Sending ${shown.length}…`} />}
      {error && <ErrorNotice error={error} />}
    </Card>
  )
}
