import { Link } from 'react-router-dom'
import { Icon, type IconName } from '../../components/icons'
import type { Overview } from '../../lib/types'
import type { Workspace } from '../shell/shellModel'
import { currentStage, journeySteps, nextStep, stepForPath, type StepId } from './journeyModel'

const STEP_ICONS: Record<StepId, IconName> = { profile: 'profiles', find: 'search', review: 'approvals', reach: 'outreach', follow: 'followUps' }


/**
 * The five steps across the top of every page, as tiles (v6): done steps are green with a tick, the current stage (the step the app
 * recommends next) is the dark tile with an arrow, the rest wait in grey. The page you are on is outlined. Counts come from the
 * overview, never invented. One compact row (tiles and the progress bar on one line), about 44px high.
 */
export function JourneyBar({ workspace, overview, pathname }: Readonly<{ workspace: Workspace; overview: Overview | undefined; pathname: string }>) {
  const steps = journeySteps(workspace, overview)
  const here = stepForPath(pathname)
  const stage = currentStage(steps, nextStep(workspace, overview)?.step ?? null)
  const hereIndex = steps.findIndex((s) => s.id === here)
  const doneCount = steps.filter((s) => s.done).length
  const pct = Math.round((doneCount / Math.max(1, steps.length)) * 100)
  return (
    <nav className="journey" aria-label="Your steps">
      <ol className="journey-list" data-coach="journey">
        {steps.map((s, i) => {
          const waiting = s.id === 'review' ? (overview?.awaitingApproval ?? 0) || (overview?.qualifiedToReview ?? 0) : 0
          const isHere = s.id === here
          const isStage = s.id === stage
          const state = isStage ? 'is-stage' : s.done ? 'is-done' : 'is-todo'
          return (
            <li key={s.id} className={`journey-step ${state}${isHere ? ' is-here' : ''}`}>
              <Link to={s.to} className="journey-link" aria-current={isHere ? 'step' : undefined}>
                <span className="journey-num op-numeric" aria-hidden="true">{s.done && !isStage ? <Icon name="check" size={13} /> : i + 1}</span>
                <span className="journey-icon" aria-hidden="true"><Icon name={STEP_ICONS[s.id]} size={16} /></span>
                <span className="journey-label">{s.label}</span>
                {waiting > 0 && <span className="journey-badge op-numeric">{waiting}<span className="sr-only"> waiting for you</span></span>}
                <span className="sr-only">{s.done ? ' (done)' : ''}{isStage ? ' (current stage)' : ''}</span>
              </Link>
            </li>
          )
        })}
      </ol>
      <div className="journey-foot">
        <div className="journey-progress" role="progressbar" aria-label="Stages done" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-valuetext={`${doneCount} of ${steps.length} stages completed`}>
          <i style={{ width: `${pct}%` }} />
        </div>
        <span className="journey-pct op-numeric" aria-hidden="true">{doneCount}/{steps.length}</span>
      </div>
      <span className="journey-compact" aria-hidden="true">
        {hereIndex >= 0 ? `Step ${hereIndex + 1} of ${steps.length} · ${steps[hereIndex].label}` : ''}
      </span>
    </nav>
  )
}
