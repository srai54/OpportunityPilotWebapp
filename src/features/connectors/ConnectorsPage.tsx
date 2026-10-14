import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Avatar, Card, CardGrid } from '../../components/cards'
import { PageHeader } from '../../components/PageHeader'
import { Badge } from '../../components/StatusBadge'
import { api } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import type { Mailbox } from '../mail/mailModel'
import { useShell } from '../shell/ShellContext'
import { CATEGORIES, CONNECTORS, connectorStatus, filterConnectors, readWants, toggleWant, writeWants, type Audience, type Connector, type ConnectorCategory, type ConnectorStatus } from './connectorsModel'
import { IntegrationControl } from './IntegrationControl'
import { oauthReturn, type Integration, type IntegrationKind } from './integrationsModel'

const STATUS_TONE: Record<ConnectorStatus, 'success' | 'primary' | 'warning' | 'neutral'> = {
  'Connect now': 'success', 'Needs server setup': 'warning', 'File export': 'neutral', 'Next up': 'primary', Planned: 'neutral',
}

/** The control a card shows: connect a mailbox or a service in place, export a file, or open the page that does it. Cards without one only save interest. */
function ConnectorAction({ c, mailboxes, integrations, reload }: Readonly<{ c: Connector; mailboxes: Mailbox[] | undefined; integrations: Integration[] | undefined; reload: () => void }>) {
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
    if (box?.connected) return <><Badge tone="success">Connected{box.emailAddress ? ` as ${box.emailAddress}` : ''}</Badge><Link className="btn btn-ghost btn-sm" to="/settings">Manage</Link></>
    if (box && !box.configured) return <span className="muted-small">The server owner has not switched this on yet — see the setup guide, then it connects here.</span>
    return <><button type="button" className="btn btn-primary btn-sm" disabled={busy || !box} onClick={() => void connect(provider)}>{busy ? 'Opening…' : `Connect ${c.name.replace('Microsoft ', '')}`}</button>{note}</>
  }
  if (c.action === 'smtp') {
    const box = mailboxes?.find((m) => m.provider === 'Smtp')
    if (box?.connected) return <><Badge tone="success">Connected{box.emailAddress ? ` as ${box.emailAddress}` : ''}</Badge><Link className="btn btn-ghost btn-sm" to="/settings">Manage</Link></>
    return <Link className="btn btn-primary btn-sm" to="/settings">Connect with an app password</Link>
  }
  if (c.action?.startsWith('int-')) {
    const kind = c.action.slice(4) as IntegrationKind
    return <IntegrationControl kind={kind} row={integrations?.find((x) => x.kind === kind)} onChange={reload} />
  }
  if (c.action === 'csv') return <Link className="btn btn-primary btn-sm" to="/opportunities">Open leads → Export CSV</Link>
  if (c.action === 'account') return <Link className="btn btn-secondary btn-sm" to="/settings">Open account settings</Link>
  return null
}

/**
 * Advanced → Connectors: what connects today (mailboxes, calendar and CSV files) with a working button, and what is only planned.
 * "I want this" on a planned card only records your interest in this browser so the owner can see what to build first.
 */
