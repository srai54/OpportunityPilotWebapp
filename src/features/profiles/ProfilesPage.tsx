import { useEffect, useMemo, useRef, useState } from 'react'
import { useBlocker, useNavigate, useParams } from 'react-router-dom'
import { ErrorNotice } from '../../components/ErrorNotice'
import { Badge } from '../../components/StatusBadge'
import { LoadingState } from '../../components/States'
import { TagInput } from '../../components/TagInput'
import { api, ApiError } from '../../lib/api'
import type { Profile, ProfileData, ProfileSummary, ProfileType } from '../../lib/types'
import { useApi } from '../../lib/useApi'
import { SKILLS } from '../suggest/catalog'
import { useShell } from '../shell/ShellContext'
import {
  buildSummary,
  confirmationState,
  confirmFilledClaims,
  readiness,
  simpleCreateFields,
  starterSearchTerm,
  createFields,
  emptyData,
  FIELDS,
  isFullyConfirmed,
  isTagField,
  isWideField,
  joinTags,
  NEW_PROFILE_TYPES,
  normalizeData,
  PROFILE_TYPES,
  splitTags,
  type FieldDef,
} from './profileFields'

const dateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
const LIST_HIDDEN_KEY = 'op.profilesListHidden'

function readListHidden(): boolean {
  try {
    return localStorage.getItem(LIST_HIDDEN_KEY) === '1'
  } catch {
    return false
  }
}

