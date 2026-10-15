import { useEffect, useState } from 'react'
import { Card } from '../../components/cards'
import { ErrorNotice } from '../../components/ErrorNotice'
import { loadHanko } from '../../lib/hanko'

type Loaded = 'loading' | 'ready' | 'failed'

/** Waits until Hanko's web components are registered (they are loaded on demand). */
function useHankoElements(): Loaded {
  const [state, setState] = useState<Loaded>('loading')
  useEffect(() => {
    let live = true
    loadHanko()
      .then(() => live && setState('ready'))
      .catch(() => live && setState('failed'))
    return () => {
      live = false
    }
  }, [])
  return state
}

const LOAD_FAILED = new Error(
  'The sign-in service could not be reached. Check your connection and reload the page, or use another option below.',
)

/**
 * Hanko's combined sign-in and sign-up (passkey, password or email code, then the second factor when the account has
 * one). Styled only through its CSS variables (`.op-hanko` in app.css). The session is picked up by AuthProvider.
 */
export function HankoAuthPanel() {
  const state = useHankoElements()
  if (state === 'failed') return <ErrorNotice error={LOAD_FAILED} />
  if (state === 'loading')
    return (
      <p className="hint" role="status">
        Loading sign-in…
      </p>
    )
  return <hanko-auth className="op-hanko" />
}

/** Settings → Security for Hanko accounts: email addresses, password, passkeys, authenticator app and security keys. */
export function HankoSecurityCard() {
  const state = useHankoElements()
  return (
    <Card
      title="Security"
      subtitle="Passkeys, password, email and two-step sign-in."
    >
      {state === 'failed' ? (
        <ErrorNotice error={new Error('Your sign-in settings could not load. Check your connection and reload the page.')} />
      ) : state === 'loading' ? (
        <p className="hint" role="status">
          Loading your sign-in settings…
        </p>
      ) : (
        <hanko-profile className="op-hanko" />
      )}
    </Card>
  )
}
