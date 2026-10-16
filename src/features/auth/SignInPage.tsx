import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ErrorNotice } from '../../components/ErrorNotice'
import { ApiError, ApiStillUnreachableError, ApiUnreachableError } from '../../lib/api'
import { isWakingError, wakeRetryDelay } from '../../lib/wakeRetry'
import { AuthCardHeader, AuthLayout, AuthTabs, Divider, PasswordField, ProviderButtons } from './AuthLayout'
import { AUTH_PATHS, CLASSIC_SIGNIN_PARAM, CLASSIC_SIGNIN_VALUE, KEEP_SIGNED_IN_KEY, readFlag } from './authModel'
import { HankoAuthPanel } from './HankoElements'
import { useAuth } from './AuthContext'

const WAKE_NOTE =
  'The API sleeps when idle on free hosting. The first request after a quiet spell takes up to a minute — you will see “Starting the API service…”, not an error.'

/**
 * Design AuthSignIn: email + password, Google, keep signed in, forgot link, and "Continue as guest".
 * With Hanko on, Hanko's sign-in leads and the form above becomes "the older sign-in" (`?with=classic`).
 */
export function SignInPage() {
  const { mode, hanko, sessionExpired, devSignIn, guestSignIn, passwordSignIn, googleSignIn, microsoftSignIn } = useAuth()
  const [params] = useSearchParams()
  const classic = !hanko || (mode !== 'guest' && params.get(CLASSIC_SIGNIN_PARAM) === CLASSIC_SIGNIN_VALUE)
  const accounts = mode === 'supabase'
  const anyAccounts = accounts || hanko
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [keep, setKeep] = useState(() => readFlag(KEEP_SIGNED_IN_KEY, true))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [guestBusy, setGuestBusy] = useState(false)
  const [guestError, setGuestError] = useState<Error>()
  const [waking, setWaking] = useState(false)

  async function continueAsGuest() {
    setGuestBusy(true)
    setGuestError(undefined)
    try {
      // The free host may be asleep: keep trying while it wakes instead of failing on the first attempt.
      for (let attempt = 0; ; attempt++) {
        try {
          await guestSignIn()
          break
        } catch (e) {
          const delay = isWakingError(e) ? wakeRetryDelay(attempt) : null
          if (delay === null) throw e instanceof ApiUnreachableError && attempt > 0 ? new ApiStillUnreachableError(e.message) : e
          setWaking(true)
          await new Promise((r) => setTimeout(r, delay))
        }
      }
    } catch (e) {
      setGuestError(
        e instanceof ApiError && e.status === 404
          ? new Error('Guest access is switched off on this deployment. Sign in or create an account.')
          : (e as Error),
      )
    } finally {
      setGuestBusy(false)
      setWaking(false)
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (mode === 'dev') {
      if (email.trim()) devSignIn(email.trim())
      return
    }
    setBusy(true)
    try {
      await passwordSignIn(email.trim(), password, keep)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function provider(go: () => Promise<void>) {
    setError(null)
    try {
      await go()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <AuthLayout
      headline={
        <>
          Your next role or client —{' '}<br />
          <span className="auth-hl">found on autopilot.</span>
        </>
      }
      lead="Searches 20+ sites, scores every match and acts within the limits you set."
      asideTitle="Built for"
      asideItems={['Job seekers', 'Staffing & sales teams', 'You stay in control']}
      footnote={WAKE_NOTE}
    >
      {accounts && classic && <AuthTabs active="signin" />}
      {classic ? (
        <AuthCardHeader title="Sign in" subtitle="Welcome back." />
      ) : (
        <AuthCardHeader title="Sign in or create an account" subtitle="Use a passkey, your password or a code sent to your email." />
      )}

      {sessionExpired && (
        <p className="notice notice-warning" role="status">
          Your session ended. Sign in again to continue — anything already saved is still there.
        </p>
      )}

      {hanko && classic && (
        <p className="auth-center">
          <Link to={AUTH_PATHS.signin}>Back to sign-in with a passkey</Link>
        </p>
      )}

      {!classic ? (
        <>
          <HankoAuthPanel />
          {mode !== 'guest' && (
            <p className="auth-center">
              <Link to={`${AUTH_PATHS.signin}?${CLASSIC_SIGNIN_PARAM}=${CLASSIC_SIGNIN_VALUE}`}>
                {mode === 'dev' ? 'Use the development sign-in' : 'Use the older sign-in (Supabase)'}
              </Link>
            </p>
          )}
        </>
      ) : mode === 'dev' ? (
        <form onSubmit={submit} className="stack-3">
          <p className="notice notice-neutral">
            <strong>Development sign-in.</strong> Local only — any name creates a separate synthetic user.
          </p>
          <div className="field">
            <label htmlFor="email">Dev user name or email</label>
            <input id="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <button className="btn btn-primary auth-wide" type="submit">
            Sign in
          </button>
        </form>
      ) : accounts ? (
        <form onSubmit={submit} className="stack-3">
          <ProviderButtons verb="Continue" onGoogle={() => void provider(googleSignIn)} onMicrosoft={() => void provider(microsoftSignIn)} disabled={busy} />
          <Divider label="or use your email" />
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              placeholder="you@company.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <PasswordField
            id="password"
            label="Password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            labelAside={
              <Link className="small" to={AUTH_PATHS.reset}>
                Forgot?
              </Link>
            }
          />
          <label className="checkbox-row">
            <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
            Keep me signed in on this device
          </label>
          {error && (
            <p className="notice notice-danger" role="alert">
              {error}
            </p>
          )}
          <button className="btn btn-primary auth-wide" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      ) : (
        <p className="notice notice-neutral">
          <strong>Accounts are not switched on for this deployment yet.</strong> Sign in, Create account, Microsoft, Google and
          two-step sign-in appear here once the site owner sets these two variables on Vercel and redeploys:
          <br /><code>VITE_SUPABASE_URL</code><br /><code>VITE_SUPABASE_PUBLISHABLE_KEY</code><br />
          Until then, continue as a guest.
        </p>
      )}

      {mode !== 'dev' && (
        <div className="stack-2">
          {anyAccounts && <Divider label="No account needed" />}
          {guestError && <ErrorNotice error={guestError} />}
          <button
            className={`btn ${anyAccounts ? 'btn-secondary' : 'btn-primary'} auth-wide`}
            type="button"
            disabled={guestBusy}
            onClick={() => void continueAsGuest()}
          >
            {guestBusy ? (waking ? 'Waking the server… this can take a minute' : 'Starting…') : 'Continue as guest'}
          </button>
          <p className="hint auth-center">
            Guest data is saved but tied to this browser{anyAccounts ? '' : ', and sign-in is guest-only on this deployment'}.
          </p>
        </div>
      )}

    </AuthLayout>
  )
}
