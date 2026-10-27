/** Public, build-time configuration only. Secrets never belong in VITE_ variables. Each variable is read by name: copying the whole
 *  import.meta.env object would put every VITE_* value (Vercel's commit details included) into the browser bundle. */

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
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:5051',
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  supabasePublishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined,
  /** Hanko Cloud API URL (public). When set, Hanko is the main sign-in and Supabase becomes the older option. */
  hankoApiUrl: hankoApiUrl(import.meta.env.VITE_HANKO_API_URL as string | undefined),
  /** Local development sign-in without Supabase. Compiled out of production builds by the DEV check. */
  devAuth: import.meta.env.DEV && import.meta.env.VITE_DEV_AUTH === 'true',
  /** The Candidate workspace (job search for candidates). On by default, so nothing changes. VITE_SALES_ONLY=true makes this app the
   *  Sales portal only (no Candidate/Sales switch); candidates then use the candidate app, OpportunityPilotCandidate (2026-10-22). */
  candidateWorkspace: import.meta.env.VITE_SALES_ONLY !== 'true',
  /** Candidate job search (Find jobs, apply queue, campaigns, agent) in the Candidate view. Off (default since 2026-10-26): the Candidate
   *  view shows only what the sales team shares (My progress). The full job search lives in the candidate app; true brings it back here. */
  candidateJobSearch: import.meta.env.VITE_CANDIDATE_JOB_SEARCH === 'true',
  /** The candidate portal's address; share links open there. Empty: links stay on this app. */
  candidatePortalUrl: ((import.meta.env.VITE_CANDIDATE_PORTAL_URL as string | undefined) ?? '').trim().replace(/\/+$/, ''),
}

export const supabaseConfigured = Boolean(config.supabaseUrl && config.supabasePublishableKey)
export const hankoConfigured = Boolean(config.hankoApiUrl)
