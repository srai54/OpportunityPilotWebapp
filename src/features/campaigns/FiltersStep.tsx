import type { Dispatch, SetStateAction } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../../components/StatusBadge'
import { TagInput } from '../../components/TagInput'
import { ROLES, SKILLS } from '../suggest/catalog'
import type { CampaignCriteria, WorkMode } from '../../lib/types'
import {
  applicableCriteria,
  AUTO_SUGGEST,
  autoSuggestProblem,
  type CampaignDraft,
  clampWeight,
  DEFAULT_WEIGHTS,
  fieldError,
  normaliseWeights,
  RESULT_LIMIT,
  type SupportedMode,
  WEIGHT_DEFS,
  weightsForMode,
  WORK_MODES,
  YEARS_MAX,
  modeCopy,
} from './campaignModel'

interface Props {
  draft: CampaignDraft
  setDraft: Dispatch<SetStateAction<CampaignDraft>>
  mode: SupportedMode
  fieldErrors?: Record<string, string[]>
}

type ListKey = Exclude<keyof CampaignCriteria, 'candidateYears' | 'workModes' | 'excludeStaffingAgencies' | 'maxPostingAgeDays'>

const HARD = <Badge tone="warning">Hard filter</Badge>
const SOFT = <Badge>Scored</Badge>

