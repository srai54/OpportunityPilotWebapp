import { useState } from 'react'
import { api } from '../../lib/api'

interface ReplyCheckResult { checked: number; replies: number; items: { opportunityId: string; organization: string; from: string; subject: string; receivedAt: string }[] }

/** Reads the inbox headers (never the mail itself, nothing marked read) and records replies to messages you sent. Also runs every 30 minutes on the server. */
export function ReplyCheck({ onDone }: Readonly<{ onDone?: () => void }>) {
  const [busy, setBusy] = useState(false)
  const [text, setText] = useState('')
  const [failed, setFailed] = useState(false)

  async function check() {
    setBusy(true); setText(''); setFailed(false)
    try {
      const r = await api<ReplyCheckResult>('/api/v1/mailboxes/smtp/check-replies', { method: 'POST' })
      setText(r.replies === 0
        ? `No new replies (${r.checked} recent message${r.checked === 1 ? '' : 's'} looked at).`
        : `${r.replies} new repl${r.replies === 1 ? 'y' : 'ies'}: ${r.items.slice(0, 3).map((i) => i.organization || i.from).join(', ')}${r.items.length > 3 ? '…' : ''}. Their leads are now Responded and their follow-ups are cancelled.`)
      onDone?.()
    } catch (e) { setText((e as Error).message); setFailed(true) } finally { setBusy(false) }
  }

  return (
    <div className="stack-2 reply-check">
      <div className="row wrap">
        <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void check()}>{busy ? 'Checking your inbox…' : 'Check for replies now'}</button>
        <span className="muted-small">Also checked every 30 minutes. Only the sender, subject and date are read; nothing is marked as read.</span>
      </div>
      {text && <p className={failed ? 'field-error' : 'muted-small'} role="status">{text}</p>}
    </div>
  )
}
