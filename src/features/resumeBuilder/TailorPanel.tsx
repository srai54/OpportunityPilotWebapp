import { useId, useState } from 'react'
import { ErrorNotice } from '../../components/ErrorNotice'
import { api } from '../../lib/api'
import { keyProblem } from '../ai/claudeModel'
import type { ResumeDoc } from './resumeDoc'
import { matchLine, previewOf, type TailorPreview, type TailorResult } from './tailorModel'

/**
 * "Tailor to this job" (2026-10-26): Claude rewords the title, summary, skills and responsibilities to match the job description the
 * recruiter shared. It never adds facts; skills the resume does not show are listed, not added. The candidate reviews the result and
 * chooses to use it; nothing is saved until they press Save. An own Anthropic key is optional and used for that one request only.
 */
export function TailorPanel({ token, dealId, doc, jobDescription, onUse }: Readonly<{
  token: string; dealId: string; doc: ResumeDoc; jobDescription: string | null; onUse: (d: ResumeDoc) => void
}>) {
  const uid = useId()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Error>()
  const [preview, setPreview] = useState<TailorPreview | null>(null)
  const [ownKey, setOwnKey] = useState(false)
  const [key, setKey] = useState('')
  const [keyTouched, setKeyTouched] = useState(false)
  const keyIssue = ownKey ? keyProblem(key) : null

  async function tailor() {
    if (keyIssue) { setKeyTouched(true); document.getElementById(`${uid}-key`)?.focus(); return }
    setBusy(true); setError(undefined); setPreview(null)
    try {
      const result = await api<TailorResult>(`/api/v1/public/progress/${encodeURIComponent(token)}/resumes/${dealId}/tailor`, {
        method: 'POST', body: JSON.stringify({ data: JSON.stringify(doc), apiKey: ownKey ? key.trim() : null }),
      })
      const p = previewOf(doc, result, jobDescription)
      if (!p) throw new Error('The answer was not a resume. Try again.')
      setPreview(p)
    } catch (e) { setError(e as Error) } finally { setBusy(false) }
  }

  if (!jobDescription) return null
  const line = preview ? matchLine(preview) : null
  return (
    <section className="rb-tailor" aria-labelledby={`${uid}-title`}>
      <div className="stack-1">
        <h4 id={`${uid}-title`} className="fb-subhead">Tailor to this job with Claude</h4>
        <p className="muted-small">Rewords your title, summary, skills and responsibilities to match the job description. Nothing is invented, and nothing is saved until you choose.</p>
      </div>
      <div className="row wrap">
        <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void tailor()}>{busy ? 'Tailoring… (up to a minute)' : preview ? 'Try again' : 'Tailor to this job'}</button>
        <button type="button" className="btn-link" aria-expanded={ownKey} aria-controls={`${uid}-own`} onClick={() => setOwnKey((v) => !v)}>Use my own Claude key</button>
      </div>
      {ownKey && (
        <div id={`${uid}-own`} className="field">
          <label htmlFor={`${uid}-key`}>Anthropic API key</label>
          <input id={`${uid}-key`} type="password" autoComplete="off" spellCheck={false} value={key} aria-invalid={keyTouched && Boolean(keyIssue)}
            aria-describedby={`${uid}-key-hint${keyTouched && keyIssue ? ` ${uid}-key-err` : ''}`} onChange={(e) => setKey(e.target.value)} />
          <p id={`${uid}-key-hint`} className="hint">Used for this request only and never stored. Create one at console.anthropic.com.</p>
          {keyTouched && keyIssue && <p id={`${uid}-key-err`} className="field-error">{keyIssue}</p>}
        </div>
      )}
      {error && <ErrorNotice error={error} />}
      {preview && (
        <div className="rb-tailor-result" role="status">
          <strong>{line ?? 'Tailored version ready'}</strong>
          <span className="muted-small">Written by {preview.by}. Read it before you use it.</span>
          <p><strong>{preview.doc.title}</strong></p>
          <p>{preview.doc.summary}</p>
          {preview.changes.length > 0 && <ul aria-label="What changed">{preview.changes.map((c) => <li key={c}>{c}</li>)}</ul>}
          {preview.notAdded.length > 0 && <p className="muted-small">Left out because your resume does not show them: {preview.notAdded.join(', ')}. Add them yourself only if you have used them.</p>}
          <div className="row wrap">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => { onUse(preview.doc); setPreview(null) }}>Use this version</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPreview(null)}>Keep mine</button>
          </div>
        </div>
      )}
    </section>
  )
}
