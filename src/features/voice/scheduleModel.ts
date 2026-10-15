import type { AssistantAction, InterviewModeName } from './assistantModel'

/**
 * Pure logic for "schedule an interview" by voice: reading the plan the assistant proposed, the confirm sentence, and the request
 * bodies for the existing interview endpoints (Sales: staffing deal interviews; Candidate: opportunity interviews). No React, no fetch.
 */
export const DEFAULT_MINUTES = 45
export const DEFAULT_MODE: InterviewModeName = 'Video'

/** "2026-10-17T15:00" (local, no zone) → a Date in the viewer's zone; null when it is not a full local date-time. */
export function parseLocalWhen(when: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec((when ?? '').trim())
  if (!m) return null
  const [y, mo, d, h, mi, s] = m.slice(1).map((x) => (x === undefined ? 0 : Number(x)))
  const date = new Date(y, mo - 1, d, h, mi, s)
  // Reject rolled-over values such as 31 February.
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d && date.getHours() === h ? date : null
}

/** 15:00 → "3 pm", 09:30 → "9:30 am". */
export function timeLabel(d: Date): string {
  const h = d.getHours()
  const m = d.getMinutes()
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'am' : 'pm'}`
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Today 3 pm", "Tomorrow 10 am", "Thu 3 pm" within a week, else "Thu 23 Oct 3 pm". */
export function whenLabel(d: Date, now: Date): string {
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((day(d) - day(now)) / 86_400_000)
  const t = timeLabel(d)
  if (diff === 0) return `Today ${t}`
  if (diff === 1) return `Tomorrow ${t}`
  if (diff > 1 && diff < 7) return `${DAYS[d.getDay()]} ${t}`
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${t}`
}

/** The plan with defaults filled in: 45 minutes, Video, minutes clamped to 15–480. */
export interface SchedulePlan { targetId: string; targetType: 'deal' | 'opportunity'; name: string | null; round: number | null; at: Date; mode: InterviewModeName; minutes: number }

/** Why the plan cannot run yet, in words for the person; null when it can. */
export function scheduleProblem(a: AssistantAction, now: Date): string | null {
  if (!a.targetId) return 'Say which company or deal the interview is with.'
  const at = parseLocalWhen(a.when)
  if (!at) return 'Say the day and time, e.g. "Friday 3 pm".'
  if (at.getTime() < now.getTime() - 60_000) return 'That time has passed. Say a time in the future.'
  return null
}

export function schedulePlan(a: AssistantAction, sales: boolean): SchedulePlan | null {
  const at = parseLocalWhen(a.when)
  if (!a.targetId || !at) return null
  const minutes = Math.min(480, Math.max(15, Math.round(a.minutes ?? DEFAULT_MINUTES)))
  const mode: InterviewModeName = a.mode === 'Phone' || a.mode === 'Onsite' || a.mode === 'Video' ? a.mode : DEFAULT_MODE
  const round = a.round != null && Number.isInteger(a.round) && a.round >= 1 && a.round <= 20 ? a.round : null
  const targetType = a.targetType === 'deal' || a.targetType === 'opportunity' ? a.targetType : sales ? 'deal' : 'opportunity'
  return { targetId: a.targetId, targetType, name: a.target?.trim() || a.query?.trim() || null, round, at, mode, minutes }
}

/** "Interview R2 with Acme, Thu 3 pm, 45 min, Video" — the plan in one line. */
export function scheduleLine(p: SchedulePlan, now: Date): string {
  return [`Interview${p.round ? ` R${p.round}` : ''}${p.name ? ` with ${p.name}` : ''}`, whenLabel(p.at, now), `${p.minutes} min`, p.mode].join(', ')
}

/** The confirm question asked before anything is saved. */
export function scheduleQuestion(p: SchedulePlan, now: Date): string {
  return `${scheduleLine(p, now)} — schedule it?`
}

/** Body for POST /api/v1/staffing/deals/{id}/interviews/{interviewId}/schedule (UTC time + the viewer's IANA zone). */
export function salesScheduleBody(p: SchedulePlan, timeZone: string, expectedVersion: number): object {
  return { scheduledAt: p.at.toISOString(), timeZone, durationMinutes: p.minutes, mode: p.mode, location: null, candidateNotes: null, internalNotes: null, expectedVersion }
}

/** Body for POST /api/v1/opportunities/{id}/interviews. The candidate side has no length or mode field, so they go in the note. */
export function candidateInterviewBody(p: SchedulePlan): object {
  return { round: p.round, scheduledAt: p.at.toISOString(), meetingUrl: null, notes: `${p.mode} · ${p.minutes} min` }
}

/** What to schedule on a deal: an interview already requested (not yet scheduled) or a new round for a candidate sent to the client. */
export type DealSlot = { interviewId: string; version: number } | { submissionId: string } | null
export function pickDealSlot(work: {
  submissions: { id: string; state: string }[]
  interviews: { id: string; submissionId: string; state: string; round: number; version: number }[]
}, round: number | null): DealSlot {
  const sent = new Set(work.submissions.filter((s) => s.state === 'Sent').map((s) => s.id))
  const open = work.interviews.filter((i) => i.state === 'Requested' && sent.has(i.submissionId))
  const match = (round != null ? open.find((i) => i.round === round) : undefined) ?? open[0]
  if (match) return { interviewId: match.id, version: match.version }
  const first = work.submissions.find((s) => s.state === 'Sent')
  return first ? { submissionId: first.id } : null
}
