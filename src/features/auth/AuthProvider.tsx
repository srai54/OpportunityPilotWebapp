import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Hanko } from '@teamhanko/hanko-elements'
import { api, configureApiAuth } from '../../lib/api'
import { config, hankoConfigured, supabaseConfigured } from '../../lib/config'
import { loadHanko } from '../../lib/hanko'
import { setSessionPersistence, supabase } from '../../lib/supabase'
import { activeGuestToken, AUTH_PATHS, hankoUserFrom, needsMfa, type HankoUser, type StoredGuestSession } from './authModel'
import { AuthContext } from './AuthContext'

/**
 * Hanko (when VITE_HANKO_API_URL is set) is the main sign-in and works next to any mode below; `hanko` says it is on.
 * supabase: real accounts (email + password, Google), with "Continue as guest" next to them when the API allows it.
 * dev: local development only. guest: demo mode — no accounts configured, the API issues random signed guest identities.
 */
export type AuthMode = 'supabase' | 'dev' | 'guest'

export type SignUpResult = 'signed-in' | 'verify-email'

export type SignedInWith = 'hanko' | 'supabase' | 'dev' | 'guest'

export interface AuthState {
  mode: AuthMode
  /** Hanko sign-in (passkeys, passwords, email codes, two-factor) is switched on and shown first. */
  hanko: boolean
  ready: boolean
  user: { id?: string; email: string; guest: boolean; provider: SignedInWith } | null
  sessionExpired: boolean
  /** The visitor opened a password-reset link: they are signed in only to choose a new password. */
  recovering: boolean
  signOut: () => Promise<void>
  devSignIn: (name: string) => void
  guestSignIn: () => Promise<void>
  /** Supabase only. Each throws an Error with Supabase's message on failure. */
  passwordSignIn: (email: string, password: string, keepSignedIn: boolean) => Promise<void>
  googleSignIn: () => Promise<void>
  microsoftSignIn: () => Promise<void>
  /** Signed in with a password or provider, but the account's authenticator-app code has not been entered yet. */
  mfaRequired: boolean
  /** Re-reads the assurance level after a code was verified or a factor was added or removed. */
  refreshMfa: () => Promise<void>
  signUp: (name: string, email: string, password: string) => Promise<SignUpResult>
  resendVerification: (email: string) => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  setNewPassword: (password: string, signOutOthers: boolean) => Promise<void>
}

const DEV_USER_KEY = 'op.devUser'
const GUEST_TOKEN_KEY = 'op.guestToken'
const TOKEN_REFRESH_WINDOW_MS = 60_000

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* storage unavailable; the session lasts for this tab only */
  }
}

function readGuestToken(): string | null {
  const stored = read(GUEST_TOKEN_KEY)
  if (!stored) return null
  try {
    const session = JSON.parse(stored) as StoredGuestSession
    const token = activeGuestToken(session)
    if (!token) write(GUEST_TOKEN_KEY, null)
    return token
  } catch {
    // Old releases stored only the token and therefore could not verify its expiry.
    write(GUEST_TOKEN_KEY, null)
    return null
  }
}

function requireSupabase() {
  if (!supabase) throw new Error('Accounts are not switched on for this deployment yet. Continue as guest instead.')
  return supabase
}

