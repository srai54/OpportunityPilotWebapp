import { findPhone } from '../../lib/phone'
import type { JobInterview, NextAction } from '../../lib/types'
import type { InterviewBoardRow } from '../staffing/staffingTypes'

/* Reminders before an interview and the "Calls today" list: pure logic, so it can be tested without a browser. */

const MIN = 60_000
const HOUR = 60 * MIN
export const SOON_WINDOW_MS = 2 * HOUR
export const REMIND_BEFORE_MS = HOUR

/** One interview that may start soon, from either workspace. */
export interface SoonInterview {
  key: string
  at: string
  title: string
  /** "Round 2 · Infosys · Priya Sharma · Phone" */
  detail: string
  mode: 'Video' | 'Phone' | 'Onsite' | null
  who: string
  phone: string
  /** Safe http(s) link to join, or null. */
  joinUrl: string | null
  /** Where to open it in the app. */
  to: string
  dealId?: string
  submissionId?: string
  opportunityId?: string
}

/** The soonest interview starting within the window (or started up to 10 minutes ago), skipping snoozed ones. */
export function nextSoon(items: SoonInterview[], now: Date, snoozed: Record<string, number> = {}, windowMs = SOON_WINDOW_MS): SoonInterview | null {
  const t = now.getTime()
  const open = items
    .filter((i) => (snoozed[i.key] ?? 0) <= t)
    .map((i) => ({ i, at: new Date(i.at).getTime() }))
    .filter(({ at }) => Number.isFinite(at) && at - t <= windowMs && at - t >= -10 * MIN)
    .sort((a, b) => a.at - b.at)
  return open[0]?.i ?? null
}

/** "in 45 min", "in 1 h 20 min", "now". */
export function startsIn(at: string, now: Date): string {
  const min = Math.round((new Date(at).getTime() - now.getTime()) / MIN)
  if (min <= 0) return 'now'
  if (min < 60) return `in ${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `in ${h} h ${m} min` : `in ${h} h`
}

/** Snooze until 15 minutes before the start, or 10 minutes from now when that has passed. */
export function snoozeUntil(at: string, now: Date): number {
  const before = new Date(at).getTime() - 15 * MIN
  return Math.max(before, now.getTime() + 10 * MIN)
}

function sameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** Open Call next actions due today (or overdue), soonest first; and how many Call actions were done today. */
export function callsToday(open: NextAction[], done: NextAction[], now: Date): { todo: NextAction[]; done: number; total: number } {
  const endOfDay = new Date(now)
  endOfDay.setHours(23, 59, 59, 999)
  const todo = open
    .filter((a) => a.kind === 'Call' && a.state === 'Open' && new Date(a.dueAt).getTime() <= endOfDay.getTime())
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
  const doneToday = done.filter((a) => a.kind === 'Call' && a.state === 'Done' && a.completedAt && sameLocalDay(new Date(a.completedAt), now)).length
  return { todo, done: doneToday, total: todo.length + doneToday }
}

// ---------- "Remind me 1 hour before" (kept on this device) ----------

export interface Reminder { key: string; at: string; title: string }

export const REMINDERS_KEY = 'op.interviewReminders'
type KeyStore = Pick<Storage, 'getItem' | 'setItem'>

function local(): KeyStore | null {
  try { return typeof window !== 'undefined' ? window.localStorage : null } catch { return null }
}

export function readReminders(store: KeyStore | null = local()): Reminder[] {
  try {
    const v = JSON.parse(store?.getItem(REMINDERS_KEY) ?? '[]') as unknown
    return Array.isArray(v) ? v.filter((r): r is Reminder => !!r && typeof r.key === 'string' && typeof r.at === 'string' && typeof r.title === 'string') : []
  } catch { return [] }
}

/** Adds or replaces a reminder; drops ones more than a day old. */
export function addReminder(r: Reminder, now: Date = new Date(), store: KeyStore | null = local()): Reminder[] {
  const keep = readReminders(store).filter((x) => x.key !== r.key && new Date(x.at).getTime() > now.getTime() - 24 * HOUR)
  const next = [...keep, r]
  try { store?.setItem(REMINDERS_KEY, JSON.stringify(next)) } catch { /* private mode: no reminder */ }
  return next
}

/** Reminders whose "1 hour before" moment has come and whose interview has not started yet, not yet shown. */
export function dueReminders(list: Reminder[], now: Date, shown: ReadonlySet<string>): Reminder[] {
  const t = now.getTime()
  return list.filter((r) => {
    const at = new Date(r.at).getTime()
    return !shown.has(r.key) && at - REMIND_BEFORE_MS <= t && t < at
  })
}

/** Milliseconds until the next reminder moment (for one timer), or null when none is ahead. */
export function msToNextReminder(list: Reminder[], now: Date, shown: ReadonlySet<string>): number | null {
  const t = now.getTime()
  const ahead = list.filter((r) => !shown.has(r.key)).map((r) => new Date(r.at).getTime() - REMIND_BEFORE_MS - t).filter((ms) => ms > 0)
  return ahead.length ? Math.min(...ahead) : null
}

// ---------- Interviews from both workspaces, as "soon" items ----------


function httpUrl(v: string | null | undefined): string | null {
  if (!v) return null
  try { const u = new URL(v.trim()); return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null } catch { return null }
}

/** Sales: booked interviews with a time. The number comes from the interview's location, else the candidate's profile. */
export function soonFromBoard(rows: InterviewBoardRow[], phoneOf: (candidateId: string) => string | null | undefined): SoonInterview[] {
  return rows.filter((r) => r.interview.state === 'Scheduled' && r.interview.scheduledAt).map((r) => {
    const i = r.interview
    return {
      key: `s:${i.id}`, at: i.scheduledAt!, title: `Round ${i.round} · ${r.client ?? r.dealTitle}`,
      detail: [`Round ${i.round}`, r.client ?? r.dealTitle, r.candidateName, i.mode].filter(Boolean).join(' · '),
      mode: i.mode, who: r.candidateName, phone: findPhone(i.location) || phoneOf(r.candidateId) || '',
      joinUrl: i.mode === 'Video' ? httpUrl(i.location) : null, to: `/staffing/deals/${i.dealId}`, dealId: i.dealId, submissionId: i.submissionId,
    }
  })
}

/** Candidate: own job interviews with a time. Mode and the number are read from the notes the schedule form writes. */
export function soonFromJobs(rows: JobInterview[]): SoonInterview[] {
  return rows.filter((r) => r.status === 'Scheduled' && r.scheduledAt).map((r) => {
    const mode = /^(Video|Phone|Onsite)\b/.exec(r.notes ?? '')?.[1] as SoonInterview['mode'] | undefined
    return {
      key: `j:${r.id}`, at: r.scheduledAt!, title: `Round ${r.round} · ${r.organization || r.title}`,
      detail: [`Round ${r.round}`, r.organization || r.title, mode].filter(Boolean).join(' · '),
      mode: mode ?? (r.meetingUrl ? 'Video' : null), who: r.organization || r.title, phone: findPhone(r.notes),
      joinUrl: httpUrl(r.meetingUrl), to: `/opportunities/${r.opportunityId}`, opportunityId: r.opportunityId,
    }
  })
}
