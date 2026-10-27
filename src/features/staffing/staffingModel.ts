import type { CandidateField, DealSource, DealStage, StaffingCandidate } from './staffingTypes'

/** The forward pipeline, in order (mirrors StaffingDeal.CanMoveTo on the API). */
export const FORWARD: DealStage[] = [
  'New', 'Qualified', 'Shortlisted', 'OutreachApproved', 'Contacted', 'Replied', 'MeetingScheduled',
  'RequirementConfirmed', 'CandidatesSubmitted', 'Interviewing', 'Offer', 'Contracting', 'Won',
]

export const STAGE_LABELS: Record<DealStage, string> = {
  New: 'New', Qualified: 'Qualified', Shortlisted: 'Shortlisted', OutreachApproved: 'Outreach approved', Contacted: 'Contacted',
  Replied: 'Replied', MeetingScheduled: 'Meeting scheduled', RequirementConfirmed: 'Requirement confirmed',
  CandidatesSubmitted: 'Candidates submitted', Interviewing: 'Interviewing', Offer: 'Offer', Contracting: 'Contracting',
  Won: 'Won', Disqualified: 'Disqualified', Lost: 'Lost', OnHold: 'On hold',
}

export const SOURCE_LABELS: Record<DealSource, string> = {
  Manual: 'Manual', Import: 'Import', LinkedInAssisted: 'LinkedIn (assisted)', Upwork: 'Upwork', Freelancer: 'Freelancer.com',
  Tender: 'Tender', Referral: 'Referral', PublicWeb: 'Public web',
}

export const CANDIDATE_FIELDS: { field: CandidateField; label: string }[] = [
  { field: 'Name', label: 'Name' }, { field: 'Headline', label: 'Headline' }, { field: 'Skills', label: 'Skills' },
  { field: 'Experience', label: 'Years of experience' }, { field: 'Location', label: 'Location' },
  { field: 'Availability', label: 'Availability / notice' }, { field: 'Rate', label: 'Rate' }, { field: 'Email', label: 'Email' },
  { field: 'Phone', label: 'Phone' }, { field: 'Resume', label: 'Resume' },
]

export function isClosed(stage: DealStage): boolean {
  return stage === 'Won' || stage === 'Lost' || stage === 'Disqualified'
}

/** The stages a user may move a deal to from here (one step forward, hold/resume, lose or disqualify). */
export function nextStages(stage: DealStage, beforeHold: DealStage | null): DealStage[] {
  if (isClosed(stage)) return []
  if (stage === 'OnHold') return beforeHold ? [beforeHold] : []
  const i = FORWARD.indexOf(stage)
  const forward = i >= 0 && i < FORWARD.length - 1 ? [FORWARD[i + 1]] : []
  return [...forward, 'OnHold', 'Lost', 'Disqualified']
}

export type StageStep = { stage: DealStage; state: 'done' | 'current' | 'todo' }

/** The forward pipeline with where this deal is: a held deal shows the stage it was held at; lost/disqualified show no position. */
export function stageProgress(stage: DealStage, beforeHold: DealStage | null): StageStep[] {
  const at = stage === 'OnHold' ? beforeHold : stage
  const i = at ? FORWARD.indexOf(at) : -1
  return FORWARD.map((s, n) => ({ stage: s, state: i < 0 ? 'todo' : n < i ? 'done' : n === i ? (s === 'Won' ? 'done' : 'current') : 'todo' }))
}

/** Fields the user may choose for a submission: only what the candidate allowed, and only with consent. */
export function submittableFields(candidate: Pick<StaffingCandidate, 'consent' | 'shareableFields'>): CandidateField[] {
  return candidate.consent === 'Granted' ? CANDIDATE_FIELDS.map((f) => f.field).filter((f) => candidate.shareableFields.includes(f)) : []
}

export function money(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount == null) return '—'
  return `${new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(amount)}${currency ? ` ${currency}` : ''}`
}

/** "60 days' notice", "Immediate", "Not available" — the candidate's availability in words. */
export function availabilityLabel(c: Pick<StaffingCandidate, 'availability' | 'noticePeriodDays'>): string {
  if (c.availability === 'NoticePeriod') return `${c.noticePeriodDays ?? '?'} days' notice`
  if (c.availability === 'NotAvailable') return 'Not available'
  if (c.availability === 'Unknown') return 'Availability unknown'
  return c.availability
}

/** "1,800 INR / hour", or null when no rate is recorded. */
export function rateLabel(c: Pick<StaffingCandidate, 'rateAmount' | 'rateCurrency' | 'rateUnit'>): string | null {
  return c.rateAmount == null ? null : `${money(c.rateAmount, c.rateCurrency)}${c.rateUnit ? ` / ${c.rateUnit.toLowerCase()}` : ''}`
}

/** "Shares 7 fields: Name, Headline, Skills…" — the consented fields in one short line. */
export function sharedLine(fields: readonly string[], shown = 3): string {
  if (fields.length === 0) return 'Nothing may be shared yet'
  const head = fields.slice(0, shown).join(', ')
  return `Shares ${fields.length} field${fields.length === 1 ? '' : 's'}: ${head}${fields.length > shown ? ` +${fields.length - shown} more` : ''}`
}

export function percent(rate: number | null): string {
  return rate == null ? '—' : `${Math.round(rate * 100)}%`
}

/** "2026-10-20T09:30:00Z" shown in the interview's own zone, e.g. "Tue 20 Oct, 15:00 (Asia/Kolkata)". */
export function inZone(iso: string | null, zone: string | null): string {
  if (!iso) return 'Not scheduled'
  try {
    const text = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: zone ?? 'UTC' }).format(new Date(iso))
    return `${text} (${zone ?? 'UTC'})`
  } catch {
    return `${iso} UTC`
  }
}

/** A local "YYYY-MM-DDTHH:mm" in a time zone → UTC ISO. Uses the zone's offset at that moment. */
export function zonedToUtc(local: string, zone: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local)
  if (!m) return null
  const [y, mo, d, h, mi] = m.slice(1).map(Number)
  const guess = Date.UTC(y, mo - 1, d, h, mi)
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(new Date(guess))
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
    const asZone = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'))
    return new Date(guess - (asZone - guess)).toISOString()
  } catch {
    return null
  }
}
