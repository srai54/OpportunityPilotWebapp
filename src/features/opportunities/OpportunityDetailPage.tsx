import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ErrorNotice } from '../../components/ErrorNotice'
import { LoadingState } from '../../components/States'
import { Badge } from '../../components/StatusBadge'
import { Avatar, Card, MatchRing } from '../../components/cards'
import { api } from '../../lib/api'
import type { Evidence, OpportunityDetail, OpportunityStatus } from '../../lib/types'
import { useApi } from '../../lib/useApi'
import { formatWhen } from '../applications/applicationStatus'
import { MODE_LABELS } from '../campaigns/campaignModel'
import { useShell } from '../shell/ShellContext'
import { CoverNotePanel } from './CoverNotePanel'
import { OutreachActionsPanel } from './OutreachActionsPanel'
import {
  displayUrl,
  factLabel,
  formatPoints,
  foundLabel,
  isUserApplyBoard,
  OUTCOME_LABELS,
  platformLabel,
  safeHref,
  settableStatuses,
  STATUS_LABELS,
  valueLabel,
  nextPermittedAction,
} from './opportunityModel'
import { recruiterSearchUrl } from '../wellfound/boardModel'

const dateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
const formatDate = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : dateFmt.format(d)
}
const evidenceAnchor = (id: string) => `evidence-${id}`

export function OpportunityDetailPage() {
  const { id = '' } = useParams()
  const loaded = useApi<OpportunityDetail>(`/api/v1/opportunities/${encodeURIComponent(id)}`)
  // PATCH returns the full detail; keep it instead of refetching.
  const [updated, setUpdated] = useState<OpportunityDetail>()
  const o = updated?.id === id ? updated : loaded.data

  if (loaded.error && !o)
    return (
      <div className="page">
        <ErrorNotice
          error={loaded.error}
          onRetry={loaded.reload}
          what="this opportunity"
          secondary={
            <Link className="btn btn-secondary btn-sm" to="/opportunities">
              Back to opportunities
            </Link>
          }
        />
      </div>
    )
  if (!o) return <div className="page"><LoadingState label="Loading opportunity…" waking={loaded.waking} rows={6} stats={3} /></div>

  return <Detail o={o} onUpdated={setUpdated} />
}

