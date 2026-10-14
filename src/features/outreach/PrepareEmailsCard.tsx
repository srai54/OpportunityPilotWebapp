import { useState } from 'react'
import { Card } from '../../components/cards'
import { api } from '../../lib/api'
import type { CampaignSummary } from '../../lib/types'
import { useApi } from '../../lib/useApi'

interface PreparedDraft { opportunityId: string; title: string; outcome: 'Written' | 'Skipped'; reason: string | null; draftId: string | null; recipient: string | null }
interface PrepareResult { written: number; skipped: number; remaining: number; items: PreparedDraft[] }

/**
 * Sales hands-off, step one: write an email for every approved lead of a campaign that has none yet, to the address the company
 * published. Nothing is approved or sent here; the person checks the messages, then sends them all with one click.
 * `primary` marks it as the page's main action, only while there are no messages yet (one primary button per view).
 */
export function PrepareEmailsCard({ onDone, primary }: Readonly<{ onDone: () => void; primary: boolean }>) {
  const campaigns = useApi<CampaignSummary[]>('/api/v1/campaigns')
  const [campaignId, setCampaignId] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<PrepareResult>()
  const [error, setError] = useState('')
  const list = (campaigns.data ?? []).filter((c) => c.mode !== 'Job')
  const chosen = campaignId || list[0]?.id || ''
  if (!campaigns.data || list.length === 0) return null

  async function prepare() {
    setBusy(true); setError(''); setResult(undefined)
    try {
      const r = await api<PrepareResult>(`/api/v1/campaigns/${chosen}/drafts/prepare`, { method: 'POST' })
      setResult(r)
      if (r.written > 0) onDone()
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  const skipped = result?.items.filter((i) => i.outcome === 'Skipped') ?? []
  return (
    <Card title="Write emails for your approved leads" subtitle="One email per approved lead, to the address the company published. You check them, then send them all at once.">
      <div className="row wrap">
        {list.length > 1 && (
          <label className="field"><span>Campaign</span>
            <select value={chosen} onChange={(e) => setCampaignId(e.target.value)}>{list.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          </label>
        )}
        <button type="button" className={`btn ${primary ? 'btn-primary' : 'btn-secondary'}`} disabled={busy || !chosen} onClick={() => void prepare()}>{busy ? 'Finding addresses and writing…' : 'Write the emails'}</button>
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
      {result && (
        <div className="stack-2" role="status">
          <p>
            {result.written === 0 && skipped.length === 0 ? 'Every approved lead in this campaign already has an email. Approve more leads to write more.'
              : `${result.written} email${result.written === 1 ? '' : 's'} written${skipped.length ? `, ${skipped.length} skipped` : ''}.`}
            {result.remaining > 0 && ` ${result.remaining} more leads are waiting: press again for the next batch.`}
            {result.written > 0 && ' Check them below, then use "Send all".'}
          </p>
          {skipped.length > 0 && (
            <ul className="hint-list">
              {skipped.slice(0, 5).map((s) => <li key={s.opportunityId}><strong>{s.title}:</strong> {s.reason}</li>)}
              {skipped.length > 5 && <li>and {skipped.length - 5} more.</li>}
            </ul>
          )}
        </div>
      )}
    </Card>
  )
}
