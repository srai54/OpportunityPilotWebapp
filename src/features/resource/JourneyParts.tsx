import { useState, type FormEvent } from 'react'
import { ErrorNotice } from '../../components/ErrorNotice'
import { api } from '../../lib/api'
import { kindOf, LOG_KINDS, monthCells, when, type TimelineItem } from './journeyModel'

export function KindChip({ kind }: Readonly<{ kind: string }>) {
  const k = kindOf(kind)
  return <span className={`jr-chip jr-${k.tone}`}>{k.label}</span>
}

const FILTERS: { label: string; kinds: string[] | null }[] = [
  { label: 'All', kinds: null },
  { label: 'Learning', kinds: ['Learning'] },
  { label: 'Certifications', kinds: ['Certification'] },
  { label: 'Projects', kinds: ['Project'] },
  { label: 'Interviews', kinds: ['Interview', 'InterviewPrep'] },
  { label: 'Resumes', kinds: ['Resume', 'Offer'] },
]

/** Everything since joining, newest first, with a kind filter. `onDelete` (sales) removes a logged entry. */
export function JourneyTimeline({ items, onDelete }: Readonly<{ items: TimelineItem[]; onDelete?: (entryId: string) => void }>) {
  const [filter, setFilter] = useState('All')
  const kinds = FILTERS.find((f) => f.label === filter)?.kinds
  const shown = kinds ? items.filter((t) => kinds.includes(t.kind)) : items
  return (
    <div className="stack-3">
      <div className="row wrap" role="group" aria-label="Show">
        {FILTERS.map((f) => <button key={f.label} type="button" className={`btn btn-sm ${filter === f.label ? 'btn-primary' : 'btn-secondary'}`} aria-pressed={filter === f.label} onClick={() => setFilter(f.label)}>{f.label}</button>)}
      </div>
      {shown.length === 0 ? <p className="muted-small">Nothing here yet.</p> : (
        <ol className="jr-timeline">
          {shown.map((t, i) => (
            <li key={`${t.at}-${i}`} className="jr-item">
              <span className="jr-when">{when(t.at)}</span>
              <span className={`jr-dot jr-${kindOf(t.kind).tone}`} aria-hidden="true" />
              <div className="stack-1">
                <div className="row wrap"><strong>{t.title}</strong><KindChip kind={t.kind} />{t.source === 'Candidate' && <span className="muted-small">added by the candidate</span>}</div>
                {t.detail && <span className="muted-small">{t.detail}</span>}
                {onDelete && t.entryId && <div><button type="button" className="btn btn-ghost btn-sm" onClick={() => onDelete(t.entryId!)}>Remove<span className="sr-only"> {t.title}</span></button></div>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

/** Upcoming events with a date tile. */
export function UpcomingList({ items, empty }: Readonly<{ items: TimelineItem[]; empty: string }>) {
  if (items.length === 0) return <p className="muted-small">{empty}</p>
  return (
    <ul className="jr-upcoming">
      {items.map((t, i) => {
        const d = new Date(t.at)
        return (
          <li key={`${t.at}-${i}`}>
            <span className="jr-date" aria-hidden="true"><span>{d.toLocaleString(undefined, { month: 'short' }).toUpperCase()}</span><strong>{d.getDate()}</strong></span>
            <div className="stack-1"><strong>{t.title}</strong><span className="muted-small">{when(t.at, true)}{t.detail ? ` · ${t.detail}` : ''}</span></div>
          </li>
        )
      })}
    </ul>
  )
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** A month calendar of the journey: what happened and what is coming. */
export function JourneyCalendar({ items }: Readonly<{ items: TimelineItem[] }>) {
  const [now] = useState(() => new Date())
  const [ym, setYm] = useState(() => ({ y: now.getFullYear(), m: now.getMonth() }))
  const move = (delta: number) => setYm(({ y, m }) => { const d = new Date(y, m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() } })
  const cells = monthCells(ym.y, ym.m, items, now)
  const label = new Date(ym.y, ym.m, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' })
  return (
    <div className="stack-3">
      <div className="row">
        <button type="button" className="btn btn-secondary btn-sm" aria-label="Previous month" onClick={() => move(-1)}>‹</button>
        <strong className="jr-month" aria-live="polite">{label}</strong>
        <button type="button" className="btn btn-secondary btn-sm" aria-label="Next month" onClick={() => move(1)}>›</button>
      </div>
      <div className="jr-cal" role="group" aria-label={`Calendar, ${label}`}>
        {WEEKDAYS.map((w) => <span key={w} className="jr-wd" aria-hidden="true">{w}</span>)}
        {cells.map((c) => (
          <div key={c.key} className={`jr-cell${c.day === null ? ' is-blank' : ''}${c.today ? ' is-today' : ''}`}>
            {c.day !== null && <span className="jr-num">{c.day}<span className="sr-only">{` ${label.split(' ')[0]}`}{c.today ? ' (today)' : ''}{c.items.length ? `: ${c.items.map((t) => t.title).join(', ')}` : ''}</span></span>}
            {c.items.map((t, i) => <span key={i} className={`jr-chip jr-${kindOf(t.kind).tone} jr-cal-item`} title={t.title} aria-hidden="true">{t.title}</span>)}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Log progress: posts { kind, title, detail, at, hours } to `url` and hands back the API's answer. */
export function LogProgress<T>({ url, onAdded, intro }: Readonly<{ url: string; onAdded: (value: T) => void; intro: string }>) {
  const [kind, setKind] = useState<string>('Learning')
  const [title, setTitle] = useState('')
  const [detail, setDetail] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [hours, setHours] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState('')
  const [error, setError] = useState<Error>()
  const id = (k: string) => `log-${k}`
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError(new Error('Give it a title.')); return }
    setBusy(true); setError(undefined); setDone('')
    try {
      const at = new Date(`${date}T12:00:00`).toISOString()
      const value = await api<T>(url, { method: 'POST', body: JSON.stringify({ kind, title: title.trim(), detail: detail.trim() || null, at, hours: hours ? Number(hours) : null }) })
      onAdded(value); setTitle(''); setDetail(''); setHours(''); setDone('Added to the journey.')
    } catch (err) { setError(err as Error) } finally { setBusy(false) }
  }
  return (
    <form className="stack-3 jr-form" onSubmit={(e) => void submit(e)} noValidate>
      <p className="muted-small">{intro}</p>
      <div className="rb-grid">
        <div className="field"><label htmlFor={id('kind')}>What was it?</label>
          <select id={id('kind')} value={kind} onChange={(e) => setKind(e.target.value)}>{LOG_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</select></div>
        <div className="field"><label htmlFor={id('date')}>Date</label><input id={id('date')} type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-describedby={id('date-hint')} />
          <p id={id('date-hint')} className="hint">A future date makes it an upcoming event (an exam booked).</p></div>
      </div>
      <div className="field"><label htmlFor={id('title')}>Title</label><input id={id('title')} value={title} maxLength={300} placeholder="e.g. Finished: Kubernetes for developers" onChange={(e) => setTitle(e.target.value)} aria-invalid={Boolean(error) && !title.trim()} /></div>
      <div className="rb-grid">
        <div className="field"><label htmlFor={id('detail')}>Details or link</label><input id={id('detail')} value={detail} maxLength={1000} onChange={(e) => setDetail(e.target.value)} /></div>
        <div className="field"><label htmlFor={id('hours')}>Hours (optional)</label><input id={id('hours')} inputMode="numeric" value={hours} onChange={(e) => setHours(e.target.value.replace(/[^0-9]/g, ''))} /></div>
      </div>
      {error && <ErrorNotice error={error} />}
      {done && <p className="muted-small" role="status">{done}</p>}
      <div><button type="submit" className="btn btn-primary btn-sm" disabled={busy}>{busy ? 'Adding…' : 'Add to the journey'}</button></div>
    </form>
  )
}
