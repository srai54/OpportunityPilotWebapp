import { useState } from 'react'
import { ErrorNotice } from '../../components/ErrorNotice'
import { LoadingState } from '../../components/States'
import { api } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { progressUrl, shownSummary, SHOW_OPTIONS, updateMailto, type ProgressLink, type ShowKey } from './progressModel'

/**
 * Candidates → "Share progress": the sales team picks what the candidate may see, makes a private link, and tells the candidate by
 * email (opened in their own mail app) and/or by sending the link. The link is shown once; making a new one replaces it.
 */
export function ProgressShare({ candidate, onClose }: Readonly<{ candidate: { id: string; name: string; email: string | null }; onClose: () => void }>) {
  const status = useApi<ProgressLink>(`/api/v1/staffing/candidates/${candidate.id}/progress-link`)
  const [show, setShow] = useState<ShowKey[]>(['Client', 'Role', 'Interviews'])
  const [fresh, setFresh] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<Error>()

  async function make() {
    setBusy(true); setError(undefined); setCopied(false)
    try {
      const made = await api<ProgressLink>(`/api/v1/staffing/candidates/${candidate.id}/progress-link`, { method: 'POST', body: JSON.stringify({ show }) })
      setFresh(made.token ? progressUrl(window.location.origin, made.token) : null)
      status.reload()
    } catch (e) { setError(e as Error) } finally { setBusy(false) }
  }
  async function stop() {
    setBusy(true); setError(undefined)
    try { await api(`/api/v1/staffing/candidates/${candidate.id}/progress-link`, { method: 'DELETE' }); setFresh(null); status.reload() }
    catch (e) { setError(e as Error) } finally { setBusy(false) }
  }
  async function copy() {
    if (!fresh) return
    try { await navigator.clipboard.writeText(fresh); setCopied(true) } catch { setCopied(false) }
  }

  const mailto = fresh ? updateMailto(candidate, fresh) : null
  return (
    <section className="panel" aria-label={`Share progress with ${candidate.name}`}>
      <header className="panel-head"><h3 className="eyebrow">Share progress — {candidate.name}</h3><span className="grow" /><button className="btn btn-secondary btn-sm" type="button" onClick={onClose}>Close</button></header>
      <div className="panel-body stack-3">
        {status.loading && !status.data ? <LoadingState label="Loading…" rows={1} /> : (
          <p className="muted-small">{status.data?.active ? `A link is on: it shows ${shownSummary(status.data.show)}.` : 'No link yet. The candidate sees nothing until you make one.'}</p>
        )}
        <fieldset className="row wrap"><legend className="muted-small">What the candidate may see (the stage of each submission is always shown)</legend>
          {SHOW_OPTIONS.map((o) => <label key={o.key} className="check"><input type="checkbox" checked={show.includes(o.key)}
            onChange={() => setShow((cur) => cur.includes(o.key) ? cur.filter((x) => x !== o.key) : [...cur, o.key])} /> {o.label}</label>)}
        </fieldset>
        <p className="muted-small">Pay, rates and internal notes are never shown.</p>
        {error && <ErrorNotice error={error} />}
        <div className="row wrap">
          <button className="btn btn-primary btn-sm" type="button" disabled={busy} onClick={() => void make()}>{status.data?.active ? 'Make a new link (replaces the old one)' : 'Make the link'}</button>
          {status.data?.active && <button className="btn btn-secondary btn-sm" type="button" disabled={busy} onClick={() => void stop()}>Stop sharing</button>}
        </div>
        {fresh && (
          <div className="notice notice-neutral stack-2" role="status">
            <p><strong>Send this link to {candidate.name}.</strong> It is shown only now.</p>
            <input readOnly value={fresh} aria-label="Progress link" onFocus={(e) => e.currentTarget.select()} />
            <div className="row wrap">
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => void copy()}>{copied ? 'Copied' : 'Copy link'}</button>
              {mailto ? <a className="btn btn-secondary btn-sm" href={mailto}>Email it to {candidate.name.split(' ')[0]}</a> : <span className="muted-small">Add an email address to the candidate to send it by email.</span>}
              <a className="btn btn-ghost btn-sm" href={fresh} target="_blank" rel="noopener noreferrer">Preview<span className="sr-only"> (opens in a new tab)</span></a>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
