import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { KIND_NAMES, LEAD_TARGETS, pushSummary, type Integration, type IntegrationKind, type PushLeadResult } from './integrationsModel'

const MAX = 25

/**
 * Buttons that send the selected leads to each connected CRM or database. With none connected, a link to Connectors.
 * The result (added, already there, failed with the reason) is announced through onDone.
 */
export function SendToCrm({ ids, onDone }: Readonly<{ ids: string[]; onDone: (message: string) => void }>) {
  const integrations = useApi<Integration[]>('/api/v1/integrations')
  const [busy, setBusy] = useState<IntegrationKind | null>(null)
  const [result, setResult] = useState('')
  const targets = (integrations.data ?? []).filter((x) => x.connected && LEAD_TARGETS.includes(x.kind))
  if (!integrations.data) return null
  if (targets.length === 0) return <Link className="btn btn-ghost btn-sm" to="/connectors">Connect HubSpot, Notion or Airtable</Link>

  async function send(kind: IntegrationKind) {
    setBusy(kind)
    try {
      const results = await api<PushLeadResult[]>(`/api/v1/integrations/${kind}/push`, { method: 'POST', body: JSON.stringify({ opportunityIds: ids.slice(0, MAX) }) })
      const text = pushSummary(kind, results) + (ids.length > MAX ? ` Only the first ${MAX} were sent; send the rest next.` : '')
      setResult(text); onDone(text)
    } catch (e) { setResult((e as Error).message); onDone((e as Error).message) } finally { setBusy(null) }
  }

  return (
    <>
      {targets.map((t) => (
        <button key={t.kind} type="button" className="btn btn-secondary btn-sm" disabled={busy !== null || ids.length === 0} onClick={() => void send(t.kind)}>
          {busy === t.kind ? `Sending to ${KIND_NAMES[t.kind]}…` : `Send to ${KIND_NAMES[t.kind]}`}
        </button>
      ))}
      {result && <span className="muted-small" role="status">{result}</span>}
    </>
  )
}
