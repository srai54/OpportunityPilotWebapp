import { useState } from 'react'
import { api } from '../../lib/api'
import { useApi } from '../../lib/useApi'

interface Suggestion { subject: string | null; body: string; warnings: string[] }

const STYLES = [
  { value: 'shorter', label: 'Shorter' },
  { value: 'friendlier', label: 'Friendlier' },
  { value: 'more formal', label: 'More formal' },
]

/**
 * "Rewrite with AI": shown only when the server has AI switched on. The suggestion is not saved; "Use this" puts it in the editor,
 * and the usual checks run when the person saves or approves. A suggestion that adds a link or address is refused by the server.
 */
export function RewriteBox({ draftId, version, dirty, onUse }: Readonly<{ draftId: string; version: number; dirty: boolean; onUse: (s: Suggestion) => void }>) {
  const status = useApi<{ rewriteAvailable?: boolean }>('/api/v1/ai/status')
  const [style, setStyle] = useState(STYLES[0].value)
  const [busy, setBusy] = useState(false)
  const [suggestion, setSuggestion] = useState<Suggestion>()
  const [error, setError] = useState('')
  if (!status.data?.rewriteAvailable) return null

  async function rewrite() {
    setBusy(true); setError(''); setSuggestion(undefined)
    try { setSuggestion(await api<Suggestion>(`/api/v1/drafts/${draftId}/rewrite`, { method: 'POST', body: JSON.stringify({ instruction: style, version }) })) }
    catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="stack-2 rewrite-box">
      <div className="row wrap">
        <label className="field"><span>Rewrite with AI</span>
          <select value={style} onChange={(e) => setStyle(e.target.value)}>{STYLES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
        </label>
        <button type="button" className="btn btn-secondary btn-sm" disabled={busy || dirty} onClick={() => void rewrite()}>{busy ? 'Rewriting…' : 'Suggest a rewrite'}</button>
        {dirty && <span className="muted-small">Save your changes first.</span>}
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
      {suggestion && (
        <div className="stack-2 rewrite-suggestion" role="status">
          {suggestion.subject && <p><strong>Subject:</strong> {suggestion.subject}</p>}
          <p className="rewrite-body">{suggestion.body}</p>
          {suggestion.warnings.length > 0 && <ul className="hint-list">{suggestion.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
          <div className="row wrap">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => { onUse(suggestion); setSuggestion(undefined) }}>Use this</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSuggestion(undefined)}>Keep mine</button>
          </div>
        </div>
      )}
    </div>
  )
}