/** Design round 3 (Profiles, ProfileNew): a profile list beside a full-width editor. */
export function ProfilesPage() {
  const { advanced } = useShell()
  const { id } = useParams()
  const navigate = useNavigate()
  const list = useApi<ProfileSummary[]>('/api/v1/profiles')
  const creating = id === 'new'
  const [listHidden, setListHidden] = useState(readListHidden)
  const firstProfile = list.data?.length === 0
  const effectiveListHidden = listHidden || firstProfile

  // With no selection, open the most recent profile, or the create form when there are none.
  useEffect(() => {
    if (!id && list.data) navigate(list.data.length ? `/profiles/${list.data[0].id}` : '/profiles/new', { replace: true })
  }, [id, list.data, navigate])

  function toggleList() {
    setListHidden((h) => {
      try {
        localStorage.setItem(LIST_HIDDEN_KEY, h ? '0' : '1')
      } catch {
        /* not stored */
      }
      return !h
    })
  }

  return (
    <div className={`profiles2 ${effectiveListHidden ? 'profiles2-list-hidden' : ''}`}>
      {!effectiveListHidden && (
        <aside className="profiles2-list" aria-label="Profiles">
          <div className="profiles2-list-head">
            <span className="eyebrow">Profiles · {list.data?.length ?? '—'}</span>
            <div className="grow" />
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/profiles/new')}>
              + New
            </button>
          </div>
          <div className="profiles2-list-body">
            {list.error && <ErrorNotice error={list.error} onRetry={list.reload} />}
            {list.loading && !list.data && <LoadingState label="Loading profiles…" waking={list.waking} rows={3} />}
            {list.data?.length === 0 && (
              <div className="profiles2-empty">
                <strong>No profiles yet</strong>
                <span>This is your first. A campaign scores every result against one profile.</span>
              </div>
            )}
            <ul className="plain-list stack-2">
              {list.data?.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className={`profile-card ${p.id === id ? 'profile-card-active' : ''}`}
                    aria-current={p.id === id ? 'true' : undefined}
                    onClick={() => navigate(`/profiles/${p.id}`)}
                  >
                    <span className="row">
                      <span className="profile-card-name">{p.name}</span>
                      <Badge>{p.type}</Badge>
                    </span>
                    <span className="profile-card-meta">
                      v{p.version} · {dateFmt.format(new Date(p.updatedAt))} · {p.confirmedAt ? 'confirmed' : 'claims to confirm'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <button type="button" className="profiles2-hide" onClick={toggleList}>
            ‹ Hide this list
          </button>
        </aside>
      )}

      <div className="profiles2-main">
        {listHidden && !firstProfile && (
          <button type="button" className="profiles2-show btn-link small" onClick={toggleList}>
            › Show profiles list
          </button>
        )}
        {creating ? (
          <NewProfile key="new" onSaved={(p) => {
            list.reload()
            // Simple mode: a profile is only a means to a search, so go straight on to a campaign that is already filled in.
            if (advanced) { navigate(`/profiles/${p.id}`, { replace: true }); return }
            // A Sales profile names what you sell, which is not what companies hire for, so only a Candidate search is pre-filled.
            const term = p.type === 'Candidate' ? starterSearchTerm(p.name) : ''
            navigate(`/campaigns/new?profile=${p.id}${term ? `&keywords=${encodeURIComponent(term)}` : ''}`, { replace: true })
          }} onCancel={() => navigate(list.data?.[0] ? `/profiles/${list.data[0].id}` : '/')} />
        ) : id ? (
          <ExistingProfile key={id} id={id} onSaved={list.reload} />
        ) : null}
      </div>
    </div>
  )
}

function ExistingProfile({ id, onSaved }: { id: string; onSaved: () => void }) {
  const profile = useApi<Profile>(`/api/v1/profiles/${id}`)
  if (profile.error) return <div className="profiles2-pad"><ErrorNotice error={profile.error} onRetry={profile.reload} /></div>
  if (!profile.data) return <div className="profiles2-pad"><LoadingState label="Loading profile…" waking={profile.waking} rows={4} /></div>
  return <ProfileEditor key={`${id}-${profile.data.version}`} existing={profile.data} onSaved={() => { onSaved(); profile.reload() }} />
}

/** Leave-without-saving guard shared by both forms. */
function useUnsavedGuard(dirty: boolean, savedRef: React.RefObject<boolean>) {
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && !savedRef.current && currentLocation.pathname !== nextLocation.pathname)
  useEffect(() => {
    if (blocker.state === 'blocked') {
      if (window.confirm('You have unsaved profile changes. Leave without saving?')) blocker.proceed()
      else blocker.reset()
    }
  }, [blocker])
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
}

function saveError(error: Error) {
  return error instanceof ApiError && error.status === 409
    ? new Error(`${error.message} Your edits are still here — copy anything you need, then reload.`)
    : error
}

function cleanData(type: ProfileType, data: ProfileData, keys: FieldDef[] = FIELDS[type]): ProfileData {
  return {
    fields: Object.fromEntries(keys.map((f) => [f.key, data.fields[f.key] ?? ''])),
    confirmations: Object.fromEntries(keys.filter((f) => f.confirmable).map((f) => [f.key, data.confirmations[f.key] === true])),
  }
}

/** One field in the editor grid: textarea or skill chips, with the inline Confirmed / Confirm chip for claims. */
function FieldInput({
  f,
  data,
  setField,
  setConfirmed,
  placeholder,
}: {
  f: FieldDef
  data: ProfileData
  setField: (k: string, v: string) => void
  setConfirmed?: (k: string, v: boolean) => void
  placeholder?: string
}) {
  const value = data.fields[f.key] ?? ''
  const confirmed = data.confirmations[f.key] === true
  const chip =
    f.confirmable && setConfirmed && value.trim() ? (
      <button
        type="button"
        className={`confirm-chip ${confirmed ? 'confirm-chip-on' : ''}`}
        aria-pressed={confirmed}
        onClick={() => setConfirmed(f.key, !confirmed)}
        title={confirmed ? 'Confirmed by you. Click to withdraw.' : 'Confirm this is accurate. Nothing is strengthened or embellished for you.'}
      >
        {confirmed ? '✓ Confirmed' : '⚠ Confirm'}
      </button>
    ) : null

  if (isTagField(f)) {
    return (
      <div className={isWideField(f) ? 'grid-wide' : undefined}>
        <TagInput
          id={`f-${f.key}`}
          label={f.label}
          values={splitTags(value)}
          onChange={(tags) => setField(f.key, joinTags(tags))}
          placeholder="Type a skill, e.g. C# or Azure"
          suggestions={SKILLS}
          hint="Each one can become a scored criterion in a campaign."
          badge={chip}
        />
      </div>
    )
  }
  return (
    <div className={`field ${isWideField(f) ? 'grid-wide' : ''}`}>
      <div className="row">
        <label htmlFor={`f-${f.key}`}>{f.label}{f.required && !f.label.endsWith('*') ? ' *' : ''}</label>
        <div className="grow" />
        {chip}
      </div>
      {f.rows <= 1 ? (
        <input id={`f-${f.key}`} value={value} placeholder={placeholder} onChange={(e) => setField(f.key, e.target.value)} />
      ) : (
        <textarea id={`f-${f.key}`} rows={f.rows} value={value} placeholder={placeholder} onChange={(e) => setField(f.key, e.target.value)} />
      )}
      {f.hint && <p className="hint">{f.hint}</p>}
    </div>
  )
}

const PLACEHOLDERS: Record<string, string> = {
  offer: 'Backend and integration work in .NET: order and warehouse systems, Azure migrations…',
  idealCustomer: 'Companies with 20–200 staff that are hiring fast and still use spreadsheets',
  capabilities: 'Automates payroll runs, tax filings and payslips',
  outreachIdentity: 'Asha Rao',
  availability: '[YOUR RANGE], e.g. Available mid-October',
}

/** Design ProfileNew: type as one row of cards, then the few fields needed to start. Claims come after saving. */
function NewProfile({ onSaved, onCancel }: { onSaved: (p: Profile) => void; onCancel: () => void }) {
  const { advanced, workspace } = useShell()
  const sales = workspace === 'sales'
  const [type, setType] = useState<ProfileType>(sales ? 'Product' : 'Candidate')
  const [name, setName] = useState('')
  const [data, setData] = useState<ProfileData>(emptyData)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<Error>()
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const savedRef = useRef(false)
  const dirty = name.trim() !== '' || Object.values(data.fields).some((v) => v.trim())
  useUnsavedGuard(dirty, savedRef)
  // Simple mode: only the types that belong to this workspace, and only the few fields a first search needs.
  const types = advanced ? NEW_PROFILE_TYPES : NEW_PROFILE_TYPES.filter((t) => (sales ? t.type === 'Product' || t.type === 'Services' : t.type === 'Candidate'))
  const fields = advanced ? createFields(type) : simpleCreateFields(type)
  const setField = (key: string, value: string) => setData((d) => ({ ...d, fields: { ...d.fields, [key]: value } }))
  const offerMissing = !data.fields.offer?.trim()

  async function create() {
    setSaving(true)
    setError(undefined)
    setFieldErrors({})
    try {
      const payload = advanced ? cleanData(type, data) : confirmFilledClaims(type, cleanData(type, data))
      const saved = await api<Profile>('/api/v1/profiles', {
        method: 'POST',
        body: JSON.stringify({ type, name: name.trim(), data: payload, confirmed: !advanced && isFullyConfirmed(type, payload) }),
      })
      savedRef.current = true
      onSaved(saved)
    } catch (e) {
      setSaving(false)
      if (e instanceof ApiError && e.fieldErrors) setFieldErrors(e.fieldErrors)
      setError(e as Error)
    }
  }

  return (
    <form className="profiles2-form" onSubmit={(e) => { e.preventDefault(); void create() }}>
      <div className="profiles2-pad stack-4">
        <header>
          <h2 className="editor-title">{advanced ? 'New profile' : sales ? 'What do you sell?' : 'Tell us about you'}</h2>
          <p className="muted-small" data-coach="profile-intro">
            {advanced
              ? 'Not saved yet. Three fields are enough to start — you can deepen it later.'
              : 'A minute is enough. When you save, you go straight to your first search — nothing else to set up.'}
          </p>
        </header>
        {error && <ErrorNotice error={saveError(error)} />}
        {types.length > 1 && <fieldset className="field">
          <legend>
            {advanced ? 'Profile type' : 'I sell'} <span className="muted-small">{advanced ? 'decides which campaigns can use it' : 'pick the closest'}</span>
          </legend>
          <div className="type-row">
            {types.map((t) => (
              <label key={t.type} className={`type-option ${type === t.type ? 'type-option-active' : ''}`}>
                <input type="radio" name="ptype" value={t.type} checked={type === t.type} onChange={() => setType(t.type)} />
                <span className="type-option-label">
                  <span className="type-radio" aria-hidden="true" />
                  {t.label}
                </span>
                <span className="muted-small">{t.description}</span>
              </label>
            ))}
          </div>
        </fieldset>}
        <div className="editor-grid" data-coach="profile-fields">
          <div className="field grid-wide">
            <label htmlFor="pname">{advanced ? 'Profile name *' : sales ? 'Name it *' : 'What kind of work are you after? *'}</label>
            <input id="pname" required value={name} maxLength={200} onChange={(e) => setName(e.target.value)} placeholder={sales ? 'e.g. Payroll software for SMEs' : advanced ? 'e.g. .NET full-stack — 5 years' : 'e.g. .NET developer'} />
            <p className="hint">{advanced ? 'Only you see this. Name it for the kind of work, not the company.' : 'Only you see this. It also becomes your first search.'}</p>
            {fieldErrors.name && <p className="field-error">{fieldErrors.name.join(' ')}</p>}
          </div>
          {fields.map((f) => (
            <FieldInput
              key={f.key}
              f={f.key === 'offer' ? { ...f, label: `${f.label} *` } : f}
              data={data}
              setField={setField}
              
              placeholder={PLACEHOLDERS[f.key]}
            />
          ))}
          {fieldErrors.data && <p className="field-error grid-wide">{fieldErrors.data.join(' ')}</p>}
          {advanced
            ? <div className="notice notice-neutral grid-wide">
                <strong>{FIELDS[type].filter((f) => f.confirmable).map((f) => f.label).join(' and ')} come next.</strong> Once this is
                saved you can add them and confirm each claim. Nothing is ever written for you, and a claim you have not
                confirmed does not raise a score.
              </div>
            : <p className="muted-small grid-wide">Nothing is written for you. By saving you confirm that what you typed above is accurate, so it can count towards a match score.</p>}
        </div>
      </div>
      <div className="save-bar">
        <span className="muted-small">Saved as version 1.</span>
        <div className="grow" />
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" data-coach="profile-save" disabled={saving || !name.trim() || offerMissing}>
          {saving ? 'Creating…' : advanced ? 'Create profile' : sales ? 'Save & find companies' : 'Save & find jobs'}
        </button>
      </div>
    </form>
  )
}

type Tab = 'details' | 'claims' | 'summary' | 'versions'

/** Design Profiles: header with claim count, tabs (Details · Claims · Summary · Versions), sticky save bar. */
function ProfileEditor({ existing, onSaved }: { existing: Profile; onSaved: (p: Profile) => void }) {
  const type = existing.type
  const [name, setName] = useState(existing.name)
  const [data, setData] = useState<ProfileData>(() => normalizeData(existing.data))
  const [tab, setTab] = useState<Tab>('details')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<Error>()
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const savedRef = useRef(false)

  const initial = useMemo(() => JSON.stringify({ name: existing.name, data: normalizeData(existing.data) }), [existing])
  const dirty = JSON.stringify({ name, data }) !== initial
  useUnsavedGuard(dirty, savedRef)

  const setField = (key: string, value: string) =>
    setData((d) => ({
      fields: { ...d.fields, [key]: value },
      // Editing a claim clears its confirmation: the new wording has not been confirmed.
      confirmations: { ...d.confirmations, [key]: false },
    }))
  const setConfirmed = (key: string, value: boolean) => setData((d) => ({ ...d, confirmations: { ...d.confirmations, [key]: value } }))

  const fields = FIELDS[type]
  const confirmed = isFullyConfirmed(type, data)
  const state = confirmationState(type, data)
  const ready = readiness(type, data)
  const summary = buildSummary(type, data)
  const typeInfo = PROFILE_TYPES.find((t) => t.type === type)

  async function save() {
    setSaving(true)
    setError(undefined)
    setFieldErrors({})
    try {
      const saved = await api<Profile>(`/api/v1/profiles/${existing.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name, data: cleanData(type, data), confirmed, expectedVersion: existing.version }),
      })
      savedRef.current = true
      setSaving(false)
      onSaved(saved)
    } catch (e) {
      setSaving(false)
      if (e instanceof ApiError && e.fieldErrors) setFieldErrors(e.fieldErrors)
      setError(e as Error)
    }
  }

  const discard = () => {
    const i = JSON.parse(initial) as { name: string; data: ProfileData }
    setName(i.name)
    setData(i.data)
    setError(undefined)
  }

  const { advanced } = useShell()
  const [adv, setAdv] = useState(advanced)
  const TABS: { key: Tab; label: string; count?: string | number }[] = [
    { key: 'details', label: 'Details' },
    { key: 'claims', label: 'Claims', count: state.awaiting.length || undefined },
    { key: 'summary', label: 'Summary' },
    { key: 'versions', label: 'Versions', count: `v${existing.version}` },
  ]

  return (
    <div className="profiles2-form">
      <div className="profiles2-head">
        <div className="row wrap">
          <h2 className="editor-title">{existing.name}</h2>
          <Badge>{type}</Badge>
          {state.awaiting.length > 0 && (
            <span className="badge badge-warning">
              {state.awaiting.length} {state.awaiting.length === 1 ? 'claim' : 'claims'} to confirm
            </span>
          )}
        </div>
        <p className="muted-small">
          Version {existing.version} · saved {dateFmt.format(new Date(existing.updatedAt))}
          {dirty && <span className="text-warning"> · unsaved changes</span>}
        </p>
        <p className={`small ${ready.ready ? '' : 'text-warning'}`} aria-live="polite">
          {ready.ready
            ? 'Ready: every required field is filled and every claim is confirmed. Drafts cite this exact version.'
            : [
                ready.missingRequired.length > 0 && `Still needed: ${ready.missingRequired.join(', ')}.`,
                ready.claimsAwaiting.length > 0 && `To confirm: ${ready.claimsAwaiting.join(', ')}.`,
              ].filter(Boolean).join(' ')}
        </p>
        {adv && (
        <div className="tabs" role="tablist" aria-label="Profile sections">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`tab-${t.key}`}
              aria-selected={tab === t.key}
              aria-controls={`panel-${t.key}`}
              className={`tab ${tab === t.key ? 'tab-active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
              {t.count !== undefined && <span className="tab-count">{t.count}</span>}
            </button>
          ))}
        </div>
        )}
        <button type="button" className="btn btn-ghost btn-sm" aria-expanded={adv} onClick={() => { setAdv(!adv); if (adv) setTab('details') }}>
          {adv ? 'Hide advanced' : 'Advanced: all fields, claims, versions'}
        </button>
      </div>

      <div className="profiles2-pad stack-4" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {error && <ErrorNotice error={saveError(error)} />}

        {tab === 'details' && (
          <div className="editor-grid">
            <div className="field">
              <label htmlFor="pname">Profile name *</label>
              <input id="pname" value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />
              <p className="hint">Only you see this. Name it for the kind of work, not the company.</p>
              {fieldErrors.name && <p className="field-error">{fieldErrors.name.join(' ')}</p>}
            </div>
            {adv && (
            <div className="field">
              <label htmlFor="ptype">Profile type</label>
              <input id="ptype" value={`${type} — ${typeInfo?.description ?? ''}`} readOnly disabled />
              <p className="hint">Fixed once created: campaigns rely on it. Create another profile for a different type.</p>
            </div>
            )}
            {fields.filter((f) => adv || f.required || f.key === 'skills' || f.key === 'availability').map((f) => (
              <FieldInput key={f.key} f={f} data={data} setField={setField} setConfirmed={setConfirmed} />
            ))}
            {fieldErrors.data && <p className="field-error grid-wide">{fieldErrors.data.join(' ')}</p>}
          </div>
        )}

        {tab === 'claims' && (
          <section className="stack-3 profiles2-narrow">
            <p className="muted">
              Claims are statements about you that a campaign may score or quote. Each must be confirmed by you; an
              unconfirmed claim never raises a score. This version will be saved as{' '}
              <strong>{confirmed ? 'confirmed' : 'not confirmed'}</strong>.
            </p>
            {(() => {
              const filled = fields.filter((f) => f.confirmable && data.fields[f.key]?.trim())
              if (filled.length === 0) return <p className="muted-small">Nothing to confirm yet. Anything you add in Details shows up here.</p>
              return (
                <ul className="plain-list stack-2">
                  {filled.map((f) => {
                    const ok = data.confirmations[f.key] === true
                    return (
                      <li key={f.key} className="card claim-row">
                        <div className="row">
                          <strong>{f.label}</strong>
                          <div className="grow" />
                          <button type="button" className={`confirm-chip ${ok ? 'confirm-chip-on' : ''}`} aria-pressed={ok} onClick={() => setConfirmed(f.key, !ok)}>
                            {ok ? '✓ Confirmed' : '⚠ Confirm'}
                          </button>
                        </div>
                        <p className="claim-text">{data.fields[f.key]?.trim()}</p>
                      </li>
                    )
                  })}
                </ul>
              )
            })()}
          </section>
        )}

        {tab === 'summary' && (
          <section className="stack-3 profiles2-narrow">
            <p className="muted">
              Your own words, joined together — nothing is reworded. When AI features arrive, this is the context sent to
              Gemini; nothing else from your account is.
            </p>
            {summary ? <p className="summary">{summary}</p> : <p className="muted-small">Fill in the fields to build the summary.</p>}
          </section>
        )}

        {tab === 'versions' && (
          <section className="stack-3 profiles2-narrow">
            <div className="card">
              <div className="row">
                <strong>Version {existing.version}</strong>
                <span className="badge badge-success">Current</span>
                <div className="grow" />
                <span className="muted-small">saved {dateFmt.format(new Date(existing.updatedAt))}</span>
              </div>
              <p className="muted-small">{existing.confirmedAt ? 'Confirmed by you.' : 'Has claims that are not confirmed yet.'}</p>
            </div>
            <p className="muted-small">
              Each save raises the version number. This build stores only the current version, so earlier versions are not
              listed here yet (OQ-FE-042).
            </p>
          </section>
        )}
      </div>

      <div className="save-bar">
        <span className="muted-small">ⓘ Saving writes version {existing.version + 1}. Editing a claim clears its confirmation.</span>
        <div className="grow" />
        <button type="button" className="btn btn-secondary" onClick={discard} disabled={!dirty || saving}>
          Discard changes
        </button>
        <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={!dirty || saving || !name.trim()}>
          {saving ? 'Saving…' : `Save as version ${existing.version + 1}`}
        </button>
      </div>
    </div>
  )
}
