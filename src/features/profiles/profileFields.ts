import type { ProfileData, ProfileType } from '../../lib/types'

export interface FieldDef {
  key: string
  label: string
  hint?: string
  rows: number
  /** Claims about you or your product: must be explicitly confirmed, never strengthened for you. */
  confirmable?: boolean
  /** Needed before campaigns and outreach can use this profile well. */
  required?: boolean
}

const IDENTITY_HINT = 'Name, role, company and signature exactly as outreach should be signed. Used as the sign-off of every draft.'

const OFFER_HINT = 'This is the sentence a match is judged against. Concrete beats broad.'
const PLACEHOLDER_HINT = 'Square-bracket placeholders stay as written — a figure is never invented for you.'

export const PROFILE_TYPES: { type: ProfileType; label: string; description: string }[] = [
  { type: 'Product', label: 'Product', description: 'Something you sell — for customer and partner campaigns' },
  { type: 'Business', label: 'Business', description: 'Your company — for investor and partner campaigns' },
  { type: 'Candidate', label: 'Candidate', description: 'Your experience — for job campaigns' },
  { type: 'Services', label: 'Services', description: 'What you deliver — for freelance campaigns' },
]

export const FIELDS: Record<ProfileType, FieldDef[]> = {
  Product: [
    { key: 'offer', label: 'What the product does', hint: OFFER_HINT, rows: 3, required: true },
    { key: 'idealCustomer', label: 'Ideal customer', hint: 'Company size, industry, role you sell to, and the problem they have.', rows: 2, required: true },
    { key: 'capabilities', label: 'Capabilities', rows: 3, confirmable: true },
    { key: 'integrations', label: 'Supported integrations', rows: 2, confirmable: true },
    { key: 'targetSectors', label: 'Target sectors and regions', rows: 2 },
    { key: 'pricing', label: 'Pricing', hint: PLACEHOLDER_HINT, rows: 2 },
    { key: 'proof', label: 'Proof you approve for outreach', hint: 'Customers, metrics or case studies you are allowed to cite.', rows: 3, confirmable: true },
    { key: 'outreachIdentity', label: 'Outreach identity', hint: IDENTITY_HINT, rows: 2, required: true },
  ],
  Business: [
    { key: 'offer', label: 'What the business does', hint: OFFER_HINT, rows: 3, required: true },
    { key: 'sector', label: 'Sector and stage', rows: 2 },
    { key: 'geography', label: 'Geography', rows: 1 },
    { key: 'traction', label: 'Traction', hint: 'Only figures you can stand behind.', rows: 3, confirmable: true },
    { key: 'goal', label: 'Fundraising or partnership goal', hint: PLACEHOLDER_HINT, rows: 2 },
    { key: 'outreachIdentity', label: 'Outreach identity', hint: IDENTITY_HINT, rows: 2, required: true },
  ],
  Candidate: [
    { key: 'offer', label: 'What you offer', hint: OFFER_HINT, rows: 3, required: true },
    { key: 'experience', label: 'Experience', rows: 4, confirmable: true },
    { key: 'skills', label: 'Skills', rows: 2, confirmable: true },
    { key: 'availability', label: 'Availability and terms', hint: PLACEHOLDER_HINT, rows: 2 },
    { key: 'outreachIdentity', label: 'Your name for message sign-offs', hint: 'How your messages end, e.g. Asha Rao. Without it a draft ends with a placeholder you must fill in.', rows: 1 },
  ],
  Services: [
    { key: 'offer', label: 'Services you deliver', hint: OFFER_HINT, rows: 3, required: true },
    { key: 'industries', label: 'Industries you serve', rows: 1 },
    { key: 'idealCustomer', label: 'Ideal customer', hint: 'Who buys this: company type, size, region, the problem they have.', rows: 2, required: true },
    { key: 'regions', label: 'Regions and time zones', rows: 1 },
    { key: 'portfolio', label: 'Portfolio and past work', rows: 3, confirmable: true },
    { key: 'skills', label: 'Skills', rows: 2, confirmable: true },
    { key: 'availability', label: 'Availability and rates', hint: PLACEHOLDER_HINT, rows: 2 },
    { key: 'capacity', label: 'Capacity', hint: 'Team size and how much new work you can take on.', rows: 1 },
    { key: 'proof', label: 'Case studies you approve for outreach', hint: 'Clients, results or links you are allowed to cite.', rows: 3, confirmable: true },
    { key: 'outreachIdentity', label: 'Outreach identity', hint: IDENTITY_HINT, rows: 2, required: true },
  ],
}

