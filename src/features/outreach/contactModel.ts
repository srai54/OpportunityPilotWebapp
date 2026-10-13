export interface ContactCandidate {
  kind: 'Email' | 'LinkedIn'
  value: string
  label: string
  sourceUrl: string
  sourceNote: string
  matchesCompanySite: boolean
  rank: number
}

export interface FindContactsResult {
  candidates: ContactCandidate[]
  pagesChecked: string[]
  note: string
}

/** The short line under a suggestion: what it is, and whether it is on the company's own domain. */
export function contactBadge(c: Pick<ContactCandidate, 'label' | 'matchesCompanySite' | 'kind'>): string {
  if (c.kind === 'LinkedIn') return c.label
  return c.matchesCompanySite ? `${c.label} · on the company's own domain` : `${c.label} · not on the company's domain`
}

/** Only an address the person chose is ever put into a draft: a LinkedIn page or anything else is opened, never pasted as a recipient. */
export function usableAsRecipient(c: Pick<ContactCandidate, 'kind'>): boolean {
  return c.kind === 'Email'
}
