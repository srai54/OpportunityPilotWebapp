import type {
  CampaignCriteria,
  OpportunityMode,
  ProfileType,
  SourceCapabilityKey,
  SourceKind,
  SourceStatus,
  WorkMode,
} from '../../lib/types'

export type SupportedMode = OpportunityMode

export const MODES: { mode: OpportunityMode; label: string; description: string; supported: boolean }[] = [
  { mode: 'Job', label: 'Jobs', description: 'Postings that fit your experience', supported: true },
  { mode: 'Customer', label: 'Customers', description: 'Companies with a problem you solve', supported: true },
  { mode: 'Partner', label: 'Partners', description: 'Companies to build or resell with', supported: true },
  { mode: 'Investor', label: 'Investors', description: 'Funds that back your stage', supported: true },
  { mode: 'Freelance', label: 'Freelance', description: 'Projects that need your services', supported: true },
]

export const MODE_LABELS: Record<OpportunityMode, string> = {
  Job: 'Job',
  Customer: 'Customer',
  Partner: 'Partner',
  Investor: 'Investor',
  Freelance: 'Freelance',
}

export function isSupportedMode(mode: OpportunityMode): mode is SupportedMode {
  return MODES.some((item) => item.mode === mode && item.supported)
}

/** A sensible starting mode for the profile the user picked; they can still change it before saving. */
export function suggestedMode(profileType: ProfileType | undefined): SupportedMode {
  return profileType === 'Candidate' ? 'Job' : 'Customer'
}

export const WORK_MODES: { value: WorkMode; label: string }[] = [
  { value: 'Remote', label: 'Remote' },
  { value: 'Hybrid', label: 'Hybrid' },
  { value: 'Onsite', label: 'On-site' },
]

export const RESULT_LIMIT = { min: 1, max: 100, default: 25 }

/** "Suggest jobs for approval": off (null) by default; when on, the minimum fit score (contract: 1–100). */
export const AUTO_SUGGEST = { min: 1, max: 100, default: 80 }

/** Why the threshold cannot be saved, or null when it can (null threshold = off, always valid). */
export function autoSuggestProblem(value: number | null): string | null {
  if (value === null) return null
  if (!Number.isInteger(value) || value < AUTO_SUGGEST.min || value > AUTO_SUGGEST.max)
    return `Set the minimum fit score for suggestions to a whole number from ${AUTO_SUGGEST.min} to ${AUTO_SUGGEST.max}, or turn suggestions off.`
  return null
}

export function emptyCriteria(): CampaignCriteria {
  return {
    keywords: [],
    requiredSkills: [],
    preferredSkills: [],
    candidateYears: null,
    locations: [],
    workModes: [],
    industries: [],
    problems: [],
    signals: [],
    excludeKeywords: [],
    excludeOrganizations: [],
    excludeStaffingAgencies: false,
    maxPostingAgeDays: null,
  }
}

/** Which criteria each mode uses. The rest are cleared on save so they cannot silently affect a run. */
const MODE_FIELDS: Record<SupportedMode, (keyof CampaignCriteria)[]> = {
  Job: ['keywords', 'requiredSkills', 'preferredSkills', 'candidateYears', 'locations', 'workModes', 'excludeKeywords', 'excludeOrganizations', 'excludeStaffingAgencies', 'maxPostingAgeDays'],
  Customer: ['keywords', 'industries', 'problems', 'locations', 'signals', 'excludeKeywords', 'excludeOrganizations'],
  Partner: ['keywords', 'industries', 'problems', 'locations', 'signals', 'excludeKeywords', 'excludeOrganizations'],
  Investor: ['keywords', 'industries', 'problems', 'locations', 'signals', 'excludeKeywords', 'excludeOrganizations'],
  Freelance: ['keywords', 'industries', 'problems', 'locations', 'signals', 'excludeKeywords', 'excludeOrganizations'],
}

/** Fills gaps in a criteria object from the server (older rows may miss newer lists) and drops other modes' fields. */
export function criteriaForMode(mode: SupportedMode, criteria: Partial<CampaignCriteria> | undefined): CampaignCriteria {
  const base = emptyCriteria()
  const keep = new Set(MODE_FIELDS[mode])
  for (const key of Object.keys(base) as (keyof CampaignCriteria)[]) {
    if (!keep.has(key)) continue
    const value = criteria?.[key]
    if (key === 'candidateYears') {
      base.candidateYears = typeof value === 'number' && Number.isFinite(value) ? value : null
    } else if (key === 'maxPostingAgeDays') {
      base.maxPostingAgeDays = typeof value === 'number' && Number.isFinite(value) ? value : null
    } else if (key === 'excludeStaffingAgencies') {
      base.excludeStaffingAgencies = value === true
    } else if (Array.isArray(value)) {
      // workModes is narrowed below; every other list is free text.
      ;(base as unknown as Record<string, string[]>)[key] = normaliseTags(value as string[])
    }
  }
  if (base.workModes.length) base.workModes = base.workModes.filter((m) => WORK_MODES.some((w) => w.value === m))
  return base
}

