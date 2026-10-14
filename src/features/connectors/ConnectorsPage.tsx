import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Avatar, Card, CardGrid } from '../../components/cards'
import { PageHeader } from '../../components/PageHeader'
import { Badge } from '../../components/StatusBadge'
import { api } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import type { Mailbox } from '../mail/mailModel'
import { CONNECTORS, filterConnectors, isConnected, pluginKindOf, readWants, toggleWant, writeWants, type Connector } from './connectorsModel'
import { ConnectForm, IntegrationControl, TargetPicker } from './IntegrationControl'
import { KIND_NAMES, PICKS_TARGET, oauthReturn, type Integration, type IntegrationKind } from './integrationsModel'

/** The older way to connect a card: a mailbox sign-in, a token or address form, a file export, or the page that does it. */
function ClassicAction({ c, mailboxes, integrations, reload }: Readonly<{ c: Connector; mailboxes: Mailbox[] | undefined; integrations: Integration[] | undefined; reload: () => void }>) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function connect(provider: string) {
    setBusy(true); setError('')
    try {
      const { url } = await api<{ url: string }>(`/api/v1/mailboxes/${provider}/connect`, { method: 'POST' })
      window.location.assign(url)
    } catch (e) { setError((e as Error).message); setBusy(false) }
  }
  const note = error && <span className="muted-small" role="alert">{error}</span>
  if (c.action?.startsWith('mail-')) {
    const provider = c.action.slice(5)
    const box = mailboxes?.find((m) => m.provider === provider)
    if (box?.connected) return <><Badge tone="success">Connected ✓</Badge><Link className="btn btn-ghost btn-sm" to="/settings">Manage<span className="sr-only"> {c.name}</span></Link></>
    if (box && !box.configured) return <span className="muted-small">Not available yet</span>
    return <><button type="button" className="btn btn-primary btn-sm" disabled={busy || !box} onClick={() => void connect(provider)}>{busy ? 'Opening…' : 'Connect'}<span className="sr-only"> {c.name}</span></button>{note}</>
  }
  if (c.action === 'smtp') {
    const box = mailboxes?.find((m) => m.provider === 'Smtp')
    if (box?.connected) return <><Badge tone="success">Connected ✓</Badge><Link className="btn btn-ghost btn-sm" to="/settings">Manage<span className="sr-only"> {c.name}</span></Link></>
    return <Link className="btn btn-primary btn-sm" to="/settings">Connect<span className="sr-only"> {c.name}</span></Link>
  }
  if (c.action?.startsWith('int-')) {
    const kind = c.action.slice(4) as IntegrationKind
    return <IntegrationControl kind={kind} row={integrations?.find((x) => x.kind === kind)} onChange={reload} />
  }
  if (c.action === 'csv') return <Link className="btn btn-primary btn-sm" to="/opportunities">Export CSV<span className="sr-only"> for {c.name}</span></Link>
  if (c.action === 'account') return <Link className="btn btn-secondary btn-sm" to="/settings">Open settings<span className="sr-only"> for {c.name}</span></Link>
  return null
}

/** One-click "Connect" through the plugin platform: go to the app's own page, allow access, come back connected. */
function PluginAction({ kind, row, reload }: Readonly<{ kind: IntegrationKind; row: Integration | undefined; reload: () => void }>) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const name = KIND_NAMES[kind]

  async function connect() {
    setBusy(true); setError('')
    try {
      const { url } = await api<{ url: string }>(`/api/v1/integrations/${kind}/plugin`, { method: 'POST' })
      window.location.assign(url)
    } catch (e) { setError((e as Error).message); setBusy(false) }
  }
  async function disconnect() {
    setBusy(true); setError('')
    try { await api(`/api/v1/integrations/${kind}`, { method: 'DELETE' }); reload() } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  const failed = error && <p className="muted-small field-error" role="alert">{error}</p>
  if (!row?.connected || row.lastError) {
    return (
      <>
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void connect()}>
          {busy ? 'Opening…' : row?.connected ? 'Connect again' : 'Connect'}<span className="sr-only"> {name}</span>
        </button>
        {failed}
      </>
    )
  }
  return (
    <div className="stack-2 connector-connected">
      <div className="row wrap">
        <Badge tone={row.needsTarget ? 'warning' : 'success'}>{row.needsTarget ? 'One step left' : 'Connected ✓'}</Badge>
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void disconnect()}>Disconnect<span className="sr-only"> {name}</span></button>
      </div>
      {row.needsTarget && PICKS_TARGET.includes(kind) && <TargetPicker kind={kind} onDone={reload} />}
      {failed}
    </div>
  )
}

