import { Link } from 'react-router-dom'
import type { Overview } from '../../lib/types'
import type { Workspace } from '../shell/shellModel'
import { nextStep } from './journeyModel'

/** Pages that explain themselves (Home has the Getting-started card) or are not part of the path. */
const QUIET = new Set(['/', '/settings', '/how-it-works'])

/**
 * "What do I do now?" — one sentence and one button, from real counts, on every page of the path while Guide is on.
 * When the button would only reload the page you are on, it shows the sentence alone.
 */
export function NextBar({ workspace, overview, pathname, search }: Readonly<{ workspace: Workspace; overview: Overview | undefined; pathname: string; search: string }>) {
  if (QUIET.has(pathname)) return null
  const next = nextStep(workspace, overview)
  if (!next) return null
  const [toPath, toQuery = ''] = next.to.split('?')
  const here = toPath === pathname && (toQuery === '' || search.includes(toQuery))
  return (
    <section className="next-bar" aria-label="What to do next" data-coach="next-bar">
      <span className="next-bar-tag">Next</span>
      <span className="next-bar-text">{here && <strong>{next.action}. </strong>}{next.text}</span>
      {!here && <Link className="btn btn-primary btn-sm" to={next.to}>{next.action}</Link>}
    </section>
  )
}
