import { useId, useState } from 'react'
import { Card } from '../../components/cards'
import { ErrorNotice } from '../../components/ErrorNotice'
import { LoadingState } from '../../components/States'
import { Badge } from '../../components/StatusBadge'
import { api } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { MODEL_LABEL, keyProblem, type ClaudeStatus } from './claudeModel'

/**
 * Settings → Claude (2026-10-26). A person pastes their own Anthropic API key; the server tests it, keeps it encrypted and shows only the
 * last four characters. From then on their AI actions (goal parsing, drafts, rewrites, the assistant, profile help) run on Claude, billed
 * to that Anthropic account. Optionally their candidates may tailor resumes with it.
 */
export function ClaudeCard({ guest }: Readonly<{ guest: boolean }>) {
  const status = useApi<ClaudeStatus>(guest ? null : '/api/v1/ai/claude')
  const [saved, setSaved] = useState<ClaudeStatus | null>(null)
  const [key, setKey] = useState('')
  const [model, setModel] = useState('claude-opus-5-5')
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState<Error>()
  const [note, setNote] = useState('')
  const uid = useId()
  const s = saved ?? status.data
  const problem = keyProblem(key)

  async function send(label: string, method: 'PUT' | 'PATCH' | 'DELETE', body?: unknown) {
    setBusy(label); setError(undefined); setNote('')
    try {
      if (method === 'DELETE') {
        await api('/api/v1/ai/claude', { method })
        setSaved({ ...s!, connected: false, keyHint: null, shareWithCandidates: false })
        setNote('Removed. The app uses its own AI again.')
        return
      }
      setSaved(await api<ClaudeStatus>('/api/v1/ai/claude', { method, body: JSON.stringify(body) }))
      if (method === 'PUT') { setKey(''); setTouched(false); setNote('Connected. Your AI actions now run on Claude.') }
    } catch (e) { setError(e as Error) } finally { setBusy('') }
  }

  function connect(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (problem) { document.getElementById(`${uid}-key`)?.focus(); return }
    void send('Checking the key…', 'PUT', { apiKey: key.trim(), model })
  }

  return (
    <Card title="Claude" subtitle="Use your own Anthropic API key for the app's AI.">
      {guest && <p className="muted-small">Sign in to connect Claude. Guests use the app's own AI.</p>}
      {!guest && status.loading && !s && <LoadingState label="Loading" rows={2} />}
      {!guest && status.error && <ErrorNotice error={status.error} what="the Claude setting" />}
      {!guest && s && (
        <div className="stack-3">
          {s.connected ? (
            <>
              <div className="claude-key">
                <Badge tone="success">Connected</Badge>
                <span className="muted-small">Key ending {s.keyHint?.replace('…', '')} · checked {s.checkedAt ? new Date(s.checkedAt).toLocaleDateString() : '—'}</span>
              </div>
              <p className="muted-small">Goal parsing, message drafts and rewrites, the assistant and profile help now run on Claude, billed to your Anthropic account.</p>
              <div className="field">
                <label htmlFor={`${uid}-model`}>Model</label>
                <select id={`${uid}-model`} value={s.model} disabled={Boolean(busy)} onChange={(e) => void send('Saving…', 'PATCH', { model: e.target.value })}>
                  {s.models.map((m) => <option key={m} value={m}>{MODEL_LABEL[m] ?? m}</option>)}
                </select>
              </div>
              <button type="button" className="top-switch claude-share" role="switch" aria-checked={s.shareWithCandidates} disabled={Boolean(busy)}
                onClick={() => void send('Saving…', 'PATCH', { shareWithCandidates: !s.shareWithCandidates })}>
                <span className="top-switch-track" aria-hidden="true"><i /></span>
                <span>Let my candidates tailor their resume with this key (up to 100 a day in total)</span>
              </button>
              <div><button type="button" className="btn btn-ghost btn-sm text-danger" disabled={Boolean(busy)} onClick={() => void send('Removing…', 'DELETE')}>Remove key</button></div>
            </>
          ) : (
            <form className="stack-3" onSubmit={connect} noValidate>
              <p className="muted-small">Create a key at console.anthropic.com → API keys; your company's Anthropic organisation can give you one. A Claude.ai or Claude Code subscription cannot be used here.</p>
              {!s.canStore && <p className="notice-warning" role="alert">This server cannot store keys yet. Ask the admin to set the encryption key (Mail__TokenKey).</p>}
              <div className="field">
                <label htmlFor={`${uid}-key`}>Anthropic API key</label>
                <input id={`${uid}-key`} type="password" autoComplete="off" spellCheck={false} value={key} aria-invalid={touched && Boolean(problem)}
                  aria-describedby={`${uid}-key-hint${touched && problem ? ` ${uid}-key-err` : ''}`} onChange={(e) => setKey(e.target.value)} />
                <p id={`${uid}-key-hint`} className="hint">Tested with a free call, then stored encrypted. Only the last 4 characters are ever shown.</p>
                {touched && problem && <p id={`${uid}-key-err`} className="field-error">{problem}</p>}
              </div>
              <div className="field">
                <label htmlFor={`${uid}-model-new`}>Model</label>
                <select id={`${uid}-model-new`} value={model} onChange={(e) => setModel(e.target.value)}>
                  {s.models.map((m) => <option key={m} value={m}>{MODEL_LABEL[m] ?? m}</option>)}
                </select>
              </div>
              <div><button type="submit" className="btn btn-primary btn-sm" disabled={Boolean(busy) || !s.canStore}>{busy || 'Connect Claude'}</button></div>
            </form>
          )}
          {error && <ErrorNotice error={error} />}
          {note && <p className="muted-small" role="status">{note}</p>}
        </div>
      )}
    </Card>
  )
}
