import type { BoardJob } from './boardModel'

/**
 * One shared rule for "is this a contract role?" and "is this remote?" (J4), used by every source on Find.
 * It reads the posting's own fields — employment type first, then the title, then the text — so a source that
 * says so explicitly always wins, and the text only adds signal. A text match is a hint, not a promise.
 */
type Signals = Pick<BoardJob, 'employmentType' | 'title'> & Partial<Pick<BoardJob, 'isRemote' | 'snippet' | 'description' | 'location'>>

/** Employment types the boards use for contract work (JSearch CONTRACTOR, Adzuna contract, SEEK Contract/Temp, Remotive freelance…). */
const CONTRACT_TYPE = /\b(contract(?:or)?|freelance|temp(?:orary)?|c2c|interim)\b/i

/** Titles: "Contract React developer", "React developer (Contractor)", "Freelance …", "C2C", "6-month …". */
const CONTRACT_TITLE = /\b(contract(?:or)?|freelance(?:r)?|c2c|corp[- ]to[- ]corp|interim|day[- ]rate|\d{1,2}[- ]?(?:month|mo)s?)\b/i

/**
 * Text: only phrases that rarely mean anything else. "B2B" alone is left out on purpose ("B2B SaaS" is not a contract);
 * "B2B contract" counts.
 */
const CONTRACT_TEXT = /\b(contract (?:role|position|basis|assignment|engagement|to hire)|on a contract|fixed[- ]term contract|freelance (?:role|position|basis|project)|contractor (?:role|position)|c2c|corp[- ]to[- ]corp|b2b (?:contract|agreement)|day rate|daily rate|\d{1,2}[- ]?(?:month|mo)s? (?:contract|engagement|assignment))\b/i

/** A contract (not an employee) role: the board's own employment type says so, or the title, or a clear phrase in the text. */
export function isContract(j: Signals): boolean {
  if (CONTRACT_TYPE.test(j.employmentType ?? '')) return true
  if (CONTRACT_TITLE.test(j.title)) return true
  return CONTRACT_TEXT.test(`${j.description ?? j.snippet ?? ''}`)
}

const REMOTE_PLACE = /\b(remote|anywhere|worldwide|work from home|wfh|distributed)\b/i
const REMOTE_TEXT = /\b(fully remote|100% remote|remote[- ]first|remote position|remote role|work from home|work from anywhere|wfh|distributed team|location independent)\b/i

/** A remote role: the source's own flag, or the place says remote/anywhere, or the title or text clearly says so. */
export function isRemote(j: Signals): boolean {
  if (j.isRemote) return true
  if (REMOTE_PLACE.test(j.location ?? '')) return true
  if (/\bremote\b/i.test(j.title)) return true
  return REMOTE_TEXT.test(`${j.description ?? j.snippet ?? ''}`)
}
