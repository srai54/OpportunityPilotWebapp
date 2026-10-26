/** What the sales team can choose to show a candidate. The stage of each submission is always shown. */
export const SHOW_OPTIONS = [
  { key: 'Client', label: 'Client name' },
  { key: 'Role', label: 'Role' },
  { key: 'Interviews', label: 'Interview date and details' },
  { key: 'Offer', label: 'Offer status (never the pay)' },
  { key: 'Note', label: 'A note from you' },
  { key: 'Prep', label: 'Interview prep' },
  { key: 'Roles', label: 'Suggested roles' },
  { key: 'Resume', label: 'Resume builder' },
  { key: 'Journey', label: 'Journey and calendar' },
] as const
export type ShowKey = (typeof SHOW_OPTIONS)[number]['key']

export type RoleAnswer = 'None' | 'Interested' | 'NotForMe'
export interface SuggestedRole { id: string; dealId: string; title: string; answer: RoleAnswer; answeredAt: string | null }
export interface ShareInterview { id: string; round: number; title: string; scheduledAt: string; prep: string | null }
export interface ProgressLink {
  active: boolean; show: ShowKey[]; createdAt: string | null; token: string | null
  note?: string | null; roles?: SuggestedRole[] | null; interviews?: ShareInterview[] | null
}
export interface ProgressRole { id: string; title: string; client: string | null; answer: RoleAnswer }
export interface ProgressItem {
  client: string | null
  role: string | null
  stage: string
  updatedAt: string
  interview: { round: number; scheduledAt: string; timeZone: string | null; mode: string | null; location: string | null; minutes: number | null; notes: string | null; prep?: string | null } | null
}
export interface ProgressView { firstName: string; asOf: string; items: ProgressItem[]; note?: string | null; roles?: ProgressRole[] | null }

/** How far along a stage is, for the candidate's bar. These are the stage words the server sends. */
export function stagePercent(stage: string): number {
  const s = stage.toLowerCase()
  if (s.includes('accepted')) return 100
  if (s.includes('offer was made')) return 90
  if (s.includes('waiting for the client')) return 80
  if (s.includes('interview scheduled')) return 70
  if (s.includes('asked for an interview')) return 55
  if (s.includes('sent to the client')) return 40
  if (s.includes('preparing')) return 15
  return 0
}

/** How the sales team reads the candidate's answer to a suggested role. */
export const ANSWER_LABEL: Record<RoleAnswer, string> = { None: 'No answer yet', Interested: 'Interested', NotForMe: 'Not for me' }

/** Roles worth suggesting: deals that are still open (not won, lost, disqualified or on hold). */
export function openRoles<T extends { stage: string }>(deals: readonly T[]): T[] {
  return deals.filter((d) => !['Won', 'Lost', 'Disqualified', 'OnHold'].includes(d.stage))
}

export const NOTE_MAX = 1000
export const PREP_MAX = 2000

const MY_PROGRESS_KEY = 'op.myProgress'

/** The progress code inside a pasted link or a bare code (letters, digits, - and _), or null. */
export function tokenFrom(input: string): string | null {
  const v = input.trim()
  const m = /\/progress\/([A-Za-z0-9_-]{16,200})/.exec(v) ?? /^([A-Za-z0-9_-]{16,200})$/.exec(v)
  return m ? m[1] : null
}

/** The last progress link opened on this browser, so "My progress" is one tap next time. */
export function readMyProgress(): string | null {
  try { const t = localStorage.getItem(MY_PROGRESS_KEY); return t && tokenFrom(t) ? t : null } catch { return null }
}
export function writeMyProgress(token: string): void {
  try { localStorage.setItem(MY_PROGRESS_KEY, token) } catch { /* private mode: not remembered */ }
}

