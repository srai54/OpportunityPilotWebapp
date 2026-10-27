import { describe, expect, it } from 'vitest'
import { availabilityLabel, inZone, money, nextStages, percent, rateLabel, sharedLine, stageProgress, submittableFields, zonedToUtc } from './staffingModel'

describe('nextStages', () => {
  it('offers one step forward plus hold, lost and disqualified', () =>
    expect(nextStages('Replied', null)).toEqual(['MeetingScheduled', 'OnHold', 'Lost', 'Disqualified']))
  it('resumes a held deal only to where it was', () => expect(nextStages('OnHold', 'Interviewing')).toEqual(['Interviewing']))
  it('offers nothing for closed deals', () => expect(nextStages('Won', null)).toEqual([]))
})

describe('stageProgress', () => {
  it('marks earlier stages done and the current one', () => {
    const steps = stageProgress('Replied', null)
    expect(steps[0]).toEqual({ stage: 'New', state: 'done' })
    expect(steps.find((s) => s.stage === 'Replied')?.state).toBe('current')
    expect(steps.at(-1)?.state).toBe('todo')
  })
  it('shows a held deal at the stage it was held', () =>
    expect(stageProgress('OnHold', 'Offer').find((s) => s.state === 'current')?.stage).toBe('Offer'))
  it('shows every stage done when won', () => expect(stageProgress('Won', null).every((s) => s.state === 'done')).toBe(true))
  it('shows no position for a lost deal', () => expect(stageProgress('Lost', null).every((s) => s.state === 'todo')).toBe(true))
})

describe('submittableFields', () => {
  it('is empty without consent', () => expect(submittableFields({ consent: 'Pending', shareableFields: ['Name'] })).toEqual([]))
  it('keeps the allowed fields in display order', () =>
    expect(submittableFields({ consent: 'Granted', shareableFields: ['Rate', 'Name'] })).toEqual(['Name', 'Rate']))
})

describe('formatting', () => {
  it('formats money and rates', () => {
    expect(money(24000, 'USD')).toBe('24,000 USD')
    expect(money(null, 'USD')).toBe('—')
    expect(percent(0.5)).toBe('50%')
    expect(percent(null)).toBe('—')
  })
  it('converts a local time in a zone to UTC', () => {
    expect(zonedToUtc('2026-10-20T15:00', 'Asia/Kolkata')).toBe('2026-10-20T09:30:00.000Z')
    expect(zonedToUtc('bad', 'UTC')).toBeNull()
  })
  it('shows an interview in its own zone', () => expect(inZone('2026-10-20T09:30:00Z', 'Asia/Kolkata')).toContain('15:00 (Asia/Kolkata)'))
})

describe('candidate card labels', () => {
  it('says availability in words', () => {
    expect(availabilityLabel({ availability: 'NoticePeriod', noticePeriodDays: 60 })).toBe("60 days' notice")
    expect(availabilityLabel({ availability: 'NotAvailable', noticePeriodDays: null })).toBe('Not available')
    expect(availabilityLabel({ availability: 'Immediate', noticePeriodDays: null })).toBe('Immediate')
  })
  it('writes the rate on one line, or nothing', () => {
    expect(rateLabel({ rateAmount: 1800, rateCurrency: 'INR', rateUnit: 'Hour' })).toBe('1,800 INR / hour')
    expect(rateLabel({ rateAmount: null, rateCurrency: 'USD', rateUnit: 'Hour' })).toBeNull()
  })
  it('sums up the shared fields in one short line', () => {
    expect(sharedLine([])).toBe('Nothing may be shared yet')
    expect(sharedLine(['Name', 'Headline'])).toBe('Shares 2 fields: Name, Headline')
    expect(sharedLine(['Name', 'Headline', 'Skills', 'Rate', 'Location'])).toBe('Shares 5 fields: Name, Headline, Skills +2 more')
  })
})