export function emptyData(): ProfileData {
  return { fields: {}, confirmations: {} }
}

export function normalizeData(data: Partial<ProfileData> | undefined): ProfileData {
  return { fields: { ...(data?.fields ?? {}) }, confirmations: { ...(data?.confirmations ?? {}) } }
}

/** A version counts as confirmed only when every filled-in claim is confirmed and at least one claim exists. */
export function isFullyConfirmed(type: ProfileType, data: ProfileData): boolean {
  const claims = FIELDS[type].filter((f) => f.confirmable && data.fields[f.key]?.trim())
  return claims.length > 0 && claims.every((f) => data.confirmations[f.key] === true)
}

export function confirmationState(type: ProfileType, data: ProfileData) {
  const filled = FIELDS[type].filter((f) => f.confirmable && data.fields[f.key]?.trim())
  return {
    confirmed: filled.filter((f) => data.confirmations[f.key]).map((f) => f.label),
    awaiting: filled.filter((f) => !data.confirmations[f.key]).map((f) => f.label),
    missing: FIELDS[type].filter((f) => f.confirmable && !data.fields[f.key]?.trim()).map((f) => f.label),
  }
}

/**
 * Plain concatenation of what the user typed — no AI, no rewording.
 * This is the context later sent to Gemini when a campaign runs.
 */
export function buildSummary(type: ProfileType, data: ProfileData): string {
  return FIELDS[type]
    .map((f) => [f.label, data.fields[f.key]?.trim()] as const)
    .filter(([, v]) => v)
    .map(([label, v]) => `${label}: ${v}`)
    .join('\n')
}

/* ---- Round-3 editor layout ---- */

/** Full-width fields; the rest sit two to a row in the editor grid. */
export function isWideField(f: FieldDef): boolean {
  return f.key === 'offer' || f.rows >= 4
}

/** Skills are edited as chips but stored as the comma-separated text campaigns already read. */
export function isTagField(f: FieldDef): boolean {
  return f.key === 'skills'
}

export function splitTags(value: string | undefined): string[] {
  return (value ?? '')
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function joinTags(tags: string[]): string {
  return tags.join(', ')
}

/** Fields shown on the create form: the offer plus the non-claim fields. Claims come after the first save. */
export function createFields(type: ProfileType): FieldDef[] {
  return FIELDS[type].filter((f) => !f.confirmable)
}

/** The short create form of simple mode: what you offer, who it is for, one claim to rank by (skills / capabilities), and the sign-off drafts need. */
export function simpleCreateFields(type: ProfileType): FieldDef[] {
  const keys = ['offer', 'idealCustomer', 'skills', 'capabilities', 'outreachIdentity']
  return FIELDS[type].filter((f) => keys.includes(f.key))
}

/** A search phrase to start the first campaign with: the profile's name without its qualifiers ("Data analyst — 5 years" → "Data analyst"). */
export function starterSearchTerm(name: string): string {
  return name.split(/\s[—–-]\s|\s\(|,/)[0].trim().slice(0, 80)
}

/** Order and wording of the type cards on the create form (design ProfileNew). */
export const NEW_PROFILE_TYPES: { type: ProfileType; label: string; description: string }[] = [
  { type: 'Candidate', label: 'Candidate', description: 'Your experience — scores job postings' },
  { type: 'Services', label: 'Services', description: 'What you deliver — scores projects and tenders' },
  { type: 'Product', label: 'Product', description: 'Something you sell — scores companies' },
  { type: 'Business', label: 'Business', description: 'Your company — for partner and investor work' },
]

/** How ready a profile is: required fields filled, and claims confirmed (a claim is only usable once confirmed). */
export function readiness(type: ProfileType, data: ProfileData) {
  const required = FIELDS[type].filter((f) => f.required)
  const missingRequired = required.filter((f) => !data.fields[f.key]?.trim()).map((f) => f.label)
  const claims = confirmationState(type, data)
  return {
    requiredFilled: required.length - missingRequired.length,
    requiredTotal: required.length,
    missingRequired,
    claimsConfirmed: claims.confirmed.length,
    claimsAwaiting: claims.awaiting,
    ready: missingRequired.length === 0 && claims.awaiting.length === 0,
  }
}
