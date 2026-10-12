export type JobBoard = 'Indeed' | 'LinkedIn' | 'Seek'

export type BoardJob = {
  providerJobId: string
  title: string
  companyName: string
  companyLogoUrl: string | null
  boardUrl: string
  location: string | null
  isRemote: boolean
  employmentType: string | null
  salaryMin: number | null
  salaryMax: number | null
  salaryCurrency: string | null
  salaryPeriod: string | null
  postedAt: string | null
  snippet: string | null
}

export type BoardSearchResult = {
  board: JobBoard
  status: 'Ready' | 'NotConfigured' | 'Failed'
  jobs: BoardJob[]
  providerResults: number
  message: string | null
  observedAt: string | null
  fromCache: boolean
  source: string
  /** Searches left on the JSearch plan this period (RapidAPI header); null when unknown. */
  quotaRemaining?: number | null
  /** Cursor for the next page of results, or null/absent when there are no more. */
  nextCursor?: string | null
}

export type BoardSearch = {
  query: string; location: string; workMode: string; postedWithinDays: string; country: string
  /** Optional provider filters: FULLTIME, PARTTIME, CONTRACTOR, INTERN (comma-separated), a JSearch job_requirements value, a radius in km. */
  employmentType?: string; experience?: string; radiusKm?: string
}

type BoardInfo = {
  name: string
  /** Opens the same search on the board itself. */
  searchUrl: (s: BoardSearch) => string
  /** What the board's own API allows, in one sentence. */
  boundary: string
  countries?: { value: string; label: string }[]
}

export const BOARDS: Record<JobBoard, BoardInfo> = {
  Indeed: {
    name: 'Indeed',
    searchUrl: (s) => {
      const p = new URLSearchParams()
      if (s.query) p.set('q', s.query)
      if (s.location.trim()) p.set('l', s.location.trim())
      if (s.postedWithinDays) p.set('fromage', s.postedWithinDays)
      return `https://www.indeed.com/jobs?${p}`
    },
    boundary: 'Indeed closed its public job-search API, and its pages block automated reading.',
  },
  LinkedIn: {
    name: 'LinkedIn',
    searchUrl: (s) => {
      const p = new URLSearchParams()
      if (s.query) p.set('keywords', s.query)
      if (s.location.trim()) p.set('location', s.location.trim())
      if (s.postedWithinDays) p.set('f_TPR', `r${Number(s.postedWithinDays) * 86400}`)
      if (s.workMode === 'remote') p.set('f_WT', '2')
      return `https://www.linkedin.com/jobs/search/?${p}`
    },
    boundary: 'LinkedIn job and feed APIs are for approved partners only; your feed and profile are never read.',
  },
  Seek: {
    name: 'SEEK',
    searchUrl: (s) => {
      const p = new URLSearchParams()
      if (s.query) p.set('keywords', s.query)
      if (s.location.trim()) p.set('where', s.location.trim())
      if (s.postedWithinDays) p.set('daterange', s.postedWithinDays)
      return `https://www.seek.${s.country === 'nz' ? 'co.nz' : 'com.au'}/jobs?${p}`
    },
    boundary: 'SEEK APIs are for approved recruitment-software partners; SEEK runs in Australia and New Zealand.',
    countries: [{ value: 'au', label: 'Australia' }, { value: 'nz', label: 'New Zealand' }],
  },
}

/** "FULLTIME" → "Full time"; unknown values are shown as given. */
export function employmentLabel(type: string | null): string | null {
  if (!type) return null
  const known: Record<string, string> = { FULLTIME: 'Full time', PARTTIME: 'Part time', CONTRACTOR: 'Contract', INTERN: 'Internship', TEMPORARY: 'Temporary', PERDIEM: 'Per diem' }
  return known[type.toUpperCase()] ?? type
}

/** Indeed-style "posted within days" choices mapped to the aggregator's date_posted values. */
export function datePostedFor(postedWithinDays: string): string {
  switch (postedWithinDays) {
    case '1': return 'today'
    case '3': return '3days'
    case '7': return 'week'
    case '14':
    case '30': return 'month'
    default: return 'all'
  }
}

