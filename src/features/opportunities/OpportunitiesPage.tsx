import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ErrorNotice } from '../../components/ErrorNotice'
import { Badge } from '../../components/StatusBadge'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState, FilteredEmpty, LoadingState } from '../../components/States'
import { api, apiDownload } from '../../lib/api'
import { exportFilename, saveBlob } from '../../lib/download'
import type {
  CampaignSummary,
  FilterOutcome,
  OpportunityDetail,
  OpportunityPage,
  OpportunityStatus,
  OpportunitySummary,
} from '../../lib/types'
import { useApi } from '../../lib/useApi'
import { formatWhen } from '../applications/applicationStatus'
import { MODE_LABELS } from '../campaigns/campaignModel'
import { ApprovalQueuePage } from '../approvals/ApprovalQueuePage'
import { useShell } from '../shell/ShellContext'
import {
  appendUnique,
  canMoveTo,
  DEFAULT_FILTERS,
  formatCoverage,
  opportunitiesPath,
  type OpportunityFilters,
  OUTCOME_LABELS,
  platformLabel,
  primaryAction,
  searchLoaded,
  selectionCsv,
  STATUS_LABELS,
  STATUSES,
} from './opportunityModel'

/**
 * /opportunities (campaign chosen with ?campaign=, defaulting to the newest) and /campaigns/:id/opportunities.
 * Opportunities belong to a campaign in the API, so the list is always one campaign's.
 */
function OpportunityList({ tabs }: Readonly<{ tabs: ReactNode }>) {
  const { id: routeId } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const campaigns = useApi<CampaignSummary[]>('/api/v1/campaigns')
  const list = campaigns.data ?? []
  const campaignId = routeId ?? params.get('campaign') ?? list[0]?.id
  const campaign = list.find((c) => c.id === campaignId)

  const choose = (id: string) =>
    routeId ? navigate(`/campaigns/${id}/opportunities`) : setParams({ campaign: id }, { replace: true })

  return (
    <div className="page page-wide stack-4">
      <PageHeader
        title="Opportunities"
        subtitle="Everything your campaigns found, best fit first. Fit is a ranking out of 100, not a chance of success."
      />
      {tabs}

      {campaigns.error && <ErrorNotice error={campaigns.error} onRetry={campaigns.reload} />}
      {campaigns.loading && !campaigns.data && <LoadingState label="Loading campaigns…" waking={campaigns.waking} rows={3} />}

      {campaigns.data && list.length === 0 && (
        <EmptyState
          icon="☰"
          title="No opportunities yet"
          actions={
            <>
              <Link className="btn btn-primary btn-sm" to="/campaigns/new">
                Build a campaign
              </Link>
              <Link className="btn btn-secondary btn-sm" to="/">
                Try a sample run
              </Link>
            </>
          }
        >
          Nothing has been researched. A campaign needs one source and one criterion to produce its first result.
        </EmptyState>
      )}

      {campaigns.data && list.length > 0 && (
        <>
          <div className="toolbar">
            <label className="pill-select pill-select-wide" htmlFor="opp-campaign">
              <span>Campaign</span>
              <select id="opp-campaign" value={campaignId ?? ''} onChange={(e) => choose(e.target.value)}>
                {!campaign && campaignId && <option value={campaignId}>Unknown campaign</option>}
                {list.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {MODE_LABELS[c.mode] ?? c.mode}
                  </option>
                ))}
              </select>
            </label>
            {campaign?.lastJob && (
              <Link to={`/research/${campaign.lastJob.id}`} className="small">
                Latest run
              </Link>
            )}
          </div>
          {campaignId && <CampaignOpportunities key={campaignId} campaignId={campaignId} campaign={campaign} />}
        </>
      )}
    </div>
  )
}

