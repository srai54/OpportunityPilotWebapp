import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthCardHeader, AuthLayout, AuthTabs, Divider, PasswordField, ProviderButtons } from './AuthLayout'
import { AUTH_PATHS, MIN_PASSWORD } from './authModel'
import { useAuth } from './AuthContext'

/** Design AuthSignUp: name, work email, password with strength, and consent stating what is stored. */
export function SignUpPage() {
  const { mode, signUp, googleSignIn, microsoftSignIn } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (mode !== 'supabase') {
    return (
      <AuthLayout
        headline="Accounts are coming."
        lead="This deployment runs in demo mode: everyone continues as a private guest."
        asideTitle="Until then"
        asideItems={['Guest data is saved in your browser', 'Nothing is sent or applied on its own']}
      >
        <AuthCardHeader title="Create your account" />
        <p className="notice notice-neutral">
          Accounts are not switched on for this deployment yet. They appear once the Supabase sign-in keys are set.
        </p>
        <Link className="btn btn-primary auth-wide" to={AUTH_PATHS.signin}>
          Continue as guest instead
        </Link>
      </AuthLayout>
    )
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters.`)
      return
    }
    setBusy(true)
    try {
      const result = await signUp(name.trim(), email.trim(), password)
      if (result === 'verify-email') navigate(`${AUTH_PATHS.verify}?email=${encodeURIComponent(email.trim())}`)
      // 'signed-in': the session arrives through onAuthStateChange and the app opens.
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      headline={
        <>
          Stop opening forty tabs
          <br />
          to find four worth applying to.
        </>
      }
      lead="Set your criteria once. Every run comes back ranked, de-duplicated, and with the sentence that justifies each score. You approve a batch in one pass."
      asideTitle="What you get"
      asideItems={['Unlimited campaigns and sources', 'Your data, exportable at any time']}
    >
      <AuthTabs active="signup" />
      <AuthCardHeader title="Create an account" subtitle="Free while the project is in demo. No card." />
      <form onSubmit={submit} className="stack-3">
        <ProviderButtons
          verb="Sign up"
          onGoogle={() => void googleSignIn().catch((err: Error) => setError(err.message))}
          onMicrosoft={() => void microsoftSignIn().catch((err: Error) => setError(err.message))}
          disabled={busy}
        />
        <Divider label="or use your email" />
        <div className="field">
          <label htmlFor="name">Full name</label>
          <input id="name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="email">Work email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <PasswordField id="password" label="Password" value={password} onChange={setPassword} autoComplete="new-password" showStrength />
        <label className="checkbox-row">
          <input type="checkbox" required checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>
            I understand what is stored: the profile you write and the opportunities your campaigns find. Nothing is
            posted or sent on your behalf.
          </span>
        </label>
        {error && (
          <p className="notice notice-danger" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn-primary auth-wide" type="submit" disabled={busy || !agreed}>
          {busy ? 'Creating…' : 'Create account'}
        </button>
      </form>
    </AuthLayout>
  )
}
