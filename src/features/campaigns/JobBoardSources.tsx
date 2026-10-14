import { useState, type FormEvent } from 'react'
import { ErrorNotice } from '../../components/ErrorNotice'
import { Badge, StatusBadge } from '../../components/StatusBadge'
import { api, ApiError } from '../../lib/api'
import type { Campaign, Source } from '../../lib/types'
import { useShell } from '../shell/ShellContext'
import {
  jobSearchTerms,
  SEARCH_BOARDS,
  type SearchBoard,
  BOARD_EXAMPLES,
  type BoardKind,
  fieldError,
  JOB_SOURCE_CAPABILITY,
  type JobSourceKind,
  parseBoardInput,
} from './campaignModel'

/** Capability status for an open job source, read from /api/v1/capabilities — never assumed. */
function SourceCapability({ kind }: { kind: JobSourceKind }) {
  const { capabilities } = useShell()
  const cap = capabilities?.items.find((c) => c.key === JOB_SOURCE_CAPABILITY[kind])
  return (
    <div className="stack-1">
      <div className="row wrap">
        <span className="small">Server status:</span>
        {cap ? <StatusBadge status={cap.status} /> : <Badge>Status unknown</Badge>}
      </div>
      {cap?.detail && cap.status !== 'Ready' && <p className="hint">{cap.detail}</p>}
      {!cap && (
        <p className="hint">
          {capabilities
            ? 'This server does not report this source, so it may not support it yet.'
            : 'Server capabilities have not loaded, so its status is not known.'}
        </p>
      )}
    </div>
  )
}

/** Per-company public job-board slug — typed, or derived from a pasted careers link. */
export function BoardForm({ campaign, kind, onAdded }: { campaign: Campaign; kind: BoardKind; onAdded: () => void }) {
  const [input, setInput] = useState('')
  const [label, setLabel] = useState('')
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Error>()
  const id = kind.toLowerCase()
  const parsed = parseBoardInput(kind, input)
  const example = BOARD_EXAMPLES[kind]
  const what = kind === 'Greenhouse' ? 'Board token' : 'Company slug'

  async function submit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (!parsed.token) return
    setBusy(true)
    setError(undefined)
    try {
      await api<Source>(`/api/v1/campaigns/${campaign.id}/sources`, {
        method: 'POST',
        body: JSON.stringify({ kind, url: parsed.token, label: label.trim() || undefined }),
      })
      setInput('')
      setLabel('')
      setTouched(false)
      onAdded()
    } catch (err) {
      setError(err as Error)
    } finally {
      setBusy(false)
    }
  }

  const fe = error instanceof ApiError ? error.fieldErrors : undefined
  const serverError = fieldError(fe, 'url')
  const localError = touched || input.trim() ? parsed.error : undefined
  const shownError = serverError ?? localError
  const describedBy = [`${id}-board-hint`, shownError ? `${id}-board-error` : ''].filter(Boolean).join(' ')

  return (
    <form className="stack-3" onSubmit={(e) => void submit(e)} noValidate>
      <SourceCapability kind={kind} />
      <div className="field">
        <label htmlFor={`${id}-board`}>{what} or board link</label>
        <input
          id={`${id}-board`}
          value={input}
          maxLength={1000}
          autoComplete="off"
          spellCheck={false}
          placeholder={`e.g. ${example.token}`}
          aria-describedby={describedBy}
          aria-invalid={shownError ? true : undefined}
          onChange={(e) => {
            setInput(e.target.value)
            setError(undefined)
          }}
          onBlur={() => setTouched(true)}
        />
        <p id={`${id}-board-hint`} className="hint">
          The company identifier in its careers address — for <code>{example.url}</code> it is <code>{example.token}</code>.
          You can paste the whole link. Jobs are read through {kind}&rsquo;s public
          job-board API: no login, no scraping. One company per source.
        </p>
        {parsed.token && input.trim() !== parsed.token && (
          <p className="muted-small" aria-live="polite">
            {what}: <code>{parsed.token}</code>
          </p>
        )}
        {shownError && (
          <p id={`${id}-board-error`} className="field-error">
            {shownError}
          </p>
        )}
      </div>
      <div className="field">
        <label htmlFor={`${id}-label`}>Label (optional)</label>
        <input id={`${id}-label`} value={label} maxLength={200} onChange={(e) => setLabel(e.target.value)} />
      </div>
      {error && !serverError && <ErrorNotice error={error} />}
      <div className="row wrap">
        <button type="submit" className="btn btn-primary" disabled={busy || !parsed.token}>
          {busy ? 'Adding…' : `Add ${kind} board`}
        </button>
        {!parsed.token && <span className="muted-small">Enter a valid {what.toLowerCase()} or board link first.</span>}
      </div>
    </form>
  )
}

export function JobSearchForm({ campaign, onAdded, initialBoard }: { campaign: Campaign; onAdded: (label: string) => void; initialBoard?: SearchBoard }) {
  const { capabilities } = useShell()
  const [board, setBoard] = useState<SearchBoard>(initialBoard ?? 'Indeed')
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Error>()
  const job = campaign.mode === 'Job'
  const search = jobSearchTerms(campaign.criteria, campaign.mode)
  const name = board === 'Seek' ? 'SEEK' : board
  const notConfigured = capabilities?.items.find((c) => c.key === JOB_SOURCE_CAPABILITY.JobSearch)?.status === 'NotConfigured'

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(undefined)
    try {
      await api<Source>(`/api/v1/campaigns/${campaign.id}/sources`, {
        method: 'POST',
        body: JSON.stringify({ kind: 'JobSearch', url: board, label: label.trim() || undefined }),
      })
      setLabel('')
      onAdded(`${name} search`)
    } catch (err) {
      setError(err as Error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="stack-3" onSubmit={(e) => void submit(e)}>
      <SourceCapability kind="JobSearch" />
      {notConfigured && (
        <p className="notice notice-warning">
          Live job board postings are not set up on this server (its JSearch key is missing). You can add the source, but
          every run will report it as failed until the key is set.
        </p>
      )}
      <div className="field">
        <label htmlFor="job-search-board">Board</label>
        <select id="job-search-board" value={board} onChange={(e) => setBoard(e.target.value as SearchBoard)}>
          {SEARCH_BOARDS.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </select>
      </div>
      <p className="small muted-small">
        {job ? `Live ${name} postings for this campaign's job titles, scored like any other job.` : `Companies hiring on ${name} for your keywords; each becomes a scored lead.`}
      </p>
      <dl className="criteria-list">
        <div>
          <dt>Will search for</dt>
          <dd>
            {search.terms.length ? search.terms.join(', ') : <span className="text-warning">Nothing yet</span>}
          </dd>
        </div>
        <div>
          <dt>Location</dt>
          <dd>{search.location ?? (search.remoteOnly ? 'Remote only' : <span className="muted-small">Any (no location set)</span>)}</dd>
        </div>
      </dl>
      {search.terms.length === 0 && (
        <p className="notice notice-warning">
          Add {job ? 'job titles or search phrases' : 'keywords or buying signals'} in step 2 (Filters) and save — without
          them the search has nothing to look for.
        </p>
      )}
      <div className="field">
        <label htmlFor="job-search-label">Label (optional)</label>
        <input id="job-search-label" value={label} maxLength={200} onChange={(e) => setLabel(e.target.value)} />
      </div>
      {error && <ErrorNotice error={error} />}
      <div>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Adding…' : `Add ${name} search`}
        </button>
      </div>
    </form>
  )
}
