import { useState } from 'react'
import { Badge } from '../../components/StatusBadge'
import { api } from '../../lib/api'
import { EVENT_LABELS, HOW_TO, KIND_NAMES, WEBHOOK_KINDS, webhookProblem, type Integration, type IntegrationEvent, type IntegrationKind } from './integrationsModel'

const ALL_EVENTS = Object.keys(EVENT_LABELS) as IntegrationEvent[]

function HowTo({ kind }: Readonly<{ kind: IntegrationKind }>) {
  const help = HOW_TO[kind]
  return (
    <ol className="muted-small how-to-steps">
      {help.steps.map((s) => <li key={s}>{s}</li>)}
      {help.link && <li><a href={help.link.href} target="_blank" rel="noreferrer">{help.link.text}</a> (opens in a new tab)</li>}
    </ol>
  )
}

/** The connect form: a webhook address, or a token plus (Notion, Airtable) where to put the leads. The server checks it with the real service. */
function ConnectForm({ kind, onDone, onCancel }: Readonly<{ kind: IntegrationKind; onDone: () => void; onCancel: () => void }>) {
  const webhook = WEBHOOK_KINDS.includes(kind)
  const [url, setUrl] = useState('')
  const [token, setToken] = useState('')
  const [target, setTarget] = useState('')
  const [table, setTable] = useState('')
  const [events, setEvents] = useState<IntegrationEvent[]>(ALL_EVENTS)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const name = KIND_NAMES[kind]

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const problem = webhook ? webhookProblem(kind, url) : !token.trim() ? `Paste the ${name} token.` : (kind === 'Notion' || kind === 'Airtable') && !target.trim() ? `Paste the ${kind === 'Notion' ? 'database' : 'base'} link.` : null
    if (problem) { setMessage(problem); return }
    setBusy(true); setMessage('')
    try {
      await api(`/api/v1/integrations/${kind}`, { method: 'PUT', body: JSON.stringify(webhook ? { url: url.trim(), events } : { token: token.trim(), target: target.trim() || undefined, table: table.trim() || undefined }) })
      setToken(''); setUrl('')
      onDone()
    } catch (err) { setMessage((err as Error).message) } finally { setBusy(false) }
  }

  return (
    <form className="stack-3 connector-form" onSubmit={(e) => void submit(e)} aria-label={`Connect ${name}`}>
      <HowTo kind={kind} />
      {webhook ? (
        <label className="field"><span><strong>Webhook address</strong></span>
          <input value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" autoComplete="off" spellCheck={false} />
        </label>
      ) : (
        <label className="field"><span><strong>{kind === 'HubSpot' ? 'Access token' : kind === 'Notion' ? 'Integration secret' : kind === 'Hunter' || kind === 'Apollo' ? 'API key' : 'Personal access token'}</strong></span>
          <input type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" spellCheck={false} />
        </label>
      )}
      {(kind === 'Notion' || kind === 'Airtable') && (
        <label className="field"><span><strong>{kind === 'Notion' ? 'Database link' : 'Base or table link'}</strong></span>
          <input value={target} onChange={(e) => setTarget(e.target.value)} inputMode="url" autoComplete="off" spellCheck={false} />
        </label>
      )}
      {kind === 'Airtable' && (
        <label className="field"><span><strong>Table name</strong> <span className="muted-small">(optional)</span></span>
          <input value={table} onChange={(e) => setTable(e.target.value)} autoComplete="off" />
          <span className="muted-small">Leave empty to use the table in the link, or the first table.</span>
        </label>
      )}
      {webhook && (
        <fieldset className="field connector-events"><legend><strong>Post a message when</strong></legend>
          {ALL_EVENTS.map((ev) => (
            <label key={ev} className="check"><input type="checkbox" checked={events.includes(ev)} onChange={() => setEvents((x) => x.includes(ev) ? x.filter((y) => y !== ev) : [...x, ev])} /> {EVENT_LABELS[ev]}</label>
          ))}
        </fieldset>
      )}
      {message && <p className="notice notice-warning" role="alert">{message}</p>}
      <div className="row-actions">
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>{busy ? `Checking with ${name}…` : webhook ? 'Connect and send a test message' : `Connect ${name}`}</button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

/**
 * Connect, test and disconnect one service, in place on its card. Webhooks also choose their events; the calendar shows its private link.
 * Nothing here is pretend: connecting talks to the real service and fails with its reason.
 */
export function IntegrationControl({ kind, row, onChange }: Readonly<{ kind: IntegrationKind; row: Integration | undefined; onChange: () => void }>) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)
  const name = KIND_NAMES[kind]
  const webhook = WEBHOOK_KINDS.includes(kind)

  async function run(what: string, call: () => Promise<{ ok: boolean; text: string } | null>) {
    setBusy(what); setNote(null)
    try { setNote(await call()) } catch (e) { setNote({ ok: false, text: (e as Error).message }) } finally { setBusy(null) }
  }
  const test = () => run('test', async () => {
    const r = await api<{ ok: boolean; message: string }>(`/api/v1/integrations/${kind}/test`, { method: 'POST' })
    onChange()
    return { ok: r.ok, text: r.message }
  })
  const disconnect = () => run('disconnect', async () => { await api(`/api/v1/integrations/${kind}`, { method: 'DELETE' }); onChange(); return null })
  const createFeed = () => run('feed', async () => { await api('/api/v1/integrations/CalendarFeed', { method: 'PUT', body: '{}' }); onChange(); return null })
  const setEvents = (events: IntegrationEvent[]) => run('events', async () => {
    await api(`/api/v1/integrations/${kind}/events`, { method: 'PUT', body: JSON.stringify({ events }) }); onChange(); return null
  })
  const copy = (text: string) => run('copy', async () => { await navigator.clipboard.writeText(text); return { ok: true, text: 'Link copied.' } })

  const status = note && <p className={`muted-small ${note.ok ? '' : 'field-error'}`} role="status">{note.text}</p>

  if (!row?.connected) {
    if (kind === 'CalendarFeed') return <div className="stack-2"><HowTo kind={kind} /><div className="row wrap"><button type="button" className="btn btn-primary btn-sm" disabled={busy !== null} onClick={() => void createFeed()}>{busy ? 'Making your link…' : 'Make my private calendar link'}</button></div>{status}</div>
    if (open) return <ConnectForm kind={kind} onDone={() => { setOpen(false); onChange() }} onCancel={() => setOpen(false)} />
    return <div className="row wrap"><button type="button" className="btn btn-primary btn-sm" aria-expanded={false} onClick={() => setOpen(true)}>Connect {name}</button>{status}</div>
  }

  return (
    <div className="stack-2 connector-connected">
      <div className="row wrap">
        <Badge tone={row.lastError ? 'warning' : 'success'}>{row.lastError ? 'Needs attention' : 'Connected'}</Badge>
        <span className="muted-small">{row.label}{row.lastUsedAt ? ` · last used ${new Date(row.lastUsedAt).toLocaleString()}` : ''}</span>
      </div>
      {row.lastError && <p className="muted-small field-error">{row.lastError}</p>}
      {kind === 'CalendarFeed' && row.feedUrl && (
        <div className="stack-2">
          <label className="field"><span><strong>Your private calendar link</strong></span>
            <input readOnly value={row.feedUrl} onFocus={(e) => e.currentTarget.select()} spellCheck={false} />
            <span className="muted-small">Anyone with this link can see your follow-up times and company names. Stop sharing it with "Turn off link".</span>
          </label>
          <HowTo kind={kind} />
        </div>
      )}
      {webhook && (
        <fieldset className="field connector-events"><legend><strong>Post a message when</strong></legend>
          {ALL_EVENTS.map((ev) => (
            <label key={ev} className="check">
              <input type="checkbox" disabled={busy !== null} checked={row.events.includes(ev)}
                onChange={() => void setEvents(row.events.includes(ev) ? row.events.filter((x) => x !== ev) : [...row.events, ev])} /> {EVENT_LABELS[ev]}
            </label>
          ))}
        </fieldset>
      )}
      <div className="row wrap">
        {kind === 'CalendarFeed' && row.feedUrl && <button type="button" className="btn btn-secondary btn-sm" disabled={busy !== null} onClick={() => void copy(row.feedUrl!)}>Copy link</button>}
        {kind !== 'CalendarFeed' && <button type="button" className="btn btn-secondary btn-sm" disabled={busy !== null} onClick={() => void test()}>{busy === 'test' ? 'Checking…' : webhook ? 'Send a test message' : 'Check connection'}</button>}
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy !== null} onClick={() => void disconnect()}>{kind === 'CalendarFeed' ? 'Turn off link' : 'Disconnect'}<span className="sr-only"> {name}</span></button>
      </div>
      {status}
    </div>
  )
}