// ---------- Tags ----------

export const TAG_MAX_LENGTH = 100
export const TAG_MAX_COUNT = 50

/** Splits typed or pasted text on commas and new lines and tidies each piece. */
export function parseTagInput(raw: string): string[] {
  return raw
    .split(/[,\n\r;]+/)
    .map((t) => t.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

const tagKey = (t: string) => t.toLocaleLowerCase()

/** Trimmed, case-insensitively unique, first spelling wins. */
export function normaliseTags(tags: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of tags) {
    const tag = raw.replace(/\s+/g, ' ').trim().slice(0, TAG_MAX_LENGTH)
    if (!tag || seen.has(tagKey(tag))) continue
    seen.add(tagKey(tag))
    out.push(tag)
  }
  return out
}

export interface AddTagsResult {
  values: string[]
  added: string[]
  duplicates: string[]
  /** Tags dropped because the list is full. */
  overflow: string[]
}

export function addTags(existing: string[], raw: string, max = TAG_MAX_COUNT): AddTagsResult {
  const values = [...existing]
  const seen = new Set(existing.map(tagKey))
  const result: AddTagsResult = { values, added: [], duplicates: [], overflow: [] }
  for (const piece of parseTagInput(raw)) {
    const tag = piece.slice(0, TAG_MAX_LENGTH)
    if (seen.has(tagKey(tag))) result.duplicates.push(tag)
    else if (values.length >= max) result.overflow.push(tag)
    else {
      seen.add(tagKey(tag))
      values.push(tag)
      result.added.push(tag)
    }
  }
  return result
}

// ---------- Weights ----------

export interface WeightDef {
  key: string
  label: string
  /** What turns the criterion on; when nothing is configured the server leaves it out of the score. */
  needs: string
}

export const WEIGHT_DEFS: Record<SupportedMode, WeightDef[]> = {
  Job: [
    { key: 'mandatorySkills', label: 'Required skills', needs: 'required skills' },
    { key: 'experience', label: 'Experience', needs: 'your years of experience' },
    { key: 'location', label: 'Location and work mode', needs: 'locations or work modes' },
    { key: 'preferredSkills', label: 'Preferred skills', needs: 'preferred skills' },
  ],
  Customer: [
    { key: 'industry', label: 'Industry', needs: 'industries' },
    { key: 'problem', label: 'Problem you solve', needs: 'problems' },
    { key: 'geography', label: 'Geography', needs: 'locations' },
    { key: 'signal', label: 'Published signals', needs: 'signals' },
    { key: 'contactPath', label: 'Contact path', needs: 'nothing — always scored' },
  ],
  Partner: [
    { key: 'industry', label: 'Industry', needs: 'industries' }, { key: 'problem', label: 'Partnership fit', needs: 'problems' },
    { key: 'geography', label: 'Geography', needs: 'locations' }, { key: 'signal', label: 'Published signals', needs: 'signals' },
    { key: 'contactPath', label: 'Contact path', needs: 'nothing — always scored' },
  ],
  Investor: [
    { key: 'industry', label: 'Investment focus', needs: 'industries' }, { key: 'problem', label: 'Thesis fit', needs: 'problems' },
    { key: 'geography', label: 'Geography', needs: 'locations' }, { key: 'signal', label: 'Published signals', needs: 'signals' },
    { key: 'contactPath', label: 'Contact path', needs: 'nothing — always scored' },
  ],
  Freelance: [
    { key: 'industry', label: 'Project category', needs: 'industries' }, { key: 'problem', label: 'Need you solve', needs: 'problems' },
    { key: 'geography', label: 'Geography', needs: 'locations' }, { key: 'signal', label: 'Project signals', needs: 'signals' },
    { key: 'contactPath', label: 'Contact path', needs: 'nothing — always scored' },
  ],
}

export const DEFAULT_WEIGHTS: Record<SupportedMode, Record<string, number>> = {
  Job: { mandatorySkills: 40, experience: 20, location: 20, preferredSkills: 20 },
  Customer: { industry: 25, problem: 30, geography: 15, signal: 20, contactPath: 10 },
  Partner: { industry: 25, problem: 30, geography: 15, signal: 20, contactPath: 10 },
  Investor: { industry: 25, problem: 30, geography: 15, signal: 20, contactPath: 10 },
  Freelance: { industry: 25, problem: 30, geography: 15, signal: 20, contactPath: 10 },
}

export function clampWeight(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, Math.round(value)))
}

