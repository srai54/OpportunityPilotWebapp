import { safeHref } from '../opportunities/opportunityModel'
import { useState } from 'react'
import { ErrorNotice } from '../../components/ErrorNotice'
import { api } from '../../lib/api'
import { contactBadge, type FindContactsResult } from './contactModel'

/**
 * "Find a contact": reads what the saved posting and the company's own contact pages already publish and offers it as a suggestion with its
 * source. Nothing is guessed, stored or used until the person presses "Use".
 */
export function ContactFinder({ opportunityId, onUse, disabled }: Readonly<{ opportunityId: string; onUse: (email: string) => void; disabled?: boolean }>) {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<FindContactsResult>()
  const [error, setError] = useState<Error>()
  const [website, setWebsite] = useState('')
  const [asking, setAsking] = useState(false)

  async function find() {
    setBusy(true); setError(undefined)
    try {
      setResult(await api<FindContactsResult>(`/api/v1/opportunities/${opportunityId}/contacts/find`, { method: 'POST', body: JSON.stringify({ website: website.trim() || null }) }))
    } catch (e) { setError(e as Error) } finally { setBusy(false) }
  }

  return (
    <div className="stack-2 contact-finder">
      <div className="row wrap">
        <button type="button" className="btn btn-secondary btn-sm" disabled={busy || disabled} onClick={() => void find()}>{busy ? 'Looking…' : 'Find a contact'}</button>
        <button type="button" className="btn btn-ghost btn-sm" aria-expanded={asking} onClick={() => setAsking(!asking)}>{asking ? 'Hide website' : 'Use a different website'}</button>
        <span className="muted-small">Reads the saved posting and the company's public contact page. Nothing is guessed.</span>
      </div>
      {asking && (
        <label className="field"><span>Company website</span>
          <input type="url" inputMode="url" value={website} maxLength={300} placeholder="https://company.com" onChange={(e) => setWebsite(e.target.value)} />
        </label>
      )}
      {error && <ErrorNotice error={error} />}
      {result && (
        <div className="stack-2" role="status" aria-live="polite">
          <p className="muted-small">{result.note}</p>
          {result.candidates.length > 0 && (
            <ul className="plain-list contact-list" aria-label="Suggested contacts">
              {result.candidates.map((c) => (
                <li key={`${c.kind}-${c.value}`} className="contact-row">
                  <div className="grow">
                    <strong className="break">{c.value}</strong>
                    <div className="muted-small">{contactBadge(c)} · <a href={safeHref(c.sourceUrl) ?? undefined} target="_blank" rel="noopener noreferrer">{c.sourceNote}<span className="sr-only"> (opens in a new tab)</span></a></div>
                  </div>
                  {c.kind === 'Email'
                    ? <button type="button" className="btn btn-primary btn-sm" onClick={() => onUse(c.value)}>Use<span className="sr-only"> {c.value}</span></button>
                    : <a className="btn btn-secondary btn-sm" href={safeHref(c.value) ?? undefined} target="_blank" rel="noopener noreferrer">Open<span className="sr-only"> company page (opens in a new tab)</span></a>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