export function progressUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, '')}/progress/${encodeURIComponent(token)}`
}

/** A ready-to-send note for the candidate. It is opened in the sender's own mail app, so the sender reads and sends it. */
export function updateMailto(candidate: { name: string; email: string | null }, link: string): string | null {
  if (!candidate.email) return null
  const first = candidate.name.split(' ')[0] || candidate.name
  const body = `Hi ${first},\n\nYou can see how your applications are going here, any time:\n${link}\n\nThis page shows only what we chose to share with you. Reply to this email if anything looks wrong.\n`
  return `mailto:${encodeURIComponent(candidate.email)}?subject=${encodeURIComponent('Your progress')}&body=${encodeURIComponent(body)}`
}

export function shownSummary(show: readonly string[]): string {
  return show.length === 0 ? 'the stage only' : `the stage, plus ${show.map((s) => SHOW_OPTIONS.find((o) => o.key === s)?.label.toLowerCase() ?? s.toLowerCase()).join(', ')}`
}

export type StepState = 'done' | 'now' | 'todo' | 'stopped'
export interface Journey {
  steps: { label: string; state: StepState }[]
  /** What the current stage means, in plain words for the candidate. */
  meaning: string
  /** What happens next, and who does it. */
  next: string
  stopped: boolean
}

const STEPS = ['Profile ready', 'Sent to the client', 'Interview', 'Decision', 'Offer'] as const

/** Places a stage sentence from the server on the five-step path the candidate sees, with what it means and what comes next. */
export function journey(stage: string): Journey {
  const s = stage.toLowerCase()
  const at = (now: number, meaning: string, next: string, stopped = false): Journey => ({
    steps: STEPS.map((label, i) => ({ label, state: i < now ? 'done' : i === now ? (stopped ? 'stopped' : 'now') : 'todo' })),
    meaning, next, stopped,
  })
  if (s.includes('accepted')) return { ...at(4, 'You accepted the offer. Congratulations!', 'Your recruiter will send the joining details and paperwork.'), steps: STEPS.map((label) => ({ label, state: 'done' })) }
  if (s.includes('declined')) return at(4, 'The offer was declined.', 'Your recruiter will talk to you about other openings.', true)
  if (s.includes('offer withdrawn')) return at(4, 'The client withdrew the offer.', 'Your recruiter will talk to you about other openings.', true)
  if (s.includes('offer was made')) return at(4, 'The client made you an offer.', 'Your recruiter will go through it with you. Nothing is accepted without you.')
  if (s.includes('waiting for the client')) return at(3, 'Your interview is done. The client is deciding.', 'This usually takes a few days. You will see the answer here as soon as it arrives.')
  if (s.includes('interview scheduled')) return at(2, 'Your interview is booked.', 'Check the time and how to join below. Your recruiter can help you prepare.')
  if (s.includes('asked for an interview')) return at(2, 'The client wants to interview you.', 'Your recruiter is agreeing a time with the client; it appears here once booked.')
  if (s.includes('interview cancelled') || s.includes('interview closed')) return at(2, 'This interview will not go ahead.', 'Your recruiter will tell you if a new time is set.', true)
  if (s.includes('sent to the client')) return at(1, 'Your profile is with the client.', 'The client reviews it and may ask for an interview.')
  if (s.includes('withdrawn')) return at(1, 'This application was withdrawn.', 'Your recruiter will talk to you about other openings.', true)
  return at(0, 'Your recruiter is preparing your profile for this role.', 'Once it is ready, it is sent to the client and this page moves on.')
}

/** "in 2 days", "in 3 h 20 min", "starting now", or null once it is more than an hour past. */
export function countdown(startIso: string, now: Date = new Date()): string | null {
  const ms = new Date(startIso).getTime() - now.getTime()
  if (Number.isNaN(ms)) return null
  if (ms < -60 * 60_000) return null
  if (ms <= 5 * 60_000) return 'starting now'
  const min = Math.round(ms / 60_000)
  const days = Math.floor(min / 1440), hours = Math.floor((min % 1440) / 60), mins = min % 60
  if (days >= 2) return `in ${days} days`
  if (days === 1) return `in 1 day ${hours} h`
  return hours > 0 ? `in ${hours} h ${mins} min` : `in ${mins} min`
}

/** "just now", "12 s ago", "3 min ago" for the live marker. */
export function agoText(fromMs: number, nowMs: number): string {
  const s = Math.max(0, Math.round((nowMs - fromMs) / 1000))
  if (s < 5) return 'just now'
  if (s < 60) return `${s} s ago`
  return `${Math.floor(s / 60)} min ago`
}

/** A meeting link the candidate can open (only http/https); anything else stays a plain "where" line. */
export function joinUrl(location: string | null | undefined): string | null {
  return location && /^https?:\/\/\S+$/i.test(location.trim()) ? location.trim() : null
}

/** The soonest interview that has not ended (or started less than an hour ago) across all applications, or null. */
export function nextInterview(items: readonly ProgressItem[], now: Date = new Date()): ProgressItem | null {
  const upcoming = items.filter((i) => i.interview && countdown(i.interview.scheduledAt, now) !== null)
  upcoming.sort((a, b) => new Date(a.interview!.scheduledAt).getTime() - new Date(b.interview!.scheduledAt).getTime())
  return upcoming[0] ?? null
}

/** One interview as a calendar file (.ics) for Google, Outlook or Apple Calendar. Built in the browser; no pay or internal notes. */
export function interviewIcs(item: ProgressItem, now: Date = new Date()): string {
  const iv = item.interview!
  const stamp = (d: Date) => d.toISOString().replaceAll('-', '').replaceAll(':', '').replace(/\.\d{3}/, '')
  const start = new Date(iv.scheduledAt)
  const end = new Date(start.getTime() + (iv.minutes ?? 60) * 60_000)
  const text = (t: string) => t.replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll(',', '\\,').replaceAll(';', '\\;')
  const join = joinUrl(iv.location)
  const uidPart = (item.client ?? item.role ?? 'x').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//OpportunityPilot//Progress//EN', 'BEGIN:VEVENT', `UID:${stamp(start)}-${iv.round}-${uidPart}@opportunitypilot`,
    `DTSTAMP:${stamp(now)}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`,
    `SUMMARY:${text(`Interview round ${iv.round}${item.client ? ` with ${item.client}` : ''}`)}`,
    ...(iv.location ? [`LOCATION:${text(iv.location)}`] : []),
    ...(join ? [`URL:${join}`, `DESCRIPTION:${text(`Join: ${join}`)}`] : []),
    'END:VEVENT', 'END:VCALENDAR'].join('\r\n') + '\r\n'
}
