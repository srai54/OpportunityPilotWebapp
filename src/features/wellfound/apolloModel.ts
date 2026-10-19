/** Apollo lead search (Sales): what the page sends to `POST /api/v1/sales/lead-search` and what comes back. */
export const SIZE_BANDS = [
  { value: '10-20', label: '10–20 people' },
  { value: '20-50', label: '20–50 people' },
  { value: '50-100', label: '50–100 people' },
] as const

export type LeadKind = 'companies' | 'people'
export type Lead = { name: string; company: string | null; title: string | null; employees: number | null; sizeBand: string | null; location: string | null; website: string | null; linkedIn: string | null; source: string }
export type LeadSearchResult = { status: 'Ready' | 'NotConfigured' | 'Failed' | 'DailyLimit'; leads: Lead[]; hidden: number; message: string | null }

export type LeadSearchForm = { keywords: string; titles: string; country: string; sizes: readonly string[]; kind: LeadKind }

/** The request body; null when there is nothing to search for yet (no words and no country). */
export function leadSearchBody(f: LeadSearchForm): { keywords: string | null; titles: string | null; countries: string[]; sizes: string[]; kind: LeadKind; page: number } | null {
  const keywords = f.keywords.trim().slice(0, 200) || null
  const titles = f.kind === 'people' ? f.titles.trim().slice(0, 200) || null : null
  const countries = f.country ? [f.country] : []
  if (!keywords && !titles && countries.length === 0) return null
  return { keywords, titles, countries, sizes: f.sizes.filter((s) => SIZE_BANDS.some((b) => b.value === s)), kind: f.kind, page: 1 }
}

/** "35 (20–50)", "35", or a dash when Apollo gave no size. */
export function sizeText(l: Pick<Lead, 'employees' | 'sizeBand'>): string {
  if (l.employees == null) return '—'
  const band = SIZE_BANDS.find((b) => b.value === l.sizeBand)
  return band ? `${l.employees} (${band.label.replace(' people', '')})` : String(l.employees)
}
