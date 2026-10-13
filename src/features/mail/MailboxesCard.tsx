import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Card } from '../../components/cards'
import { ErrorNotice } from '../../components/ErrorNotice'
import { Badge } from '../../components/StatusBadge'
import { api } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { mailboxState, providerName, returnNotice, type Mailbox, type MailProvider } from './mailModel'

/**
 * Settings → "Send from your own mailbox". Connecting goes to Microsoft or Google to ask for permission to send only; the app never
 * sees the password. Until the server has its app credentials the rows say so, and nothing here pretends to work.
 */
export function MailboxesCard() {
  const boxes = useApi<Mailbox[]>('/api/v1/mailboxes')
  const notice = returnNotice(useLocation().search)
  const [busy, setBusy] = useState<MailProvider | null>(null)
  const [error, setError] = useState<Error>()

  async function connect(p: MailProvider) {
    setBusy(p); setError(undefined)
    try {
      const { url } = await api<{ url: string }>(`/api/v1/mailboxes/${p}/connect`, { method: 'POST' })
      window.location.assign(url)
    } catch (e) { setError(e as Error); setBusy(null) }
  }

  async function disconnect(p: MailProvider) {
    setBusy(p); setError(undefined)
    try { await api(`/api/v1/mailboxes/${p}`, { method: 'DELETE' }); boxes.reload() }
    catch (e) { setError(e as Error) } finally { setBusy(null) }
  }

  return (
    <Card title="Send from your own mailbox">
      <div className="stack-3">
        <p className="muted-small">Connect Outlook or Gmail and an approved message goes out with one click. You still approve every message; the app only asks for permission to send, never to read your mail.</p>
        {notice && <p className={`notice notice-${notice.tone}`} role="status">{notice.text}</p>}
        {(boxes.error || error) && <ErrorNotice error={(boxes.error ?? error)!} onRetry={boxes.reload} what="your mailboxes" />}
        <ul className="plain-list mailbox-list">
          {(boxes.data ?? []).map((m) => {
            const state = mailboxState(m)
            const name = providerName(m.provider)
            return (
              <li key={m.provider} className="mailbox-row">
                <strong>{name}</strong>
                <Badge tone={state.tone}>{state.text}</Badge>
                <span className="grow" />
                {m.connected
                  ? <>
                    {m.status === 'NeedsReconnect' && <button type="button" className="btn btn-primary btn-sm" disabled={busy !== null || !m.configured} onClick={() => void connect(m.provider)}>Connect {name} again</button>}
                    <button type="button" className="btn btn-ghost btn-sm" disabled={busy !== null} onClick={() => void disconnect(m.provider)}>Disconnect<span className="sr-only"> {name}</span></button>
                  </>
                  : <button type="button" className="btn btn-secondary btn-sm" disabled={busy !== null || !m.configured} onClick={() => void connect(m.provider)}>Connect {name}</button>}
              </li>
            )
          })}
        </ul>
        {boxes.data?.every((m) => !m.configured) && <p className="muted-small">Sending from a mailbox is switched on by the owner of this server (an Entra or Google app has to be registered once). Until then, "Approve &amp; send" opens your mail app as before.</p>}
      </div>
    </Card>
  )
}
