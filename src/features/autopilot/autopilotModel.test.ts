import { describe, expect, it } from 'vitest'
import type { RepeatSchedule } from '../campaigns/campaignModel'
import { autoApproveBody, nextRuns, ranToday, repeatBody, repeatChoice, runWhen } from './autopilotModel'

const now = new Date('2026-10-15T10:00:00Z')
const sched = (o: Partial<RepeatSchedule> = {}): RepeatSchedule => ({ id: 's1', campaignId: 'c1', cadenceMinutes: 1440, nextRunAt: '2026-10-16T09:00:00Z', paused: false, timeZone: 'Asia/Kolkata', version: 2, ...o })

describe('repeatChoice', () => {
  it('maps a schedule to Off / Daily / Weekly / Custom', () => {
    expect(repeatChoice(undefined)).toBe('off')
    expect(repeatChoice(sched({ paused: true }))).toBe('off')
    expect(repeatChoice(sched())).toBe('daily')
    expect(repeatChoice(sched({ cadenceMinutes: 10080 }))).toBe('weekly')
    expect(repeatChoice(sched({ cadenceMinutes: 360 }))).toBe('custom')
  })
})

describe('repeatBody', () => {
  it('creates a schedule one interval from now in the viewer zone', () => {
    expect(repeatBody('weekly', undefined, now, 'Europe/Berlin')).toEqual({ timeZone: 'Europe/Berlin', cadenceMinutes: 10080, nextRunAt: '2026-10-22T10:00:00.000Z', paused: false, expectedVersion: null })
  })
  it('pauses on Off and keeps the rest; nothing to do for Off without a schedule or the same choice', () => {
    expect(repeatBody('off', sched(), now, 'UTC')).toEqual({ timeZone: 'Asia/Kolkata', cadenceMinutes: 1440, nextRunAt: '2026-10-16T09:00:00Z', paused: true, expectedVersion: 2 })
    expect(repeatBody('off', undefined, now, 'UTC')).toBeNull()
    expect(repeatBody('daily', sched(), now, 'UTC')).toBeNull()
  })
  it('resumes a paused daily schedule at its next time, or from now when that time has passed', () => {
    expect(repeatBody('daily', sched({ paused: true }), now, 'UTC')).toMatchObject({ nextRunAt: '2026-10-16T09:00:00Z', paused: false, expectedVersion: 2 })
    expect(repeatBody('daily', sched({ paused: true, nextRunAt: '2026-10-01T09:00:00Z' }), now, 'UTC')).toMatchObject({ nextRunAt: '2026-10-16T10:00:00.000Z' })
    expect(repeatBody('weekly', sched(), now, 'UTC')).toMatchObject({ cadenceMinutes: 10080, nextRunAt: '2026-10-22T10:00:00.000Z' })
  })
})

describe('autoApproveBody', () => {
  it('sends the stored campaign unchanged with the new score and its version, never autoSuggest', () => {
    const c = { name: 'React Pune', goal: 'g', criteria: { keywords: ['react'] }, weights: { skills: 100 }, resultLimit: 50, version: 7, autoSuggestMinScore: 40 }
    const body = autoApproveBody(c, 70) as Record<string, unknown>
    expect(body).toEqual({ name: 'React Pune', goal: 'g', criteria: { keywords: ['react'] }, weights: { skills: 100 }, resultLimit: 50, autoApproveMinScore: 70, expectedVersion: 7 })
    expect('autoSuggestMinScore' in body).toBe(false)
    expect(autoApproveBody(c, null)).toMatchObject({ autoApproveMinScore: null })
  })
})

describe('nextRuns', () => {
  it('lists the schedules that are on, soonest first', () => {
    const list = nextRuns([
      sched({ campaignId: 'a', nextRunAt: '2026-10-17T09:00:00Z' }),
      sched({ campaignId: 'b', nextRunAt: '2026-10-15T12:00:00Z' }),
      sched({ campaignId: 'c', paused: true }),
      sched({ campaignId: 'gone' }),
    ], [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }])
    expect(list.map((r) => r.name)).toEqual(['B', 'A'])
  })
})

describe('runWhen', () => {
  it('says soon times in minutes and hours', () => {
    expect(runWhen('2026-10-15T09:00:00Z', now)).toBe('due now')
    expect(runWhen('2026-10-15T10:25:00Z', now)).toBe('in 25 min')
    expect(runWhen('2026-10-15T13:00:00Z', now)).toBe('in 3 h')
  })
})

describe('ranToday', () => {
  it('keeps runs that finished today or are still going, newest first', () => {
    const local = new Date(2026, 9, 15, 18, 0)
    const at = (h: number) => new Date(2026, 9, 15, h, 0).toISOString()
    const list = ranToday([
      { id: 'old', lastJob: { id: 'j0', state: 'Completed', finishedAt: new Date(2026, 9, 14, 9).toISOString() } },
      { id: 'early', lastJob: { id: 'j1', state: 'Completed', finishedAt: at(8) } },
      { id: 'late', lastJob: { id: 'j2', state: 'Failed', finishedAt: at(15) } },
      { id: 'now', lastJob: { id: 'j3', state: 'Running', finishedAt: null } },
      { id: 'never', lastJob: null },
    ], local)
    expect(list.map((c) => c.id)).toEqual(['now', 'late', 'early'])
  })
})
