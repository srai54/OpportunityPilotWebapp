import { Link } from 'react-router-dom'
import { API_STATUS_LABELS, type ApiStatus, type Workspace } from './shellModel'

/** Slim footer on every screen: service status, the one promise, and two links. */
export function AppFooter({ apiStatus, workspace }: Readonly<{ apiStatus: ApiStatus; workspace: Workspace }>) {
  const s = API_STATUS_LABELS[apiStatus]
  return (
    <footer className="app-footer" data-testid="app-footer">
      <span className={`foot-dot dot-${s.tone}`} aria-hidden="true" />
      <span>{s.text}</span>
      <span className="foot-sep" aria-hidden="true">·</span>
      <span>{workspace === 'sales' ? 'Sales' : 'Candidate'} workspace</span>
      <span className="foot-gap" />
      <span className="foot-promise">Nothing is sent or applied without your approval</span>
      <Link to="/how-it-works">How it works</Link>
      <Link to="/settings">Settings</Link>
    </footer>
  )
}
