import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { finishCall, nextLocation } from './oauthFinish'

const started = new Set<string>()

/** Rendered on Settings and Connectors: when the address carries a sign-in to finish, finishes it as the signed-in person, then reloads with the outcome. */
export function OauthFinish() {
  const [call] = useState(() => finishCall(window.location.search))
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    // A code works once: never post it twice (StrictMode runs effects twice in development).
    if (!call || started.has(call.body.code)) return
    started.add(call.body.code)
    api<{ next: string }>(call.path, { method: 'POST', body: JSON.stringify(call.body) })
      .then((r) => window.location.replace(nextLocation(r.next, window.location.pathname)))
      .catch(() => { setFailed(true); window.history.replaceState(null, '', window.location.pathname) })
  }, [call])
  if (!call) return null
  return failed
    ? <p className="notice notice-warning" role="alert">The sign-in could not be finished. Start connecting again.</p>
    : <p className="notice notice-info" role="status">Finishing the sign-in…</p>
}