function CampaignOpportunities({ campaignId, campaign }: { campaignId: string; campaign: CampaignSummary | undefined }) {
  const [filters, setFilters] = useState<OpportunityFilters>(DEFAULT_FILTERS)
  const [refreshes, setRefreshes] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<Error>()
  const [search, setSearch] = useState('')

  async function exportCsv() {
    setExporting(true)
    setExportError(undefined)
    try {
      const { blob, disposition } = await apiDownload(`/api/v1/campaigns/${encodeURIComponent(campaignId)}/export`, 'text/csv')
      saveBlob(blob, exportFilename(campaign?.name ?? 'campaign', disposition))
    } catch (e) {
      setExportError(e as Error)
    } finally {
      setExporting(false)
    }
  }

  return (
    <section className="stack-3" aria-labelledby="opp-heading">
      <div className="toolbar">
        <h3 id="opp-heading" className="sr-only">
          {campaign ? campaign.name : 'Campaign'}
        </h3>
        <label className="pill-select">
          <span>Outcome</span>
          <select value={filters.outcome} onChange={(e) => setFilters((f) => ({ ...f, outcome: e.target.value as FilterOutcome | '' }))}>
            <option value="">Any</option>
            {(Object.keys(OUTCOME_LABELS) as FilterOutcome[]).map((o) => (
              <option key={o} value={o}>
                {OUTCOME_LABELS[o].text}
              </option>
            ))}
          </select>
        </label>
        <label className="pill-select">
          <span>Status</span>
          <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as OpportunityStatus | '' }))}>
            <option value="">Any</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s].text}
              </option>
            ))}
          </select>
        </label>
        <label className="pill-select">
          <span>Sort</span>
          <select value={filters.sort} onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value as OpportunityFilters['sort'] }))}>
            <option value="score">Fit, high to low</option>
            <option value="recent">Recently updated</option>
          </select>
        </label>
        <div className="grow" />
        <input
          className="toolbar-search"
          type="search"
          value={search}
          placeholder="Search title, company or place"
          aria-label="Search the loaded opportunities by title, company or place"
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRefreshes((n) => n + 1)}>
          Refresh
        </button>
        <button type="button" className="btn btn-secondary btn-sm" disabled={exporting} onClick={() => void exportCsv()}>
          {exporting ? 'Exporting…' : '⇩ Export CSV'}
        </button>
      </div>
      {exportError && <ErrorNotice error={exportError} />}

      {/* Keyed so a filter change or refresh starts again from the first page. */}
      <OpportunityTable
        key={`${filters.outcome}|${filters.status}|${filters.sort}|${refreshes}`}
        campaignId={campaignId}
        campaignName={campaign?.name ?? 'campaign'}
        filters={filters}
        search={search}
        onClearFilters={() => setFilters((f) => ({ ...f, outcome: '', status: '' }))}
      />
    </section>
  )
}

