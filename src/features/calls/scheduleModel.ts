import { normalisePhone } from '../../lib/phone'
import { zonedToUtc } from '../staffing/staffingModel'
import type { InterviewBoardRow, InterviewMode, NotificationStatus } from '../staffing/staffingTypes'
import { meetingUrlProblem } from '../interviews/interviewsModel'

/* The "Schedule interview" form for both workspaces: pure logic (fields, checks, request bodies, the message to the candidate). */

export const DEFAULT_MINUTES = 45
export const LENGTHS = [15, 30, 45, 60, 90, 120]

const ZONES: { value: string; label: string }[] = [
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Asia/Singapore', label: 'Singapore' },
  { value: 'Europe/London', label: 'London' },
  { value: 'Europe/Berlin', label: 'Central Europe' },
  { value: 'America/New_York', label: 'US East' },
  { value: 'America/Los_Angeles', label: 'US West' },
  { value: 'Australia/Sydney', label: 'Sydney' },
  { value: 'UTC', label: 'UTC' },
]

/** The usual zones, with the viewer's own zone added when it is not one of them. */
export function zoneChoices(own: string): { value: string; label: string }[] {
  return ZONES.some((z) => z.value === own) || !own ? ZONES : [{ value: own, label: own.replace(/_/g, ' ') }, ...ZONES]
}

export type WhoCalls = 'ClientCallsCandidate' | 'CandidateCallsClient' | 'WeCallCandidate'
export const WHO_CALLS: Record<WhoCalls, { sales: string; candidate: string; tell: string }> = {
  ClientCallsCandidate: { sales: 'Client calls the candidate', candidate: 'They call me', tell: 'They will call you on this number.' },
  CandidateCallsClient: { sales: 'Candidate calls the client', candidate: 'I call them', tell: 'Please call them at the time.' },
  WeCallCandidate: { sales: 'We call the candidate', candidate: 'Recruiter calls me', tell: 'We will call you on this number.' },
}

export type TellBy = 'WhatsApp' | 'Email' | 'Self'

export interface ScheduleDraft {
  round: string
  /** YYYY-MM-DD */
  date: string
  /** HH:mm */
  time: string
  zone: string
  minutes: number
  mode: InterviewMode
  whoCalls: WhoCalls
  phone: string
  link: string
  address: string
  tell: TellBy
  remind: boolean
}

export function emptyDraft(zone: string, phone = '', round = 1): ScheduleDraft {
  return {
    round: String(round), date: '', time: '', zone: zone || 'UTC', minutes: DEFAULT_MINUTES, mode: 'Video', whoCalls: 'ClientCallsCandidate',
    phone, link: '', address: '', tell: 'WhatsApp', remind: true,
  }
}

/** UTC ISO of the chosen date and time in the chosen zone, or null. */
export function draftUtc(d: Pick<ScheduleDraft, 'date' | 'time' | 'zone'>): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date) || !/^\d{2}:\d{2}$/.test(d.time)) return null
  return zonedToUtc(`${d.date}T${d.time}`, d.zone)
}

export type DraftField = 'round' | 'date' | 'time' | 'phone' | 'link' | 'address'

/** Field problems before the round trip; empty when it can be sent. */
export function scheduleProblems(d: ScheduleDraft, workspace: 'sales' | 'candidate', now: Date = new Date()): Partial<Record<DraftField, string>> {
  const out: Partial<Record<DraftField, string>> = {}
  if (!/^\d+$/.test(d.round) || Number(d.round) < 1 || Number(d.round) > 20) out.round = 'Pick a round from 1 to 20.'
  if (!d.date) out.date = 'Pick a date.'
  if (!d.time) out.time = 'Pick a time.'
  const at = draftUtc(d)
  if (d.date && d.time && !at) out.time = 'That time does not exist in this zone.'
  else if (at && new Date(at).getTime() < now.getTime() - 60 * 60_000) out.date = 'Pick a time in the future.'
  if (d.mode === 'Video') { const p = meetingUrlProblem(d.link); if (p) out.link = p }
  if (d.mode === 'Phone' && d.phone.trim() && !normalisePhone(d.phone)) out.phone = 'Use a phone number, like +91 98765 43210.'
  if (d.mode === 'Onsite' && d.address.length > 500) out.address = 'Keep the address under 500 characters.'
  if (workspace === 'sales' && d.mode === 'Phone' && d.tell === 'WhatsApp' && !normalisePhone(d.phone)) out.phone = 'Add the number to tell them on WhatsApp.'
  return out
}

