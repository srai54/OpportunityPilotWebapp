import { ReplyCheck } from './ReplyCheck'
import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Card } from '../../components/cards'
import { ErrorNotice } from '../../components/ErrorNotice'
import { Badge } from '../../components/StatusBadge'
import { api } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { mailboxState, providerName, returnNotice, SMTP_PRESETS, smtpFormProblem, type Mailbox, type MailProvider } from './mailModel'

/** Connect your own email with an app password: no sign-in screen and no app registration. The password is checked with one test message to yourself. */
function SmtpForm({ onDone, onCancel }: Readonly<{ onDone: () => void; onCancel: () => void }>) {
  const [preset, setPreset] = useState('gmail')
  const [host, setHost] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const help = SMTP_PRESETS.find((x) => x.value === preset)?.help

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const problem = smtpFormProblem({ preset, host, username, password })
    if (problem) { setMessage(problem); return }
    setBusy(true); setMessage('')
    try {
      await api('/api/v1/mailboxes/smtp', { method: 'POST', body: JSON.stringify({ preset, host: preset === 'custom' ? host.trim() : undefined, username: username.trim(), password }) })
      setPassword('')
      onDone()
    } catch (err) { setMessage((err as Error).message) } finally { setBusy(false) }
  }

  return (
    <form className="stack-3 smtp-form" onSubmit={(e) => void submit(e)} aria-label="Connect your email with an app password">
      <label className="field"><span><strong>Email provider</strong></span>
        <select value={preset} onChange={(e) => setPreset(e.target.value)}>{SMTP_PRESETS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select>
      </label>
      {preset === 'custom' && <label className="field"><span><strong>Mail server</strong></span>
        <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="smtp.example.com" autoComplete="off" inputMode="url" />
        <span className="muted-small">Port 587 with STARTTLS.</span>
      </label>}
      <label className="field"><span><strong>Your email address</strong></span>
        <input type="email" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="you@example.com" autoComplete="email" />
      </label>
      <label className="field"><span><strong>App password</strong></span>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" />
        <span className="muted-small">An app password is not your normal password: your provider makes one just for this app, and you can delete it any time.{help && <> <a href={help.href} target="_blank" rel="noreferrer">{help.text}</a> (opens in a new tab).</>}</span>
      </label>
      {message && <p className="notice notice-warning" role="alert">{message}</p>}
      <div className="row-actions">
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>{busy ? 'Checking the login…' : 'Connect and send a test message to myself'}</button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

/**
 * Settings → "Send from your own mailbox". Connecting goes to Microsoft or Google to ask for permission to send only; the app never
 * sees the password. Until the server has its app credentials the rows say so, and nothing here pretends to work.
 */
export function MailboxesCard() {
  const boxes = useApi<Mailbox[]>('/api/v1/mailboxes')
  const notice = returnNotice(useLocation().search)
  const [busy, setBusy] = useState<MailProvider | null>(null)
  const [error, setError] = useState<Error>()
  const [smtpOpen, setSmtpOpen] = useState(false)

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
        <p className="muted-small">Connect your email and an approved message goes out with one click. You still approve every message. The quickest way is an app password; Outlook and Gmail sign-in also work once the server owner has set them up. The app only sends, it never reads your mail.</p>
        {notice && <p className={`notice notice-${notice.tone}`} role="status">{notice.text}</p>}
        {(boxes.error || error) && <ErrorNotice error={(boxes.error ?? error)!} onRetry={boxes.reload} what="your mailboxes" />}
        <ul className="plain-list mailbox-list">
          {[...(boxes.data ?? [])].sort((a, b) => Number(b.provider === 'Smtp') - Number(a.provider === 'Smtp')).map((m) => {
            const state = mailboxState(m)
            const name = providerName(m.provider)
            return (
              <li key={m.provider} className="mailbox-row">
                <strong>{name}</strong>
                <Badge tone={state.tone}>{state.text}</Badge>
                <span className="grow" />
                {m.connected
                  ? <>
                    {m.status === 'NeedsReconnect' && <button type="button" className="btn btn-primary btn-sm" disabled={busy !== null || !m.configured}
                      onClick={() => m.provider === 'Smtp' ? setSmtpOpen(true) : void connect(m.provider)}>Connect {name} again</button>}
                    <button type="button" className="btn btn-ghost btn-sm" disabled={busy !== null} onClick={() => void disconnect(m.provider)}>Disconnect<span className="sr-only"> {name}</span></button>
                  </>
                  : m.provider === 'Smtp'
                    ? <button type="button" className="btn btn-primary btn-sm" disabled={busy !== null || !m.configured} aria-expanded={smtpOpen} onClick={() => setSmtpOpen((o) => !o)}>Connect with app password</button>
                    : <button type="button" className="btn btn-secondary btn-sm" disabled={busy !== null || !m.configured} onClick={() => void connect(m.provider)}>Connect {name}</button>}
              </li>
            )
          })}
        </ul>
        {boxes.data?.some((m) => m.provider === 'Smtp' && m.connected && m.status !== 'NeedsReconnect') && <ReplyCheck />}
        {smtpOpen && (() => { const s = boxes.data?.find((m) => m.provider === 'Smtp'); return !s?.connected || s.status === 'NeedsReconnect' })() && <SmtpForm onDone={() => { setSmtpOpen(false); boxes.reload() }} onCancel={() => setSmtpOpen(false)} />}
        {boxes.data?.filter((m) => m.provider !== 'Smtp').every((m) => !m.configured) && <p className="muted-small">Outlook and Gmail sign-in are switched on by the owner of this server (an Entra or Google app has to be registered once). The app password above needs nothing from the owner.</p>}
      </div>
    </Card>
  )
}
