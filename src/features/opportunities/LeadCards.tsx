import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, CardList, LeadCard } from '../../components/cards'
import { leadChips } from '../../components/cardModel'
import { ErrorNotice } from '../../components/ErrorNotice'
import { api, ApiError } from '../../lib/api'
import type { DraftChannel, OpportunitySummary, OpportunityStatus, OutreachDraft } from '../../lib/types'
import { ProfileConfirmNotice } from '../profiles/ProfileConfirmNotice'
import { needsProfileConfirm } from '../profiles/profileFields'
import { BULK_CHANNELS, BULK_MAX, queuePath, summarizeBulk, type BulkOutcome } from './bulkDraft'
import { applyLabel, foundLabel, OUTCOME_LABELS, platformLabel, primaryAction, STATUS_LABELS } from './opportunityModel'

/** The simple view's list: one card per job or company. The title is the link to the full page; the button does the one useful thing. */
export function LeadCardList({ items, selected, onToggle, busy, onStatus, label }: Readonly<{
  items: OpportunitySummary[]
  selected: ReadonlySet<string>
  onToggle: (id: string) => void
  busy: string | null
  onStatus: (o: OpportunitySummary, to: OpportunityStatus) => void
  label: string
}>) {
  return (
    <CardList label={label}>
      {items.map((o, i) => {
        const status = STATUS_LABELS[o.status] ?? { text: o.status, tone: 'neutral' }
        const excluded = o.outcome === 'Excluded'
        const next = primaryAction(o)
        let action
        if (next.to) action = <button type="button" className="btn btn-primary btn-sm" disabled={busy === o.id} onClick={() => onStatus(o, next.to!)}>{next.label}<span className="sr-only"> {o.title}</span></button>
        else if (next.label === 'Draft outreach') action = <Link className="btn btn-primary btn-sm" to={`/opportunities/${o.id}#outreach`}>Reach out<span className="sr-only"> to {o.organization}</span></Link>
        else if (next.label === 'Open posting' && (o.applyUrl || o.url)) action = (
          <>
            <a className="btn btn-primary btn-sm" href={(o.applyUrl ?? o.url)!} target="_blank" rel="noreferrer">{applyLabel(o.platform)}<span className="sr-only"> for {o.title} (opens in a new tab)</span></a>
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy === o.id} onClick={() => onStatus(o, 'Applied')}>I applied<span className="sr-only"> to {o.title}</span></button>
          </>
        )
        else action = <Link className="btn btn-secondary btn-sm" to={`/opportunities/${o.id}`}>Review<span className="sr-only"> {o.title}</span></Link>
        const outcome = OUTCOME_LABELS[o.outcome]
        return (
          <LeadCard
            key={o.id}
            id={o.id}
            title={o.title}
            organization={o.organization}
            location={o.location}
            to={`/opportunities/${o.id}`}
            score={excluded ? null : o.score}
            status={status}
            chips={leadChips({ location: o.location, platformLabel: platformLabel(o.platform) })}
            note={excluded ? (o.outcomeReason ?? outcome?.text ?? null) : null}
            selected={selected.has(o.id)}
            onSelect={() => onToggle(o.id)}
            action={action}
            coach={i === 0 ? 'opps-action' : undefined}
            position={i + 1}
            found={foundLabel(o.foundAt)}
            foundAt={o.foundAt}
          />
        )
      })}
    </CardList>
  )
}

async function draftFor(opportunityId: string, channel: DraftChannel): Promise<BulkOutcome> {
  try {
    const d = await api<OutreachDraft>(`/api/v1/opportunities/${opportunityId}/drafts`, { method: 'POST', body: JSON.stringify({ channel, recipient: null }) })
    return { opportunityId, draftId: d.id, kind: 'created' }
  } catch (e) {
    // One draft per channel per opportunity: reuse the one that exists instead of failing.
    if (e instanceof ApiError && e.status === 409) {
      const all = await api<OutreachDraft[]>(`/api/v1/opportunities/${opportunityId}/drafts`).catch(() => [])
      const found = all.find((x) => x.channel === channel)
      if (found) return { opportunityId, draftId: found.id, kind: 'existing' }
    }
    if (needsProfileConfirm(e as Error)) throw e
    return { opportunityId, draftId: null, kind: 'failed', reason: (e as Error).message }
  }
}

/**
 * "Draft messages" for everything selected: pick Email or LinkedIn note, one draft is made per lead (an existing one is reused),
 * then the person is taken to the send queue. Nothing is approved or sent here.
 */
