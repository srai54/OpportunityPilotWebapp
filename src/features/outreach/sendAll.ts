import type { DraftListItem } from '../../lib/types'

export const BATCH_SEND_MAX = 25

export interface BatchSendResult {
  id: string
  outcome: 'Sent' | 'Failed' | 'NotAttempted'
  reason: string | null
}

/**
 * Which drafts "Send all" may include: emails the person already approved, with a recipient. Drafts still waiting for approval are never
 * included (approval is the person's, per exact version); they are only counted so the card can say so.
 */
export function sendAllCandidates(items: readonly DraftListItem[]): { ready: DraftListItem[]; needApproval: number } {
  const emails = items.filter((d) => d.channel === 'Email' && Boolean(d.recipient?.trim()))
  return { ready: emails.filter((d) => d.state === 'Approved'), needApproval: emails.filter((d) => d.state === 'Draft').length }
}

const OUTCOME_WORDS: Record<BatchSendResult['outcome'], string> = { Sent: 'sent', Failed: 'not sent', NotAttempted: 'not attempted' }

/** One headline and one line per message, so a stopped batch says exactly what went and what did not. */
export function summarizeBatchSend(results: readonly BatchSendResult[], items: readonly DraftListItem[]) {
  const recipient = (id: string) => items.find((d) => d.id === id)?.recipient ?? 'a message'
  const sent = results.filter((r) => r.outcome === 'Sent').length
  const failed = results.filter((r) => r.outcome === 'Failed').length
  const skipped = results.filter((r) => r.outcome === 'NotAttempted').length
  const headline = failed === 0
    ? `${sent} ${sent === 1 ? 'message' : 'messages'} sent`
    : `${sent} sent, then stopped: 1 failed${skipped > 0 ? `, ${skipped} not attempted` : ''}`
  return {
    sent, failed, skipped, headline,
    lines: results.map((r) => ({ id: r.id, recipient: recipient(r.id), outcome: OUTCOME_WORDS[r.outcome], reason: r.reason })),
  }
}
