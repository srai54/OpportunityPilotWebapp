import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ErrorNotice } from '../../components/ErrorNotice'
import { Badge } from '../../components/StatusBadge'
import { HowItWorks } from '../../components/HowItWorks'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState, LoadingState } from '../../components/States'
import { api } from '../../lib/api'
import type { ApprovalItem, ApprovalPage, CampaignSummary, DecideRequest, DecideResult } from '../../lib/types'
import { useApi } from '../../lib/useApi'
import { BulkBar, CardList, LeadCard } from '../../components/cards'
import { leadChips } from '../../components/cardModel'
import { platformLabel, STATUS_LABELS } from '../opportunities/opportunityModel'
import { useShell } from '../shell/ShellContext'
import {
  addResults,
  appendUniqueItems,
  approvalsPath,
  decideBatches,
  decidePayload,
  EMPTY_RESULT,
  groupByCampaign,
  pruneSelection,
  resultSummary,
  selectAll,
  selectAllState,
  selectNone,
  toggleSelected,
} from './approvalModel'

interface Outcome {
  result: DecideResult
  error?: Error
}

/** /approvals — research's suggestions (status Suggested), approved or rejected in one batch. */
export function ApprovalQueuePage({ embedded = false }: Readonly<{ embedded?: boolean }>) {
  const [params, setParams] = useSearchParams()
  const campaignId = params.get('campaign') ?? ''
  const campaigns = useApi<CampaignSummary[]>('/api/v1/campaigns')
  const jobCampaigns = (campaigns.data ?? []).filter((c) => c.mode === 'Job')
  const campaign = jobCampaigns.find((c) => c.id === campaignId)
  const { refreshOverview, workspace } = useShell()
  const [outcome, setOutcome] = useState<Outcome>()
  const [reloads, setReloads] = useState(0)

  const choose = (id: string) => {
    setOutcome(undefined)
    setParams(id ? { campaign: id } : {}, { replace: true })
  }

  const decided = (o: Outcome) => {
    setOutcome(o)
    setReloads((n) => n + 1)
    refreshOverview()
  }

  return (
    <div className={embedded ? 'stack-4' : 'page page-wide stack-4'}>
      {!embedded && <PageHeader
        title="Approvals"
        subtitle="Jobs that scored at or above your campaign's threshold. Approve to shortlist, reject to dismiss."
      />}
      <HowItWorks summary="What happens after you approve">
        <p><strong>LinkedIn, Naukri and Instahyre jobs:</strong> your agent applies for them on its next run (it has to be running on your
          computer: <code>npm run agent -- watch</code>). <strong>Jobs from other sites</strong> (Indeed and the free sites) cannot be applied for
          by a program, so they wait in <em>Apply to approved</em>: one tap per job opens the posting and records it.</p>
        <p>Do not want to review each one? When you start a campaign, choose <em>More options → Approve matches scoring 70+ automatically</em>.
          Skip hides a job; you can restore it from the full list.</p>
      </HowItWorks>

      {campaigns.error && <ErrorNotice error={campaigns.error} onRetry={campaigns.reload} />}

      <div className="toolbar">
        <label className="pill-select pill-select-wide" htmlFor="approvals-campaign">
          <span>Campaign</span>
          <select id="approvals-campaign" value={campaignId} onChange={(e) => choose(e.target.value)}>
            <option value="">All campaigns</option>
            {campaignId && campaigns.data && !campaign && <option value={campaignId}>Unknown campaign</option>}
            {jobCampaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div role="status" aria-live="polite" className="stack-2">
        {outcome && (
          <p className={`notice ${outcome.error ? 'notice-warning' : 'notice-neutral'}`}>
            <span>
              {resultSummary(outcome.result)}.
              {outcome.result.skipped > 0 &&
                ' Skipped jobs were no longer awaiting approval (decided elsewhere) or are not in your account.'}
              {outcome.error && ' The request did not finish — the list below shows what the server has now.'}
            </span>
            {!outcome.error && outcome.result.approved > 0 && (
              <Link className="btn btn-primary btn-sm" to="/opportunities?status=Shortlisted">
                {workspace === 'sales' ? 'Next: reach out to them' : 'Next: apply or reach out'}
              </Link>
            )}
          </p>
        )}
      </div>
      {outcome?.error && <ErrorNotice error={outcome.error} />}

      <Queue
        key={`${campaignId}|${reloads}`}
        campaignId={campaignId || null}
        campaign={campaign}
        jobCampaigns={campaigns.data ? jobCampaigns : undefined}
        onDecided={decided}
      />
    </div>
  )
}

function Queue({
  campaignId,
  campaign,
  jobCampaigns,
  onDecided,
}: {
  campaignId: string | null
  campaign: CampaignSummary | undefined
  jobCampaigns: CampaignSummary[] | undefined
  onDecided: (o: Outcome) => void
}) {
  const first = useApi<ApprovalPage>(approvalsPath(campaignId, 0))
  const [more, setMore] = useState<ApprovalItem[]>([])
  const [fetchedMore, setFetchedMore] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState<Error>()
  const [selected, setSelected] = useState<Set<string>>(selectNone)
  const [busy, setBusy] = useState(false)
  const allRef = useRef<HTMLInputElement>(null)
  const { advanced } = useShell()

  const items = first.data ? appendUniqueItems(first.data.items, more) : []
  const visibleSelection = pruneSelection(selected, items)
  const allState = selectAllState(items, visibleSelection)

  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = allState === 'some'
  }, [allState])

  if (first.error && !first.data) return <ErrorNotice error={first.error} onRetry={first.reload} />
  if (!first.data) return <LoadingState label="Loading suggestions…" waking={first.waking} />

  const total = first.data.total
  const count = visibleSelection.size

  async function loadMore() {
    setLoadingMore(true)
    setMoreError(undefined)
    try {
      const page = await api<ApprovalPage>(approvalsPath(campaignId, (first.data?.items.length ?? 0) + fetchedMore))
      setMore((m) => appendUniqueItems(m, page.items))
      setFetchedMore((n) => n + page.items.length)
    } catch (e) {
      setMoreError(e as Error)
    } finally {
      setLoadingMore(false)
    }
  }

  async function decide(payload: DecideRequest) {
    if (busy) return
    setBusy(true)
    let result = EMPTY_RESULT
    let error: Error | undefined
    // The API takes at most 200 ids per request; larger batches are sent in turn and the counts added up.
    for (const batch of decideBatches(payload)) {
      try {
        result = addResults(
          result,
          await api<DecideResult>('/api/v1/approvals/decide', { method: 'POST', body: JSON.stringify(batch) }),
        )
      } catch (e) {
        error = e as Error
        break
      }
    }
    setBusy(false)
    onDecided({ result, error })
  }

  function approveAll() {
    const notLoaded = total - items.length
    const message =
      `Approve all ${total} suggested ${total === 1 ? 'job' : 'jobs'}${notLoaded > 0 ? `, including ${notLoaded} not loaded on this page` : ''}?\n\n` +
      `They are marked approved. You open each application page yourself and apply there. Nothing is applied right now.`
    if (!window.confirm(message)) return
    setBusy(true)
    void api<DecideResult>('/api/v1/approvals/decide-all', { method: 'POST', body: JSON.stringify({ approve: true, campaignId: campaignId || null }) })
      .then((result) => onDecided({ result, error: undefined }))
      .catch((error: Error) => onDecided({ result: EMPTY_RESULT, error }))
      .finally(() => setBusy(false))
  }

  if (items.length === 0) return <EmptyQueue campaignId={campaignId} campaign={campaign} jobCampaigns={jobCampaigns} />

  return (
    <section className="stack-4" aria-labelledby="approvals-heading">
      <h3 id="approvals-heading" className="sr-only">
        Suggested jobs
      </h3>
      {!advanced ? (
        <>
          <div className="row wrap">
            <label className="check bulk-check">
              <input ref={allRef} type="checkbox" checked={allState === 'all'} disabled={busy} onChange={(e) => setSelected(e.target.checked ? selectAll(items) : selectNone())} />
              Select all {items.length} shown
            </label>
            <span className="grow" />
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={approveAll}>Approve all {total}</button>
          </div>
          {groupByCampaign(items).map((g) => (
            <section key={g.campaignId} className="stack-3" aria-labelledby={`group-${g.campaignId}`}>
              <h4 id={`group-${g.campaignId}`} className="eyebrow">{g.campaignName} · {g.items.length} suggested</h4>
              <CardList label={`Suggested jobs from ${g.campaignName}`}>
                {g.items.map((item, i) => (
                  <LeadCard
                    key={item.opportunityId}
                    id={item.opportunityId}
                    title={item.title}
                    organization={item.organization}
                    location={item.location}
                    to={`/opportunities/${item.opportunityId}`}
                    score={item.score}
                    status={STATUS_LABELS.Suggested ?? { text: 'Suggested', tone: 'primary' }}
                    chips={leadChips({ location: item.location, platformLabel: platformLabel(item.platform) })}
                    note={item.outcomeReason}
                    selected={visibleSelection.has(item.opportunityId)}
                    onSelect={(on) => setSelected((cur) => toggleSelected(cur, item.opportunityId, on))}
                    coach={i === 0 && g === groupByCampaign(items)[0] ? 'opps-action' : undefined}
                    action={
                      <span className="row">
                        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void decide(decidePayload([item.opportunityId], []))}>Approve<span className="sr-only"> {item.title}</span></button>
                        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void decide(decidePayload([], [item.opportunityId]))}>Skip<span className="sr-only"> {item.title}</span></button>
                      </span>
                    }
                  />
                ))}
              </CardList>
            </section>
          ))}
          <BulkBar count={count} noun={{ one: 'job', many: 'jobs' }} onClear={() => setSelected(selectNone())}>
            <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void decide(decidePayload(visibleSelection, []))}>{busy ? 'Working…' : 'Approve'}</button>
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void decide(decidePayload([], visibleSelection))}>Skip</button>
          </BulkBar>
        </>
      ) : (
        <>
      <div className="selection-bar bulk-bar">
        <label className="check bulk-check">
          <input
            ref={allRef}
            type="checkbox"
            checked={allState === 'all'}
            disabled={busy}
            onChange={(e) => setSelected(e.target.checked ? selectAll(items) : selectNone())}
          />
          Select all {items.length} shown
        </label>
        <span className="muted-small op-numeric">
          {count} selected · {total} awaiting
        </span>
        <div className="grow" />
        <div className="row wrap bulk-actions">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={busy || count === 0}
            aria-describedby={count === 0 ? 'bulk-why' : undefined}
            onClick={() => void decide(decidePayload(visibleSelection, []))}
          >
            {busy ? 'Working…' : `✓ Approve selected${count ? ` · ${count}` : ''}`}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={busy || count === 0}
            aria-describedby={count === 0 ? 'bulk-why' : undefined}
            onClick={() => void decide(decidePayload([], visibleSelection))}
          >
            Reject selected
          </button>
          <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={approveAll}>
            Approve all {total}
          </button>
        </div>
        {count === 0 && (
          <p id="bulk-why" className="hint bulk-hint">
            Select at least one job to approve or reject it. &ldquo;Approve all&rdquo; asks you to confirm first.
          </p>
        )}
      </div>

      {groupByCampaign(items).map((g) => {
        const threshold = jobCampaigns?.find((c) => c.id === g.campaignId)?.autoSuggestMinScore
        return (
          <section key={g.campaignId} className="panel" aria-labelledby={`group-${g.campaignId}`}>
            <header className="panel-head">
              <h4 id={`group-${g.campaignId}`} className="eyebrow">
                {g.campaignName} · {g.items.length} suggested
              </h4>
              <div className="grow" />
              {typeof threshold === 'number' && <span className="muted-small">Threshold {threshold}</span>}
              <Link to={`/campaigns/${g.campaignId}/edit?step=2`} className="small">
                Suggestion settings<span className="sr-only"> for {g.campaignName}</span>
              </Link>
            </header>
            <div className="table-scroll" role="region" aria-labelledby={`group-${g.campaignId}`} tabIndex={0}>
              <table className="table opp-table">
                <thead>
                  <tr>
                    <th scope="col" className="col-check">
                      <span className="sr-only">Select</span>
                    </th>
                    <th scope="col">Job</th>
                    <th scope="col">Platform</th>
                    <th scope="col">Match</th>
                    <th scope="col">Evidence</th>
                    <th scope="col">Why it was suggested</th>
                    <th scope="col">Applies via</th>
                  </tr>
                </thead>
                <tbody>
                  {g.items.map((item) => (
                    <ApprovalRow
                      key={item.opportunityId}
                      item={item}
                      checked={visibleSelection.has(item.opportunityId)}
                      disabled={busy}
                      onToggle={(on) => setSelected((s) => toggleSelected(s, item.opportunityId, on))}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}

        </>
      )}

      {moreError && <ErrorNotice error={moreError} onRetry={() => void loadMore()} />}
      <div className="row wrap">
        <p className="muted-small">
          Showing {items.length} of {total} · highest fit score first
        </p>
        <div className="grow" />
        {items.length < total && (
          <button type="button" className="btn btn-secondary btn-sm" disabled={loadingMore || busy} onClick={() => void loadMore()}>
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        )}
      </div>
    </section>
  )
}

function ApprovalRow({
  item,
  checked,
  disabled,
  onToggle,
}: {
  item: ApprovalItem
  checked: boolean
  disabled: boolean
  onToggle: (on: boolean) => void
}) {
  const platform = platformLabel(item.platform)
  return (
    <tr className={checked ? 'is-selected' : ''}>
      <td className="col-check">
        <input type="checkbox" checked={checked} disabled={disabled} aria-label={`Select ${item.title}`} onChange={(e) => onToggle(e.target.checked)} />
      </td>
      <td className="table-role">
        <Link to={`/opportunities/${item.opportunityId}`}>{item.title}</Link>
        <div className="muted-small break">{[item.organization, item.location].filter(Boolean).join(' · ') || 'Organisation not stated'}</div>
      </td>
      <td>{platform ? <Badge>{platform}</Badge> : <span className="muted-small">—</span>}</td>
      <td className="nowrap">
        <span className="meter">
          <strong className="op-numeric">{Math.round(item.score)}</strong>
          <span className="meter-track">
            <i style={{ width: `${Math.min(100, Math.max(0, item.score))}%` }} />
          </span>
        </span>
      </td>
      <td className="nowrap">
        <span className="meter">
          <span className={`meter-track meter-small ${item.coverage < 70 ? 'meter-amber' : ''}`}>
            <i style={{ width: `${Math.min(100, Math.max(0, item.coverage))}%` }} />
          </span>
          <span className="muted-small op-numeric">{Math.round(item.coverage)}%</span>
        </span>
      </td>
      <td className="muted-small break">{item.outcomeReason ?? 'Qualified and at or above the threshold.'}</td>
      <td>
        <span className="badge">You apply</span>
      </td>
    </tr>
  )
}

function EmptyQueue({
  campaignId,
  campaign,
  jobCampaigns,
}: {
  campaignId: string | null
  campaign: CampaignSummary | undefined
  jobCampaigns: CampaignSummary[] | undefined
}) {
  if (campaignId) {
    const threshold = campaign?.autoSuggestMinScore
    return (
      <EmptyState
        title="Nothing from this campaign is waiting for approval"
        actions={
          <Link className="btn btn-secondary btn-sm" to={`/campaigns/${campaignId}/edit?step=2`}>
            Open its Filters step
          </Link>
        }
      >
        <p>
          {threshold === null
            ? 'Suggestions are off for this campaign. Turn on “Suggest jobs for approval” in its Filters step; after the next research run, qualified jobs at or above your threshold wait here.'
            : typeof threshold === 'number'
              ? `This campaign suggests qualified jobs scoring at least ${threshold}. None are waiting — queue a research run, or lower the threshold in its Filters step.`
              : 'Suggestions appear after a research run when “Suggest jobs for approval” is on in the campaign’s Filters step.'}
        </p>
      </EmptyState>
    )
  }
  const withSuggestions = jobCampaigns?.filter((c) => typeof c.autoSuggestMinScore === 'number').length
  return (
    <EmptyState
      title="Nothing is waiting for approval"
      actions={
        <Link className="btn btn-secondary btn-sm" to="/campaigns">
          Open campaigns
        </Link>
      }
    >
      <p>
        Suggestions appear here after a research run, when a Job campaign has &ldquo;Suggest jobs for approval&rdquo;
        turned on in its Filters step: qualified jobs scoring at least the threshold you set wait here, and nothing is
        applied until you approve.
        {withSuggestions === 0 && ' None of your Job campaigns has it turned on yet.'}
      </p>
    </EmptyState>
  )
}
