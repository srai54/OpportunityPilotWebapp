import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ErrorNotice } from '../../components/ErrorNotice'
import { PageHeader } from '../../components/PageHeader'
import { LoadingState } from '../../components/States'
import { api } from '../../lib/api'
import type { Campaign, ProfileSummary } from '../../lib/types'
import { useApi } from '../../lib/useApi'
import { useShell } from '../shell/ShellContext'
import {
  campaignPayload, newDraft, parseBoardInput, SEARCH_BOARDS, suggestedMode,
  type BoardKind, type SupportedMode,
} from './campaignModel'

type SourceChoice = 'LinkedIn' | 'Indeed' | 'Seek' | 'Greenhouse' | 'Lever'

const CHOICES: { value: SourceChoice; label: string }[] = [
  ...SEARCH_BOARDS.map((b) => ({ value: b.value as SourceChoice, label: `${b.label} job search` })),
  { value: 'Greenhouse', label: 'One company\'s Greenhouse board' },
  { value: 'Lever', label: 'One company\'s Lever board' },
]

/**
 * The simple way to start: what to find, where, and one source — then Create & run. Everything else (weights, hard filters,
 * thresholds, other sources) lives in the full builder, one click away under Advanced.
 */
export function QuickCampaign() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { workspace } = useShell()
  const profiles = useApi<ProfileSummary[]>('/api/v1/profiles')
  const [profileId, setProfileId] = useState('')
  const [query, setQuery] = useState(params.get('keywords') ?? '')
  const [place, setPlace] = useState(params.get('location') ?? '')
  const preferred = CHOICES.find((c) => c.value === params.get('board'))?.value
  const [source, setSource] = useState<SourceChoice>(preferred ?? 'LinkedIn')
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Error>()

  const wantsCandidate = workspace !== 'sales'
  const usable = (profiles.data ?? []).filter((p) => (p.type === 'Candidate') === wantsCandidate)
  const chosen = usable.find((p) => p.id === profileId) ?? usable[0]
  const mode: SupportedMode = suggestedMode(chosen?.type)
  const board = source === 'Greenhouse' || source === 'Lever' ? parseBoardInput(source as BoardKind, token) : null
  const boardError = board && 'error' in board ? board.error : null
  const problems = [
    !chosen && 'Create a profile first.',
    source !== 'Greenhouse' && source !== 'Lever' && !query.trim() && 'Enter a role or skill to search for.',
    boardError,
  ].filter(Boolean) as string[]
  const fullPath = `/campaigns/new?full=1${query ? `&keywords=${encodeURIComponent(query)}` : ''}${place ? `&location=${encodeURIComponent(place)}` : ''}`

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (problems.length || !chosen || busy) return
    setBusy(true); setError(undefined)
    try {
      const draft = newDraft()
      const keywords = query.trim() ? [query.trim().slice(0, 200)] : []
      draft.name = (query.trim() || (source === 'Greenhouse' || source === 'Lever' ? `${source} board` : 'Search')).slice(0, 80) + ` — ${source === 'Seek' ? 'SEEK' : source}`
      draft.goal = keywords.length ? `Find ${keywords[0]}${place.trim() ? ` in ${place.trim()}` : ''}.` : ''
      draft.criteria = { ...draft.criteria, keywords, locations: place.trim() ? [place.trim().slice(0, 100)] : [] }
      // Suggest anything reasonable for approval so the first run has something to approve.
      draft.autoSuggestMinScore = mode === 'Job' ? 40 : null
      const campaign = await api<Campaign>('/api/v1/campaigns', { method: 'POST', body: JSON.stringify({ profileId: chosen.id, mode, ...campaignPayload(draft, mode) }) })
      const sourceBody = source === 'Greenhouse' || source === 'Lever'
        ? { kind: source, url: board && 'token' in board ? board.token : token.trim() }
        : { kind: 'JobSearch', url: source }
      try {
        await api(`/api/v1/campaigns/${campaign.id}/sources`, { method: 'POST', body: JSON.stringify(sourceBody) })
      } catch (e) {
        // The campaign exists; let the person fix the source in the full builder instead of losing it.
        navigate(`/campaigns/${campaign.id}/edit?step=3`, { replace: true })
        throw e
      }
      const { jobId } = await api<{ jobId: string }>(`/api/v1/campaigns/${campaign.id}/research`, { method: 'POST' })
      navigate(`/research/${jobId}`)
    } catch (e) {
      setError(e as Error)
      setBusy(false)
    }
  }

  return <div className="page stack-4">
    <PageHeader title="New campaign" subtitle={wantsCandidate ? 'Tell it what to look for. It reads the jobs, scores them, and suggests the best for your approval.' : 'Tell it who to look for. It reads who is hiring, scores them, and suggests the best leads.'} />
    {profiles.error && <ErrorNotice error={profiles.error} onRetry={profiles.reload} what="your profiles" />}
    {profiles.loading && !profiles.data && <LoadingState label="Loading…" waking={profiles.waking} rows={2} />}
    {profiles.data && <form className="card stack-4" onSubmit={(e) => void submit(e)} aria-label="New campaign">
      {usable.length === 0
        ? <p className="notice notice-warning">A campaign needs a profile that says what you offer. <Link to="/profiles/new">Create your profile</Link>, then come back — it takes about a minute.</p>
        : usable.length > 1 && <label className="field"><span>Profile</span><select value={chosen?.id} onChange={(e) => setProfileId(e.target.value)}>{usable.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
      <div className="search-bar">
        <label className="search-field search-field-main"><span className="sr-only">Role or skill</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={wantsCandidate ? 'Role or skill, e.g. .NET developer' : 'What they hire for, e.g. React developer'} /></label>
        <label className="search-field"><span className="sr-only">Location</span>
          <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Location (optional)" /></label>
      </div>
      <label className="field"><span>Where to look</span>
        <select value={source} onChange={(e) => setSource(e.target.value as SourceChoice)}>{CHOICES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
      {(source === 'Greenhouse' || source === 'Lever') && <label className="field"><span>{source === 'Greenhouse' ? 'Board name or link' : 'Company name or link'}</span>
        <input value={token} onChange={(e) => setToken(e.target.value)} placeholder={source === 'Greenhouse' ? 'e.g. stripe' : 'e.g. leverdemo'} /></label>}
      {error && <ErrorNotice error={error} what="creating the campaign" />}
      <div className="row wrap">
        <button className="btn btn-primary" type="submit" disabled={busy || problems.length > 0}>{busy ? 'Starting…' : 'Create & run'}</button>
        <Link className="btn btn-ghost btn-sm" to={fullPath}>Advanced: weights, filters, more sources</Link>
        <span className="muted-small grow">{problems[0] ?? 'Nothing is applied or sent: you approve what it suggests.'}</span>
      </div>
    </form>}
  </div>
}