export function BulkDraftCard({ ids, noun, onCancel }: Readonly<{ ids: string[]; noun: string; onCancel: () => void }>) {
  const navigate = useNavigate()
  const [channel, setChannel] = useState<(typeof BULK_CHANNELS)[number]['value']>('Email')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Error>()
  const [done, setDone] = useState<ReturnType<typeof summarizeBulk>>()
  const capped = ids.slice(0, BULK_MAX)

  async function run() {
    setBusy(true); setError(undefined)
    try {
      const outcomes: BulkOutcome[] = []
      for (const id of capped) outcomes.push(await draftFor(id, channel))
      const summary = summarizeBulk(outcomes, noun)
      setDone(summary)
    } catch (e) { setError(e as Error) } finally { setBusy(false) }
  }

  if (done) {
    return (
      <Card tone="signature" title="Messages are drafted" subtitle={done.text}
        footer={<>
          <button type="button" className="btn btn-primary" disabled={done.draftIds.length === 0} onClick={() => navigate(queuePath(done.draftIds))}>Review &amp; send {done.draftIds.length} {done.draftIds.length === 1 ? 'message' : 'messages'}</button>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>Stay here</button>
        </>}>
        <p className="muted-small">The queue opens them one at a time: fix the recipient, approve, send, next. Nothing was approved or sent.</p>
      </Card>
    )
  }
  return (
    <Card tone="signature" title={`Draft messages for ${capped.length} ${capped.length === 1 ? 'lead' : 'leads'}`}
      subtitle={ids.length > BULK_MAX ? `The first ${BULK_MAX} of ${ids.length} selected (one batch is limited so each can be reviewed).` : 'Pick the kind of message. You review every one before anything is sent.'}
      footer={<>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void run()}>{busy ? 'Drafting…' : 'Draft messages'}</button>
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={onCancel}>Cancel</button>
      </>}>
      <fieldset className="field" disabled={busy}>
        <legend className="sr-only">Kind of message</legend>
        <div className="type-row">
          {BULK_CHANNELS.map((c) => (
            <label key={c.value} className={`type-option ${channel === c.value ? 'type-option-active' : ''}`}>
              <input type="radio" name="bulk-channel" value={c.value} checked={channel === c.value} onChange={() => setChannel(c.value)} />
              <span className="type-option-label"><span className="type-radio" aria-hidden="true" />{c.label}</span>
              <span className="muted-small">{c.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {error && (needsProfileConfirm(error)
        ? <ProfileConfirmNotice opportunityId={capped[0]} onConfirmed={() => { setError(undefined); void run() }} />
        : <ErrorNotice error={error} />)}
    </Card>
  )
}


/**
 * "Apply to all approved": one approval for the batch, then each posting is opened for you to submit yourself. Press "I applied" to
 * record it (it moves to Applied and a follow-up starts), or "Skip". Nothing is submitted by the app.
 */
export function ApplyQueue({ items, onApplied, onClose }: Readonly<{ items: OpportunitySummary[]; onApplied: (o: OpportunitySummary) => Promise<boolean>; onClose: () => void }>) {
  const [list] = useState(items)
  const [index, setIndex] = useState(0)
  const [applied, setApplied] = useState(0)
  const [busy, setBusy] = useState(false)
  const current = list[index]
  const link = current ? current.applyUrl ?? current.url : null

  async function done(didApply: boolean) {
    if (didApply && current) {
      setBusy(true)
      const ok = await onApplied(current)
      setBusy(false)
      if (!ok) return
      setApplied((n) => n + 1)
    }
    setIndex((i) => i + 1)
  }

  if (list.length === 0) return <Card tone="muted" title="Nothing to apply to"><p>Select approved jobs that have a posting link, then choose Apply.</p><button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Close</button></Card>
  if (!current) return <Card title="Queue finished"><p>{applied} marked as applied out of {list.length}.</p><button type="button" className="btn btn-primary btn-sm" onClick={onClose}>Close</button></Card>
  return (
    <Card title={`Apply — ${index + 1} of ${list.length}`} subtitle="Open the posting, apply there, then come back and press “I applied”.">
      <div className="stack-3">
        <p><strong>{current.title}</strong>{current.organization ? ` · ${current.organization}` : ''}</p>
        <div className="row wrap">
          {link && <a className="btn btn-primary btn-sm" href={link} target="_blank" rel="noopener noreferrer">{applyLabel(current.platform)} ↗<span className="sr-only"> (opens in a new tab)</span></a>}
          <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void done(true)}>I applied</button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void done(false)}>Skip</button>
          <span className="grow" />
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Stop</button>
        </div>
      </div>
    </Card>
  )
}
