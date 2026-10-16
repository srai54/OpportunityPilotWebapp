import { useState, type ReactNode } from 'react'
import { Icon } from './icons'
import { ApiError, ApiStillUnreachableError, ApiUnreachableError, isSignInRequired, isTryLater } from '../lib/api'

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' })

function describe(error: Error): string {
  if (error instanceof ApiStillUnreachableError)
    return 'The API is still not responding after retrying for about two minutes. The free host may be restarting — try again in a moment.'
  if (error instanceof ApiUnreachableError)
    return 'The API could not be reached. On free hosting it sleeps when idle and can take up to a minute to wake — try again in a moment.'
  // A validation failure carries the real reasons per field; show those, not just "Validation failed".
  if (error instanceof ApiError && error.fieldErrors) {
    const reasons = Object.values(error.fieldErrors).flat().filter(Boolean)
    if (reasons.length > 0) return reasons.join(' ')
  }
  return error.message
}

/**
 * Inline by default (inside forms and cards). With `what`, renders the design's "request failed" card:
 * "Could not load X", the reason, a support reference (never a server trace), Try again and an optional way out.
 */
export function ErrorNotice({ error, onRetry, what, secondary }: { error: Error; onRetry?: () => void; what?: string; secondary?: ReactNode }) {
  const text = describe(error)
  const correlationId = error instanceof ApiError ? error.correlationId : undefined
  // When the failure was first shown, for the support reference.
  const [shownAt] = useState(() => timeFmt.format(new Date()))
  if (isSignInRequired(error)) return (
    <div className="notice notice-info row wrap" role="status">
      <span className="grow"><strong>Sign in to use this.</strong> Voice, AI, live job boards and sending need an account; guest mode covers the rest.</span>
      <a className="btn btn-primary btn-sm" href="/sign-in">Sign in</a>
    </div>)
  if (isTryLater(error)) return <p className="notice notice-warning" role="status"><strong>Used a lot just now.</strong> Try again later — this limit protects the free quota.</p>

  if (what) {
    return (
      <section className="state state-error" role="alert">
        <div className="row">
          <span className="state-error-icon" aria-hidden="true"><Icon name="alert" size={18} /></span>
          <h2 className="state-title">Could not load {what}</h2>
        </div>
        <p className="state-text">{text} Your data is untouched.</p>
        {correlationId && (
          <p className="mono muted-small">
            reference {correlationId} · {shownAt}
          </p>
        )}
        <div className="state-actions">
          {onRetry && (
            <button type="button" className="btn btn-primary btn-sm" onClick={onRetry}>
              <Icon name="refresh" size={14} /> Try again
            </button>
          )}
          {secondary}
        </div>
      </section>
    )
  }

  return (
    <div className="notice notice-danger" role="alert">
      <span>{text}</span>
      {correlationId && <span className="mono muted-small"> Reference {correlationId}</span>}
      {onRetry && (
        <button type="button" className="btn btn-secondary btn-sm notice-action" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}
