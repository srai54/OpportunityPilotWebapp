import { useState } from 'react'
import { Card } from '../../components/cards'
import { Badge } from '../../components/StatusBadge'
import { api } from '../../lib/api'
import { useApi } from '../../lib/useApi'

interface AgentStatus {
  connected: boolean
  online: boolean
  lastSeenAt: string | null
  appliedLast7Days: number
  waiting: number
  recent: { title: string; company: string; platform: string; status: string; at: string; detail: string | null }[]
}

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

/**
 * The desktop agent applies to approved LinkedIn, Naukri and Instahyre jobs from the person's own computer. This card says whether it
 * is running (it called in during the last 10 minutes), what it applied to, and how many approved jobs wait for it. Without an agent
 * it offers a key: shown once, then only its prefix is kept.
 */
export function AgentStatusCard() {
  const status = useApi<AgentStatus>('/api/v1/agent-keys/status')
  const [key, setKey] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const s = status.data
  if (!s) return null

  async function createKey() {
    setBusy(true); setError('')
    try {
      const made = await api<{ key: string }>('/api/v1/agent-keys', { method: 'POST', body: JSON.stringify({ name: 'Desktop agent' }) })
      setKey(made.key); status.reload()
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  const state = s.online ? { tone: 'success' as const, text: 'Running' } : s.connected ? { tone: 'warning' as const, text: 'Not running' } : { tone: 'neutral' as const, text: 'Not set up' }
  return (
    <Card title="Desktop agent" subtitle="Applies to approved LinkedIn, Naukri, Instahyre jobs from your browser."
      actions={<Badge tone={state.tone}>{state.text}</Badge>}>
      <div className="stack-2">
        <p className="muted-small">
          {s.lastSeenAt ? `Last checked in ${when(s.lastSeenAt)}.` : s.connected ? 'It has not checked in yet.' : 'No agent is connected.'}
          {' '}{s.appliedLast7Days} application{s.appliedLast7Days === 1 ? '' : 's'} in the last 7 days · {s.waiting} approved job{s.waiting === 1 ? '' : 's'} waiting for it.
        </p>
        {!s.online && (
          <details className="how-it-works">
            <summary>How to start it</summary>
            <ol className="hint-list">
              <li>Press <strong>Connect the agent</strong> below and copy the key (shown once).</li>
              <li>On Windows: double-click <code>OpportunityPilotWebApi/agent/setup.cmd</code> and paste the key. It installs everything, connects and opens LinkedIn to sign in (needs Node.js from nodejs.org).</li>
              <li>Fill your answers in the agent’s <code>config.json</code> (notice period, salary, phone, years per skill).</li>
              <li>Approve jobs here, then run <code>npm run agent -- apply linkedin</code> (a dry run) and add <code>--submit</code> to really apply. This card turns green when it checks in.</li>
            </ol>
          </details>
        )}
        {s.recent.length > 0 && (
          <ul className="hint-list" aria-label="Latest applications">
            {s.recent.map((r) => <li key={`${r.title}${r.at}`}><strong>{r.status}</strong> · {r.title} at {r.company} ({r.platform}) · {when(r.at)}</li>)}
          </ul>
        )}
        {!s.online && s.waiting > 0 && s.connected && <p className="muted-small">Start it on your computer with <code>npm run agent -- cycle</code> (or leave the timer running) and these get applied.</p>}
        {key ? (
          <div className="stack-2">
            <label className="field"><span><strong>Your agent key (shown once)</strong></span>
              <input readOnly value={key} onFocus={(e) => e.currentTarget.select()} spellCheck={false} />
              <span className="muted-small">Put it in the agent’s config.json as api.key, then run <code>npm run agent -- campaigns</code> to check it connects.</span>
            </label>
            <div className="row wrap"><button type="button" className="btn btn-secondary btn-sm" onClick={() => void navigator.clipboard.writeText(key)}>Copy key</button></div>
          </div>
        ) : !s.connected && (
          <div className="row wrap">
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void createKey()}>{busy ? 'Making a key…' : 'Connect the agent'}</button>
            <a className="btn btn-ghost btn-sm" href="https://github.com/shr1-live/OpportunityPilotWebApi/blob/main/agent/README.md" target="_blank" rel="noreferrer">Setup guide ↗</a>
          </div>
        )}
        {error && <p className="field-error" role="alert">{error}</p>}
      </div>
    </Card>
  )
}