function Detail({ o, onUpdated }: { o: OpportunityDetail; onUpdated: (o: OpportunityDetail) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Error>()
  const navigate = useNavigate()
  const [announcement, setAnnouncement] = useState('')
  const [chosen, setChosen] = useState<OpportunityStatus>(o.status)
  const { refreshOverview, advanced } = useShell()
  const [details, setDetails] = useState(advanced)

  const outcome = OUTCOME_LABELS[o.outcome] ?? { text: o.outcome, tone: 'neutral' }
  const status = STATUS_LABELS[o.status] ?? { text: o.status, tone: 'neutral' }
  const postingHref = safeHref(o.url)
  const applyHref = safeHref(o.applyUrl)
  // Greenhouse / Lever / Adzuna: the agent never applies there, so the application page is the way in.
  const userApplies = o.mode === 'Job' && isUserApplyBoard(o.platform)
  const showApply = Boolean(applyHref) && (userApplies || applyHref !== postingHref)
  const showPosting = Boolean(postingHref) && !(userApplies && postingHref === applyHref)
  const platform = platformLabel(o.platform)
  const suggested = o.status === 'Suggested'
  const evidenceById = new Map(o.evidence.map((e) => [e.id, e]))

  /** X3: turn this company into a staffing lead (account de-duplicated by website, then name) and open the deal. */
  async function makeStaffingLead() {
    setBusy(true)
    setError(undefined)
    try {
      const lead = await api<{ deal: { id: string } }>(`/api/v1/staffing/from-opportunity/${o.id}`, { method: 'POST' })
      navigate(`/staffing/deals/${lead.deal.id}`)
    } catch (e) {
      setError(e as Error)
    } finally {
      setBusy(false)
    }
  }

  async function setStatus(next: OpportunityStatus) {
    if (next === o.status) return
    if (
      next === 'Applied' &&
      !window.confirm('Mark this as applied? Only do this if you have applied yourself — it is recorded in the activity history.')
    )
      return
    setBusy(true)
    setError(undefined)
    try {
      const result = await api<OpportunityDetail>(`/api/v1/opportunities/${o.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      })
      onUpdated(result)
      setChosen(result.status)
      // The nav's approval count changes when a suggestion is approved or rejected here.
      if (o.status === 'Suggested' || result.status === 'Suggested') refreshOverview()
      setAnnouncement(`Status changed to ${STATUS_LABELS[result.status]?.text ?? result.status}.`)
    } catch (e) {
      setError(e as Error)
    } finally {
      setBusy(false)
    }
  }

  /** One click for a job: approve it (shortlist) and open its application page. The user applies there, then marks it applied. */
  async function approveAndApply() {
    const target = applyHref ?? postingHref
    if (!target) return
    const tab = window.open('about:blank', '_blank')
    if (tab) tab.opener = null
    if (o.status !== 'Shortlisted') await setStatus('Shortlisted')
    if (tab) tab.location.href = target
    setAnnouncement('Approved. Apply on the page that opened, then come back and click "I applied".')
  }

  const canApplyNow = o.mode === 'Job' && Boolean(applyHref ?? postingHref) && ['New', 'Suggested', 'Shortlisted', 'Dismissed'].includes(o.status)
  const unknown = o.breakdown.filter((b) => b.value === null)
  const decisions = (
    <>
      {(o.status === 'New' || o.status === 'Shortlisted' || suggested) && (
        <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void setStatus('Dismissed')}>
          Skip
        </button>
      )}
      {o.status === 'Dismissed' && (
        <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void setStatus('New')}>
          Restore
        </button>
      )}
      {(o.status === 'New' || o.status === 'Dismissed') && (
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void setStatus('Shortlisted')}>
          Approve
        </button>
      )}
      {suggested && (
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void setStatus('Shortlisted')}>
          ✓ Approve
        </button>
      )}
      {canApplyNow && (
        <button type="button" className="btn btn-primary btn-sm" data-coach="opp-approve" disabled={busy} onClick={() => void approveAndApply()}>
          {o.status === 'Shortlisted' ? 'Open application page →' : 'Approve & apply →'}
        </button>
      )}
      {o.mode === 'Job' && o.status === 'Shortlisted' && (
        <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void setStatus('Applied')}>
          I applied ✓
        </button>
      )}
    </>
  )

  return (
    <div className="page page-wide stack-4">
      <div className="stack-3">
        <Link to={`/campaigns/${o.campaignId}/opportunities`} className="small">
          ← Back to {o.mode === 'Job' ? 'jobs' : 'leads'}
        </Link>
        <Card className="detail-hero">
          <div className="hero-row">
            <Avatar name={o.organization || o.title} />
            <div className="hero-main">
              <h1 className="hero-title">{o.title}</h1>
              <p className="hero-meta">{[o.organization, o.location, platform].filter(Boolean).join(' · ')}</p>
              <div className="hero-badges">
                <Badge tone={status.tone}>{status.text}</Badge>
                {advanced && <Badge tone={o.mode === 'Job' ? 'success' : 'primary'}>{MODE_LABELS[o.mode] ?? o.mode}</Badge>}
                {advanced && <Badge tone={outcome.tone}>{outcome.text}</Badge>}
                {foundLabel(o.foundAt) && <span className="muted-small"><time dateTime={o.foundAt}>{foundLabel(o.foundAt)}</time></span>}
                <span className="muted-small">Updated <time dateTime={o.updatedAt}>{formatWhen(o.updatedAt)}</time></span>
              </div>
              <p className="hero-links small">
                {showPosting && postingHref && (
                  <a href={postingHref} target="_blank" rel="noopener noreferrer">
                    {o.mode === 'Job' ? 'Open posting ↗' : 'Open website ↗'}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                )}
                {o.organization && (
                  <a href={recruiterSearchUrl(o.organization)} target="_blank" rel="noopener noreferrer">
                    Find recruiters at {o.organization} ↗
                    <span className="sr-only"> (opens LinkedIn in a new tab)</span>
                  </a>
                )}
              </p>
            </div>
            <div className="hero-score">
              <MatchRing score={o.outcome === 'Excluded' ? null : o.score} />
              <span className="muted-small">match</span>
            </div>
          </div>
        </Card>
        <Card
          tone="signature"
          level={2}
          title="What to do now"
          subtitle={<span aria-live="polite">{nextPermittedAction(o)}</span>}
          footer={
            <>
              {decisions}
              {o.mode !== 'Job' && (o.status === 'Shortlisted' || o.status === 'Contacted' || o.status === 'Responded' || o.status === 'Interested') && (
                <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void makeStaffingLead()}>Make a staffing lead</button>
              )}
            </>
          }
        />
      </div>

      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
      {error && <ErrorNotice error={error} />}

      <div className="row">
        <button type="button" className="btn btn-ghost btn-sm" data-coach="opp-advanced" aria-expanded={details} onClick={() => setDetails(!details)}>
          {details ? 'Hide score details' : 'Advanced: how the score was built, facts and evidence'}
        </button>
      </div>
      <div className={details ? 'detail3' : 'detail2'}>
        <div className="stack-4">
          <section className="panel" aria-labelledby="fit-heading">
            <h3 id="fit-heading" className="sr-only">
              Fit score
            </h3>
            <div className="panel-body">
              <div className="fit-big op-numeric">
                <span className="fit-value">{Math.round(o.score)}</span>
                <span className="fit-of">% match</span>
              </div>
              <span className="meter-track meter-wide">
                <i style={{ width: `${Math.min(100, Math.max(0, o.score))}%` }} />
              </span>
              <strong className="text-success op-numeric">Evidence coverage {Math.round(o.coverage)}%</strong>
              {o.outcomeReason && <span className="muted-small">{o.outcomeReason}</span>}
              <p className="muted-small">A ranking against your criteria for this campaign. It says nothing about whether you will get a reply.</p>
            </div>
          </section>

          {details && <>
          <section className="panel" aria-labelledby="unknown-heading">
            <header className="panel-head">
              <h3 id="unknown-heading" className="eyebrow">
                What is still unknown
              </h3>
            </header>
            <div className="panel-body">
              {unknown.length === 0 && o.gaps.length === 0 ? (
                <p className="muted-small">Every scored criterion had evidence.</p>
              ) : (
                <ul className="plain-list unknown-list">
                  {unknown.map((b) => (
                    <li key={b.criterion}>
                      <strong>{b.label}</strong>
                      <span className="muted-small">{b.reason || 'No source says.'} Unknown scores zero; it is never rounded up to a pass.</span>
                    </li>
                  ))}
                  {o.gaps.map((g) => (
                    <li key={`gap-${g}`}>
                      <strong>{g}</strong>
                      <span className="muted-small">No source in this campaign supplied it.</span>
                    </li>
                  ))}
                </ul>
              )}
              <Link className="btn btn-secondary btn-sm" to={`/campaigns/${o.campaignId}/edit?step=3`}>
                Add a source that covers these
              </Link>
            </div>
          </section>

          {o.scoredBy && (
            <p className="muted-small">
              Scored by the <Link to={`/research/${o.scoredBy.researchJobId}`}>run of {new Date(o.scoredBy.runAt).toLocaleString()}</Link> using
              campaign version {o.scoredBy.campaignVersion} and profile version {o.scoredBy.profileVersion}.
            </p>
          )}

          <section className="panel" aria-labelledby="facts-heading">
            <header className="panel-head">
              <h3 id="facts-heading" className="eyebrow">
                Facts
              </h3>
              <div className="grow" />
              <span className="muted-small">Extracted by rules</span>
            </header>
            <div className="panel-body">
              {o.facts.length === 0 && <p className="muted-small">No facts were extracted.</p>}
              <ul className="plain-list fact-list">
                {o.facts.map((f) => {
                  const l = factLabel(f)
                  const ev = f.evidenceId ? evidenceById.get(f.evidenceId) : undefined
                  return (
                    <li key={f.key}>
                      <div className="fact-main">
                        <div className="muted-small">{f.label}</div>
                        <div className="fact-value">{f.value}</div>
                        {ev && (
                          <a className="small" href={`#${evidenceAnchor(ev.id)}`}>
                            Source: {ev.sourceLabel}
                          </a>
                        )}
                      </div>
                      <Badge tone={l.tone}>{l.text}</Badge>
                    </li>
                  )
                })}
              </ul>
            </div>
          </section>
          </>}
        </div>

        {details && (
        <section className="panel" aria-labelledby="contrib-heading">
          <header className="panel-head">
            <h3 id="contrib-heading" className="eyebrow">
              How the score was built
            </h3>
          </header>
          {o.breakdown.length === 0 ? (
            <p className="muted-small panel-note">No criteria were scored for this opportunity.</p>
          ) : (
            <div className="table-scroll" role="region" aria-labelledby="contrib-heading" tabIndex={0}>
              <table className="table table-compact">
                <caption className="sr-only">Points earned per criterion out of its weight. Unknown values score 0 and lower coverage.</caption>
                <thead>
                  <tr>
                    <th scope="col">Criterion</th>
                    <th scope="col">Verdict</th>
                    <th scope="col">Points</th>
                    <th scope="col">Why</th>
                  </tr>
                </thead>
                <tbody>
                  {o.breakdown.map((b) => {
                    const v = valueLabel(b.value)
                    return (
                      <tr key={b.criterion}>
                        <th scope="row" className="table-rowhead">
                          {b.label}
                        </th>
                        <td>
                          <Badge tone={v.tone}>{v.text}</Badge>
                        </td>
                        <td className="op-numeric nowrap">
                          {formatPoints(b.points, b.weight)}
                          <span className="meter-track meter-block">
                            <i style={{ width: `${b.weight ? Math.min(100, (b.points / b.weight) * 100) : 0}%` }} />
                          </span>
                        </td>
                        <td>
                          {b.excerpt ? <q className="fit-excerpt">{b.excerpt}</q> : <span className="muted-small">{b.reason}</span>}
                          {b.excerpt && <div className="muted-small">{b.reason}</div>}
                          <EvidenceRefs ids={b.evidenceIds} evidence={evidenceById} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <p className="muted-small panel-note">
                Total <strong>{Math.round(o.score)}</strong> of 100. Unknown scores zero. It is never rounded up to a pass.
              </p>
            </div>
          )}
          {o.description && (
            <details className="panel-note">
              <summary className="small">Show the text as retrieved</summary>
              <p className="excerpt">{o.description}</p>
            </details>
          )}
        </section>
        )}

        <div className="stack-4">
          {o.mode === 'Job' && <CoverNotePanel opportunityId={o.id} />}
          <div id="outreach" data-coach="opp-reach">
            <OutreachActionsPanel opportunityId={o.id} />
          </div>

          {details && <>
          <section className="panel" aria-labelledby="evidence-heading">
            <header className="panel-head">
              <h3 id="evidence-heading" className="eyebrow">
                Evidence — {o.evidence.length} {o.evidence.length === 1 ? 'source' : 'sources'}
              </h3>
            </header>
            <div className="panel-body evidence-panel">
              {o.evidence.length === 0 ? (
                <p className="muted-small">No evidence was stored for this opportunity, so nothing here is verified.</p>
              ) : (
                <ol className="plain-list evidence-list">
                  {o.evidence.map((e) => (
                    <EvidenceItem key={e.id} e={e} />
                  ))}
                </ol>
              )}
            </div>
          </section>

          <section className="panel" aria-labelledby="activity-heading">
            <header className="panel-head">
              <h3 id="activity-heading" className="eyebrow">
                Activity
              </h3>
            </header>
            <div className="panel-body">
              {o.activities.length === 0 ? (
                <p className="muted-small">No activity yet.</p>
              ) : (
                <ol className="plain-list activity-list">
                  {o.activities.map((a, i) => (
                    <li key={`${a.occurredAt}-${i}`}>
                      <div>{a.detail || a.kind}</div>
                      <div className="muted-small">
                        {a.kind} · <time dateTime={a.occurredAt}>{formatWhen(a.occurredAt)}</time>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              {showApply && applyHref && (
                <a className="btn btn-secondary auth-wide" href={applyHref} target="_blank" rel="noopener noreferrer">
                  ↗ Open application page
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              )}
              <form
                className="row wrap status-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  void setStatus(chosen)
                }}
              >
                <label htmlFor="status-select" className="small">
                  Set status
                </label>
                <select id="status-select" value={chosen} onChange={(e) => setChosen(e.target.value as OpportunityStatus)}>
                  {settableStatuses(o.status).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s].text}
                    </option>
                  ))}
                </select>
                <button type="submit" className="btn btn-secondary btn-sm" disabled={busy || chosen === o.status}>
                  {busy ? 'Saving…' : 'Update'}
                </button>
              </form>
              <p className="hint">Status changes are yours alone. Research never resets a status you set.</p>
            </div>
          </section>
          </>}
        </div>
      </div>
    </div>
  )
}

function EvidenceItem({ e }: { e: Evidence }) {
  const href = safeHref(e.url)
  return (
    <li id={evidenceAnchor(e.id)} tabIndex={-1} className="evidence">
      <div className="evidence-source">{e.sourceLabel}</div>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="small break">
          {displayUrl(href)}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      ) : (
        e.url && <div className="small muted-small break">{e.url}</div>
      )}
      {e.excerpt && <blockquote className="excerpt">{e.excerpt}</blockquote>}
      <div className="muted-small">
        Retrieved <time dateTime={e.retrievedAt}>{formatDate(e.retrievedAt)}</time> · {e.extractionMethod} extraction
      </div>
    </li>
  )
}

function EvidenceRefs({ ids, evidence }: { ids: string[]; evidence: Map<string, Evidence> }) {
  const found = ids.map((id) => evidence.get(id)).filter((e): e is Evidence => Boolean(e))
  if (!found.length) return null
  return (
    <div className="muted-small">
      Evidence:{' '}
      {found.map((e, i) => (
        <span key={e.id}>
          {i > 0 && ', '}
          <a href={`#${evidenceAnchor(e.id)}`}>{e.sourceLabel}</a>
        </span>
      ))}
    </div>
  )
}
