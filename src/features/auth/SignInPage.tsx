import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ErrorNotice } from '../../components/ErrorNotice'
import { ApiError, ApiStillUnreachableError, ApiUnreachableError } from '../../lib/api'
import { isWakingError, wakeRetryDelay } from '../../lib/wakeRetry'
import { AuthCardHeader, AuthLayout, AuthTabs, Divider, PasswordField, ProviderButtons } from './AuthLayout'
import { AUTH_PATHS, KEEP_SIGNED_IN_KEY, readFlag } from './authModel'
import { useAuth } from './AuthContext'

const WAKE_NOTE =
  'The API sleeps when idle on free hosting. The first request after a quiet spell takes up to a minute — you will see “Starting the API service…”, not an error.'

/** Design AuthSignIn: email + password, Google, keep signed in, forgot link, and "Continue as guest". */
export function SignInPage() {
  const { mode, sessionExpired, devSignIn, guestSignIn, passwordSignIn, googleSignIn, microsoftSignIn } = useAuth()
  const accounts = mode === 'supabase'
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
          Opportunities that fit you —<br />
          with the evidence attached.
        </>
      }
      lead="It reads the sources you choose, scores what it finds against criteria you set, and shows why. You approve what happens next. Nothing is sent or applied on its own."
      asideTitle="Built for"
      asideItems={['Candidates looking for roles', 'Sales teams looking for customers']}
      footnote={WAKE_NOTE}
    >
      {accounts && <AuthTabs active="signin" />}
      <AuthCardHeader title="Sign in" subtitle="Welcome back." />

      {sessionExpired && (
        <p className="notice notice-warning" role="status">
          Your session ended. Sign in again to continue — anything already saved is still there.
        </p>
      )}

      {mode === 'dev' ? (
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
          two-step sign-in appear here once the site owner sets <code>VITE_SUPABASE_URL</code> and{' '}
          <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> on Vercel and redeploys. Until then, continue as a guest.
        </p>
      )}

      {mode !== 'dev' && (
        <div className="stack-2">
          {accounts && <Divider label="No account needed" />}
          {guestError && <ErrorNotice error={guestError} />}
          <button
            className={`btn ${accounts ? 'btn-secondary' : 'btn-primary'} auth-wide`}
            type="button"
            disabled={guestBusy}
            onClick={() => void continueAsGuest()}
          >
            {guestBusy ? (waking ? 'Waking the server… this can take a minute' : 'Starting…') : 'Continue as guest'}
          </button>
          <p className="hint auth-center">
            Guest data is saved but tied to this browser{accounts ? '' : ', and sign-in is guest-only on this deployment'}.
          </p>
        </div>
      )}

    </AuthLayout>
  )
}
