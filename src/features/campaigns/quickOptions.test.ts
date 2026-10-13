import { describe, expect, it } from 'vitest'
import { emptyCriteria } from './campaignModel'
import { applyOptions, NO_OPTIONS, optionsSummary } from './quickOptions'

describe('applyOptions', () => {
  const base = { ...emptyCriteria(), keywords: ['react'], preferredSkills: ['React'] }
  it('leaves the search alone when nothing extra was chosen', () => {
    expect(applyOptions(base, NO_OPTIONS, 'Job')).toMatchObject({ keywords: ['react'], requiredSkills: [], workModes: [], candidateYears: null, maxPostingAgeDays: null, excludeStaffingAgencies: false })
  })
  it('turns the choices into job criteria and keeps the profile skills as nice to have', () => {
    const c = applyOptions(base, { ...NO_OPTIONS, techStack: ['TypeScript', 'AWS'], niceToHave: ['GraphQL', 'React'], workMode: 'Remote', years: '5', postedDays: '7', exclude: ['intern'], noAgencies: true }, 'Job')
    expect(c.requiredSkills).toEqual(['TypeScript', 'AWS'])
    expect(c.preferredSkills).toEqual(['React', 'GraphQL'])
    expect(c.workModes).toEqual(['Remote'])
    expect([c.candidateYears, c.maxPostingAgeDays, c.excludeStaffingAgencies]).toEqual([5, 7, true])
    expect(c.excludeKeywords).toEqual(['intern'])
  })
  it('uses industries and signals for Sales and ignores the job-only fields', () => {
    const c = applyOptions(emptyCriteria(), { ...NO_OPTIONS, industries: ['Logistics'], signals: ['hiring'], techStack: ['AWS'], workMode: 'Remote' }, 'Customer')
    expect(c.industries).toEqual(['Logistics'])
    expect(c.signals).toEqual(['hiring'])
    expect(c.requiredSkills).toEqual([])
    expect(c.workModes).toEqual([])
  })
})

describe('optionsSummary', () => {
  it('says nothing when nothing was chosen and one plain line otherwise', () => {
    expect(optionsSummary(NO_OPTIONS, 'Job')).toBe('')
    expect(optionsSummary({ ...NO_OPTIONS, techStack: ['AWS'], workMode: 'Remote', autoApprove: 70 }, 'Job')).toBe('This run must use AWS · remote · approves 70+ matches automatically.')
  })
})
