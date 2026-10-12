import { useState } from 'react'
import { Avatar, Card, CardGrid } from '../../components/cards'
import { PageHeader } from '../../components/PageHeader'
import { Badge } from '../../components/StatusBadge'
import { useShell } from '../shell/ShellContext'
import { CATEGORIES, CONNECTORS, filterConnectors, readWants, toggleWant, writeWants, type Audience, type ConnectorCategory } from './connectorsModel'

/**
 * Advanced → Connectors: the apps we plan to connect, shown plainly as upcoming. Nothing here connects yet; "I want this" only
 * records your interest in this browser so the owner can see what to build first.
 */
export function ConnectorsPage() {
  const { workspace } = useShell()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<ConnectorCategory | 'All'>('All')
  const [audience, setAudience] = useState<Audience | 'All'>(workspace === 'sales' ? 'Sales' : 'Candidate')
  const [wants, setWants] = useState(readWants)
  const shown = filterConnectors(CONNECTORS, { query, category, audience })

  function toggle(id: string) {
    const next = toggleWant(wants, id)
    setWants(next)
    writeWants(next)
  }

  return (
    <div className="page page-wide stack-4">
      <PageHeader
        title="Connectors"
        subtitle="Apps we plan to connect so more of the work happens by itself. None of these works yet; the first two are next."
      />
      <Card tone="muted">
        <p className="muted-small">
          <strong>Upcoming.</strong> Marking “I want this” only saves your interest in this browser. Today you can already send from your own mail app (Settings → Open emails in) and export what you find.
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
                  <Badge tone={c.status === 'Next up' ? 'primary' : 'neutral'}>{c.status}</Badge>
                </div>
                <p className="connector-does">{c.does}</p>
                <p className="muted-small"><strong>Needs:</strong> {c.needs}</p>
                <button type="button" className={`btn btn-sm ${want ? 'btn-primary' : 'btn-secondary'}`} aria-pressed={want} onClick={() => toggle(c.id)}>
                  {want ? '✓ You want this' : 'I want this'}<span className="sr-only"> ({c.name})</span>
                </button>
              </li>
            )
          })}
        </CardGrid>
      )}
    </div>
  )
}
