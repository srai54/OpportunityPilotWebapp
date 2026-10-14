/** Pure helpers for the account screens (design round 3: AuthSignIn/SignUp/Verify/Reset/Onboarding). */

export type AuthScreen = 'signin' | 'signup' | 'verify' | 'reset' | 'new-password'

export const AUTH_PATHS: Record<AuthScreen, string> = {
  signin: '/signin',
  signup: '/signup',
  verify: '/verify',
  reset: '/reset',
  'new-password': '/reset/new',
}

/** Which account screen a signed-out visitor sees at this URL. Any other URL shows sign-in (deep links survive). */
export function authScreenFor(pathname: string): AuthScreen {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === AUTH_PATHS.signup) return 'signup'
  if (path === AUTH_PATHS.verify) return 'verify'
  if (path === AUTH_PATHS['new-password']) return 'new-password'
  if (path === AUTH_PATHS.reset) return 'reset'
  return 'signin'
}

/** True for URLs that only make sense while signed out; after sign-in they go to Overview. */
export function isAuthOnlyPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '')
  return Object.values(AUTH_PATHS).includes(path)
}

export const MIN_PASSWORD = 12

export interface PasswordStrength {
  /** 0 = too short … 4 = strong */
  score: 0 | 1 | 2 | 3 | 4
  label: 'Too short' | 'Weak' | 'Fair' | 'Good' | 'Strong'
}

/** A simple, explainable meter: length first, then variety of character kinds. */
export function passwordStrength(password: string): PasswordStrength {
  if (password.length < MIN_PASSWORD) return { score: 0, label: 'Too short' }
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length
  const longBonus = password.length >= 16 ? 1 : 0
  const score = Math.min(4, Math.max(1, kinds - 1 + longBonus)) as 1 | 2 | 3 | 4
  return { score, label: (['Weak', 'Fair', 'Good', 'Strong'] as const)[score - 1] }
}

export const RESEND_COOLDOWN_SECONDS = 60

/** Seconds left before "Resend" is allowed again. */
export function resendSecondsLeft(sentAtMs: number, nowMs: number, cooldown = RESEND_COOLDOWN_SECONDS): number {
  return Math.max(0, Math.ceil(cooldown - (nowMs - sentAtMs) / 1000))
}

export function formatCountdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/* ---- Stored per-browser flags ---- */

export const ONBOARDED_KEY = 'op.onboarded'
export const KEEP_SIGNED_IN_KEY = 'op.keepSignedIn'

export interface StoredGuestSession {
  token: string
  expiresAt: string
}

/** Guest credentials are usable only while their server-issued expiry is still in the future. */
export function activeGuestToken(session: StoredGuestSession | null, nowMs = Date.now()): string | null {
  if (!session?.token) return null
  const expiresAt = Date.parse(session.expiresAt)
  return Number.isFinite(expiresAt) && expiresAt > nowMs ? session.token : null
}

export function readFlag(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key)
    return v === null ? fallback : v === '1'
  } catch {
    return fallback
  }
}

export function writeFlag(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? '1' : '0')
  } catch {
    // Storage blocked: the choice lasts for this page view only.
  }
}

/** Supabase's assurance levels: aal1 = password or provider sign-in, aal2 = a second factor was also checked. */
export interface AssuranceLevels {
  currentLevel: string | null
  nextLevel: string | null
}

/** True when the account has an authenticator app set up but this session has not entered its code yet. */
export function needsMfa(levels: AssuranceLevels | null | undefined): boolean {
  return levels?.nextLevel === 'aal2' && levels.currentLevel !== 'aal2'
}

/** People paste codes as "123 456"; the check is on the six digits only. */
export function normalizeTotp(input: string): string {
  return input.replace(/\s+/g, '')
}

export function validTotp(input: string): boolean {
  return /^\d{6}$/.test(normalizeTotp(input))
}

/* ---- Hanko (main sign-in when VITE_HANKO_API_URL is set) ---- */

/** The part of Hanko's session check the app uses (`hanko.validateSession()`). */
export interface HankoSessionCheck {
  is_valid: boolean
  user_id?: string
  claims?: { subject?: string; email?: { address?: string } }
}

export interface HankoUser {
  id: string
  email: string
}

/** The signed-in Hanko user from a session check, or null when there is no valid session. */
export function hankoUserFrom(check: HankoSessionCheck | null | undefined): HankoUser | null {
  if (!check?.is_valid) return null
  const id = check.claims?.subject ?? check.user_id
  if (!id) return null
  return { id, email: check.claims?.email?.address || 'Signed in' }
}

/** Sign-in page query: `?with=classic` shows the older sign-in (Supabase, or the dev form) instead of Hanko. */
export const CLASSIC_SIGNIN_PARAM = 'with'
export const CLASSIC_SIGNIN_VALUE = 'classic'

/** A name that never collides with a half-finished earlier setup (Supabase rejects duplicate friendly names). */
export function factorName(now: Date): string {
  return `Authenticator ${now.toISOString().slice(0, 16).replace('T', ' ')}`
}
