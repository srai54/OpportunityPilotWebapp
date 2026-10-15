/* Calls through the person's own phone: what was tapped (so "After the call" can open on return), outcomes, and the notes saved. */

export type CallEntityType = 'candidate' | 'contact' | 'interview' | 'jobInterview' | 'nextAction' | 'deal' | 'opportunity'

/** Stored in sessionStorage when a Call link is tapped. Ids let the sheet save to the right place. */
export interface PendingCall {
  who: string
  phone: string
  entityType: CallEntityType
  entityId: string
  /** ISO time of the tap. */
  at: string
  /** Sales: the deal the call belongs to (notes, follow-up, scheduling). */
  dealId?: string | null
  /** Sales: the submission an interview would be booked for. */
  submissionId?: string | null
  /** Sales: the client contact called (a talked call is recorded as a phone reply). */
  contactId?: string | null
  /** Candidate: the job the call belongs to (activity note, next action, interview). */
  opportunityId?: string | null
  /** Shown under the name, e.g. "Infosys · Java Lead". */
  context?: string | null
}

export const PENDING_CALL_KEY = 'op.pendingCall'
/** Coming back after this long is not "just after the call": the sheet is not opened. */
export const PENDING_CALL_MAX_MS = 3 * 60 * 60 * 1000
/** Coming back sooner than this was not a call (a mis-tap or the dialler closed at once). */
export const PENDING_CALL_MIN_MS = 1500

type KeyStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function session(): KeyStore | null {
  try { return typeof window !== 'undefined' ? window.sessionStorage : null } catch { return null }
}

export function savePendingCall(call: PendingCall, store: KeyStore | null = session()): void {
  try { store?.setItem(PENDING_CALL_KEY, JSON.stringify(call)) } catch { /* private mode: the sheet just does not open */ }
}

export function readPendingCall(store: KeyStore | null = session()): PendingCall | null {
  try {
    const raw = store?.getItem(PENDING_CALL_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as Partial<PendingCall>
    if (typeof v.who !== 'string' || typeof v.entityType !== 'string' || typeof v.entityId !== 'string' || typeof v.at !== 'string') return null
    return { phone: '', ...v } as PendingCall
  } catch { return null }
}

export function clearPendingCall(store: KeyStore | null = session()): void {
  try { store?.removeItem(PENDING_CALL_KEY) } catch { /* nothing to clear */ }
}

/** Open the sheet only for a recent tap: not a mis-tap, not a call from hours ago. */
export function shouldAskAboutCall(call: PendingCall | null, now: Date = new Date()): boolean {
  if (!call) return false
  const age = now.getTime() - new Date(call.at).getTime()
  return Number.isFinite(age) && age >= PENDING_CALL_MIN_MS && age <= PENDING_CALL_MAX_MS
}

export type CallOutcome = 'Talked' | 'NoAnswer' | 'CallBack' | 'WrongNumber'

export const CALL_OUTCOMES: { value: CallOutcome; label: string }[] = [
  { value: 'Talked', label: 'Talked' },
  { value: 'NoAnswer', label: 'No answer' },
  { value: 'CallBack', label: 'Call back later' },
  { value: 'WrongNumber', label: 'Wrong number' },
]

export const OUTCOME_LABEL: Record<CallOutcome, string> = Object.fromEntries(CALL_OUTCOMES.map((o) => [o.value, o.label])) as Record<CallOutcome, string>

/** "Call with Priya · No answer · Free Fri after 2 pm." — trimmed to the API's limit. */
export function callNote(who: string, outcome: CallOutcome, note: string, max = 500): string {
  const text = [`Call with ${who.trim() || 'contact'}`, OUTCOME_LABEL[outcome], note.trim()].filter(Boolean).join(' · ')
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

/** Follow-up time: `days` later at 10:00 local time. */
export function followUpAt(now: Date, days = 2): Date {
  const d = new Date(now)
  d.setDate(d.getDate() + days)
  d.setHours(10, 0, 0, 0)
  return d
}

/** The follow-up note for the next action. */
export function followUpNote(who: string, outcome: CallOutcome, phone: string): string {
  const what = outcome === 'NoAnswer' || outcome === 'CallBack' ? `Call ${who} again` : `Follow up with ${who}`
  return phone ? `${what} (${phone})` : what
}

/** "Just now", "5 min ago", "2 h ago". */
export function agoLabel(iso: string, now: Date = new Date()): string {
  const min = Math.round((now.getTime() - new Date(iso).getTime()) / 60_000)
  if (!Number.isFinite(min) || min < 2) return 'Just now'
  if (min < 60) return `${min} min ago`
  return `${Math.round(min / 60)} h ago`
}

/** Where a call can be saved: a deal (Sales), a job (Candidate), or nowhere known. */
export function saveTarget(call: PendingCall): 'deal' | 'opportunity' | null {
  if (call.dealId) return 'deal'
  if (call.opportunityId) return 'opportunity'
  return null
}