/** The mode's criterion keys only, defaults for anything missing, each clamped to 0–100. */
export function weightsForMode(mode: SupportedMode, weights: Record<string, number> | undefined): Record<string, number> {
  return Object.fromEntries(
    WEIGHT_DEFS[mode].map((d) => [d.key, clampWeight(weights?.[d.key] ?? DEFAULT_WEIGHTS[mode][d.key])]),
  )
}

/**
 * Mirrors the contract: a criterion is left out of the score only when the user configured nothing for it.
 * Unknown evidence does not make it inapplicable — that still counts, as 0 points.
 */
export function applicableCriteria(mode: SupportedMode, c: CampaignCriteria): Set<string> {
  const on = new Set<string>()
  if (mode === 'Job') {
    if (c.requiredSkills.length) on.add('mandatorySkills')
    if (c.candidateYears !== null) on.add('experience')
    if (c.locations.length || c.workModes.length) on.add('location')
    if (c.preferredSkills.length) on.add('preferredSkills')
  } else {
    if (c.industries.length) on.add('industry')
    if (c.problems.length) on.add('problem')
    if (c.locations.length) on.add('geography')
    if (c.signals.length) on.add('signal')
    on.add('contactPath')
  }
  return on
}

/**
 * Preview of the server's normalisation: applicable weights scaled to sum 100 as whole numbers
 * (largest remainder, so the shares always add up). Not-applicable criteria get null.
 */
export function normaliseWeights(weights: Record<string, number>, applicable: Set<string>): Record<string, number | null> {
  const keys = Object.keys(weights)
  const active = keys.filter((k) => applicable.has(k))
  const total = active.reduce((sum, k) => sum + clampWeight(weights[k]), 0)
  const out: Record<string, number | null> = Object.fromEntries(keys.map((k) => [k, applicable.has(k) ? 0 : null]))
  if (total === 0) return out

  const exact = active.map((k) => ({ k, v: (clampWeight(weights[k]) * 100) / total }))
  let assigned = 0
  for (const e of exact) {
    out[e.k] = Math.floor(e.v)
    assigned += Math.floor(e.v)
  }
  // Hand the leftover points to the largest fractions; ties keep declaration order.
  const byRemainder = [...exact].sort((a, b) => b.v - Math.floor(b.v) - (a.v - Math.floor(a.v)))
  for (let i = 0; assigned < 100 && i < byRemainder.length; i++, assigned++) {
    const k = byRemainder[i].k
    out[k] = (out[k] ?? 0) + 1
  }
  return out
}

// ---------- Summaries and labels ----------

export interface CriteriaLine {
  label: string
  value: string
  kind: 'search' | 'hard' | 'soft'
}

const join = (xs: string[]) => xs.join(', ')

/** Plain-language lines for the review step; empty lists are not shown as if they were filters. */
export function criteriaSummary(mode: SupportedMode, c: CampaignCriteria): CriteriaLine[] {
  const lines: CriteriaLine[] = []
  const push = (label: string, value: string, kind: CriteriaLine['kind']) => value && lines.push({ label, value, kind })
  push(mode === 'Job' ? 'Job titles and search phrases' : 'Product and search words', join(c.keywords), 'search')
  if (mode === 'Job') {
    push('Required skills', join(c.requiredSkills), 'hard')
    push('Work modes', join(c.workModes.map((m) => WORK_MODES.find((w) => w.value === m)?.label ?? m)), 'hard')
    push('Locations', join(c.locations), 'hard')
    push('Preferred skills', join(c.preferredSkills), 'soft')
    push('Your experience', c.candidateYears === null ? '' : `${c.candidateYears} years`, 'soft')
  } else {
    push('Geography', join(c.locations), 'hard')
    push('Industries', join(c.industries), 'soft')
    push('Problems you solve', join(c.problems), 'soft')
    push('Signals', join(c.signals), 'soft')
  }
  push('Excluded keywords', join(c.excludeKeywords), 'hard')
  push('Excluded organisations', join(c.excludeOrganizations), 'hard')
  push('Staffing agencies', c.excludeStaffingAgencies ? 'Excluded' : '', 'hard')
  push('Posting age', c.maxPostingAgeDays === null ? '' : `Last ${c.maxPostingAgeDays} days`, 'hard')
  return lines
}

