import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../../components/cards'
import { useApi } from '../../lib/useApi'
import { RoleList, ROLE_LIST_ID } from '../suggest/RoleList'
import { PLACE_LIST_ID, PlaceList } from '../suggest/PlaceList'
import type { Workspace } from '../shell/shellModel'
import { naukriCampaignPath, naukriSearchUrl } from './naukriModel'

/**
 * Naukri: India's largest job site. It has no public search API, so jobs reach the app through the desktop agent (it reads Naukri in
 * your own logged-in browser and can apply to approved jobs), and the search opens on Naukri itself. Live results show in All sites
 * once the server has the Naukri RapidAPI board.
 */
export function NaukriPanel({ workspace, tabs }: Readonly<{ workspace: Workspace; tabs: ReactNode }>) {
  const sales = workspace === 'sales'
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('')
  const [done, setDone] = useState<{ query: string; location: string }>()
  const agent = useApi<{ connected: boolean; online: boolean; waiting: number }>('/api/v1/agent-keys/status')

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setDone({ query: query.trim(), location: location.trim() })
    window.open(naukriSearchUrl(query, location), '_blank', 'noopener')
  }

  return <>
    <RoleList />
    <PlaceList />
    <form className="search-hero" onSubmit={submit} aria-label="Search Naukri">
      {tabs}
      <div className="search-bar">
        <label className="search-field search-field-main"><span className="sr-only">{sales ? 'Role companies are hiring' : 'Role or keywords'}</span>
          <input list={ROLE_LIST_ID} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={sales ? 'Role companies are hiring, e.g. Java developer' : 'Role or keywords, e.g. data scientist'} /></label>
        <label className="search-field"><span className="sr-only">Place</span>
          <input list={PLACE_LIST_ID} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, e.g. Bengaluru" /></label>
        <button className="btn btn-primary" type="submit" disabled={!query.trim()}>Search Naukri ↗</button>
      </div>
    </form>

    <div className="chart-grid">
      <Card title={sales ? '1. Bring Naukri companies in' : '1. Bring Naukri jobs in'} subtitle="Your desktop agent reads Naukri in your own logged-in browser and sends the postings here to be scored.">
        <div className="stack-2">
          <p className="muted-small">{agent.data?.online ? 'Your agent is running.' : agent.data?.connected ? 'Your agent is connected but not running right now.' : 'No desktop agent yet: connect it from Home → Desktop agent.'}</p>
          {done
            ? <Link className="btn btn-secondary btn-sm" to={naukriCampaignPath(workspace, done.query, done.location)}>Start a Naukri campaign for “{done.query}”</Link>
            : <p className="muted-small">Search above first; then start a campaign with that search.</p>}
        </div>
      </Card>
      <Card title={sales ? '2. Approve the companies' : '2. Approve the jobs'} subtitle="Each one is scored against your profile. You approve the ones worth it, in one batch.">
        <Link className="btn btn-secondary btn-sm" to="/opportunities">{sales ? 'Open companies' : 'Open opportunities'}</Link>
      </Card>
      <Card title={sales ? '3. Reach out' : '3. Apply to all of them'} subtitle={sales ? 'Write to each hiring company from Outreach; the recruiters are in each lead’s JD circle.' : 'The agent applies to every approved Naukri job in one go, from your account.'}>
        {sales
          ? <Link className="btn btn-secondary btn-sm" to="/outreach">Go to Outreach</Link>
          : <div className="stack-2">
            <p className="muted-small">{agent.data ? `${agent.data.waiting} approved job${agent.data.waiting === 1 ? '' : 's'} waiting for the agent.` : ''} On your computer:</p>
            <pre className="naukri-cmd">npm run agent -- login naukri{'\n'}npm run agent -- apply naukri{'\n'}npm run agent -- apply naukri --submit --limit 20</pre>
            <p className="muted-small">The second line is a dry run (fills the forms, submits nothing). The third applies for real.</p>
          </div>}
      </Card>
    </div>
    <p className="muted-small">Live Naukri results inside this app appear in All sites once the server has the Naukri RapidAPI board switched on.</p>
  </>
}
