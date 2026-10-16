import { useState } from 'react'
import { Card } from '../../components/cards'
import type { CampaignSummary, OpportunityPage, OpportunitySummary } from '../../lib/types'
import { useApi } from '../../lib/useApi'
import { api } from '../../lib/api'
import { connectionsAtUrl, referralNote } from '../opportunities/reachPlan'

const DONE_KEY = 'op.linkedin.queue.done'
function readDone(): Set<string> { try { return new Set(JSON.parse(localStorage.getItem(DONE_KEY) ?? '[]') as string[]) } catch { return new Set() } }
function saveDone(s: Set<string>) { try { localStorage.setItem(DONE_KEY, JSON.stringify([...s].slice(-500))) } catch { /* this visit only */ } }

/**
 * LinkedIn, company by company: for every approved company, one click opens the person's own 1st-degree connections who work there
 * (the same search as typing "PwC" with the 1st filter) with an introduction note copied, ready to paste into Message. Nothing is sent
 * by the app; the person presses Send on LinkedIn, then marks the company done here.
 */
export function LinkedInQueueCard({ signOff }: Readonly<{ signOff: string | null }>) {
  const campaigns = useApi<CampaignSummary[]>('/api/v1/campaigns')
  const [leads, setLeads] = useState<OpportunitySummary[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState<Set<string>>(readDone)
  const [copied, setCopied] = useState('')

  async function load() {
    setLoading(true)
    try {
      const ids = (campaigns.data ?? []).map((c) => c.id)
      const pages = await Promise.all(ids.map((id) => api<OpportunityPage>(`/api/v1/campaigns/${id}/opportunities?take=200`).catch(() => null)))
      const seen = new Set<string>()
      setLeads(pages.flatMap((p) => p?.items ?? []).filter((o) => o.status === 'Shortlisted' && o.organization?.trim())
        .filter((o) => { const k = o.organization.trim().toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true }))
    } finally { setLoading(false) }
  }

  function open(o: OpportunitySummary) {
    // The tab opens inside the click (browsers block it after an await); the note is copied for pasting into LinkedIn's Message box.
    window.open(connectionsAtUrl(o.organization), '_blank', 'noopener')
    const note = referralNote({ mode: o.mode, organization: o.organization, title: o.title }, signOff)
    void navigator.clipboard?.writeText(note).then(() => setCopied(o.id)).catch(() => setCopied(''))
  }
  function markDone(o: OpportunitySummary) {
    const next = new Set(done); next.add(o.id); setDone(next); saveDone(next)
  }

  const left = (leads ?? []).filter((o) => !done.has(o.id))
  return (
    <Card title="LinkedIn: your connections at each company" subtitle="One click per company: your 1st-degree connections there, note copied. You press Send on LinkedIn." >
      <div id="linkedin" className="stack-3">
        {!leads ? (
          <button type="button" className="btn btn-secondary btn-sm" disabled={loading || !campaigns.data} onClick={() => void load()}>{loading ? 'Loading approved companies…' : 'Show approved companies'}</button>
        ) : left.length === 0 ? (
          <p className="muted-small">{leads.length === 0 ? 'No approved companies yet. Approve some leads first.' : 'All approved companies are done.'}</p>
        ) : (
          <>
            <p className="muted-small">{left.length} of {leads.length} to do.</p>
            <ul className="plain-list li-queue">
              {left.slice(0, 25).map((o, i) => (
                <li key={o.id} className="li-queue-row">
                  <div className="grow"><strong>{o.organization}</strong><div className="muted-small">{o.title}</div></div>
                  <button type="button" className={`btn btn-sm ${i === 0 ? 'btn-primary' : 'btn-secondary'}`} onClick={() => open(o)}>Open my connections<span className="sr-only"> at {o.organization}</span></button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => markDone(o)}>Done<span className="sr-only"> with {o.organization}</span></button>
                  {copied === o.id && <span className="muted-small" role="status">Note copied — paste it in Message.</span>}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Card>
  )
}
