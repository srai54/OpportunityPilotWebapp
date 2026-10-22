/** Public, build-time configuration only. Secrets never belong in VITE_ variables. */
const env = import.meta.env

/** The Hanko API URL to use, or undefined. https only; plain http is accepted for a local Hanko on localhost. */
export function hankoApiUrl(raw: string | undefined): string | undefined {
  let value = raw?.trim() ?? ''
  while (value.endsWith('/')) value = value.slice(0, -1)
  if (!value) return undefined
  try {
    const url = new URL(value)
    const local = url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
    return url.protocol === 'https:' || local ? value : undefined
  } catch {
    return undefined
  }
}

export const config = {
  apiBaseUrl: (env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:5051',
  supabaseUrl: env.VITE_SUPABASE_URL as string | undefined,
  supabasePublishableKey: env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined,
  /** Hanko Cloud API URL (public). When set, Hanko is the main sign-in and Supabase becomes the older option. */
  hankoApiUrl: hankoApiUrl(env.VITE_HANKO_API_URL as string | undefined),
  /** Local development sign-in without Supabase. Compiled out of production builds by the DEV check. */
  devAuth: import.meta.env.DEV && env.VITE_DEV_AUTH === 'true',
  /** The Candidate workspace (job search for candidates). On by default, so nothing changes. VITE_SALES_ONLY=true makes this app the
   *  Sales portal only (no Candidate/Sales switch); candidates then use the candidate app, OpportunityPilotCandidate (2026-10-22). */
  candidateWorkspace: env.VITE_SALES_ONLY !== 'true',
  /** The candidate portal's address; share links open there. Empty: links stay on this app. */
  candidatePortalUrl: ((env.VITE_CANDIDATE_PORTAL_URL as string | undefined) ?? '').trim().replace(/\/+$/, ''),
}

export const supabaseConfigured = Boolean(config.supabaseUrl && config.supabasePublishableKey)
export const hankoConfigured = Boolean(config.hankoApiUrl)