export const SOURCE_KIND_LABELS: Record<SourceKind, string> = {
  Paste: 'Pasted text',
  Csv: 'CSV import',
  Url: 'Public URL',
  Feed: 'RSS / Atom feed',
  Agent: 'Local agent',
  Greenhouse: 'Greenhouse careers board',
  Lever: 'Lever careers board',
  Adzuna: 'Adzuna job search',
  Ashby: 'Ashby careers board',
  SmartRecruiters: 'SmartRecruiters careers board',
  Recruitee: 'Recruitee careers board',
  Workable: 'Workable careers board',
  Workday: 'Workday careers site',
  JobSearch: 'Job board search (Indeed, LinkedIn, SEEK)',
  Remotive: 'Remotive remote jobs',
  RemoteOk: 'Remote OK jobs',
  Arbeitnow: 'Arbeitnow jobs (Germany, Europe, remote)',
  Jobicy: 'Jobicy remote jobs',
  WeWorkRemotely: 'We Work Remotely jobs',
}

/** Open job sources the server fetches from documented public APIs. Job campaigns only. */
export type JobSourceKind = Extract<
  SourceKind,
  | 'Greenhouse'
  | 'Lever'
  | 'Adzuna'
  | 'Ashby'
  | 'SmartRecruiters'
  | 'Recruitee'
  | 'Workable'
  | 'Workday'
  | 'JobSearch'
  | 'Remotive'
  | 'RemoteOk'
  | 'Arbeitnow'
  | 'Jobicy'
  | 'WeWorkRemotely'
>
export type BoardKind = Extract<SourceKind, 'Greenhouse' | 'Lever' | 'Ashby' | 'SmartRecruiters' | 'Recruitee' | 'Workable'>
export type AggregateBoardKind = Extract<SourceKind, 'Remotive' | 'RemoteOk' | 'Arbeitnow' | 'Jobicy' | 'WeWorkRemotely'>

export const JOB_SOURCE_CAPABILITY: Record<JobSourceKind, SourceCapabilityKey> = {
  Greenhouse: 'greenhouse',
  Lever: 'lever',
  Adzuna: 'adzuna',
  Ashby: 'ashby',
  SmartRecruiters: 'smartrecruiters',
  Recruitee: 'recruitee',
  Workable: 'workable',
  Workday: 'workday',
  JobSearch: 'job-boards',
  Remotive: 'remotive',
  RemoteOk: 'remoteok',
  Arbeitnow: 'arbeitnow',
  Jobicy: 'jobicy',
  WeWorkRemotely: 'weworkremotely',
}

/** The source kinds a campaign of this mode may add; the API rejects the job sources for Customer campaigns. */
export function sourceKindAllowed(kind: SourceKind, mode: OpportunityMode): boolean {
  // A job board search gives jobs to Job campaigns and hiring companies (leads) to every other mode.
  if (kind === 'JobSearch') return true
  if (kind in JOB_SOURCE_CAPABILITY) return mode === 'Job'
  return true
}

export type SearchBoard = 'Indeed' | 'LinkedIn' | 'Seek'
export const SEARCH_BOARDS: { value: SearchBoard; label: string }[] = [
  { value: 'Indeed', label: 'Indeed' },
  { value: 'LinkedIn', label: 'LinkedIn' },
  { value: 'Seek', label: 'SEEK (Australia / New Zealand)' },
]

/** What a job board search will look for: Job → first 3 keywords; other modes → keywords, then buying signals. */
export function jobSearchTerms(criteria: Pick<CampaignCriteria, 'keywords' | 'signals' | 'locations'>, mode: OpportunityMode): {
  terms: string[]
  location: string | null
  remoteOnly: boolean
} {
  const pool = mode === 'Job' ? criteria.keywords : [...criteria.keywords, ...(criteria.signals ?? [])]
  const seen = new Set<string>()
  const terms = pool.map((t) => t.trim()).filter((t) => t && !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase())).slice(0, 3)
  const location = criteria.locations.find((l) => l.trim() && l.trim().toLowerCase() !== 'remote')?.trim() ?? null
  return { terms, location, remoteOnly: location === null && criteria.locations.length > 0 }
}