/** A card's controls: the one-click button when the server has the plugin key, with the older ways kept behind "Advanced". */
function CardAction({ c, mailboxes, integrations, reload }: Readonly<{ c: Connector; mailboxes: Mailbox[] | undefined; integrations: Integration[] | undefined; reload: () => void }>) {
  const [advanced, setAdvanced] = useState(false)
  const kind = pluginKindOf(c)
  const row = kind ? integrations?.find((x) => x.kind === kind) : undefined
  if (!kind || !(row?.pluginReady || row?.connected)) return <ClassicAction c={c} mailboxes={mailboxes} integrations={integrations} reload={reload} />
  return (
    <div className="stack-2 connector-form">
      <div className="row wrap"><PluginAction kind={kind} row={row} reload={reload} /></div>
      {!row?.connected && (advanced ? (
        <div className="stack-2">
          {c.action?.startsWith('int-')
            ? <ConnectForm kind={kind} onDone={() => { setAdvanced(false); reload() }} onCancel={() => setAdvanced(false)} />
            : <ClassicAction c={c} mailboxes={mailboxes} integrations={integrations} reload={reload} />}
        </div>
      ) : (
        <button type="button" className="btn-link connector-advanced" aria-expanded={false} onClick={() => setAdvanced(true)}>
          Advanced: use your own token<span className="sr-only"> for {c.name}</span>
        </button>
      ))}
    </div>
  )
}

/**
 * Connectors: a plugin gallery. Each card is an app with one button; Connect goes to the app's own page and comes back connected.
 * "I want this" on a planned card only records your interest in this browser.
 */
export function ConnectorsPage() {
  const [params, setParams] = useSearchParams()
  const [returned] = useState(() => oauthReturn(params))
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState(returned)
  const noticeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!returned) return
    // The result is read once; the address is cleaned so a reload does not repeat it.
    setParams({}, { replace: true })
    noticeRef.current?.focus()
  }, [returned, setParams])
  const [wants, setWants] = useState(readWants)
  const shown = filterConnectors(CONNECTORS, { query, category: 'All', audience: 'All' })
  const mailboxes = useApi<Mailbox[]>('/api/v1/mailboxes')
  const integrations = useApi<Integration[]>('/api/v1/integrations')
  const reload = () => { integrations.reload(); mailboxes.reload() }
  const connected = CONNECTORS.filter((c) => isConnected(c, integrations.data, mailboxes.data))

  function toggle(id: string) {
    const next = toggleWant(wants, id)
    setWants(next)
    writeWants(next)
  }

  return (
    <div className="page page-wide stack-4">
      <PageHeader title="Connectors" subtitle="Connect your apps in one click." />
      {notice && (
        <div ref={noticeRef} tabIndex={-1} className={`notice ${notice.ok ? 'notice-success' : 'notice-warning'}`} role={notice.ok ? 'status' : 'alert'}>
          <span>{notice.text}</span>
          <button type="button" className="btn btn-ghost btn-sm notice-action" onClick={() => setNotice(null)}>Dismiss<span className="sr-only"> this message</span></button>
        </div>
      )}

      <label className="search-field search-field-main connector-search">
        <span className="sr-only">Search apps</span>
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search apps" />
      </label>

      {connected.length > 0 && (
        <section className="stack-2" aria-labelledby="connected-apps">
          <h3 id="connected-apps" className="eyebrow">Connected</h3>
          <ul className="connected-row">
            {connected.map((c) => <li key={c.id} className="connected-chip"><Avatar name={c.name} /><span>{c.name}</span></li>)}
          </ul>
        </section>
      )}

      {shown.length === 0 ? (
        <Card tone="muted"><p>No app matches “{query}”. <button type="button" className="btn-link" onClick={() => setQuery('')}>Clear search</button></p></Card>
      ) : (
        <CardGrid label="Apps">
          {shown.map((c) => {
            const want = wants.includes(c.id)
            return (
              <li key={c.id} className="ccard connector-card">
                <div className="connector-head">
                  <Avatar name={c.name} />
                  <div className="connector-titles">
                    <h3 className="connector-name">{c.name}</h3>
                    <span className="muted-small">{c.short}</span>
                  </div>
                </div>
                <div className="row wrap connector-control">
                  <CardAction c={c} mailboxes={mailboxes.data} integrations={integrations.data} reload={reload} />
                  {(c.status === 'Planned' || c.status === 'Next up') && c.action !== 'account' && (
                    <button type="button" className={`btn btn-sm ${want ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={want} onClick={() => toggle(c.id)}>
                      {want ? '✓ You want this' : 'I want this'}<span className="sr-only"> ({c.name})</span>
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </CardGrid>
      )}
    </div>
  )
}
