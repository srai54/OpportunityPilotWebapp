import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { avatarSlot, initialsOf, MATCH_WORDS, matchBand, ringDash, selectedLabel } from './cardModel'
import { Badge } from './StatusBadge'

/* The card family (DESIGN.md section 13). In the simple view every list of things is a list of these. */

export function CardList({ children, label }: Readonly<{ children: ReactNode; label: string }>) {
  return <ul className="card-list" aria-label={label}>{children}</ul>
}

export function CardGrid({ children, label }: Readonly<{ children: ReactNode; label: string }>) {
  return <ul className="card-grid" aria-label={label}>{children}</ul>
}

interface CardProps {
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  footer?: ReactNode
  /** `signature` = the one card that says what to do now. */
  tone?: 'default' | 'signature' | 'muted'
  className?: string
  coach?: string
  children?: ReactNode
}

/** A plain card: optional title and subtitle, a body, and footer actions. */
export function Card({ title, subtitle, actions, footer, tone = 'default', className = '', coach, children }: Readonly<CardProps>) {
  return (
    <section className={`ccard ccard-${tone} ${className}`.trim()} data-coach={coach}>
      {(title || actions) && (
        <header className="ccard-head">
          <div className="ccard-titles">
            {title && <h3 className="ccard-title">{title}</h3>}
            {subtitle && <p className="ccard-sub">{subtitle}</p>}
          </div>
          {actions && <div className="ccard-actions">{actions}</div>}
        </header>
      )}
      {children && <div className="ccard-body">{children}</div>}
      {footer && <footer className="ccard-foot">{footer}</footer>}
    </section>
  )
}

/** Initial letters on a soft tint: the same company always gets the same one. */
export function Avatar({ name }: Readonly<{ name: string }>) {
  return <span className={`avatar-tile avatar-${avatarSlot(name)}`} aria-hidden="true">{initialsOf(name)}</span>
}

/** Score out of 100 as a ring with the number inside; the words say what it is, so colour never carries it alone. */
export function MatchRing({ score }: Readonly<{ score: number | null }>) {
  const band = matchBand(score)
  const { circumference, dash } = ringDash(score ?? 0)
  return (
    <span className={`match-ring match-${band}`} role="img" aria-label={score === null ? MATCH_WORDS.none : `${MATCH_WORDS[band]}, ${Math.round(score)} out of 100`}>
      <svg viewBox="0 0 44 44" aria-hidden="true">
        <circle cx="22" cy="22" r="18" className="ring-track" />
        {score !== null && <circle cx="22" cy="22" r="18" className="ring-fill" strokeDasharray={`${dash} ${circumference - dash}`} transform="rotate(-90 22 22)" />}
      </svg>
      <b className="op-numeric">{score === null ? '—' : Math.round(score)}</b>
    </span>
  )
}

export interface LeadCardProps {
  id: string
  title: string
  organization: string
  location: string | null
  /** Where the full page is (the title is the one link; the card stretches it). */
  to: string
  score: number | null
  status: { text: string; tone: string }
  chips?: string[]
  /** Short reason or note under the title (for example why it was excluded). */
  note?: string | null
  selected?: boolean
  onSelect?: (on: boolean) => void
  /** The one primary action, already a button or link. */
  action: ReactNode
  coach?: string
}

/** A job or a company (lead): everything needed to decide is on the card. */
export function LeadCard({ id, title, organization, location, to, score, status, chips = [], note, selected = false, onSelect, action, coach }: Readonly<LeadCardProps>) {
  return (
    <li className={`ccard lead-card${selected ? ' is-selected' : ''}`} data-coach={coach}>
      {onSelect && (
        <label className="lead-select">
          <input type="checkbox" checked={selected} onChange={(e) => onSelect(e.target.checked)} />
          <span className="sr-only">Select {title}</span>
        </label>
      )}
      <Avatar name={organization || title} />
      <div className="lead-main">
        <h3 className="lead-title"><Link to={to} id={`lead-${id}`}>{title}</Link></h3>
        <p className="lead-meta">{[organization, location].filter(Boolean).join(' · ')}</p>
        {(chips.length > 0 || note) && (
          <div className="lead-tags">
            {chips.map((c) => <span key={c} className="chip">{c}</span>)}
            {note && <span className="lead-note">{note}</span>}
          </div>
        )}
      </div>
      <div className="lead-side">
        <MatchRing score={score} />
        <Badge tone={status.tone}>{status.text}</Badge>
        <div className="lead-action">{action}</div>
      </div>
    </li>
  )
}

/** The sticky bar that appears once something is selected. It never sends anything by itself. */
export function BulkBar({ count, noun, children, onClear }: Readonly<{ count: number; noun: { one: string; many: string }; children: ReactNode; onClear: () => void }>) {
  if (count === 0) return null
  return (
    <div className="bulk-bar" role="region" aria-label="Actions for the selection">
      <strong role="status" aria-live="polite">{selectedLabel(count, noun)}</strong>
      <div className="bulk-actions">{children}</div>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onClear}>Clear</button>
    </div>
  )
}

export interface StepCardProps {
  n: number
  title: string
  text: string
  done: boolean
  current: boolean
  action?: ReactNode
}

/** One step of the path. The current one is the tinted signature card. */
export function StepCard({ n, title, text, done, current, action }: Readonly<StepCardProps>) {
  return (
    <li className={`ccard step-card${current ? ' ccard-signature' : ''}${done ? ' is-done' : ''}`} aria-current={current ? 'step' : undefined}>
      <span className="step-badge" aria-hidden="true">{done ? '✓' : n}</span>
      <div className="step-text">
        <h3 className="step-title">{title}{done && <span className="sr-only"> (done)</span>}</h3>
        <p className="step-sub">{text}</p>
      </div>
      {action && <div className="step-action">{action}</div>}
    </li>
  )
}

export interface MessageCardProps {
  company: string
  title: string
  channel: string
  recipient: string | null
  state: { text: string; tone: string }
  open: boolean
  onOpen: () => void
  /** "2 of 5" when the message is part of a send queue. */
  position?: string
  checked?: boolean
  onCheck?: (on: boolean) => void
  checkLabel?: string
}

/** One message in the outreach inbox: who it is for, how it goes out, and where it stands. */
export function MessageCard({ company, title, channel, recipient, state, open, onOpen, position, checked, onCheck, checkLabel }: Readonly<MessageCardProps>) {
  return (
    <li className={`ccard message-card${open ? ' is-open' : ''}`}>
      {onCheck && (
        <label className="lead-select">
          <input type="checkbox" checked={checked} onChange={(e) => onCheck(e.target.checked)} />
          <span className="sr-only">{checkLabel ?? `Select ${title}`}</span>
        </label>
      )}
      <button type="button" className="message-open" onClick={onOpen} aria-current={open ? 'true' : undefined}>
        <Avatar name={company || title} />
        <span className="message-main">
          <span className="message-title">{company || title}</span>
          <span className="message-meta">{channel}{recipient ? ` · ${recipient}` : ' · no recipient yet'}{position ? ` · ${position}` : ''}</span>
          <span className="message-sub">{title}</span>
        </span>
        <Badge tone={state.tone}>{state.text}</Badge>
      </button>
    </li>
  )
}
