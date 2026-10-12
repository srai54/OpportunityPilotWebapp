import { useState, type Dispatch, type SetStateAction } from 'react'
import { Link } from 'react-router-dom'
import { ErrorNotice } from '../../components/ErrorNotice'
import { Badge } from '../../components/StatusBadge'
import { api } from '../../lib/api'
import type { GoalPreview, ProfileSummary } from '../../lib/types'
import type { ApiState } from '../../lib/useApi'
import {
  type CampaignDraft,
  criteriaSummary,
  fieldError,
  GOAL_MAX,
  MODES,
  NAME_MAX,
  type SupportedMode,
  modeCopy,
} from './campaignModel'

interface Props {
  draft: CampaignDraft
  setDraft: Dispatch<SetStateAction<CampaignDraft>>
  profiles: ApiState<ProfileSummary[]>
  profileId: string
  mode: SupportedMode
  /** Profile and mode are fixed once saved: the API does not accept them on update. */
  locked: boolean
  fieldErrors?: Record<string, string[]>
  onEditCriteria: () => void
}

const JOB_STEPS = [
  ['Read every source you add', 'Postings are de-duplicated before anything is scored.'],
  ['Score against your criteria', 'Hard filters exclude. Scored criteria give points. Unknown never passes.'],
  ['Suggest what clears the threshold', 'Those land in Approvals, not in your inbox.'],
  ['Apply only after you approve', 'You open each application page yourself — nothing is applied for you.'],
]