function origin() {
  return typeof window === 'undefined' ? '' : window.location.origin
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const mode: AuthMode = supabaseConfigured ? 'supabase' : config.devAuth ? 'dev' : 'guest'
  const [session, setSession] = useState<Session | null>(null)
  const [devUser, setDevUser] = useState<string | null>(mode === 'dev' ? read(DEV_USER_KEY) : null)
  const [guestToken, setGuestToken] = useState<string | null>(mode === 'dev' ? null : readGuestToken())
  const [ready, setReady] = useState(mode !== 'supabase')
  const [sessionExpired, setSessionExpired] = useState(false)
  const [recovering, setRecovering] = useState(false)
  const [mfaRequired, setMfaRequired] = useState(false)
  const refreshPromise = useRef<Promise<Session | null> | null>(null)
  const [hankoUser, setHankoUser] = useState<HankoUser | null>(null)
  const [hankoReady, setHankoReady] = useState(!hankoConfigured)
  const hankoClient = useRef<Hanko | null>(null)
  const hankoSignedIn = useRef(false)

  useEffect(() => {
    hankoSignedIn.current = hankoUser !== null
  }, [hankoUser])

  useEffect(() => {
    if (!hankoConfigured) return
    let live = true
    const cleanups: (() => void)[] = []
    const check = async (hanko: Hanko) => {
      try {
        const user = hankoUserFrom(await hanko.validateSession())
        if (!live) return
        setHankoUser(user)
        if (user) setSessionExpired(false)
      } catch {
        if (live) setHankoUser(null)
      }
    }
    void loadHanko()
      .then(async (hanko) => {
        if (!live) return
        hankoClient.current = hanko
        cleanups.push(
          hanko.onSessionCreated(() => void check(hanko)),
          hanko.onSessionExpired(() => {
            if (hankoSignedIn.current) setSessionExpired(true)
            setHankoUser(null)
          }),
          hanko.onUserLoggedOut(() => setHankoUser(null)),
          hanko.onUserDeleted(() => setHankoUser(null)),
        )
        await check(hanko)
      })
      // Hanko could not load (offline, blocked): the sign-in page says so and the other options still work.
      .catch(() => undefined)
      .finally(() => {
        if (live) setHankoReady(true)
      })
    return () => {
      live = false
      cleanups.forEach((stop) => stop())
    }
  }, [])

  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data, error }) => {
      setSession(error ? null : data.session)
      if (error) setSessionExpired(true)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      setReady(true)
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      if (event === 'SIGNED_OUT') setRecovering(false)
      if (s && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')) {
        setSessionExpired(false)
      }
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const refreshMfa = useCallback(async () => {
    if (!supabase) return
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    setMfaRequired(!error && needsMfa(data))
  }, [])

  useEffect(() => {
    if (!supabase) return
    if (!session) return
    let live = true
    void supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data, error }) => { if (live) setMfaRequired(!error && needsMfa(data)) })
    return () => { live = false }
  }, [session])

  const signOut = useCallback(async () => {
    if (hankoClient.current && hankoSignedIn.current) {
      try {
        await hankoClient.current.logout()
      } catch {
        /* the Hanko session is already gone; the local state below is cleared either way */
      }
    }
    setHankoUser(null)
    if (supabase) await supabase.auth.signOut()
    write(DEV_USER_KEY, null)
    write(GUEST_TOKEN_KEY, null)
    setSession(null)
    setDevUser(null)
    setGuestToken(null)
    setRecovering(false)
  }, [])

  const currentAccessToken = useCallback(async (): Promise<string | null> => {
    if (!supabase) return null
    const { data, error } = await supabase.auth.getSession()
    if (error || !data.session) return null
    const expiresAtMs = (data.session.expires_at ?? 0) * 1000
    if (expiresAtMs > Date.now() + TOKEN_REFRESH_WINDOW_MS) return data.session.access_token

    if (!refreshPromise.current) {
      refreshPromise.current = supabase.auth
        .refreshSession()
        .then(({ data: refreshed, error: refreshError }) => {
          if (refreshError) return null
          return refreshed.session
        })
        .finally(() => {
          refreshPromise.current = null
        })
    }
    return (await refreshPromise.current)?.access_token ?? null
  }, [])

  useEffect(() => {
    configureApiAuth(
      async (): Promise<Record<string, string>> => {
        if (hankoClient.current && hankoSignedIn.current) {
          const token = hankoClient.current.getSessionToken()
          if (token) return { Authorization: `Bearer ${token}` }
        }
        if (supabase) {
          const token = await currentAccessToken()
          if (token) return { Authorization: `Bearer ${token}` }
        }
        if (mode === 'dev' && devUser) return { 'X-Dev-User': devUser }
        if (guestToken) return { Authorization: `Bearer ${guestToken}` }
        return {}
      },
      () => {
        // The API rejected the credentials: drop them and say why on the sign-in screen.
        setSessionExpired(true)
        void signOut()
      },
    )
    return () => configureApiAuth(async () => ({}), () => {})
  }, [currentAccessToken, devUser, guestToken, mode, signOut, hankoUser])

  const value = useMemo<AuthState>(() => {
    const user: AuthState['user'] = hankoUser
      ? { id: hankoUser.id, email: hankoUser.email, guest: false, provider: 'hanko' }
      : session
        ? { id: session.user.id, email: session.user.email ?? 'Signed in', guest: false, provider: 'supabase' }
        : mode === 'dev' && devUser
          ? { email: devUser, guest: false, provider: 'dev' }
          : guestToken
            ? { email: 'Guest', guest: true, provider: 'guest' }
            : null

    return {
      mode,
      hanko: hankoConfigured,
      ready: ready && hankoReady,
      user,
      sessionExpired,
      recovering,
      signOut,
      devSignIn: (name: string) => {
        write(DEV_USER_KEY, name)
        setSessionExpired(false)
        setDevUser(name)
      },
      guestSignIn: async () => {
        const guest = await api<StoredGuestSession>('/api/v1/auth/guest', { method: 'POST' })
        write(GUEST_TOKEN_KEY, JSON.stringify(guest))
        setSessionExpired(false)
        setGuestToken(guest.token)
      },
      passwordSignIn: async (email, password, keepSignedIn) => {
        setSessionPersistence(keepSignedIn)
        const { error } = await requireSupabase().auth.signInWithPassword({ email, password })
        if (error) throw new Error(error.message)
        setSessionExpired(false)
      },
      googleSignIn: async () => {
        const { error } = await requireSupabase().auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: origin() },
        })
        if (error) throw new Error(error.message)
      },
      microsoftSignIn: async () => {
        const { error } = await requireSupabase().auth.signInWithOAuth({
          provider: 'azure',
          options: { redirectTo: origin(), scopes: 'email' },
        })
        if (error) throw new Error(error.message)
      },
      // Hanko asks for its own second factor inside <hanko-auth>; this gate is for Supabase sessions only.
      mfaRequired: session && !hankoUser ? mfaRequired : false,
      refreshMfa,
      signUp: async (name, email, password) => {
        const { data, error } = await requireSupabase().auth.signUp({
          email,
          password,
          options: { data: { full_name: name }, emailRedirectTo: origin() },
        })
        if (error) throw new Error(error.message)
        return data.session ? 'signed-in' : 'verify-email'
      },
      resendVerification: async (email) => {
        const { error } = await requireSupabase().auth.resend({
          type: 'signup',
          email,
          options: { emailRedirectTo: origin() },
        })
        if (error) throw new Error(error.message)
      },
      requestPasswordReset: async (email) => {
        const { error } = await requireSupabase().auth.resetPasswordForEmail(email, {
          redirectTo: origin() + AUTH_PATHS['new-password'],
        })
        // Same confirmation whether or not the account exists: only surface errors that are not about the address.
        if (error && error.status !== 400 && error.status !== 404) throw new Error(error.message)
      },
      setNewPassword: async (password, signOutOthers) => {
        const client = requireSupabase()
        const { error } = await client.auth.updateUser({ password })
        if (error) throw new Error(error.message)
        if (signOutOthers) await client.auth.signOut({ scope: 'others' })
        setRecovering(false)
      },
    }
  }, [mode, ready, hankoReady, hankoUser, session, devUser, guestToken, sessionExpired, recovering, signOut, mfaRequired, refreshMfa])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