/** API path for live postings on one board, or null when there is nothing to search for. */
export function boardJobsPath(board: JobBoard, s: BoardSearch): string | null {
  const q = s.query.trim()
  if (!q) return null
  const params = new URLSearchParams({ board, query: q.slice(0, 200), datePosted: datePostedFor(s.postedWithinDays) })
  if (s.location.trim()) params.set('location', s.location.trim().slice(0, 100))
  if (s.workMode === 'remote') params.set('remoteOnly', 'true')
  if (s.country) params.set('country', s.country.toLowerCase())
  if (s.employmentType) params.set('employmentType', s.employmentType)
  if (s.experience) params.set('experience', s.experience)
  if (s.radiusKm && s.location.trim() && Number(s.radiusKm) > 0) params.set('radiusKm', String(Math.min(500, Math.floor(Number(s.radiusKm)))))
  return `/api/v1/jobboards/jobs?${params}`
}

/** "USD 90K–120K / year", or null when the posting gives no pay. Never guesses a missing bound. */
export function formatSalary(job: Pick<BoardJob, 'salaryMin' | 'salaryMax' | 'salaryCurrency' | 'salaryPeriod'>): string | null {
  const k = (n: number) => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
  const { salaryMin: min, salaryMax: max } = job
  if (min == null && max == null) return null
  const range = min != null && max != null && min !== max ? `${k(min)}–${k(max)}` : k((min ?? max)!)
  const period = job.salaryPeriod ? ` / ${job.salaryPeriod.toLowerCase()}` : ''
  return `${job.salaryCurrency ? `${job.salaryCurrency} ` : ''}${range}${period}`
}

/** Campaign builder address that starts a campaign from a board search: Candidate → Job, Sales → Customer (hiring companies). */
export function campaignFromSearchPath(workspace: 'candidate' | 'sales', s: { query: string; location: string }, board: JobBoard, boardName: string): string {
  const p = new URLSearchParams({ board, mode: workspace === 'sales' ? 'Customer' : 'Job', keywords: s.query.trim().slice(0, 200), name: `${s.query.trim().slice(0, 60)} — ${boardName}` })
  if (s.location.trim()) p.set('location', s.location.trim().slice(0, 100))
  return `/campaigns/new?${p}`
}

/** A LinkedIn people search for the recruiters and hiring managers at a company, optionally narrowed by a role or skill. */
export function recruiterSearchUrl(company: string, skill = ''): string {
  const c = company.trim().replaceAll('"', '').slice(0, 80)
  const k = skill.trim().replaceAll('"', '').slice(0, 60)
  const keywords = `${c ? `"${c}" ` : ''}(recruiter OR "talent acquisition" OR "hiring manager")${k ? ` ${k}` : ''}`
  return `https://www.linkedin.com/search/results/people/?${new URLSearchParams({ keywords })}`
}

/** Countries JSearch understands (two-letter codes). A search without one takes its country from the location. */
export const COUNTRIES: { value: string; label: string }[] = [
  { value: '', label: 'Any country' }, { value: 'in', label: 'India' }, { value: 'us', label: 'United States' }, { value: 'gb', label: 'United Kingdom' },
  { value: 'ca', label: 'Canada' }, { value: 'au', label: 'Australia' }, { value: 'nz', label: 'New Zealand' }, { value: 'sg', label: 'Singapore' },
  { value: 'ae', label: 'United Arab Emirates' }, { value: 'de', label: 'Germany' }, { value: 'fr', label: 'France' }, { value: 'nl', label: 'Netherlands' },
  { value: 'ie', label: 'Ireland' }, { value: 'es', label: 'Spain' }, { value: 'it', label: 'Italy' }, { value: 'br', label: 'Brazil' }, { value: 'za', label: 'South Africa' },
]

/** Filters applied to the postings already on screen (no extra search). */
export type ResultView = { payOnly: boolean; hideAgencies: boolean; newestFirst: boolean }
export const NO_VIEW: ResultView = { payOnly: false, hideAgencies: false, newestFirst: false }

const AGENCY = /\b(staffing|recruit(?:ing|ment|ers?)|manpower|placement|head ?hunt(?:ers?|ing)|talent (?:acquisition|solutions|partners)|employment agency|workforce)\b/i

/** A deliberately conservative name check for staffing and recruiting firms; it never looks at anything but the company name. */
export function isAgency(companyName: string): boolean {
  return AGENCY.test(companyName)
}

export function applyView(jobs: BoardJob[], v: ResultView): { shown: BoardJob[]; hidden: number } {
  let out = jobs
  if (v.payOnly) out = out.filter((j) => j.salaryMin != null || j.salaryMax != null)
  if (v.hideAgencies) out = out.filter((j) => !isAgency(j.companyName))
  if (v.newestFirst) out = [...out].sort((a, b) => (b.postedAt ? Date.parse(b.postedAt) : 0) - (a.postedAt ? Date.parse(a.postedAt) : 0))
  return { shown: out, hidden: jobs.length - out.length }
}