export function GoalStep({ draft, setDraft, profiles, profileId, mode, locked, fieldErrors, onEditCriteria }: Props) {
  const [suggesting, setSuggesting] = useState(false)
  const [suggestError, setSuggestError] = useState<Error>()
  const [suggestion, setSuggestion] = useState<GoalPreview>()
  const lines = criteriaSummary(mode, draft.criteria)
  const profile = profiles.data?.find((p) => p.id === profileId)

  async function suggestCriteria() {
    if (!profileId || !draft.goal.trim()) return
    setSuggesting(true); setSuggestError(undefined)
    try {
      const result = await api<GoalPreview>('/api/v1/goal-previews', { method: 'POST', body: JSON.stringify({ profileId, goal: draft.goal, mode }) })
      setSuggestion(result)
      setDraft((current) => ({ ...current, criteria: result.criteria }))
    } catch (e) { setSuggestError(e as Error) } finally { setSuggesting(false) }
  }
  const nameError = fieldError(fieldErrors, 'name')
  const goalError = fieldError(fieldErrors, 'goal')

  return (
    <div className="builder-body">
      <div className="stack-4">
        <div className="field">
          <label htmlFor="campaign-profile">Profile</label>
          {profiles.error && <ErrorNotice error={profiles.error} onRetry={profiles.reload} />}
          {profiles.loading && !profiles.data && <p className="muted-small">Loading profiles…</p>}
          {profiles.data?.length === 0 ? (
            <p className="notice notice-warning">
              A campaign judges fit against one of your profiles, and you have none yet.{' '}
              <Link to="/profiles/new">Add a profile</Link>, then come back.
            </p>
          ) : (
            profiles.data && (
              <select
                id="campaign-profile"
                value={profileId}
                disabled={locked}
                aria-describedby="campaign-profile-hint"
                onChange={(e) => setDraft((d) => ({ ...d, profileId: e.target.value }))}
              >
                {profiles.data.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.type})
                  </option>
                ))}
              </select>
            )
          )}
          <p id="campaign-profile-hint" className="hint">
            {locked
              ? 'The profile is fixed once the campaign is saved. Start a new campaign to use another one.'
              : 'Fit is judged against this profile. Claims in it are yours to confirm.'}{' '}
            {profile && !profile.confirmedAt && 'This profile is not confirmed yet.'}
          </p>
        </div>

        <fieldset className="field">
          <legend>Mode</legend>
          <div className="type-grid">
            {MODES.filter((m) => m.supported && (m.mode === 'Job' || m.mode === 'Customer' || m.mode === draft.mode)).map((m) => {
              const checked = mode === m.mode
              const disabled = !m.supported || (locked && !checked)
              return (
                <label
                  key={m.mode}
                  className={`type-option ${checked ? 'type-option-active' : ''} ${disabled ? 'type-option-disabled' : ''}`}
                >
                  <input
                    type="radio"
                    name="campaign-mode"
                    value={m.mode}
                    checked={checked}
                    disabled={disabled}
                    onChange={() => setDraft((d) => ({ ...d, mode: m.mode as SupportedMode }))}
                  />
                  <span className="type-option-label">{m.label}</span>
                  <span className="muted-small">{m.description}</span>
                  {!m.supported && <Badge>Unavailable</Badge>}
                </label>
              )
            })}
          </div>
          <p className="hint">
            {locked
              ? 'The mode is fixed once the campaign is saved.'
              : 'One mode per campaign. It decides which criteria apply and how fit is scored.'}
          </p>
        </fieldset>

        <div className="field">
          <label htmlFor="campaign-name">Campaign name</label>
          <input
            id="campaign-name"
            value={draft.name}
            maxLength={NAME_MAX}
            placeholder={mode === 'Job' ? 'e.g. Pune .NET backend roles' : `e.g. ${modeCopy(mode).industries[1].replace('e.g. ', '')} — ${mode.toLowerCase()} search`}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? 'campaign-name-error' : undefined}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
          {nameError && (
            <p id="campaign-name-error" className="field-error">
              {nameError}
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor="campaign-goal">Describe the goal in your own words</label>
          <textarea
            id="campaign-goal"
            rows={4}
            value={draft.goal}
            maxLength={GOAL_MAX}
            aria-describedby="campaign-goal-hint"
            aria-invalid={goalError ? true : undefined}
            placeholder={
              mode === 'Job' ? 'e.g. Senior .NET backend roles in Pune or remote, 4–6 years, Azure a plus.' : modeCopy(mode).goal
            }
            onChange={(e) => setDraft((d) => ({ ...d, goal: e.target.value }))}
          />
          <p id="campaign-goal-hint" className="hint">
            Kept with the campaign as a note to yourself. {draft.goal.length} / {GOAL_MAX} characters.
          </p>
          {goalError && <p className="field-error">{goalError}</p>}
        </div>
      </div>

      <aside className="builder-side stack-4" aria-labelledby="criteria-panel-heading">
        <section className="panel">
          <header className="panel-head">
            <h4 className="eyebrow">What this mode will do</h4>
          </header>
          <ol className="mode-steps panel-body">
            {(mode === 'Job' ? JOB_STEPS : modeCopy(mode).steps).map(([t, d]) => (
              <li key={t}>
                <strong>{t}</strong>
                <span className="muted-small">{d}</span>
              </li>
            ))}
          </ol>
        </section>
        <section className="panel">
        <div className="panel-body">
        <div className="row wrap">
          <h4 id="criteria-panel-heading" className="section-heading">
            Criteria
          </h4>
          <Badge>Entered by you</Badge>
        </div>
        <p className="muted-small">Turn the goal into a reviewable criteria proposal. Gemini is used only when configured; otherwise deterministic rules are used.</p>
        {suggestError && <ErrorNotice error={suggestError} />}
        <button type="button" className="btn btn-secondary btn-sm" disabled={suggesting || !profileId || !draft.goal.trim()} onClick={suggestCriteria}>{suggesting ? 'Suggesting…' : 'Suggest criteria from goal'}</button>
        {suggestion && <p className="hint">Applied from {suggestion.source}{suggestion.fallbackReason ? ` (${suggestion.fallbackReason})` : ''}. Review before saving.</p>}
        {lines.length ? (
          <dl className="criteria-list">
            {lines.map((l) => (
              <div key={l.label}>
                <dt>{l.label}</dt>
                <dd>{l.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="muted-small">No criteria yet.</p>
        )}
        <button type="button" className="btn btn-secondary btn-sm" onClick={onEditCriteria}>
          {lines.length ? 'Edit criteria' : 'Enter criteria'}
        </button>
        <p className="hint">A criteria match is a research shortlist, not confirmed interest.</p>
        </div>
        </section>
      </aside>
    </div>
  )
}
