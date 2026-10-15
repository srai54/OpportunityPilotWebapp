import { describe, expect, it } from 'vitest'
import type { AssistantAction } from './assistantModel'
import {
  candidateInterviewBody, parseLocalWhen, pickDealSlot, salesScheduleBody, scheduleLine, schedulePlan, scheduleProblem, scheduleQuestion,
  timeLabel, whenLabel,
} from './scheduleModel'

const base: AssistantAction = { kind: 'schedule', label: 'Schedule', query: 'Acme', location: null, page: null, targetId: 'd1', targetType: 'deal', round: 2, when: '2026-10-15T15:00', mode: 'Video', minutes: 45 }
const now = new Date(2026, 9, 12, 10, 0) // Mon 12 Oct 2026, 10:00 local

describe('parseLocalWhen', () => {
  it('reads a local date-time and rejects anything else', () => {
    const d = parseLocalWhen('2026-10-16T15:00')!
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 9, 16, 15, 0])
    for (const bad of ['', null, undefined, '2026-10-16', 'Friday 3pm', '2026-02-31T10:00', '2026-10-16T25:00']) expect(parseLocalWhen(bad)).toBeNull()
  })
})

describe('timeLabel and whenLabel', () => {
  it('says times the way people do', () => {
    expect(timeLabel(new Date(2026, 0, 1, 15, 0))).toBe('3 pm')
    expect(timeLabel(new Date(2026, 0, 1, 9, 30))).toBe('9:30 am')
    expect(timeLabel(new Date(2026, 0, 1, 0, 0))).toBe('12 am')
    expect(timeLabel(new Date(2026, 0, 1, 12, 5))).toBe('12:05 pm')
  })
  it('uses today, tomorrow, a weekday, then a date', () => {
    expect(whenLabel(new Date(2026, 9, 12, 15), now)).toBe('Today 3 pm')
    expect(whenLabel(new Date(2026, 9, 13, 10), now)).toBe('Tomorrow 10 am')
    expect(whenLabel(new Date(2026, 9, 15, 15), now)).toBe('Thu 3 pm')
    expect(whenLabel(new Date(2026, 9, 23, 15), now)).toBe('Fri 23 Oct 3 pm')
  })
})

describe('scheduleProblem', () => {
  it('needs a target and a future time', () => {
    expect(scheduleProblem(base, now)).toBeNull()
    expect(scheduleProblem({ ...base, targetId: null }, now)).toMatch(/which company/)
    expect(scheduleProblem({ ...base, when: 'Friday' }, now)).toMatch(/day and time/)
    expect(scheduleProblem({ ...base, when: '2026-10-10T10:00' }, now)).toMatch(/passed/)
  })
})

describe('schedulePlan', () => {
  it('fills defaults and clamps the length', () => {
    const p = schedulePlan({ ...base, mode: null, minutes: null, round: null, targetType: null }, false)!
    expect(p).toMatchObject({ mode: 'Video', minutes: 45, round: null, targetType: 'opportunity', name: 'Acme' })
    expect(schedulePlan({ ...base, minutes: 2 }, true)!.minutes).toBe(15)
    expect(schedulePlan({ ...base, minutes: 900 }, true)!.minutes).toBe(480)
    expect(schedulePlan({ ...base, round: 99 }, true)!.round).toBeNull()
    expect(schedulePlan({ ...base, when: null }, true)).toBeNull()
    expect(schedulePlan({ ...base, target: 'Infosys · Java Lead', when: '2026-10-15T15:00:00' }, true)!.name).toBe('Infosys · Java Lead')
  })
  it('asks the confirm question in one line', () => {
    const p = schedulePlan(base, true)!
    expect(scheduleQuestion(p, now)).toBe('Interview R2 with Acme, Thu 3 pm, 45 min, Video — schedule it?')
    expect(scheduleLine({ ...p, round: null, name: null, mode: 'Phone' }, now)).toBe('Interview, Thu 3 pm, 45 min, Phone')
  })
})

describe('request bodies', () => {
  it('sends UTC, the zone and the version for Sales; round, time and a note for the candidate', () => {
    const p = schedulePlan(base, true)!
    expect(salesScheduleBody(p, 'Asia/Kolkata', 3)).toEqual({ scheduledAt: p.at.toISOString(), timeZone: 'Asia/Kolkata', durationMinutes: 45, mode: 'Video', location: null, candidateNotes: null, internalNotes: null, expectedVersion: 3 })
    expect(candidateInterviewBody(p)).toEqual({ round: 2, scheduledAt: p.at.toISOString(), meetingUrl: null, notes: 'Video · 45 min' })
  })
})

describe('pickDealSlot', () => {
  const submissions = [{ id: 's1', state: 'Draft' }, { id: 's2', state: 'Sent' }]
  it('reuses a requested round, else starts one for a sent candidate, else nothing', () => {
    const interviews = [
      { id: 'i1', submissionId: 's2', state: 'Requested', round: 1, version: 1 },
      { id: 'i2', submissionId: 's2', state: 'Requested', round: 2, version: 4 },
    ]
    expect(pickDealSlot({ submissions, interviews }, 2)).toEqual({ interviewId: 'i2', version: 4 })
    expect(pickDealSlot({ submissions, interviews }, null)).toEqual({ interviewId: 'i1', version: 1 })
    expect(pickDealSlot({ submissions, interviews: [{ ...interviews[0], state: 'Scheduled' }] }, null)).toEqual({ submissionId: 's2' })
    expect(pickDealSlot({ submissions: [{ id: 's1', state: 'Draft' }], interviews: [] }, null)).toBeNull()
  })
})
