import { Link } from 'react-router-dom'
import { Card } from '../cards'
import { Icon, type IconName } from '../icons'

export interface SourceRow { id: string; label: string; read: number; qualified: number; lastRun: string | null; failing: boolean }

/** How each source is doing: a health dot with a word, when it last ran, and what it brought in. Nothing run yet says so. */
export function SourcesCard({ rows, when }: Readonly<{ rows: readonly SourceRow[]; when: (iso: string) => string }>) {
  return (
    <Card title="Sources" subtitle="Where your results come from">
      {rows.length === 0 ? <p className="muted-small">No source has run yet.</p> : (
        <ul className="plain-list" aria-label="Sources">
          {rows.slice(0, 6).map((s) => (
            <li key={s.id} className="hrow">
              <span className={`dot dot-${s.failing ? 'danger' : s.lastRun ? 'success' : 'neutral'}`} aria-hidden="true" />
              <span className="hn">{s.label}<span className="sr-only">{s.failing ? ' — failing' : s.lastRun ? ' — healthy' : ' — not run yet'}</span></span>
              <span className="hm">{s.lastRun ? `${when(s.lastRun)} · ${s.read} read · ${s.qualified} qualified` : 'Not run yet'}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export interface ActivityRow { at: string; text: string; icon: IconName; to?: string }

/** The last few things that happened, as a vertical timeline. Hidden when nothing is recorded. */
export function ActivityCard({ rows, when }: Readonly<{ rows: readonly ActivityRow[]; when: (iso: string) => string }>) {
  if (rows.length === 0) return null
  return (
    <Card title="Recent activity" subtitle="Your last actions">
      <ol className="tl plain-list" aria-label="Recent activity">
        {rows.slice(0, 8).map((r, i) => (
          <li key={`${r.at}-${i}`}>
            <span className="ichip t-neutral"><Icon name={r.icon} size={14} /></span>
            <span className="tl-text">{r.to ? <Link to={r.to}>{r.text}</Link> : r.text}</span>
            <time className="muted-small" dateTime={r.at}>{when(r.at)}</time>
          </li>
        ))}
      </ol>
    </Card>
  )
}
