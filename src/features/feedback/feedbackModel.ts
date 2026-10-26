/**
 * In-app feedback and browser error reports (2026-10-26). Feedback goes to the admin's list in Settings; errors are reported so problems are
 * seen without a third-party tracker. The triage loop is in OpportunityPilotWebApi/docs/OBSERVABILITY.md.
 */
export type FeedbackKind = 'Bug' | 'Idea' | 'Praise' | 'Other'
export const FEEDBACK_KINDS: { kind: FeedbackKind; label: string }[] = [
  { kind: 'Bug', label: 'Something is broken' },
  { kind: 'Idea', label: 'An idea' },
  { kind: 'Praise', label: 'Something I like' },
  { kind: 'Other', label: 'Other' },
]
export const MAX_FEEDBACK = 2000

export interface FeedbackItem {
  id: string; kind: FeedbackKind; rating: number | null; message: string; page: string | null; appVersion: string | null
  email: string | null; guest: boolean; status: 'New' | 'Seen' | 'Done'; createdAt: string; handledAt: string | null
}
export interface ClientErrorItem {
  id: string; message: string; source: string | null; page: string | null; stack: string | null; appVersion: string | null
  correlationId: string | null; count: number; firstSeenAt: string; lastSeenAt: string
}
export interface FeedbackSummary { new: number; last7Days: number; averageRating: number | null; byKind: Record<string, number>; errorsLast24h: number; errorKinds: number }

/** Why the message cannot be sent yet, or null. */
export function feedbackProblem(message: string): string | null {
  const m = message.trim()
  if (m.length < 3) return 'Tell us a little more (a few words at least).'
  if (m.length > MAX_FEEDBACK) return `Keep it under ${MAX_FEEDBACK} characters.`
  return null
}

/** The page without its query or hash: a progress link's token never leaves the browser in a report. */
export function pageOf(location: { pathname: string }): string {
  return location.pathname.replace(/^\/progress\/[^/]+/, '/progress/…')
}

export interface ErrorReport { message: string; source: string; page: string; stack: string | null; userAgent: string; appVersion: string }

/** Errors the app cannot act on (browser extensions, layout loops, aborted fetches). */
export function ignorable(message: string, stack?: string | null): boolean {
  return /ResizeObserver loop|Script error\.?$|AbortError|The user aborted|chrome-extension:|moz-extension:/i.test(message)
    || /chrome-extension:|moz-extension:|safari-extension:/i.test(stack ?? '')
}

/**
 * Decides which errors are sent: at most `max` per page load and each distinct message once, so one broken loop cannot flood the server.
 */
export function createErrorGate(max = 10) {
  const seen = new Set<string>()
  return (message: string): boolean => {
    if (seen.size >= max || seen.has(message)) return false
    seen.add(message)
    return true
  }
}