export function FiltersStep({ draft, setDraft, mode, fieldErrors }: Props) {
  const c = draft.criteria
  const setList = (key: ListKey) => (values: string[]) =>
    setDraft((d) => ({ ...d, criteria: { ...d.criteria, [key]: values } }))
  const list = (key: ListKey, label: string, placeholder: string, hint?: React.ReactNode, badge?: React.ReactNode) => (
    <TagInput
      id={`criteria-${key}`}
      label={label}
      values={c[key]}
      onChange={setList(key)}
      placeholder={placeholder}
      hint={hint}
      badge={badge}
      error={fieldError(fieldErrors, key)}
      suggestions={key === 'requiredSkills' || key === 'preferredSkills' ? SKILLS : key === 'keywords' ? ROLES : undefined}
    />
  )

  const toggleWorkMode = (m: WorkMode, on: boolean) =>
    setDraft((d) => ({
      ...d,
      criteria: {
        ...d.criteria,
        workModes: on ? [...d.criteria.workModes, m] : d.criteria.workModes.filter((x) => x !== m),
      },
    }))

  return (
    <div className="stack-6">
      <section className="stack-3" aria-labelledby="filters-search">
        <h4 id="filters-search" className="section-heading">
          Search
        </h4>
        {mode === 'Job'
          ? list(
              'keywords',
              'Job titles and search phrases',
              'e.g. .NET developer',
              'The job-board search and the scorer both use these.',
            )
          : list('keywords', modeCopy(mode).keywords[0], modeCopy(mode).keywords[1], modeCopy(mode).keywords[2])}
      </section>

      <section className="stack-3" aria-labelledby="filters-hard">
        <h4 id="filters-hard" className="section-heading">
          Hard filters
        </h4>
        <p className="muted-small">
          Applied before scoring. A clear miss marks the opportunity <strong>Excluded</strong>; when the evidence does not
          say either way it is marked <strong>Needs verification</strong> — unknown is never counted as a pass.
        </p>
        <div className="criteria-grid">
          {mode === 'Job' &&
            list(
              'requiredSkills',
              'Required skills',
              'e.g. C#',
              'Excluded only when the posting text has none of them. Also scored by how many appear.',
              HARD,
            )}
          {list(
            'locations',
            mode === 'Job' ? 'Locations' : 'Geography',
            mode === 'Job' ? 'e.g. Pune, Remote' : 'e.g. Germany',
            mode === 'Job' ? 'Add “Remote” to accept remote roles anywhere.' : 'Countries, regions or cities.',
            HARD,
          )}
          {mode === 'Job' && (
            <fieldset className="field">
              <legend className="row wrap">
                Work modes {HARD}
              </legend>
              <div className="row wrap check-row">
                {WORK_MODES.map((w) => (
                  <label key={w.value} className="check">
                    <input
                      type="checkbox"
                      checked={c.workModes.includes(w.value)}
                      onChange={(e) => toggleWorkMode(w.value, e.target.checked)}
                    />
                    {w.label}
                  </label>
                ))}
              </div>
              <p className="hint">Leave all unticked to accept any. A posting that clearly says another mode is excluded.</p>
            </fieldset>
          )}
          {list('excludeKeywords', 'Exclude keywords', 'e.g. internship', 'Any match in the title or text excludes it.', HARD)}
          {list('excludeOrganizations', 'Exclude organisations', 'e.g. Acme', 'Organisation names containing this are excluded.', HARD)}
          {mode === 'Job' && (
            <>
              <div className="field">
                <label className="confirm">
                  <input
                    type="checkbox"
                    checked={c.excludeStaffingAgencies}
                    onChange={(e) => setDraft((d) => ({ ...d, criteria: { ...d.criteria, excludeStaffingAgencies: e.target.checked } }))}
                  />
                  Exclude staffing agencies {HARD}
                </label>
                <p className="hint">Postings that read like an agency (“our client…”) are excluded with the sentence shown. No agency wording never counts against a job.</p>
              </div>
              <div className="field">
                <div className="row wrap">
                  <label htmlFor="criteria-age">Only postings from the last N days</label>
                  {HARD}
                </div>
                <input
                  id="criteria-age"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={365}
                  step={1}
                  value={c.maxPostingAgeDays ?? ''}
                  aria-describedby="criteria-age-hint"
                  onChange={(e) => {
                    const raw = e.target.value
                    setDraft((d) => ({ ...d, criteria: { ...d.criteria, maxPostingAgeDays: raw === '' ? null : Number(raw) } }))
                  }}
                />
                <p id="criteria-age-hint" className="hint">Leave empty for any age. Postings without a date are kept.</p>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="stack-3" aria-labelledby="filters-soft">
        <h4 id="filters-soft" className="section-heading">
          Scored criteria
        </h4>
        <div className="criteria-grid">
          {mode === 'Job' ? (
            <>
              {list('preferredSkills', 'Preferred skills', 'e.g. Azure', 'Nice to have; raises the score only.', SOFT)}
              <div className="field">
                <div className="row wrap">
                  <label htmlFor="criteria-years">Your years of experience</label>
                  {SOFT}
                </div>
                <input
                  id="criteria-years"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={YEARS_MAX}
                  step={1}
                  value={c.candidateYears ?? ''}
                  aria-describedby="criteria-years-hint"
                  onChange={(e) => {
                    const raw = e.target.value
                    setDraft((d) => ({
                      ...d,
                      criteria: { ...d.criteria, candidateYears: raw === '' ? null : Number(raw) },
                    }))
                  }}
                />
                <p id="criteria-years-hint" className="hint">
                  Compared with ranges like “3–5 years” in the posting. Leave empty to skip this criterion.
                </p>
              </div>
            </>
          ) : (
            <>
              {list('industries', modeCopy(mode).industries[0], modeCopy(mode).industries[1], undefined, SOFT)}
              {list('problems', modeCopy(mode).problems[0], modeCopy(mode).problems[1], 'Two or more mentions count as a full match.', SOFT)}
              {list('signals', modeCopy(mode).signals[0], modeCopy(mode).signals[1], 'Absence of a signal is unknown, not a negative.', SOFT)}
            </>
          )}
        </div>
      </section>

      <section className="stack-3" aria-labelledby="filters-limit">
        <h4 id="filters-limit" className="section-heading">
          Result limit
        </h4>
        <div className="field limit-field">
          <label htmlFor="campaign-limit">New opportunities kept per run</label>
          <input
            id="campaign-limit"
            type="number"
            inputMode="numeric"
            min={RESULT_LIMIT.min}
            max={RESULT_LIMIT.max}
            step={1}
            value={Number.isNaN(draft.resultLimit) ? '' : draft.resultLimit}
            aria-describedby="campaign-limit-hint"
            onChange={(e) => setDraft((d) => ({ ...d, resultLimit: e.target.value === '' ? Number.NaN : Number(e.target.value) }))}
          />
          <p id="campaign-limit-hint" className="hint">
            {RESULT_LIMIT.min}–{RESULT_LIMIT.max}. The highest-scoring new matches are written first; ones you already
            have are updated, never duplicated.
          </p>
        </div>
      </section>

      {mode === 'Job' && <AutoSuggest draft={draft} setDraft={setDraft} fieldErrors={fieldErrors} />}

      <WeightsEditor draft={draft} setDraft={setDraft} mode={mode} />
    </div>
  )
}

function WeightsEditor({ draft, setDraft, mode }: Omit<Props, 'fieldErrors'>) {
  const defs = WEIGHT_DEFS[mode]
  const weights = weightsForMode(mode, draft.weights)
  const applicable = applicableCriteria(mode, draft.criteria)
  const shares = normaliseWeights(weights, applicable)
  const anyActive = defs.some((d) => applicable.has(d.key) && weights[d.key] > 0)

  const setWeight = (key: string, raw: string) =>
    setDraft((d) => ({ ...d, weights: { ...d.weights, [key]: clampWeight(raw === '' ? 0 : Number(raw)) } }))
  const reset = () => setDraft((d) => ({ ...d, weights: { ...d.weights, ...DEFAULT_WEIGHTS[mode] } }))

  return (
    <section className="stack-3" aria-labelledby="filters-weights">
      <div className="row wrap">
        <h4 id="filters-weights" className="section-heading">
          Scoring weights
        </h4>
        <div className="grow" />
        <button type="button" className="btn btn-secondary btn-sm" onClick={reset}>
          Reset to defaults
        </button>
      </div>
      <p className="muted-small">
        Weights only rank results; they never turn an unverified fact into a verified one. Each criterion scores met,
        partly, not met or unknown — unknown earns 0 points and lowers evidence coverage instead of passing.
      </p>
      <div className="card table-card">
        <div className="table-scroll" role="region" aria-labelledby="filters-weights" tabIndex={0}>
          <table className="table table-compact">
            <caption className="sr-only">
              Scoring weights and the share of 100 each one gets after normalising across the criteria you configured.
            </caption>
            <thead>
              <tr>
                <th scope="col">Criterion</th>
                <th scope="col">Weight (0–100)</th>
                <th scope="col">Share of 100</th>
              </tr>
            </thead>
            <tbody>
              {defs.map((d) => {
                const share = shares[d.key]
                return (
                  <tr key={d.key}>
                    <th scope="row" className="table-rowhead">
                      {d.label}
                      <div className="muted-small">Needs {d.needs}</div>
                    </th>
                    <td>
                      <label className="sr-only" htmlFor={`weight-${d.key}`}>
                        Weight for {d.label}
                      </label>
                      <input
                        id={`weight-${d.key}`}
                        className="weight-input"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={100}
                        step={1}
                        value={weights[d.key]}
                        onChange={(e) => setWeight(d.key, e.target.value)}
                      />
                    </td>
                    <td className="op-numeric">
                      {share === null ? (
                        <span className="muted-small">Not applied — nothing configured</span>
                      ) : (
                        <span className="share">
                          <span className="share-bar" aria-hidden="true">
                            <span style={{ width: `${share}%` }} />
                          </span>
                          {share}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="hint" aria-live="polite">
        {anyActive
          ? 'Preview of the server’s normalisation to 100. Criteria with nothing configured are left out and their weight is shared among the rest.'
          : 'Every applied criterion has weight 0, so every result would score 0. Give at least one a weight.'}
      </p>
    </section>
  )
}

/** "Suggest jobs for approval": research moves qualified jobs at or above the threshold into the approval queue. */
function AutoSuggest({ draft, setDraft, fieldErrors }: Omit<Props, 'mode'>) {
  const value = draft.autoSuggestMinScore
  const on = value !== null
  const problem = on ? autoSuggestProblem(value) : null
  const serverError = fieldError(fieldErrors, 'autoSuggestMinScore')
  const error = problem ?? serverError
  const shown = on && Number.isFinite(value) ? value : 'N'

  return (
    <section className="stack-3" aria-labelledby="filters-suggest">
      <h4 id="filters-suggest" className="section-heading">
        Approval queue
      </h4>
      <label className="check">
        <input
          type="checkbox"
          checked={on}
          aria-describedby="auto-suggest-explain"
          onChange={(e) =>
            setDraft((d) => ({ ...d, autoSuggestMinScore: e.target.checked ? AUTO_SUGGEST.default : null }))
          }
        />
        Suggest jobs for approval
      </label>
      {on && (
        <div className="field limit-field">
          <label htmlFor="auto-suggest-min">Minimum fit score</label>
          <input
            id="auto-suggest-min"
            type="number"
            inputMode="numeric"
            min={AUTO_SUGGEST.min}
            max={AUTO_SUGGEST.max}
            step={1}
            value={Number.isFinite(value) ? (value as number) : ''}
            aria-describedby={`auto-suggest-hint${error ? ' auto-suggest-error' : ''}`}
            aria-invalid={error ? true : undefined}
            onChange={(e) =>
              setDraft((d) => ({ ...d, autoSuggestMinScore: e.target.value === '' ? Number.NaN : Number(e.target.value) }))
            }
          />
          <p id="auto-suggest-hint" className="hint">
            {AUTO_SUGGEST.min}–{AUTO_SUGGEST.max}. Fit {AUTO_SUGGEST.default}/100 is a reasonable start; lower it to see
            more suggestions.
          </p>
          {error && (
            <p id="auto-suggest-error" className="field-error">
              {error}
            </p>
          )}
        </div>
      )}
      <p id="auto-suggest-explain" className="muted-small">
        {on ? (
          <>
            After each research run, qualified jobs scoring at least {shown} wait in{' '}
            <Link to="/approvals">Approvals</Link>; nothing is applied until you approve.
          </>
        ) : (
          'Off: new matches stay in Opportunities for you to shortlist one by one. Turn this on to have qualified jobs above a fit score collected for approval in one batch; nothing is applied until you approve.'
        )}
      </p>
    </section>
  )
}
