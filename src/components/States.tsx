import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

/**
 * Design round 3 `States`: a state fills the width it is given, says what is true, and offers the next action.
 * No marooned centred cards.
 */

export function EmptyState({ icon, title, children, actions }: { icon?: ReactNode; title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <section className="state state-empty">
      {icon && (
        <span className="state-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <h2 className="state-title">{title}</h2>
      {children && <div className="state-text">{children}</div>}
      {actions && <div className="state-actions">{actions}</div>}
    </section>
  )
}

/** Empty because of filters: say which filters excluded everything and offer to clear them. */
export function FilteredEmpty({ title = 'No results for these filters', children, onClear }: { title?: string; children: ReactNode; onClear: () => void }) {
  return (
    <section className="state">
      <h2 className="state-title">{title}</h2>
      <div className="state-text">{children}</div>
      <div className="state-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={onClear}>
          Clear filters
        </button>
      </div>
    </section>
  )
}

/** Skeleton while a list or page loads; switches to the "API waking" wording while the free host starts. */
export function LoadingState({ label, waking, rows = 4, stats = 0 }: { label: string; waking?: boolean; rows?: number; stats?: number }) {
  if (waking) return <WakingState />
  return (
    <section className="state state-loading" aria-busy="true">
      {stats > 0 && (
        <div className="skeleton-stats">
          {Array.from({ length: stats }, (_, i) => (
            <div key={i} className="skeleton-card">
              <i className="sk sk-short" />
              <i className="sk sk-block" />
            </div>
          ))}
        </div>
      )}
      <div className="skeleton-rows" aria-hidden="true">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="skeleton-row">
            <i className="sk" />
            <i className="sk sk-mid" />
            <i className="sk sk-short" />
          </div>
        ))}
      </div>
      <p className="muted-small" role="status">
        {label}
      </p>
    </section>
  )
}

export function WakingState() {
  return (
    <section className="state" role="status">
      <div className="row">
        <span className="spinner" aria-hidden="true" />
        <h2 className="state-title">Starting the API service…</h2>
      </div>
      <p className="state-text">
        The server sleeps when idle on free hosting. The first request after a quiet spell takes up to a minute. This is a
        wait, not an error — nothing is wrong and nothing is lost. Retrying automatically.
      </p>
    </section>
  )
}

/** Design "Not built yet — rebuilt": a one-line notice, then what it will do and what you can do today. */
export function NotBuiltState({
  title,
  note,
  willDo,
  today,
}: {
  title: string
  note: string
  willDo: string[]
  today: { label: string; to: string; primary?: boolean }[]
}) {
  return (
    <div className="stack-4">
      <p className="notice notice-warning">
        <strong>{title}</strong> {note}
      </p>
      <div className="state-split">
        <section className="card stack-2">
          <div className="eyebrow">What it will do</div>
          <ul className="state-list">
            {willDo.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </section>
        <section className="card stack-2">
          <div className="eyebrow">What you can do today</div>
          {today.map((t) => (
            <Link key={t.to} to={t.to} className={`btn ${t.primary ? 'btn-secondary' : 'btn-link'} state-today`}>
              {t.label}
            </Link>
          ))}
        </section>
      </div>
    </div>
  )
}