/** Why a run would find nothing: a job-board search source with no keywords (or signals) to search for. */
export function searchSourceBlocker(
  sourceKinds: string[],
  criteria: Pick<CampaignCriteria, 'keywords' | 'signals' | 'locations'>,
  mode: OpportunityMode,
): string | null {
  if (!sourceKinds.includes('JobSearch')) return null
  return jobSearchTerms(criteria, mode).terms.length > 0 ? null
    : `The job-board search source has nothing to search for. Go back to step 2 and add ${mode === 'Job' ? 'job titles or search phrases' : 'keywords or buying signals'}, then save.`
}

/** Same pattern the API validates a board token / company slug with. */
export const BOARD_TOKEN_PATTERN = /^[a-z0-9-]{1,100}$/

const BOARD_HOSTS: Record<BoardKind, string[]> = {
  Greenhouse: ['boards.greenhouse.io', 'job-boards.greenhouse.io'],
  Lever: ['jobs.lever.co'],
  Ashby: ['jobs.ashbyhq.com'],
  SmartRecruiters: ['careers.smartrecruiters.com', 'jobs.smartrecruiters.com'],
  Recruitee: [],
  Workable: ['apply.workable.com'],
}

export const BOARD_EXAMPLES: Record<BoardKind, { token: string; url: string }> = {
  Greenhouse: { token: 'stripe', url: 'https://boards.greenhouse.io/stripe' },
  Lever: { token: 'leverdemo', url: 'https://jobs.lever.co/leverdemo' },
  Ashby: { token: 'ashby', url: 'https://jobs.ashbyhq.com/ashby' },
  SmartRecruiters: { token: 'smartrecruiters', url: 'https://careers.smartrecruiters.com/smartrecruiters' },
  Recruitee: { token: 'recruiteedemo', url: 'https://recruiteedemo.recruitee.com' },
  Workable: { token: 'workable', url: 'https://apply.workable.com/workable' },
}

export type BoardInput = { token: string; error?: undefined } | { token?: undefined; error: string }

const WORKDAY_SITE_BLOCKLIST = new Set(['login', 'logout', 'userhome', 'job', 'jobs', 'details', 'apply', 'wday', 'cxs', 'signin', 'createaccount', 'introduceyourself'])

/** Normalizes a public Workday careers URL to the server's tenant.instance/site form. */
export function parseWorkdayInput(raw: string): BoardInput {
  const input = raw.trim()
  const invalid = { error: 'Enter a public Workday careers URL on myworkdayjobs.com; sign-in and account pages are not accepted.' } as const
  if (!input || input.length > 300) return invalid
  const stored = /^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)\.(wd\d{1,3})\/([A-Za-z0-9_-]{1,100})$/i.exec(input)
  if (stored) return WORKDAY_SITE_BLOCKLIST.has(stored[3].toLowerCase()) ? invalid : { token: `${stored[1].toLowerCase()}.${stored[2].toLowerCase()}/${stored[3]}` }
  let url: URL
  try { url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : `https://${input}`) } catch { return invalid }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return invalid
  const host = /^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)\.(wd\d{1,3})\.myworkdayjobs\.com$/i.exec(url.hostname)
  if (!host) return invalid
  let segments: string[]
  try { segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent) } catch { return invalid }
  if (/^[a-z]{2}-[A-Za-z]{2}$/.test(segments[0] ?? '')) segments = segments.slice(1)
  const site = segments[0]
  if (!site || !/^[A-Za-z0-9_-]{1,100}$/.test(site) || WORKDAY_SITE_BLOCKLIST.has(site.toLowerCase())) return invalid
  if (segments.length > 1 && !['job', 'details'].includes(segments[1].toLowerCase())) return invalid
  return { token: `${host[1].toLowerCase()}.${host[2].toLowerCase()}/${site}` }
}

/**
 * Turns what the user typed — a bare token/slug or a board URL — into the token the API expects.
 * URLs must be on the board's own host; the token is the first path segment (Greenhouse embed links: ?for=).
 */
