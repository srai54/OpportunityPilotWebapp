import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, Card, CardGrid } from '../../components/cards'
import { PageHeader } from '../../components/PageHeader'
import { Badge } from '../../components/StatusBadge'
import { api } from '../../lib/api'
import type { NextAction } from '../../lib/types'
import { useApi } from '../../lib/useApi'
import type { Mailbox } from '../mail/mailModel'
import { useShell } from '../shell/ShellContext'
import { CATEGORIES, CONNECTORS, filterConnectors, followUpsIcs, readWants, toggleWant, writeWants, type Audience, type Connector, type ConnectorCategory } from './connectorsModel'

/** The button a card shows: connect a mailbox, download a file, or open the page that does it. Cards without one only save interest. */
function ConnectorAction({ c, mailboxes }: Readonly<{ c: Connector; mailboxes: Mailbox[] | undefined }>) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function connect(provider: string) {
    setBusy(true); setError('')
    try {
      const { url } = await api<{ url: string }>(`/api/v1/mailboxes/${provider}/connect`, { method: 'POST' })
      window.location.assign(url)
    } catch (e) { setError((e as Error).message); setBusy(false) }
  }
  async function downloadIcs() {
    setBusy(true); setError('')
    try {
      const open = await api<NextAction[]>('/api/v1/next-actions?state=Open')
      if (open.length === 0) { setError('No open follow-ups yet. They appear 5 days after you send a message.'); return }
      const url = URL.createObjectURL(new Blob([followUpsIcs(open)], { type: 'text/calendar' }))
      const a = document.createElement('a'); a.href = url; a.download = 'opportunitypilot-follow-ups.ics'; a.click(); URL.revokeObjectURL(url)
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  const note = error && <span className="muted-small" role="alert">{error}</span>
  if (c.action?.startsWith('mail-')) {
    const provider = c.action.slice(5)
    const box = mailboxes?.find((m) => m.provider === provider)
    if (box?.connected) return <><Badge tone="success">Connected{box.emailAddress ? ` as ${box.emailAddress}` : ''}</Badge><Link className="btn btn-ghost btn-sm" to="/settings">Manage</Link></>
    if (box && !box.configured) return <span className="muted-small">The server owner has not switched this on yet — see the setup guide, then it connects here.</span>
    return <><button type="button" className="btn btn-primary btn-sm" disabled={busy || !box} onClick={() => void connect(provider)}>{busy ? 'Opening…' : `Connect ${c.name.replace('Microsoft ', '')}`}</button>{note}</>
  }
  if (c.action === 'ics') return <><button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void downloadIcs()}>{busy ? 'Preparing…' : 'Download calendar file'}</button>{note}</>
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
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<ConnectorCategory | 'All'>('All')
  const [audience, setAudience] = useState<Audience | 'All'>(workspace === 'sales' ? 'Sales' : 'Candidate')
  const [wants, setWants] = useState(readWants)
  const shown = filterConnectors(CONNECTORS, { query, category, audience })
  const mailboxes = useApi<Mailbox[]>('/api/v1/mailboxes').data

  function toggle(id: string) {
    const next = toggleWant(wants, id)
    setWants(next)
    writeWants(next)
  }

  return (
    <div className="page page-wide stack-4">
      <PageHeader
        title="Connectors"
        subtitle="Link your own apps. Cards marked Works today have a button that does it now; the rest are planned."
      />
      <Card tone="muted">
        <p className="muted-small">
          Outlook and Gmail send for you once the server owner has registered the app (<a href="https://github.com/shr1-live/OpportunityPilotWebapp/blob/main/docs/MAIL_SETUP.md" target="_blank" rel="noopener noreferrer">setup guide</a>). Calendars and spreadsheets work today through files you download. Nothing else is connected.
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
            return (
              <li key={c.id} className="ccard connector-card">
                <div className="connector-head">
                  <Avatar name={c.name} />
                  <div className="connector-titles">
                    <h3 className="connector-name">{c.name}</h3>
                    <span className="muted-small">{c.category} · {c.audience === 'Both' ? 'Candidate and Sales' : c.audience}</span>
                  </div>
                  <Badge tone={c.status === 'Works today' ? 'success' : c.status === 'Next up' ? 'primary' : 'neutral'}>{c.status}</Badge>
                </div>
                <p className="connector-does">{c.today ?? c.does}</p>
                {c.action !== 'ics' && c.action !== 'csv' && <p className="muted-small"><strong>Needs:</strong> {c.needs}</p>}
                <div className="row wrap">
                  <ConnectorAction c={c} mailboxes={mailboxes} />
                  {c.status !== 'Works today' && c.action !== 'account' && (
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
