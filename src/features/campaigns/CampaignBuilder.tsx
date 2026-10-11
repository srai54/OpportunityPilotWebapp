import { useEffect, useMemo, useRef, useState } from 'react'
import { useBlocker, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ErrorNotice } from '../../components/ErrorNotice'
import { Badge } from '../../components/StatusBadge'
import { PageHeader } from '../../components/PageHeader'
import { LoadingState } from '../../components/States'
import { api, ApiError } from '../../lib/api'
import type { Campaign, ProfileSummary } from '../../lib/types'
import { useApi } from '../../lib/useApi'
import { QuickCampaign } from './QuickCampaign'
import { formatWhen } from '../applications/applicationStatus'
import {
  campaignPayload,
  type CampaignDraft,
  draftFromCampaign,
  draftProblems,
  MODE_LABELS,
  newDraft,
  SEARCH_BOARDS,
  type SearchBoard,
  type SupportedMode,
  suggestedMode,
} from './campaignModel'
import { FiltersStep } from './FiltersStep'
import { GoalStep } from './GoalStep'
import { ReviewStep } from './ReviewStep'
import { SourcesStep } from './SourcesStep'

const STEPS = ['Goal and mode', 'Filters', 'Sources', 'Review and run'] as const

/** /campaigns/new and /campaigns/:id/edit. Steps live in ?step= so a refresh or a shared link keeps its place. */
export function CampaignBuilder() {
  const { id } = useParams()
  const [params] = useSearchParams()
  if (id) return <ExistingCampaign key={id} id={id} />
  // New campaigns start on the one-screen form; the full four-step builder is its Advanced mode (?full=1).
  return params.get('full') === '1' ? <Builder key="new" /> : <QuickCampaign key="quick" />
}

function ExistingCampaign({ id }: { id: string }) {
  const campaign = useApi<Campaign>(`/api/v1/campaigns/${encodeURIComponent(id)}`)
  if (campaign.error && !campaign.data)
    return (
      <div className="page">
        <ErrorNotice error={campaign.error} onRetry={campaign.reload} />
      </div>
    )
  if (!campaign.data) return <div className="page"><LoadingState label="Loading campaign…" waking={campaign.waking} rows={5} /></div>
  // Keyed by version: reloading after a conflict replaces the draft with the latest saved copy.
  return <Builder key={campaign.data.version} existing={campaign.data} onReload={campaign.reload} />
}