export function parseBoardInput(kind: BoardKind, raw: string): BoardInput {
  const what = kind === 'Greenhouse' ? 'board token' : 'company slug'
  const input = raw.trim()
  if (!input) return { error: `Enter the ${what} or paste the board's URL.` }

  let candidate = input
  if (/[/.:]/.test(input)) {
    let url: URL
    try {
      url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : `https://${input}`)
    } catch {
      return { error: `That is neither a ${what} nor a link we can read.` }
    }
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    const subdomain = kind === 'Recruitee' && host.endsWith('.recruitee.com') ? host.slice(0, -'.recruitee.com'.length) :
      kind === 'Workable' && host.endsWith('.workable.com') && host !== 'apply.workable.com' ? host.slice(0, -'.workable.com'.length) : null
    if (!BOARD_HOSTS[kind].includes(host) && !subdomain) {
      const expected = BOARD_HOSTS[kind].length ? BOARD_HOSTS[kind].join(' or ') : "the provider's careers host"
      return { error: `Use a link on ${expected}, or type the ${what} alone.` }
    }
    const segments = url.pathname.split('/').filter(Boolean)
    candidate = subdomain ?? (kind === 'Greenhouse' && segments[0] === 'embed' ? (url.searchParams.get('for') ?? '') : (segments[0] ?? ''))
    try {
      candidate = decodeURIComponent(candidate)
    } catch {
      /* keep it encoded; the pattern check below rejects it */
    }
    if (!candidate) return { error: `That link does not include a ${what}. Example: ${BOARD_EXAMPLES[kind].url}` }
  }

  const token = candidate.toLowerCase()
  if (!BOARD_TOKEN_PATTERN.test(token))
    return { error: `A ${what} uses only letters, digits and hyphens (up to 100), e.g. ${BOARD_EXAMPLES[kind].token}.` }
  return { token }
}

/** What an Adzuna source will search for: up to 3 keywords and the first location that is not "Remote". */
export function adzunaSearch(criteria: Pick<CampaignCriteria, 'keywords' | 'locations'>): {
  keywords: string[]
  location: string | null
} {
  return {
    keywords: criteria.keywords.slice(0, 3),
    location: criteria.locations.find((l) => l.trim() && l.trim().toLowerCase() !== 'remote')?.trim() ?? null,
  }
}

export const SOURCE_STATUS_LABELS: Record<SourceStatus, { text: string; tone: string }> = {
  Pending: { text: 'Not fetched yet', tone: 'neutral' },
  Ok: { text: 'OK', tone: 'success' },
  Failed: { text: 'Failed', tone: 'danger' },
  Skipped: { text: 'Skipped', tone: 'neutral' },
}

/** Columns the CSV preview requires, per the contract. */
export const CSV_COLUMNS: Record<SupportedMode, { required: string[]; optional: string[] }> = {
  Job: { required: ['title', 'company'], optional: ['location', 'url', 'description', 'id'] },
  Customer: { required: ['name'], optional: ['website', 'country', 'industry', 'description'] },
  Partner: { required: ['name'], optional: ['website', 'country', 'industry', 'description'] },
  Investor: { required: ['name'], optional: ['website', 'country', 'industry', 'description'] },
  Freelance: { required: ['name'], optional: ['website', 'country', 'industry', 'description'] },
}

export const PASTE_MAX_CHARS = 50_000
export const CSV_MAX_BYTES = 1024 * 1024

/** ASP.NET may key validation errors by property path in either casing ("Name", "criteria.Keywords"). */
export function fieldError(errors: Record<string, string[]> | undefined, key: string): string | undefined {
  if (!errors) return undefined
  const wanted = key.toLowerCase()
  const hits = Object.entries(errors).filter(([k]) => k.toLowerCase() === wanted || k.toLowerCase().endsWith(`.${wanted}`))
  return hits.length ? hits.flatMap(([, v]) => v).join(' ') : undefined
}

// ---------- Draft ----------

export interface CampaignDraft {
  profileId: string
  /** null on a new campaign until the user picks one; the profile type then suggests a mode. */
  mode: SupportedMode | null
  name: string
  goal: string
  criteria: CampaignCriteria
  /** Keys for both modes, so switching mode on a new campaign keeps what was typed for the other. */
  weights: Record<string, number>
  resultLimit: number
  /** Job only. null = suggestions off; NaN while the input is blank. */
  autoSuggestMinScore: number | null
}

export const NAME_MAX = 200
export const GOAL_MAX = 2000
export const YEARS_MAX = 60

export function newDraft(): CampaignDraft {
  return {
    profileId: '',
    mode: null,
    name: '',
    goal: '',
    criteria: emptyCriteria(),
    weights: { ...DEFAULT_WEIGHTS.Job, ...DEFAULT_WEIGHTS.Customer },
    resultLimit: RESULT_LIMIT.default,
    autoSuggestMinScore: null,
  }
}

