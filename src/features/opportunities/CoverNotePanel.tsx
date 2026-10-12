import { useState } from 'react'
import { ErrorNotice } from '../../components/ErrorNotice'
import { Badge } from '../../components/StatusBadge'
import { api } from '../../lib/api'
import type { OutreachDraft } from '../../lib/types'
import { useApi } from '../../lib/useApi'
import { formatWhen } from '../applications/applicationStatus'
import { ProfileConfirmNotice } from '../profiles/ProfileConfirmNotice'
import { needsProfileConfirm } from '../profiles/profileFields'

export function CoverNotePanel({ opportunityId }: { opportunityId: string }) {
  const loaded = useApi<OutreachDraft[]>(`/api/v1/opportunities/${encodeURIComponent(opportunityId)}/drafts`)
  const [updated, setUpdated] = useState<OutreachDraft | null>()
  const [edit, setEdit] = useState<{ id: string; version: number; body: string }>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Error>()
  const [announcement, setAnnouncement] = useState('')

  const fromServer = loaded.data?.find((d) => d.channel === 'CoverNote') ?? (loaded.data ? null : undefined)
  const current = updated !== undefined ? updated : fromServer
  const body = current && edit?.id === current.id && edit.version === current.version ? edit.body : current?.body ?? ''
  const changed = Boolean(current && body !== current.body)
  const validBody = body.trim().length > 0 && body.length <= 10_000

  async function act(label: string, work: () => Promise<OutreachDraft | null>) {
    setBusy(true)
    setError(undefined)
    try {
      const next = await work()
      setUpdated(next)
      setEdit(undefined)
      setAnnouncement(label)
    } catch (e) {
      setError(e as Error)
    } finally {
      setBusy(false)
    }
  }

  function generate() {
    void act('Cover note generated. Review and approve it before the agent can use it.', () =>
      api<OutreachDraft>(`/api/v1/opportunities/${encodeURIComponent(opportunityId)}/drafts`, {
        method: 'POST',
        body: JSON.stringify({ channel: 'CoverNote' }),
      }),
    )
  }

  function save() {
    if (!current) return
    void act('Cover note saved. Any previous approval was cleared.', () =>
      api<OutreachDraft>(`/api/v1/drafts/${current.id}`, {
        method: 'PUT',
        body: JSON.stringify({ recipient: current.recipient, subject: current.subject, body, expectedVersion: current.version }),
      }),
    )
  }

  function approve() {
    if (!current) return
    void act('Cover note approved. The desktop agent may now fill this exact text.', () =>
      api<OutreachDraft>(`/api/v1/drafts/${current.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ version: current.version }),
      }),
    )
  }

  function revoke() {
    if (!current) return
    void act('Approval revoked. The agent will no longer receive this cover note.', () =>
      api<OutreachDraft>(`/api/v1/drafts/${current.id}/revoke-approval`, { method: 'POST' }),
    )
  }

  function remove() {
    if (!current || !window.confirm('Delete this cover note? This cannot be undone.')) return
    void act('Cover note deleted.', async () => {
      await api<void>(`/api/v1/drafts/${current.id}`, { method: 'DELETE' })
      return null
    })
  }

  return (
    <section className="panel cover-note-panel" aria-labelledby="cover-note-heading">
      <header className="panel-head">
        <h3 id="cover-note-heading" className="eyebrow">
          Cover note
        </h3>
        <div className="grow" />
        {current && <Badge tone={current.state === 'Approved' ? 'success' : 'warning'}>{current.state}</Badge>}
      </header>
      <div className="panel-body stack-3">
        <span className="sr-only" role="status" aria-live="polite">
          {announcement}
        </span>
        {error && (needsProfileConfirm(error)
          ? <ProfileConfirmNotice opportunityId={opportunityId} onConfirmed={() => { setError(undefined); generate() }} />
          : <ErrorNotice error={error} onRetry={loaded.reload} />)}
        {loaded.waking && !loaded.data && <p className="muted-small">The API is waking up…</p>}
        {!loaded.data && !loaded.error ? (
          <p className="muted-small">Loading cover note…</p>
        ) : current === null ? (
          <>
            <p className="muted-small">
              Generate a deterministic draft from your confirmed campaign profile and verified job facts. Nothing is sent or applied.
            </p>
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={generate}>
              {busy ? 'Generating…' : 'Generate cover note'}
            </button>
          </>
        ) : current ? (
          <>
            <div className="cover-note-meta">
              <Badge tone="primary">{current.source}</Badge>
              <span className="muted-small">
                Version {current.version} · updated <time dateTime={current.updatedAt}>{formatWhen(current.updatedAt)}</time>
              </span>
            </div>
            <label className="field" htmlFor="cover-note-body">
              <span>Draft text</span>
              <textarea
                id="cover-note-body"
                rows={14}
                maxLength={10_000}
                value={body}
                disabled={busy}
                aria-invalid={!validBody}
                aria-describedby="cover-note-help"
                onChange={(e) => setEdit({ id: current.id, version: current.version, body: e.target.value })}
              />
            </label>
            <p id="cover-note-help" className={validBody ? 'hint' : 'field-error'}>
              {validBody ? `${body.length} / 10,000 characters. Saving any edit clears approval.` : 'Enter 1–10,000 characters.'}
            </p>
            {current.claims.length > 0 && (
              <details>
                <summary className="small">Show {current.claims.length} claim {current.claims.length === 1 ? 'basis' : 'bases'}</summary>
                <ul className="plain-list cover-note-claims">
                  {current.claims.map((claim, index) => (
                    <li key={`${claim.basis}-${index}`}>
                      <Badge tone={claim.basis === 'Evidence' ? 'success' : 'primary'}>{claim.basis}</Badge>
                      <span>{claim.text}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <div className="row wrap">
              <button type="button" className="btn btn-secondary btn-sm" disabled={busy || !changed || !validBody} onClick={save}>
                {busy && changed ? 'Saving…' : 'Save draft'}
              </button>
              {current.state === 'Approved' ? (
                <button type="button" className="btn btn-secondary btn-sm" disabled={busy || changed} onClick={revoke}>
                  Revoke approval
                </button>
              ) : (
                <button type="button" className="btn btn-primary btn-sm" disabled={busy || changed || !validBody} onClick={approve}>
                  Approve for agent
                </button>
              )}
              <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={remove}>
                Delete
              </button>
            </div>
            {changed && <p className="hint">Save this edit before approving.</p>}
            {current.sendBlockers.length > 0 && !changed && (
              <ul className="plain-list hint-list">
                {current.sendBlockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
              </ul>
            )}
          </>
        ) : null}
      </div>
    </section>
  )
}
