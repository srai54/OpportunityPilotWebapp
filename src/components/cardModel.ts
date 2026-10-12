/** Pure helpers behind the card components (tested without a DOM). */

/** One or two capital letters for a company avatar: "Stripe" → "S", "Contoso Retail" → "CR", "" → "?". */
export function initialsOf(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const letters = words.length === 1 ? words[0].slice(0, 1) : words[0].slice(0, 1) + words[1].slice(0, 1)
  return letters.toUpperCase()
}

/** A stable colour slot 0–5 per name, so the same company always gets the same avatar tint. */
export function avatarSlot(name: string): number {
  let h = 0
  for (const ch of name.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h % 6
}

export type MatchBand = 'strong' | 'fair' | 'weak' | 'none'

/** Words for the match ring. A match score is a ranking out of 100 — never a chance of success. */
export function matchBand(score: number | null | undefined): MatchBand {
  if (typeof score !== 'number' || Number.isNaN(score)) return 'none'
  if (score >= 70) return 'strong'
  if (score >= 40) return 'fair'
  return 'weak'
}

export const MATCH_WORDS: Record<MatchBand, string> = { strong: 'Strong match', fair: 'Fair match', weak: 'Weak match', none: 'Not scored' }

/** SVG ring geometry: circumference and the dash that fills `score` percent. */
export function ringDash(score: number, radius = 18): { circumference: number; dash: number } {
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(100, Math.max(0, Number.isFinite(score) ? score : 0))
  return { circumference, dash: (circumference * clamped) / 100 }
}

/** Chips shown on a lead card, from what is actually known about it (never invented). */
export function leadChips(o: { location: string | null; platformLabel?: string | null; remote?: boolean; ageDays?: number | null }): string[] {
  const chips: string[] = []
  if (o.remote || /\bremote\b/i.test(o.location ?? '')) chips.push('Remote')
  if (o.platformLabel) chips.push(o.platformLabel)
  if (typeof o.ageDays === 'number' && o.ageDays <= 3) chips.push('New')
  return chips
}

/** "3 selected" / "1 selected" for the bulk bar. */
export function selectedLabel(count: number, noun: { one: string; many: string }): string {
  return `${count} ${count === 1 ? noun.one : noun.many} selected`
}
