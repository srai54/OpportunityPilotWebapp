import { useRouteError } from 'react-router-dom'
import { isStaleChunkError } from '../lib/lazyPage'

/** Shown when a page fails to load or crashes: plain words and a way back, never a stack trace. */
export function RouteError() {
  const error = useRouteError()
  const stale = isStaleChunkError(error)
  return (
    <main className="signin" id="main">
      <div className="page stack-3" style={{ maxWidth: 560 }}>
        <h1 className="page-title">{stale ? 'A newer version is ready' : 'This page could not open'}</h1>
        <p>{stale ? 'The app was updated while this tab was open. Reload to continue; nothing you saved is lost.' : 'Something went wrong while opening this page. Reload to try again; nothing you saved is lost.'}</p>
        <div className="row wrap">
          <button type="button" className="btn btn-primary" onClick={() => location.reload()}>Reload</button>
          <a className="btn btn-ghost" href="/">Go to Overview</a>
        </div>
      </div>
    </main>
  )
}
