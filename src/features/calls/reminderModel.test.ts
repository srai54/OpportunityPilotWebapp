import { describe, expect, it } from 'vitest'
import type { JobInterview, NextAction } from '../../lib/types'
import type { InterviewBoardRow } from '../staffing/staffingTypes'
import {
  addReminder, callsToday, soonFromBoard, soonFromJobs, dueReminders, msToNextReminder, nextSoon, readReminders, REMINDERS_KEY, snoozeUntil, startsIn, type SoonInterview,
} from './reminderModel'

const now = new Date('2026-10-15T10:00:00Z')
const soon = (key: string, at: string): SoonInterview => ({ key, at, title: 'Interview', detail: '', mode: 'Phone', who: 'Priya', phone: '', joinUrl: null, to: '/' })

describe('nextSoon', () => {
  it('picks the soonest within two hours', () => {
    const items = [soon('b', '2026-10-15T11:30:00Z'), soon('a', '2026-10-15T10:45:00Z'), soon('c', '2026-10-15T13:00:00Z')]
    expect(nextSoon(items, now)?.key).toBe('a')
  })
  it('keeps one that started under 10 minutes ago, drops older', () => {
    expect(nextSoon([soon('a', '2026-10-15T09:55:00Z')], now)?.key).toBe('a')
    expect(nextSoon([soon('a', '2026-10-15T09:40:00Z')], now)).toBeNull()
  })
  it('skips snoozed', () => {
    const items = [soon('a', '2026-10-15T10:45:00Z'), soon('b', '2026-10-15T11:00:00Z')]
    expect(nextSoon(items, now, { a: now.getTime() + 60_000 })?.key).toBe('b')
  })
  it('is null with nothing soon', () => expect(nextSoon([], now)).toBeNull())
})

describe('startsIn and snoozeUntil', () => {
  it('words the time left', () => {
    expect(startsIn('2026-10-15T10:45:00Z', now)).toBe('in 45 min')
    expect(startsIn('2026-10-15T11:20:00Z', now)).toBe('in 1 h 20 min')
    expect(startsIn('2026-10-15T11:00:00Z', now)).toBe('in 1 h')
    expect(startsIn('2026-10-15T09:59:00Z', now)).toBe('now')
  })
  it('snoozes to 15 minutes before, at least 10 minutes', () => {
    expect(snoozeUntil('2026-10-15T11:00:00Z', now)).toBe(new Date('2026-10-15T10:45:00Z').getTime())
    expect(snoozeUntil('2026-10-15T10:05:00Z', now)).toBe(new Date('2026-10-15T10:10:00Z').getTime())
  })
})

function action(p: Partial<NextAction>): NextAction {
  return {
    id: 'x', opportunityId: 'o', opportunityTitle: 'Java Lead', organization: 'Infosys', kind: 'Call', note: '', dueAt: '2026-10-15T09:00:00Z',
    timeZone: 'UTC', state: 'Open', overdue: false, createdAt: '2026-10-10T00:00:00Z', completedAt: null, ...p,
  }
}

describe('callsToday', () => {
  it('lists open calls due today or overdue, and counts calls done today', () => {
    const local = new Date(2026, 9, 15, 12, 0)
    const open = [
      action({ id: 'late', dueAt: new Date(2026, 9, 14, 9, 0).toISOString() }),
      action({ id: 'today', dueAt: new Date(2026, 9, 15, 16, 0).toISOString() }),
      action({ id: 'tomorrow', dueAt: new Date(2026, 9, 16, 9, 0).toISOString() }),
      action({ id: 'mail', kind: 'FollowUp' }),
    ]
    const done = [
      action({ id: 'd1', state: 'Done', completedAt: new Date(2026, 9, 15, 9, 0).toISOString() }),
      action({ id: 'd2', state: 'Done', completedAt: new Date(2026, 9, 14, 9, 0).toISOString() }),
    ]
    const r = callsToday(open, done, local)
    expect(r.todo.map((a) => a.id)).toEqual(['late', 'today'])
    expect(r.done).toBe(1)
    expect(r.total).toBe(3)
  })
})

function memory() {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) } }
}

describe('reminders', () => {
  it('adds, replaces and drops old ones', () => {
    const s = memory()
    addReminder({ key: 'a', at: '2026-10-13T10:00:00Z', title: 'old' }, new Date('2026-10-13T09:00:00Z'), s)
    addReminder({ key: 'b', at: '2026-10-15T12:00:00Z', title: 'one' }, now, s)
    addReminder({ key: 'b', at: '2026-10-15T13:00:00Z', title: 'moved' }, now, s)
    expect(readReminders(s)).toEqual([{ key: 'b', at: '2026-10-15T13:00:00Z', title: 'moved' }])
  })
  it('reads broken storage as empty', () => {
    const s = memory()
    s.setItem(REMINDERS_KEY, 'nope')
    expect(readReminders(s)).toEqual([])
  })
  it('is due from one hour before until the start, once', () => {
    const list = [{ key: 'a', at: '2026-10-15T10:30:00Z', title: 't' }, { key: 'b', at: '2026-10-15T12:00:00Z', title: 't' }]
    expect(dueReminders(list, now, new Set()).map((r) => r.key)).toEqual(['a'])
    expect(dueReminders(list, now, new Set(['a']))).toEqual([])
    expect(msToNextReminder(list, now, new Set(['a']))).toBe(60 * 60_000)
    expect(msToNextReminder([], now, new Set())).toBeNull()
  })
})

describe('soon items', () => {
  it('maps sales interviews with the number from the location or the profile', () => {
    const row = (id: string, p: Partial<InterviewBoardRow['interview']>) => ({
      candidateId: 'c1', candidateName: 'Priya Sharma', candidateEmail: null, dealTitle: 'Java Lead', client: 'Infosys', progressLinkActive: false, progressShowsInterviews: false,
      interview: { id, dealId: 'd1', submissionId: 's1', round: 2, state: 'Scheduled', scheduledAt: '2026-10-15T10:45:00Z', mode: 'Phone', location: null, ...p },
    }) as unknown as InterviewBoardRow
    const items = soonFromBoard([
      row('a', { location: 'Client calls the candidate · +919876543210' }),
      row('b', {}),
      row('c', { mode: 'Video', location: 'https://meet.example/x' }),
      row('d', { state: 'Requested', scheduledAt: null }),
    ], () => '9123456789')
    expect(items.map((i) => [i.key, i.phone, i.joinUrl])).toEqual([
      ['s:a', '+919876543210', null], ['s:b', '9123456789', null], ['s:c', '9123456789', 'https://meet.example/x'],
    ])
    expect(items[0].detail).toBe('Round 2 · Infosys · Priya Sharma · Phone')
  })
  it('maps candidate interviews, reading mode and number from the notes', () => {
    const job = (p: Partial<JobInterview>) => ({
      id: 'j', opportunityId: 'o1', title: 'Java Lead', organization: 'Infosys', round: 1, scheduledAt: '2026-10-15T10:45:00Z', meetingUrl: null,
      notes: null, status: 'Scheduled', version: 1, createdAt: '', updatedAt: '', ...p,
    }) as JobInterview
    const [phone] = soonFromJobs([job({ notes: 'Phone · 45 min · They call me · +919876543210' })])
    expect([phone.mode, phone.phone, phone.joinUrl]).toEqual(['Phone', '+919876543210', null])
    const [video] = soonFromJobs([job({ meetingUrl: 'https://meet.example/x' })])
    expect([video.mode, video.joinUrl]).toEqual(['Video', 'https://meet.example/x'])
    expect(soonFromJobs([job({ status: 'Completed' })])).toEqual([])
  })
})