/** Phone mode: "who calls whom", plus the number. Video: the link. Onsite: the address. Stored in the interview's location. */
export function locationText(d: ScheduleDraft, workspace: 'sales' | 'candidate' = 'sales'): string | null {
  if (d.mode === 'Phone') {
    const who = WHO_CALLS[d.whoCalls][workspace]
    const n = normalisePhone(d.phone)
    return n ? `${who} · ${n}` : who
  }
  if (d.mode === 'Video') return d.link.trim() || null
  return d.address.trim() || null
}

/** POST deals/{id}/interviews/{iid}/schedule body. */
export function salesScheduleBody(d: ScheduleDraft, expectedVersion: number): object {
  return {
    scheduledAt: draftUtc(d), timeZone: d.zone, durationMinutes: d.minutes, mode: d.mode, location: locationText(d, 'sales'),
    candidateNotes: null, internalNotes: null, expectedVersion,
  }
}

/** POST /api/v1/opportunities/{id}/interviews body: mode, length and who calls go into the notes (the job interview has no fields for them). */
export function candidateScheduleBody(d: ScheduleDraft): object {
  const where = d.mode === 'Video' ? null : locationText(d, 'candidate')
  return {
    round: Number(d.round),
    scheduledAt: draftUtc(d),
    meetingUrl: d.mode === 'Video' ? d.link.trim() || null : null,
    notes: [d.mode, `${d.minutes} min`, where].filter(Boolean).join(' · '),
  }
}

/** "Fri 17 Oct, 3:00 PM IST" in the interview's zone. */
export function whenText(utc: string, zone: string): string {
  try {
    const at = new Date(utc)
    const day = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: zone }).format(at)
    const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: zone, timeZoneName: 'short' }).format(at)
    return `${day}, ${time.replace(/[  ]/g, ' ').replace('GMT+5:30', 'IST')}`
  } catch { return utc }
}

/** The message to the candidate (WhatsApp or email). */
export function tellMessage(d: ScheduleDraft, who: { candidate: string; client: string | null }): string {
  const at = draftUtc(d)
  const first = who.candidate.trim().split(/\s+/)[0] || 'there'
  const client = who.client ? ` with ${who.client}` : ''
  const when = at ? whenText(at, d.zone) : 'the agreed time'
  const how = d.mode === 'Phone' ? ` ${WHO_CALLS[d.whoCalls].tell}`
    : d.mode === 'Video' && d.link.trim() ? ` Join here: ${d.link.trim()}`
    : d.mode === 'Onsite' && d.address.trim() ? ` Address: ${d.address.trim()}` : ''
  return `Hi ${first}, round ${d.round}${client} is set for ${when} (${d.minutes} min).${how} All the best!`
}

/** The `/notified` status that matches how the candidate was told; null when they will tell them themselves. */
export function notifiedStatus(tell: TellBy): NotificationStatus | null {
  return tell === 'WhatsApp' ? 'NotifiedManually' : tell === 'Email' ? 'NotifiedByEmail' : null
}

/** `mailto:` with subject and body (the person's own mail app; they press Send). */
export function mailtoLink(email: string | null, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(email ?? '').replace(/%40/g, '@')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

/** The candidate's latest deal and submission from the interview board (for calls from the candidate list). */
export function latestDealFor(candidateId: string, rows: InterviewBoardRow[]): { dealId: string; submissionId: string; context: string } | undefined {
  const mine = rows.filter((r) => r.candidateId === candidateId)
    .sort((a, b) => b.interview.updatedAt.localeCompare(a.interview.updatedAt))
  const r = mine[0]
  return r ? { dealId: r.interview.dealId, submissionId: r.interview.submissionId, context: [r.client, r.dealTitle].filter(Boolean).join(' · ') } : undefined
}

/** Next round for a submission: one more than the highest seen. */
export function nextRound(rounds: number[]): number {
  return rounds.length ? Math.min(20, Math.max(...rounds) + 1) : 1
}