function OpportunityTable({
  campaignId,
  campaignName,
  filters,
  search,
  onClearFilters,
}: {
  campaignId: string
  campaignName: string
  filters: OpportunityFilters
  search: string
  onClearFilters: () => void
}) {
  const first = useApi<OpportunityPage>(opportunitiesPath(campaignId, filters, 0))
  const [more, setMore] = useState<OpportunitySummary[]>([])
  const [fetchedMore, setFetchedMore] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState<Error>()
  // Rows changed from this table, so an update shows without refetching every page.
  const [patched, setPatched] = useState<Record<string, OpportunitySummary>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [actionError, setActionError] = useState<Error>()
  const [announcement, setAnnouncement] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const { refreshOverview } = useShell()

  if (first.error && !first.data) return <ErrorNotice error={first.error} onRetry={first.reload} what="the opportunities" />
  if (!first.data) return <LoadingState label="Loading opportunities…" waking={first.waking} rows={6} />

  const loaded = appendUnique(first.data.items, more).map((o) => patched[o.id] ?? o)
  const items = searchLoaded(loaded, search)
  const total = first.data.total
  const firstCount = first.data.items.length
  const filtered = Boolean(filters.outcome || filters.status)
  const chosen = loaded.filter((o) => selected.has(o.id))
  const allShown = items.length > 0 && items.every((o) => selected.has(o.id))
  const counts = {
    qualified: loaded.filter((o) => o.outcome === 'Qualified').length,
    suggested: loaded.filter((o) => o.status === 'Suggested').length,
    excluded: loaded.filter((o) => o.outcome === 'Excluded').length,
  }

  async function loadMore() {
    setLoadingMore(true)
    setMoreError(undefined)
    try {
      const page = await api<OpportunityPage>(opportunitiesPath(campaignId, filters, firstCount + fetchedMore))
      setMore((m) => appendUnique(m, page.items))
      setFetchedMore((n) => n + page.items.length)
    } catch (e) {
      setMoreError(e as Error)
    } finally {
      setLoadingMore(false)
    }
  }

  async function setStatus(o: OpportunitySummary, status: OpportunityStatus): Promise<boolean> {
    setBusy(o.id)
    setActionError(undefined)
    try {
      const updated = await api<OpportunityDetail>(`/api/v1/opportunities/${o.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      setPatched((p) => ({ ...p, [o.id]: { ...o, status: updated.status, updatedAt: updated.updatedAt } }))
      // The nav's approval count changes when a suggestion is approved or rejected here.
      if (o.status === 'Suggested' || updated.status === 'Suggested') refreshOverview()
      setAnnouncement(`${o.title} is now ${STATUS_LABELS[updated.status]?.text ?? updated.status}.`)
      return true
    } catch (e) {
      setActionError(e as Error)
      return false
    } finally {
      setBusy(null)
    }
  }

  /** Shortlist or dismiss the selection one row at a time; rows that cannot move are skipped and counted. */
  async function bulk(to: OpportunityStatus) {
    let moved = 0
    let skipped = 0
    for (const o of chosen) {
      if (!canMoveTo(o.status, to)) {
        skipped++
        continue
      }
      if (await setStatus(o, to)) moved++
    }
    setSelected(new Set())
    setAnnouncement(`${moved} moved to ${STATUS_LABELS[to]?.text ?? to}${skipped ? `; ${skipped} skipped because their status does not allow it` : ''}.`)
  }

  function exportSelection() {
    saveBlob(new Blob([selectionCsv(chosen)], { type: 'text/csv' }), `${campaignName.replace(/[^\w-]+/g, '-')}-selection.csv`)
  }

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (loaded.length === 0) {
    return filtered ? (
      <FilteredEmpty onClear={onClearFilters}>
        {[filters.outcome && `Outcome “${filters.outcome}”`, filters.status && `status “${STATUS_LABELS[filters.status]?.text ?? filters.status}”`].filter(Boolean).join(' and ')}{' '}
        together match none of the opportunities in this campaign.
      </FilteredEmpty>
    ) : (
      <EmptyState
        title="No opportunities in this campaign yet"
        actions={
          <Link className="btn btn-secondary btn-sm" to={`/campaigns/${campaignId}/edit?step=4`}>
            Review and run
          </Link>
        }
      >
        They are written by research runs. Check the campaign has sources, then queue a run from its review step.
      </EmptyState>
    )
  }

  return (
    <div className="stack-3">
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
      {actionError && <ErrorNotice error={actionError} />}
      {chosen.length > 0 && (
        <div className="selection-bar">
          <strong>{chosen.length} selected</strong>
          <button type="button" className="btn btn-secondary btn-sm" disabled={busy !== null} onClick={() => void bulk('Shortlisted')}>
            Shortlist
          </button>
          <button type="button" className="btn btn-secondary btn-sm" disabled={busy !== null} onClick={() => void bulk('Dismissed')}>
            Dismiss
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={exportSelection}>
            Export selection
          </button>
          <div className="grow" />
          <span className="muted-small">There is no bulk send or bulk apply. Approval happens in Approvals, one batch, with the reasons visible.</span>
        </div>
      )}
      <section className="panel">
        <header className="panel-head">
          <h4 className="eyebrow">{total} opportunities</h4>
          <div className="grow" />
          <span className="muted-small">
            {counts.qualified} qualified · {counts.suggested} suggested · {counts.excluded} excluded{loaded.length < total ? ' (of those loaded)' : ''}
          </span>
        </header>
        {search && (
          <p className="muted-small panel-note">
            Searching the {loaded.length} loaded {loaded.length === 1 ? 'row' : 'rows'}: {items.length} match “{search.trim()}”.
          </p>
        )}
        <div className="table-scroll" role="region" aria-labelledby="opp-heading" tabIndex={0}>
          <table className="table opp-table">
            <caption className="sr-only">
              Opportunities sorted by {filters.sort === 'score' ? 'fit score' : 'most recently updated'}. Showing {items.length} of {total}.
            </caption>
            <thead>
              <tr>
                <th scope="col" className="col-check">
                  <input
                    type="checkbox"
                    aria-label="Select all shown"
                    checked={allShown}
                    onChange={() => setSelected(allShown ? new Set() : new Set(items.map((o) => o.id)))}
                  />
                </th>
                <th scope="col">Opportunity</th>
                <th scope="col">Mode</th>
                <th scope="col" aria-sort={filters.sort === 'score' ? 'descending' : undefined}>
                  Fit
                </th>
                <th scope="col">Evidence</th>
                <th scope="col">Outcome</th>
                <th scope="col">Status</th>
                <th scope="col" aria-sort={filters.sort === 'recent' ? 'descending' : undefined}>
                  Updated
                </th>
                <th scope="col">
                  <span className="sr-only">Next step</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((o) => {
                const outcome = OUTCOME_LABELS[o.outcome] ?? { text: o.outcome, tone: 'neutral' }
                const status = STATUS_LABELS[o.status] ?? { text: o.status, tone: 'neutral' }
                const next = primaryAction(o)
                const excluded = o.outcome === 'Excluded'
                return (
                  <tr key={o.id} className={selected.has(o.id) ? 'is-selected' : ''}>
                    <td className="col-check">
                      <input type="checkbox" aria-label={`Select ${o.title}`} checked={selected.has(o.id)} onChange={() => toggle(o.id)} />
                    </td>
                    <td className="table-role">
                      <Link to={`/opportunities/${o.id}`}>{o.title}</Link>
                      <div className="muted-small">{[o.organization, o.location].filter(Boolean).join(' · ')}</div>
                      {o.outcomeReason && excluded && <div className="muted-small clamp-2">{o.outcomeReason}</div>}
                    </td>
                    <td>
                      <Badge tone={o.mode === 'Job' ? 'success' : 'primary'}>{MODE_LABELS[o.mode] ?? o.mode}</Badge>
                      {platformLabel(o.platform) && <div className="muted-small">{platformLabel(o.platform)}</div>}
                    </td>
                    <td className="nowrap">
                      {excluded ? (
                        <span className="muted">—</span>
                      ) : (
                        <span className="meter">
                          <strong className="op-numeric">{Math.round(o.score)}</strong>
                          <span className="meter-track">
                            <i style={{ width: `${Math.min(100, Math.max(0, o.score))}%` }} />
                          </span>
                        </span>
                      )}
                    </td>
                    <td className="nowrap">
                      <span className="meter" title={formatCoverage(o.coverage)}>
                        <span className={`meter-track meter-small ${o.coverage < 70 ? 'meter-amber' : ''}`}>
                          <i style={{ width: `${Math.min(100, Math.max(0, o.coverage))}%` }} />
                        </span>
                        <span className="muted-small op-numeric">{Math.round(o.coverage)}%</span>
                      </span>
                      {o.gapsCount > 0 && <div className="muted-small">{o.gapsCount} not verified</div>}
                    </td>
                    <td>
                      <Badge tone={outcome.tone}>{outcome.text}</Badge>
                    </td>
                    <td>
                      <Badge tone={status.tone}>{status.text}</Badge>
                    </td>
                    <td className="table-when muted-small">
                      <time dateTime={o.updatedAt}>{formatWhen(o.updatedAt)}</time>
                    </td>
                    <td className="nowrap">
                      {next.to ? (
                        <button type="button" className="btn-link" disabled={busy === o.id} onClick={() => void setStatus(o, next.to!)}>
                          {next.label}
                          <span className="sr-only"> {o.title}</span>
                        </button>
                      ) : next.label === 'Draft outreach' ? (
                        <Link to={`/opportunities/${o.id}#outreach`}>
                          Draft outreach<span className="sr-only"> for {o.organization}</span>
                        </Link>
                      ) : next.label === 'Open posting' && (o.applyUrl || o.url) ? (
                        <a href={(o.applyUrl ?? o.url)!} target="_blank" rel="noreferrer">
                          Open posting
                          <span className="sr-only"> for {o.title} (opens in a new tab)</span>
                        </a>
                      ) : (
                        <Link to={`/opportunities/${o.id}`}>
                          Review<span className="sr-only"> {o.title}</span>
                        </Link>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <footer className="panel-foot">
          <span className="muted-small" aria-live="polite">
            Showing {items.length} of {total} · sorted and paged by the server
          </span>
          <div className="grow" />
          {loaded.length < total && (
            <button type="button" className="btn btn-secondary btn-sm" disabled={loadingMore} onClick={() => void loadMore()}>
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          )}
        </footer>
      </section>
      {moreError && <ErrorNotice error={moreError} onRetry={() => void loadMore()} />}
    </div>
  )
}

/** Opportunities, with the approval queue as its second view (one place instead of two pages). */
export function OpportunitiesPage() {
  const [params, setParams] = useSearchParams()
  const awaiting = useShell().awaitingApproval ?? 0
  const view = params.get('view') === 'approvals' ? 'approvals' : 'all'
  const tabs = (
    <div className="segmented" role="group" aria-label="View">
      <button type="button" className={view === 'all' ? 'active' : ''} aria-pressed={view === 'all'} onClick={() => setParams({}, { replace: true })}>All</button>
      <button type="button" className={view === 'approvals' ? 'active' : ''} aria-pressed={view === 'approvals'} onClick={() => setParams({ view: 'approvals' }, { replace: true })}>
        Waiting for approval{awaiting > 0 ? ` · ${awaiting}` : ''}
      </button>
    </div>
  )
  if (view === 'approvals') {
    return (
      <div className="page page-wide stack-4">
        <PageHeader title="Opportunities" subtitle="Approve the jobs worth your time in one click, or reject the rest." />
        {tabs}
        <ApprovalQueuePage embedded />
      </div>
    )
  }
  return <OpportunityList tabs={tabs} />
}
