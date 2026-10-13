import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ROLE_LIST_ID, RoleList } from '../suggest/RoleList'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ErrorNotice } from '../../components/ErrorNotice'
import { PageHeader } from '../../components/PageHeader'
import { LoadingState } from '../../components/States'
import { api } from '../../lib/api'
import type { Campaign, Profile, ProfileSummary } from '../../lib/types'
import { useApi } from '../../lib/useApi'
import { splitTags } from '../profiles/profileFields'
import { useShell } from '../shell/ShellContext'
import {
  CADENCES, campaignPayload, firstRepeatAt, newDraft, parseBoardInput, quickSourceBodies, SEARCH_BOARDS, suggestedMode,
  type BoardKind, type SupportedMode,
} from './campaignModel'

type FeedChoice = 'Arbeitnow' | 'Jobicy' | 'WeWorkRemotely' | 'Remotive' | 'RemoteOk'
type SourceChoice = 'LinkedIn' | 'Indeed' | 'Seek' | 'Greenhouse' | 'Lever' | 'FreeFeeds' | FeedChoice

const SEARCHES: { value: SourceChoice; label: string }[] = SEARCH_BOARDS.map((b) => ({ value: b.value as SourceChoice, label: `${b.label} job search` }))
/** The free public feeds: no key, no quota. Candidates only (a feed lists jobs, and a Sales campaign needs the hiring company). */
const FEEDS: { value: FeedChoice; label: string }[] = [
  { value: 'Arbeitnow', label: 'Arbeitnow (Germany, Europe, remote)' },
  { value: 'Jobicy', label: 'Jobicy (remote)' },
  { value: 'WeWorkRemotely', label: 'We Work Remotely' },
  { value: 'Remotive', label: 'Remotive (remote)' },
  { value: 'RemoteOk', label: 'Remote OK' },
]
const ALL_FREE: { value: SourceChoice; label: string }[] = [{ value: 'FreeFeeds', label: 'All free sites at once (no key needed)' }]
const SITE_NAMES: Record<string, string> = { Seek: 'SEEK', FreeFeeds: 'free sites', WeWorkRemotely: 'We Work Remotely', RemoteOk: 'Remote OK' }
/** Candidates can also read one company's own board; Sales cannot. */
const BOARDS: { value: SourceChoice; label: string }[] = [
  { value: 'Greenhouse', label: 'One company\'s Greenhouse board' },
  { value: 'Lever', label: 'One company\'s Lever board' },
]

/** What you said you want after the search ("apply" or "send"); the Review screen shows it once as a hint, then forgets it. */
function rememberNext(next: string | null) {
  try { if (next === 'apply' || next === 'send') sessionStorage.setItem('op.then', next); else sessionStorage.removeItem('op.then') } catch { /* the hint is optional */ }
}

/**
 * The simple way to start: what to find, where, and one source — then Create & run. Everything else (weights, hard filters,
 * thresholds, other sources) lives in the full builder, one click away under Advanced.
 */