export function draftFromCampaign(c: {
  profileId: string
  mode: OpportunityMode
  name: string
  goal: string
  criteria: Partial<CampaignCriteria>
  weights: Record<string, number>
  resultLimit: number
  autoSuggestMinScore?: number | null
}): CampaignDraft {
  const mode: SupportedMode = isSupportedMode(c.mode) ? c.mode : 'Job'
  return {
    profileId: c.profileId,
    mode,
    name: c.name,
    goal: c.goal ?? '',
    criteria: { ...emptyCriteria(), ...criteriaForMode(mode, c.criteria) },
    weights: { ...DEFAULT_WEIGHTS.Job, ...DEFAULT_WEIGHTS.Customer, ...weightsForMode(mode, c.weights) },
    resultLimit: c.resultLimit,
    // Older API builds do not send the field yet; treat that as "off".
    autoSuggestMinScore: typeof c.autoSuggestMinScore === 'number' ? c.autoSuggestMinScore : null,
  }
}

/**
 * The body the API receives: trimmed text, only this mode's criteria and weights.
 * Job campaigns always send autoSuggestMinScore (null turns suggestions off); Customer campaigns omit it.
 */
export function campaignPayload(draft: CampaignDraft, mode: SupportedMode) {
  const body = {
    name: draft.name.trim(),
    goal: draft.goal.trim(),
    criteria: criteriaForMode(mode, draft.criteria),
    weights: weightsForMode(mode, draft.weights),
    resultLimit: draft.resultLimit,
  }
  return mode === 'Job' ? { ...body, autoSuggestMinScore: draft.autoSuggestMinScore } : body
}

/** Why the draft cannot be saved yet, in words the disabled Save button can show. Empty when it can. */
export function draftProblems(draft: CampaignDraft, profileId: string, mode?: SupportedMode): string[] {
  const problems: string[] = []
  if (!profileId) problems.push('Choose a profile.')
  if (!draft.name.trim()) problems.push('Give the campaign a name.')
  if (draft.name.trim().length > NAME_MAX) problems.push(`Shorten the name to ${NAME_MAX} characters.`)
  if (draft.goal.trim().length > GOAL_MAX) problems.push(`Shorten the goal to ${GOAL_MAX} characters.`)
  if (!Number.isInteger(draft.resultLimit) || draft.resultLimit < RESULT_LIMIT.min || draft.resultLimit > RESULT_LIMIT.max)
    problems.push(`Set the result limit to a whole number from ${RESULT_LIMIT.min} to ${RESULT_LIMIT.max}.`)
  const years = draft.criteria.candidateYears
  if (years !== null && (!Number.isFinite(years) || years < 0 || years > YEARS_MAX))
    problems.push(`Set your years of experience between 0 and ${YEARS_MAX}, or leave it empty.`)
  const suggest = mode === 'Customer' ? null : autoSuggestProblem(draft.autoSuggestMinScore)
  if (suggest) problems.push(suggest)
  return problems
}

/* ---- Campaigns list (design round 3) ---- */

export type CampaignModeFilter = 'all' | OpportunityMode

export function filterCampaigns<T extends { mode: OpportunityMode }>(campaigns: T[], filter: CampaignModeFilter): T[] {
  return filter === 'all' ? campaigns : campaigns.filter((c) => c.mode === filter)
}

export function campaignFilterCounts(campaigns: { mode: OpportunityMode }[]): Record<CampaignModeFilter, number> {
  return {
    all: campaigns.length,
    Job: campaigns.filter((c) => c.mode === 'Job').length,
    Customer: campaigns.filter((c) => c.mode === 'Customer').length,
    Partner: campaigns.filter((c) => c.mode === 'Partner').length,
    Investor: campaigns.filter((c) => c.mode === 'Investor').length,
    Freelance: campaigns.filter((c) => c.mode === 'Freelance').length,
  }
}

/** The latest run is still queued or running, so the row offers "Progress" instead of "Run now". */
export function isRunning(c: { lastJob: { state: string } | null }): boolean {
  return c.lastJob?.state === 'Queued' || c.lastJob?.state === 'Running'
}

/** Schedule cadences offered in the builder (API allows 15–10080 minutes). */
export const CADENCES = [
  { minutes: 360, label: 'Every 6 hours' },
  { minutes: 720, label: 'Every 12 hours' },
  { minutes: 1440, label: 'Daily' },
  { minutes: 4320, label: 'Every 3 days' },
  { minutes: 10080, label: 'Weekly' },
]

