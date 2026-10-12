import type { DraftChannel } from '../../lib/types'

export type BulkOutcome = { opportunityId: string; draftId: string | null; kind: 'created' | 'existing' | 'failed'; reason?: string }

export interface BulkSummary { created: number; existing: number; failed: number; draftIds: string[]; text: string }

/** One plain sentence about what the bulk draft did, plus the draft ids to send through the queue. */
export function summarizeBulk(outcomes: readonly BulkOutcome[], noun: string): BulkSummary {
  const created = outcomes.filter((o) => o.kind === 'created').length
  const existing = outcomes.filter((o) => o.kind === 'existing').length
  const failed = outcomes.filter((o) => o.kind === 'failed').length
  const draftIds = outcomes.flatMap((o) => (o.draftId ? [o.draftId] : []))
  const parts = [`Drafted ${created} ${created === 1 ? 'message' : 'messages'}`]
  if (existing > 0) parts.push(`${existing} already had one (reused)`)
  if (failed > 0) parts.push(`${failed} could not be drafted`)
  return { created, existing, failed, draftIds, text: `${parts.join(' · ')} for the ${noun} you selected.` }
}

export const BULK_CHANNELS: { value: Extract<DraftChannel, 'Email' | 'LinkedInMessage'>; label: string; hint: string }[] = [
  { value: 'Email', label: 'Email', hint: 'You add each recipient, then send from your mail app.' },
  { value: 'LinkedInMessage', label: 'LinkedIn note', hint: 'A short connection note, copied for you to paste.' },
]

/** The most drafted in one go: each is a separate request, and a person can only review so many. */
export const BULK_MAX = 25

export function queuePath(draftIds: readonly string[]): string {
  return draftIds.length === 0 ? '/outreach' : `/outreach?queue=${draftIds.map(encodeURIComponent).join(',')}&draft=${encodeURIComponent(draftIds[0])}`
}

/** Parses ?queue= back into ids (ignores blanks and anything that is not a guid-like token). */
export function parseQueue(raw: string | null): string[] {
  if (!raw) return []
  return raw.split(',').map((x) => x.trim()).filter((x) => /^[0-9a-f-]{8,}$/i.test(x))
}