export function ConnectorsPage() {
  const { workspace } = useShell()
  const [params, setParams] = useSearchParams()
  // Coming back from a service's sign-in screen: say how it went, and show every card so that service's card is on screen.
  const [returned] = useState(() => oauthReturn(params))
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<ConnectorCategory | 'All'>('All')
  const [audience, setAudience] = useState<Audience | 'All'>(returned ? 'All' : workspace === 'sales' ? 'Sales' : 'Candidate')
  const [notice, setNotice] = useState(returned)
  const noticeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!returned) return
    // The result is read once; the address is cleaned so a reload does not repeat it.
    setParams({}, { replace: true })
    noticeRef.current?.focus()
  }, [returned, setParams])
  const [wants, setWants] = useState(readWants)
  const shown = filterConnectors(CONNECTORS, { query, category, audience })
  const mailboxes = useApi<Mailbox[]>('/api/v1/mailboxes').data
  const integrations = useApi<Integration[]>('/api/v1/integrations')

  function toggle(id: string) {
    const next = toggleWant(wants, id)
    setWants(next)
    writeWants(next)
  }

  return (
    <div className="page page-wide stack-4">
      <PageHeader
        title="Connectors"
        subtitle="Link your own apps. Press Connect, allow access on the app’s own page, and you come back connected."
      />
      {notice && (
        <div ref={noticeRef} tabIndex={-1} className={`notice ${notice.ok ? 'notice-success' : 'notice-warning'}`} role={notice.ok ? 'status' : 'alert'}>
          <span>{notice.text}</span>
          <button type="button" className="btn btn-ghost btn-sm notice-action" onClick={() => setNotice(null)}>Dismiss<span className="sr-only"> this message</span></button>
        </div>
      )}
      <Card tone="muted">
        <p className="muted-small">
          Nothing is saved until the app says yes, and what it gives back is stored encrypted. A card marked Needs server setup works once the app owner switches it on (<a href="https://github.com/shr1-live/OpportunityPilotWebapp/blob/main/docs/CONNECTOR_OAUTH_SETUP.md" target="_blank" rel="noopener noreferrer">setup guide<span className="sr-only"> (opens in a new tab)</span></a>, <a href="https://github.com/shr1-live/OpportunityPilotWebapp/blob/main/docs/MAIL_SETUP.md" target="_blank" rel="noopener noreferrer">email setup<span className="sr-only"> (opens in a new tab)</span></a>); until then you can use a token instead.
        </p>
      </Card>

      <div className="row wrap connector-tools">
        <label className="search-field connector-search">
          <span className="sr-only">Search connectors</span>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search apps, e.g. Gmail, calendar, CRM" />
        </label>
        <div className="segmented" role="group" aria-label="Show connectors for">
          {(['Candidate', 'Sales', 'All'] as const).map((a) => (
            <button key={a} type="button" className={audience === a ? 'active' : ''} aria-pressed={audience === a} onClick={() => setAudience(a)}>{a === 'All' ? 'Everyone' : a}</button>
          ))}
        </div>
      </div>
      <div className="chip-row" role="group" aria-label="Category">
        {(['All', ...CATEGORIES] as const).map((c) => (
          <button key={c} type="button" className={`chip-btn${category === c ? ' is-on' : ''}`} aria-pressed={category === c} onClick={() => setCategory(c)}>{c}</button>
        ))}
      </div>

      {shown.length === 0 ? (
        <Card tone="muted"><p>No connector matches. <button type="button" className="btn-link" onClick={() => { setQuery(''); setCategory('All'); setAudience('All') }}>Clear filters</button></p></Card>
      ) : (
        <CardGrid label="Connectors">
          {shown.map((c) => {
            const want = wants.includes(c.id)
            // A sign-in card works as soon as the server has the app registered.
            const kind = c.action?.startsWith('int-') ? c.action.slice(4) : null
            const status: ConnectorStatus = c.action?.startsWith('mail-') && mailboxes?.find((m) => `mail-${m.provider}` === c.action)?.configured ? 'Connect now'
              : connectorStatus(c, integrations.data?.find((x) => x.kind === kind)?.oauthConfigured)
            return (
              <li key={c.id} className="ccard connector-card">
                <div className="connector-head">
                  <Avatar name={c.name} />
                  <div className="connector-titles">
                    <h3 className="connector-name">{c.name}</h3>
                    <span className="muted-small">{c.category} · {c.audience === 'Both' ? 'Candidate and Sales' : c.audience}</span>
                  </div>
                  <Badge tone={STATUS_TONE[status]}>{status}</Badge>
                </div>
                <p className="connector-does">{c.does}</p>
                <p className="muted-small"><strong>Needs:</strong> {c.needs}</p>
                <div className="row wrap connector-control">
                  <ConnectorAction c={c} mailboxes={mailboxes} integrations={integrations.data} reload={integrations.reload} />
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
