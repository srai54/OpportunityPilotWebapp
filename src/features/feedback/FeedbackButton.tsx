import { useId, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ErrorNotice } from '../../components/ErrorNotice'
import { api } from '../../lib/api'
import { Sheet } from '../calls/Sheet'
import { FEEDBACK_KINDS, MAX_FEEDBACK, feedbackProblem, pageOf, type FeedbackKind } from './feedbackModel'

/** The form inside the sheet: what kind, an optional 1–5 rating and the message. The page is attached, never the address's query. */
function FeedbackForm({ onDone }: Readonly<{ onDone: () => void }>) {
  const location = useLocation()
  const uid = useId()
  const [kind, setKind] = useState<FeedbackKind>('Idea')
  const [rating, setRating] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<Error>()
  const problem = feedbackProblem(message)

  async function send(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (problem) { document.getElementById(`${uid}-msg`)?.focus(); return }
    setBusy(true); setError(undefined)
    try {
      await api('/api/v1/feedback', { method: 'POST', body: JSON.stringify({ kind, rating, message: message.trim(), page: pageOf(location), appVersion: __APP_COMMIT__ }) })
      setSent(true)
    } catch (err) { setError(err as Error) } finally { setBusy(false) }
  }

  if (sent) return (
    <div className="stack-3">
      <p className="notice-success" role="status">Thank you. The team reads every message.</p>
      <div><button type="button" className="btn btn-secondary" onClick={onDone}>Close</button></div>
    </div>
  )

  return (
    <form className="stack-3" onSubmit={send} noValidate>
      <fieldset className="stack-1">
        <legend><strong>What is it about?</strong></legend>
        <div className="fb-kinds">
          {FEEDBACK_KINDS.map((k) => (
            <label key={k.kind} className="fb-kind"><input type="radio" name={`${uid}-kind`} value={k.kind} checked={kind === k.kind} onChange={() => setKind(k.kind)} /> {k.label}</label>
          ))}
        </div>
      </fieldset>
      <fieldset className="stack-1">
        <legend><strong>How is the app working for you?</strong> <span className="muted-small">(optional)</span></legend>
        <div className="fb-rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="fb-star"><input type="radio" name={`${uid}-rating`} value={n} checked={rating === n} onChange={() => setRating(n)} /><span>{n}</span><span className="sr-only"> of 5</span></label>
          ))}
        </div>
        <span className="hint">1 is poor, 5 is great.</span>
      </fieldset>
      <div className="field">
        <label htmlFor={`${uid}-msg`}>Your message</label>
        <textarea id={`${uid}-msg`} rows={5} maxLength={MAX_FEEDBACK} value={message} aria-invalid={touched && Boolean(problem)} aria-describedby={`${uid}-hint${touched && problem ? ` ${uid}-err` : ''}`}
          onChange={(e) => setMessage(e.target.value)} />
        <p id={`${uid}-hint`} className="hint">What happened, or what would help. The page you are on is attached; nothing else.</p>
        {touched && problem && <p id={`${uid}-err`} className="field-error">{problem}</p>}
      </div>
      {error && <ErrorNotice error={error} />}
      <div className="row wrap">
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Send feedback'}</button>
        <button type="button" className="btn btn-ghost" onClick={onDone}>Cancel</button>
      </div>
    </form>
  )
}

/** "Send feedback" in the footer: opens a short form in a sheet. */
export function FeedbackButton({ className = 'btn-link' }: Readonly<{ className?: string }>) {
  const [open, setOpen] = useState(false)
  const labelId = useId()
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)} aria-haspopup="dialog">Send feedback</button>
      {open && (
        <Sheet title="Send feedback" subtitle="Tell us what works and what does not." labelId={labelId} onClose={() => setOpen(false)}>
          <FeedbackForm onDone={() => setOpen(false)} />
        </Sheet>
      )}
    </>
  )
}
