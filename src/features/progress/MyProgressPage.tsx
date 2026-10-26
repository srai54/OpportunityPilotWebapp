import { useState, type FormEvent } from 'react'
import { Card } from '../../components/cards'
import { Icon } from '../../components/icons'
import { ProgressBody } from './ProgressPage'
import { readMyProgress, tokenFrom, writeMyProgress } from './progressModel'

function LinkForm({ onOpen, compact }: Readonly<{ onOpen: (token: string) => void; compact?: boolean }>) {
  const [value, setValue] = useState('')
  const [problem, setProblem] = useState('')
  function open(e: FormEvent) {
    e.preventDefault()
    const t = tokenFrom(value)
    if (!t) { setProblem('Paste the whole link your recruiter sent, or just the code at its end.'); return }
    writeMyProgress(t)
    onOpen(t)
  }
  return (
    <form className="stack-3" onSubmit={open} noValidate>
      <div className="field">
        <label htmlFor="my-progress-link">{compact ? 'Another link or code' : 'Your link or code'}</label>
        <input id="my-progress-link" value={value} onChange={(e) => { setValue(e.target.value); setProblem('') }} autoComplete="off"
          aria-invalid={Boolean(problem)} aria-describedby={problem ? 'my-progress-problem' : 'my-progress-hint'} />
        {problem ? <p id="my-progress-problem" className="field-error" role="alert">{problem}</p>
          : <p id="my-progress-hint" className="hint">It looks like https://…/progress/a-long-code</p>}
      </div>
      <div><button type="submit" className={`btn ${compact ? 'btn-secondary' : 'btn-primary'}`}>Open</button></div>
    </form>
  )
}

const WHAT_YOU_GET = [
  ['pulse', 'Your journey since joining', 'Day by day: what you learned, certified, built and interviewed for, on a timeline and a calendar.'],
  ['calendar', 'Upcoming', 'Your next interview with a join link and "add to calendar", exams you booked, decisions due.'],
  ['profiles', 'Your resume for each role', 'Write it in the client format against the job description, see your JD match, submit it for your recruiter\'s score.'],
  ['people', 'Your recruiter', 'Who looks after you, their notes and the roles they suggest; answer "I\'m interested" in one tap.'],
] as const

/**
 * Candidate view (2026-10-26): what the sales team shares, shown right here in the app. Once a link has been opened on this browser the
 * whole view (journey, applications, resume builder, upcoming, recruiter, suggested roles) shows in place; otherwise, how to open it.
 */
export function MyProgressPage() {
  const [token, setToken] = useState(readMyProgress)
  if (token) {
    return (
      <div className="page page-wide stack-4">
        <ProgressBody token={token} embedded />
        <details className="rb-jd">
          <summary>Open a different link</summary>
          <LinkForm compact onOpen={setToken} />
        </details>
      </div>
    )
  }
  return (
    <div className="page stack-4" style={{ maxWidth: 960 }}>
      <section className="ccard ccard-signature cv-empty stack-3" aria-label="My progress">
        <h2 className="cv-hero-title">Your progress, shared by your recruiter</h2>
        <p className="muted">Your recruiter sends you a private link. Open it once here and this page becomes your home: everything they share, live.</p>
        <LinkForm onOpen={setToken} />
      </section>
      <div className="cv-get">
        {WHAT_YOU_GET.map(([icon, title, text]) => (
          <Card key={title} level={3} title={<span className="row"><Icon name={icon} size={18} />{title}</span>}><p className="muted-small">{text}</p></Card>
        ))}
      </div>
      <p className="muted-small">Only what your recruiter chose to share is shown: never pay, rates or internal notes. Lost your link? Ask your recruiter for a new one.</p>
    </div>
  )
}
