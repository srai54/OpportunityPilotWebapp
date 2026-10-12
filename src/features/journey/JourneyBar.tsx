import { Link } from 'react-router-dom'
import type { Overview } from '../../lib/types'
import type { Workspace } from '../shell/shellModel'
import { journeySteps, nextStep, stepForPath } from './journeyModel'

/**
 * The five steps across the top of every page: done steps carry a tick, the page you are on is highlighted, and the one
 * the app recommends next has a "Next" tag. Counts come from the overview, never invented.
 */
export function JourneyBar({ workspace, overview, pathname }: Readonly<{ workspace: Workspace; overview: Overview | undefined; pathname: string }>) {
  const steps = journeySteps(workspace, overview)
  const here = stepForPath(pathname)
  const next = nextStep(workspace, overview)?.step
  const hereIndex = steps.findIndex((s) => s.id === here)
  return (
    <nav className="journey" aria-label="Your steps" data-coach="journey">
      <ol className="journey-list">
        {steps.map((s, i) => {
          const waiting = s.id === 'review' ? overview?.awaitingApproval ?? 0 : 0
          const isHere = s.id === here
          const isNext = s.id === next && !isHere
          return (
            <li key={s.id} className={`journey-step${s.done ? ' is-done' : ''}${isHere ? ' is-here' : ''}${isNext ? ' is-next' : ''}`}>
              <Link to={s.to} className="journey-link" aria-current={isHere ? 'step' : undefined}>
                <span className="journey-num" aria-hidden="true">{s.done ? '✓' : i + 1}</span>
                <span className="journey-label">{s.label}</span>
                {waiting > 0 && <span className="journey-badge op-numeric">{waiting}<span className="sr-only"> waiting for you</span></span>}
                {isNext && <span className="journey-next">Next</span>}
                <span className="sr-only">{s.done ? ' (done)' : ''}{isNext ? ' (recommended next)' : ''}</span>
              </Link>
            </li>
          )
        })}
      </ol>
      <span className="journey-compact" aria-hidden="true">
        {hereIndex >= 0 ? `Step ${hereIndex + 1} of ${steps.length} · ${steps[hereIndex].label}` : ''}
      </span>
    </nav>
  )
}
