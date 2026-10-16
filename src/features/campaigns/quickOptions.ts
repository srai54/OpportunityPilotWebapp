import type { CampaignCriteria, WorkMode } from '../../lib/types'

/** The extra choices on "New campaign" beyond a role and a place. All optional; empty means "do not narrow the search". */
export interface QuickOptions {
  /** Must-have tech stack (Jobs) — a job that lacks one of these is excluded. */
  techStack: string[]
  /** Nice to have: scores higher but never excludes. Added to the skills already on your profile. */
  niceToHave: string[]
  workMode: '' | WorkMode
  years: string
  postedDays: string
  exclude: string[]
  noAgencies: boolean
  /** Sales: industries and buying signals. */
  industries: string[]
  signals: string[]
  /** Jobs: approve matches at or above this score automatically; 0 = off (you approve each). */
  autoApprove: number
}

export const NO_OPTIONS: QuickOptions = { techStack: [], niceToHave: [], workMode: '', years: '', postedDays: '', exclude: [], noAgencies: false, industries: [], signals: [], autoApprove: 0 }

export const AUTO_APPROVE_CHOICES = [0, 50, 60, 70, 80] as const
/** New quick campaigns approve matches scoring 50+ for you (decided 2026-10-16); the person can turn it off. */
export const DEFAULT_AUTO_APPROVE = 50

export const POSTED_CHOICES = [
  { days: '', label: 'Any time' }, { days: '1', label: 'Past 24 hours' }, { days: '3', label: 'Past 3 days' }, { days: '7', label: 'Past week' }, { days: '14', label: 'Past 2 weeks' }, { days: '30', label: 'Past month' },
] as const

/** Folds the extra choices into the criteria the API receives. Jobs and Sales use different fields; nothing is set that was left empty. */
export function applyOptions(criteria: CampaignCriteria, o: QuickOptions, mode: 'Job' | 'Customer' | string): CampaignCriteria {
  const out: CampaignCriteria = { ...criteria }
  const years = o.years.trim() === '' ? null : Number(o.years)
  const posted = o.postedDays === '' ? null : Number(o.postedDays)
  if (mode === 'Job') {
    out.requiredSkills = o.techStack
    out.preferredSkills = [...new Set([...criteria.preferredSkills, ...o.niceToHave])]
    out.workModes = o.workMode ? [o.workMode] : []
    out.candidateYears = years !== null && Number.isFinite(years) ? years : null
    out.maxPostingAgeDays = posted !== null && Number.isFinite(posted) ? posted : null
    out.excludeStaffingAgencies = o.noAgencies
  } else {
    out.industries = o.industries
    out.signals = o.signals
  }
  out.excludeKeywords = o.exclude
  return out
}

/** One line saying what the extra choices will do, shown before the run so nothing surprises the person. */
export function optionsSummary(o: QuickOptions, mode: 'Job' | 'Customer' | string): string {
  const parts: string[] = []
  if (mode === 'Job') {
    if (o.techStack.length) parts.push(`must use ${o.techStack.join(', ')}`)
    if (o.workMode) parts.push(o.workMode.toLowerCase())
    if (o.years.trim()) parts.push(`${o.years.trim()} years of experience`)
    if (o.postedDays) parts.push(`posted in the past ${o.postedDays} day${o.postedDays === '1' ? '' : 's'}`)
    if (o.noAgencies) parts.push('no staffing agencies')
    if (o.autoApprove > 0) parts.push(`approves ${o.autoApprove}+ matches automatically`)
  } else {
    if (o.industries.length) parts.push(`in ${o.industries.join(', ')}`)
    if (o.signals.length) parts.push(`signals: ${o.signals.join(', ')}`)
  }
  if (o.exclude.length) parts.push(`without ${o.exclude.join(', ')}`)
  return parts.length ? `This run ${parts.join(' · ')}.` : ''
}