export function QuickCampaign() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { workspace } = useShell()
  const profiles = useApi<ProfileSummary[]>('/api/v1/profiles')
  const [profileId, setProfileId] = useState(params.get('profile') ?? '')
  const [query, setQuery] = useState(params.get('keywords') ?? '')
  const [place, setPlace] = useState(params.get('location') ?? '')
  const choices = workspace === 'sales' ? SEARCHES : [...ALL_FREE, ...SEARCHES, ...FEEDS, ...BOARDS]
  const preferred = choices.find((c) => c.value === params.get('board'))?.value
  const [source, setSource] = useState<SourceChoice>(preferred ?? (workspace === 'sales' ? 'LinkedIn' : 'FreeFeeds'))
  const [token, setToken] = useState('')
  const [repeat, setRepeat] = useState(() => (CADENCES.some((c) => c.minutes === Number(params.get('repeat'))) ? Number(params.get('repeat')) : 0))
  const autoStarted = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Error>()

  const wantsCandidate = workspace !== 'sales'
  const usable = (profiles.data ?? []).filter((p) => (p.type === 'Candidate') === wantsCandidate)
  const chosen = usable.find((p) => p.id === profileId) ?? usable[0]
  const mode: SupportedMode = suggestedMode(chosen?.type)
  // Skills the person confirmed on their profile rank the results; without them every job would score 0.
  const full = useApi<Profile>(chosen ? `/api/v1/profiles/${chosen.id}` : null)
  const skills = full.data && full.data.data.confirmations?.skills ? splitTags(full.data.data.fields?.skills).slice(0, 15) : []
  const board = source === 'Greenhouse' || source === 'Lever' ? parseBoardInput(source as BoardKind, token) : null
  const boardError = board && 'error' in board ? board.error : null
  const problems = [
    !chosen && 'Create a profile first.',
    source !== 'Greenhouse' && source !== 'Lever' && !query.trim() && 'Enter a role or skill to search for.',
    boardError,
  ].filter(Boolean) as string[]
  const fullPath = `/campaigns/new?full=1${query ? `&keywords=${encodeURIComponent(query)}` : ''}${place ? `&location=${encodeURIComponent(place)}` : ''}`

  // Started from the command bar: everything is filled in and was confirmed there, so run once the profile is known.
  const wantsAuto = params.get('auto') === '1'
  useEffect(() => {
    if (!wantsAuto || autoStarted.current || !chosen || problems.length > 0 || busy) return
    autoStarted.current = true
    void submit()
    // One-shot start; submit reads the current form state.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsAuto, chosen, problems.length, busy])

  async function submit(event?: FormEvent) {
    event?.preventDefault()
    if (problems.length || !chosen || busy) return
    setBusy(true); setError(undefined)
    try {
      const draft = newDraft()
      const keywords = query.trim() ? [query.trim().slice(0, 200)] : []
      const siteName = SITE_NAMES[source] ?? source
      draft.name = (query.trim() || (source === 'Greenhouse' || source === 'Lever' ? `${source} board` : 'Search')).slice(0, 80) + ` — ${siteName}`
      draft.goal = keywords.length ? `Find ${keywords[0]}${place.trim() ? ` in ${place.trim()}` : ''}.` : ''
      draft.criteria = { ...draft.criteria, keywords, preferredSkills: mode === 'Job' ? skills : [], locations: place.trim() ? [place.trim().slice(0, 100)] : [] }
      // Suggest anything reasonable for approval so the first run has something to approve.
      draft.autoSuggestMinScore = mode === 'Job' ? 40 : null
      const campaign = await api<Campaign>('/api/v1/campaigns', { method: 'POST', body: JSON.stringify({ profileId: chosen.id, mode, ...campaignPayload(draft, mode) }) })
      const sourceBodies = quickSourceBodies(source, (board && 'token' in board ? board.token : undefined) ?? token.trim())
      try {
        await Promise.all(sourceBodies.map((body) => api(`/api/v1/campaigns/${campaign.id}/sources`, { method: 'POST', body: JSON.stringify(body) })))
      } catch (e) {
        // The campaign exists; let the person fix the source in the full builder instead of losing it.
        navigate(`/campaigns/${campaign.id}/edit?step=3`, { replace: true })
        throw e
      }
      const { jobId } = await api<{ jobId: string }>(`/api/v1/campaigns/${campaign.id}/research`, { method: 'POST' })
      rememberNext(params.get('then'))
      if (repeat > 0) {
        // This run already started; the schedule begins one interval later. A failure here must not lose the run.
        await api(`/api/v1/campaigns/${campaign.id}/schedule`, { method: 'PUT', body: JSON.stringify({ timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', cadenceMinutes: repeat, nextRunAt: firstRepeatAt(repeat), paused: false, expectedVersion: null }) }).catch(() => undefined)
      }
      navigate(`/research/${jobId}`)
    } catch (e) {
      setError(e as Error)
      setBusy(false)
    }
  }

  return <div className="page stack-4">
    <RoleList />
    <PageHeader title="New campaign" subtitle={wantsCandidate ? 'Tell it what to look for. It reads the jobs, scores them, and suggests the best for your approval.' : 'Tell it who to look for. It reads who is hiring, scores them, and suggests the best leads.'} />
    {profiles.error && <ErrorNotice error={profiles.error} onRetry={profiles.reload} what="your profiles" />}
    {profiles.loading && !profiles.data && <LoadingState label="Loading…" waking={profiles.waking} rows={2} />}
    {profiles.data && <form className="card stack-4" onSubmit={(e) => void submit(e)} aria-label="New campaign">
      {usable.length === 0
        ? <p className="notice notice-warning">A campaign needs a profile that says what you offer. <Link to="/profiles/new">Create your profile</Link>, then come back — it takes about a minute.</p>
        : usable.length > 1 && <label className="field"><span>Profile</span><select value={chosen?.id} onChange={(e) => setProfileId(e.target.value)}>{usable.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
      <div className="search-bar" data-coach="quick-role">
        <label className="search-field search-field-main"><span className="sr-only">Role or skill</span>
          <input list={ROLE_LIST_ID} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={wantsCandidate ? 'Role or skill, e.g. .NET developer' : 'What they hire for, e.g. React developer'} /></label>
        <label className="search-field"><span className="sr-only">Location</span>
          <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Location (optional)" /></label>
      </div>
      <label className="field" data-coach="quick-source"><span>Where to look</span>
        <select value={source} onChange={(e) => setSource(e.target.value as SourceChoice)}>
          {wantsCandidate && <optgroup label="Free sites">{[...ALL_FREE, ...FEEDS].map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</optgroup>}
          <optgroup label="Job search sites">{SEARCHES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</optgroup>
          {wantsCandidate && <optgroup label="One company">{BOARDS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</optgroup>}
        </select></label>
      <label className="field"><span>Repeat</span>
        <select value={repeat} onChange={(e) => setRepeat(Number(e.target.value))}>
          <option value={0}>Run once</option>
          {CADENCES.map((c) => <option key={c.minutes} value={c.minutes}>{c.label}</option>)}
        </select></label>
      {(source === 'Greenhouse' || source === 'Lever') && <label className="field"><span>{source === 'Greenhouse' ? 'Board name or link' : 'Company name or link'}</span>
        <input value={token} onChange={(e) => setToken(e.target.value)} placeholder={source === 'Greenhouse' ? 'e.g. stripe' : 'e.g. leverdemo'} /></label>}
      {mode === 'Job' && skills.length > 0 && <p className="muted-small">Results are ranked by your skills: {skills.join(', ')}.</p>}
      {error && <ErrorNotice error={error} what="creating the campaign" />}
      <div className="row wrap">
        <button className="btn btn-primary" type="submit" data-coach="quick-run" disabled={busy || problems.length > 0}>{busy ? 'Starting…' : 'Create & run'}</button>
        <Link className="btn btn-ghost btn-sm" to={fullPath}>Advanced: weights, filters, more sources</Link>
        <span className="muted-small grow">{problems[0] ?? 'Nothing is applied or sent: you approve what it suggests.'}</span>
      </div>
    </form>}
  </div>
}
