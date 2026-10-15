import type { JobPlatform, OpportunityMode } from '../../lib/types'

/**
 * Reach-out planner: most leads have no published email. These are the ways a person actually reaches a company (apply on the
 * posting, the recruiter or decision maker on LinkedIn, a referral from someone they know there, an email lookup service, the
 * company's own contact page), ranked from what the app already knows about this lead. Nothing here sends anything.
 */

export type ReachAction =
  | { kind: 'draft'; channel: 'Email' | 'LinkedInMessage' | 'ContactForm' }
  | { kind: 'linkedin'; href: string; then: 'note' | 'referral' }
  | { kind: 'open'; href: string }
  | { kind: 'find-email' }
  | { kind: 'people'; source: 'Hunter' | 'Apollo' }
  | { kind: 'connect-finder' }

export interface ReachRoute { id: string; title: string; why: string; action: ReachAction }

export interface ReachInput {
  mode: OpportunityMode
  organization: string
  title: string
  url: string | null
  applyUrl: string | null
  platform: JobPlatform | null
  /** An address the company itself published (from Find a contact), when one was found. */
  publishedEmail?: string | null
  /** Hunter or Apollo connected with the person's own key. */
  finders?: readonly ('Hunter' | 'Apollo')[]
  /** Find a contact already ran and found no address. */
  emailSearched?: boolean
}

const AGENT_PLATFORMS: readonly string[] = ['LinkedIn', 'Naukri', 'Instahyre']

const clean = (s: string, max: number) => s.trim().replaceAll('"', '').slice(0, max)
const people = (keywords: string, extra: Record<string, string> = {}) =>
  `https://www.linkedin.com/search/results/people/?${new URLSearchParams({ keywords, ...extra })}`

/** Recruiters and hiring managers at the company (for a job). */
export function hiringPeopleUrl(company: string): string {
  return people(`"${clean(company, 80)}" (recruiter OR "talent acquisition" OR "hiring manager")`)
}

/** People who decide on a purchase at the company (for a sales lead). */
export function decisionMakersUrl(company: string): string {
  return people(`"${clean(company, 80)}" (founder OR CEO OR CTO OR "head of" OR director)`)
}

/** The person's own 1st-degree connections who work at the company: the referral or introduction route. */
export function connectionsAtUrl(company: string): string {
  return people(`"${clean(company, 80)}"`, { network: '["F"]' })
}

/** Job boards and ATS hosts: a lead found there links to the board, whose contact form does not reach the company. */
const BOARD_HOSTS = /(^|\.)(naukri|instahyre|linkedin|indeed|seek|wellfound|angel|glassdoor|monster|foundit|shine|google|greenhouse|lever|ashbyhq|smartrecruiters|recruitee|workable|myworkdayjobs|workday|remotive|remoteok|themuse|weworkremotely|arbeitnow|jobicy|adzuna|freelancer|upwork)\.(com|co|in|io|co\.in|co\.uk|com\.au|net|org|co\.nz)$/i

function websiteOf(input: ReachInput): string | null {
  if (input.mode === 'Job' || !input.url) return null
  try {
    const u = new URL(input.url)
    if (BOARD_HOSTS.test(u.hostname)) return null
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.origin : null
  } catch { return null }
}

/** The ways to reach this lead, best first. */
export function reachRoutes(input: ReachInput): ReachRoute[] {
  const job = input.mode === 'Job'
  const org = input.organization.trim() || input.title.trim()
  const site = websiteOf(input)
  const routes: ReachRoute[] = []

  if (input.publishedEmail)
    routes.push({ id: 'email', title: `Email ${input.publishedEmail}`, why: `${org} published this address, so it is safe to write to.`, action: { kind: 'draft', channel: 'Email' } })

  const posting = input.applyUrl ?? (job ? input.url : null)
  if (job && posting) {
    const agent = input.platform !== null && AGENT_PLATFORMS.includes(input.platform)
    routes.push({
      id: 'apply', title: 'Apply on the posting',
      why: agent ? `Approve it and the desktop agent applies on ${input.platform} for you, or open it and apply yourself. Your cover note is on this page.` : 'The surest route for a job: open the posting and apply. Your cover note is on this page.',
      action: { kind: 'open', href: posting },
    })
  }

  routes.push(job
    ? { id: 'recruiter', title: 'Message the recruiter or hiring manager on LinkedIn', why: 'Opens LinkedIn people search at the company and writes a short connection note (300 characters) for you to send.', action: { kind: 'linkedin', href: hiringPeopleUrl(org), then: 'note' } }
    : { id: 'decision-maker', title: 'Message a decision maker on LinkedIn', why: 'Opens LinkedIn people search for founders, heads and directors at the company and writes a short connection note.', action: { kind: 'linkedin', href: decisionMakersUrl(org), then: 'note' } })

  routes.push({
    id: 'referral', title: job ? 'Ask someone you know there for a referral' : 'Ask a connection for an introduction',
    why: 'Opens your own LinkedIn connections who work there and writes the request. A referral is often the best way in.',
    action: { kind: 'linkedin', href: connectionsAtUrl(org), then: 'referral' },
  })

  if (!input.publishedEmail) {
    if (!input.emailSearched) routes.push({ id: 'find-email', title: 'Look for an address the company published', why: site ? 'Reads the saved posting and up to three pages of the company website. Nothing is guessed.' : 'Reads the saved posting for an address it gives. Nothing is guessed.', action: { kind: 'find-email' } })
    for (const source of input.finders ?? []) routes.push({ id: `people-${source}`, title: `Find the right person with ${source}`, why: `Looks up people at ${org} in your ${source} account. Results are ${source}'s data, shown with its source.`, action: { kind: 'people', source } })
    if ((input.finders ?? []).length === 0) routes.push({ id: 'connect-finder', title: 'Get work emails with Hunter or Apollo', why: 'Connect your own Hunter or Apollo key once; then each lead can be looked up here.', action: { kind: 'connect-finder' } })
  }

  if (site) routes.push({ id: 'contact-form', title: 'Use the contact form on their website', why: `Writes the message for ${new URL(site).host}'s contact form; you paste and submit it there.`, action: { kind: 'draft', channel: 'ContactForm' } })
  return routes
}

const LINKEDIN_NOTE_LIMIT = 300

/** The sign-off name at the end of a generated draft, when it is a real name (not a [placeholder]). */
export function signOffName(body: string): string | null {
  const last = body.trim().split(/\r?\n/).map((l) => l.trim()).filter(Boolean).pop() ?? ''
  if (!last || last.includes('[') || last.length > 60 || /[,:;.!?]$/.test(last)) return null
  return last
}

/**
 * A referral or introduction request for a 1st-degree connection, within LinkedIn's 300-character note limit. It says only what
 * is known (the company, the role, who is asking) and adds no claims.
 */
export function referralNote(input: { mode: OpportunityMode; organization: string; title: string }, name: string | null): string {
  const org = clean(input.organization, 60) || 'your company'
  const role = clean(input.title, 70)
  const sign = name ? `\n${name}` : ''
  const text = input.mode === 'Job'
    ? `Hi, I saw ${org} is hiring${role ? ` for ${role}` : ''}. I'm applying and would be grateful for a referral, or a pointer to the right person on the hiring team. Happy to share my CV. Thank you!${sign}`
    : `Hi, I'd like to talk to the right person at ${org} about working together. Would you be open to a short introduction? Happy to send a two-line summary you can forward. Thank you!${sign}`
  return text.length <= LINKEDIN_NOTE_LIMIT ? text : text.slice(0, LINKEDIN_NOTE_LIMIT - 1).trimEnd() + '…'
}
