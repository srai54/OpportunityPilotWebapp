import { describe, expect, it } from 'vitest'
import type { Overview } from '../../lib/types'
import { journeySteps, nextStep, stepForPath } from './journeyModel'

const base: Overview = {
  profiles: 1, applied: 0, needsManual: 0, campaigns: 1, shortlisted: 0, awaitingApproval: 0,
  draftsAwaitingReview: 0, followUpsDue: 0, draftsApproved: 0, draftsSent: 0, followUpsOpen: 0, qualifiedToReview: 0,
}
const o = (p: Partial<Overview>): Overview => ({ ...base, ...p })

describe('nextStep', () => {
  it('is null until the counts are known', () => expect(nextStep('candidate', undefined)).toBeNull())
  it('starts with the profile', () => {
    expect(nextStep('candidate', o({ profiles: 0, campaigns: 0 }))).toMatchObject({ step: 'profile', to: '/profiles/new' })
  })
  it('after a profile, goes to a new campaign (no menu hunting)', () => {
    expect(nextStep('candidate', o({ campaigns: 0 }))).toMatchObject({ step: 'find', to: '/campaigns/new' })
  })
  it('after a run, asks to review what is waiting', () => {
    expect(nextStep('candidate', o({ awaitingApproval: 3 }))).toMatchObject({ step: 'review', to: '/opportunities?view=approvals', action: 'Review 3 jobs' })
  })
  it('uses lead wording in Sales', () => {
    expect(nextStep('sales', o({ awaitingApproval: 1 }))!.action).toBe('Review 1 lead')
    expect(nextStep('sales', o({ campaigns: 0 }))!.action).toBe('Find companies')
  })
  it('finishes what is closest to done first: send approved before new work', () => {
    expect(nextStep('candidate', o({ awaitingApproval: 2, draftsApproved: 1 }))!.step).toBe('review')
    expect(nextStep('candidate', o({ draftsApproved: 1, shortlisted: 1 }))).toMatchObject({ step: 'reach', to: '/outreach' })
    expect(nextStep('candidate', o({ draftsAwaitingReview: 2 }))).toMatchObject({ step: 'reach', action: 'Review 2 messages' })
  })
  it('points at approved jobs that have not been acted on', () => {
    expect(nextStep('candidate', o({ shortlisted: 2 }))).toMatchObject({ step: 'reach', to: '/opportunities' })
  })
  it('then at follow-ups, due ones first', () => {
    expect(nextStep('candidate', o({ shortlisted: 1, draftsSent: 1, followUpsDue: 2 }))).toMatchObject({ step: 'follow', action: 'Follow up (2 due)' })
    expect(nextStep('candidate', o({ shortlisted: 1, draftsSent: 1 }))).toMatchObject({ step: 'follow', to: '/follow-ups' })
  })
  it('asks to review qualified leads when nothing is suggested (Sales has no suggestion queue)', () => {
    expect(nextStep('sales', o({ qualifiedToReview: 4 }))).toMatchObject({ step: 'review', to: '/opportunities', action: 'Review 4 leads' })
    // approved-but-untouched work comes first
    expect(nextStep('sales', o({ qualifiedToReview: 4, shortlisted: 1 }))).toMatchObject({ step: 'reach' })
  })
  it('falls back to finding more', () => {
    expect(nextStep('candidate', o({}))).toMatchObject({ step: 'find', to: '/wellfound' })
  })
  it('tolerates an older API without the new fields', () => {
    const old = { ...base } as Partial<Overview>
    delete old.draftsSent
    delete old.draftsApproved
    delete old.followUpsOpen
    expect(nextStep('candidate', old as Overview)).toBeTruthy()
  })
})

describe('journeySteps / stepForPath', () => {
  it('marks done steps from real counts', () => {
    expect(journeySteps('candidate', o({ shortlisted: 1, draftsSent: 1 })).map((x) => x.done)).toEqual([true, true, true, true, false])
  })
  it('names steps for each workspace', () => {
    expect(journeySteps('sales', o({})).map((x) => x.label)).toEqual(['Profile', 'Find companies', 'Review leads', 'Reach out', 'Follow up'])
  })
  it('maps pages to steps', () => {
    expect(stepForPath('/profiles/new')).toBe('profile')
    expect(stepForPath('/research/abc')).toBe('find')
    expect(stepForPath('/campaigns/new')).toBe('find')
    expect(stepForPath('/opportunities/1')).toBe('review')
    expect(stepForPath('/outreach')).toBe('reach')
    expect(stepForPath('/follow-ups')).toBe('follow')
    expect(stepForPath('/settings')).toBeNull()
  })
})
