import { useRef, useState, type FormEvent } from 'react'
import { ErrorNotice } from '../../components/ErrorNotice'
import { Badge } from '../../components/StatusBadge'
import { api, ApiError } from '../../lib/api'
import type { Campaign, ImportPreview, Source } from '../../lib/types'
import { useApi } from '../../lib/useApi'
import { formatWhen } from '../applications/applicationStatus'
import {
  CSV_COLUMNS,
  CSV_MAX_BYTES,
  fieldError,
  isSupportedMode,
  type JobSourceKind,
  PASTE_MAX_CHARS,
  SOURCE_KIND_LABELS,
  type SearchBoard,
  SOURCE_STATUS_LABELS,
  sourceKindAllowed,
} from './campaignModel'
import { BoardForm, JobSearchForm } from './JobBoardSources'

/** Sources the server reads afresh on every run; they have no items until a run has read them. */
const FETCHED_EACH_RUN = new Set<Source['kind']>(['Url', 'Feed', 'Greenhouse', 'Lever', 'Adzuna', 'Ashby', 'SmartRecruiters', 'Recruitee', 'Workable', 'Workday', 'JobSearch', 'Remotive', 'RemoteOk', 'Arbeitnow', 'Jobicy', 'WeWorkRemotely'])

function sourceContent(s: Source): string {
  if (s.kind === 'Paste') return `${s.textLength.toLocaleString()} characters`
  if (FETCHED_EACH_RUN.has(s.kind)) return s.itemCount ? `${s.itemCount} items` : 'Read on each run'
  return `${s.itemCount} ${s.itemCount === 1 ? 'row' : 'rows'}`
}

type AddKind = 'Paste' | 'Url' | 'Feed' | 'Csv' | 'FreeFeeds' | JobSourceKind

const ADD_OPTIONS: { kind: AddKind; label: string; description: string }[] = [
  { kind: 'Paste', label: 'Paste text', description: 'Postings or company notes you copied' },
  { kind: 'Url', label: 'Public URL', description: 'A careers page or listing, no login needed' },
  { kind: 'Csv', label: 'CSV file', description: 'A spreadsheet export, previewed first' },
  { kind: 'Greenhouse', label: 'Company careers board — Greenhouse', description: 'Every open job of one company on Greenhouse' },
  { kind: 'Lever', label: 'Company careers board — Lever', description: 'Every open job of one company on Lever' },
  { kind: 'FreeFeeds', label: 'Free job feeds — remote and Europe', description: 'Arbeitnow, Jobicy, We Work Remotely, Remotive, Remote OK: no key, no quota' },
  { kind: 'JobSearch', label: 'Job board search — Indeed, LinkedIn, SEEK', description: 'Live postings; in Sales, the companies that are hiring' },
]