export function cadenceLabel(minutes: number): string {
  return CADENCES.find((c) => c.minutes === minutes)?.label ?? `Every ${minutes} minutes`
}

type ModeCopy = {
  goal: string
  steps: [string, string][]
  keywords: [label: string, placeholder: string, hint: string]
  industries: [label: string, placeholder: string]
  problems: [label: string, placeholder: string]
  signals: [label: string, placeholder: string]
}

/** Wording per non-Job mode, so a Partner, Investor or Freelance campaign never reads like a customer search. */
export const MODE_COPY: Record<Exclude<OpportunityMode, 'Job'>, ModeCopy> = {
  Customer: {
    goal: 'e.g. Mid-sized logistics software companies in Germany and the Netherlands that are hiring .NET developers.',
    steps: [
      ['Read every source you add', 'CSV rows, public pages, feeds or pasted lists — de-duplicated first.'],
      ['Score against your criteria', 'Industries, problems and buying signals, each with the sentence that matched.'],
      ['Shortlist with the evidence', 'You pick which companies to keep; nothing is contacted.'],
      ['Prepare reviewed outreach', 'Create an evidence-safe draft, approve its exact version, and track the next action.'],
    ],
    keywords: ['Product and search words', 'e.g. warehouse management', 'Words that describe what you sell.'],
    industries: ['Industries', 'e.g. Logistics software'],
    problems: ['Problems you solve', 'e.g. manual dispatch'],
    signals: ['Buying signals', 'e.g. hiring, funding, expansion'],
  },
  Partner: {
    goal: 'e.g. Systems integrators in the UK that implement Dynamics 365 and lack an in-house .NET team.',
    steps: [
      ['Read every source you add', 'Partner directories, public pages, feeds or your CSV — de-duplicated first.'],
      ['Score partnership fit', 'Complementary industry, the gap you fill and partner signals, each with its evidence.'],
      ['Shortlist with the evidence', 'You choose who to approach; nothing is contacted.'],
      ['Prepare a reviewed partnership note', 'Draft, approve the exact version, send it yourself, track the reply.'],
    ],
    keywords: ['What you would build or resell together', 'e.g. Dynamics 365 integration', 'Words a good partner would publish about itself.'],
    industries: ['Partner industries', 'e.g. Systems integration'],
    problems: ['Gap you fill for them', 'e.g. no .NET delivery team'],
    signals: ['Partner signals', 'e.g. partner programme, new practice, reseller'],
  },
  Investor: {
    goal: 'e.g. Seed funds in Europe that back B2B logistics software and have invested in the last 12 months.',
    steps: [
      ['Read every source you add', 'Fund pages, portfolio lists, feeds or your CSV — de-duplicated first.'],
      ['Score thesis fit', 'Sector, stage and recent activity, each with the sentence that matched.'],
      ['Shortlist with the evidence', 'You choose who to approach; nothing is contacted.'],
      ['Prepare a reviewed investor note', 'Draft from your confirmed traction, approve it, send it yourself.'],
    ],
    keywords: ['Thesis and search words', 'e.g. supply chain software', 'Words a fitting fund uses for its thesis.'],
    industries: ['Sectors they back', 'e.g. B2B SaaS, logistics'],
    problems: ['Stage and cheque fit', 'e.g. seed, pre-seed'],
    signals: ['Investment signals', 'e.g. new fund, recent investment'],
  },
  Freelance: {
    goal: 'e.g. Fixed-scope .NET API projects for small businesses, remote, two to eight weeks.',
    steps: [
      ['Read every source you add', 'Project boards, tenders, feeds or pasted briefs — de-duplicated first.'],
      ['Score project fit', 'Skills, scope and budget signals, each with the sentence that matched.'],
      ['Shortlist with the evidence', 'You choose which projects to bid on; nothing is submitted.'],
      ['Prepare a reviewed proposal', 'Draft from your confirmed skills and rates, approve it, submit it yourself.'],
    ],
    keywords: ['Project search words', 'e.g. ASP.NET Core API', 'Words that appear in briefs you want.'],
    industries: ['Client industries', 'e.g. Retail, healthcare'],
    problems: ['Work you deliver', 'e.g. API integration, migration'],
    signals: ['Project signals', 'e.g. fixed price, urgent, long term'],
  },
}

/** Copy for any mode; Job campaigns use their own wording elsewhere, so they fall back to Customer here. */
export function modeCopy(mode: OpportunityMode): ModeCopy {
  return MODE_COPY[mode === 'Job' ? 'Customer' : mode]
}
