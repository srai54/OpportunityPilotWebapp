import { useState, type ReactNode } from 'react'
import { ThemeToggle } from '../shell/ThemeToggle'
import { Link } from 'react-router-dom'
import { AUTH_PATHS, CLASSIC_SIGNIN_PARAM, CLASSIC_SIGNIN_VALUE } from './authModel'
import { useAuth } from './AuthContext'
import { MIN_PASSWORD, passwordStrength } from './authModel'
import { AuthShowcase } from './AuthShowcase'

export function BrandMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" />
    </svg>
  )
}

/** Two panels (design AuthSignIn/SignUp/Verify/Reset): a dark story panel and the form. Story hides under 860 px. */
export function AuthLayout({
  headline,
  lead,
  asideTitle,
  asideItems,
  children,
  footnote,
}: {
  headline: ReactNode
  lead: string
  asideTitle: string
  asideItems: string[]
  children: ReactNode
  footnote?: ReactNode
}) {
  return (
    <div className="auth auth-v6">
      <div className="auth-theme"><ThemeToggle /></div>
      <aside className="auth-story" aria-label="About OpportunityPilot">
        <div className="auth-brand">
          <span className="auth-brand-mark">
            <BrandMark />
          </span>
          OpportunityPilot
        </div>
        <h2 className="auth-headline">{headline}</h2>
        <p className="auth-lead">{lead}</p>
        <AuthShowcase />
        <div className="grow" />
        <div className="auth-aside">
          <div className="auth-aside-title">{asideTitle}</div>
          <ul className="auth-trust">
            {asideItems.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </div>
      </aside>
      <main className="auth-main">
        <div className="auth-brand auth-brand-compact">
          <span className="auth-brand-mark">
            <BrandMark />
          </span>
          OpportunityPilot
        </div>
        <div className="auth-mobile-head" aria-hidden="true">{headline}</div>
        <div className="auth-card">{children}</div>
        {footnote && <p className="auth-footnote">{footnote}</p>}
      </main>
    </div>
  )
}

export function AuthCardHeader({ title, subtitle }: { title: string; subtitle?: ReactNode }) {
  return (
    <header className="auth-card-head">
      <h1 className="auth-title">{title}</h1>
      {subtitle && <p className="auth-subtitle">{subtitle}</p>}
    </header>
  )
}

export function Divider({ label }: { label: string }) {
  return (
    <div className="auth-divider" role="separator">
      <span>{label}</span>
    </div>
  )
}

export function GoogleButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className="btn btn-secondary auth-wide" onClick={onClick} disabled={disabled}>
      {/* Neutral placeholder mark, as in the design: Google's official asset is required for a real logo. */}
      <span className="auth-google-mark" aria-hidden="true">
        G
      </span>
      {label}
    </button>
  )
}

/** The two sign-in choices every account screen leads with: one tap, no password to remember. Neutral marks, not brand logos. */
export function ProviderButtons({ verb, onGoogle, onMicrosoft, disabled }: { verb: 'Continue' | 'Sign up'; onGoogle: () => void; onMicrosoft: () => void; disabled?: boolean }) {
  return (
    <div className="auth-providers">
      <button type="button" className="btn btn-secondary auth-wide" onClick={onMicrosoft} disabled={disabled}>
        <span className="auth-provider-mark auth-provider-ms" aria-hidden="true">M</span>
        {verb} with Microsoft
      </button>
      <GoogleButton label={`${verb} with Google`} onClick={onGoogle} disabled={disabled} />
    </div>
  )
}

/** Sign in and Create account side by side, so a new visitor never has to look for the other one. */
export function AuthTabs({ active }: { active: 'signin' | 'signup' }) {
  // With Hanko on, these tabs belong to the older (Supabase) sign-in, so "Sign in" returns to that form.
  const { hanko } = useAuth()
  const signin = hanko ? `${AUTH_PATHS.signin}?${CLASSIC_SIGNIN_PARAM}=${CLASSIC_SIGNIN_VALUE}` : AUTH_PATHS.signin
  return (
    <nav className="auth-tabs" aria-label="Account">
      <Link to={signin} aria-current={active === 'signin' ? 'page' : undefined}>Sign in</Link>
      <Link to={AUTH_PATHS.signup} aria-current={active === 'signup' ? 'page' : undefined}>Create account</Link>
    </nav>
  )
}

export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  showStrength,
  labelAside,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  autoComplete: 'current-password' | 'new-password'
  showStrength?: boolean
  labelAside?: ReactNode
}) {
  const [visible, setVisible] = useState(false)
  const strength = passwordStrength(value)
  return (
    <div className="field">
      <div className="row">
        <label htmlFor={id}>{label}</label>
        <div className="grow" />
        {labelAside}
      </div>
      <div className="auth-input-wrap">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          required
          minLength={autoComplete === 'new-password' ? MIN_PASSWORD : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={showStrength ? `${id}-strength` : undefined}
        />
        <button
          type="button"
          className="auth-reveal"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
      {showStrength && (
        <div id={`${id}-strength`} className="auth-strength" aria-live="polite">
          <span className="auth-meter" data-score={strength.score} aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span>
            Strength: <strong>{value ? strength.label : '—'}</strong> · {MIN_PASSWORD}+ characters, not a word you use
            elsewhere
          </span>
        </div>
      )}
    </div>
  )
}
