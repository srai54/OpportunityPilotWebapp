import type { JobInterview, JobInterviewStatus } from '../../lib/types'
import type { InterviewBoardRow, InterviewState } from '../staffing/staffingTypes'

/* Interviews for both workspaces: the sales tracker (staffing interviews across deals) and the candidate's own job interviews. */

const HOUR = 3_600_000
const DAY = 24 * HOUR

export type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral'

// ---------- Shared ----------

/** "Today, 15:00", "Tomorrow, 09:30", "Tue 20 Oct, 15:00" in the viewer's own time zone, or "Time not set". */
export function whenLabel(iso: string | null, now: Date = new Date(), timeZone?: string): string {
  if (!iso) return 'Time not set'
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return 'Time not set'
  const opts = timeZone ? { timeZone } : {}
  const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', ...opts }).format(at)
  const day = (d: Date) => new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', ...opts }).format(d)
  if (day(at) === day(now)) return `Today, ${time}`
  if (day(at) === day(new Date(now.getTime() + DAY))) return `Tomorrow, ${time}`
  if (day(at) === day(new Date(now.getTime() - DAY))) return `Yesterday, ${time}`
  const date = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', ...opts }).format(at)
  return `${date}, ${time}`
}

/** A `datetime-local` value ("2026-10-20T15:00", the viewer's own zone) → UTC ISO, or null when empty or not a date. */
export function localInputToUtc(local: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null
  const d = new Date(local)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** UTC ISO → a `datetime-local` value in the viewer's own zone; "" when unset. */
export function utcToLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Why a meeting link would be refused, or null when it is fine (empty is fine). */
export function meetingUrlProblem(url: string): string | null {
  const v = url.trim()
  if (!v) return null
  if (v.length > 1000) return 'Keep the link under 1,000 characters.'
  try {
    const u = new URL(v)
    return u.protocol === 'https:' || u.protocol === 'http:' ? null : 'Use a link that starts with https://.'
  } catch {
    return 'Use a link that starts with https://.'
  }
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString('en')} ${n === 1 ? one : many}`
}

// ---------- Sales: the tracker ----------

const OPEN: InterviewState[] = ['Requested', 'Scheduled']

/** Open = still to happen: asked for, or booked and not more than an hour past its start. */
export function isUpcoming(i: { state: InterviewState; scheduledAt: string | null }, now: Date = new Date()): boolean {
  if (!OPEN.includes(i.state)) return false
  if (!i.scheduledAt) return true
  return new Date(i.scheduledAt).getTime() >= now.getTime() - HOUR
}

/** Upcoming soonest first (no time yet last); the rest newest change first. */
export function splitBoard(rows: InterviewBoardRow[], now: Date = new Date()): { upcoming: InterviewBoardRow[]; past: InterviewBoardRow[] } {
  const at = (r: InterviewBoardRow) => (r.interview.scheduledAt ? new Date(r.interview.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER)
  const upcoming = rows.filter((r) => isUpcoming(r.interview, now)).sort((a, b) => at(a) - at(b))
  const past = rows.filter((r) => !isUpcoming(r.interview, now)).sort((a, b) => b.interview.updatedAt.localeCompare(a.interview.updatedAt))
  return { upcoming, past }
}

export interface BoardCounts { upcoming: number; next7Days: number; notTold: number; completed: number }

export function boardCounts(rows: InterviewBoardRow[], now: Date = new Date()): BoardCounts {
  const upcoming = rows.filter((r) => isUpcoming(r.interview, now))
  return {
    upcoming: upcoming.length,
    next7Days: upcoming.filter((r) => r.interview.scheduledAt && new Date(r.interview.scheduledAt).getTime() - now.getTime() < 7 * DAY).length,
    notTold: rows.filter((r) => r.interview.state === 'Scheduled' && r.interview.candidateNotification === 'NotNotified' && isUpcoming(r.interview, now)).length,
    completed: rows.filter((r) => r.interview.state === 'Completed').length,
  }
}

export const SALES_STATE: Record<InterviewState, { text: string; tone: Tone }> = {
  Requested: { text: 'Time to agree', tone: 'warning' },
  Scheduled: { text: 'Scheduled', tone: 'primary' },
  Completed: { text: 'Done', tone: 'success' },
  NoShow: { text: 'No-show', tone: 'danger' },
  Cancelled: { text: 'Cancelled', tone: 'neutral' },
}

/** Whether the candidate knows: only meaningful once a time is booked (or it was cancelled). */
export function toldLabel(i: InterviewBoardRow['interview']): { text: string; tone: Tone } | null {
  if (i.state !== 'Scheduled' && i.state !== 'Cancelled') return null
  return i.candidateNotification === 'NotNotified' ? { text: 'Candidate not told', tone: 'warning' } : { text: 'Candidate told', tone: 'success' }
}

/** What the candidate's progress link shows about this interview. */
export function progressLabel(r: Pick<InterviewBoardRow, 'progressLinkActive' | 'progressShowsInterviews'>): string {
  if (!r.progressLinkActive) return 'No progress link yet'
  return r.progressShowsInterviews ? 'Shown on the progress link' : 'Progress link shows the stage only'
}

export type SalesAction = 'told' | 'done' | 'noShow' | 'nextRound' | 'cancel'

/** The quick actions the API allows for this row (mirrors StaffingInterview's rules). */
export function salesActions(row: InterviewBoardRow, all: InterviewBoardRow[]): SalesAction[] {
  const i = row.interview
  const out: SalesAction[] = []
  if (i.state === 'Scheduled' && i.candidateNotification === 'NotNotified') out.push('told')
  if (i.state === 'Scheduled') out.push('done', 'noShow')
  if (i.state === 'Completed' && !all.some((o) => o.interview.submissionId === i.submissionId && o.interview.round > i.round)) out.push('nextRound')
  if (OPEN.includes(i.state)) out.push('cancel')
  return out
}

/** The API call behind a quick action: path and body. */
export function salesActionRequest(row: InterviewBoardRow, action: SalesAction): { path: string; body: object } {
  const i = row.interview
  const base = `/api/v1/staffing/deals/${i.dealId}/interviews`
  switch (action) {
    case 'told': return { path: `${base}/${i.id}/notified`, body: { status: 'NotifiedManually', expectedVersion: i.version } }
    case 'done': return { path: `${base}/${i.id}/finish`, body: { outcome: 'Completed', expectedVersion: i.version } }
    case 'noShow': return { path: `${base}/${i.id}/finish`, body: { outcome: 'NoShow', expectedVersion: i.version } }
    case 'cancel': return { path: `${base}/${i.id}/finish`, body: { outcome: 'Cancelled', expectedVersion: i.version } }
    case 'nextRound': return { path: base, body: { submissionId: i.submissionId } }
  }
}

export const SALES_ACTION_LABELS: Record<SalesAction, string> = {
  told: 'I told the candidate', done: 'Mark done', noShow: 'No-show', nextRound: 'Ask for next round', cancel: 'Cancel',
}

// ---------- Candidate: my interviews ----------

export const JOB_STATUS: Record<JobInterviewStatus, { text: string; tone: Tone }> = {
  Scheduled: { text: 'Scheduled', tone: 'primary' },
  Completed: { text: 'Done', tone: 'success' },
  NoShow: { text: 'Missed', tone: 'danger' },
  Cancelled: { text: 'Cancelled', tone: 'neutral' },
}

export function isJobUpcoming(i: Pick<JobInterview, 'status' | 'scheduledAt'>, now: Date = new Date()): boolean {
  return isUpcoming({ state: i.status === 'Scheduled' ? 'Scheduled' : 'Completed', scheduledAt: i.scheduledAt }, now)
}

export function splitJobInterviews(rows: JobInterview[], now: Date = new Date()): { upcoming: JobInterview[]; past: JobInterview[] } {
  const at = (r: JobInterview) => (r.scheduledAt ? new Date(r.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER)
  return {
    upcoming: rows.filter((r) => isJobUpcoming(r, now)).sort((a, b) => at(a) - at(b)),
    past: rows.filter((r) => !isJobUpcoming(r, now)).sort((a, b) => at(b) - at(a)),
  }
}

/** Status changes the candidate can make: done or missed need a time; a closed one can be set back to scheduled. */
export function jobStatusChoices(i: Pick<JobInterview, 'status' | 'scheduledAt'>): JobInterviewStatus[] {
  if (i.status !== 'Scheduled') return ['Scheduled']
  return i.scheduledAt ? ['Completed', 'NoShow', 'Cancelled'] : ['Cancelled']
}

export const JOB_ACTION_LABELS: Record<JobInterviewStatus, string> = {
  Scheduled: 'Undo', Completed: 'Mark done', NoShow: 'Missed', Cancelled: 'Cancel',
}

export interface JobInterviewDraft { when: string; link: string; notes: string; round: string }

/** Field problems before the round trip; empty when the draft can be sent. */
export function jobDraftProblems(d: JobInterviewDraft): Partial<Record<keyof JobInterviewDraft, string>> {
  const out: Partial<Record<keyof JobInterviewDraft, string>> = {}
  if (d.when && !localInputToUtc(d.when)) out.when = 'Pick a date and time.'
  const link = meetingUrlProblem(d.link)
  if (link) out.link = link
  if (d.notes.length > 2000) out.notes = 'Keep notes under 2,000 characters.'
  if (d.round && !(/^\d+$/.test(d.round) && Number(d.round) >= 1 && Number(d.round) <= 20)) out.round = 'Use a round from 1 to 20.'
  return out
}

/** The request body for create or update. */
export function jobDraftBody(d: JobInterviewDraft, expectedVersion?: number): object {
  return {
    round: d.round ? Number(d.round) : null,
    scheduledAt: d.when ? localInputToUtc(d.when) : null,
    meetingUrl: d.link.trim() || null,
    notes: d.notes.trim() || null,
    ...(expectedVersion !== undefined ? { expectedVersion } : {}),
  }
}
