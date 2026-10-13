import { useEffect, useState, type FormEvent } from 'react'
import { AuthCardHeader, AuthLayout } from './AuthLayout'
import { useAuth } from './AuthContext'
import { validTotp } from './authModel'
import { confirmTotp, listTotpFactors } from './mfa'

/** Shown after a password or provider sign-in when the account has an authenticator app: one six-digit code, then in. */
export function MfaChallengePage() {
  const { signOut, refreshMfa } = useAuth()
  const [factorId, setFactorId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listTotpFactors().then((f) => setFactorId(f[0]?.id ?? null)).catch((e: Error) => setError(e.message))
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!factorId || !validTotp(code)) return
    setBusy(true); setError(null)
    try {
      await confirmTotp(factorId, code)
      await refreshMfa()
    } catch (err) {
      setError((err as Error).message)
      setCode('')
    } finally { setBusy(false) }
  }

  return (
    <AuthLayout
      headline={<>One more step to keep<br />your account safe.</>}
      lead="Open your authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…) and enter the 6-digit code for OpportunityPilot."
      asideTitle="Lost your phone?"
      asideItems={['Sign out and use account recovery from your sign-in provider', 'The code changes every 30 seconds']}
    >
      <AuthCardHeader title="Enter your code" subtitle="From your authenticator app." />
      <form onSubmit={submit} className="stack-3">
        <div className="field">
          <label htmlFor="totp">6-digit code</label>
          <input id="totp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]*" maxLength={7} autoFocus value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
        {error && <p className="notice notice-danger" role="alert">{error}</p>}
        <button className="btn btn-primary auth-wide" type="submit" disabled={busy || !factorId || !validTotp(code)}>{busy ? 'Checking…' : 'Continue'}</button>
        <button className="btn btn-ghost auth-wide" type="button" onClick={() => void signOut()}>Sign out</button>
      </form>
    </AuthLayout>
  )
}
