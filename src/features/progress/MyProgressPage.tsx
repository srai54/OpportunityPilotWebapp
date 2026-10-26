import { useState, type FormEvent } from 'react'
import { Card } from '../../components/cards'
import { PageHeader } from '../../components/PageHeader'
import { readMyProgress, tokenFrom } from './progressModel'

/**
 * Candidate view (2026-10-26): a candidate sees only what their recruiter shares. This page opens their private progress link
 * (stage, next interview, prep, suggested roles). The browser remembers the last link opened, so it is one tap next time.
 */
export function MyProgressPage() {
  const [saved] = useState(readMyProgress)
  const [value, setValue] = useState('')
  const [problem, setProblem] = useState('')
  function open(e: FormEvent) {
    e.preventDefault()
    const t = tokenFrom(value)
    if (!t) { setProblem('Paste the whole link your recruiter sent, or just the code at its end.'); return }
    window.location.assign(`/progress/${encodeURIComponent(t)}`)
  }
  return (
    <div className="page stack-4" style={{ maxWidth: 720 }}>
      <PageHeader title="My progress" subtitle="What your recruiter shares with you: where each application stands, your next interview, prep tips and roles to consider." />
      {saved && (
        <Card tone="signature" title="Your progress page">
          <p className="muted-small">The link you opened last on this browser.</p>
          <div><a className="btn btn-primary" href={`/progress/${encodeURIComponent(saved)}`}>Open my progress</a></div>
        </Card>
      )}
      <Card title={saved ? 'Open a different link' : 'Open the link your recruiter sent'}>
        <form className="stack-3" onSubmit={open} noValidate>
          <div className="field">
            <label htmlFor="my-progress-link">Your link or code</label>
            <input id="my-progress-link" value={value} onChange={(e) => { setValue(e.target.value); setProblem('') }} autoComplete="off"
              aria-invalid={Boolean(problem)} aria-describedby={problem ? 'my-progress-problem' : 'my-progress-hint'} />
            {problem ? <p id="my-progress-problem" className="field-error" role="alert">{problem}</p>
              : <p id="my-progress-hint" className="hint">It looks like https://…/progress/a-long-code</p>}
          </div>
          <div><button type="submit" className="btn btn-secondary">Open</button></div>
        </form>
      </Card>
      <p className="muted-small">Only what your recruiter chose to share is shown, never pay, rates or internal notes. Lost your link? Ask your recruiter for a new one.</p>
    </div>
  )
}