function Builder({ existing, onReload }: { existing?: Campaign; onReload?: () => void }) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const profiles = useApi<ProfileSummary[]>('/api/v1/profiles')

  const [saved, setSaved] = useState<Campaign | undefined>(existing)
  // A campaign started from a job-board search keeps that board for the source step (step changes reset the address).
  const [preferBoard] = useState<SearchBoard | undefined>(() => SEARCH_BOARDS.find((b) => b.value === params.get('board'))?.value)
  const [draft, setDraft] = useState<CampaignDraft>(() => (existing ? draftFromCampaign(existing) : draftFromSearch(newDraft(), params)))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<Error>()
  const [justSaved, setJustSaved] = useState(false)
  // Set synchronously on save so the redirect after creating is not treated as leaving unsaved work.
  const savedRef = useRef(false)

  const profileId = draft.profileId || profiles.data?.[0]?.id || ''
  const profile = profiles.data?.find((p) => p.id === profileId)
  const mode: SupportedMode = draft.mode ?? suggestedMode(profile?.type)

  const baseline = useMemo(
    () => JSON.stringify(campaignPayload(saved ? draftFromCampaign(saved) : newDraft(), mode)),
    [saved, mode],
  )
  // changed: edits that would be lost. needsSave: also true for a new campaign that has never been saved.
  const changed = JSON.stringify(campaignPayload(draft, mode)) !== baseline
  const needsSave = !saved || changed
  const problems = draftProblems(draft, profileId, mode)

  const requested = Number(params.get('step')) || 1
  const step = Math.min(Math.max(requested, 1), saved ? 4 : 2)

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      changed && !savedRef.current && currentLocation.pathname !== nextLocation.pathname,
  )
  useEffect(() => {
    if (blocker.state === 'blocked') {
      if (window.confirm('This campaign has unsaved changes. Leave without saving?')) blocker.proceed()
      else blocker.reset()
    }
  }, [blocker])
  useEffect(() => {
    if (!changed) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [changed])

  // Move focus to the new step's heading so keyboard and screen-reader users land on it.
  const headingRef = useRef<HTMLHeadingElement>(null)
  // Not on first load — except right after creating, when the clicked button has gone with the old page.
  const location = useLocation()
  const skipFocus = useRef(!(location.state as { focusStep?: boolean } | null)?.focusStep)
  useEffect(() => {
    if (skipFocus.current) {
      skipFocus.current = false
      return
    }
    headingRef.current?.focus()
  }, [step])

  const goTo = (n: number) => {
    setError(undefined)
    setParams(n === 1 ? {} : { step: String(n) })
  }

  async function save(thenStep?: number): Promise<boolean> {
    if (problems.length) return false
    setSaving(true)
    setError(undefined)
    try {
      const body = campaignPayload(draft, mode)
      if (!saved) {
        const created = await api<Campaign>('/api/v1/campaigns', {
          method: 'POST',
          body: JSON.stringify({ profileId, mode, ...body }),
        })
        savedRef.current = true
        // Stay on the current step unless asked to move on; the new URL would otherwise reset to step 1.
        const target = thenStep ?? step
        navigate(`/campaigns/${created.id}/edit${target > 1 ? `?step=${target}` : ''}`, {
          replace: true,
          state: { focusStep: true },
        })
        return true
      }
      const updated = await api<Campaign>(`/api/v1/campaigns/${saved.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...body, expectedVersion: saved.version }),
      })
      setSaved(updated)
      // The server normalises weights to 100; show what it stored.
      setDraft(draftFromCampaign(updated))
      setJustSaved(true)
      if (thenStep) goTo(thenStep)
      return true
    } catch (e) {
      setError(e as Error)
      return false
    } finally {
      setSaving(false)
    }
  }

  const fieldErrors = error instanceof ApiError ? error.fieldErrors : undefined
  const conflict = error instanceof ApiError && error.status === 409

  return (
    <div className="page page-wide stack-4 builder">
      <PageHeader
        title={saved ? saved.name : 'New campaign'}
        badges={saved && <Badge>{MODE_LABELS[saved.mode]}</Badge>}
        meta={
          saved ? (
            <>
              Version {saved.version} · saved <time dateTime={saved.updatedAt}>{formatWhen(saved.updatedAt)}</time>
              {changed ? ' · Unsaved changes' : justSaved ? ' · Saved' : ''}
            </>
          ) : (
            'Draft · not saved yet'
          )
        }
      />

      <nav aria-label="Campaign steps">
        <ol className="plain-list stepper">
          {STEPS.map((title, i) => {
            const n = i + 1
            const locked = !saved && n > 2
            return (
              <li key={title}>
                <button
                  type="button"
                  className={`stepper-item ${n === step ? 'stepper-current' : ''} ${n < step ? 'stepper-done' : ''}`}
                  aria-current={n === step ? 'step' : undefined}
                  disabled={locked}
                  onClick={() => goTo(n)}
                >
                  <span className="stepper-num" aria-hidden="true">
                    {n < step ? '✓' : n}
                  </span>
                  <span className="stepper-text">
                    <span className="stepper-kicker">Step {n}</span>
                    <span className="stepper-title">{title}</span>
                    {locked && <span className="sr-only"> (save the campaign first)</span>}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      {error && (
        <div className="stack-2">
          <ErrorNotice
            error={
              conflict
                ? new Error(
                    'This campaign was saved somewhere else (another tab or device) after you opened it. Your edits are still here — copy anything you need, then load the latest version.',
                  )
                : error
            }
          />
          {conflict && onReload && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={onReload}>
              Load the latest version (discards your edits)
            </button>
          )}
        </div>
      )}

      <section className="builder-stage" aria-labelledby="builder-step-heading">
        <h3 id="builder-step-heading" ref={headingRef} tabIndex={-1} className="sr-only builder-heading">
          Step {step} · {STEPS[step - 1]}
        </h3>
        {step === 1 && (
          <GoalStep
            draft={draft}
            setDraft={setDraft}
            profiles={profiles}
            profileId={profileId}
            mode={mode}
            locked={Boolean(saved)}
            fieldErrors={fieldErrors}
            onEditCriteria={() => goTo(2)}
          />
        )}
        {step === 2 && <FiltersStep draft={draft} setDraft={setDraft} mode={mode} fieldErrors={fieldErrors} />}
        {step === 3 && saved && <SourcesStep campaign={saved} preferBoard={preferBoard} />}
        {step === 4 && saved && (
          <ReviewStep campaign={saved} draft={draft} mode={mode} profile={profile} profileLoading={!profiles.data} dirty={changed} onEdit={goTo} />
        )}
      </section>

      <div className="builder-footer save-bar">
        {step > 1 && (
          <button type="button" className="btn btn-secondary" onClick={() => goTo(step - 1)}>
            Back
          </button>
        )}
        <p className="muted-small grow">
          Saving is not running. A run is queued only on step 4.
          {problems.length > 0 && needsSave && <span> To save: {problems.join(' ')}</span>}
        </p>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={saving || !needsSave || problems.length > 0}
          onClick={() => void save()}
        >
          {saving ? 'Saving…' : saved ? `Save version ${saved.version + 1}` : 'Save campaign'}
        </button>
        {step === 1 && (
          <button type="button" className="btn btn-primary" onClick={() => goTo(2)}>
            Continue
          </button>
        )}
        {step === 2 && (
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving || (needsSave && problems.length > 0)}
            onClick={() => (needsSave ? void save(3) : goTo(3))}
          >
            {needsSave ? 'Save and continue' : 'Continue'}
          </button>
        )}
        {step === 3 && (
          <button type="button" className="btn btn-primary" onClick={() => goTo(4)}>
            Continue
          </button>
        )}
      </div>
    </div>
  )
}

/** Pre-fills a new campaign from a job-board search (?mode=&keywords=&location=&name=). Unknown values are ignored. */
function draftFromSearch(draft: CampaignDraft, params: URLSearchParams): CampaignDraft {
  const mode = params.get('mode')
  const keywords = params.get('keywords')?.trim().slice(0, 200)
  const location = params.get('location')?.trim().slice(0, 100)
  const name = params.get('name')?.trim().slice(0, 120)
  if (!keywords && !location && !mode) return draft
  return {
    ...draft,
    mode: mode === 'Job' || mode === 'Customer' ? mode : draft.mode,
    name: name || draft.name,
    goal: keywords ? `Find ${keywords}${location ? ` in ${location}` : ''}.` : draft.goal,
    criteria: { ...draft.criteria, keywords: keywords ? [keywords] : draft.criteria.keywords, locations: location ? [location] : draft.criteria.locations },
  }
}
