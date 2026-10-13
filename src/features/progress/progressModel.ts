/** What the sales team can choose to show a candidate. The stage of each submission is always shown. */
export const SHOW_OPTIONS = [
  { key: 'Client', label: 'Client name' },
  { key: 'Role', label: 'Role' },
  { key: 'Interviews', label: 'Interview date and details' },
  { key: 'Offer', label: 'Offer status (never the pay)' },
] as const
export type ShowKey = (typeof SHOW_OPTIONS)[number]['key']

export interface ProgressLink { active: boolean; show: ShowKey[]; createdAt: string | null; token: string | null }
export interface ProgressItem {
  client: string | null
  role: string | null
  stage: string
  updatedAt: string
  interview: { round: number; scheduledAt: string; timeZone: string | null; mode: string | null; location: string | null; minutes: number | null; notes: string | null } | null
}
export interface ProgressView { firstName: string; asOf: string; items: ProgressItem[] }

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