export function SourcesStep({ campaign, preferBoard }: { campaign: Campaign; preferBoard?: SearchBoard }) {
  const sources = useApi<Source[]>(`/api/v1/campaigns/${campaign.id}/sources`)
  const [adding, setAdding] = useState<AddKind>(preferBoard ? 'JobSearch' : 'Paste')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<Error>()
  const [announcement, setAnnouncement] = useState('')

  const added = (what: string) => {
    sources.reload()
    setAnnouncement(`${what} added.`)
  }

  async function remove(s: Source) {
    if (!window.confirm(`Remove “${s.label}”? Opportunities already found from it are kept.`)) return
    setDeleting(s.id)
    setDeleteError(undefined)
    try {
      await api<void>(`/api/v1/campaigns/${campaign.id}/sources/${s.id}`, { method: 'DELETE' })
      sources.reload()
      setAnnouncement(`${s.label} removed.`)
    } catch (e) {
      setDeleteError(e as Error)
    } finally {
      setDeleting(null)
    }
  }

  const options = ADD_OPTIONS.filter((o) => (o.kind === 'FreeFeeds' ? campaign.mode === 'Job' : sourceKindAllowed(o.kind, campaign.mode)))
  const list = sources.data ?? []
  const ok = list.filter((s) => s.status === 'Ok').length
  const failed = list.filter((s) => s.status === 'Failed').length

  return (
    <div className="stack-6">
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>

      <section className="stack-3" aria-labelledby="sources-current">
        <div className="row wrap">
          <h4 id="sources-current" className="section-heading">
            Sources in this campaign
          </h4>
          <div className="grow" />
          {sources.data && (
            <span className="muted-small op-numeric">
              {list.length} {list.length === 1 ? 'source' : 'sources'} · {ok} fetched OK{failed ? ` · ${failed} failed` : ''}
            </span>
          )}
        </div>
        {sources.error && <ErrorNotice error={sources.error} onRetry={sources.reload} />}
        {deleteError && <ErrorNotice error={deleteError} />}
        {sources.loading && !sources.data && <p className="muted-small">Loading sources…</p>}
        {sources.data && list.length === 0 && (
          <p className="notice notice-neutral">
            No sources yet. A run reads only the sources you add here, so add at least one below.
          </p>
        )}
        {list.length > 0 && (
          <div className="card table-card">
            <div className="table-scroll" role="region" aria-labelledby="sources-current" tabIndex={0}>
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Source</th>
                    <th scope="col">Kind</th>
                    <th scope="col">Status</th>
                    <th scope="col">Content</th>
                    <th scope="col">Last fetched</th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((s) => {
                    const status = SOURCE_STATUS_LABELS[s.status] ?? { text: s.status, tone: 'neutral' }
                    return (
                      <tr key={s.id}>
                        <td className="table-role">
                          {s.label}
                          {s.url && <div className="muted-small break">{s.url}</div>}
                          {s.permissionNote && <div className="muted-small">Permission: {s.permissionNote}</div>}
                          {s.safeError && <div className="field-error">{s.safeError}</div>}
                        </td>
                        <td>
                          {SOURCE_KIND_LABELS[s.kind] ?? s.kind}
                          {s.platform && s.platform !== s.kind && <div className="muted-small">{s.platform}</div>}
                        </td>
                        <td>
                          <Badge tone={status.tone}>{status.text}</Badge>
                        </td>
                        <td className="op-numeric muted-small">
                          {sourceContent(s)}
                        </td>
                        <td className="table-when op-numeric">
                          {s.lastFetchedAt ? <time dateTime={s.lastFetchedAt}>{formatWhen(s.lastFetchedAt)}</time> : '—'}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={deleting === s.id}
                            onClick={() => void remove(s)}
                          >
                            {deleting === s.id ? 'Removing…' : 'Remove'}
                            <span className="sr-only"> {s.label}</span>
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section className="stack-3" aria-labelledby="sources-add">
        <h4 id="sources-add" className="section-heading">
          Add a source
        </h4>
        <fieldset className="field">
          <legend>Kind of source</legend>
          <div className="type-grid">
            {options.map((o) => (
              <label key={o.kind} className={`type-option ${adding === o.kind ? 'type-option-active' : ''}`}>
                <input
                  type="radio"
                  name="source-kind"
                  value={o.kind}
                  checked={adding === o.kind}
                  onChange={() => setAdding(o.kind)}
                />
                <span className="type-option-label">{o.label}</span>
                <span className="muted-small">{o.description}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="card-muted">
          {adding === 'Paste' && <PasteForm campaign={campaign} onAdded={() => added('Pasted text')} />}
          {adding === 'Url' && <UrlForm campaign={campaign} kind="Url" onAdded={() => added('URL')} />}
          {adding === 'Csv' && <CsvImport campaign={campaign} onAdded={() => added('CSV import')} />}
          {(adding === 'Greenhouse' || adding === 'Lever') && campaign.mode === 'Job' && (
            <BoardForm key={adding} campaign={campaign} kind={adding} onAdded={() => added(`${adding} board`)} />
          )}
          {adding === 'FreeFeeds' && campaign.mode === 'Job' && <FreeFeedsForm campaign={campaign} existing={list.map((x) => x.kind)} onAdded={(n) => added(`${n} free feed${n === 1 ? '' : 's'}`)} />}
          {adding === 'JobSearch' && <JobSearchForm campaign={campaign} initialBoard={preferBoard} onAdded={(label) => added(label)} />}
        </div>
      </section>
    </div>
  )
}

const FREE_FEEDS: { kind: 'Arbeitnow' | 'Jobicy' | 'WeWorkRemotely' | 'Remotive' | 'RemoteOk'; label: string; hint: string }[] = [
  { kind: 'Arbeitnow', label: 'Arbeitnow', hint: 'Germany, Europe and remote' },
  { kind: 'Jobicy', label: 'Jobicy', hint: 'Remote jobs, pay shown when given' },
  { kind: 'WeWorkRemotely', label: 'We Work Remotely', hint: 'Remote jobs in tech, sales, marketing and more' },
  { kind: 'Remotive', label: 'Remotive', hint: 'Remote jobs' },
  { kind: 'RemoteOk', label: 'Remote OK', hint: 'Remote jobs' },
]

/** The free public feeds, added in one go. Each is read on every run; none needs a key or uses a quota. */
function FreeFeedsForm({ campaign, existing, onAdded }: { campaign: Campaign; existing: string[]; onAdded: (count: number) => void }) {
  const [chosen, setChosen] = useState<string[]>(FREE_FEEDS.map((f) => f.kind).filter((k) => !existing.includes(k)))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Error>()
  async function add() {
    setBusy(true); setError(undefined)
    try {
      for (const kind of chosen) await api<Source>(`/api/v1/campaigns/${campaign.id}/sources`, { method: 'POST', body: JSON.stringify({ kind }) })
      onAdded(chosen.length); setChosen([])
    } catch (e) { setError(e as Error) } finally { setBusy(false) }
  }
  return (
    <div className="stack-3">
      <fieldset className="field">
        <legend>Which feeds</legend>
        {FREE_FEEDS.map((f) => (
          <label key={f.kind} className="check-row">
            <input type="checkbox" checked={chosen.includes(f.kind)} disabled={existing.includes(f.kind)} onChange={(e) => setChosen((c) => e.target.checked ? [...c, f.kind] : c.filter((x) => x !== f.kind))} />
            <span><strong>{f.label}</strong> <span className="muted-small">— {f.hint}{existing.includes(f.kind) ? ' (already added)' : ''}</span></span>
          </label>
        ))}
      </fieldset>
      {error && <ErrorNotice error={error} />}
      <div><button type="button" className="btn btn-primary" disabled={busy || chosen.length === 0} onClick={() => void add()}>{busy ? 'Adding…' : `Add ${chosen.length} ${chosen.length === 1 ? 'feed' : 'feeds'}`}</button></div>
    </div>
  )
}

function PasteForm({ campaign, onAdded }: { campaign: Campaign; onAdded: () => void }) {
  const [label, setLabel] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Error>()
  const job = campaign.mode === 'Job'

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(undefined)
    try {
      await api<Source>(`/api/v1/campaigns/${campaign.id}/sources`, {
        method: 'POST',
        body: JSON.stringify({ kind: 'Paste', label: label.trim() || undefined, text }),
      })
      setLabel('')
      setText('')
      onAdded()
    } catch (err) {
      setError(err as Error)
    } finally {
      setBusy(false)
    }
  }

  const fe = error instanceof ApiError ? error.fieldErrors : undefined
  return (
    <form className="stack-3" onSubmit={(e) => void submit(e)}>
      <div className="field">
        <label htmlFor="paste-label">Label (optional)</label>
        <input id="paste-label" value={label} maxLength={200} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Postings from a newsletter" />
      </div>
      <div className="field">
        <label htmlFor="paste-text">Text</label>
        <textarea
          id="paste-text"
          rows={10}
          value={text}
          maxLength={PASTE_MAX_CHARS}
          aria-describedby="paste-help"
          onChange={(e) => setText(e.target.value)}
          placeholder={
            job
              ? 'Senior .NET Developer\nCompany: Acme Logistics\nLocation: Pune\nURL: https://acme.example/jobs/42\nWe need C#, ASP.NET Core, Azure…\n---\nBackend Engineer\nCompany: …'
              : 'Acme Logistics\nWebsite: acme.example\nLocation: Hamburg, Germany\nWarehouse software, hiring .NET developers…\n---\nNext company…'
          }
        />
        <div id="paste-help" className="hint stack-2">
          <p>
            Put several {job ? 'postings' : 'companies'} in one paste by separating them with a line that contains only{' '}
            <code>---</code>.
          </p>
          <p>
            In each block the first line is the {job ? 'job title' : 'company name'}. Lines starting with{' '}
            <code>Company:</code>, <code>Location:</code>, <code>Website:</code> or <code>URL:</code> set those fields;
            everything else is read as the description.
          </p>
          <p className="op-numeric">
            {text.length.toLocaleString()} / {PASTE_MAX_CHARS.toLocaleString()} characters
          </p>
        </div>
        {fieldError(fe, 'text') && <p className="field-error">{fieldError(fe, 'text')}</p>}
      </div>
      {error && !fe && <ErrorNotice error={error} />}
      <div>
        <button type="submit" className="btn btn-primary" disabled={busy || !text.trim()}>
          {busy ? 'Adding…' : 'Add pasted text'}
        </button>
      </div>
    </form>
  )
}

function UrlForm({ campaign, kind, onAdded }: { campaign: Campaign; kind: 'Url' | 'Feed'; onAdded: () => void }) {
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const [permissionNote, setPermissionNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Error>()
  const feed = kind === 'Feed'
  const id = feed ? 'feed' : 'url'

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(undefined)
    try {
      await api<Source>(`/api/v1/campaigns/${campaign.id}/sources`, {
        method: 'POST',
        body: JSON.stringify({
          kind,
          label: label.trim() || undefined,
          url: url.trim(),
          permissionNote: permissionNote.trim() || undefined,
        }),
      })
      setLabel('')
      setUrl('')
      setPermissionNote('')
      onAdded()
    } catch (err) {
      setError(err as Error)
    } finally {
      setBusy(false)
    }
  }

  const fe = error instanceof ApiError ? error.fieldErrors : undefined
  const urlError = fieldError(fe, 'url')
  return (
    <form className="stack-3" onSubmit={(e) => void submit(e)}>
      <div className="field">
        <label htmlFor={`${id}-url`}>{feed ? 'Feed URL' : 'Page URL'}</label>
        <input
          id={`${id}-url`}
          type="url"
          inputMode="url"
          required
          maxLength={1000}
          value={url}
          placeholder={feed ? 'https://example.com/jobs.rss' : 'https://example.com/careers'}
          aria-describedby={`${id}-url-hint`}
          aria-invalid={urlError ? true : undefined}
          onChange={(e) => setUrl(e.target.value)}
        />
        <p id={`${id}-url-hint`} className="hint">
          {feed
            ? 'RSS 2.0 or Atom; up to 100 items are read per run.'
            : 'Public https pages only — nothing behind a login. Pages that load their content with scripts may yield too little text and are flagged for manual input.'}
        </p>
        {urlError && <p className="field-error">{urlError}</p>}
      </div>
      <div className="field">
        <label htmlFor={`${id}-label`}>Label (optional)</label>
        <input id={`${id}-label`} value={label} maxLength={200} onChange={(e) => setLabel(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor={`${id}-permission`}>{feed ? 'Permission note' : 'Permission note (optional)'}</label>
        <input
          id={`${id}-permission`}
          value={permissionNote}
          maxLength={500}
          aria-describedby={`${id}-permission-hint`}
          placeholder={feed ? 'e.g. Public feed offered by the site for this use' : 'e.g. Public careers page'}
          onChange={(e) => setPermissionNote(e.target.value)}
        />
        <p id={`${id}-permission-hint`} className="hint">
          Why you are allowed to read this. Kept with the source for your own record.
        </p>
      </div>
      {error && !urlError && <ErrorNotice error={error} />}
      <div>
        <button type="submit" className="btn btn-primary" disabled={busy || !url.trim()}>
          {busy ? 'Adding…' : feed ? 'Add feed' : 'Add URL'}
        </button>
      </div>
    </form>
  )
}

function CsvImport({ campaign, onAdded }: { campaign: Campaign; onAdded: () => void }) {
  const [fileName, setFileName] = useState('')
  const [label, setLabel] = useState('')
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [busy, setBusy] = useState<'reading' | 'committing' | null>(null)
  const [error, setError] = useState<Error>()
  const fileRef = useRef<HTMLInputElement>(null)
  const columns = isSupportedMode(campaign.mode) ? CSV_COLUMNS[campaign.mode] : CSV_COLUMNS.Job

  async function choose(file: File | undefined) {
    setPreview(null)
    setError(undefined)
    if (!file) return
    setFileName(file.name)
    setLabel((l) => l || file.name.replace(/\.csv$/i, ''))
    if (file.size > CSV_MAX_BYTES) {
      setError(new Error('That file is larger than 1 MB. Split it or remove columns you do not need.'))
      return
    }
    setBusy('reading')
    try {
      const csv = await file.text()
      setPreview(
        await api<ImportPreview>('/api/v1/imports/preview', {
          method: 'POST',
          body: JSON.stringify({ campaignId: campaign.id, csv }),
        }),
      )
    } catch (e) {
      setError(e as Error)
    } finally {
      setBusy(null)
    }
  }

  function reset() {
    setPreview(null)
    setFileName('')
    setLabel('')
    setError(undefined)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function commit() {
    if (!preview) return
    setBusy('committing')
    setError(undefined)
    try {
      await api<Source>(`/api/v1/imports/${preview.importId}/commit`, {
        method: 'POST',
        body: JSON.stringify({ label: label.trim() || undefined }),
      })
      reset()
      onAdded()
    } catch (e) {
      setError(e as Error)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="stack-3">
      <div className="field">
        <label htmlFor="csv-file">CSV file</label>
        <input
          ref={fileRef}
          id="csv-file"
          type="file"
          accept=".csv,text/csv"
          aria-describedby="csv-hint"
          onChange={(e) => void choose(e.target.files?.[0])}
        />
        <p id="csv-hint" className="hint">
          Needs a header row. Required columns: <code>{columns.required.join(', ')}</code>; optional:{' '}
          <code>{columns.optional.join(', ')}</code>. Up to 1 MB and 1,000 rows. Nothing is imported until
          you confirm the preview.
        </p>
      </div>

      <div aria-live="polite">{busy === 'reading' && <p className="muted-small">Reading {fileName}…</p>}</div>
      {error && <ErrorNotice error={error} />}

      {preview && (
        <div className="stack-3">
          <div className="row wrap">
            <h5 className="section-heading">Preview of {fileName}</h5>
            <Badge tone="success">{preview.validCount} valid</Badge>
            <Badge tone={preview.errorCount ? 'danger' : 'neutral'}>{preview.errorCount} with errors</Badge>
          </div>
          <p className="muted-small">
            Columns found: {preview.columns.length ? preview.columns.join(', ') : 'none'}. Rows with errors are skipped.
            The preview expires after an hour.
          </p>
          {preview.warnings.length > 0 && (
            <ul className="notice notice-warning plain-list stack-1">
              {preview.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          {preview.rows.length > 0 && (
            <div className="card table-card">
              <div className="table-scroll" role="region" aria-label="CSV preview rows" tabIndex={0}>
                <table className="table table-compact">
                  <caption className="sr-only">
                    First {preview.rows.length} rows of the file, with any errors per row.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Row</th>
                      {preview.columns.map((c) => (
                        <th scope="col" key={c}>
                          {c}
                        </th>
                      ))}
                      <th scope="col">Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r) => (
                      <tr key={r.row} className={r.errors.length ? 'row-error' : undefined}>
                        <th scope="row" className="op-numeric table-rowhead">
                          {r.row}
                        </th>
                        {preview.columns.map((c) => (
                          <td key={c} className="clamp-cell">
                            {r.values[c] ?? ''}
                          </td>
                        ))}
                        <td>{r.errors.length ? <span className="field-error">{r.errors.join(' ')}</span> : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {preview.rows.length < preview.validCount + preview.errorCount && (
            <p className="hint">Showing the first {preview.rows.length} rows.</p>
          )}
          <div className="field">
            <label htmlFor="csv-label">Label</label>
            <input id="csv-label" value={label} maxLength={200} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="row wrap">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy !== null || preview.validCount === 0}
              onClick={() => void commit()}
            >
              {busy === 'committing' ? 'Importing…' : `Import ${preview.validCount} valid rows`}
            </button>
            <button type="button" className="btn btn-secondary" disabled={busy !== null} onClick={reset}>
              Discard
            </button>
            {preview.validCount === 0 && <span className="muted-small">No valid rows to import.</span>}
          </div>
        </div>
      )}
    </div>
  )
}
